/**
 * 「型から作る」の書き出しの土台（2026-09-22・本人の依頼。ノーコードでWidgetを作る③）。
 *
 * 入力欄に書いた文字・リンク・色・画像を、LPに入れても安全なHTMLにする。
 *  - 文字はすべてエスケープする。<script> の中や onclick などには入力を一切入れない
 *    （エスケープ済みの文字でも、JSとして読み直されると効いてしまう＝KB xss-onclick-esc）。
 *    動きが要る型のスクリプトは固定の文で、設定は data-* 属性から読む
 *  - リンクは使えるもの（http・https・mailto・tel・ページ内の#）だけ（shared/link-html.ts と同じ判定）
 *  - 色は #RRGGBB だけ、画像は選んだファイル（data:image/…;base64）だけ。CSS に入るのはこの2つと数字だけ
 *
 * DOMを使わない（テストは tests/nocode-kit.test.ts）。
 */
import { TRACKING_ATTRIBUTE, isAllowedLinkUrl, isTelHref, withTrackingParam } from '../../../../shared/link-html.ts'

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** HTMLとして読まれる文字をエスケープする（本文にも属性の値にも使える） */
export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch)
}

/** 複数行の文字（改行は <br>） */
export function textHtml(text: string): string {
  return esc(text.trim()).replace(/\r?\n/g, '<br>')
}

/**
 * リンクの属性（先頭に空白つき）。
 * 使えないURL・空は `#`。「クリック数をレポートで数える」は今のリンク設定と同じ目印を付ける
 * （http(s) は URL に sb_tracking=true、電話は data-sb-tracking 属性）。ページ内の # には付けない。
 */
export function linkAttrs(url: string, options: { track: boolean; newTab: boolean }): string {
  const trimmed = url.trim()
  if (trimmed === '' || !isAllowedLinkUrl(trimmed)) return ' href="#"'
  const isAnchor = trimmed.startsWith('#')
  const isTel = isTelHref(trimmed)
  const href = isAnchor || isTel ? trimmed : withTrackingParam(trimmed, options.track)
  const tracking = isTel && options.track ? ` ${TRACKING_ATTRIBUTE}="true"` : ''
  const newTab = options.newTab && !isAnchor && !isTel ? ' target="_blank" rel="noopener"' : ''
  return ` href="${esc(href)}"${tracking}${newTab}`
}

/** #RRGGBB だけ受け付ける（大文字にそろえる）。それ以外は fallback */
export function safeColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback
}

const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/]+=*$/
/**
 * 保存のときに別ファイルへ出された画像（mock-server/lib/uploads.ts。名前は中身のハッシュ）。
 * 部品で作ったWidgetを開き直したとき（builder-data.ts）、設定データの画像はこの形になっている
 */
const UPLOADED_IMAGE = /^\/uploads\/[0-9a-f]{64}\.(png|jpg|gif|webp|avif)$/

/** 選んだ画像ファイル（data:image/…;base64）か、保存で別ファイルになった画像（/uploads/…）だけ。それ以外は空 */
export function safeImage(value: string): string {
  return DATA_IMAGE.test(value) || UPLOADED_IMAGE.test(value) ? value : ''
}

/** mp4・webm だけ（保存のときに別ファイルへ出せる形＝mock-server/lib/uploads.ts と同じ） */
const DATA_VIDEO = /^data:video\/(mp4|webm);base64,[A-Za-z0-9+/]+=*$/
const UPLOADED_VIDEO = /^\/uploads\/[0-9a-f]{64}\.(mp4|webm)$/

