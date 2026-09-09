/**
 * 「この訪問者にどのVersionを見せるか」の判定（delivery.ts から分離）。
 *
 * User-Agent から端末・OS・キャリアを見て、ポップアップの表示条件
 * （端末 / パラメータ / 時間帯 / 期間）に当てはまるかを決める。
 * 判定だけを持ち、HTMLは作らない。
 */

import type { Version } from '../store/types.ts'
export type DeviceKind = 'sp' | 'tablet' | 'pc'
export type MobileOS = 'android' | 'ios'
export type Carrier = 'docomo' | 'au' | 'softbank'
/** 訪問者の出し分け判定に使う文脈（1リクエストぶん） */
export interface VisitorContext {
  device: DeviceKind
  /** モバイルOS。PC等では null */
  mobileOS: MobileOS | null
  /** 回線キャリア。ブラウザだけでは判定不可のため通常 null。?__carrier= で検証用に指定可 */
  carrier: Carrier | null
  /** URLクエリ（流入元別の照合に使う） */
  query: Record<string, string>
  /** 現在時刻 HH:MM（時間別） */
  nowHHMM: string
  /** 今日 YYYY-MM-DD（日付別） */
  today: string
}
/** 訪問者のデバイスを User-Agent から判定する（sp / tablet / pc）。クライアント版と同じ判定式。 */
export function detectDevice(userAgent: string): DeviceKind {
  if (/iPad|Tablet|Nexus 7|Nexus 10|Kindle|Silk|PlayBook/i.test(userAgent)) return 'tablet'
  if (/Mobile|iPhone|Android.*Mobile|Windows Phone|iPod/i.test(userAgent)) return 'sp'
  return 'pc'
}
/** モバイルOSを User-Agent から判定（PC等は null） */
export function detectMobileOS(userAgent: string): MobileOS | null {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  return null
}
/** キャリアは通常判定不可。検証用に ?__carrier=docomo|au|softbank で指定できる。 */
export function detectCarrier(raw: unknown): Carrier | null {
  return raw === 'docomo' || raw === 'au' || raw === 'softbank' ? raw : null
}
/**
 * 現在の日本時間(JST)を HH:MM / YYYY-MM-DD で返す。
 * 時間別・日付別の出し分けは実SB（日本向けサービス）と同じく **日本時間**で判定する。
 * 本番サーバー(Railway)のTZはUTCなので、`new Date().getHours()` をそのまま使うと
 * 日本の日中でも時間帯条件が外れる（例: JST12:00=UTC03:00 が 06:00-22:00 の範囲外扱い）
 * バグになる。Intl でタイムゾーンを Asia/Tokyo に固定して判定する。
 */
export function jstNow(): { hhmm: string; today: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? ''
  const hour = get('hour') === '24' ? '00' : get('hour') // 一部環境で 24:xx を返すため丸める
  return { hhmm: `${hour}:${get('minute')}`, today: `${get('year')}-${get('month')}-${get('day')}` }
}
export function buildVisitorContext(req: import('express').Request): VisitorContext {
  const ua = req.headers['user-agent'] ?? ''
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(req.query)) {
    query[k] = Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '')
  }
  const { hhmm, today } = jstNow()
  return {
    device: detectDevice(ua),
    mobileOS: detectMobileOS(ua),
    carrier: detectCarrier(req.query['__carrier']),
    query,
    nowHHMM: hhmm,
    today,
  }
}
/** そのVersionが、指定デバイスへ配信可か（デバイス別ON/OFF）。未設定は全ON扱い。 */
export function targetsDevice(version: Version, device: DeviceKind): boolean {
  return version.device_targets?.[device] !== false
}
/** 流入元別: URLクエリが1件のルールに一致するか */
export function matchesParamRule(rule: { name: string; match: string; value: string }, query: Record<string, string>): boolean {
  const candidates = rule.name !== '' ? [query[rule.name]] : Object.values(query)
  for (const raw of candidates) {
    if (raw === undefined) continue
    if (rule.match === 'exact' && raw === rule.value) return true
    if (rule.match === 'prefix' && raw.startsWith(rule.value)) return true
    if (rule.match === 'suffix' && raw.endsWith(rule.value)) return true
    if (rule.match === 'contains' && raw.includes(rule.value)) return true
  }
  return false
}
/** 時間別: now が from〜to（HH:MM）内か。日をまたぐ範囲(22:00〜02:00)も許容 */
export function inTimeRange(now: string, from: string, to: string): boolean {
  if (from === '' || to === '') return true
  return from <= to ? now >= from && now <= to : now >= from || now <= to
}
/** 日付別: today が from〜to（YYYY-MM-DD、ISO文字列比較）内か */
export function inDatePeriod(today: string, from: string, to: string): boolean {
  if (from === '' && to === '') return true
  if (from !== '' && today < from) return false
  if (to !== '' && today > to) return false
  return true
}
/**
 * そのVersionが、この訪問者に配信可能か（6条件すべてを掛け算で判定）。
 * 各設定は「未設定＝制限なし（対象）」がデフォルト。デバイス別・パラメーター未登録は常に対象。
 */
