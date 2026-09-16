/**
 * リンク切れの見張りを回す（2026-09-16・本人の依頼）。
 *
 * 30秒ごとの見張り（task-runner.ts）から呼ばれ、確かめる時刻が来たリンクだけ確かめる。
 * 2回続けて開けなかったら、異常のお知らせと同じ送り先へ、ページごとに1日1通まで知らせる。
 *
 * お知らせが切・リンクの見張りが切・送り先が無いときは、**外へ取りに行くこと自体をしない**
 * （誰にも知らせないのに、相手のサーバーやASPのクリック数に触れる理由が無い）。
 */
import { notifyList } from './alerts.ts'
import { jstNow } from './lib/jst.ts'
import {
  findBrokenLinkAlerts,
  linkTargets,
  probeLink,
  recordProbe,
  type LinkProbe,
} from './link-check.ts'
import { sendNotification } from './notify.ts'
import { getState, setState } from './store/store.ts'

/** 1回に確かめる本数の上限（残りは次の回へ回す。見張りの1周を長引かせない） */
export const MAX_PROBES_PER_RUN = 30
/** 同時に確かめる本数 */
const CONCURRENCY = 4
/** 送った合図を持っておく件数（異常のお知らせと共有） */
const MAX_SENT_SLOTS = 500

let running = false

/** 1回ぶん。確かめた本数を返す */
export async function runLinkChecks(
  nowMs: number = Date.now(),
  probe: (url: string) => Promise<LinkProbe> = (url) => probeLink(url),
): Promise<number> {
  // 前の回がまだ終わっていなければ重ねない（相手が遅いと30秒で終わらないことがある）
  if (running) return 0
  const setting = getState().alertSetting
  if (!setting.enabled || setting.link_check === false) return 0
  const destinations = notifyList(setting.notify)
  if (destinations.length === 0) return 0

  running = true
  try {
    const targets = linkTargets(getState(), jstNow(new Date(nowMs)).date)
    const wanted = new Set(targets.flatMap((t) => t.urls))

    // LPから消えたリンクの記録は捨てる（直したあとに古い失敗で鳴らない）
    setState((s) => ({ ...s, linkChecks: s.linkChecks.filter((c) => wanted.has(c.url)) }))

    const byUrl = new Map(getState().linkChecks.map((c) => [c.url, c]))
    const due = [...wanted]
      .filter((url) => (byUrl.get(url)?.next_check_at ?? 0) <= nowMs)
      .slice(0, MAX_PROBES_PER_RUN)

    for (let i = 0; i < due.length; i += CONCURRENCY) {
      const batch = due.slice(i, i + CONCURRENCY)
      const results = await Promise.all(batch.map(async (url) => ({ url, result: await probe(url) })))
      setState((s) => ({
        ...s,
        linkChecks: results.reduce((checks, r) => recordProbe(checks, r.url, r.result, nowMs), s.linkChecks),
      }))
    }

    const state = getState()
    const alerts = findBrokenLinkAlerts({
      now: Math.floor(nowMs / 1000),
      targets,
      checks: state.linkChecks,
      sentSlots: state.alertSentSlots,
    })
    if (alerts.length > 0) {
      // 先に「送った」と記録してから送る（送信が遅くても二重に送らない）
      setState((s) => ({
        ...s,
        alertSentSlots: [...s.alertSentSlots, ...alerts.map((a) => a.slot)].slice(-MAX_SENT_SLOTS),
      }))
      for (const alert of alerts) {
        for (const to of destinations) {
          try {
            await sendNotification(to.service, to.destination_id, alert.message)
          } catch {
            /* 1つへ送れなくても残りへは送る */
          }
        }
      }
    }
    return due.length
  } finally {
    running = false
  }
}
