/**
 * 中間ページ設定の決まり（採取した中間ページ設定の画面に合わせる）。
 *   - リダイレクト時間の入力欄: min=0.1 / max=10 / step=0.1 / 初期値 0.4（秒）
 *   - リダイレクト先: 商品LP・クライアントLP などのURL。移動に使うので http / https の絶対URLだけを認める
 *     （javascript: などを入れると、中間ページを開いた人のブラウザでそのまま動いてしまう）
 */
export const REDIRECT_SECONDS = { min: 0.1, max: 10 } as const

/** リダイレクト時間の初期値（採取物の入力欄の value） */
export const DEFAULT_REDIRECT_SECONDS = 0.4

/** リダイレクト時間（秒）が設定画面の範囲に入っているか */
export function isRedirectSeconds(value: number): boolean {
  return value >= REDIRECT_SECONDS.min && value <= REDIRECT_SECONDS.max
}

/** リダイレクト先として使えるURLなら正規化して返す（使えなければ null） */
export function redirectDestination(raw: string): string | null {
  const text = raw.trim()
  if (text === '') return null
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
}
