/**
 * 「金谷味噌汁のコピー」だけは特別に、今までのURLと c1page.com の2つで開ける（2026-10-30 本人
 * 「蝦名→味噌汁コピーだけは特別に 今までのURLと c1page.com の２個を設けて」）。
 *
 * 前からあるLPは住所を持たない（フォルダのドメインで出す）。このページだけ c1page.com の住所を持たせ、
 * 今までのURL（このシステムのドメイン）もそのまま開けるようにする。
 */
import { describe, expect, it } from 'vitest'
import { isServableOnHost } from '../mock-server/lib/delivery-host.ts'
import { createAbTest, createFolder } from '../mock-server/store/actions.ts'
import { duplicateAbTest } from '../mock-server/store/duplicate-ab-test.ts'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import { TWO_URL_PAGE_UID, keepTwoUrlsForSpecialPage } from '../mock-server/store/two-url-page.ts'
import type { State } from '../mock-server/store/types.ts'

const BASE = 'c1page.com'
const SYSTEM_HOST = 'lp-sakusei-production.up.railway.app'

/** 本番と同じ形: 土台を決める前に作った前からあるLP（住所なし）が、ドメイン「このシステム」のフォルダに入っている */
function stateWithOldPage(folderDomain = 'system'): State {
  const withFolder = createFolder(createEmptyState(), { name: '蝦名', parent_id: null })
  const folders = withFolder.state.folders.map((f) => (f.id === withFolder.folder.id ? { ...f, domain: folderDomain } : f))
  const made = createAbTest({ ...withFolder.state, folders }, { title: '金谷味噌汁のコピー', memo: '', folder_id: withFolder.folder.id, media_id: 1 })
  const other = createAbTest(made.state, { title: 'ほかのページ', memo: '', folder_id: withFolder.folder.id, media_id: 1 })
  return {
    ...other.state,
    quickDomainBase: BASE,
    abTests: other.state.abTests.map((t) => (t.id === made.abTest.id ? { ...t, uid: TWO_URL_PAGE_UID } : t)),
  }
}

const page = (state: State) => state.abTests.find((t) => t.uid === TWO_URL_PAGE_UID)

describe('金谷味噌汁のコピーだけ、住所を2つにする', () => {
  it('c1page.com の住所を足し、今までのURL（このシステムのドメイン）でも開ける', () => {
    const out = keepTwoUrlsForSpecialPage(stateWithOldPage())
    expect(out.changed).toEqual([TWO_URL_PAGE_UID])
    const target = page(out.state)
    expect(target?.delivery_domain).toBe(BASE)
    expect(target?.legacy_url_kept).toBe(true)
    if (target === undefined) throw new Error('ページが無い')
    expect(isServableOnHost(out.state, target, BASE)).toBe(true)
    expect(isServableOnHost(out.state, target, SYSTEM_HOST)).toBe(true)
  })

  it('ほかのページは触らない（前からあるLPのまま）', () => {
    const out = keepTwoUrlsForSpecialPage(stateWithOldPage())
    const others = out.state.abTests.filter((t) => t.uid !== TWO_URL_PAGE_UID)
    expect(others.length).toBe(1)
    expect(others.every((t) => t.delivery_domain === undefined && t.legacy_url_kept === undefined)).toBe(true)
  })

  it('1回足せば、2回目は何もしない（あとで頭の名前を変えても戻さない）', () => {
    const once = keepTwoUrlsForSpecialPage(stateWithOldPage())
    const renamed = {
      ...once.state,
      abTests: once.state.abTests.map((t) => (t.uid === TWO_URL_PAGE_UID ? { ...t, delivery_domain: `kanaya.${BASE}` } : t)),
    }
    const twice = keepTwoUrlsForSpecialPage(renamed)
    expect(twice.changed).toEqual([])
    expect(twice.state).toBe(renamed)
  })

  it('今までのURLが独自ドメインなら足さない（足すとそちらで開けなくなるため）', () => {
    const out = keepTwoUrlsForSpecialPage(stateWithOldPage('kanaya.example.test'))
    expect(out.changed).toEqual([])
  })

  it('土台が未設定なら何もしない', () => {
    const out = keepTwoUrlsForSpecialPage({ ...stateWithOldPage(), quickDomainBase: '' })
    expect(out.changed).toEqual([])
  })

  it('複製した写しは「今までのURLも出す」を引き継がない（写しは新しいLP）', () => {
    const out = keepTwoUrlsForSpecialPage(stateWithOldPage())
    const copy = duplicateAbTest(out.state, TWO_URL_PAGE_UID, page(out.state)?.folder_id ?? null)
    expect(copy?.abTest.delivery_domain).toBe(BASE)
    expect(copy?.abTest.legacy_url_kept).toBeUndefined()
  })
})
