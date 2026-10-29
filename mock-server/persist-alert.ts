/**
 * 数字の保存に失敗した・直った・重くなってきたを知らせる（2026-10-29 本人「保存に失敗したらすぐ知らせる」）。
 *
 * 合図は store/persistence.ts が出す（onPersistEvent）。送り先と「使う／使わない」は異常のお知らせの設定に従う
 * （切なら外へは送らない。管理画面の赤い帯＝save-status-banner.ts では必ず出る）。
 *   - 失敗は1時間に1通まで（30秒ごとに試し直すので、そのたびに送ると何十通も届く）
 *   - 失敗を知らせたあとに直ったら1通
 *   - 重くなってきたは1日1通まで（日本時間の日付で数える）
 * 送れなかった送り先はログに残し、残りの送り先へは送る。
 */
import { notifyList } from './alerts.ts'
import { jstNow } from './lib/jst.ts'
import { sendNotification, type NotifyService } from './notify.ts'
import { onPersistEvent, type PersistEvent } from './store/persistence.ts'
import { getState } from './store/store.ts'
import type { AlertSettingState } from './store/types.ts'

const FAILURE_INTERVAL_MS = 60 * 60 * 1000

/** 日本時間の「10月29日 14:05」 */
function jstLabel(ms: number): string {
  const now = jstNow(new Date(ms))
  const [, month, day] = now.date.split('-')
  return `${String(Number(month))}月${String(Number(day))}日 ${now.hhmm}`
}

export function persistAlertMessage(event: PersistEvent): string {
  const { health } = event
  if (event.kind === 'recovered') {
    return `【EBIyon】数字の保存が元に戻りました（${jstLabel(health.lastOkAt ?? Date.now())}）。`
  }
  if (event.kind === 'heavy') {
    const mb = Math.round(health.bytes / (1024 * 1024))
    const seconds = Math.round(health.durationMs / 100) / 10
    return (
      `【EBIyon】保存データが大きくなってきました（${String(mb)}MB・保存1回に${String(seconds)}秒）。` +
      'このまま増えると、LPの表示や計測が重くなります。担当者へ連絡してください。'
    )
  }
  const since =
    health.lastOkAt === null
      ? '起動してから、まだ一度も保存できていません'
      : `最後に保存できたのは ${jstLabel(health.lastOkAt)} です`
  return (
    `【EBIyon】数字の保存に失敗しています（${String(health.failures)}回続けて）。${since}。` +
    'このままサーバーが立ち上がり直すと、それより後の数字が消えます。すぐに担当者へ連絡してください。'
  )
}

export interface PersistAlertDeps {
  setting: () => AlertSettingState
  send: (service: NotifyService, destinationId: string, text: string) => Promise<void>
  now: () => number
}

/** 合図を受けて知らせる関数を作る（送ったかどうかの記録はこの中に持つ） */
export function createPersistAlerter(deps: PersistAlertDeps): (event: PersistEvent) => Promise<void> {
  let lastFailureSentAt: number | null = null
  let heavySentDay: string | null = null

  const shouldSend = (event: PersistEvent, now: number): boolean => {
    if (event.kind === 'failed') return lastFailureSentAt === null || now - lastFailureSentAt >= FAILURE_INTERVAL_MS
    if (event.kind === 'recovered') return lastFailureSentAt !== null
    return heavySentDay !== jstNow(new Date(now)).date
  }

  return async (event) => {
    const setting = deps.setting()
    const destinations = notifyList(setting.notify)
    if (!setting.enabled || destinations.length === 0) return
    const now = deps.now()
    if (!shouldSend(event, now)) return
    // 先に「送った」と記録してから送る（送信が遅くても二重に送らない）
    if (event.kind === 'failed') lastFailureSentAt = now
    if (event.kind === 'recovered') lastFailureSentAt = null
    if (event.kind === 'heavy') heavySentDay = jstNow(new Date(now)).date
    const text = persistAlertMessage(event)
    for (const to of destinations) {
      try {
        await deps.send(to.service, to.destination_id, text)
      } catch (error) {
        console.error(`[store] 保存の知らせを${to.service}へ送れませんでした:`, (error as Error).message)
      }
    }
  }
}

/** サーバーの起動時に1回呼ぶ（index.ts） */
export function startPersistAlerts(): void {
  const notifySaveEvent = createPersistAlerter({
    setting: () => getState().alertSetting,
    send: sendNotification,
    now: () => Date.now(),
  })
  onPersistEvent((event) => {
    void notifySaveEvent(event)
  })
}
