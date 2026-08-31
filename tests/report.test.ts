/**
 * レポートタブ／ヒートマップ画面の純粋関数と、モックAPIの契約テスト。
 *
 * 環境は node（jsdom 無し）なので、DOMを触る部分はテストせず、
 * 「採取した実HTMLから何を取り出すか」「どの数値をどう表示するか」
 * 「どのリクエストを作るか」だけを純粋関数に切り出して検証する（共通指示 §5）。
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  extractCapturedAbTestUid,
  stripShellFromFragment,
  toHashHref,
} from '../src/app/pages/report-substrate.ts'
import {
  DAILY_LABEL_COLUMN,
  REPORT_COLUMNS,
  UNDEFINED_METRIC_LABELS,
  formatCell,
} from '../src/app/pages/report-columns.ts'
import { DATE_PRESET_VALUES, resolvePreset } from '../src/app/pages/report-period.ts'
import {
  buildThemeSwap,
  extractThemeTokens,
  swapClassName,
} from '../src/app/pages/report-theme.ts'
import { HEATMAP_SORT_KEYS, sortVersions } from '../src/app/pages/heatmap-sort.ts'
import { dailyKpiSeries } from '../mock-server/store/report-aggregate.ts'
import { deriveKpi, sumKpi } from '../mock-server/store/metrics.ts'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

const REPORT_FRAGMENT = 'src/app/fragments/ab_tests__UID__reports__default.html'
const HEATMAP_FRAGMENT =
  'src/app/fragments/ab_tests__UID__articles__htmls__heatmaps__comparisons__default.html'

const reportHtml = readFileSync(REPORT_FRAGMENT, 'utf8')
const heatmapHtml = readFileSync(HEATMAP_FRAGMENT, 'utf8')

describe('採取した実ページ断片から、シェルを除いた本体だけを取り出す', () => {
  it('サイドバー（list-menu-item を含む先頭要素）を落とす', () => {
    const body = stripShellFromFragment(reportHtml)
    expect(body).not.toContain('list-menu-item')
    expect(body).toContain('_abTestReportWrapper_')
  })

  it('ヒートマップ側も同じ規則で本体だけになる', () => {
    const body = stripShellFromFragment(heatmapHtml)
    expect(body).not.toContain('list-menu-item')
    expect(body).toContain('_heatmapList_')
  })

  it('サイドバーが無い断片はそのまま返す', () => {
    expect(stripShellFromFragment('<div class="x">a</div>')).toBe('<div class="x">a</div>')
  })

  it('採取時の ab_test uid を断片から読み取る（ソースへ転記しない）', () => {
    const uid = extractCapturedAbTestUid(reportHtml)
    expect(uid).not.toBeNull()
    expect(reportHtml).toContain(`/ab_tests/${uid as string}/articles/htmls/heatmaps/comparisons`)
  })

  it('採取リンクをクローンのハッシュルートへ差し替える（uidは今のページのものに置換）', () => {
    expect(toHashHref('/ab_tests/CAPTURED/reports?start_date=2026-08-31', 'CAPTURED', 'NOW')).toBe(
      '#/ab_tests/NOW/reports?start_date=2026-08-31',
    )
    expect(
      toHashHref('/ab_tests/CAPTURED/articles/htmls/heatmaps/comparisons', 'CAPTURED', 'NOW'),
    ).toBe('#/ab_tests/NOW/articles/htmls/heatmaps/comparisons')
  })

  it('外部リンク（クローンの外）は null を返し、遷移させない', () => {
    expect(toHashHref('example.test/faq/hs_204866591886', 'CAPTURED', 'NOW')).toBeNull()
    expect(toHashHref('', 'CAPTURED', 'NOW')).toBeNull()
  })
})

/** デイリーレポート表のヘッダを採取HTMLから直接読む（コードと採取物のズレを検出する） */
function capturedDailyHeaderLabels(): string[] {
  const from = reportHtml.indexOf('css-19dzzwp')
  const to = reportHtml.indexOf('</thead>', from)
  const thead = reportHtml.slice(from, to)
  return [...thead.matchAll(/class="[^"]*css-s30xpk"[^>]*>([^<]*)</g)].map((m) => (m[1] ?? '').trim())
}

describe('デイリーレポートの列は採取した実ヘッダと一致する', () => {
  it('13指標が採取順で並んでいる', () => {
    expect(REPORT_COLUMNS.map((c) => c.label)).toEqual(capturedDailyHeaderLabels())
  })

  it('先頭は指標ではないラベル列（合計 / 日付）', () => {
    expect(DAILY_LABEL_COLUMN).toBe('合計')
  })

  it('metrics.ts の恒等式に無い7指標は formula を持たない', () => {
    expect(UNDEFINED_METRIC_LABELS).toEqual(['CTR', 'CTVR', 'MCPA', 'FVER', 'SVER', 'FSVER', 'OAR'])
    for (const label of UNDEFINED_METRIC_LABELS) {
      expect(REPORT_COLUMNS.find((c) => c.label === label)?.metric).toBeNull()
    }
  })

  it('metrics.ts が定義する6指標だけが DerivedKpi のキーに割り当たっている', () => {
    expect(
      REPORT_COLUMNS.filter((c) => c.metric !== null).map((c) => `${c.label}=${c.metric as string}`),
    ).toEqual([
      '配信金額=ad_cost',
      'PV=pv',
      'CLICK=click',
      'CV=cv',
      'CVR=cvr',
      'CPA=cpa',
    ])
  })
})

describe('セルの表示（§10-5「ゼロ除算は - 表示」）', () => {
  const zero = deriveKpi({ pv: 0, click: 0, cv: 0, ad_cost: 0 })
  const some = deriveKpi({ pv: 1000, click: 200, cv: 10, ad_cost: 40000 })

  it('計算式が無い指標は常に「-」（勝手に定義しない）', () => {
    for (const label of UNDEFINED_METRIC_LABELS) {
      const column = REPORT_COLUMNS.find((c) => c.label === label)
      expect(column).toBeDefined()
      expect(formatCell(some, column as (typeof REPORT_COLUMNS)[number])).toBe('-')
    }
  })

  it('ゼロ除算で null になる指標は「-」', () => {
    const cvr = REPORT_COLUMNS.find((c) => c.label === 'CVR')
    expect(formatCell(zero, cvr as (typeof REPORT_COLUMNS)[number])).toBe('-')
  })

  it('件数はそのまま、金額は桁区切り、率は百分率2桁', () => {
    const pv = REPORT_COLUMNS.find((c) => c.label === 'PV')
    const cost = REPORT_COLUMNS.find((c) => c.label === '配信金額')
    const cvr = REPORT_COLUMNS.find((c) => c.label === 'CVR')
    expect(formatCell(some, pv as (typeof REPORT_COLUMNS)[number])).toBe('1,000')
    expect(formatCell(some, cost as (typeof REPORT_COLUMNS)[number])).toBe('40,000')
    expect(formatCell(some, cvr as (typeof REPORT_COLUMNS)[number])).toBe('5.00')
  })
})

describe('期間プリセット（採取した select の option value）', () => {
  const today = new Date(2026, 7, 31) // 2026-08-31

  it('採取物にある option value を全部知っている', () => {
    expect([...DATE_PRESET_VALUES]).toEqual([
      'today',
      'yesterday',
      'seven_days',
      'last_three_days',
      'last_seven_days',
    ])
  })

  it('今日 / 昨日', () => {
    expect(resolvePreset('today', today)).toEqual({
      startDate: '2026-08-31',
      endDate: '2026-08-31',
    })
    expect(resolvePreset('yesterday', today)).toEqual({
      startDate: '2026-08-30',
      endDate: '2026-08-30',
    })
  })

  it('過去N日間は「今日を含むN日」（lib/query.ts の既定期間と同じ数え方）', () => {
    expect(resolvePreset('last_three_days', today)).toEqual({
      startDate: '2026-08-29',
      endDate: '2026-08-31',
    })
    expect(resolvePreset('last_seven_days', today)).toEqual({
      startDate: '2026-08-25',
      endDate: '2026-08-31',
    })
  })

  it('「7日間」は数え方が採取物から判別できないので解決しない（推測で埋めない）', () => {
    expect(resolvePreset('seven_days', today)).toBeNull()
  })

  it('未知の値は解決しない', () => {
    expect(resolvePreset('', today)).toBeNull()
    expect(resolvePreset('none', today)).toBeNull()
  })
})

/**
 * 配線が前提にしている目印が、採取物に**実在するか**を機械で確かめる。
 * 環境が node なのでDOMは組めないが、採取物が差し替わったら（実際に匿名化が再実行された）
 * ここが落ちて気付ける。
 */
describe('採取物に、配線が前提にしている目印が実在する', () => {
  function tableSlice(marker: string): { thead: string; tbody: string } {
    const from = reportHtml.indexOf(marker)
    const table = reportHtml.slice(from, reportHtml.indexOf('</table>', from))
    return {
      thead: table.slice(0, table.indexOf('</thead>')),
      tbody: table.slice(table.indexOf('<tbody')),
    }
  }

  it('見出し（h3）でMUIカードを特定できる', () => {
    expect([...reportHtml.matchAll(/<h3[^>]*>([^<]*)</g)].map((m) => m[1])).toEqual([
      'デイリーレポート',
      'Branch Operation',
    ])
  })

  it('クリエイティブ / ファネルはセクションタイトルで特定できる', () => {
    for (const title of ['クリエイティブ', 'ファネル']) {
      expect(reportHtml).toMatch(new RegExp(`class="_title_[^"]*">${title}<`))
    }
    // 親は CSS Modules の `_reportWrapper_`（closest() で辿る先）
    expect((reportHtml.match(/class="_reportWrapper_/g) ?? []).length).toBe(2)
  })

  it('デイリーレポート表は 13指標 ＋ ラベル列、テンプレート行は 合計 と 日付 の2行', () => {
    const { thead, tbody } = tableSlice('css-19dzzwp')
    // `<thead` も `<th` に一致するので1つ引く
    expect((thead.match(/<th[ >]/g) ?? []).length).toBe(REPORT_COLUMNS.length + 1)
    expect((tbody.match(/<tr[ >]/g) ?? []).length).toBe(2)
    expect((tbody.match(/<td[ >]/g) ?? []).length).toBe((REPORT_COLUMNS.length + 1) * 2)
    expect(tbody).toContain(`>${DAILY_LABEL_COLUMN}<`)
  })

  it('Branch Operation 表は タイトル ＋ 13指標 ＋ 配信', () => {
    const { thead, tbody } = tableSlice('css-b0orrd')
    expect((thead.match(/<th[ >]/g) ?? []).length).toBe(REPORT_COLUMNS.length + 2)
    expect((tbody.match(/<tr[ >]/g) ?? []).length).toBe(2)
  })

  it('期間入力は 開始日/終了日 が2組（デイリー・Branch Operation）', () => {
    const editable = [...reportHtml.matchAll(/<input[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => tag.includes('type="text"') && !tag.includes('readonly'))
    expect(editable.length).toBe(4)
  })

  it('折れ線は Recharts（＝クローンに無い依存。入れずに報告する）', () => {
    expect(reportHtml).toContain('recharts-responsive-container')
    expect(reportHtml).toContain('recharts-surface')
  })

  it('Branch Operation の追加フィルタは MuiCollapse で閉じている', () => {
    expect(reportHtml).toContain('MuiCollapse-hidden')
  })

  it('レポート → ヒートマップ の遷移はサブナビのアンカー', () => {
    const uid = extractCapturedAbTestUid(reportHtml) as string
    const nav = reportHtml.slice(
      reportHtml.indexOf('_navWrapper_8ygjt_1'),
      reportHtml.indexOf('_mediaSummary_'),
    )
    expect(nav).toContain(`href="/ab_tests/${uid}/reports?`)
    expect(nav).toContain(`href="/ab_tests/${uid}/articles/htmls/heatmaps/comparisons"`)
    expect(nav).toContain('>レポート<')
    expect(nav).toContain('>ヒートマップ<')
  })

  it('ヒートマップ画面は Version1件がテンプレート、ヒートマップ一覧は空', () => {
    expect((heatmapHtml.match(/<li class="_content_/g) ?? []).length).toBe(1)
    expect(heatmapHtml).toMatch(/<ul class="_heatmapList_[^"]*"><\/ul>/)
  })

  it('ヒートマップの並び替え select は PV/CLICK/CTR/CV/CVR', () => {
    const values = [...heatmapHtml.matchAll(/<option value="(\w+)">/g)].map((m) => m[1])
    expect(values.slice(0, 5)).toEqual(['pv', 'click', 'ctr', 'cv', 'cvr'])
  })
})

describe('レポート画面のテーマ切替（採取CSSに light/dark 両方がある）', () => {
  const css = readFileSync('capture/clean/ab_tests__UID__reports/default/cssom.css', 'utf8')

  it('採取CSSから dark/light のクラス対を拾う', () => {
    const tokens = extractThemeTokens(css)
    expect(tokens).toContain('_darkTheme_kli2w_24')
    expect(tokens).toContain('_lightTheme_kli2w_20')
    expect(tokens).toContain('_dark_8ygjt_94')
    expect(tokens).toContain('_light_8ygjt_91')
  })

  it('同じCSSモジュール（ハッシュ）同士で dark↔light を対応づける', () => {
    const swap = buildThemeSwap(extractThemeTokens(css))
    expect(swap.toLight.get('_darkTheme_kli2w_24')).toBe('_lightTheme_kli2w_20')
    expect(swap.toDark.get('_lightTheme_kli2w_20')).toBe('_darkTheme_kli2w_24')
    expect(swap.toLight.get('_dark_8ygjt_94')).toBe('_light_8ygjt_91')
  })

  it('class 属性のうち対応のあるトークンだけを差し替える', () => {
    const swap = buildThemeSwap(extractThemeTokens(css))
    expect(swapClassName('_abTestReportWrapper_kli2w_1 _darkTheme_kli2w_24', swap.toLight)).toBe(
      '_abTestReportWrapper_kli2w_1 _lightTheme_kli2w_20',
    )
  })

  it('対応が無いクラスはそのまま（勝手に作らない）', () => {
    const swap = buildThemeSwap(['_darkTheme_zzzzz_1'])
    expect(swap.toLight.size).toBe(0)
    expect(swapClassName('_darkTheme_zzzzz_1 x', swap.toLight)).toBe('_darkTheme_zzzzz_1 x')
  })
})

describe('ヒートマップ画面のVersion並び替え', () => {
  function row(name: string, kpi: Partial<{ pv: number; click: number; cv: number }>) {
    return {
      scope: 'version',
      entity_uid: name,
      name,
      status: '準備中',
      distribution_ratio: 1,
      ...deriveKpi({ pv: 0, click: 0, cv: 0, ad_cost: 0, ...kpi }),
    }
  }

  it('PV / CLICK / CV / CVR は多い順に並ぶ', () => {
    const rows = [row('A', { pv: 1 }), row('B', { pv: 9 }), row('C', { pv: 5 })]
    expect(sortVersions(rows, 'pv')?.map((r) => r.name)).toEqual(['B', 'C', 'A'])
    expect(sortVersions(rows, 'cv')?.map((r) => r.name)).toEqual(['A', 'B', 'C'])
  })

  it('採取した select の option value をそのまま扱う', () => {
    expect([...HEATMAP_SORT_KEYS]).toEqual(['pv', 'click', 'ctr', 'cv', 'cvr'])
  })

  it('CTR は計算式が無いので並べ替えない（null を返す）', () => {
    expect(sortVersions([row('A', { pv: 1 })], 'ctr')).toBeNull()
  })

  it('元の配列を壊さない（イミュータブル）', () => {
    const rows = [row('A', { pv: 1 }), row('B', { pv: 9 })]
    sortVersions(rows, 'pv')
    expect(rows.map((r) => r.name)).toEqual(['A', 'B'])
  })
})

describe('日付別の集計（デイリーレポートの行）', () => {
  it('期間の日数だけ行が出る（両端含む・データが無くても行は出る）', () => {
    const rows = dailyKpiSeries([], '2026-08-29', '2026-08-31')
    expect(rows.map((r) => r.date)).toEqual(['2026-08-29', '2026-08-30', '2026-08-31'])
    expect(rows[0]?.pv).toBe(0)
    expect(rows[0]?.cvr).toBeNull()
  })

  it('日次メトリクスがその日の行に入り、合計は合算後に再計算される', () => {
    const metrics = [
      { entity_uid: 'A', scope: 'ab_test' as const, date: '2026-08-30', pv: 100, click: 50, cv: 5, ad_cost: 10000, sales: 0 },
      { entity_uid: 'A', scope: 'ab_test' as const, date: '2026-08-31', pv: 900, click: 150, cv: 15, ad_cost: 90000, sales: 0 },
    ]
    const rows = dailyKpiSeries(metrics, '2026-08-30', '2026-08-31')
    expect(rows[0]?.pv).toBe(100)
    expect(rows[1]?.pv).toBe(900)
    const total = sumKpi(rows)
    expect(total.pv).toBe(1000)
    expect(total.cvr).toBeCloseTo(20 / 200)
  })

  it('範囲外の日付は無視する', () => {
    const metrics = [
      { entity_uid: 'A', scope: 'ab_test' as const, date: '2026-08-01', pv: 999, click: 1, cv: 1, ad_cost: 1, sales: 0 },
    ]
    expect(sumKpi(dailyKpiSeries(metrics, '2026-08-30', '2026-08-31')).pv).toBe(0)
  })
})

describe('モックAPI: レポート応答に日付別の行がある', () => {
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

  interface ReportResponse {
    rows: { entity_uid: string; name: string; pv: number }[]
    totals: { pv: number; cvr: number | null }
    daily: { date: string; pv: number }[]
    period: { start_date: string; end_date: string }
  }

  async function createAbTest(): Promise<string> {
    const folder = await postJson<{ folder: { id: number } }>(`${server.api}/folders`, {
      name: 'レポート検証用',
    })
    const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
      title: 'レポート検証用ページ',
      folder_id: folder.json.folder.id,
      media_id: null,
      editor_version: 2,
    })
    return created.json.ab_test.uid
  }

  it('daily は期間の日数ぶん返り、合算するとtotalsと一致する', async () => {
    const uid = await createAbTest()
    const report = await getJson<ReportResponse>(
      `${server.api}/ab_tests/${uid}/reports?start_date=2026-08-29&end_date=2026-08-31`,
    )
    expect(report.daily.map((d) => d.date)).toEqual(['2026-08-29', '2026-08-30', '2026-08-31'])
    expect(sumKpi(report.daily.map((d) => deriveKpi({ ...d, ad_cost: 0, click: 0, cv: 0 }))).pv).toBe(
      report.totals.pv,
    )
    expect(report.period).toEqual({ start_date: '2026-08-29', end_date: '2026-08-31' })
  })

  it('Versionごとの行も従来どおり返る（既存契約を壊さない）', async () => {
    const uid = await createAbTest()
    const report = await getJson<ReportResponse>(`${server.api}/ab_tests/${uid}/reports`)
    expect(report.rows.length).toBeGreaterThan(0)
    expect(report.rows[0]?.name).toMatch(/^Ver\./)
  })

  it('存在しないページは404封筒', async () => {
    const res = await fetch(`${server.api}/ab_tests/NOPE/reports`)
    expect(res.status).toBe(404)
  })
})
