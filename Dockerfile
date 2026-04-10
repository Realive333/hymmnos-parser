FROM node:20-slim
WORKDIR /app

# 依存関係をインストール（devDependencies除外）
COPY package*.json ./
RUN npm ci --omit=dev

# Viteでビルドされた静的ファイル
COPY dist/ ./dist/

# サーバー本体とヒュムノス語データ
COPY server.js ./
COPY src/hymmnos_rules.js src/hymmnos_dictionary.js ./src/

# Cloud Runが使用するポート
EXPOSE 8080
ENV PORT=8080

CMD ["node", "server.js"]
