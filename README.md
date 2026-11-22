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
| `update_dict.js` | 外部CSVから辞書を置き換える任意の変換スクリプト |

---

## ローカル開発

### 1. 初回セットアップ

Node.js 22 以上を使用してください（Docker は Node.js 24 を使用します）。

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

既定のモデルは `gemini-3.5-flash-lite` です。比較対象の `gemini-3.8-flash` を使う場合は、サーバー起動前に `$env:GEMINI_MODEL="gemini-3.8-flash"` を設定します。設定を消すには `Remove-Item Env:GEMINI_MODEL` を実行します。モデルや思考設定により、思考ログが返されない場合もあります。

### 3. フロントエンド開発サーバーを起動（ターミナル②）

```bash
npm run dev
# → http://localhost:5173 でブラウザ確認
# /api/* へのリクエストは自動的に :8080 に転送される（vite.config.js のプロキシ設定）
```

### 4. 辞書と文法ルールの保守

現在の正本は `src/hymmnos_dictionary.js` と `src/hymmnos_rules.js` です。どちらも Git で変更を管理し、辞書の単語・意味・発音・品詞（`tags`）・流派を確認してからコミットしてください。同じ綴りでも意味や流派が異なる場合があるため、自動的に重複を削除しないでください。不明な意味は空文字のまま残せます。

文法は `hymmnos_rules.js` の該当セクションを編集し、根拠や例文を一緒に記録してください。ルールの変更後は、正方向・逆方向の代表的な例文を実際に翻訳して結果を確認してください。AIの出力は毎回同じとは限らないため、テストの合格だけで翻訳の正しさは保証できません。

辞書データの形式とCSV変換の確認は次のコマンドで実行します。

```bash
npm test
```

### モデルの翻訳結果を比較

`GEMINI_API_KEY` を設定した環境で次を実行すると、両モデルに同じ7例を送り、翻訳結果・所要時間・API が返すトークン数を JSON 行で表示します。計14リクエストが発生し、利用プランに応じて課金されます。

```bash
npm run compare-models
```

感情、強い命令、否定、主語、未知語、逆翻訳について、辞書と文法に従っているか出力を人が確認してください。この比較は品質の自動採点ではありません。プロンプトには毎回、辞書と文法全体が含まれます。

`単語辞書.csv` はこのリポジトリに含まれていません。外部CSVを使う場合だけ、プロジェクト直下に UTF-8 の `単語辞書.csv` を置いて次を実行します。先頭行は見出しで、列順は単語、意味、発音、品詞、流派、備考です。備考は出力されません。

```bash
node update_dict.js
```

この操作は辞書全体をCSVの内容で**置き換えます**。CSVに存在しない既存の単語は失われるため、実行後は必ず `git diff -- src/hymmnos_dictionary.js` で差分を確認してください。CSVを継続的な正本にする場合は、完全な元データを用意して Git に追加し、JSとのどちらを手編集するかを一つに決めてください。

既存の項目が削除・変更されるインポートは通常エラーになります。同じ綴りの複数項目もそれぞれ確認します。削除や変更が意図したものである場合は、CSVの内容を確認したうえで `node update_dict.js --allow-changes` を実行し、生成された Git 差分を再確認してください。

### 公開時の利用制限

翻訳は1インスタンスあたり両方向合わせて1分間に20回まで、入力は2,000文字までです。これは全ユーザーが共有する制限です。混雑時は時間を置いて再試行してください。Cloud Run のインスタンス増減や再起動でカウンターは共有・保持されないため、アプリ内の制限だけではサービス全体の悪用や課金を防げません。

本番環境では次も設定してください。

1. 外部 Application Load Balancer の Cloud Run 用バックエンドに [Cloud Armor のレート制限](https://docs.cloud.google.com/armor/docs/configure-rate-limiting)を設定し、公開経路をそのロードバランサーに限定します。Cloud Run の既定 URL などから Cloud Armor を迂回できないようにしてください（[Google の構成上の注意](https://docs.cloud.google.com/armor/docs/integrating-cloud-armor)）。
2. 対象プロジェクトで利用できる場合は、Gemini API の [支出上限](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)と利用量の上限を設定します。通知のみの予算では利用は停止せず、支出上限にも計測の遅延があります。
