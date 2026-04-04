<script>
  import { onMount } from 'svelte';
  import { GoogleGenerativeAI } from '@google/generative-ai';
  import { HYMMNOS_RULES } from './hymmnos_rules.js';
  import { HYMMNOS_DICTIONARY } from './hymmnos_dictionary.js';

  let apiKey = "";
  let inputText = "";
  let hymmnosText = "";
  
  let isTranslatingToHymmnos = false;
  let isTranslatingToJapanese = false;
  let errorMsg = "";

  onMount(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) apiKey = savedKey;
  });

  const saveApiKey = () => {
    localStorage.setItem('gemini_api_key', apiKey);
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
    
    try {
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `あなたはゲーム「アルトネリコ」シリーズに登場する架空言語「ヒュムノス語（Hymmnos）」の専門的な翻訳家です。
以下の日本語のテキストを、提供された【ヒュムノス語 翻訳ルール】と【ヒュムノス語 辞書】に厳密に従って標準的なヒュムノス語に翻訳してください。
余計な解説や会話文は一切含めず、翻訳されたヒュムノス語のテキストのみを返してください。

【ヒュムノス語 翻訳ルール】
${HYMMNOS_RULES}

【ヒュムノス語 辞書 (JSON)】
${JSON.stringify(HYMMNOS_DICTIONARY, null, 2)}

入力:
${inputText}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      hymmnosText = response.text().trim();
    } catch (err) {
      console.error(err);
      errorMsg = "ヒュムノス語への翻訳中にエラーが発生しました。APIキーまたはネットワークを確認してください。";
    } finally {
      isTranslatingToHymmnos = false;
    }
  };

  const translateToJapanese = async () => {
    if (!hymmnosText) return;
    const ai = getGeminiClient();
    if (!ai) return;

    isTranslatingToJapanese = true;
    errorMsg = "";
    
    try {
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `あなたはゲーム「アルトネリコ」シリーズに登場する架空言語「ヒュムノス語（Hymmnos）」の専門的な翻訳家です。
以下のヒュムノス語のテキストを、提供された【ヒュムノス語 翻訳ルール】と【ヒュムノス語 辞書】を参照しながら自然な日本語に翻訳してください。
余計な解説や会話文は一切含めず、翻訳された日本語テキストのみを返してください。

【ヒュムノス語 翻訳ルール】
${HYMMNOS_RULES}

【ヒュムノス語 辞書 (JSON)】
${JSON.stringify(HYMMNOS_DICTIONARY, null, 2)}

入力:
${hymmnosText}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      inputText = response.text().trim();
    } catch (err) {
      console.error(err);
      errorMsg = "日本語への翻訳中にエラーが発生しました。APIキーまたはネットワークを確認してください。";
    } finally {
      isTranslatingToJapanese = false;
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
      <h2>日本語 (Japanese)</h2>
      <textarea
        bind:value={inputText}
        placeholder="翻訳したいテキストを入力してください..."
      ></textarea>
    </div>

    <div class="translation-actions">
      <button class="translate-btn" on:click={translateToHymmnos} disabled={isTranslatingToHymmnos || !inputText}>
        {#if isTranslatingToHymmnos}
          翻訳中...
        {:else}
          ↓ ヒュムノス語へ翻訳
        {/if}
      </button>
      
      <button class="translate-btn reverse-btn" on:click={translateToJapanese} disabled={isTranslatingToJapanese || !hymmnosText}>
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
</main>
