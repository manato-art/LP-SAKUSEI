/**
 * 本番URLの発行と、見に来た人の印（2026-10-30 本人）。
 *   - 「本番URLは発行ボタンを押さない限り表示しない」「発行するのは、LP編集するページで」
 *   - 発行する前の本番URLは開かない・発行できるのは管理者だけ・複製した写しは発行前から
 *   - 札は発行しても準備中のまま、本物の人が初めて見に来たら配信中
 *   - 「90日以上新規がいなかったら 90日閲覧なし っていうマーク」
 * 前からあるページ（issued の項目が無い）は発行済みとして扱う（配信中の広告のURLを止めない）。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { isServableOnHost } from '../mock-server/lib/delivery-host.ts'
import { createAbTest } from '../mock-server/store/actions.ts'
import { backfillLastVisitDates, noteRealVisit } from '../mock-server/store/page-visit.ts'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import type { AbTest, DailyMetric, State } from '../mock-server/store/types.ts'
import { NO_VISIT_DAYS, isIssued, isNoVisitForLong } from '../src/shared/page-issue.ts'
import { NOT_ISSUED_NOTE, pageDeliveryNote, pageDeliveryUrl } from '../src/app/pages/page-delivery-url.ts'
import { getJson, postJson, requestWithHost, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

const SYSTEM_HOST = 'lp-sakusei.example.test'

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

interface PageJson {
  ab_test: { uid: string; issued: boolean; ad_status: string; last_visit_date: string | null; no_visit_long: boolean }
  version: { uid: string }
}

const createPage = async () => (await postJson<PageJson>(`${server.api}/ab_tests`, { title: 'めぐり', media_id: 1 })).json
const issue = (uid: string) => postJson<PageJson>(`${server.api}/ab_tests/${uid}/issue`)
const openLp = async (uid: string) => (await requestWithHost('GET', `${server.baseUrl}/lp/${uid}`, { host: SYSTEM_HOST })).status
/** ふつうのスマホ（名乗りが空だとボット扱いで数えない） */
const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const pv = (uid: string, userAgent = PHONE_UA) =>
  requestWithHost('POST', `${server.baseUrl}/lp/${uid}/__track`, {
    host: SYSTEM_HOST,
    contentType: 'text/plain',
    body: JSON.stringify({ event: 'pv' }),
    userAgent,
  })
const pageOf = async (uid: string) => (await getJson<PageJson>(`${server.api}/ab_tests/${uid}`)).ab_test

describe('本番URLの発行', () => {
  it('新しく作ったLPは発行前＝本番URLを開いても出ない（確かめはプレビューで）', async () => {
    const page = await createPage()
    expect(page.ab_test.issued).toBe(false)
    expect(await openLp(page.ab_test.uid)).toBe(404)
    expect((await requestWithHost('GET', `${server.baseUrl}/preview/${page.version.uid}`, { host: SYSTEM_HOST })).status).toBe(200)
  })

  it('発行前は計測も受け付けない', async () => {
    const page = await createPage()
    expect((await pv(page.ab_test.uid)).status).toBe(404)
  })

  it('発行すると本番URLで開ける。札は準備中のまま', async () => {
    const page = await createPage()
    const res = await issue(page.ab_test.uid)
    expect(res.status).toBe(200)
    expect(res.json.ab_test.issued).toBe(true)
    expect(res.json.ab_test.ad_status).toBe('prepared')
    expect(await openLp(page.ab_test.uid)).toBe(200)
  })

  it('もう一度押しても発行済みのまま（何も壊さない）', async () => {
    const page = await createPage()
    await issue(page.ab_test.uid)
    expect((await issue(page.ab_test.uid)).status).toBe(200)
    expect(await openLp(page.ab_test.uid)).toBe(200)
  })

  it('発行済みのLPを複製した写しは発行前から', async () => {
    const page = await createPage()
    await issue(page.ab_test.uid)
    const copy = await postJson<PageJson>(`${server.api}/ab_tests/${page.ab_test.uid}/duplicate`, {})
    expect(copy.json.ab_test.issued).toBe(false)
    expect(await openLp(copy.json.ab_test.uid)).toBe(404)
  })

  it('前からあるページ（issued の項目が無い）は発行済みとして出す', () => {
    const made = createAbTest(createEmptyState(), { title: '金谷味噌汁', memo: '', folder_id: null, media_id: 1 })
    const { issued: _issued, ...legacy } = made.abTest
    expect(isIssued(legacy as AbTest)).toBe(true)
    expect(isServableOnHost(made.state, legacy as AbTest, SYSTEM_HOST)).toBe(true)
    expect(isServableOnHost(made.state, made.abTest, SYSTEM_HOST)).toBe(false)
  })
})

