/**
 * サイドバー3画面（拡張機能 / タスク / AI）のルート解決（純粋関数）。
 *
 * どれも固定パスで、`shell.ts` の NAV_TARGETS が既に各ラベル→ハッシュを配線している
 * （AI→#/sb_ai、タスク→#/tasks、拡張機能→#/addon/option-list）。ここはそれと同じ値を
 * 一箇所に置き、`main.ts` から参照させて表記ゆれを防ぐ。
 */

// 指示124: 拡張機能は撤去 — ADDON_ROUTE 削除
/** タスク（空状態） */
export const TASKS_ROUTE = '/tasks'
/** AI（チャットUI） */
export const SB_AI_ROUTE = '/sb_ai'
/** 外部連携 → 広告媒体連携（shell.ts の 外部連携→#/teams/ad_accounts と一致） */
export const EXTERNAL_ROUTE = '/teams/ad_accounts'
/** サイドバーのデータ画面（指示⑮・モックで自作）。shell.ts の NAV_TARGETS と一致させる */
export const DASHBOARD_ROUTE = '/dashboard'
export const CONVERSIONS_ROUTE = '/conversions'
export const DOMAINS_ROUTE = '/teams/domains'
export const REPORT_EXCLUSIONS_ROUTE = '/report-exclusions'
export const RANKINGS_ROUTE = '/rankings'
export const SEMINAR_ROUTE = '/seminar'
/** アカウント設定（FAQ: 設定・管理） */
export const ACCOUNT_SETTINGS_ROUTE = '/settings/account'

export const SIDEBAR_PAGE_ROUTES = [
  // 指示124: ADDON_ROUTE 削除
  TASKS_ROUTE,
  SB_AI_ROUTE,
  EXTERNAL_ROUTE,
  DASHBOARD_ROUTE,
  CONVERSIONS_ROUTE,
  DOMAINS_ROUTE,
  REPORT_EXCLUSIONS_ROUTE,
  RANKINGS_ROUTE,
  SEMINAR_ROUTE,
  ACCOUNT_SETTINGS_ROUTE,
] as const

export type SidebarPage =
  // 指示124: 'addon' 削除
  | 'tasks'
  | 'sb_ai'
  | 'external'
  | 'dashboard'
  | 'conversions'
  | 'domains'
  | 'report_exclusions'
  | 'rankings'
  | 'seminar'
  | 'account_settings'

/** パスを対応するページ種別へ解決する。未知のパスは null（推測で埋めない）。 */
export function matchSidebarPage(path: string): SidebarPage | null {
  switch (path) {
    // 指示124: ADDON_ROUTE case 削除
    case TASKS_ROUTE:
      return 'tasks'
    case SB_AI_ROUTE:
      return 'sb_ai'
    case EXTERNAL_ROUTE:
      return 'external'
    case DASHBOARD_ROUTE:
      return 'dashboard'
    case CONVERSIONS_ROUTE:
      return 'conversions'
    case DOMAINS_ROUTE:
      return 'domains'
    case REPORT_EXCLUSIONS_ROUTE:
      return 'report_exclusions'
    case RANKINGS_ROUTE:
      return 'rankings'
    case SEMINAR_ROUTE:
      return 'seminar'
    case ACCOUNT_SETTINGS_ROUTE:
      return 'account_settings'
    default:
      return null
  }
}
