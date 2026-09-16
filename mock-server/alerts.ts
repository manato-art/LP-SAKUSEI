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

/** 知らせの種類。link_broken はリンクの見張り（link-check.ts）が出す */
export type AlertKind = 'cv_stopped' | 'cpa_over' | 'link_broken'

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
  /** リンク切れの見張り（link-check.ts）。この判定では使わない */
  link_check?: boolean
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
  /** すでに送った合図（`<pageUid>|<kind>|<YYYY-MM-DD>`） */
  sentSlots: readonly string[]
}

export interface Alert {
  ab_test_uid: string
  kind: AlertKind
  /** 送る本文 */
  message: string
  /** 同じ日に二度送らないための合図 */
  slot: string
}

const yen = (n: number): string => `${Math.round(n).toLocaleString('ja-JP')}円`

/**
 * 合図。**同じページの同じ理由は1日1回まで**にする（2026-09-15に1時間に1回から変更）。
 *
 * 1時間に1回だと、CVが丸1日止まっているページ1つで24通使う。
 * LINE公式アカウントの無料枠は月200通しかなく、数日で使い切ると**その月は届かなくなる**。
 * 止まっていることは1日1回知れば足りるので、合図に**時刻を入れない**。
 */
export function slotOf(now: number, pageUid: string, kind: AlertKind): string {
  const t = jstNow(new Date(now * 1000))
  return `${pageUid}|${kind}|${t.date}`
}

/**
 * 見張ってよいページか（2026-09-16に修正）。
 *
 * 以前は「配信ステータスが配信中」だけを見ていたが、本番では**全ページが「準備中」のまま配信**されていて
 * 一度も鳴らなかった（SquadBeyondでも配信ステータスは配信に影響しないラベル）。
 * ラベルで決めるのは、明示的に止めたと分かるもの（停止中・終了）を外すことだけにする。
 * 実際に動いているかは、各判定がCV・配信金額・PVで見る（CVが来ていたページだけ「止まった」と言う、など）。
 */
export function isWatchable(page: { ad_status: string }): boolean {
  return page.ad_status !== 'stopping' && page.ad_status !== 'finished'
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
    if (!isWatchable(page)) continue
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
