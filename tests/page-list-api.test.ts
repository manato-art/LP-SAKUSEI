/**
 * ページ一覧が使うAPI（2026-09-24 点検）。
 *
 *   - 行のアイコン（Version / ステップ / ポップアップ / 中間ページ / CV）と右パネルの件数を実数で返す
 *     （以前は中間ページ数が常に0・ポップアップは離脱防止だけ・行は採取物の数字のまま）
 *   - 合計行は /folders/:uid/ab_tests/reports_total（表に出ている行だけに絞れる）
 *   - フォルダを消したページ（folder_id が null）＝「フォルダなし」を一覧・合計できる
 *   - beyondページの複製（同じフォルダ / 別フォルダ）。数字（PV・CV・ヒートマップ）は写さない
 *   - フォルダ移動は実在するフォルダか「フォルダなし」だけ（無いフォルダに入れると、どこにも出なくなる）
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { bumpMetric, createAbTest, createFolder, recordConversion } from '../mock-server/store/actions.ts'
import { getState, setState } from '../mock-server/store/store.ts'
import { toDateKey } from '../mock-server/store/metrics.ts'
import { UNFILED_FOLDER_UID } from '../mock-server/store/unfiled.ts'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer

beforeAll(async () => {
  server = await startTestServer()
})

afterAll(async () => {
  await server.close()
})

beforeEach(() => {
  resetStore()
})

interface Seeded {
  folderUid: string
  folderId: number
  otherFolderId: number
  abTestUid: string
  abTestId: number
}

function seed(): Seeded {
  const out: Seeded = { folderUid: '', folderId: 0, otherFolderId: 0, abTestUid: '', abTestId: 0 }
  setState((state) => {
    const folder = createFolder(state, { name: 'フォルダA', parent_id: null })
    const other = createFolder(folder.state, { name: 'フォルダB', parent_id: null })
    const page = createAbTest(other.state, { title: 'ページ1', memo: '', folder_id: folder.folder.id, media_id: 3 })
    out.folderUid = folder.folder.uid
    out.folderId = folder.folder.id
    out.otherFolderId = other.folder.id
    out.abTestUid = page.abTest.uid
    out.abTestId = page.abTest.id
    return page.state
  })
  return out
}

interface Counts {
  id: number
  versions_count: number
  funnel_steps_count: number
  popups_count: number
  exit_popups_count: number
  follow_popups_count: number
  redirect_pages_count: number
  has_conversion: boolean
}

describe('関連数（行のアイコン・右パネルの件数）', () => {
  it('作ったばかりのページは Version 1 / ステップ 0 / ポップアップ 0 / 中間ページ 0 / CV なし', async () => {
    const s = seed()
    const body = await getJson<{ relation_counts: Counts[] }>(
      `${server.api}/folders/${s.folderUid}/ab_tests/relation_counts?ids=${s.abTestId}`,
    )
    expect(body.relation_counts[0]).toMatchObject({
      id: s.abTestId,
      versions_count: 1,
      funnel_steps_count: 0,
      popups_count: 0,
      redirect_pages_count: 0,
      has_conversion: false,
    })
  })

  it('ステップ・離脱防止と追従型・中間ページ・届いたCVを数える', async () => {
    const s = seed()
    await postJson(`${server.api}/ab_tests/${s.abTestUid}/articles`, { name: '2つ目' })
    await postJson(`${server.api}/ab_tests/${s.abTestUid}/exit_popups`, { name: '離脱防止1' })
    await postJson(`${server.api}/ab_tests/${s.abTestUid}/follow_popups`, { name: '追従1' })
    await postJson(`${server.api}/ab_tests/${s.abTestUid}/redirect_pages/create`, {})
    await postJson(`${server.api}/ab_tests/${s.abTestUid}/redirect_pages/create`, {})
    setState((state) => recordConversion(state, { ab_test_uid: s.abTestUid, version_uid: '', media_id: 3, amount: 0 }).state)

    const body = await getJson<{ relation_counts: Counts[] }>(
      `${server.api}/folders/${s.folderUid}/ab_tests/relation_counts?ids=${s.abTestId}`,
    )
    expect(body.relation_counts[0]).toMatchObject({
      versions_count: 2,
      funnel_steps_count: 1,
      exit_popups_count: 1,
      follow_popups_count: 1,
      popups_count: 2,
      redirect_pages_count: 2,
      has_conversion: true,
    })
  })
})

describe('合計行（reports_total）', () => {
  it('表に出ている行（ab_test_uids）だけを足す', async () => {
    const s = seed()
    let second = ''
    setState((state) => {
      const out = createAbTest(state, { title: 'ページ2', memo: '', folder_id: s.folderId, media_id: 3 })
      second = out.abTest.uid
      const today = toDateKey(new Date())
      const withFirst = { ...out.state, metrics: bumpMetric(out.state, s.abTestUid, 'ab_test', today, { pv: 10, click: 2 }) }
      return { ...withFirst, metrics: bumpMetric(withFirst, second, 'ab_test', today, { pv: 5, click: 1 }) }
    })
    const all = await getJson<{ reports_total: { pv: number; click: number } }>(
      `${server.api}/folders/${s.folderUid}/ab_tests/reports_total`,
    )
    expect(all.reports_total).toMatchObject({ pv: 15, click: 3 })
    const one = await getJson<{ reports_total: { pv: number; ctr: number } }>(
      `${server.api}/folders/${s.folderUid}/ab_tests/reports_total?ab_test_uids=${second}`,
    )
    expect(one.reports_total).toMatchObject({ pv: 5, ctr: 0.2 })
  })
})

describe('フォルダなし（フォルダを消したページ）', () => {
  it('フォルダを消してもページは残り、フォルダなしの一覧と合計に出る', async () => {
    const s = seed()
    await sendJson('DELETE', `${server.api}/folders/${s.folderUid}`)
    setState((state) => ({ ...state, metrics: bumpMetric(state, s.abTestUid, 'ab_test', toDateKey(new Date()), { pv: 4 }) }))

    const list = await getJson<{ ab_tests: { uid: string }[] }>(`${server.api}/ab_tests?folder_id=null&per_page=100`)
    expect(list.ab_tests.map((t) => t.uid)).toEqual([s.abTestUid])
    const total = await getJson<{ reports_total: { pv: number } }>(
      `${server.api}/folders/${UNFILED_FOLDER_UID}/ab_tests/reports_total`,
    )
    expect(total.reports_total.pv).toBe(4)
  })
})

describe('フォルダ移動（PUT /ab_tests/:uid の folder_id）', () => {
  it('別のフォルダへ移せる（件数も移る）', async () => {
    const s = seed()
    const res = await sendJson<{ ab_test: { folder_id: number } }>('PUT', `${server.api}/ab_tests/${s.abTestUid}`, {
      folder_id: s.otherFolderId,
    })
    expect(res.status).toBe(200)
    expect(res.json.ab_test.folder_id).toBe(s.otherFolderId)
    const counts = getState().folders.map((f) => [f.id, f.ab_tests_count])
    expect(counts).toEqual([
      [s.folderId, 0],
      [s.otherFolderId, 1],
    ])
  })

  it('無いフォルダには移せない（どこにも出なくなるため）', async () => {
    const s = seed()
    const res = await sendJson<{ error: { code: string } }>('PUT', `${server.api}/ab_tests/${s.abTestUid}`, {
      folder_id: 99999,
    })
    expect(res.status).toBe(422)
    expect(getState().abTests[0]?.folder_id).toBe(s.folderId)
  })
})

describe('beyondページの複製（POST /ab_tests/:uid/duplicate）', () => {
  it('同じフォルダに、ステップとVersionごと新しいuidで写す（数字は写さない）', async () => {
    const s = seed()
    await postJson(`${server.api}/ab_tests/${s.abTestUid}/articles`, { name: '2つ目' })
    const sourceArticles = getState().articles.filter((a) => a.ab_test_id === s.abTestId)
    const sourceVersion = getState().versions.find((v) => v.article_id === sourceArticles[0]?.id)
    setState((state) => ({
      ...state,
      versions: state.versions.map((v) => (v.uid === sourceVersion?.uid ? { ...v, html: '<p>元のLP</p>' } : v)),
      metrics: bumpMetric(state, s.abTestUid, 'ab_test', toDateKey(new Date()), { pv: 9 }),
    }))

    const res = await postJson<{ ab_test: { uid: string; id: number; title: string; folder_id: number; ad_status: string } }>(
      `${server.api}/ab_tests/${s.abTestUid}/duplicate`,
      {},
    )
    expect(res.status).toBe(201)
    const copy = res.json.ab_test
    expect(copy.uid).not.toBe(s.abTestUid)
    expect(copy.folder_id).toBe(s.folderId)
    expect(copy.title).toBe('ページ1のコピー')
    expect(copy.ad_status).toBe('prepared')

    const state = getState()
    const copiedArticles = state.articles.filter((a) => a.ab_test_id === copy.id)
    expect(copiedArticles.map((a) => a.memo)).toEqual(sourceArticles.map((a) => a.memo))
    expect(copiedArticles.every((a) => !sourceArticles.some((src) => src.uid === a.uid))).toBe(true)
    const copiedVersions = state.versions.filter((v) => copiedArticles.some((a) => a.id === v.article_id))
    expect(copiedVersions).toHaveLength(2)
    expect(copiedVersions.some((v) => v.html === '<p>元のLP</p>')).toBe(true)
    expect(copiedVersions.every((v) => v.uid !== sourceVersion?.uid)).toBe(true)
    expect(state.metrics.some((m) => m.entity_uid === copy.uid)).toBe(false)
    expect(state.folders.find((f) => f.id === s.folderId)?.ab_tests_count).toBe(2)
  })

  it('別のフォルダ・フォルダなしへも複製できる', async () => {
    const s = seed()
    const other = await postJson<{ ab_test: { folder_id: number | null } }>(
      `${server.api}/ab_tests/${s.abTestUid}/duplicate`,
      { folder_id: s.otherFolderId },
    )
    expect(other.json.ab_test.folder_id).toBe(s.otherFolderId)
    const unfiled = await postJson<{ ab_test: { folder_id: number | null } }>(
      `${server.api}/ab_tests/${s.abTestUid}/duplicate`,
      { folder_id: null },
    )
    expect(unfiled.json.ab_test.folder_id).toBeNull()
  })

  it('無いフォルダ・無いページは断る', async () => {
    const s = seed()
    const badFolder = await postJson(`${server.api}/ab_tests/${s.abTestUid}/duplicate`, { folder_id: 99999 })
    expect(badFolder.status).toBe(422)
    const missing = await postJson(`${server.api}/ab_tests/NOT_EXIST/duplicate`, {})
    expect(missing.status).toBe(404)
  })
})
