/**
 * サイドバー3画面（拡張機能 / タスク / AI）のルート解決（純粋関数）。
 *
 * どれも固定パスで、`shell.ts` の NAV_TARGETS が既に各ラベル→ハッシュを配線している
 * （AI→#/sb_ai、タスク→#/tasks、拡張機能→#/addon/option-list）。ここはそれと同じ値を
 * 一箇所に置き、`main.ts` から参照させて表記ゆれを防ぐ。
 */

/** 拡張機能（アドオンのカタログ） */
export const ADDON_ROUTE = '/addon/option-list'
/** タスク（空状態） */
export const TASKS_ROUTE = '/tasks'
/** AI（チャットUI） */
export const SB_AI_ROUTE = '/sb_ai'

export const SIDEBAR_PAGE_ROUTES = [ADDON_ROUTE, TASKS_ROUTE, SB_AI_ROUTE] as const

export type SidebarPage = 'addon' | 'tasks' | 'sb_ai'

/** パスを対応するページ種別へ解決する。未知のパスは null（推測で埋めない）。 */
export function matchSidebarPage(path: string): SidebarPage | null {
  switch (path) {
    case ADDON_ROUTE:
      return 'addon'
    case TASKS_ROUTE:
      return 'tasks'
    case SB_AI_ROUTE:
      return 'sb_ai'
    default:
      return null
  }
}
