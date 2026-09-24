/**
 * 計測タグの表示・クリックを数える（delivery.ts から分離・2026-09-24）。
 *
 * 同じ1回を「ページ全体」「Version」「Version×広告パラメータ」に数え、
 * 端末ごとの入れ物（store/device-metrics.ts・DailyMetric とは別）にも同じだけ数える。
 * 状態を受け取って新しい状態を返すだけ（保存と応答は送り口が持つ）。
 */
import { bumpMetric } from '../store/actions.ts'
import { bumpDeviceMetric } from '../store/device-metrics.ts'
import type { DeviceKind, State } from '../store/types.ts'

export function countPvOrClick(
  s: State,
  input: {
    abTestUid: string
    /** '' ＝ Version を持たない（外部LPの計測タグ） */
    versionUid: string
    /** 着地URLの広告パラメータ（`utm_source=fb` の形） */
    adParams: readonly string[]
    date: string
    device: DeviceKind
    delta: { pv: number } | { click: number }
  },
): State {
  const { abTestUid, versionUid, adParams, date, device, delta } = input
  const targets: { entityUid: string; scope: 'ab_test' | 'version' | 'parameter' }[] = [
    { entityUid: abTestUid, scope: 'ab_test' },
    // 実物の Branch Operation は Version の下に広告ごとの行がぶら下がる。その材料として Version×広告でも数える
    ...(versionUid === ''
      ? []
      : [
          { entityUid: versionUid, scope: 'version' as const },
          ...adParams.map((param) => ({ entityUid: `${versionUid}|${param}`, scope: 'parameter' as const })),
        ]),
  ]
  let next = s
  let deviceMetrics = s.deviceMetrics
  for (const target of targets) {
    next = { ...next, metrics: bumpMetric(next, target.entityUid, target.scope, date, delta) }
    deviceMetrics = bumpDeviceMetric(deviceMetrics, { entity_uid: target.entityUid, scope: target.scope, date, device }, delta)
  }
  return { ...next, deviceMetrics, deviceRecordedSince: next.deviceRecordedSince ?? date }
}
