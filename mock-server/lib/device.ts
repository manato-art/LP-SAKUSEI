/**
 * User-Agent から端末（スマホ / タブレット / PC）を分ける（2026-09-24・点検29）。
 *
 * 判定式は配信の出し分け（routes/delivery-targeting.ts の detectDevice）と同じ。
 * 計測（表示・クリック・CV・スクロールの記録）を端末ごとに数えるときに使う。
 * 判定できない・空の User-Agent は PC として数える（出し分けと同じ扱い）。
 */
import type { DeviceKind } from '../store/types.ts'

export function deviceOfUserAgent(userAgent: string): DeviceKind {
  if (/iPad|Tablet|Nexus 7|Nexus 10|Kindle|Silk|PlayBook/i.test(userAgent)) return 'tablet'
  if (/Mobile|iPhone|Android.*Mobile|Windows Phone|iPod/i.test(userAgent)) return 'sp'
  return 'pc'
}
