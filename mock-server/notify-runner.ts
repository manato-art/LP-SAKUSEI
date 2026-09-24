/**
 * CV発生通知・デイリーレポートを送る見張り（2026-09-24・点検28）。
 *
 * 見張り（task-runner・30秒ごと）に相乗りする。何を送るかは notify-digest.ts の純粋関数が決め、
 * ここは記録と送信だけを持つ。
 *  - 送り先は「異常のお知らせ」で決めた送り先（notifyList）。送り先が無ければ送らない
 *  - 先に「送った」と記録してから送る（送信に時間がかかっても、次の見張りが同じものを二重に送らない）
 *  - 1つの送り先へ送れなくても残りへは送る。送れなかった理由は記録（notificationRuns）とログに残す
 */
import { notifyList } from './alerts.ts'
import { jstNow } from './lib/jst.ts'
import { sendNotification } from './notify.ts'
import { cvDigest, dailyDigest } from './notify-digest.ts'
import { getState, setState } from './store/store.ts'
import type { NotificationRuns } from './store/types.ts'

type Sender = typeof sendNotification

/** 送り先すべてへ送る。送れなかった理由をまとめて返す（全部送れたら null） */
async function sendToAll(
  destinations: readonly { service: 'slack' | 'chatwork' | 'line'; destination_id: string }[],
  text: string,
  send: Sender,
  label: string,
): Promise<string | null> {
  const failures: string[] = []
  for (const to of destinations) {
    try {
      await send(to.service, to.destination_id, text)
    } catch (error) {
      const message = error instanceof Error ? error.message : '送れませんでした'
      console.error(`[notify-runner] ${label}を${to.service}へ送れませんでした: ${message}`)
      failures.push(`${to.service}: ${message}`)
    }
  }
  return failures.length === 0 ? null : failures.join(' / ')
}

function sameRuns(a: NotificationRuns, b: NotificationRuns): boolean {
  return (Object.keys(a) as (keyof NotificationRuns)[]).every((key) => a[key] === b[key])
}

function recordRuns(patch: Partial<NotificationRuns>): void {
  setState((s) => ({ ...s, notificationRuns: { ...s.notificationRuns, ...patch } }))
}

export async function runNotificationDigests(nowMs: number = Date.now(), send: Sender = sendNotification): Promise<void> {
  const state = getState()
  const setting = state.notificationSettings.find((n) => n.scope === 'member')
  const destinations = notifyList(state.alertSetting.notify)
  const hasTargets = destinations.length > 0
  const pages = state.abTests.map((t) => ({ uid: t.uid, title: t.title }))

  const cv = cvDigest({
    now: Math.floor(nowMs / 1000),
    // 送り先が無いあいだは「切」と同じ（目印だけ進めて、あとで昔のCVをまとめて送らない）
    isOn: setting?.cv_digest === true && hasTargets,
    pages,
    conversions: state.conversions,
    runs: state.notificationRuns,
  })
  const daily = dailyDigest({
    now: jstNow(new Date(nowMs)),
    isOn: setting?.daily_digest === true && hasTargets,
    pages,
    metrics: state.metrics,
    runs: cv.runs,
  })
  // 先に記録してから送る。変わっていなければ書かない（保存は重いので、30秒ごとに書き直さない）
  if (!sameRuns(daily.runs, state.notificationRuns)) recordRuns(daily.runs)

  if (cv.message !== null) {
    recordRuns({ cv_last_error: await sendToAll(destinations, cv.message, send, 'CV発生通知') })
  }
  if (daily.message !== null) {
    recordRuns({ daily_last_error: await sendToAll(destinations, daily.message, send, 'デイリーレポート') })
  }
}
