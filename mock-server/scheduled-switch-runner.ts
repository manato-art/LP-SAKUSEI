/**
 * 予約の日時が来たら切り替えて知らせる（2026-09-16・本人の依頼）。
 *
 * 30秒ごとの見張り（task-runner.ts）から呼ばれる。
 * **先に「完了」にしてから知らせる**（送信が遅くても、次の見張りが同じ予約をもう一度実行しないため）。
 * 知らせる先は異常のお知らせと同じ。お知らせが切なら、切り替えだけして知らせない
 * （切り替えは本人が決めた予定なので、知らせる設定の有無で止めない）。
 */
import { notifyList } from './alerts.ts'
import { jstNow } from './lib/jst.ts'
import { sendNotification } from './notify.ts'
import { applySwitch, dueSwitches, type SwitchChange } from './store/scheduled-switches.ts'
import { getState, setState } from './store/store.ts'

function message(pageTitle: string, runAt: string, outcome: 'done' | 'failed', changes: SwitchChange[], note: string): string {
  const when = runAt.replace('T', ' ')
  if (outcome === 'failed') {
    return [`【予約した時刻に切り替えられませんでした】${pageTitle}`, `${when} の予約`, note].join('\n')
  }
  return [
    `【予約どおり切り替えました】${pageTitle}`,
    `${when} の予約`,
    ...changes.map((c) => `・${c.name} ${c.before}% → ${c.after}%`),
    ...(note === '' ? [] : [note]),
  ].join('\n')
}

/** 1回ぶん。実行した予約の数を返す */
export async function runScheduledSwitches(now: Date = new Date()): Promise<number> {
  const t = jstNow(now)
  const nowJst = `${t.date}T${t.hhmm}`
  const due = dueSwitches(getState().scheduledSwitches, nowJst)
  if (due.length === 0) return 0

  const messages: string[] = []
  for (const sw of due) {
    let result: ReturnType<typeof applySwitch> | null = null
    setState((s) => {
      result = applySwitch(s, sw.uid, nowJst)
      return result.state
    })
    const applied = result as ReturnType<typeof applySwitch> | null
    if (applied === null || applied.outcome === 'skipped') continue

    const state = getState()
    const article = state.articles.find((a) => a.uid === sw.article_uid)
    const page = state.abTests.find((p) => p.id === article?.ab_test_id)
    const note = state.scheduledSwitches.find((x) => x.uid === sw.uid)?.note ?? ''
    messages.push(message(page?.title ?? '（ページ名不明）', sw.run_at, applied.outcome, applied.changes, note))
  }

  const setting = getState().alertSetting
  const destinations = setting.enabled ? notifyList(setting.notify) : []
  for (const text of messages) {
    for (const to of destinations) {
      try {
        await sendNotification(to.service, to.destination_id, text)
      } catch {
        /* 1つへ送れなくても残りへは送る */
      }
    }
  }
  return messages.length
}
