/**
 * 削除のあとに作っても uid が重ならず、削除した物の uid も使い回さないことの機械証明（2026-09-11 全体監査）。
 *
 * 以前は uid の番号が「今ある件数＋1」だったので、削除のあとに作ると既存と同じ uid が付いた。
 * 本番では別々のLPの Version が2件とも VERSION_0005 になっていた（2026-09-11 に本番データを読んで確認）。
 * uid での検索は先頭一致なので、片方のLPを編集するともう片方のLPの Version が書き換わる、
 * 削除すると両方消える、が起こりえた。
 * 削除した物の uid を使い回すと、古いプレビューURLや中間ページリンクが別の物を指すので、それも起こさない。
 */
import { describe, expect, it } from 'vitest'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import {
  addArticle,
  addRedirectPage,
  addVersion,
  createAbTest,
  createFolder,
  deleteFolder,
  deleteRedirectPage,
  deleteVersion,
  duplicateVersion,
  duplicateVersionToArticle,
} from '../mock-server/store/actions.ts'
import type { State } from '../mock-server/store/types.ts'

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('作れませんでした')
  return value
}

function isUnique(items: readonly { uid: string }[]): boolean {
  return new Set(items.map((item) => item.uid)).size === items.length
}

/** beyondページを1つ作り、記事に Version を count 本足した状態 */
function pageWithVersions(count: number): { state: State; articleUid: string; abTestUid: string; issued: string[] } {
  const made = createAbTest(createEmptyState(), { title: 'A', memo: '', media_id: 1, folder_id: null })
  let state = made.state
  const issued = [made.version.uid]
  for (let i = 1; i < count; i += 1) {
    const out = addVersion(state, made.article.uid)
    state = out.state
    issued.push(must(out.version).uid)
  }
  return { state, articleUid: made.article.uid, abTestUid: made.abTest.uid, issued }
}

describe('Version の uid', () => {
  it('途中の Version を消してから追加しても、残っている Version と重ならない（本番で起きた形）', () => {
    const page = pageWithVersions(4)
    const afterDelete = deleteVersion(page.state, must(page.issued[1])).state
    const added = addVersion(afterDelete, page.articleUid)
    expect(isUnique(added.state.versions)).toBe(true)
    expect(page.issued).not.toContain(must(added.version).uid)
  })

  it('最後に作った Version を消してから追加しても、その uid を使い回さない', () => {
    const page = pageWithVersions(3)
    const afterDelete = deleteVersion(page.state, must(page.issued[2])).state
    const added = addVersion(afterDelete, page.articleUid)
    expect(page.issued).not.toContain(must(added.version).uid)
  })

  it('複製・別のページへの複製・ステップ追加でも重ならない', () => {
    const page = pageWithVersions(3)
    let state = deleteVersion(page.state, must(page.issued[0])).state
    const duplicated = duplicateVersion(state, must(page.issued[1]))
    state = duplicated.state
    const step = must(addArticle(state, page.abTestUid))
    state = step.state
    const copied = duplicateVersionToArticle(state, must(page.issued[2]), step.article.uid)
    state = copied.state
    expect(isUnique(state.versions)).toBe(true)
    for (const uid of [must(duplicated.version).uid, step.version.uid, must(copied.version).uid]) {
      expect(page.issued).not.toContain(uid)
    }
  })
})

describe('beyondページ・記事の uid', () => {
  it('何件作っても重ならない', () => {
    let state = createEmptyState()
    for (let i = 0; i < 5; i += 1) {
      state = createAbTest(state, { title: `P${i}`, memo: '', media_id: 1, folder_id: null }).state
    }
    expect(isUnique(state.abTests)).toBe(true)
    expect(isUnique(state.articles)).toBe(true)
  })
})

describe('中間ページの uid', () => {
  it('消してから追加しても、残っている中間ページと重ならず、消した uid も使い回さない', () => {
    const page = pageWithVersions(1)
    let state = page.state
    const issued: string[] = []
    for (let i = 0; i < 3; i += 1) {
      const out = addRedirectPage(state, page.abTestUid)
      state = out.state
      issued.push(must(out.page).uid)
    }
    state = deleteRedirectPage(state, must(issued[0])).state
    state = deleteRedirectPage(state, must(issued[2])).state
    const added = addRedirectPage(state, page.abTestUid)
    expect(isUnique(added.state.redirectPages)).toBe(true)
    expect(issued).not.toContain(must(added.page).uid)
  })
})

describe('フォルダの uid', () => {
  it('消してから作っても、残っているフォルダと重ならず、消した uid も使い回さない', () => {
    let state = createEmptyState()
    const issued: string[] = []
    for (let i = 0; i < 3; i += 1) {
      const out = createFolder(state, { name: `F${i}`, parent_id: null })
      state = out.state
      issued.push(out.folder.uid)
    }
    state = deleteFolder(state, must(issued[0])).state
    const added = createFolder(state, { name: 'F3', parent_id: null })
    expect(isUnique(added.state.folders)).toBe(true)
    expect(issued).not.toContain(added.folder.uid)
  })
})
