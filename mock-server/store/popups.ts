/**
 * ポップアップ（離脱防止・表示直後・追従型）の保存と配信（2026-10-31 本人「わざわざ 下書き反映 本番反映 これ操作するのだるいから、
 * オンオフのボタンはあるし、追加したら反映でいいよ」）。
 *
 *   - 作った・保存した中身が、そのまま配信に出る（配信ONのとき）。出したくないときは配信OFF。
 *   - 2026-09-24〜10-31 は「下書き」と「本番（live）」に分けていた。読み込むときに settlePopupDrafts で前のデータを片づける。
 */
import type { ExitPopup, FollowPopup, State } from './types.ts'

/** 下書きと本番に分けていた頃のデータ（本番の中身の控え。null＝一度も本番反映していない） */
type WithLegacyLive<T> = T & { live?: unknown }

/** 複製の名前（元の名前＋「のコピー」） */
export function copyName(name: string): string {
  return `${name}のコピー`
}

/**
 * 前のデータの片づけ（読み込むとき・何度呼んでも同じ）:
 *   - 一度も本番反映していなかった物（live が null）は、いま配信に出ていない。いきなり出ないよう配信OFFにする
 *   - 本番の中身の控え（live）は外す（保存した中身がそのまま配信）
 * 本番反映してあった物は、下書きと本番が同じか、下書きが新しい（その場合は保存した中身＝下書きが出る）
 */
export function settlePopupDrafts(state: State): { state: State; changed: number; turnedOff: string[] } {
  const turnedOff: string[] = []
  let changed = 0
  const settle = <T extends ExitPopup | FollowPopup>(popup: WithLegacyLive<T>): T => {
    if (!('live' in popup)) return popup
    changed += 1
    const { live, ...rest } = popup
    if (live !== null || !rest.enabled) return rest as unknown as T
    turnedOff.push(rest.uid)
    return { ...rest, enabled: false } as unknown as T
  }
  const exitPopups = state.exitPopups.map((p) => settle<ExitPopup>(p))
  const followPopups = state.followPopups.map((p) => settle<FollowPopup>(p))
  if (changed === 0) return { state, changed, turnedOff }
  return { state: { ...state, exitPopups, followPopups }, changed, turnedOff }
}
