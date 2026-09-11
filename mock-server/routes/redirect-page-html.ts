/**
 * 中間ページ（`/redirect_pages/:uid`）の応答HTML（純粋関数）。
 *
 * 採取した中間ページ設定の画面の説明どおりに動かす:
 *   - タグ（一括タグ設定の範囲に入るタグ ＋ この中間ページのタグ）を読み込み、
 *     「リダイレクト時間」待ってから「リダイレクト先」へ移動する
 *     （待つのはタグが送信を終えるため。推奨: SmartNews・Gunosy は0.4秒、TikTok Ads は1秒）
 *   - 「リファラー設定」: Version なら移動先に Version のURL（このクローンでは配信URL `/lp/:uid`）を、
 *     中間ページなら中間ページのURLを「どこから来たか」として渡す
 * 画面には何も出さない（白いページのまま移動する）。
 */
import { escapeHtml } from './delivery-notice.ts'

export interface RedirectPageHtmlInput {
  /** タブに出る題名（beyondページのページタイトル） */
  readonly title: string
  /** 移動先（検証済みの http / https の絶対URL） */
  readonly destination: string
  /** 移動するまでの秒数 */
  readonly redirectSeconds: number
  /** リファラーを Version のURLにするときの、そのパス（中間ページのURLのまま渡すときは null） */
  readonly versionPath: string | null
  readonly headTags: string
  readonly bodyTags: string
  readonly noindex: boolean
}

/** <script> の中に文字列を埋める（`</script>` で抜け出させないよう `<` も逃がす） */
function scriptString(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function buildRedirectPageHtml(input: RedirectPageHtmlInput): string {
  const waitMs = Math.round(input.redirectSeconds * 1000)
  // 移動の直前に、このページのURLを Version のURLへ書き換える（移動先へ渡る「どこから来たか」がそのURLになる）
  const rewriteReferrer =
    input.versionPath === null ? '' : `history.replaceState(null,'',${scriptString(input.versionPath)});`
  return (
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    (input.noindex ? '<meta name="robots" content="noindex,nofollow">' : '') +
    // 移動先へURLのパスまで渡す。ブラウザ既定だと別サイトにはドメインしか渡らず、リファラー設定の違いが伝わらない
    `<meta name="referrer" content="no-referrer-when-downgrade">` +
    `<title>${escapeHtml(input.title)}</title>` +
    input.headTags +
    // JavaScript が動かない環境でも移動はする（その場合タグは動かない）
    `<noscript><meta http-equiv="refresh" content="${input.redirectSeconds};url=${escapeHtml(input.destination)}"></noscript>` +
    `</head><body style="margin:0;background:#fff">` +
    input.bodyTags +
    `<script>setTimeout(function(){${rewriteReferrer}location.replace(${scriptString(input.destination)})},${waitMs})</script>` +
    `</body></html>`
  )
}