/** 選んだ動画ファイル（data:video/mp4・webm;base64）か、保存で別ファイルになった動画だけ。それ以外は空 */
export function safeVideo(value: string): string {
  return DATA_VIDEO.test(value) || UPLOADED_VIDEO.test(value) ? value : ''
}

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex(values: readonly number[]): string {
  return `#${values.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** 濃くする（-1〜0＝黒へ）・薄くする（0〜1＝白へ） */
export function shade(hex: string, amount: number): string {
  return toHex(channels(hex).map((c) => (amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)))
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 白い文字とのコントラスト比 */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05)
}

/** 濃い文字（淡い地に載せる） */
export const INK_DARK = '#1F2A37'

/**
 * 地の色の上に載せる文字色。
 * ボタンのように太く大きい文字は、白が読める限り白にする（LINEの緑のような明るいブランド色でも白が定番）。
 * 白が読めないほど淡い地（黄色・薄いグレーなど）は濃い色にする。
 */
export function inkOn(hex: string): string {
  return contrastWithWhite(hex) >= 2.2 ? '#FFFFFF' : INK_DARK
}

/** Widgetごとの名前（CSSをこのWidgetの中だけに効かせるクラス）。毎回ちがう */
export function newUid(): string {
  const bytes = new Uint8Array(8)
  globalThis.crypto.getRandomValues(bytes)
  // 1バイトごとに 0-9a-z の1文字（36進数）
  return `nc-${Array.from(bytes, (b) => (b % 36).toString(36)).join('')}`
}

/**
 * どの型にも付ける土台のCSS（このWidgetの中だけ）。
 * 見出しは最後の行に数文字だけ残らないよう balance にする（ui-forge text-wrap-balance-cjk-orphan）。
 * isolate を渡すと、その中（ライブラリの見本など、自分のCSSで描く部分）には土台を効かせない。
 */
export function baseCss(scope: string, isolate?: string): string {
  const not = isolate === undefined ? '' : `:not(${isolate} *)`
  return (
    `${scope}{box-sizing:border-box;margin:0;padding:28px 16px;color:${INK_DARK};line-height:1.7;` +
    `font-size:15px;font-family:inherit;text-align:left}` +
    `${scope} *${not},${scope} *${not}::before,${scope} *${not}::after{box-sizing:border-box}` +
    `${scope} img${not}{max-width:100%;height:auto;display:block}` +
    `${scope} [hidden]${not},${scope}[hidden]{display:none !important}` +
    // 画面には出さず、読み上げだけで伝える文字（◎→「とても良い」など）
    `${scope} .nc-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}` +
    `${scope} h2${not},${scope} h3${not},${scope} p${not}{margin:0}` +
    // 見出しは行の長さをそろえ、対応するブラウザでは言葉の切れ目で折り返す（「メー／ルのみ」のように語の途中で切らない）
    `${scope} h2${not},${scope} h3${not}{text-wrap:balance;word-break:auto-phrase}` +
    `${scope} .nc-title{font-size:22px;font-weight:800;line-height:1.45;text-align:center;margin:0 0 20px}`
  )
}

/** 見出し（空なら出さない） */
export function titleHtml(title: string): string {
  const text = title.trim()
  return text === '' ? '' : `<h2 class="nc-title">${esc(text)}</h2>`
}

/**
 * Widget 1つぶんのHTML。
 * 外側に型の名前（data-nocode）とこのWidgetだけのクラスを付ける。
 * attrs は型が決まった値だけで組み立てた属性（先頭に空白）。スクリプトは固定の文だけを受け取る。
 */
export function wrapWidget(parts: {
  uid: string
  type: string
  css: string
  body: string
  attrs?: string
  script?: string
}): string {
  const script = parts.script === undefined ? '' : `<script>${parts.script}</script>`
  return (
    `<style>${parts.css}</style>` +
    `<div class="nc nc-${parts.type} ${parts.uid}" data-nocode="${esc(parts.type)}"${parts.attrs ?? ''}>${parts.body}</div>` +
    script
  )
}

/** 型で作ったWidgetの外側（型の名前・このWidgetの名前） */
const ROOT_UID = /<div class="nc nc-[a-z]+ (nc-[a-z0-9]{8})" data-nocode="/

/**
 * 型で作ったWidgetの名前（CSSのクラス）を付け直す。型で作っていないWidgetはそのまま返す。
 * 「作成したWidget」から同じものを何度入れても、1つずつ別の名前になる
 * （同じ名前だと、LPの中で片方の色を変えたときにもう片方も変わる）。
 */
export function rekeyUid(html: string, next: string): string {
  const current = ROOT_UID.exec(html)?.[1]
  if (current === undefined) return html
  return html.replace(new RegExp(`\\b${current}\\b`, 'g'), next)
}