export function isEligible(v: Version, ctx: VisitorContext): boolean {
  // デバイス別
  if (!targetsDevice(v, ctx.device)) return false
  // モバイルOS別: いずれかON指定があれば「モバイル かつ そのOS」のみ対象（PCは除外）
  if (v.os_targets && (v.os_targets.android || v.os_targets.ios)) {
    if (ctx.mobileOS === null) return false
    if (!v.os_targets[ctx.mobileOS]) return false
  }
  // キャリア別: 判定できた場合のみ適用（通常は判定不可＝スキップ＝対象）
  if (ctx.carrier !== null && v.carrier_targets && (v.carrier_targets.docomo || v.carrier_targets.au || v.carrier_targets.softbank)) {
    if (!v.carrier_targets[ctx.carrier]) return false
  }
  // 流入元別（旧パラメーター別）: ルールがあれば1件以上一致が必要。未登録は常に対象。
  if (v.param_rules && v.param_rules.length > 0) {
    if (!v.param_rules.some((r) => matchesParamRule(r, ctx.query))) return false
  }
  // 時間別: 範囲があれば1件以上に該当する時刻のみ対象
  if (v.time_ranges && v.time_ranges.length > 0) {
    if (!v.time_ranges.some((r) => inTimeRange(ctx.nowHHMM, r.from, r.to))) return false
  }
  // 日付別: off期間中は除外。on期間があれば on期間中のみ対象。期間無しは適用しない。
  if (v.date_periods && v.date_periods.length > 0) {
    const inOff = v.date_periods.some((p) => p.mode === 'off' && inDatePeriod(ctx.today, p.from, p.to))
    if (inOff) return false
    const onPeriods = v.date_periods.filter((p) => p.mode === 'on')
    if (onPeriods.length > 0 && !onPeriods.some((p) => inDatePeriod(ctx.today, p.from, p.to))) return false
  }
  return true
}
/**
 * 配信するVersionを配信割合どおりに選ぶ（指示173）。
 *
 * 配信割合0%のVersionは**絶対に配信しない**。
 * 以前は「割合1%以上の候補が無ければ割合を無視した候補へ落ちる」フォールバックがあり、
 * 全部0%のときや出し分け条件から外れたときに0%のVersionが表示されていた。
 * 重み付けも `Math.max(1, ratio)` で0%を1%扱いしていた。どちらも割合を裏切るのでやめる。
 *
 * 候補が無い場合は null を返し、呼び出し側が「配信できるVersionがありません」を出す。
 * 表示できるものを無理に探すより、割合設定どおりに「配信しない」が正しい。
 *
 * なおプレビュー(`/preview/:versionUid`)はVersionを直接指定して開くので、
 * 配信割合とは無関係に必ずそのVersionが出る（検証用途なのでこれが正しい）。
 */
export function pickDeliveryVersion(versions: readonly Version[], ctx: VisitorContext): Version | null {
  const pool = versions.filter(
    (v) => v.archived !== true && v.distribution_ratio >= 1 && isEligible(v, ctx),
  )
  if (pool.length === 0) return null
  const total = pool.reduce((sum, v) => sum + v.distribution_ratio, 0)
  if (total <= 0) return null
  let ticket = Math.random() * total
  for (const version of pool) {
    ticket -= version.distribution_ratio
    if (ticket <= 0) return version
  }
  // 浮動小数の誤差で最後まで残ったときは末尾（割合の合計を超えたケース）
  return pool[pool.length - 1] ?? null
}
