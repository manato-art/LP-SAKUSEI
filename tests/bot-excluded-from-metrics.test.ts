/**
 * ボットのアクセスはレポートの数字に入れない（2026-09-16・本人の依頼）。
 *
 * 計測タグの送り口で判定して、PV・クリック・CV・ヒートマップのどれにも積まない。
 * 除いた件数は表示（pv）のときだけ数えて、画面の「ボットは含めていません（◯件）」に使う。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'
import { getState } from '../mock-server/store/store.ts'

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

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://google.example.test/bot.html)'

async function createPage(): Promise<{ abTestUid: string; versionUid: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: 'ボット除外の確認',
    media_id: 1,
  })
  const version = getState().versions.at(-1)
  if (version === undefined) throw new Error('Versionを作れませんでした')
  return { abTestUid: created.json.ab_test.uid, versionUid: version.uid }
}

async function track(
  abTestUid: string,
  userAgent: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${server.baseUrl}/lp/${abTestUid}/__track`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'User-Agent': userAgent },
    body: JSON.stringify(body),
  })
  return (await res.json()) as Record<string, unknown>
}

const pvOf = (uid: string): number =>
  getState().metrics.filter((m) => m.entity_uid === uid).reduce((sum, m) => sum + m.pv, 0)

const botsOf = (uid: string): number =>
  getState().botHits.filter((h) => h.ab_test_uid === uid).reduce((sum, h) => sum + h.count, 0)

describe('ボットはレポートの数字に入れない', () => {
  it('人の表示は数え、ボットの表示は数えない', async () => {
    const { abTestUid, versionUid } = await createPage()
    await track(abTestUid, IPHONE, { event: 'pv', version: versionUid })
    const bot = await track(abTestUid, GOOGLEBOT, { event: 'pv', version: versionUid })

    expect(bot['bot'], '送り口はボットと分かったことを返す').toBe(true)
    expect(pvOf(abTestUid)).toBe(1)
    expect(pvOf(versionUid)).toBe(1)
  })

  it('除いた件数を、表示のときだけ数える', async () => {
    const { abTestUid, versionUid } = await createPage()
    await track(abTestUid, GOOGLEBOT, { event: 'pv', version: versionUid })
    await track(abTestUid, GOOGLEBOT, { event: 'click', version: versionUid })
    await track(abTestUid, GOOGLEBOT, { event: 'heatmap', version: versionUid, bands: 20 })

    expect(botsOf(abTestUid), '1回の訪問で1件').toBe(1)
  })

  it('ボットのクリックもヒートマップも積まない', async () => {
    const { abTestUid, versionUid } = await createPage()
    await track(abTestUid, GOOGLEBOT, { event: 'click', version: versionUid })
    await track(abTestUid, GOOGLEBOT, { event: 'heatmap', version: versionUid, bands: 20 })

    const clicks = getState().metrics.filter((m) => m.entity_uid === abTestUid).reduce((s, m) => s + m.click, 0)
    expect(clicks).toBe(0)
    expect(getState().heatmapStats.filter((h) => h.ab_test_uid === abTestUid)).toEqual([])
  })

  it('自動操作のブラウザ（計測タグが wd:1 を付けてきた）も数えない', async () => {
    const { abTestUid, versionUid } = await createPage()
    await track(abTestUid, IPHONE, { event: 'pv', version: versionUid, wd: 1 })
    expect(pvOf(abTestUid)).toBe(0)
    expect(botsOf(abTestUid)).toBe(1)
  })

  it('ボットはレポート除外画面のアクセス記録にも残さない（IPの一覧が巡回で埋まるため）', async () => {
    const { abTestUid, versionUid } = await createPage()
    const before = getState().requestLogs.length
    await track(abTestUid, GOOGLEBOT, { event: 'pv', version: versionUid })
    expect(getState().requestLogs.length).toBe(before)
  })
})
