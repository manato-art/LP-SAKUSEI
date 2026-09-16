/**
 * リンク切れの見張り（2026-09-16・本人の依頼）。
 *
 * LPのボタンの飛び先（カート・申込フォーム・ASPのリンク）が開けなくなったら知らせる。
 * 「CVが止まった」は数時間たってから気づく仕組みなので、その前に気づけるようにする。
 * そのあいだも広告費は出ていく。
 *
 * ⚠️ このシステムだけの機能（実物のSquadBeyondには無い）。異常のお知らせの一部として動く。
 *
 * 作りで気をつけたこと:
 *  - **鳴らしすぎない**。1回開けなかっただけでは知らせず、1分後にもう一度確かめて、
 *    2回続けて開けなかったら知らせる。同じページは1日1通まで
 *  - **ボット対策の門前払い（401・403・429・Cloudflareの確認画面）を「リンク切れ」と言わない**。
 *    本当に壊れている（404・410・5xx・つながらない・応答が無い・転送がループ）ときだけ
 *  - **ASPのクリック数を汚さない**。HEADで確かめ、ボットと名乗る（多くの計測はHEADもボットも数えない）
 *  - 転送のたびに行き先を検査する（LPに書かれたリンクを辿るので、内部のアドレスへ飛ばされる穴を塞ぐ）
 *  - 見るのは**実際に見られているリンクだけ**（直近7日にPVがあるページの、公開中で配信割合が0より大きいVersion）。
 *    配信ステータスでは決めない（本番は全ページ「準備中」のまま配信している）
 */
import { ExternalPageError, assertFetchable } from './external-page.ts'
import { isWatchable, slotOf, type Alert } from './alerts.ts'
import { isWithin } from './store/metrics.ts'
import { isTrackingLink } from '../src/shared/link-html.ts'
import type { State } from './store/types.ts'

/** 開けていたリンクを次に確かめるまで */
export const LINK_CHECK_INTERVAL_MS = 10 * 60 * 1000
/** 開けなかったリンクを確かめ直すまで（一時的な不調かを見分ける） */
export const LINK_RECHECK_MS = 60 * 1000
/** 何回続けて開けなかったら知らせるか */
export const FAILURES_TO_ALERT = 2
/** 1本あたりの待ち時間 */
const TIMEOUT_MS = 10_000
/** 転送を何回まで追うか（ASPのリンクは2〜3回転送されるのが普通） */
const MAX_REDIRECTS = 5
/** 名乗り。ASPや計測の多くは bot を含むUAを数えない */
const USER_AGENT = 'Mozilla/5.0 (compatible; LP-SAKUSEI-LinkCheckBot/1.0)'

export type LinkVerdict = 'ok' | 'broken' | 'unknown'

export interface LinkProbe {
  verdict: LinkVerdict
  /** 知らせに書く理由（HTTP 404 / つながりません など） */
  reason: string
}

export interface LinkCheck {
  url: string
  /** 続けて開けなかった回数（開けたら0に戻る） */
  failures: number
  last_reason: string
  /** 次に確かめる時刻（ミリ秒） */
  next_check_at: number
}

export interface LinkTarget {
  abTestUid: string
  title: string
  urls: string[]
}

/** HTMLに書かれた属性値を元の文字に戻す（&amp; のままだと別のURLを確かめてしまう） */
function decodeAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** LP本文から、計測機能付きリンク（http/https）の飛び先を拾う。同じものは1つにまとめる */
export function trackedLinksOf(html: string): string[] {
  const found = new Set<string>()
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi)) {
    const href = decodeAttribute((match[1] ?? match[2] ?? '').trim())
    if (!/^https?:\/\//i.test(href)) continue
    if (!isTrackingLink(href, null)) continue
    found.add(href)
  }
  return [...found]
}

/** 「見られているページ」とみなす期間（日）。CVが止まった判定の「もともと来ていた」と揃える */
const RECENT_VIEW_DAYS = 7

