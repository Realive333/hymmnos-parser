<script>
  import { onMount, tick } from "svelte";
  import { GoogleGenerativeAI } from "@google/generative-ai";
  import { HYMMNOS_RULES } from "./hymmnos_rules.js";
  import { HYMMNOS_DICTIONARY } from "./hymmnos_dictionary.js";

  let apiKey = "";
  let inputText = "";
  let hymmnosText = "";
  let wordAnalysis = []; // { word, meaning, isCoinage }

  // 思考ログ用
  let thinkingLog = "";
  let isThinking = false;
  let consoleEl; // スクロール制御用

  // 辞書から流派を逆引きするヘルパー
  const lookupDialect = (word) => {
    const entry = HYMMNOS_DICTIONARY.find(
      (d) => d.word.toLowerCase() === word.toLowerCase(),
    );
    return entry?.dialect || "";
  };

  // コンソールを末尾にスクロール
  const scrollConsole = async () => {
    await tick();
    if (consoleEl) consoleEl.scrollTop = consoleEl.scrollHeight;
  };

  let isTranslatingToHymmnos = false;
  let isTranslatingToJapanese = false;
  let errorMsg = "";

  onMount(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) apiKey = savedKey;
  });

  const saveApiKey = () => {
    localStorage.setItem("gemini_api_key", apiKey);
  };

  const getGeminiClient = () => {
    if (!apiKey) {
      errorMsg = "APIキーを入力してください。 (AI Studioから取得)";
      return null;
    }
    errorMsg = "";
    return new GoogleGenerativeAI(apiKey);
  };

  const translateToHymmnos = async () => {
    if (!inputText) return;
    const ai = getGeminiClient();
    if (!ai) return;

    isTranslatingToHymmnos = true;
    errorMsg = "";
    wordAnalysis = [];
    thinkingLog = "";
    isThinking = false;

    try {
      // thinkingConfig で思考内容をストリームに含める
      const model = ai.getGenerativeModel({
        model: "gemini-2.5-flash",
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

      // ストリーミングで取得
      const result = await model.generateContentStream(prompt);
      let responseAccumulator = "";

      for await (const chunk of result.stream) {
        const parts = chunk.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (part.thought) {
            // 思考パーツ → コンソールへ
            isThinking = true;
            thinkingLog += part.text ?? "";
            scrollConsole();
          } else {
            // 応答パーツ → 最終JSON用に蓄積
            isThinking = false;
            responseAccumulator += part.text ?? "";
          }
        }
      }

      // JSON をパース（コードブロック除去）
      const stripped = responseAccumulator
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
      try {
        const parsed = JSON.parse(stripped);
        hymmnosText = parsed.hymmnos ?? responseAccumulator;
        wordAnalysis = Array.isArray(parsed.words) ? parsed.words : [];
      } catch {
        hymmnosText = responseAccumulator;
        wordAnalysis = [];
      }
    } catch (err) {
      console.error(err);
      errorMsg =
        "ヒュムノス語への翻訳中にエラーが発生しました。APIキーまたはネットワークを確認してください。";
    } finally {
      isTranslatingToHymmnos = false;
      isThinking = false;
    }
  };

  const translateToJapanese = async () => {
    if (!hymmnosText) return;
    const ai = getGeminiClient();
    if (!ai) return;

    isTranslatingToJapanese = true;
    errorMsg = "";
    thinkingLog = "";
    isThinking = false;

    try {
      const model = ai.getGenerativeModel({
        model: "gemini-2.5-flash",
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
      let responseAccumulator = "";

      for await (const chunk of result.stream) {
        const parts = chunk.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (part.thought) {
            isThinking = true;
            thinkingLog += part.text ?? "";
            scrollConsole();
          } else {
            isThinking = false;
            responseAccumulator += part.text ?? "";
          }
        }
      }

      inputText = responseAccumulator.trim();
    } catch (err) {
      console.error(err);
      errorMsg =
        "日本語への翻訳中にエラーが発生しました。APIキーまたはネットワークを確認してください。";
    } finally {
      isTranslatingToJapanese = false;
      isThinking = false;
    }
  };
</script>

<main class="container">
  <h1>ヒュムノスサーバー v.0.1.α</h1>

  <div class="settings-panel">
    <label for="apikey">Gemini API Key:</label>
    <input
      id="apikey"
      type="password"
      bind:value={apiKey}
      on:input={saveApiKey}
      placeholder="AI Studioから取得したAPIキーを入力"
    />
  </div>

  {#if errorMsg}
    <div class="error-banner">{errorMsg}</div>
  {/if}

  <div class="translator-panels">
    <div class="panel input-panel">
      <h2>和文</h2>
      <textarea
        bind:value={inputText}
        placeholder="翻訳したいテキストを入力してください..."
      ></textarea>
    </div>

    <div class="translation-actions">
      <button
        class="translate-btn"
        on:click={translateToHymmnos}
        disabled={isTranslatingToHymmnos || !inputText}
      >
        {#if isTranslatingToHymmnos}
          翻訳中...
        {:else}
          ↓ ヒュムノス語へ翻訳
        {/if}
      </button>

      <button
        class="translate-btn reverse-btn"
        on:click={translateToJapanese}
        disabled={isTranslatingToJapanese || !hymmnosText}
      >
        {#if isTranslatingToJapanese}
          翻訳中...
        {:else}
          ↑ 日本語へ翻訳
        {/if}
      </button>
    </div>

    <div class="panel output-panel">
      <h2>ヒュムノス語 (Hymmnos)</h2>
      <textarea
        bind:value={hymmnosText}
        placeholder="ヒュムノス語を入力してください..."
      ></textarea>
    </div>
  </div>

  {#if wordAnalysis.length > 0}
    <div class="word-analysis">
      <h2 class="analysis-title">使用単語の解説</h2>
      <div class="word-list">
        {#each wordAnalysis as w}
          {@const dialect = w.isCoinage ? "" : lookupDialect(w.word)}
          <div
            class="word-card {w.isCoinage ? 'coinage' : 'existing'}"
            title={w.isCoinage
              ? "造語（辞書にない自作単語）"
              : "既存（辞書に登録済みの単語）"}
          >
            <span class="word-badge">{w.isCoinage ? "造語" : "既存"}</span>
            <span class="word-term">{w.word}</span>
            <span class="word-meaning">{w.meaning}</span>
            {#if dialect}
              <span class="word-dialect">{dialect}</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- 思考コンソール（常時表示） -->
  <div class="console-panel">
    <div class="console-header">
      <span class="console-title">
        Hymmnos Server ver.0.1.α Logger
        {#if isThinking}
          <span class="thinking-dot"></span>
        {/if}
      </span>
      <button
        class="console-clear"
        on:click={() => (thinkingLog = "")}
        disabled={!thinkingLog}>✕ クリア</button
      >
    </div>
    <div class="console-body" bind:this={consoleEl}>
      {#if thinkingLog}
        <pre>{thinkingLog}</pre>
      {:else}
        <span class="console-placeholder">Waiting for input...</span>
      {/if}
    </div>
  </div>
</main>
