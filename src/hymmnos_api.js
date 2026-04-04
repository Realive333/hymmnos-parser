import { GoogleGenerativeAI } from "@google/generative-ai";
import { HYMMNOS_RULES } from "./hymmnos_rules.js";
import { HYMMNOS_DICTIONARY } from "./hymmnos_dictionary.js";

const BASE_CONTEXT = `
【ヒュムノス語言語ルール】
${HYMMNOS_RULES}

【ヒュムノス語辞書データ（全収録）】
${JSON.stringify(HYMMNOS_DICTIONARY)}
`;

const JP_TO_HYMMNOS_PROMPT = `
あなたは「ヒュムノス語（Hymmnos）」の完全に正確な翻訳・造語・辞書検索システムです。
以下の【ヒュムノス語言語ルール】と【ヒュムノス語辞書データ（全収録）】をすべて厳密に読み込み、ユーザーが入力した日本語テキストをヒュムノス語に翻訳してください。

【制約・ルール】
1. 必ず「想音（3単語）」から始めること（ルール参照）。文脈からユーザーの感情にもっとも当てはまるものを選んでください。
2. 辞書に含まれる単語を最大限組み合わせてください。
3. 文法（SVO構文、関係代名詞、受動態re、否定na、命令presiaなど）を忠実に守ってください。
4. もし辞書内に完全に一致する単語がない場合は、既存のヒュムノス語の語感（発音や綴りの法則性）を解析し、もっともらしい「新しいヒュムノス語（造語）」を自ら創作して当てはめ、翻訳を成立させてください。
5. 返答は以下のJSONフォーマットのみ（純粋なJSONテキスト）で返してください。

{
  "hymmnos": "[翻訳されたヒュムノス語全文（英字）]",
  "kana": "[ヒュムノス語の想定される発音（カタカナ）]",
  "explanation": "[なぜその想音を選んだか、どの単語と文法をどう組み合わせたかの詳細な解説。造語を使用した場合、その理由と意味設定も説明すること]"
}

${BASE_CONTEXT}
`;

const HYMMNOS_TO_JP_PROMPT = `
あなたは「ヒュムノス語（Hymmnos）」の完全に正確な解析・翻訳システムです。
以下の【ヒュムノス語言語ルール】と【ヒュムノス語辞書データ（全収録）】をすべて厳密に読み込み、ユーザーが入力したヒュムノス語テキストを日本語に翻訳・解析してください。

【制約・ルール】
1. 辞書から一致する単語を逆引きし、各単語の意味を正確に特定してください。
2. 文法ルールに従って文構造（想音、主語、動詞、目的語など）を解析してください。
3. 自然な日本語に翻訳してください。
4. 辞書に存在しない単語は、語感と文脈から最もらしい意味を推測して説明してください。
5. 返答は以下のJSONフォーマットのみ（純粋なJSONテキスト）で返してください。

{
  "japanese": "[翻訳された日本語全文]",
  "explanation": "[想音の解釈、各単語の意味、文法構造の解析。不明単語がある場合はその推定と理由も含めること]"
}

${BASE_CONTEXT}
`;

function getModel(apiKey, responseMimeType = "application/json") {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.1,
      responseMimeType,
    },
  });
}

export async function translateToHymmnos(text, apiKey) {
  if (!apiKey) throw new Error("APIキーが設定されていません。");
  if (!text.trim()) return null;

  try {
    const model = getModel(apiKey);
    const prompt = `${JP_TO_HYMMNOS_PROMPT}\n\nユーザーの入力（日本語→ヒュムノス語に翻訳してください）:\n${text}`;
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (error) {
    console.error("Translation API Error:", error);
    throw new Error("翻訳に失敗しました: " + error.message);
  }
}

export async function translateToJapanese(text, apiKey) {
  if (!apiKey) throw new Error("APIキーが設定されていません。");
  if (!text.trim()) return null;

  try {
    const model = getModel(apiKey);
    const prompt = `${HYMMNOS_TO_JP_PROMPT}\n\nユーザーの入力（ヒュムノス語→日本語に翻訳してください）:\n${text}`;
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (error) {
    console.error("Translation API Error:", error);
    throw new Error("翻訳に失敗しました: " + error.message);
  }
}
