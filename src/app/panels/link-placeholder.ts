/**
 * 見本のボタンのリンク先が「仮」のままか（2026-09-22・本人の決定「単独のボタンはリンクのまま残し、リンク先を入れやすくする」）。
 *
 * SquadBeyond の見本は、リンク先を後から入れる前提で ooooo・○○○○○・◯◯◯◯・〇〇〇〇〇・# などが入っている
 * （全件の点検で約450件）。LPに入れたまま押すと行き止まりのページへ飛ぶので、Widget編集で「仮のリンク」と知らせ、
 * その場でリンク先を入れられるようにする（widget-link-bubble.ts）。
 * 匿名化で架空になったリンク先（…example.test）も、行き先が無いので仮と見なす。
 */
import { isAllowedLinkUrl, isTelHref, isTrackingLink, withTrackingParam } from '../../shared/link-html.ts'

const PLACEHOLDER_HREF =
  /^(?:o{2,}|[○◯〇]{2,}|#{1,3}|(?:%E2%97%(?:8B|AF))+|(?:%E3%80%87)+|リンクURL|サイトのURLを入力してください)$/i

export function isPlaceholderHref(href: string | null): boolean {
  const value = (href ?? '').trim()
  if (value === '') return true
  if (PLACEHOLDER_HREF.test(value)) return true
  // 匿名化で架空になった行き先（SBの置き場・誰かのページ）
  return /(?:^|[/.])example\.test(?:[/:?#]|$)/i.test(value)
}

/** Widget の中の「リンク先が仮のままのボタン」の数（押すと画面が変わるボタンと、スクリプトの中は数えない） */
export function placeholderLinkCount(html: string): number {
  const visible = html.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
  let count = 0
  for (const match of visible.matchAll(/<a\b([^>]*)>/gi)) {
    const attrs = match[1] ?? ''
    if (/\sdata-nc-go="/i.test(attrs)) continue
    const href = /\shref="([^"]*)"/i.exec(attrs)?.[1]
    if (href !== undefined && isPlaceholderHref(href)) count += 1
  }
  return count
}

/**
 * リンク先を入れ替えた href。開けない形（javascript: 等）や空なら null。
 * 計測の目印（sb_tracking）は元のリンクに合わせる（見本の部品の「リンク先」と同じ決まり）。
 * ページ内の場所（#…）・電話・メールはそのまま。
 */
export function replacedHref(current: string, trackingAttribute: string | null, input: string): string | null {
  const url = input.trim()
  if (url === '' || !isAllowedLinkUrl(url)) return null
  if (url.startsWith('#') || isTelHref(url) || /^mailto:/i.test(url)) return url
  return withTrackingParam(url, isTrackingLink(current, trackingAttribute))
}
