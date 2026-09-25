/**
 * ヒートマップの実測集計（計測タグ由来・ab-tests-reports.ts から分離・2026-09-24）。
 *
 * 実物のヒートマップが持つ4モードぶんを、Versionごとにバンド単位で返す:
 *   arrival  到達率 = そのバンドまで到達した訪問 / PV
 *   exit     離脱率 = そのバンドで離脱した訪問 / PV
 *   attention 滞在時間 = 平均ミリ秒（サンプルが無いバンドは0）
 *   elementClick クリック数 = そのバンドに落ちたクリック数
 * 期間指定は日別集計を合算する。データが無ければ空配列（数字を作らない）。
 *
 * `segment=cv` を付けると、申し込んだ人だけの記録で出す（2026-09-25・store/cv-heatmap.ts）。
 *
 * `device=sp|tablet|pc` を付けると、その端末の記録だけで出す（2026-09-24・点検29）。
 * 端末ごとの記録は広告パラメータに分けていないので、`param` と一緒には使えない（param を優先して device を無視し、
 * device_applied:false で知らせる）。どの端末に何PVあるか（device_coverage）も返す。
 */
import { Router } from 'express'
import { getState } from '../store/store.ts'
import { isWithin } from '../store/metrics.ts'
import { dateRangeParams } from '../lib/query.ts'
import { findAbTest, notFound } from './ab-tests-shared.ts'
import { parameterNameOf, parameterScopesOf } from '../store/parameter-scopes.ts'
import type { CvHeatmapStat, DeviceKind, HeatmapStat, State } from '../store/types.ts'

export const heatmapStatsRouter: Router = Router()

function deviceOf(raw: unknown): DeviceKind | null {
  return raw === 'sp' || raw === 'tablet' || raw === 'pc' ? raw : null
}

/** Version ごとに日別を合算する */
function aggregateByVersion(state: State, rows: readonly HeatmapStat[], param: string) {
  const byVersion = new Map<string, HeatmapStat[]>()
  for (const row of rows) byVersion.set(row.version_uid, [...(byVersion.get(row.version_uid) ?? []), row])

  return [...byVersion.entries()].map(([versionUid, all]) => {
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
    const clicks: { x: number; y: number; cx?: number }[] = []
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
      param,
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
}

/** 申し込んだ人の行（広告・端末で絞る。端末の行を足すと全端末） */
function cvRows(
  state: State,
  abTestUid: string,
  range: { startDate: string; endDate: string },
  param: string,
  device: DeviceKind | null,
): readonly CvHeatmapStat[] {
  return state.cvHeatmapStats.filter(
    (h) =>
      h.ab_test_uid === abTestUid &&
      (h.param ?? '') === param &&
      (device === null || h.device === device) &&
      isWithin(h.date, range.startDate, range.endDate),
  )
}

/** 申し込んだ人の、Version ごとの全端末と端末ごとの人数 */
function cvDeviceCoverage(state: State, abTestUid: string, startDate: string, endDate: string) {
  const out = new Map<string, { version_uid: string; all: number; sp: number; tablet: number; pc: number }>()
  for (const h of cvRows(state, abTestUid, { startDate, endDate }, '', null)) {
    const e = out.get(h.version_uid) ?? { version_uid: h.version_uid, all: 0, sp: 0, tablet: 0, pc: 0 }
    out.set(h.version_uid, { ...e, all: e.all + h.pv, [h.device]: e[h.device] + h.pv })
  }
  return [...out.values()]
}

/** Version ごとに、全端末の PV と端末ごとの PV（端末を記録する前のぶんは all にだけ入る） */
function deviceCoverage(state: State, abTestUid: string, startDate: string, endDate: string) {
  const out = new Map<string, { version_uid: string; all: number; sp: number; tablet: number; pc: number }>()
  const entry = (uid: string) => out.get(uid) ?? { version_uid: uid, all: 0, sp: 0, tablet: 0, pc: 0 }
  for (const h of state.heatmapStats) {
    if (h.ab_test_uid !== abTestUid || (h.param ?? '') !== '' || !isWithin(h.date, startDate, endDate)) continue
    const e = entry(h.version_uid)
    out.set(h.version_uid, { ...e, all: e.all + h.pv })
  }
  for (const h of state.deviceHeatmapStats) {
    if (h.ab_test_uid !== abTestUid || !isWithin(h.date, startDate, endDate)) continue
    const e = entry(h.version_uid)
    out.set(h.version_uid, { ...e, [h.device]: e[h.device] + h.pv })
  }
  return [...out.values()]
}

heatmapStatsRouter.get('/ab_tests/:uid/heatmaps/stats', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const { startDate, endDate } = dateRangeParams(req.query)

  // 広告パラメータでの絞り込み。指定が無ければ合算（param='')を見る。
  // 実物の画面では、左のVersion一覧で utm_* にチェックを入れるとその広告だけのヒートマップになる。
  const wanted = typeof req.query['param'] === 'string' ? req.query['param'] : ''
  const device = wanted === '' ? deviceOf(req.query['device']) : null
  const isCv = req.query['segment'] === 'cv'
  const inRange = state.heatmapStats.filter(
    (h) => h.ab_test_uid === abTest.uid && isWithin(h.date, startDate, endDate),
  )
  const rows: readonly HeatmapStat[] = isCv
    ? cvRows(state, abTest.uid, { startDate, endDate }, wanted, device)
    : device === null
      ? inRange.filter((h) => (h.param ?? '') === wanted)
      : state.deviceHeatmapStats.filter(
          (h) => h.ab_test_uid === abTest.uid && h.device === device && isWithin(h.date, startDate, endDate),
        )
  const versions = aggregateByVersion(state, rows, wanted)

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

  res.json({
    period: { start_date: startDate, end_date: endDate },
    versions,
    parameters,
    /** 端末で絞ったか（広告パラメータと一緒には絞れない） */
    device_applied: device !== null,
    device_coverage: isCv
      ? cvDeviceCoverage(state, abTest.uid, startDate, endDate)
      : deviceCoverage(state, abTest.uid, startDate, endDate),
    /** 申し込んだ人だけの記録か（segment=cv） */
    segment: isCv ? 'cv' : 'all',
    /** 端末を記録し始めた日（それより前の記録には端末が無い） */
    device_since: state.deviceRecordedSince,
  })
})
