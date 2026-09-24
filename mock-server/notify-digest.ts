/**
 * 通知設定の「CV発生通知」「デイリーレポート」の中身と、送るかどうかの判定（2026-09-24・点検28）。
 *
 * 以前はアカウント設定のスイッチが保存されるだけで、どこからも読まれていなかった。
 * 判定はここに閉じた純粋関数にする（時刻もデータも引数）。送信と保存は notify-runner.ts が持つ。
 *
 *  - CV発生通知: 新しいCVを**15分に1通まで**にまとめ、ページごとの件数を書く。
 *    LINE の無料枠は月200通しかないので、1件ずつは送らない。
 *    「新しい」はCVの id（作った順に増える）で見る。切っているあいだも目印を進めておき、
 *    オンにしたときに昔のCVをまとめて送らない。
 *  - デイリーレポート: 毎朝9時（JST）を過ぎたら、前日の PV / CLICK / CV / CVR / 配信金額 をページごとに1通で。
 *    数字があったページだけ書く。1つも無ければ送らない（枠を使わない）。同じ日に二度送らない。
 */
import { deriveKpi, sumPrimary } from './store/metrics.ts'
import type { JstNow } from './lib/jst.ts'
import type { DailyMetric, NotificationRuns } from './store/types.ts'

export const EMPTY_NOTIFICATION_RUNS: NotificationRuns = {
  cv_max_id: null,
  cv_last_sent_at: null,
  cv_last_error: null,
  daily_sent_for: null,
  daily_last_error: null,
}

/** CV発生通知の間隔（秒） */
export const CV_DIGEST_INTERVAL_SECONDS = 15 * 60
/** デイリーレポートを送る時刻（JST の時） */
export const DAILY_REPORT_HOUR = 9

interface Page {
  uid: string
  title: string
}

const num = (v: number): string => v.toLocaleString('ja-JP')

export function cvDigest(input: {
  /** 今（UNIX秒） */
  now: number
  isOn: boolean
  pages: readonly Page[]
  conversions: readonly { id: number; ab_test_uid: string; occurred_at: number }[]
  runs: NotificationRuns
}): { runs: NotificationRuns; message: string | null } {
  const maxId = input.conversions.reduce((max, c) => Math.max(max, c.id), 0)
  const { runs } = input
  // 切っているあいだ・はじめて動くときは、目印だけ今のCVまで進める（昔のCVをまとめて送らない）
  if (!input.isOn || runs.cv_max_id === null) {
    const next = Math.max(maxId, runs.cv_max_id ?? 0)
    return { runs: next === runs.cv_max_id ? runs : { ...runs, cv_max_id: next }, message: null }
  }
  if (runs.cv_last_sent_at !== null && input.now - runs.cv_last_sent_at < CV_DIGEST_INTERVAL_SECONDS) {
    return { runs, message: null }
  }
  const watermark = runs.cv_max_id
  const fresh = input.conversions.filter((c) => c.id > watermark)
  if (fresh.length === 0) return { runs, message: null }

  const countByPage = new Map<string, number>()
  for (const c of fresh) countByPage.set(c.ab_test_uid, (countByPage.get(c.ab_test_uid) ?? 0) + 1)
  const lines = [...countByPage.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([uid, count]) => `${input.pages.find((p) => p.uid === uid)?.title ?? '（消したページ）'} ${num(count)}件`)
  return {
    runs: { ...runs, cv_max_id: Math.max(watermark, maxId), cv_last_sent_at: input.now },
    message: [`【新しいCV ${num(fresh.length)}件】`, ...lines].join('\n'),
  }
}

/** 暦の1日前（JST の日付キー同士の計算なので UTC で数える） */
function previousDay(key: string): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
}

export function dailyDigest(input: {
  now: JstNow
  isOn: boolean
  pages: readonly Page[]
  metrics: readonly DailyMetric[]
  runs: NotificationRuns
}): { runs: NotificationRuns; message: string | null } {
  const { runs, now } = input
  if (!input.isOn) return { runs, message: null }
  if (Number(now.hour) < DAILY_REPORT_HOUR || runs.daily_sent_for === now.date) return { runs, message: null }

  const yesterday = previousDay(now.date)
  const lines: string[] = []
  for (const page of input.pages) {
    const rows = input.metrics.filter((m) => m.entity_uid === page.uid && m.scope === 'ab_test' && m.date === yesterday)
    const kpi = deriveKpi(sumPrimary(rows))
    if (kpi.pv + kpi.click + kpi.cv + kpi.ad_cost === 0) continue
    const cvr = kpi.cvr === null ? '-' : `${(kpi.cvr * 100).toFixed(2)}%`
    lines.push(
      `${page.title}｜PV ${num(kpi.pv)} / CLICK ${num(kpi.click)} / CV ${num(kpi.cv)} / CVR ${cvr} / 配信金額 ${num(Math.round(kpi.ad_cost))}円`,
    )
  }
  const next = { ...runs, daily_sent_for: now.date }
  if (lines.length === 0) return { runs: next, message: null }
  return { runs: next, message: [`【デイリーレポート】${yesterday}`, ...lines].join('\n') }
}
