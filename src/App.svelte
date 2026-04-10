<script>
  import { tick } from "svelte";
  import { HYMMNOS_DICTIONARY } from "./hymmnos_dictionary.js";

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

  // SSEストリームを読み取る汎用ヘルパー
  const readSSEStream = async (response, { onThought, onDone, onError }) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "thought") {
            isThinking = true;
            thinkingLog += data.text;
            scrollConsole();
          } else if (data.type === "response") {
            isThinking = false;
          } else if (data.type === "done") {
            onDone?.(data.full);
          } else if (data.type === "error") {
            onError?.(data.message);
          }
        } catch {
          // JSON解析エラーは無視
        }
      }
    }
  };

  const translateToHymmnos = async () => {
    if (!inputText) return;

    isTranslatingToHymmnos = true;
    errorMsg = "";
    wordAnalysis = [];
    thinkingLog = "";
    isThinking = false;

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      await readSSEStream(response, {
        onDone: (full) => {
          // JSON をパース（コードブロック除去）
          const stripped = full
            .trim()
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/, "")
            .trim();
          try {
            const parsed = JSON.parse(stripped);
            hymmnosText = parsed.hymmnos ?? full;
            wordAnalysis = Array.isArray(parsed.words) ? parsed.words : [];
          } catch {
            hymmnosText = full;
            wordAnalysis = [];
          }
        },
        onError: (msg) => {
          errorMsg = `ヒュムノス語への翻訳中にエラーが発生しました: ${msg}`;
        },
      });
    } catch (err) {
      console.error(err);
      errorMsg =
        "ヒュムノス語への翻訳中にエラーが発生しました。ネットワークを確認してください。";
    } finally {
      isTranslatingToHymmnos = false;
      isThinking = false;
    }
  };

  const translateToJapanese = async () => {
    if (!hymmnosText) return;

    isTranslatingToJapanese = true;
    errorMsg = "";
    thinkingLog = "";
    isThinking = false;

    try {
      const response = await fetch("/api/translate-back", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hymmnosText }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      await readSSEStream(response, {
        onDone: (full) => {
          inputText = full.trim();
        },
        onError: (msg) => {
          errorMsg = `日本語への翻訳中にエラーが発生しました: ${msg}`;
        },
      });
    } catch (err) {
      console.error(err);
      errorMsg =
        "日本語への翻訳中にエラーが発生しました。ネットワークを確認してください。";
    } finally {
      isTranslatingToJapanese = false;
      isThinking = false;
    }
  };
</script>

<main class="container">
  <h1>Hymmnos Parser v.0.1β</h1>

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
          ↓ ヒュムノスへ翻訳
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
      <h2>ヒュムノス</h2>
      <textarea
        bind:value={hymmnosText}
        placeholder="ヒュムノスを入力してください..."
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
        Hymmnos Parser ver.0.1β Logger
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
