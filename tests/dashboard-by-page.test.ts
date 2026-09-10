/**
 * ダッシュボードの「各ページ」内訳（`by_ab_test`）の機械証明。
 *
 * 画面は「全体」と「各ページ」を並べて出すので、**足し算が合っていること**が命。
 * 合わないと、どちらの数字を信じればいいのか分からない画面になる。
 * ここで「各ページの合計 === 全体」を固定する。
 *
 * 期間外・別スコープ（Version）の数値が混ざらないことも合わせて見る。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, startTestServer, type TestServer } from './helpers/server.ts'
import { createAbTest, createFolder } from '../mock-server/store/actions.ts'
import { resetState, setState } from '../mock-server/store/store.ts'
import type { DailyMetric } from '../mock-server/store/types.ts'

interface Kpi {
  pv: number
  click: number
  cv: number
  ad_cost: number
  sales: number
}
interface PageRow extends Kpi {
  uid: string
  title: string
  folder_name: string | null
}
interface DashboardResponse {
  kpi: Kpi
  by_ab_test: PageRow[]
}

let server: TestServer

beforeAll(async () => {
  server = await startTestServer()
})
afterAll(async () => {
  await server.close()
})
beforeEach(() => {
  resetState()
})

function metric(entityUid: string, scope: DailyMetric['scope'], date: string, kpi: Kpi): DailyMetric {
  return { entity_uid: entityUid, scope, date, imp: 0, media_click: 0, media_cv: 0, ...kpi }
}

/** フォルダ1件に beyondページ2件。数値は期間の内・外・別スコープを混ぜて置く。 */
function seed(): { first: string; second: string } {
  let first = ''
  let second = ''
  setState((state) => {
    const folder = createFolder(state, { name: 'サンプルフォルダ001', parent_id: null })
    const a = createAbTest(folder.state, {
      title: 'サンプル施策001',
      memo: '',
      folder_id: folder.folder.id,
      media_id: 3,
    })
    const b = createAbTest(a.state, {
      title: 'サンプル施策002',
      memo: '',
      folder_id: folder.folder.id,
      media_id: 3,
    })
    first = a.abTest.uid
    second = b.abTest.uid
    const versionUid = b.state.versions[0]?.uid ?? 'VERSION_0001'
    return {
      ...b.state,
      metrics: [
        metric(first, 'ab_test', '2026-09-05', { pv: 100, click: 10, cv: 1, ad_cost: 1000, sales: 8000 }),
        metric(first, 'ab_test', '2026-09-06', { pv: 50, click: 5, cv: 0, ad_cost: 500, sales: 0 }),
        metric(second, 'ab_test', '2026-09-06', { pv: 20, click: 2, cv: 1, ad_cost: 300, sales: 8000 }),
        // 期間外（末日の翌日）は入ってはいけない
        metric(first, 'ab_test', '2026-09-08', { pv: 999, click: 99, cv: 9, ad_cost: 9999, sales: 99999 }),
        // Version スコープはページの数値ではない
        metric(versionUid, 'version', '2026-09-06', { pv: 777, click: 77, cv: 7, ad_cost: 7777, sales: 77777 }),
      ],
    }
  })
  return { first, second }
}

const RANGE = 'start_date=2026-09-05&end_date=2026-09-07'

describe('ダッシュボードの各ページ内訳', () => {
  it('各ページの合計が全体KPIと一致する（画面で2つ並べても矛盾しない）', async () => {
    seed()
    const data = await getJson<DashboardResponse>(`${server.api}/teams/dashboard?${RANGE}`)
    const sum = (key: keyof Kpi): number =>
      data.by_ab_test.reduce((total, row) => total + row[key], 0)
    for (const key of ['pv', 'click', 'cv', 'ad_cost', 'sales'] as const) {
      expect(sum(key), `${key} の合計が全体と合っていない`).toBe(data.kpi[key])
    }
  })

  it('数値のあったページだけが、ページ名とフォルダ名つきで並ぶ', async () => {
    const { first, second } = seed()
    const data = await getJson<DashboardResponse>(`${server.api}/teams/dashboard?${RANGE}`)
    expect(data.by_ab_test.map((r) => r.uid).sort()).toEqual([first, second].sort())
    for (const row of data.by_ab_test) {
      expect(row.title).not.toBe('')
      expect(row.folder_name).toBe('サンプルフォルダ001')
    }
  })

  it('PVの多い順に並ぶ（上から見れば効いているページが分かる）', async () => {
    seed()
    const data = await getJson<DashboardResponse>(`${server.api}/teams/dashboard?${RANGE}`)
    const pvs = data.by_ab_test.map((r) => r.pv)
    expect(pvs).toEqual([...pvs].sort((a, b) => b - a))
    expect(pvs[0]).toBe(150) // 100 + 50（期間内2日ぶんが足されている）
  })

  it('期間外の数値もVersionスコープの数値も混ざらない', async () => {
    seed()
    const data = await getJson<DashboardResponse>(`${server.api}/teams/dashboard?${RANGE}`)
    expect(data.kpi.pv).toBe(170)
    for (const row of data.by_ab_test) {
      expect(row.pv).not.toBe(999)
      expect(row.pv).not.toBe(777)
    }
  })

  it('数値が1件も無ければ空配列（行を捏造しない）', async () => {
    const data = await getJson<DashboardResponse>(`${server.api}/teams/dashboard?${RANGE}`)
    expect(data.by_ab_test).toEqual([])
  })
})
