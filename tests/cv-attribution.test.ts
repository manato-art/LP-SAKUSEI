/**
 * CVを「その人が見ていたVersion」に数えることの機械証明（2026-09-11・本人承認。SquadBeyond 公式FAQに合わせる）。
 *
 * 本体の考え方（公式FAQの CV条件・指標・CV数の乖離の説明）:
 *   - CV条件「クリック」: 計測機能付きリンクを押した人の成果だけを、そのVersionのCVに数える（CVR＝CV÷クリック）
 *   - CV条件「アクセス」: Versionを見た人の成果も数える
 *   - 計測リンクを押してから1日以内の成果だけ
 * 目印は LP のリンクに付ける squadbeyond_uid（＝Cookie _sb_tu）。サンクスページのCVタグがそれを送る。
 * 結びつかない成果は数えない（本人承認）。同じ目印の成果は1回だけ数える。
 * 以前は、CVタグが動けば全部をページ全体のCVに数え、Version別のCVは常に0だった。
 */
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'
import { getState, setState } from '../mock-server/store/store.ts'

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

const DAY_MS = 24 * 60 * 60 * 1000

/** beyondページを作り、その uid と最初の Version の uid を返す（CV条件を指定できる） */
async function createPage(condition: 'click' | 'access' = 'click'): Promise<{ abTestUid: string; versionUid: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, { title: 'CVの確認', media_id: 1 })
  const abTestUid = created.json.ab_test.uid
  setState((s) => ({
    ...s,
    abTests: s.abTests.map((t) =>
      t.uid === abTestUid ? { ...t, conversion_setting: { ...t.conversion_setting, conversion_condition: condition } } : t,
    ),
  }))
  const version = getState().versions.at(-1)
  if (version === undefined) throw new Error('Versionを作れませんでした')
  return { abTestUid, versionUid: version.uid }
}

