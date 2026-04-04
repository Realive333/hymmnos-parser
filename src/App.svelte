<script>
  import { onMount } from 'svelte';
  import { translateToHymmnos, translateToJapanese } from './hymmnos_api.js';

  let apiKey = '';
  let japaneseText = '';
  let hymmnosText = '';
  let isLoadingJpToHm = false;
  let isLoadingHmToJp = false;
  let errorMessage = '';
  let explanation = '';

  onMount(() => {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) apiKey = saved;
  });

  const saveApiKey = () => {
    localStorage.setItem('gemini_api_key', apiKey);
  };

  const runJpToHymmnos = async () => {
    if (!japaneseText.trim()) return;
    if (!apiKey) { errorMessage = 'Gemini APIキーを設定してください。'; return; }
    isLoadingJpToHm = true;
    errorMessage = '';
    explanation = '';
    try {
      const result = await translateToHymmnos(japaneseText, apiKey);
      if (result) {
        hymmnosText = result.hymmnos + (result.kana ? '\n' + result.kana : '');
        explanation = result.explanation || '';
      }
    } catch (err) {
      errorMessage = err.message;
    } finally {
      isLoadingJpToHm = false;
    }
  };

  const runHymmnosToJp = async () => {
    if (!hymmnosText.trim()) return;
    if (!apiKey) { errorMessage = 'Gemini APIキーを設定してください。'; return; }
    isLoadingHmToJp = true;
    errorMessage = '';
    explanation = '';
    try {
      const result = await translateToJapanese(hymmnosText, apiKey);
      if (result) {
        japaneseText = result.japanese || '';
        explanation = result.explanation || '';
      }
    } catch (err) {
      errorMessage = err.message;
    } finally {
      isLoadingHmToJp = false;
    }
  };
</script>

<div id="app">
  <div id="center">
    <h1>Hymmnos Translator</h1>

    <div style="margin-bottom: 12px;">
      <input
        type="password"
        bind:value={apiKey}
        on:change={saveApiKey}
        placeholder="Gemini API Key"
        style="padding: 6px 12px; width: 280px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text-h); font-size: 14px;"
      />
      <small style="display: block; margin-top: 4px; font-size: 12px;">※APIキーはブラウザにのみ保存されます</small>
    </div>

    <div style="width: 100%; max-width: 700px; display: flex; flex-direction: column; gap: 0;">

      <!-- 日本語エリア -->
      <div>
        <label style="display: block; font-size: 13px; margin-bottom: 4px; color: var(--text);">日本語</label>
        <textarea
          bind:value={japaneseText}
          placeholder="日本語を入力..."
          style="width: 100%; height: 140px; padding: 10px; box-sizing: border-box; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text-h); font-size: 15px; font-family: inherit; resize: vertical;"
        ></textarea>
      </div>

      <!-- ボタン行 -->
      <div style="display: flex; gap: 12px; padding: 12px 0; justify-content: center;">
        <button
          on:click={runJpToHymmnos}
          disabled={isLoadingJpToHm || isLoadingHmToJp}
          style="padding: 8px 20px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text-h); font-size: 14px; cursor: pointer;"
        >
          {isLoadingJpToHm ? '翻訳中...' : '日本語 → Hymmnos'}
        </button>
        <button
          on:click={runHymmnosToJp}
          disabled={isLoadingJpToHm || isLoadingHmToJp}
          style="padding: 8px 20px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text-h); font-size: 14px; cursor: pointer;"
        >
          {isLoadingHmToJp ? '翻訳中...' : 'Hymmnos → 日本語'}
        </button>
      </div>

      <!-- Hymmnosエリア -->
      <div>
        <label style="display: block; font-size: 13px; margin-bottom: 4px; color: var(--text);">Hymmnos</label>
        <textarea
          bind:value={hymmnosText}
          placeholder="Hymmnosを入力..."
          style="width: 100%; height: 140px; padding: 10px; box-sizing: border-box; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text-h); font-size: 15px; font-family: inherit; resize: vertical;"
        ></textarea>
      </div>

      <!-- エラー / 解説 -->
      {#if errorMessage}
        <p style="color: red; font-size: 13px; margin-top: 8px;">{errorMessage}</p>
      {/if}
      {#if explanation}
        <div style="margin-top: 16px; padding: 12px; border: 1px solid var(--border); border-radius: 4px; text-align: left;">
          <strong style="font-size: 13px; color: var(--text);">解説</strong>
          <p style="font-size: 13px; line-height: 1.6; margin-top: 6px; white-space: pre-wrap; color: var(--text-h);">{explanation}</p>
        </div>
      {/if}

    </div>
  </div>
</div>
