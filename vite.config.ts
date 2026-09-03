import { defineConfig } from 'vite'

// 企画書 §10-1: フロントのAPIベースURLは localhost 固定。本番ドメインは登場させない。
const MOCK_PORT = process.env.MOCK_PORT ?? '4010'

export default defineConfig({
  root: 'src',
  publicDir: '../capture',
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${MOCK_PORT}`,
      '/workers': `http://localhost:${MOCK_PORT}`,
      '/report': `http://localhost:${MOCK_PORT}`,
      // 配信ページ（実パス配信URL・SSR）はモックサーバー側が応答を作る
      '/lp': `http://localhost:${MOCK_PORT}`,
      '/cable': { target: `ws://localhost:${MOCK_PORT}`, ws: true },
    },
  },
  build: { outDir: '../dist', emptyOutDir: true },
})
