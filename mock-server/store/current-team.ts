/**
 * 現在のチームIDを取り出す。
 *
 * `state.teams[0]?.id ?? 1` が6箇所に重複していた。
 * seed（store/seed-empty.ts）が必ずチームを1件作るので `?? 1` は到達しないが、
 * マジックナンバーで「チームは必ず1件ある」という不変条件を隠していた。
 *
 * 不変条件が破れたときは黙って 1 を返さず、原因が分かるように落とす。
 */
import type { State } from './types.ts'

export function currentTeamId(state: State): number {
  const team = state.teams[0]
  if (team === undefined) {
    throw new Error('チームが1件もありません（seedが壊れています）')
  }
  return team.id
}
