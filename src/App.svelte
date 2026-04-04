<script>
  import { onMount } from 'svelte';
  import { translateText } from './hymmnos_api.js';

  let apiKey = '';
  let inputText = '';
  let translatedData = null;
  let isLoading = false;
  let errorMessage = '';

  // APIキーをローカルストレージに保存/復元
  onMount(() => {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) apiKey = saved;
  });

  const saveApiKey = () => {
    localStorage.setItem('gemini_api_key', apiKey);
  };

  const executeTranslation = async () => {
    if (!inputText.trim()) {
      translatedData = null;
      errorMessage = '';
      return;
    }
    if (!apiKey) {
      errorMessage = 'Gemini APIキーを設定してください。';
      return;
    }

    isLoading = true;
    errorMessage = '';
    
    try {
      translatedData = await translateText(inputText, apiKey);
    } catch (err) {
      errorMessage = err.message;
      translatedData = null;
    } finally {
      isLoading = false;
    }
  };
</script>

<main id="app">
  <div id="center">
    <h1>Hymmnos Translator</h1>
    
    <div>
      <input type="password" bind:value={apiKey} on:change={saveApiKey} placeholder="Gemini API Key を入力" style="padding: 10px; width: 300px; font-size: 16px; margin-bottom: 5px;" />
      <br/>
      <small style="color: var(--text);">※APIキーはブラウザにのみ保存されます</small>
    </div>

    <div style="display: flex; gap: 20px; width: 100%; text-align: left; justify-content: center; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 300px; border: 1px solid var(--border); padding: 20px; border-radius: 8px; background: var(--social-bg);">
        <h2>Input (日本語)</h2>
        <textarea bind:value={inputText} placeholder="例：私は世界を護るために謳う" style="width: 100%; height: 150px; padding: 10px; box-sizing: border-box; font-size: 16px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text); resize: vertical;"></textarea>
        <button on:click={executeTranslation} disabled={isLoading} style="margin-top: 15px; padding: 10px 20px; font-size: 16px; cursor: pointer; border-radius: 4px; background: var(--accent-bg); color: var(--accent); border: 1px solid var(--accent-border);">
          {isLoading ? '翻訳中...' : '翻訳する'}
        </button>
      </div>
      
      <div style="flex: 1; min-width: 300px; border: 1px solid var(--border); padding: 20px; border-radius: 8px; background: var(--social-bg);">
        <h2>Hymmnos</h2>
        <div style="min-height: 150px; padding: 10px;">
          {#if errorMessage}
            <div style="color: red;">{errorMessage}</div>
          {:else if isLoading}
            <div style="color: var(--accent);">翻訳を構築しています...</div>
          {:else if translatedData}
            <div>
              <div style="font-size: 24px; color: var(--accent); font-weight: bold; word-break: break-all;">{translatedData.hymmnos}</div>
              <div style="font-size: 16px; color: var(--text); margin-bottom: 15px;">{translatedData.kana}</div>
              <hr style="border: none; border-top: 1px solid var(--border); margin: 15px 0;" />
              <div>
                <h3 style="font-size: 16px; margin: 0 0 5px 0;">解説</h3>
                <p style="font-size: 14px; line-height: 1.5; white-space: pre-wrap; margin: 0;">{translatedData.explanation}</p>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</main>
