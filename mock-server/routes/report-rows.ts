/**
 * レポートの行・合計・日別を組み立てる（ab-tests-reports.ts から分離・2026-09-24）。
 *
 * 【配信金額はページ単位】媒体の配信金額（Meta・CSV）はページ（ab_test）にしか入らない。
 *  - 合計と日別は、アーカイブの絞り込みに関係なく**ページ全体**
 *    （配信金額と、Version に紐づかない外部LPの計測を含む）。アーカイブの絞り込みは行だけに効く。
 *    以前は Version を1本アーカイブしただけで合計が Version の数字だけに切り替わり、
 *    配信金額 ¥0・CPA「-」になり、外部LPの PV/CV も消えていた（点検22）。
 *  - Version の行・広告パラメータの行の配信金額は「分からない」（cost_known:false）。
 *    ¥0 と言うと「お金をかけずにCVした」ように読めるので、CPA・MCPA・ROAS・ROI も出さない。
 *  - Version を選んで絞ったときは、LP の数字はその Version・配信金額はページ全体のまま。
 *    ページ全体の費用を一部の CV で割ると CPA が狂うので、そのあいだ CPA などは出さない（filtered_by で画面が断る）。
 *
 * 【端末で絞る】2026-09-24 から表示・クリック・CV・スクロールを端末ごとにも記録している（点検29）。
 *  端末で絞ると、行・合計・日別の LP の数字はその端末のぶん（store/device-metrics.ts）。配信金額は端末ごとに
 *  分からないのでページ全体のまま（CPAは出さない）。記録を始める前の日は0なので device_since を返して画面が断る。
 */
import { deriveKpi, isWithin, sumPrimary, type DerivedKpi } from '../store/metrics.ts'
import { dailyKpiSeries } from '../store/report-aggregate.ts'
import { dateRangeParams } from '../lib/query.ts'
import { scrollCounts, scrollCountsForAbTest } from '../store/scroll-counts.ts'
import { botHitCount } from '../store/bot-hits.ts'
import { speedSummary } from '../store/page-speed.ts'
import { parameterNameOf, parameterScopesOf } from '../store/parameter-scopes.ts'
import { deviceDailyMetrics, withDeviceHeatmap } from '../store/device-metrics.ts'
import type { DailyMetric, DeviceKind, State } from '../store/types.ts'

/**
 * LP 側の実測をどこから読むか。全端末なら日次メトリクス、端末で絞れば端末ごとの記録。
 * スクロールの記録も同じく差し替える（scrollState を scroll-counts.ts にそのまま渡す）。
 */
interface LpView {
  /** その入れ物のうち、期間内・scope が合う行 */
  metrics: (scope: DailyMetric['scope'], entityUid: (uid: string) => boolean) => DailyMetric[]
  scrollState: State
}

function lpViewOf(state: State, device: DeviceKind | null, startDate: string, endDate: string): LpView {
  if (device === null) {
    return {
      metrics: (scope, entityUid) =>
        state.metrics.filter(
          (m) => m.scope === scope && entityUid(m.entity_uid) && isWithin(m.date, startDate, endDate),
        ),
      scrollState: state,
    }
  }
  return {
    metrics: (scope, entityUid) =>
      scope === 'ab_test' || scope === 'version' || scope === 'parameter'
        ? deviceDailyMetrics(state, { device, scope, start: startDate, end: endDate, entityUid })
        : [],
    scrollState: withDeviceHeatmap(state, device),
  }
}

/** 配信金額が分からない行（Version・広告）では、費用を使う指標を出さない */
function withoutCost<T extends DerivedKpi>(kpi: T): T & { cost_known: false } {
  return { ...kpi, cpa: null, mcpa: null, roas: null, roi: null, cost_known: false }
}

/** その行に本当の配信金額が入っているか（今は取り込みがページ単位なので、ふつうは入っていない） */
function hasCost(metrics: readonly DailyMetric[]): boolean {
  return metrics.some((m) => m.ad_cost > 0 || m.media_sources !== undefined)
}

