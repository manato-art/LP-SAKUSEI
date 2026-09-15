/**
 * ファネルの段を「ステップ」で出す（2026-09-15）。
 *
 * ステップを作れる・行き来できる・step_uid で配信できるようになったので、
 * ファネル節の段を 表示→クリック→成果 の代用ではなく**実際のステップ**にする。
 * 段ごとの数字は、そのステップに属するVersionの実測を足したもの。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer
const RANGE = 'start_date=2026-01-01&end_date=2026-12-31'

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

interface Steps {
  steps: { uid: string; name: string; pv: number; click: number; cv: number }[]
}

async function setup(): Promise<{ uid: string; first: string; second: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: 'ファネルの確認用',
    media_id: 1,
  })
  const uid = created.json.ab_test.uid
  const before = await getJson<{ articles: { uid: string }[] }>(`${server.api}/ab_tests/${uid}/articles`)
  const first = before.articles[0]?.uid ?? ''
  const added = await postJson<{ article: { uid: string } }>(`${server.api}/ab_tests/${uid}/articles`, {
    name: '申込ページ',
  })
  return { uid, first, second: added.json.article.uid }
}

async function trackOn(pageUid: string, articleUid: string, times: number): Promise<void> {
  const versions = await getJson<{ versions: { uid: string }[] }>(
    `${server.api}/articles/${articleUid}/versions`,
  )
  const version = versions.versions[0]?.uid ?? ''
  for (let i = 0; i < times; i += 1) {
    const res = await fetch(`${server.baseUrl}/lp/${pageUid}/__track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'pv', version }),
    })
    await res.text()
  }
}

describe('ファネルの段＝ステップ', () => {
  it('ステップの並び順で、名前と実測を返す', async () => {
    const { uid, first, second } = await setup()
    await trackOn(uid, first, 5)
    await trackOn(uid, second, 2)

    const out = await getJson<Steps>(`${server.api}/ab_tests/${uid}/funnel_steps?${RANGE}`)
    expect(out.steps.map((s) => s.name)).toEqual(['ステップ1', '申込ページ'])
    expect(out.steps.map((s) => s.pv)).toEqual([5, 2])
  })

  it('名前を付けていないステップは何番目かで出す', async () => {
    const { uid } = await setup()
    const out = await getJson<Steps>(`${server.api}/ab_tests/${uid}/funnel_steps?${RANGE}`)
    expect(out.steps[0]?.name).toBe('ステップ1')
  })

  it('期間の外は数えない', async () => {
    const { uid, first } = await setup()
    await trackOn(uid, first, 3)
    const out = await getJson<Steps>(
      `${server.api}/ab_tests/${uid}/funnel_steps?start_date=2000-01-01&end_date=2000-01-02`,
    )
    expect(out.steps[0]?.pv).toBe(0)
  })

  it('無いページは404', async () => {
    const res = await fetch(`${server.api}/ab_tests/NOT_EXIST/funnel_steps?${RANGE}`)
    expect(res.status).toBe(404)
  })
})