/** 計測タグと同じ形でビーコンを送る（text/plain の JSON） */
async function track(abTestUid: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${server.baseUrl}/lp/${abTestUid}/__track`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  })
  return (await res.json()) as Record<string, unknown>
}

function totalOf(entityUid: string, key: 'cv' | 'sales'): number {
  return getState()
    .metrics.filter((m) => m.entity_uid === entityUid)
    .reduce((sum, m) => sum + m[key], 0)
}

/** 記録の時刻を ms だけ過去にずらす（1日を過ぎた場合を作る） */
function shiftTouches(ms: number): void {
  setState((s) => ({
    ...s,
    visitorTouches: s.visitorTouches.map((t) => ({
      ...t,
      viewed_at: t.viewed_at === null ? null : t.viewed_at - ms,
      clicked_at: t.clicked_at === null ? null : t.clicked_at - ms,
    })),
  }))
}

describe('CV条件「クリック」（既定）', () => {
  it('計測リンクを押した人の成果を、見ていたVersionとページ全体のCV・売上に数える', async () => {
    const page = await createPage()
    const vid = randomUUID()
    await track(page.abTestUid, { event: 'pv', version: page.versionUid, vid })
    await track(page.abTestUid, { event: 'click', version: page.versionUid, vid })
    expect(await track(page.abTestUid, { event: 'cv', vid, amount: 5000 })).toMatchObject({ ok: true, counted: true })

    expect(totalOf(page.versionUid, 'cv')).toBe(1)
    expect(totalOf(page.abTestUid, 'cv')).toBe(1)
    expect(totalOf(page.versionUid, 'sales')).toBe(5000)
    expect(totalOf(page.abTestUid, 'sales')).toBe(5000)
    expect(getState().conversions.map((c) => c.version_uid)).toEqual([page.versionUid])
  })

  it('見ただけで計測リンクを押していない人の成果は数えない', async () => {
    const page = await createPage()
    const vid = randomUUID()
    await track(page.abTestUid, { event: 'pv', version: page.versionUid, vid })
    expect(await track(page.abTestUid, { event: 'cv', vid })).toMatchObject({ ok: true, counted: false })
    expect(totalOf(page.abTestUid, 'cv')).toBe(0)
    expect(getState().conversions).toEqual([])
  })

  it('目印が無い成果・知らない目印の成果は数えない', async () => {
    const page = await createPage()
    expect(await track(page.abTestUid, { event: 'cv', amount: 1000 })).toMatchObject({ counted: false })
    expect(await track(page.abTestUid, { event: 'cv', vid: randomUUID() })).toMatchObject({ counted: false })
    expect(totalOf(page.abTestUid, 'cv')).toBe(0)
  })

  it('同じ目印の成果は1回だけ数える（サンクスページを開き直しても増えない）', async () => {
    const page = await createPage()
    const vid = randomUUID()
    await track(page.abTestUid, { event: 'click', version: page.versionUid, vid })
    await track(page.abTestUid, { event: 'cv', vid })
    expect(await track(page.abTestUid, { event: 'cv', vid })).toMatchObject({ counted: false })
    expect(totalOf(page.versionUid, 'cv')).toBe(1)
  })

  it('計測リンクを押してから1日を過ぎた成果は数えない', async () => {
    const page = await createPage()
    const vid = randomUUID()
    await track(page.abTestUid, { event: 'click', version: page.versionUid, vid })
    shiftTouches(DAY_MS + 60_000)
    expect(await track(page.abTestUid, { event: 'cv', vid })).toMatchObject({ counted: false })
    expect(totalOf(page.abTestUid, 'cv')).toBe(0)
  })
})

describe('CV条件「アクセス」', () => {
  it('Versionを見た人の成果を、そのVersionのCVに数える（押していなくてもよい）', async () => {
    const page = await createPage('access')
    const vid = randomUUID()
    await track(page.abTestUid, { event: 'pv', version: page.versionUid, vid })
    expect(await track(page.abTestUid, { event: 'cv', vid })).toMatchObject({ counted: true })
    expect(totalOf(page.versionUid, 'cv')).toBe(1)
  })
})

describe('照らし合わせの範囲', () => {
  it('別のページのCVタグから届いた成果は、そのページの記録としか照らし合わせない', async () => {
    const pageA = await createPage()
    const pageB = await createPage()
    const vid = randomUUID()
    await track(pageA.abTestUid, { event: 'click', version: pageA.versionUid, vid })
    expect(await track(pageB.abTestUid, { event: 'cv', vid })).toMatchObject({ counted: false })
    expect(totalOf(pageA.abTestUid, 'cv')).toBe(0)
    expect(totalOf(pageB.abTestUid, 'cv')).toBe(0)
  })

  it('外部LPの計測タグ（Versionなし）でも、押した人の成果をページ全体のCVに数える', async () => {
    const page = await createPage()
    const vid = randomUUID()
    await track(page.abTestUid, { event: 'click', vid })
    expect(await track(page.abTestUid, { event: 'cv', vid })).toMatchObject({ counted: true })
    expect(totalOf(page.abTestUid, 'cv')).toBe(1)
    expect(getState().metrics.filter((m) => m.scope === 'version' && m.cv > 0)).toEqual([])
  })
})

describe('保存データを増やし続けない', () => {
  it('1日を過ぎた記録は、次に記録するときに消す', async () => {
    const page = await createPage()
    const oldVid = randomUUID()
    const newVid = randomUUID()
    await track(page.abTestUid, { event: 'pv', version: page.versionUid, vid: oldVid })
    shiftTouches(2 * DAY_MS)
    await track(page.abTestUid, { event: 'pv', version: page.versionUid, vid: newVid })
    expect(getState().visitorTouches.map((t) => t.vid)).toEqual([newVid])
  })

  it('目印の形がおかしいものは記録しない', async () => {
    const page = await createPage()
    await track(page.abTestUid, { event: 'click', version: page.versionUid, vid: '<script>' })
    await track(page.abTestUid, { event: 'click', version: page.versionUid, vid: 'x'.repeat(500) })
    expect(getState().visitorTouches).toEqual([])
  })
})

describe('タグの配信', () => {
  it('受け渡しタグ（/t/<uid>.keep.js）は、目印を保存するだけのスクリプトを返す', async () => {
    const page = await createPage()
    const res = await fetch(`${server.baseUrl}/t/${page.abTestUid}.keep.js`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('javascript')
    const body = await res.text()
    expect(body).toContain('squadbeyond_uid')
    expect(body).not.toContain("event:'cv'")
  })
})