function rowKpi(metrics: readonly DailyMetric[], scroll: ReturnType<typeof scrollCounts>): DerivedKpi & { cost_known: boolean } {
  const kpi = deriveKpi({ ...sumPrimary(metrics), ...scroll })
  return hasCost(metrics) ? { ...kpi, cost_known: true } : withoutCost(kpi)
}

/**
 * Version の下にぶら下がる広告パラメータの行（実物の Branch Operation）。
 *
 * 材料は `scope:'parameter'` の日次メトリクス（entity_uid は `<versionUid>|utm_source=fb`）。
 * レポート設定で、その一覧（Branch Operation / クリエイティブ）をOFFにした名前は出さない。並びはPVの多い順。
 */
function parameterRows(
  state: State,
  view: LpView,
  abTestUid: string,
  versionUid: string,
  startDate: string,
  endDate: string,
  list: 'branch_operation' | 'creative',
) {
  // レポート設定の列はそれぞれ自分の一覧だけを決める（2026-09-24。以前は Branch Operation の列が
  // クリエイティブの一覧まで決めていて、クリエイティブの列は保存されるだけだった）
  const shown = new Set(
    parameterScopesOf(state, abTestUid)
      .filter((row) => row[list])
      .map((row) => row.name),
  )
  const prefix = `${versionUid}|`
  const byParam = new Map<string, DailyMetric[]>()
  const keep = (param: string): boolean => shown.has(parameterNameOf(param))
  for (const metric of view.metrics('parameter', (uid) => uid.startsWith(prefix))) {
    const param = metric.entity_uid.slice(prefix.length)
    if (!keep(param)) continue
    byParam.set(param, [...(byParam.get(param) ?? []), metric])
  }
  // 表示・クリックが記録されていなくても、スクロールの記録だけ来ている広告がある
  // （計測タグは離脱時にまとめて送るので、順番によってはこちらが先に入る）。
  for (const stat of view.scrollState.heatmapStats) {
    const param = stat.param ?? ''
    if (param === '' || stat.version_uid !== versionUid) continue
    if (!isWithin(stat.date, startDate, endDate)) continue
    if (!keep(param) || byParam.has(param)) continue
    byParam.set(param, [])
  }
  return [...byParam.entries()]
    .map(([param, metrics]) => ({
      scope: 'parameter' as const,
      entity_uid: `${versionUid}|${param}`,
      name: param,
      status: '',
      distribution_ratio: 0,
      archived: false,
      ...rowKpi(metrics, scrollCounts(view.scrollState, versionUid, startDate, endDate, param)),
    }))
    .sort((a, b) => b.pv - a.pv || a.name.localeCompare(b.name))
}

/**
 * レポート画面いちばん上の絞り込み（Version / アーカイブ / 端末）。
 * 採取物の既定は 指定なし / アーカイブ済みを除く / 全端末。
 */
export interface TopFilter {
  /** Versionのuid。'' ＝指定なし */
  version: string
  archive: 'except_archived' | 'all'
  /** '0' ＝全端末 */
  device: '0' | 'sp' | 'tablet' | 'pc'
}

export function topFilterOf(query: unknown): TopFilter {
  const q = (query ?? {}) as Record<string, unknown>
  const str = (key: string): string => (typeof q[key] === 'string' ? (q[key] as string) : '')
  const device = str('device')
  return {
    version: str('version'),
    archive: str('archive') === 'all' ? 'all' : 'except_archived',
    device: device === 'sp' || device === 'tablet' || device === 'pc' ? device : '0',
  }
}

function keepVersion(
  version: { uid: string; archived?: boolean; device_targets?: { sp: boolean; tablet: boolean; pc: boolean } },
  filter: TopFilter,
): boolean {
  if (filter.version !== '' && version.uid !== filter.version) return false
  if (filter.archive === 'except_archived' && version.archived === true) return false
  if (filter.device === '0') return true
  // 端末の設定が無いVersionは「全端末に出す」扱い
  // （持っていないことを「出さない」と読むと、設定していないだけの行が消える）
  const targets = version.device_targets
  return targets === undefined || targets[filter.device]
}

