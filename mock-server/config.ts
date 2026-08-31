/**
 * モックサーバー設定（企画書 §10-1）。
 * APIベースURLは localhost 固定。本番ドメインはコード中に一切登場させない（§3-2・§13-F）。
 */

// Railway 等は待ち受けポートを PORT で渡す。ローカルは MOCK_PORT（既定4010）。
export const MOCK_PORT = Number(process.env['PORT'] ?? process.env['MOCK_PORT'] ?? 4010)

/** 本番配信モード: ビルド済みフロントの置き場（未設定なら開発モード＝Viteが配信）。 */
export const SERVE_DIST = process.env['SERVE_DIST']

/** 3系統 + WS を localhost の同一モックにパスプレフィックスで集約（§10-1） */
export const PREFIX = {
  api: '/api/v1',
  /** 実APIは v1 と v2 が混在する（フォルダ配下の ab_tests は v2・2026-08-31 実測） */
  apiV2: '/api/v2',
  workers: '/workers/api/v1',
  report: '/report',
  cable: '/cable',
} as const

/** ActionCable の CV速報 push 間隔（§10-7 3-8秒ランダム） */
export const CV_PUSH_MIN_MS = 3000
export const CV_PUSH_MAX_MS = 8000

/** ActionCable ping 間隔（§10-7 定期ping） */
export const CABLE_PING_MS = 3000
