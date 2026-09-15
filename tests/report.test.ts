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

  it('13指標すべてに計算式がある（式が無い列はもう無い）', () => {
    // 2026-09-15: CTR/CTVR/MCPA は採取物の aria-label の式どおりに、
    // FVER/SVER/FSVER/OAR は計測タグのスクロール記録から出せるようにした。
    expect(UNDEFINED_METRIC_LABELS).toEqual([])
    for (const label of UNDEFINED_METRIC_LABELS) {
      expect(REPORT_COLUMNS.find((c) => c.label === label)?.metric).toBeNull()
    }
  })

  it('13指標が DerivedKpi のキーに割り当たっている', () => {
    expect(
      REPORT_COLUMNS.filter((c) => c.metric !== null).map((c) => `${c.label}=${c.metric as string}`),
    ).toEqual([
      '配信金額=ad_cost',
      'PV=pv',
      'CLICK=click',
      'CTR=ctr',
      'CV=cv',
      'CVR=cvr',
      'CTVR=ctvr',
      'CPA=cpa',
      'MCPA=mcpa',
      'FVER=fver',
      'SVER=sver',
      'FSVER=fsver',
      'OAR=oar',
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

  it('CTRでも並べ替える（列にCTRの数字を出しているのに並べ替えだけ拒むのは画面内の矛盾）', () => {
    // 2026-09-15: 採取した実DOMの option も他の4つと同格だった
    const sorted = sortVersions([row('A', { pv: 10, click: 1 }), row('B', { pv: 10, click: 5 })], 'ctr')
    expect(sorted?.map((r) => r.name)).toEqual(['B', 'A'])
  })

  it('知らないキーは並べ替えない（null）', () => {
    expect(sortVersions([row('A', { pv: 1 })], '' as never)).toBeNull()
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

/**
 * 2026-09-15。本人指摘「設定部分が触れない」。
 *
 * レポート画面の「広告データ取得日時」と歯車（パラメーター設定）は、採取物では
 * `_dropdown_x4j8w_1`（トリガー＋`_bodyWrapper_x4j8w_8`）の形をしていて、
 * 押すと中身が開く部品。クローンは中身を置いたまま配線していなかったので無反応だった。
 */
describe('レポート画面の採取ドロップダウン', () => {
  const dom = readFileSync('src/app/fragments/ab_tests__UID__reports__default.html', 'utf8')
  const reportDom = readFileSync('src/app/pages/report-dom.ts', 'utf8')

  it('採取物に「広告データ取得日時」の中身がある（推測で作らない）', () => {
    expect(dom).toContain('広告データ取得日時')
    expect(dom).toContain('beyondページ 広告データ取得日時')
    expect(dom).toContain('※ 配信金額、クリエイティブ画像/テキストを取得しています')
  })

  it('歯車は「パラメーター設定」のトリガー', () => {
    expect(dom).toContain('パラメーター設定')
    expect(dom).toContain('_triggerDescription_wn8sv_8')
  })

  it('名札だけの面（歯車の「パラメーター設定」）はホバーで出す＝押した結果として出さない', () => {
    // 2026-09-15 本人指摘: 実物は押すとパラメーター設定の画面が開く。名札はホバーの吹き出し。
    expect(reportDom).toContain('_triggerDescription_')
    expect(reportDom).toContain('mouseenter')
    // 開く先が採取できていないことを、黙って握りつぶさず伝える
    expect(reportDom).toContain('まだ採取していない')
  })

  it('採取ドロップダウンを開閉する配線がある', () => {
    expect(reportDom).toContain('export function wireCapturedDropdowns')
    // 開閉は採取CSSのクラスをそのまま使う（手書きしない）
    expect(reportDom).toContain('PANEL_OPEN_CLASS')
    // 採取物のクラス名を目印にする（ハッシュ付きなので前方一致で掴む）
    expect(reportDom).toContain('_trigger_x4j8w_')
  })

  it('レポートとヒートマップの両方で配線する', () => {
    for (const file of ['src/app/pages/report.ts', 'src/app/pages/heatmap.ts']) {
      expect(readFileSync(file, 'utf8'), file).toContain('wireCapturedDropdowns')
    }
  })
})

/**
 * 2026-09-15。本人指示「実際のページを参照した上で修正」。
 * 採取した実DOMの列見出しには **計算式そのものが aria-label に書かれている**。
 * 推測で決めていた定義を、その記述に合わせる。
 */
describe('指標の計算式（採取物の記述に合わせる）', () => {
  const dom = readFileSync('src/app/fragments/ab_tests__UID__reports__default.html', 'utf8')

  it('採取物に計算式が書いてある（この事実が根拠）', () => {
    expect(dom).toContain('aria-label="クリックあたりの費用 = 配信金額 / CLICK"')
    expect(dom).toContain('aria-label="コンバージョン率 = CV / CLICK"')
    expect(dom).toContain('aria-label="CV / PV"')
  })

  it('MCPA = 配信金額 / CLICK（媒体CVで割っていたのは誤り）', () => {
    const kpi = deriveKpi({ pv: 100, click: 20, cv: 5, ad_cost: 10000, media_cv: 2 })
    expect(kpi.mcpa).toBe(500)
  })

  it('CLICKが0なら MCPA は「-」（0除算）', () => {
    const kpi = deriveKpi({ pv: 10, click: 0, cv: 0, ad_cost: 1000 })
    expect(kpi.mcpa).toBeNull()
  })

  it('CVR = CV / CLICK ／ CTVR = CV / PV（こちらは元から合っている）', () => {
    const kpi = deriveKpi({ pv: 100, click: 20, cv: 5, ad_cost: 10000 })
    expect(kpi.cvr).toBeCloseTo(0.25)
    expect(kpi.ctvr).toBeCloseTo(0.05)
  })
})

/**
 * 2026-09-15。ヒートマップを採取物と突き合わせて見つかった配線の不具合。
 */
describe('ヒートマップの配線（採取物と突き合わせ）', () => {
  const src = readFileSync('src/app/pages/heatmap.ts', 'utf8')
  const dom = readFileSync(
    'src/app/fragments/ab_tests__UID__articles__htmls__heatmaps__comparisons__default.html',
    'utf8',
  )

  it('並び替えてもチェックの配線と選択状態を保つ', () => {
    // 以前は renderVersionList(root, sorted) と第3引数を落としていたため、
    // 並び替えたあとチェックしても列が増えず、選んでいた列も消えていた
    expect(src).not.toContain('renderVersionList(root, sorted)')
    expect(src).toContain('renderVersionList(root, sorted, onToggle')
  })

  it('「全ページ表示」が選ばれているかを見る（どちらが選択中かを見ていなかった）', () => {
    expect(dom).toContain('全ページ表示')
    expect(src).toContain("'全ページ表示'")
    expect(src).not.toContain("root.querySelector('[class*=\"_selectHeightType_\"] [class*=\"_active_\"]') !== null")
  })

  it('アーカイブの絞り込みを配線する（Versionはアーカイブ状態を持っている）', () => {
    expect(dom).toContain('アーカイブ無し')
    expect(src).toContain('archived')
    // 「持たせていないため未配線」という古い注記は残さない
    expect(src).not.toContain('アーカイブ状態を持たせていないため未配線')
  })

  it('CTRでも並び替えられる（列見出しにはCTRの数字を出しているのに並べ替えは拒んでいた）', () => {
    const sort = readFileSync('src/app/pages/heatmap-sort.ts', 'utf8')
    expect(sort).not.toContain("if (key === 'ctr') return null")
  })

  it('「全ページ表示」を実際に使う（受け取るだけで捨てていた）', () => {
    const cols = readFileSync('src/app/pages/heatmap-columns.ts', 'utf8')
    expect(cols).toContain("deps.fullPage ? 'hm-cols full'")
    expect(cols).toContain('.hm-cols.full .hm-col-body')
  })

  it('選択したVersionには採取物の `_checked_` を付ける', () => {
    // 採取DOMは初期状態（どれも未チェック）なので、根拠は採取CSS側にある
    const css = readFileSync(
      'capture/clean/ab_tests__UID__articles__htmls__heatmaps__comparisons/default/cssom.css',
      'utf8',
    )
    expect(css).toContain('_checked_1vzzn_155')
    expect(src).toContain('_checked_')
  })
})

/**
 * 2026-09-15。FVER / SVER / FSVER / OAR を実測から出すために、計測タグが送る情報を足した。
 */
describe('計測タグが送るスクロールの記録', () => {
  const tag = readFileSync('src/shared/tracking-tag.ts', 'utf8')

  it('「画面1枚ぶんが何バンドか」を送る（ファーストビューの範囲を決める材料）', () => {
    expect(tag).toContain('fv:')
  })

  it('「最初の計測リンクが何バンド目か」を送る（オファー到達率の材料）', () => {
    expect(tag).toContain('offer:')
    // 計測リンク＝sb_tracking=true が付いたリンク（クリック計測と同じ判定）
    expect(tag).toContain('sb_tracking=true')
  })

  it('離脱したバンドも送り続ける（今の集計を壊さない）', () => {
    expect(tag).toContain('exit_band:')
  })
})

describe('ヒートマップの列は選んだ指標で中身が変わる', () => {
  const cols = readFileSync('src/app/pages/heatmap-columns.ts', 'utf8')

  it('離脱 / CLICK を選ぶと、その指標の面を描く（3つとも同じ絵にしない）', () => {
    // 以前は列ごとのセレクトだけで決まり、左で選んだ指標（spec.metric）を捨てていた
    expect(cols).toContain('defaultModeFor')
    expect(cols).toContain("case 'exit'")
    expect(cols).toContain("case 'click'")
  })

  it('CVは縦位置の記録が無いことを正直に出す（0を描いて誤解させない）', () => {
    expect(cols).toContain('CVは画面のどこで起きたかを記録していません')
  })

  it('指標ごとの色は実測どおり（離脱=赤 / CLICK=青 / CV=緑）', () => {
    // 採取CSS: _tab_._checked_ = rgb(208,83,83) / :nth-of-type(2) = rgb(0,134,255) /
    //           :last-of-type = rgb(6,214,160)
    const css = readFileSync(
      'capture/clean/ab_tests__UID__articles__htmls__heatmaps__comparisons/default/cssom.css',
      'utf8',
    )
    expect(css).toContain('rgb(208, 83, 83)')
    expect(cols).toContain('METRIC_HUE')
  })

  it('採取物に無い表記を「実物どおり」と書かない', () => {
    expect(cols).not.toContain('実物の select の value と表記をそのまま使う')
  })
})

describe('ヒートマップのソートモーダルと期間', () => {
  const src = readFileSync('src/app/pages/heatmap.ts', 'utf8')
  const dom = readFileSync(
    'src/app/fragments/ab_tests__UID__articles__htmls__heatmaps__comparisons__default.html',
    'utf8',
  )

  it('採取物の9択がそのまま並ぶ', () => {
    for (const label of ['手動', 'Versionの新しい順', 'PVの多い順', 'CVの少ない順']) {
      expect(dom, label).toContain(label)
    }
  })

  it('選んだ並び順で列を並べ替える（以前はラジオの排他だけで何も起きなかった）', () => {
    expect(src).toContain('sortColumnSpecs')
    expect(src).not.toContain('表示できるヒートマップが無いので見た目は変わらない')
  })

  it('期間を変えられる（読み取り専用の表示だけだった）', () => {
    expect(src).toContain('wireRangeInputs')
  })
})