describe('本物の人が初めて見に来たら配信中', () => {
  it('準備中 → 配信中。最後に来た日も残す', async () => {
    const page = await createPage()
    await issue(page.ab_test.uid)
    expect((await pv(page.ab_test.uid)).status).toBe(200)
    const after = await pageOf(page.ab_test.uid)
    expect(after.ad_status).toBe('delivered')
    expect(after.last_visit_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('ボットでは変えない', async () => {
    const page = await createPage()
    await issue(page.ab_test.uid)
    await pv(page.ab_test.uid, 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://google.example.test/bot.html)')
    const after = await pageOf(page.ab_test.uid)
    expect(after.ad_status).toBe('prepared')
    expect(after.last_visit_date).toBeNull()
  })

  it('自分で決めた停止中・終了は変えない（最後に来た日だけ残す）', async () => {
    const page = await createPage()
    await issue(page.ab_test.uid)
    await sendJson('PUT', `${server.api}/ab_tests/${page.ab_test.uid}`, { ad_status: 'stopping' })
    await pv(page.ab_test.uid)
    const after = await pageOf(page.ab_test.uid)
    expect(after.ad_status).toBe('stopping')
    expect(after.last_visit_date).not.toBeNull()
  })

  it('同じ日に何人来ても、ページの記録は1回しか書き換えない', () => {
    const made = createAbTest(createEmptyState(), { title: 'めぐり', memo: '', folder_id: null, media_id: 1 })
    const once = noteRealVisit(made.state, made.abTest.uid, '2026-10-30')
    expect(noteRealVisit(once, made.abTest.uid, '2026-10-30')).toBe(once)
  })
})

describe('90日閲覧なし', () => {
  const base = { issued: true, created_at: Date.UTC(2026, 0, 1) / 1000 }

  it(`最後に本物の人が来てから${NO_VISIT_DAYS}日以上たったら付ける`, () => {
    expect(isNoVisitForLong({ ...base, last_visit_date: '2026-08-01' }, '2026-10-30')).toBe(true)
    expect(isNoVisitForLong({ ...base, last_visit_date: '2026-08-02' }, '2026-10-30')).toBe(false)
  })

  it('1回も来ていなければ、発行した日（前からあるページは作った日）から数える', () => {
    expect(isNoVisitForLong({ ...base, last_visit_date: null }, '2026-10-30')).toBe(true)
    expect(isNoVisitForLong({ ...base, last_visit_date: null, issued_at: Date.UTC(2026, 9, 1) / 1000 }, '2026-10-30')).toBe(false)
  })

  it('発行前のページには付けない（まだ誰にも見せていない）', () => {
    expect(isNoVisitForLong({ ...base, issued: false, last_visit_date: null }, '2026-10-30')).toBe(false)
  })

  it('前からあるページの最後に来た日は、残っている日ごとの数字から埋める（1回だけ）', () => {
    const made = createAbTest(createEmptyState(), { title: '金谷味噌汁', memo: '', folder_id: null, media_id: 1 })
    const metric = (date: string, pv: number): DailyMetric =>
      ({ scope: 'ab_test', entity_uid: made.abTest.uid, date, pv, click: 0 }) as unknown as DailyMetric
    const state: State = { ...made.state, metrics: [metric('2026-09-01', 3), metric('2026-10-20', 5), metric('2026-10-25', 0)] }
    const out = backfillLastVisitDates(state)
    expect(out.changed).toBe(1)
    expect(out.state.abTests[0]?.last_visit_date).toBe('2026-10-20')
    expect(backfillLastVisitDates(out.state).changed).toBe(0)
  })
})

describe('画面に出す配信URL', () => {
  const origin = 'https://lp.example.test'

  it('発行前は出さず、「まだ発行していません」と案内する', () => {
    const page = { uid: 'P1', delivery_domain: 'c1-news.test', issued: false }
    expect(pageDeliveryUrl(page, 'system', origin)).toBeNull()
    expect(pageDeliveryNote(page)).toBe(NOT_ISSUED_NOTE)
    expect(NOT_ISSUED_NOTE).toContain('本番URLを発行')
  })

  it('発行済みなら、ページの住所（前からあるページはフォルダのドメイン）で出す', () => {
    expect(pageDeliveryUrl({ uid: 'P1', delivery_domain: 'c1-news.test', issued: true }, 'system', origin)).toBe('https://c1-news.test/lp/P1')
    expect(pageDeliveryUrl({ uid: 'P2' }, 'system', origin)).toBe(`${origin}/lp/P2`)
    expect(pageDeliveryNote({ uid: 'P2' })).toContain('フォルダ')
  })
})