/** 絞り込んだVersionぶんのスクロール記録を足す */
function sumScrollCounts(
  state: State,
  versionUids: readonly string[],
  startDate: string,
  endDate: string,
): { hm_pv: number; fv_exit: number; sv_exit: number; offer_reach?: number } {
  const sum = { hm_pv: 0, fv_exit: 0, sv_exit: 0 }
  let offerReach = 0
  let hasOffer = false
  for (const uid of versionUids) {
    const part = scrollCounts(state, uid, startDate, endDate)
    sum.hm_pv += part.hm_pv
    sum.fv_exit += part.fv_exit
    sum.sv_exit += part.sv_exit
    if (part.offer_reach !== undefined) {
      hasOffer = true
      offerReach += part.offer_reach
    }
  }
  return hasOffer ? { ...sum, offer_reach: offerReach } : sum
}

/** 媒体実績だけを残した行（LP側の実測を0にする）。ページの費用を絞り込んだLPの数字に添えるために使う */
function mediaOnly(metric: DailyMetric): DailyMetric {
  return { ...metric, pv: 0, click: 0, cv: 0, sales: 0 }
}

/** 絞り込んだあいだは、ページ全体の費用を一部のCVで割った値になるので出さない */
function withoutCostRatios<T extends DerivedKpi>(kpi: T): T {
  return { ...kpi, cpa: null, mcpa: null, roas: null, roi: null }
}

