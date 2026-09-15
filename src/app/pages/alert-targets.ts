/**
 * 異常のお知らせの「送り先」を、画面で扱える形にそろえる（2026-09-15）。
 *
 * サーバーは配列で返すが、この機能が出た日は1件のオブジェクト（または null）だった。
 * 古いサーバーが動いているあいだに新しい画面を開くと、そのまま繰り返そうとして
 * 設定画面が丸ごと真っ白になる（実際にそうなった）。読む側でそろえる。
 */
import type { NotifyDestination } from '../panels/notify-target.ts'

const SERVICES = ['slack', 'chatwork', 'line'] as const

/** 受け取った送り先を、画面の1行ぶんずつに直す。読めないものは落とす。 */
export function savedTargets(notify: unknown): NotifyDestination[] {
  const items = Array.isArray(notify) ? notify : [notify]
  const out: NotifyDestination[] = []
  for (const item of items) {
    if (item === null || typeof item !== 'object') continue
    const { service, destination_id: id } = item as Record<string, unknown>
    if (!SERVICES.includes(service as (typeof SERVICES)[number])) continue
    out.push({
      service: service as (typeof SERVICES)[number],
      id: typeof id === 'string' ? id : '',
    })
  }
  return out
}
