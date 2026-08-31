/**
 * エンドポイント網羅カタログ（企画書 §10-3 を機械検査可能にしたもの）。
 * §13-B「全ルートがモックで200（または意図した4xx/5xx）を返す」の実体。
 *
 * パラメータは固定ダミーuid（§13-B）で解決する。作成系は verify 実行時に
 * 実際に作ってから叩くため、ここには「作成後に存在するuid」を書く。
 */

export interface EndpointCheck {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** `{abTest}` `{article}` `{version}` `{folder}` `{plan}` `{member}` `{team}` は実行時に置換される */
  path: string
  /** 期待ステータス。未指定は 200 */
  expect?: number
  body?: Record<string, unknown>
  /** 破壊的操作は最後に回す */
  destructive?: boolean
}

export const ENDPOINT_CATALOG: readonly EndpointCheck[] = [
  // ダッシュボード
  { method: 'GET', path: '/teams/dashboard?start_date=2026-08-01&end_date=2026-08-31' },
  { method: 'GET', path: '/ab_tests/rankings?sort=sales&sort_direction=desc&per_page=20' },
  { method: 'GET', path: '/teams/version-rankings?sort_by=sales&sort_order=desc&per_page=20' },

  // フォルダ
  { method: 'GET', path: '/folders?per_page=20' },
  { method: 'GET', path: '/folders/{folder}' },
  { method: 'PUT', path: '/folders/{folder}', body: { name: 'サンプルフォルダ改' } },
  { method: 'GET', path: '/folders/{folder}/forms' },
  { method: 'GET', path: '/folders/{folder}/conversion_tags' },
  { method: 'GET', path: '/folders/{folder}/operator_articles' },

  // beyondページ / エディタ
  { method: 'GET', path: '/ab_tests?per_page=20' },
  { method: 'GET', path: '/ab_tests/{abTest}' },
  { method: 'GET', path: '/ab_tests/{abTest}/articles' },
  { method: 'GET', path: '/articles/{article}/versions' },
  { method: 'GET', path: '/articles/{article}/previews' },
  { method: 'PUT', path: '/versions/{version}', body: { html: '<div>編集</div>' } },
  { method: 'PATCH', path: '/versions/{version}/distribution', body: { distribution_ratio: 50 } },
  { method: 'POST', path: '/articles/{article}/versions', expect: 201 },
  { method: 'POST', path: '/versions/{version}/publish' },
  { method: 'GET', path: '/teams/media_assets' },

  // 離脱ポップアップ / リダイレクト / スプリット / 振り分け
  { method: 'GET', path: '/ab_tests/{abTest}/exit_popups' },
  { method: 'POST', path: '/ab_tests/{abTest}/exit_popups', expect: 201, body: { name: 'サンプルポップアップ' } },
  { method: 'GET', path: '/ab_tests/{abTest}/redirect_pages' },
  { method: 'PUT', path: '/ab_tests/{abTest}/redirect_pages', body: {} },
  { method: 'GET', path: '/ab_tests/{abTest}/split_test_settings/devices' },
  { method: 'GET', path: '/ab_tests/{abTest}/split_test_settings/oses' },
  { method: 'GET', path: '/ab_tests/{abTest}/split_test_settings/carriers' },
  { method: 'GET', path: '/ab_tests/{abTest}/split_test_settings/hours' },
  { method: 'GET', path: '/ab_tests/{abTest}/split_test_settings/periods' },
  { method: 'GET', path: '/ab_tests/{abTest}/split_test_settings/params' },
  { method: 'PUT', path: '/ab_tests/{abTest}/split_test_settings/devices', body: { rules: [] } },
  { method: 'GET', path: '/ab_tests/{abTest}/options/devide' },
  { method: 'PUT', path: '/ab_tests/{abTest}/options/devide', body: { mode: 'ratio' } },

  // レポート / ヒートマップ
  { method: 'GET', path: '/ab_tests/{abTest}/reports' },
  { method: 'GET', path: '/ab_tests/{abTest}/reports/lp' },
  { method: 'GET', path: '/ab_tests/{abTest}/reports/swipe' },
  { method: 'GET', path: '/ab_tests/{abTest}/creative_report' },
  { method: 'GET', path: '/ab_tests/{abTest}/heatmaps/comparisons' },

  // CV / タスク / 審査
  { method: 'GET', path: '/conversions?per_page=20' },
  { method: 'GET', path: '/conversion-reports' },
  { method: 'GET', path: '/tasks' },
  { method: 'POST', path: '/tasks', expect: 201, body: { title: 'サンプルタスク001' } },
  { method: 'GET', path: '/inspections' },
  { method: 'GET', path: '/inspections/authorities' },
  { method: 'GET', path: '/inspections/folders' },

  // AI
  { method: 'GET', path: '/sb_ai/conversations' },
  { method: 'POST', path: '/sb_ai/conversations', expect: 201, body: { title: 'サンプル会話' } },

  // チーム / 連携
  { method: 'GET', path: '/teams/ad_accounts' },
  { method: 'GET', path: '/teams/asp_accounts' },
  { method: 'GET', path: '/teams/domains' },
  { method: 'POST', path: '/teams/domains', expect: 201, body: { host: 'sample01.example.test' } },
  { method: 'GET', path: '/teams/tags' },
  { method: 'GET', path: '/teams/product_search_forms' },
  { method: 'GET', path: '/teams/plans' },
  { method: 'GET', path: '/teams/{team}/members/{member}/invitation' },

  // 広告OAuthコールバック
  { method: 'GET', path: '/redirections/ad_accounts/facebook/status' },
  { method: 'GET', path: '/redirections/ad_accounts/google/status' },
  { method: 'GET', path: '/redirections/ad_accounts/microsoft/status' },
  { method: 'GET', path: '/redirections/ad_accounts/x/status' },
  { method: 'GET', path: '/redirections/ad_accounts/yahoo/status' },
  { method: 'GET', path: '/redirections/ab_tests/google_postback_setting' },

  // 設定 / 通知 / 除外
  { method: 'GET', path: '/settings/internal_notifications/member' },
  { method: 'GET', path: '/settings/internal_notifications/team' },
  { method: 'PUT', path: '/settings/internal_notifications/member', body: { cv_notify: false } },
  { method: 'GET', path: '/report-exclusions' },
  { method: 'POST', path: '/report-exclusions', expect: 201, body: { target: 'sample01.example.test' } },

  // 課金 / アドオン
  { method: 'GET', path: '/plans/{plan}' },
  { method: 'POST', path: '/plans/{plan}/checkout' },
  { method: 'GET', path: '/addon/option-list' },

  // ユーザー / 認証（モック認証・§10-4）
  { method: 'GET', path: '/users/me' },
  { method: 'GET', path: '/users/public_api_key' },
  { method: 'POST', path: '/users/public_api_key' },
  { method: 'GET', path: '/users/teams' },
  { method: 'POST', path: '/users/sign_up', body: { email: 'user001@example.test', password: 'password123' } },
  { method: 'POST', path: '/users/sign_up', expect: 422, body: { email: 'not-an-email', password: 'password123' } },
  { method: 'POST', path: '/users/forgot_password', body: { email: 'user001@example.test' } },

  // 管理者
  { method: 'GET', path: '/admin/report' },
  { method: 'GET', path: '/admin/articles/html_parts' },
  { method: 'GET', path: '/admin/plans' },
  { method: 'GET', path: '/admin/preset_access_denials' },
  { method: 'GET', path: '/admin/product_search_forms' },
  { method: 'GET', path: '/admin/teams' },
  { method: 'GET', path: '/admin/teams/{team}/members' },
  { method: 'GET', path: '/admin/teams/{team}/plans/payments' },

  // 周辺
  { method: 'GET', path: '/permissions' },
  { method: 'GET', path: '/introductions' },
  { method: 'GET', path: '/seminar' },
  { method: 'GET', path: '/terms' },
  { method: 'GET', path: '/articles/bulk_replaces' },

  // 破壊操作は最後
  { method: 'DELETE', path: '/ab_tests/{abTest}', expect: 204, destructive: true },
  { method: 'DELETE', path: '/folders/{folder}', expect: 204, destructive: true },
]

/** 外部ランキングのローカルミラー（[R]系統） */
export const REPORT_CATALOG: readonly EndpointCheck[] = [
  { method: 'GET', path: '/rankings?per_page=20' },
]
