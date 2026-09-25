/**
 * 計測タグが離脱時にまとめて送る「ヒートマップ」を積む（delivery.ts から分離・2026-09-16）。
 *
 * 回数ではなく「ページのどこか」を積む。到達率/離脱率/滞在時間/クリック数の材料。
 * 同じ送信に添えてくる読み込み時間（表示の遅さ）もここで積む。
 * 状態を受け取って新しい状態を返すだけ（保存と応答は送り口が持つ）。
 *
 * 2026-09-24: 端末ごとの行（deviceHeatmapStats）にも積む（点検29）。広告パラメータには分けない。
 */
import { parseLoad, recordPageSpeed } from '../store/page-speed.ts'
import { CLICK_CAP, DEVICE_CLICK_CAP, emptyStat, mergeSample, readSample } from '../store/heatmap-sample.ts'
import { holdOrAddCvHeatmap } from '../store/cv-heatmap.ts'
import type { ConversionCondition, DeviceKind, HeatmapStat, State } from '../store/types.ts'

export { adParamsOf } from '../store/heatmap-sample.ts'

export function mergeHeatmapEvent(
  s: State,
  input: {
    abTestUid: string
    versionUid: string
    date: string
    body: unknown
    device: DeviceKind
    /** 訪問者の目印。あれば、申し込んだ人だけのヒートマップにも使う（2026-09-25） */
    vid?: string | null
    /** ページのCV条件（申し込みが数えられうる人だけを預かるため） */
    condition?: ConversionCondition
    now?: number
  },
): State {
  const { abTestUid, versionUid, date, body, device } = input
  const { sample, params } = readSample(body)
  const sameRow = (h: HeatmapStat): boolean =>
    h.ab_test_uid === abTestUid && h.version_uid === versionUid && h.date === date

  // 合算（param='')と、広告パラメータごとの行の両方に積む。
  // こうすると「utm_source=fb で来た人だけのヒートマップ」が引ける。
  // 1回の表示は合算では必ず1PV。パラメータの行では、そのパラメータが付いていた表示だけを数える。
  let stats = s.heatmapStats
  for (const param of ['', ...params]) {
    stats = mergeSample(
      stats,
      (h) => sameRow(h) && (h.param ?? '') === param,
      () => emptyStat(abTestUid, versionUid, date, sample.bands, param),
      sample,
      CLICK_CAP,
    )
  }
  // 端末ごとの行（広告パラメータには分けない・2026-09-24）
  const deviceHeatmapStats = mergeSample(
    s.deviceHeatmapStats,
    (h) => sameRow(h) && h.device === device,
    () => ({ ...emptyStat(abTestUid, versionUid, date, sample.bands, ''), device }),
    sample,
    DEVICE_CLICK_CAP,
  )
  // 表示の遅さ（2026-09-16）。広告パラメータには分けず、ページ×Version×日で1人1件
  const load = parseLoad((body as { load?: unknown }).load)
  const pageSpeedStats =
    load === null
      ? s.pageSpeedStats
      : recordPageSpeed(s.pageSpeedStats, { ab_test_uid: abTestUid, version_uid: versionUid, date }, load)
  const next: State = {
    ...s,
    heatmapStats: stats,
    deviceHeatmapStats,
    deviceRecordedSince: s.deviceRecordedSince ?? date,
    pageSpeedStats,
  }
  // 申し込んだ人だけのヒートマップ（store/cv-heatmap.ts）。目印の無い記録（古いタグ）は結びつけられない
  if (input.vid === undefined || input.vid === null) return next
  return holdOrAddCvHeatmap(next, {
    abTestUid,
    versionUid,
    device,
    params,
    sample,
    vid: input.vid,
    condition: input.condition ?? 'click',
    now: input.now ?? Date.now(),
  })
}

