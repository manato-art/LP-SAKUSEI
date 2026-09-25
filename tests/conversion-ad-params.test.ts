/**
 * 広告ごとの行（Branch Operation・クリエイティブ）にも CV と売上を数える（2026-09-25・数値面分析テスト）。
 *
 * 表示とクリックは「Version×広告パラメータ」でも数えていたのに、CVだけはページ全体とVersionにしか数えず、
 * 広告ごとの行はいつも CV 0・CVR 0.00% だった（fb から来た人が申し込んでも、fb の行は0件）。
 * 成果が届いたとき、その人が着地したときの広告パラメータの行にも数える。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer

const RANGE = 'start_date=2026-01-01&end_date=2026-12-31'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'

interface Row {
  entity_uid: string
  name: string
  pv: number
  click: number
  cv: number
  sales: number
  cvr: number | null
  children: Row[]
  creative_children: Row[]
}

async function setup(): Promise<{ uid: string; version: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: '広告ごとのCVの確認用',
    media_id: 1,
  })
  const uid = created.json.ab_test.uid
  const report = await getJson<{ rows: Row[] }>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
  return { uid, version: report.rows[0]?.entity_uid ?? '' }
}

async function track(uid: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'User-Agent': IPHONE },
    body: JSON.stringify(payload),
  })
  await res.text()
}

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

describe('広告ごとの行のCV', () => {
  it('fb から来て申し込んだ人の CV と売上が、fb の行（Branch Operation・クリエイティブ）に入る', async () => {
    const { uid, version } = await setup()
    const params = ['utm_source=fb', 'utm_campaign=cpA']
    // fb から来て申し込んだ人
    await track(uid, { event: 'pv', version, params, vid: 'visitor-fb-0001' })
    await track(uid, { event: 'click', version, params, vid: 'visitor-fb-0001' })
    await track(uid, { event: 'cv', vid: 'visitor-fb-0001', amount: 9800 })
    // google から来て、押しただけの人
    await track(uid, { event: 'pv', version, params: ['utm_source=google'], vid: 'visitor-gg-0001' })
    await track(uid, { event: 'click', version, params: ['utm_source=google'], vid: 'visitor-gg-0001' })

    const report = await getJson<{ rows: Row[] }>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    const row = report.rows.find((r) => r.entity_uid === version)
    expect(row?.cv).toBe(1)
    for (const list of [row?.children, row?.creative_children]) {
      const fb = list?.find((c) => c.name === 'utm_source=fb')
      const campaign = list?.find((c) => c.name === 'utm_campaign=cpA')
      const google = list?.find((c) => c.name === 'utm_source=google')
      expect(fb).toMatchObject({ pv: 1, click: 1, cv: 1, sales: 9800, cvr: 1 })
      expect(campaign).toMatchObject({ cv: 1, sales: 9800 })
      expect(google).toMatchObject({ pv: 1, click: 1, cv: 0, cvr: 0 })
    }
  })

  it('端末で絞っても、広告ごとの行に CV が入る', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'pv', version, params: ['utm_source=fb'], vid: 'visitor-fb-0002' })
    await track(uid, { event: 'click', version, params: ['utm_source=fb'], vid: 'visitor-fb-0002' })
    await track(uid, { event: 'cv', vid: 'visitor-fb-0002', amount: 0 })

    const report = await getJson<{ rows: Row[] }>(`${server.api}/ab_tests/${uid}/reports?${RANGE}&device=sp`)
    const fb = report.rows.find((r) => r.entity_uid === version)?.children.find((c) => c.name === 'utm_source=fb')
    expect(fb).toMatchObject({ pv: 1, click: 1, cv: 1 })
  })

  it('広告パラメータが無く来た人の CV は、広告ごとの行には入らない', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'pv', version, params: ['utm_source=fb'], vid: 'visitor-fb-0003' })
    await track(uid, { event: 'pv', version, params: [], vid: 'visitor-none-01' })
    await track(uid, { event: 'click', version, params: [], vid: 'visitor-none-01' })
    await track(uid, { event: 'cv', vid: 'visitor-none-01', amount: 0 })

    const report = await getJson<{ rows: Row[] }>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    const row = report.rows.find((r) => r.entity_uid === version)
    expect(row?.cv).toBe(1)
    expect(row?.children.find((c) => c.name === 'utm_source=fb')?.cv).toBe(0)
  })
})
