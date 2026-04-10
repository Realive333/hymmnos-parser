# Hymmnos Translator

ヒュムノス語（Hymmnos）の翻訳を行うWebアプリケーションです。  
Google Gemini API を使用し、日本語 ↔ ヒュムノス語のリアルタイム翻訳とAIの思考ログ表示に対応しています。

## 🌐 公開URL

**https://hymmnos-parser.app**

## アーキテクチャ

```
[ブラウザ] → [Node.js / Express サーバー] → [Gemini API]
                ↑
     APIキーはサーバー側の環境変数としてのみ保持
     （ブラウザには一切露出しない）
```

- **フロントエンド**: Svelte + Vite（静的ビルド）
- **バックエンド**: Node.js / Express（`server.js`）
- **ホスティング**: Google Cloud Run（東京リージョン: `asia-northeast1`）
- **APIキー管理**: Google Cloud Secret Manager

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `src/App.svelte` | メインUI（翻訳画面） |
| `src/style.css` | スタイルシート |
| `src/hymmnos_rules.js` | ヒュムノス語の文法ルール（プロンプト用） |
| `src/hymmnos_dictionary.js` | ヒュムノス語辞書データ |
| `server.js` | Express バックエンドサーバー（Gemini API プロキシ） |
| `Dockerfile` | Cloud Run デプロイ用 |
| `単語辞書.csv` | 辞書の元データ（CSVで編集） |
| `update_dict.js` | CSV → JSへの辞書変換スクリプト |

---

## ローカル開発

### 1. 初回セットアップ

```bash
npm install
```

### 2. バックエンドサーバーを起動（ターミナル①）

```bash
# GEMINI_API_KEY に自分のAPIキーをセットして起動
$env:GEMINI_API_KEY="YOUR_API_KEY"  # PowerShell
node server.js
# → http://localhost:8080 で起動
```

### 3. フロントエンド開発サーバーを起動（ターミナル②）

```bash
npm run dev
# → http://localhost:5173 でブラウザ確認
# /api/* へのリクエストは自動的に :8080 に転送される（vite.config.js のプロキシ設定）
```

### 4. 辞書の更新 （単語辞書.csv を編集後）

```bash
node update_dict.js
```