/**
 * 中間ページタグ設定のストア操作（2026-09-11 に SquadBeyond 本体で確認した動きに合わせる）。
 * 本体: HEAD / BODY を押すと名前の無いタグが1件増え、タグ名と JavaScript は入力するとその場で保存、1件ずつ削除できる。
 */
import type { HtmlTagDocumentProperty, RedirectPage, RedirectPageTag, State } from './types.ts'

function replacePage(state: State, page: RedirectPage): State {
  return { ...state, redirectPages: state.redirectPages.map((p) => (p.uid === page.uid ? page : p)) }
}

/** 旧形式（名前なしの2欄＝html_tags）しか無い中間ページを、名前なしのタグ（新しい id）に置き換える */
function migratePage(state: State, page: RedirectPage): { state: State; page: RedirectPage } {
  const { html_tags: legacy, ...rest } = page
  if (page.tags !== undefined || legacy === undefined) return { state, page }
  const tags = legacy.map(
    (t, i): RedirectPageTag => ({ id: state.nextId + i, name: '', document_property: t.document_property, body: t.body }),
  )
  const migrated: RedirectPage = { ...rest, tags }
  return { state: replacePage({ ...state, nextId: state.nextId + tags.length }, migrated), page: migrated }
}

/** 中間ページのタグ（旧形式しか無いときは、それを名前なしのタグとして読む。配信で使う） */
export function redirectPageTags(page: RedirectPage): readonly RedirectPageTag[] {
  return (
    page.tags ??
    (page.html_tags ?? []).map(
      (t, i): RedirectPageTag => ({ id: -(i + 1), name: '', document_property: t.document_property, body: t.body }),
    )
  )
}

/** 一覧を開いたとき: その beyondページの中間ページのうち、旧形式のタグを名前付きのタグに置き換える */
export function migrateLegacyRedirectPageTags(state: State, abTestId: number): State {
  let next = state
  for (const page of state.redirectPages) {
    if (page.ab_test_id === abTestId) next = migratePage(next, page).state
  }
  return next
}

/** HEAD / BODY を押したとき: 名前の無いタグを1件足す */
export function addRedirectPageTag(
  state: State,
  pageUid: string,
  property: HtmlTagDocumentProperty,
): { state: State; tag: RedirectPageTag | null } {
  const found = state.redirectPages.find((p) => p.uid === pageUid)
  if (found === undefined) return { state, tag: null }
  const { state: base, page } = migratePage(state, found)
  const tag: RedirectPageTag = { id: base.nextId, name: '', document_property: property, body: '' }
  return {
    state: replacePage({ ...base, nextId: base.nextId + 1 }, { ...page, tags: [...(page.tags ?? []), tag] }),
    tag,
  }
}

/** タグ名・JavaScript を保存する（送られた方だけ変える） */
export function updateRedirectPageTag(
  state: State,
  pageUid: string,
  tagId: number,
  patch: { name?: string; body?: string },
): { state: State; tag: RedirectPageTag | null } {
  const found = state.redirectPages.find((p) => p.uid === pageUid)
  if (found === undefined) return { state, tag: null }
  const { state: base, page } = migratePage(state, found)
  const current = (page.tags ?? []).find((t) => t.id === tagId)
  if (current === undefined) return { state, tag: null }
  const tag: RedirectPageTag = {
    ...current,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.body !== undefined ? { body: patch.body } : {}),
  }
  return { state: replacePage(base, { ...page, tags: (page.tags ?? []).map((t) => (t.id === tagId ? tag : t)) }), tag }
}

/** タグを1件消す */
export function deleteRedirectPageTag(
  state: State,
  pageUid: string,
  tagId: number,
): { state: State; deleted: boolean } {
  const found = state.redirectPages.find((p) => p.uid === pageUid)
  if (found === undefined) return { state, deleted: false }
  const { state: base, page } = migratePage(state, found)
  const tags = page.tags ?? []
  if (!tags.some((t) => t.id === tagId)) return { state, deleted: false }
  return { state: replacePage(base, { ...page, tags: tags.filter((t) => t.id !== tagId) }), deleted: true }
}