/** today（JSTのYYYY-MM-DD）から days 日前の日付 */
function daysBefore(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * 見張る対象（実際に見られているページの、見られているVersionのリンク）。
 *
 * 「見られている」は**配信ステータスではなく直近7日のPV**で決める（2026-09-16に修正）。
 * 本番は全ページが「準備中」のまま配信されていて、ステータスで決めると何も見張れなかった。
 * 誰も見ていないページのリンクを叩き続けない（相手のサーバーやASPのクリック数に触れる理由が無い）。
 */
export function linkTargets(state: State, today: string): LinkTarget[] {
  const since = daysBefore(today, RECENT_VIEW_DAYS - 1)
  const viewed = new Set(
    state.metrics
      .filter((m) => m.scope === 'ab_test' && m.pv > 0 && isWithin(m.date, since, today))
      .map((m) => m.entity_uid),
  )
  const out: LinkTarget[] = []
  for (const page of state.abTests) {
    if (!isWatchable(page) || !viewed.has(page.uid)) continue
    const articleIds = new Set(state.articles.filter((a) => a.ab_test_id === page.id).map((a) => a.id))
    const urls = new Set<string>()
    for (const version of state.versions) {
      if (!articleIds.has(version.article_id)) continue
      if (version.status !== '公開中' || version.archived || version.distribution_ratio <= 0) continue
      for (const url of trackedLinksOf(version.html)) urls.add(url)
    }
    if (urls.size > 0) out.push({ abTestUid: page.uid, title: page.title, urls: [...urls] })
  }
  return out
}

/** 応答を「開けている／リンク切れ／分からない」に分ける */
export function classifyResponse(status: number, headers: Headers): LinkVerdict {
  // Cloudflare の確認画面。人には開けているので、壊れているとは言えない
  if (headers.has('cf-mitigated')) return 'unknown'
  if (status >= 200 && status < 400) return 'ok'
  if (status === 404 || status === 410 || status >= 500) return 'broken'
  // 401・403・429 などはボット対策の門前払いのことが多い
  return 'unknown'
}

export interface ProbeOptions {
  fetch?: typeof fetch
  /** 取りに行ってよい宛先かの検査（テストで差し替える） */
  guard?: (url: URL) => Promise<void>
  timeoutMs?: number
}

/** リンクを1本確かめる。失敗は投げずに結果で返す（1本の失敗で見張り全体を止めない） */
export async function probeLink(rawUrl: string, options: ProbeOptions = {}): Promise<LinkProbe> {
  const doFetch = options.fetch ?? fetch
  const guard = options.guard ?? assertFetchable
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS)

  const request = (url: URL, method: 'HEAD' | 'GET'): Promise<Response> =>
    doFetch(url.toString(), {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' },
    })

  try {
    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      return { verdict: 'broken', reason: 'URLの形が正しくありません' }
    }
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      try {
        await guard(url)
      } catch (error) {
        // ドメインが見つからないのは、期限切れドメインなどの典型的なリンク切れ
        if (error instanceof ExternalPageError && error.code === 'dns_failed') {
          return { verdict: 'broken', reason: `ドメインが見つかりません（${url.hostname}）` }
        }
        // 内部のアドレスなど、取りに行ってはいけない宛先。確かめられないだけで、壊れているとは言えない
        return { verdict: 'unknown', reason: '確かめられない宛先です' }
      }
      let res = await request(url, 'HEAD')
      // HEADを受け付けないサーバーもある。そのときだけGETで確かめ直す（本文は読まない）
      if (res.status === 405 || res.status === 501) {
        res = await request(url, 'GET')
        void res.body?.cancel()
      }
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (location === null || location === '') return { verdict: 'broken', reason: `HTTP ${res.status}（転送先がありません）` }
        url = new URL(location, url)
        continue
      }
      return { verdict: classifyResponse(res.status, res.headers), reason: `HTTP ${res.status}` }
    }
    return { verdict: 'broken', reason: '転送が多すぎます（ループしている可能性）' }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { verdict: 'broken', reason: '応答がありません（10秒）' }
    }
    return { verdict: 'broken', reason: 'つながりません' }
  } finally {
    clearTimeout(timer)
  }
}

/** 確かめた結果を記録する（元の配列は書き換えない） */
export function recordProbe(
  checks: readonly LinkCheck[],
  url: string,
  probe: LinkProbe,
  nowMs: number,
): LinkCheck[] {
  const before = checks.find((c) => c.url === url)
  const failures =
    probe.verdict === 'broken'
      ? (before?.failures ?? 0) + 1
      : probe.verdict === 'ok'
        ? 0
        : (before?.failures ?? 0)
  const next: LinkCheck = {
    url,
    failures,
    last_reason: probe.reason,
    // 開けなかったら早めに確かめ直す（一時的な不調かを見分ける）
    next_check_at: nowMs + (probe.verdict === 'broken' ? LINK_RECHECK_MS : LINK_CHECK_INTERVAL_MS),
  }
  return before === undefined ? [...checks, next] : checks.map((c) => (c.url === url ? next : c))
}

/** 2回続けて開けなかったリンクがあるページを、ページごとに1通の知らせにまとめる */
export function findBrokenLinkAlerts(input: {
  /** 今（UNIX秒） */
  now: number
  targets: readonly LinkTarget[]
  checks: readonly LinkCheck[]
  sentSlots: readonly string[]
}): Alert[] {
  const sent = new Set(input.sentSlots)
  const byUrl = new Map(input.checks.map((c) => [c.url, c]))
  const out: Alert[] = []
  for (const target of input.targets) {
    const broken = target.urls
      .map((url) => byUrl.get(url))
      .filter((c): c is LinkCheck => c !== undefined && c.failures >= FAILURES_TO_ALERT)
    if (broken.length === 0) continue
    const slot = slotOf(input.now, target.abTestUid, 'link_broken')
    if (sent.has(slot)) continue
    out.push({
      ab_test_uid: target.abTestUid,
      kind: 'link_broken',
      slot,
      message: [
        `【リンクが開けません】${target.title}`,
        ...broken.map((c) => `・${c.url} → ${c.last_reason}`),
        '広告を止めるか、リンクを直してください。',
      ].join('\n'),
    })
  }
  return out
}
