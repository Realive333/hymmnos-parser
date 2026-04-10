import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HYMMNOS_RULES } from './src/hymmnos_rules.js';
import { HYMMNOS_DICTIONARY } from './src/hymmnos_dictionary.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

// Viteでビルドされた静的ファイルを配信
app.use(express.static(join(__dirname, 'dist')));

// APIキーを環境変数から取得
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');
  return new GoogleGenerativeAI(apiKey);
};

// SSEイベントを送信するヘルパー
const sendEvent = (res, data) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// POST /api/translate — 日本語 → ヒュムノス語
app.post('/api/translate', async (req, res) => {
  const { inputText } = req.body;
  if (!inputText) return res.status(400).json({ error: 'inputText is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const ai = getAI();
    const model = ai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        thinkingConfig: { includeThoughts: true },
      },
    });

    const prompt = `あなたはゲーム「アルトネリコ」シリーズに登場する架空言語「ヒュムノス語（Hymmnos）」の専門的な翻訳家です。
以下の日本語のテキストを、提供された【ヒュムノス語 翻訳ルール】と【ヒュムノス語 辞書】に厳密に従って標準的なヒュムノス語に翻訳してください。

【ヒュムノス語 翻訳ルール】
${HYMMNOS_RULES}

【ヒュムノス語 辞書 (JSON)】
${JSON.stringify(HYMMNOS_DICTIONARY, null, 2)}

入力:
${inputText}

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
想音（Rrha, Was, Wee, Fou, Ma, Nn, au, yea, ra など）はwordsリストに含めなくて良い。`;

    const result = await model.generateContentStream(prompt);
    let responseAccumulator = '';

    for await (const chunk of result.stream) {
      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.thought) {
          sendEvent(res, { type: 'thought', text: part.text ?? '' });
        } else {
          responseAccumulator += part.text ?? '';
          sendEvent(res, { type: 'response', text: part.text ?? '' });
        }
      }
    }

    sendEvent(res, { type: 'done', full: responseAccumulator });
  } catch (err) {
    console.error('[/api/translate] Error:', err.message);
    sendEvent(res, { type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

// POST /api/translate-back — ヒュムノス語 → 日本語
app.post('/api/translate-back', async (req, res) => {
  const { hymmnosText } = req.body;
  if (!hymmnosText) return res.status(400).json({ error: 'hymmnosText is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const ai = getAI();
    const model = ai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        thinkingConfig: { includeThoughts: true },
      },
    });

    const prompt = `あなたはゲーム「アルトネリコ」シリーズに登場する架空言語「ヒュムノス語（Hymmnos）」の専門的な翻訳家です。
以下のヒュムノス語のテキストを、提供された【ヒュムノス語 翻訳ルール】と【ヒュムノス語 辞書】を参照しながら自然な日本語に翻訳してください。
余計な解説や会話文は一切含めず、翻訳された日本語テキストのみを返してください。

【ヒュムノス語 翻訳ルール】
${HYMMNOS_RULES}

【ヒュムノス語 辞書 (JSON)】
${JSON.stringify(HYMMNOS_DICTIONARY, null, 2)}

入力:
${hymmnosText}`;

    const result = await model.generateContentStream(prompt);
    let responseAccumulator = '';

    for await (const chunk of result.stream) {
      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.thought) {
          sendEvent(res, { type: 'thought', text: part.text ?? '' });
        } else {
          responseAccumulator += part.text ?? '';
          sendEvent(res, { type: 'response', text: part.text ?? '' });
        }
      }
    }

    sendEvent(res, { type: 'done', full: responseAccumulator });
  } catch (err) {
    console.error('[/api/translate-back] Error:', err.message);
    sendEvent(res, { type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

// SPAルーティング用フォールバック（index.htmlを返す）
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Hymmnos Server is running on http://localhost:${PORT}`);
});
