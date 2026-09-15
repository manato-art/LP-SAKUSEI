/**
 * 異常のお知らせ（2026-09-15・本人の依頼）。
 *
 * 配信を回していると、CVが止まったこと・CPAが跳ねたことに、
 * 自分で画面を見に行くまで気づけない。条件に当たったら1通送る。
 *
 * ⚠️ これは**実物のSquadBeyondには無い**、このシステムだけの機能。
 *
 * 判定はここに閉じた純粋関数にしてある（時刻もデータも引数で受ける）。
 * 送信や保存と混ぜると、条件を確かめるのに実際に送る必要が出てしまう。
 */
import { jstNow } from './lib/jst.ts'

const HOUR_SECONDS = 3600
/** 「もともとCVが来ていたページか」を見る窓（日） */
const RECENT_DAYS = 7

export type AlertKind = 'cv_stopped' | 'cpa_over'

/** 送り先。LINEだけ destination_id が空でよい（＝友だち全員へ）。 */
export interface AlertNotify {
  service: 'slack' | 'chatwork' | 'line'
  destination_id: string
}

/**
 * 保存されている送り先を配列にして返す。
 *
 * この機能が出た日（2026-09-15）は送り先が1件だけで、`null` か1件のオブジェクトだった。
 * その形のまま残っている状態を読めないと、設定していたのに鳴らなくなる。
 * 読む側は必ずここを通す（型は配列でも、実際の中身は古い形のことがある）。
 */
export function notifyList(raw: unknown): AlertNotify[] {
  const one = (value: unknown): AlertNotify | null => {
    if (value === null || typeof value !== 'object') return null
    const { service, destination_id: id } = value as Record<string, unknown>
    if (service !== 'slack' && service !== 'chatwork' && service !== 'line') return null
    return { service, destination_id: typeof id === 'string' ? id : '' }
  }
  const items = Array.isArray(raw) ? raw : [raw]
  const out: AlertNotify[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const parsed = one(item)
    if (parsed === null) continue
    // 同じ送り先が2件あると同じ知らせが2通届く
    const key = `${parsed.service}|${parsed.destination_id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(parsed)
  }
  return out
}

export interface AlertSetting {
  enabled: boolean
  /** この時間ずっとCVが0なら「止まった」とみなす */
  cv_silent_hours: number
  /** その日のCPAの上限（円）。0 ＝ 見ない */
  cpa_limit: number
  /** 送り先（何件でも）。古い形（1件 or null）も `notifyList()` で読める。 */
  notify: readonly AlertNotify[] | AlertNotify | null
}

export interface AlertInput {
  /** 今（UNIX秒） */
  now: number
  /** 今日の日付（JST・YYYY-MM-DD） */
  today: string
  setting: AlertSetting
  pages: readonly { uid: string; title: string; ad_status: string }[]
  conversions: readonly { ab_test_uid: string; occurred_at: number }[]
  metrics: readonly { entity_uid: string; date: string; ad_cost: number; cv: number }[]
  /** すでに送った合図（`<pageUid>|<kind>|<YYYY-MM-DD HH>`） */
  sentSlots: readonly string[]
}

export interface Alert {
  ab_test_uid: string
  kind: AlertKind
  /** 送る本文 */
  message: string
  /** 同じ時間帯に二度送らないための合図 */
  slot: string
}

const yen = (n: number): string => `${Math.round(n).toLocaleString('ja-JP')}円`

/** 時間帯の合図。1時間に1回までにする（分ごとに送ると鳴りやまない）。 */
function slotOf(now: number, pageUid: string, kind: AlertKind): string {
  const t = jstNow(new Date(now * 1000))
  return `${pageUid}|${kind}|${t.date} ${t.hour}`
}

/** 配信中のページだけ見る（止めているページのCVが来ないのは異常ではない） */
function isDelivering(adStatus: string): boolean {
  return adStatus === 'delivered'
}

export function findAlerts(input: AlertInput): Alert[] {
  const { setting } = input
  // 送り先が無いなら判定もしない（記録だけ進むと、決めた直後に鳴らなくなる）
  if (!setting.enabled || notifyList(setting.notify).length === 0) return []

  const out: Alert[] = []
  const sent = new Set(input.sentSlots)
  const silentSeconds = Math.max(1, setting.cv_silent_hours) * HOUR_SECONDS
  const recentSeconds = RECENT_DAYS * 24 * HOUR_SECONDS

  for (const page of input.pages) {
    if (!isDelivering(page.ad_status)) continue
    const mine = input.conversions.filter((c) => c.ab_test_uid === page.uid)

    /* ── CVが止まった ── */
    // 「もともと来ていた」ことが前提。1件も無いページや、ずっと前で止まっているページは
    // 止まったのではないので知らせない（鳴りっぱなしになる）。
    const hadRecently = mine.some((c) => input.now - c.occurred_at <= recentSeconds)
    const hasInWindow = mine.some((c) => input.now - c.occurred_at <= silentSeconds)
    if (hadRecently && !hasInWindow) {
      const slot = slotOf(input.now, page.uid, 'cv_stopped')
      if (!sent.has(slot)) {
        out.push({
          ab_test_uid: page.uid,
          kind: 'cv_stopped',
          slot,
          message: `【CVが止まっています】${page.title}｜直近${setting.cv_silent_hours}時間のCVが0件です。`,
        })
      }
    }

    /* ── CPAが上がりすぎた ── */
    if (setting.cpa_limit > 0) {
      const today = input.metrics.filter(
        (m) => m.entity_uid === page.uid && m.date === input.today,
      )
      const adCost = today.reduce((sum, m) => sum + m.ad_cost, 0)
      const cv = today.reduce((sum, m) => sum + m.cv, 0)
      // CVが0のときはCPAが出ないだけ（跳ねたのではない）ので出さない
      if (cv > 0) {
        const cpa = adCost / cv
        if (cpa > setting.cpa_limit) {
          const slot = slotOf(input.now, page.uid, 'cpa_over')
          if (!sent.has(slot)) {
            out.push({
              ab_test_uid: page.uid,
              kind: 'cpa_over',
              slot,
              message:
                `【CPAが上限を超えました】${page.title}｜本日のCPA ${yen(cpa)}` +
                `（上限 ${yen(setting.cpa_limit)}・配信金額 ${yen(adCost)} / CV ${cv}件）`,
            })
          }
        }
      }
    }
  }
  return out
}
