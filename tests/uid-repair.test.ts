/**
 * 保存データに既にある「同じ uid が2件以上」を、起動時に直すことの機械証明（2026-09-11・本人承認）。
 *
 * uid を件数＋1で作っていた頃の不具合で、本番では別々のLPの Version が2件とも VERSION_0005 になっていた。
 * uid での検索は先頭一致なので、片方を編集するともう片方が書き換わる恐れがある。
 * 直し方: id が一番小さい（一番古い）1件はそのまま残し、ほかの物に新しい uid を付け直す。
 * 付け直した Version はプレビューURLが変わるだけ（配信URLはbeyondページの uid なので変わらない）。
 */
import { describe, expect, it } from 'vitest'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import { addRedirectPage, createAbTest, createFolder } from '../mock-server/store/actions.ts'
import { repairDuplicateUids } from '../mock-server/store/uid-repair.ts'
import type { State } from '../mock-server/store/types.ts'

/** beyondページを1つ作り、Version を rows のとおりに差し替えた状態（nextId は本番と同じ 131） */
function stateWithVersions(rows: readonly { id: number; uid: string }[]): State {
  const made = createAbTest(createEmptyState(), { title: 'A', memo: '', media_id: 1, folder_id: null })
  return { ...made.state, versions: rows.map((r) => ({ ...made.version, id: r.id, uid: r.uid })), nextId: 131 }
}

describe('同じ uid を直す', () => {
  it('本番で起きた形: 一番古い1件はそのまま、新しい方に新しい uid を付け直す', () => {
    const before = stateWithVersions([
      { id: 103, uid: 'VERSION_0001' },
      { id: 117, uid: 'VERSION_0005' },
      { id: 125, uid: 'VERSION_0005' },
    ])
    const { state, changes } = repairDuplicateUids(before)
    expect(state.versions.map((v) => [v.id, v.uid])).toEqual([
      [103, 'VERSION_0001'],
      [117, 'VERSION_0005'],
      [125, 'VERSION_0131'],
    ])
    expect(changes).toEqual([{ collection: 'versions', id: 125, from: 'VERSION_0005', to: 'VERSION_0131' }])
    expect(state.nextId).toBe(132)
  })

  it('並び順が逆でも、id が小さい方を残す', () => {
    const before = stateWithVersions([
      { id: 125, uid: 'VERSION_0005' },
      { id: 117, uid: 'VERSION_0005' },
    ])
    const { state } = repairDuplicateUids(before)
    expect(state.versions.map((v) => [v.id, v.uid])).toEqual([
      [125, 'VERSION_0131'],
      [117, 'VERSION_0005'],
    ])
  })

  it('付け直す uid は、既にあるどの uid とも重ならない', () => {
    const before = stateWithVersions([
      { id: 117, uid: 'VERSION_0005' },
      { id: 125, uid: 'VERSION_0005' },
      { id: 126, uid: 'VERSION_0131' },
    ])
    const { state } = repairDuplicateUids(before)
    const uids = state.versions.map((v) => v.uid)
    expect(new Set(uids).size).toBe(uids.length)
    expect(state.versions[1]?.uid).toBe('VERSION_0132')
  })

  it('3件以上重なっていても、残す1件以外は全部付け直す', () => {
    const before = stateWithVersions([
      { id: 10, uid: 'VERSION_0002' },
      { id: 20, uid: 'VERSION_0002' },
      { id: 30, uid: 'VERSION_0002' },
    ])
    const { state, changes } = repairDuplicateUids(before)
    expect(state.versions.map((v) => v.uid)).toEqual(['VERSION_0002', 'VERSION_0131', 'VERSION_0132'])
    expect(changes).toHaveLength(2)
    expect(state.nextId).toBe(133)
  })

  it('重なりが無ければ何も変えない（同じ state をそのまま返す）', () => {
    const before = stateWithVersions([
      { id: 103, uid: 'VERSION_0001' },
      { id: 117, uid: 'VERSION_0005' },
    ])
    const { state, changes } = repairDuplicateUids(before)
    expect(state).toBe(before)
    expect(changes).toEqual([])
  })

  it('beyondページ（18文字の形）・中間ページ・フォルダも直す', () => {
    let base = createEmptyState()
    base = createFolder(base, { name: 'F1', parent_id: null }).state
    base = createFolder(base, { name: 'F2', parent_id: null }).state
    base = createAbTest(base, { title: 'P1', memo: '', media_id: 1, folder_id: null }).state
    base = createAbTest(base, { title: 'P2', memo: '', media_id: 1, folder_id: null }).state
    const pageUid = base.abTests[0]?.uid ?? ''
    base = addRedirectPage(base, pageUid).state
    base = addRedirectPage(base, pageUid).state
    const duplicated: State = {
      ...base,
      folders: base.folders.map((f, i) => (i === 1 ? { ...f, uid: base.folders[0]?.uid ?? '' } : f)),
      abTests: base.abTests.map((t, i) => (i === 1 ? { ...t, uid: pageUid } : t)),
      redirectPages: base.redirectPages.map((p, i) => (i === 1 ? { ...p, uid: base.redirectPages[0]?.uid ?? '' } : p)),
    }
    const { state, changes } = repairDuplicateUids(duplicated)
    for (const items of [state.folders, state.abTests, state.redirectPages]) {
      expect(new Set(items.map((item) => item.uid)).size).toBe(items.length)
    }
    expect(state.abTests[1]?.uid).toMatch(/^[A-Za-z0-9]{18}$/)
    expect(changes.map((c) => c.collection).sort()).toEqual(['abTests', 'folders', 'redirectPages'])
  })
})
