/**
 * レポート・ヒートマップ・実LP取得（ab-tests.ts から分離）。
 *
 * パスは分ける前と同じ。ab-tests.ts が `use()` で合流させる。
 */
import { Router } from 'express'
import { getState, setState } from '../store/store.ts'
import { deriveKpi, isWithin, sumPrimary } from '../store/metrics.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { dateRangeParams } from '../lib/query.ts'
import { ExternalPageError, fetchExternalPage } from '../external-page.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { findAbTest, notFound } from './ab-tests-shared.ts'
import { PARAMETER_SCOPE_NAMES, parameterNameOf, parameterScopesOf } from '../store/parameter-scopes.ts'
import { reportRows } from './report-rows.ts'
import type { ParameterScope } from '../store/types.ts'

export const abTestsReportsRouter: Router = Router()

abTestsReportsRouter.get('/ab_tests/:uid/reports', (req, res) => {
  const out = reportRows(getState(), req.params.uid, 'version', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

abTestsReportsRouter.get('/ab_tests/:uid/reports/lp', (req, res) => {
  const out = reportRows(getState(), req.params.uid, 'lp', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

abTestsReportsRouter.get('/ab_tests/:uid/reports/swipe', (req, res) => {
  const out = reportRows(getState(), req.params.uid, 'version', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

abTestsReportsRouter.get('/ab_tests/:uid/creative_report', (req, res) => {
  const out = reportRows(getState(), req.params.uid, 'creative', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

/** ヒートマップ比較（§9-4）。密度は再現対象外・すべて合成。 */
abTestsReportsRouter.get('/ab_tests/:uid/heatmaps/comparisons', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const heatmaps = state.heatmaps.filter((h) => h.ab_test_uid === abTest.uid)
  res.json({ heatmaps: applyEmptyState(req, heatmaps) })
})

/**
 * クリエイティブレポートの「列を選ぶ」→「保存」。
 * 名前は採取したチェックボックスの name そのまま（`_columnChoiceBody_1fhbq_117` の form）。
 */
const CREATIVE_COLUMN_NAMES = [
  'adSpending',
  'pv',
  'click',
  'ctr',
  'cv',
  'cvr',
  'ctvr',
  'cpa',
  'mcpa',
] as const

abTestsReportsRouter.get('/creative_report_user_columns', (_req, res) => {
  res.json({
    creative_report_user_columns: getState().creativeReportColumns.map((name) => ({ name })),
  })
})

abTestsReportsRouter.put('/creative_report_user_columns', (req, res) => {
  const body = req.body as { creative_report_user_columns?: unknown }
  const raw = Array.isArray(body.creative_report_user_columns)
    ? body.creative_report_user_columns
    : []
  // 採取した9つ以外は作らない。重複も潰す。
  const names = [
    ...new Set(
      raw
        .filter((n): n is string => typeof n === 'string')
        .filter((n) => (CREATIVE_COLUMN_NAMES as readonly string[]).includes(n)),
    ),
  ]
  // 列が1つも無い表は画面が成立しない（実物のフォームも全部外せない）
  if (names.length === 0) {
    return res
      .status(422)
      .json(errorEnvelope('validation_failed', '列は1つ以上選んでください。'))
  }
  setState((s) => ({ ...s, creativeReportColumns: names }))
  res.json({ creative_report_user_columns: names.map((name) => ({ name })) })
})

/**
 * ファネルの段（＝ステップ）と、その実測（2026-09-15）。
 *
 * ステップは記事（article）。段ごとの数字は、そのステップに属するVersionの実測を足したもの。
 * 別の記録は持たない（Versionから記事は辿れるので、二重に数える置き場所を作らない）。
 */
abTestsReportsRouter.get('/ab_tests/:uid/funnel_steps', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const { startDate, endDate } = dateRangeParams(req.query)

  const articles = state.articles.filter((a) => a.ab_test_id === abTest.id)
  const steps = articles.map((article, index) => {
    const versionUids = state.versions
      .filter((v) => v.article_id === article.id)
      .map((v) => v.uid)
    const metrics = state.metrics.filter(
      (m) =>
        m.scope === 'version' &&
        versionUids.includes(m.entity_uid) &&
        isWithin(m.date, startDate, endDate),
    )
    const name = article.memo.trim()
    return {
      uid: article.uid,
      // 名前を付けずに作れるので、空なら何番目かで出す（空欄のまま並べると区別できない）
      name: name === '' ? `ステップ${index + 1}` : name,
      ...deriveKpi(sumPrimary(metrics)),
    }
  })
  res.json({ steps, period: { start_date: startDate, end_date: endDate } })
})

/**
 * レポート設定「表示するパラメータ」（歯車から開くモーダル）。
 * 採取した画面には保存ボタンが1つも無いので、触った時点で保存する作りにしている。
 */
abTestsReportsRouter.get('/ab_tests/:uid/parameter_scopes', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  res.json({ parameter_scopes: parameterScopesOf(state, abTest.uid) })
})

abTestsReportsRouter.put('/ab_tests/:uid/parameter_scopes', (req, res) => {
  const abTest = findAbTest(getState(), req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const body = req.body as { parameter_scopes?: unknown }
  const incoming = Array.isArray(body.parameter_scopes) ? body.parameter_scopes : []

  setState((s) => {
    let rows = parameterScopesOf(s, abTest.uid)
    for (const raw of incoming) {
      const patch = raw as Partial<ParameterScope> & { name?: unknown }
      // 行は採取した6つだけ。知らない名前は作らない（画面に無いものを増やさない）
      if (typeof patch.name !== 'string') continue
      const name = patch.name
      if (!(PARAMETER_SCOPE_NAMES as readonly string[]).includes(name)) continue
      rows = rows.map((row) =>
        row.name === name
          ? {
              ...row,
              creative: typeof patch.creative === 'boolean' ? patch.creative : row.creative,
              branch_operation:
                typeof patch.branch_operation === 'boolean'
                  ? patch.branch_operation
                  : row.branch_operation,
              heatmap: typeof patch.heatmap === 'boolean' ? patch.heatmap : row.heatmap,
              description:
                typeof patch.description === 'string'
                  ? patch.description.slice(0, 1000)
                  : row.description,
            }
          : row,
      )
    }
    return {
      ...s,
      parameterScopes: [
        ...s.parameterScopes.filter((row) => row.ab_test_uid !== abTest.uid),
        ...rows,
      ],
    }
  })
  res.json({ parameter_scopes: parameterScopesOf(getState(), abTest.uid) })
})

/**
 * ヒートマップの実測集計（計測タグ由来）。
 *
 * 実物のヒートマップが持つ4モードぶんを、Versionごとにバンド単位で返す:
 *   arrival  到達率 = そのバンドまで到達した訪問 / PV
 *   exit     離脱率 = そのバンドで離脱した訪問 / PV
 *   attention 滞在時間 = 平均ミリ秒（サンプルが無いバンドは0）
 *   elementClick クリック数 = そのバンドに落ちたクリック数
 * 期間指定は日別集計を合算する。データが無ければ空配列（数字を作らない）。
 */
abTestsReportsRouter.get('/ab_tests/:uid/heatmaps/stats', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const { startDate, endDate } = dateRangeParams(req.query)

  // 広告パラメータでの絞り込み。指定が無ければ合算（param='')を見る。
  // 実物の画面では、左のVersion一覧で utm_* にチェックを入れるとその広告だけのヒートマップになる。
  const wanted = typeof req.query['param'] === 'string' ? req.query['param'] : ''
  const inRange = state.heatmapStats.filter(
    (h) => h.ab_test_uid === abTest.uid && isWithin(h.date, startDate, endDate),
  )
  const rows = inRange.filter((h) => (h.param ?? '') === wanted)
  // Version ごとに日別を合算する
  const byVersion = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = byVersion.get(row.version_uid) ?? []
    list.push(row)
    byVersion.set(row.version_uid, list)
  }

  const versions = [...byVersion.entries()].map(([versionUid, all]) => {
    // 分割数を変えた前後のデータが混ざることがある。長さの違う配列を足すと
    // 数字が壊れるので、PVが最も多い分割数のぶんだけを使う。
    const pvByBands = new Map<number, number>()
    for (const row of all) pvByBands.set(row.bands, (pvByBands.get(row.bands) ?? 0) + row.pv)
    let bands = all[0]?.bands ?? 20
    let best = -1
    for (const [b, pv] of pvByBands) {
      if (pv > best) {
        best = pv
        bands = b
      }
    }
    const list = all.filter((row) => row.bands === bands)
    const zero = (): number[] => new Array<number>(bands).fill(0)
    const sum = { pv: 0, vbPv: 0, reach: zero(), exit: zero(), dwellMs: zero(), dwellN: zero() }
    const clicks: { x: number; y: number }[] = []
    for (const row of list) {
      sum.pv += row.pv
      sum.vbPv += row.vb_pv ?? 0
      for (let i = 0; i < bands; i++) {
        sum.reach[i] = (sum.reach[i] ?? 0) + (row.reach[i] ?? 0)
        sum.exit[i] = (sum.exit[i] ?? 0) + (row.exit[i] ?? 0)
        sum.dwellMs[i] = (sum.dwellMs[i] ?? 0) + (row.dwell_ms[i] ?? 0)
        sum.dwellN[i] = (sum.dwellN[i] ?? 0) + (row.dwell_n[i] ?? 0)
      }
      clicks.push(...row.clicks)
    }
    const ratio = (n: number): number | null => (sum.pv === 0 ? null : n / sum.pv)
    // クリックはバンドへ落として本数を数える（座標そのものも返す）
    const clickBands = zero()
    for (const c of clicks) {
      const i = Math.max(0, Math.min(bands - 1, Math.floor(c.y * bands)))
      clickBands[i] = (clickBands[i] ?? 0) + 1
    }
    const version = state.versions.find((v) => v.uid === versionUid)
    return {
      version_uid: versionUid,
      version_name: version?.name ?? null,
      /** どの広告パラメータで絞った集計か。空＝全パラメータ合算 */
      param: wanted,
      bands,
      pv: sum.pv,
      /** pv のうち古いタグ（スクロールの進み具合で到達を数えていた）の記録（2026-09-24） */
      legacy_pv: sum.pv - sum.vbPv,
      arrival: sum.reach.map((n) => ratio(n)),
      exit: sum.exit.map((n) => ratio(n)),
      attention: sum.dwellMs.map((ms, i) => {
        const n = sum.dwellN[i] ?? 0
        return n === 0 ? 0 : Math.round(ms / n)
      }),
      elementClick: clickBands,
      clicks: clicks.slice(-2000),
    }
  })

  // 左のVersion一覧に並べる「来た広告パラメータ」。PVの多い順に出す。
  // 絞り込みの選択肢なので、絞り込んだあとも一覧は変わらない（合算の行から数える）。
  const paramPv = new Map<string, number>()
  for (const h of inRange) {
    const param = h.param ?? ''
    if (param === '') continue
    paramPv.set(`${h.version_uid}\u0000${param}`, (paramPv.get(`${h.version_uid}\u0000${param}`) ?? 0) + h.pv)
  }
  // レポート設定「表示するパラメータ」でヒートマップをOFFにした名前は一覧に出さない
  const shownNames = new Set(
    parameterScopesOf(state, abTest.uid)
      .filter((row) => row.heatmap)
      .map((row) => row.name),
  )
  const parameters = [...paramPv.entries()]
    .map(([key, pv]) => {
      const [versionUid = '', param = ''] = key.split('\u0000')
      return { version_uid: versionUid, param, pv }
    })
    .filter(({ param }) => shownNames.has(parameterNameOf(param)))
    .sort((a, b) => b.pv - a.pv || a.param.localeCompare(b.param))

  res.json({ period: { start_date: startDate, end_date: endDate }, versions, parameters })
})

/**
 * ヒートマップの背景に敷く「実LP」のHTML。
 *
 * 外部LP（別アカウントで配信中のLP）は自前のVersion HTMLを持たないため、
 * このシステム側の背景がサンプルLPになってしまい、色の位置が実物と合わない。
 * そこでサーバーが実LPを取得して返す（ブラウザからは x-frame-options で読めない）。
 *
 * URLは計測タグが最初のPVで知らせてきたもの（`ab_test.external_url`）だけを使う。
 * 任意のURLを外から指定させない＝この口をSSRFの入口にしない。
 */
const externalPageCache = new Map<string, { html: string; finalUrl: string; at: number }>()
const EXTERNAL_PAGE_TTL_MS = 10 * 60 * 1000

abTestsReportsRouter.get('/ab_tests/:uid/external_page', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')

  const url = abTest.external_url
  if (url === undefined || url === '') {
    return notFound(
      res,
      '外部LPの場所がまだ分かりません。計測タグを貼ったLPが1回以上表示されると分かります。',
    )
  }

  const hit = externalPageCache.get(url)
  if (hit !== undefined && Date.now() - hit.at < EXTERNAL_PAGE_TTL_MS) {
    res.json({ html: hit.html, final_url: hit.finalUrl, cached: true })
    return
  }

  void fetchExternalPage(url)
    .then(({ html, finalUrl }) => {
      externalPageCache.set(url, { html, finalUrl, at: Date.now() })
      res.json({ html, final_url: finalUrl, cached: false })
    })
    .catch((error: unknown) => {
      const isKnown = error instanceof ExternalPageError
      res.status(502).json(
        errorEnvelope(
          isKnown ? error.code : 'fetch_failed',
          isKnown ? error.message : '実LPを取得できませんでした。',
        ),
      )
    })
})
