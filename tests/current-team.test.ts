import { describe, it, expect } from 'vitest'
import { currentTeamId } from '../mock-server/store/current-team.ts'
import type { State } from '../mock-server/store/types.ts'

/**
 * `state.teams[0]?.id ?? 1` が6箇所に散っていた。
 * seed が必ずチームを1件作るので `?? 1` は到達しないのに、
 * マジックナンバーで不変条件を隠したまま重複していた（DRY違反）。
 */
describe('現在のチームIDの取り出し', () => {
  it('チームがあればそのIDを返す', () => {
    const state = { teams: [{ id: 42 }] } as unknown as State
    expect(currentTeamId(state)).toBe(42)
  })

  it('チームが無ければ、黙って既定値を返さずエラーにする', () => {
    const state = { teams: [] } as unknown as State
    expect(() => currentTeamId(state)).toThrow(/チーム/)
  })
})
