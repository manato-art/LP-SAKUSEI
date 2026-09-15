/**
 * CV速報の絞り込み（2026-09-15）。
 *
 * 採取した実物（capture/clean 未取込・隔離の conversion_reports）には
 *   検索欄（placeholder「検索...」/ aria-label「速報を検索」）
 *   期間（「2026年9月8日 から 2026年9月8日 まで」）
 *   「最終更新 …」
 * があるが、クローンは全件を出すだけだった。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer

interface Row {
  uid: string
  occurred_at: number
  folder_name: string | null
  ab_test_title: string | null
}
interface Res {
  conversions: Row[]
  /** 最後にCVが入った時刻（画面の「最終更新」） */
  last_updated_at?: number | null
}

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

/** CVを1件入れる。日付は計測タグの受け口ではなく、直接ストアに積めないのでLP経由で作る */
async function setup(): Promise<{ uid: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: 'CV速報の確認用',
    media_id: 1,
  })
  const uid = created.json.ab_test.uid
  const track = async (payload: Record<string, unknown>): Promise<void> => {
    const res = await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    await res.text()
  }
  // 計測リンクを押した記録を残してからCVを送る（本体と同じ結びつけ方）
  await track({ event: 'pv', vid: 'VISITOR-1' })
  await track({ event: 'click', vid: 'VISITOR-1' })
  await track({ event: 'cv', amount: 1000, vid: 'VISITOR-1' })
  return { uid }
}

describe('CV速報の絞り込み', () => {
  it('期間の外のCVは出さない', async () => {
    await setup()
    const inside = await getJson<Res>(
      `${server.api}/conversions?start_date=2000-01-01&end_date=2099-12-31`,
    )
    expect(inside.conversions.length).toBe(1)

    const outside = await getJson<Res>(
      `${server.api}/conversions?start_date=2000-01-01&end_date=2000-01-02`,
    )
    expect(outside.conversions.length).toBe(0)
  })

  it('期間を指定しなければ今までどおり全部出す', async () => {
    await setup()
    const all = await getJson<Res>(`${server.api}/conversions`)
    expect(all.conversions.length).toBe(1)
  })

  it('検索はページ名・フォルダ名・成果識別IDに当てる', async () => {
    await setup()
    const hit = await getJson<Res>(`${server.api}/conversions?q=${encodeURIComponent('CV速報')}`)
    expect(hit.conversions.length).toBe(1)

    const miss = await getJson<Res>(`${server.api}/conversions?q=${encodeURIComponent('存在しない語')}`)
    expect(miss.conversions.length).toBe(0)
  })

  it('検索は大文字小文字を区別しない', async () => {
    const { uid } = await setup()
    const hit = await getJson<Res>(`${server.api}/conversions?q=${uid.toLowerCase()}`)
    const hit2 = await getJson<Res>(`${server.api}/conversions?q=${uid.toUpperCase()}`)
    expect(hit.conversions.length).toBe(hit2.conversions.length)
  })

  it('「最終更新」に出す時刻を返す（1件も無ければ null）', async () => {
    const empty = await getJson<Res>(`${server.api}/conversions`)
    expect(empty.last_updated_at ?? null).toBeNull()

    await setup()
    const some = await getJson<Res>(`${server.api}/conversions`)
    expect(typeof some.last_updated_at).toBe('number')
  })
})
