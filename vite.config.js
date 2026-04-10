import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  server: {
    // ローカル開発: /api へのリクエストを Node.js サーバーに転送
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
})
