/**
 * 端末ごとの実測（2026-09-24・点検29）。
 *
 * 以前は端末を記録していなかったので、レポートの「端末」で絞ってもヒートマップの SP / PC を
 * 切り替えても数字が変わらなかった。記録を受けたときに User-Agent から端末を分けて、ここに積む。
 * DailyMetric とは別の入れ物にしてある（既存の集計が端末の行まで足して二重に数えないように）。
 * 記録を始める前のデータには端末が無い。いつから記録しているかは deviceRecordedSince に残す。
 */
import { isWithin } from './metrics.ts'
import type { DailyMetric, DeviceKind, DeviceMetric, State } from './types.ts'

type DeviceKey = Pick<DeviceMetric, 'entity_uid' | 'scope' | 'date' | 'device'>
type DeviceDelta = Partial<Pick<DeviceMetric, 'pv' | 'click' | 'cv' | 'sales'>>

/** 端末ごとの実測に足す（無ければ作る） */
export function bumpDeviceMetric(
  list: State['deviceMetrics'],
  key: DeviceKey,
  delta: DeviceDelta,
): State['deviceMetrics'] {
  const index = list.findIndex(
    (m) => m.entity_uid === key.entity_uid && m.scope === key.scope && m.date === key.date && m.device === key.device,
  )
  if (index === -1) {
    return [
      ...list,
      { ...key, pv: delta.pv ?? 0, click: delta.click ?? 0, cv: delta.cv ?? 0, sales: delta.sales ?? 0 },
    ]
  }
  return list.map((m, i) =>
    i === index
      ? {
          ...m,
          pv: m.pv + (delta.pv ?? 0),
          click: m.click + (delta.click ?? 0),
          cv: m.cv + (delta.cv ?? 0),
          sales: m.sales + (delta.sales ?? 0),
        }
      : m,
  )
}

/** 端末を記録し始めた日。最初の1件のときだけ入る（あとは変えない） */
export function deviceSinceAfter(state: State, date: string): string {
  return state.deviceRecordedSince ?? date
}

/**
 * 端末ごとの実測を、日次メトリクスと同じ形にして返す（集計の関数をそのまま使うため）。
 * 配信金額などの媒体実績は端末ごとに分からないので0。
 */
export function deviceDailyMetrics(
  state: State,
  filter: { device: DeviceKind; scope: DeviceMetric['scope']; start: string; end: string; entityUid?: (uid: string) => boolean },
): DailyMetric[] {
  return state.deviceMetrics
    .filter(
      (m) =>
        m.device === filter.device &&
        m.scope === filter.scope &&
        isWithin(m.date, filter.start, filter.end) &&
        (filter.entityUid === undefined || filter.entityUid(m.entity_uid)),
    )
    .map((m) => ({
      entity_uid: m.entity_uid,
      scope: m.scope,
      date: m.date,
      pv: m.pv,
      click: m.click,
      cv: m.cv,
      sales: m.sales,
      ad_cost: 0,
    }))
}

/**
 * スクロールの記録をその端末のぶんだけに差し替えた状態（集計の関数 scroll-counts.ts をそのまま使うため）。
 * 端末ごとの記録は広告パラメータに分けていないので、広告ごとの行は数えられない（0件＝「-」）。
 */
export function withDeviceHeatmap(state: State, device: DeviceKind): State {
  return { ...state, heatmapStats: state.deviceHeatmapStats.filter((h) => h.device === device) }
}
