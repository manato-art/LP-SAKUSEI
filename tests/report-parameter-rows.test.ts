/**
 * Branch Operation の広告パラメータ行（2026-09-15・実物の採取に合わせて実装）。
 *
 * 実物（capture/clean/ab_tests__UID__reports/report-settings-modal の本体側）は、
 * Version の行の下に `utm_medium=paid` `utm_source=ig` … がぶら下がり、
 * それぞれに 配信金額/PV/CLICK/CTR/CV/… が並ぶ。PVの多い順。
 * レポート設定で Branch Operation をOFFにしたパラメータは出ない。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer

interface Row {
  entity_uid: string
  name: string
  pv: number
  click: number
  fver?: number | null
  children?: Row[]
}

// 期間は1年に絞る。100年ぶんを頼むと日別の行を36,500本作って1リクエスト1秒かかる
const RANGE = 'start_date=2026-01-01&end_date=2026-12-31'

async function setup(): Promise<{ uid: string; version: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: 'パラメータ行の確認用',
    media_id: 1,
  })
  const uid = created.json.ab_test.uid
  const report = await getJson<{ rows: Row[] }>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
  return { uid, version: report.rows[0]?.entity_uid ?? '' }
}

async function track(uid: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  // 本文を読み切る。読まずに次を投げると接続が空くのを待って1回ごとに秒単位で詰まる
  await res.text()
}

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

describe('Branch Operation の広告パラメータ行', () => {
  it('Versionの下に、来た広告ごとの行がPVの多い順でぶら下がる', async () => {
    const { uid, version } = await setup()
    for (let i = 0; i < 3; i += 1) {
      await track(uid, { event: 'pv', version, params: ['utm_source=fb', 'utm_medium=paid'] })
    }
    await track(uid, { event: 'pv', version, params: ['utm_source=ig'] })

    const report = await getJson<{ rows: Row[] }>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    const row = report.rows.find((r) => r.entity_uid === version)
    expect(row?.children?.map((c) => `${c.name}:${c.pv}`)).toEqual([
      'utm_medium=paid:3',
      'utm_source=fb:3',
      'utm_source=ig:1',
    ])
  })

  it('クリックもその広告の行に数える', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'pv', version, params: ['utm_source=fb'] })
    await track(uid, { event: 'click', version, params: ['utm_source=fb'] })

    const report = await getJson<{ rows: Row[] }>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    const child = report.rows.find((r) => r.entity_uid === version)?.children?.[0]
    expect(child).toMatchObject({ name: 'utm_source=fb', pv: 1, click: 1 })
  })

  it('レポート設定で Branch Operation をOFFにしたパラメータは出ない', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'pv', version, params: ['utm_source=fb', 'utm_term=abc'] })
    await sendJson('PUT', `${server.api}/ab_tests/${uid}/parameter_scopes`, {
      parameter_scopes: [{ name: 'utm_term', branch_operation: false }],
    })

    const report = await getJson<{ rows: Row[] }>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    const names = report.rows.find((r) => r.entity_uid === version)?.children?.map((c) => c.name)
    expect(names).toEqual(['utm_source=fb'])
  })

  /**
   * 広告パラメータごとの集計を heatmapStats に足した副作用で、
   * FVER/SVER/OAR の母数（hm_pv）が合算＋広告ぶんの二重計上になっていた。
   */
  it('離脱率の母数は合算だけを数える（広告ごとの行と二重に足さない）', async () => {
    const { uid, version } = await setup()
    const bands = 4
    // 広告が3つ付いた表示＝合算1行＋広告3行。付いていない表示＝合算1行だけ。
    // 二重に足すと、広告の多い表示だけが重く数えられて率が狂う。
    await track(uid, {
      event: 'heatmap', version, bands, reach: [1, 0, 0, 0], exit_band: 0, fv: 1,
      params: ['utm_source=fb', 'utm_medium=paid', 'utm_term=abc'],
    })
    await track(uid, {
      event: 'heatmap', version, bands, reach: [1, 1, 1, 1], exit_band: 3, fv: 1,
    })

    const report = await getJson<{ rows: Row[] }>(
      `${server.api}/ab_tests/${uid}/reports?${RANGE}`,
    )
    // 表示2回のうち1回がファーストビュー離脱 → 50%（二重計上だと 4/5＝80%になる）
    expect(report.rows.find((r) => r.entity_uid === version)?.fver).toBe(0.5)
  })

  it('広告ごとの行にも離脱率が出る（その広告で来た表示だけを数える）', async () => {
    const { uid, version } = await setup()
    const bands = 4
    await track(uid, {
      event: 'heatmap', version, bands, reach: [1, 1, 1, 1], exit_band: 3, fv: 1,
      params: ['utm_source=fb'],
    })
    await track(uid, {
      event: 'heatmap', version, bands, reach: [1, 0, 0, 0], exit_band: 0, fv: 1,
      params: ['utm_source=ig'],
    })

    const report = await getJson<{ rows: Row[] }>(
      `${server.api}/ab_tests/${uid}/reports?${RANGE}`,
    )
    const children = report.rows.find((r) => r.entity_uid === version)?.children ?? []
    expect(children.find((c) => c.name === 'utm_source=fb')?.fver).toBe(0)
    expect(children.find((c) => c.name === 'utm_source=ig')?.fver).toBe(1)
  })

  it('広告パラメータが来ていないVersionには行がぶら下がらない', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'pv', version })

    const report = await getJson<{ rows: Row[] }>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    expect(report.rows.find((r) => r.entity_uid === version)?.children).toEqual([])
  })
})
