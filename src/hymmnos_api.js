import { GoogleGenerativeAI } from "@google/generative-ai";
import { HYMMNOS_RULES } from "./hymmnos_rules.js";
import { HYMMNOS_DICTIONARY } from "./hymmnos_dictionary.js";

const SYSTEM_PROMPT = `
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

【ヒュムノス語言語ルール】
${HYMMNOS_RULES}

【ヒュムノス語辞書データ】
${JSON.stringify(HYMMNOS_DICTIONARY)}
`;

export async function translateText(text, apiKey) {
  if (!apiKey) throw new Error("APIキーが設定されていません。");
  if (!text.trim()) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // 大量コンテキストに強く高速な 1.5 Flash を使用
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: {
            temperature: 0.1, // 翻訳品質を安定させるため低く設定
            responseMimeType: "application/json",
        }
    });

    const prompt = `${SYSTEM_PROMPT}\n\nユーザーの入力（これを翻訳してください）:\n${text}`;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Translation API Error:", error);
    throw new Error("翻訳に失敗しました: " + error.message);
  }
}