// ── レポート系（§10-3・派生KPIは §10-5 恒等式）──
export function reportRows(state: State, uid: string, scope: 'version' | 'lp' | 'creative', query: unknown) {
  const abTest = state.abTests.find((t) => t.uid === uid)
  if (abTest === undefined) return null
  const { startDate, endDate } = dateRangeParams(query as Record<string, unknown>)
  const articleIds = state.articles.filter((a) => a.ab_test_id === abTest.id).map((a) => a.id)
  const all = state.versions.filter((v) => articleIds.includes(v.article_id))
  const filter = topFilterOf(query)
  const versions = all.filter((version) => keepVersion(version, filter))
  const view = lpViewOf(state, filter.device === '0' ? null : filter.device, startDate, endDate)
  const rows = versions.map((version) => ({
    scope,
    entity_uid: version.uid,
    name: version.name,
    status: version.status,
    distribution_ratio: version.distribution_ratio,
    // ヒートマップ／レポートの「アーカイブ」絞り込みに要る（2026-09-15）。
    archived: version.archived,
    // Branch Operation の「端末」で絞るのに要る（値は元から持っていた）
    device_targets: version.device_targets,
    ...rowKpi(
      view.metrics('version', (u) => u === version.uid),
      scrollCounts(view.scrollState, version.uid, startDate, endDate),
    ),
    /** そのVersionに来た広告パラメータごとの行（実物はVersionの下にぶら下がる・Branch Operation 用） */
    children: parameterRows(state, view, abTest.uid, version.uid, startDate, endDate, 'branch_operation'),
    /** クリエイティブレポートの広告の一覧の材料（レポート設定の「クリエイティブ」で絞る） */
    creative_children: parameterRows(state, view, abTest.uid, version.uid, startDate, endDate, 'creative'),
    /**
     * LP側の日別（表示・クリック・CV・売上があった日だけ）。クリエイティブの「配信中 / 停止中」で
     * グラフを Version ごとに足し直すのに使う（配信金額はページ単位なので入れない）。
     */
    daily_lp: view
      .metrics('version', (u) => u === version.uid)
      .filter((m) => m.pv + m.click + m.cv > 0)
      .map((m) => ({ date: m.date, pv: m.pv, click: m.click, cv: m.cv, sales: m.sales }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    /** 読み込みに3秒以上かかった人の割合と人数（store/page-speed.ts・2026-09-16） */
    speed: speedSummary(state.pageSpeedStats, { versionUids: [version.uid], start: startDate, end: endDate }),
  }))

  const pageMetrics = state.metrics.filter(
    (m) => m.entity_uid === abTest.uid && m.scope === 'ab_test' && isWithin(m.date, startDate, endDate),
  )
  // 本人が選んだ絞り込み（Version・端末）だけが合計の中身を変える。アーカイブの既定は行だけに効く
  const filteredBy: ('version' | 'device')[] = [
    ...(filter.version === '' ? [] : ['version' as const]),
    ...(filter.device === '0' ? [] : ['device' as const]),
  ]
  const shared = {
    rows,
    /**
     * 画面上の「Version」プルダウンに出す一覧。
     * 絞り込みで行が減っても選択肢は減らさないので、絞り込み前の全Versionを返す。
     */
    version_options: all.map((version) => ({ uid: version.uid, name: version.name })),
    period: { start_date: startDate, end_date: endDate },
    /** 期間内に除いたボットの件数（数字には入れていない。画面の断り書きに添える） */
    bot_hits: botHitCount(state.botHits, { abTestUids: [abTest.uid], start: startDate, end: endDate }),
    /** 合計の中身を変えた絞り込み（空＝ページ全体） */
    filtered_by: filteredBy,
    /** 絞り込みで表に出していない Version の数（Version を選んでいなければ、合計には入っている） */
    hidden_rows: filter.version === '' ? all.length - versions.length : 0,
    /** 端末を記録し始めた日（それより前の日は端末で絞ると0）。まだ無ければ null */
    device_since: state.deviceRecordedSince,
  }

  // 日ごとにスクロールの記録を数え直すので、先にこのページ・この期間の行だけにしておく（毎日全件を見ない）
  const pageScrollState: State = {
    ...state,
    heatmapStats: state.heatmapStats.filter(
      (h) => h.ab_test_uid === abTest.uid && isWithin(h.date, startDate, endDate),
    ),
  }

  if (filteredBy.length === 0) {
    return {
      ...shared,
      // 合計もスクロールの記録を含めて出す
      totals: deriveKpi({
        ...sumPrimary(pageMetrics),
        ...scrollCountsForAbTest(state, abTest.uid, startDate, endDate),
      }),
      /** レポートタブ「デイリーレポート」表の日付別の行（§10-5・両端含む）。日ごとのスクロールの記録も足す */
      daily: dailyKpiSeries(pageMetrics, startDate, endDate, (date) =>
        scrollCountsForAbTest(pageScrollState, abTest.uid, date, date),
      ),
    }
  }

  // 絞り込んだとき: LP の数字は絞ったぶん（Version・端末）、配信金額はページ全体のまま
  const versionUids = new Set(versions.map((v) => v.uid))
  const lpMetrics =
    filter.version === ''
      ? view.metrics('ab_test', (u) => u === abTest.uid)
      : view.metrics('version', (u) => versionUids.has(u))
  const scrollBetween = (start: string, end: string): ReturnType<typeof sumScrollCounts> =>
    filter.version === ''
      ? scrollCountsForAbTest(view.scrollState, abTest.uid, start, end)
      : sumScrollCounts(view.scrollState, [...versionUids], start, end)
  const scroll = scrollBetween(startDate, endDate)
  const combined = [
    ...lpMetrics.map((m) => ({ ...m, ad_cost: 0, imp: 0, media_click: 0, media_cv: 0 })),
    ...pageMetrics.map(mediaOnly),
  ]
  return {
    ...shared,
    totals: withoutCostRatios(deriveKpi({ ...sumPrimary(combined), ...scroll })),
    daily: dailyKpiSeries(combined, startDate, endDate, (date) => scrollBetween(date, date)).map(withoutCostRatios),
  }
}
