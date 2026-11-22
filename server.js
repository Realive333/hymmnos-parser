import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { HYMMNOS_RULES } from './src/hymmnos_rules.js';
import { HYMMNOS_DICTIONARY } from './src/hymmnos_dictionary.js';
import { createTranslationLimit } from './src/translation_limit.js';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// APIキーを環境変数から取得
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');
  return new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
};

// SSEイベントを送信するヘルパー
const sendEvent = (res, data) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// POST /api/translate — 日本語 → ヒュムノス語
const dictionaryPrompt = JSON.stringify(HYMMNOS_DICTIONARY, null, 2);
const responseSchema = {
  type: 'object',
  properties: {
    hymmnos: { type: 'string' },
    words: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          meaning: { type: 'string' },
          isCoinage: { type: 'boolean' },
        },
        required: ['word', 'meaning', 'isCoinage'],
      },
    },
  },
  required: ['hymmnos', 'words'],
};

export function createApp({ createClient = getAI, model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite' } = {}) {
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use(express.static(join(__dirname, 'dist')));
  const translationLimit = createTranslationLimit();

  const translate = (field, makePrompt, structured = false) => async (req, res) => {
    const text = req.body?.[field];
    if (typeof text !== 'string' || !text.trim() || text.length > 2000) {
      return res.status(400).json({ error: `${field} must be a non-empty string of at most 2000 characters` });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const stream = await createClient().models.generateContentStream({
        model,
        contents: makePrompt(text),
        config: {
          thinkingConfig: { includeThoughts: true, thinkingLevel: 'LOW' },
          ...(structured && { responseMimeType: 'application/json', responseJsonSchema: responseSchema }),
        },
      });
      let responseAccumulator = '';
      let usage;
      let finishReason;
      for await (const chunk of stream) {
        usage = chunk.usageMetadata ?? usage;
        finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          const text = part.text ?? '';
          if (part.thought) {
            sendEvent(res, { type: 'thought', text });
          } else {
            responseAccumulator += text;
            sendEvent(res, { type: 'response', text });
          }
        }
      }
      if (!responseAccumulator || (finishReason && finishReason !== 'STOP')) {
        throw new Error(`Incomplete model response: ${finishReason || 'empty'}`);
      }
      if (structured) {
        const parsed = JSON.parse(responseAccumulator);
        if (typeof parsed.hymmnos !== 'string' || !Array.isArray(parsed.words) ||
            !parsed.words.every(word => typeof word.word === 'string' &&
              typeof word.meaning === 'string' && typeof word.isCoinage === 'boolean')) {
          throw new Error('Invalid structured model response');
        }
      }
      sendEvent(res, { type: 'done', full: responseAccumulator, usage });
    } catch (err) {
      console.error(`[${req.path}] Error:`, err.message);
      sendEvent(res, { type: 'error', message: 'Translation failed. Please try again.' });
    } finally {
      res.end();
    }
  };

  app.post('/api/translate', translationLimit, translate('inputText', text => `あなたはゲーム「アルトネリコ」シリーズに登場する架空言語「ヒュムノス語（Hymmnos）」の専門的な翻訳家です。
以下の日本語のテキストを、提供された【ヒュムノス語 翻訳ルール】と【ヒュムノス語 辞書】に厳密に従って標準的なヒュムノス語に翻訳してください。

【ヒュムノス語 翻訳ルール】
${HYMMNOS_RULES}

【ヒュムノス語 辞書 (JSON)】
${dictionaryPrompt}

入力:
${text}

【出力形式の厳守】
必ず以下のJSON形式のみを返してください。余計な文章やマークダウンのコードブロック記号は一切付けないこと。
{
  "hymmnos": "翻訳されたヒュムノス語テキスト",
  "words": [
    {
      "word": "使用したヒュムノス語の単語",
      "meaning": "その単語の日本語の意味",
      "isCoinage": false
    },
    {
      "word": "辞書に存在しなかったため自作した造語",
      "meaning": "その造語が表す日本語の意味",
      "isCoinage": true
    }
  ]
}
想音（Rrha, Was, Wee, Fou, Ma, Nn, au, yea, ra など）はwordsリストに含めなくて良い。`, true));

  app.post('/api/translate-back', translationLimit, translate('hymmnosText', text => `あなたはゲーム「アルトネリコ」シリーズに登場する架空言語「ヒュムノス語（Hymmnos）」の専門的な翻訳家です。
以下のヒュムノス語のテキストを、提供された【ヒュムノス語 翻訳ルール】と【ヒュムノス語 辞書】を参照しながら自然な日本語に翻訳してください。
余計な解説や会話文は一切含めず、翻訳された日本語テキストのみを返してください。

【ヒュムノス語 翻訳ルール】
${HYMMNOS_RULES}

【ヒュムノス語 辞書 (JSON)】
${dictionaryPrompt}

入力:
${text}`));

  // SPAルーティング用フォールバック（index.htmlを返す）
  app.get('*', (_req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });

  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  const PORT = process.env.PORT || 8080;
  createApp().listen(PORT, () => {
    console.log(`Hymmnos Server is running on http://localhost:${PORT}`);
  });
}
