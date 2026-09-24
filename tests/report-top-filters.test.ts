/**
 * レポート画面いちばん上の絞り込み（Version / アーカイブ / 端末）。
 * 2026-09-15・本人指摘「プルダウン押しても選択肢ない」。
 *
 * 採取物の既定値は 指定なし / アーカイブ済みを除く / 全端末。
 * これまで選択肢が1つずつしか無く、押しても何も選べなかった。
 * 絞ると 行・合計・日別 のすべてがその範囲になる。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer

const RANGE = 'start_date=2026-01-01&end_date=2026-12-31'

interface Report {
  rows: { entity_uid: string; name: string; pv: number }[]
  totals: { pv: number }
  daily: { date: string; pv: number }[]
}

async function track(uid: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  await res.text()
}

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

/** Versionを2本持つページを作り、片方だけにPVを入れる */
async function setup(): Promise<{ uid: string; first: string; second: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: '絞り込み確認用',
    media_id: 1,
  })
  const uid = created.json.ab_test.uid
  const before = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
  const first = before.rows[0]?.entity_uid ?? ''
  const articles = await getJson<{ articles: { uid: string }[] }>(
    `${server.api}/ab_tests/${uid}/articles`,
  )
  const added = await postJson<{ version: { uid: string } }>(
    `${server.api}/articles/${articles.articles[0]?.uid ?? ''}/versions`,
    {},
  )
  const second = added.json.version?.uid ?? ''
  await track(uid, { event: 'pv', version: first })
  await track(uid, { event: 'pv', version: first })
  await track(uid, { event: 'pv', version: second })
  return { uid, first, second }
}

describe('Versionで絞る', () => {
  it('選んだVersionの行だけになる', async () => {
    const { uid, first } = await setup()
    const out = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}&version=${first}`)
    expect(out.rows.map((r) => r.entity_uid)).toEqual([first])
  })

  it('合計と日別もそのVersionのぶんになる', async () => {
    const { uid, second } = await setup()
    const all = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    const one = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}&version=${second}`)
    expect(all.totals.pv).toBe(3)
    expect(one.totals.pv).toBe(1)
    expect(one.daily.reduce((sum, d) => sum + d.pv, 0)).toBe(1)
  })

  it('知らないVersionを指定しても全体には戻さない（空で返す）', async () => {
    const { uid } = await setup()
    const out = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}&version=NOT_EXIST`)
    expect(out.rows).toEqual([])
    expect(out.totals.pv).toBe(0)
  })
})

describe('アーカイブで絞る', () => {
  // 2026-09-24 点検22: アーカイブの絞り込みは「行」だけに効かせる。合計はページ全体のまま
  // （以前は合計が Version の数字だけに切り替わり、ページにしか無い配信金額・外部LPの計測が消えていた）。
  it('既定はアーカイブ済みの行を除く（合計はページ全体のまま）', async () => {
    const { uid, second } = await setup()
    await postJson(`${server.api}/versions/${second}/archive`, {})
    const out = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    expect(out.rows.map((r) => r.entity_uid)).not.toContain(second)
    expect(out.totals.pv).toBe(3)
  })

  it('アーカイブ済みを含めると戻る', async () => {
    const { uid, second } = await setup()
    await postJson(`${server.api}/versions/${second}/archive`, {})
    const out = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}&archive=all`)
    expect(out.rows.map((r) => r.entity_uid)).toContain(second)
    expect(out.totals.pv).toBe(3)
  })
})

describe('端末で絞る', () => {
  it('その端末に配信するVersionだけになる', async () => {
    const { uid, first, second } = await setup()
    await sendJson('PATCH', `${server.api}/versions/${second}/device_targets`, {
      sp: true,
      tablet: false,
      pc: false,
    })
    const pc = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}&device=pc`)
    expect(pc.rows.map((r) => r.entity_uid)).toEqual([first])
  })
})
