/**
 * 部品で作ったWidgetの「設定データ」をHTMLに持たせる（2026-09-23・本人の決定 D2）。
 *
 * 「部品を積んで作る」はいままで、LPに入れた瞬間に入力の中身（TemplateData）を捨てていた。
 * 以後は HTML/CSS を直接直すしかなく、見出しを足す・押したときを選ぶ・画面を足す ができなかった。
 * 書き出したHTMLのいちばん外の要素に `data-nc-data`（JSON）を持たせ、Widget編集で開き直したときに
 * 同じ入力の画面に戻せるようにする（Canva と同じ「作ったものは開き直せる」）。
 *
 *  - 画像・動画は data URL のまま JSON に入る。保存のとき mock-server/lib/uploads.ts が
 *    本文と同じ規則で別ファイル（/uploads/…）に置き換える（中身のハッシュが名前なので同じ画像は1ファイル）。
 *    そのため、開き直したときの画像は `/uploads/…` の形になる（kit.ts の safeImage / safeVideo が受け付ける）
 *  - 見本の部品（type: 'sample'）の中身（html）もそのまま JSON に入る
 *  - 属性の値は HTML の文字（& " < >）をエスケープして入れる。読むときは戻す
 *
 * DOM を使わない（テストは tests/nocode-builder-data.test.ts）。
 */
import type { Path } from './form-state.ts'
import { plainTextOfRich } from './rich-text.ts'
import { items, str, type ItemData, type TemplateData } from './templates/types.ts'

export const BUILDER_DATA_ATTR = 'data-nc-data'

/** 部品で作ったWidgetの外側（kit.ts wrapWidget の形。uid を取り出す） */
const BUILDER_ROOT = /<div class="nc nc-builder (nc-[a-z0-9]{8})" data-nocode="builder"/
const DATA_ATTR = new RegExp(` ${BUILDER_DATA_ATTR}="([^"]*)"`)

const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }

function escapeAttr(text: string): string {
  return text.replace(/[&"<>]/g, (ch) => ESCAPES[ch] ?? ch)
}

const NAMED: Readonly<Record<string, string>> = { amp: '&', quot: '"', lt: '<', gt: '>', apos: "'", nbsp: ' ' }

/**
 * 属性の値を元の文字に戻す。自分で書いた5つのほか、ブラウザが属性を書き出すときに使う
 * `&nbsp;` と数値の書き方（`&#39;` `&#x27;`）も戻す。
 */
export function unescapeAttr(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x')) return String.fromCodePoint(Number.parseInt(body.slice(2), 16))
    if (body.startsWith('#')) return String.fromCodePoint(Number(body.slice(1)))
    return NAMED[body] ?? whole
  })
}

/** 書き出したHTML（wrapWidget の形）に設定データを持たせる。外側が見つからなければそのまま */
export function embedBuilderData(html: string, data: TemplateData): string {
  const stripped = stripBuilderData(html)
  const root = BUILDER_ROOT.exec(stripped)
  if (root === null) return html
  const at = root.index + root[0].length
  return `${stripped.slice(0, at)} ${BUILDER_DATA_ATTR}="${escapeAttr(JSON.stringify(data))}"${stripped.slice(at)}`
}

/** 設定データを外す（部品を解除して HTML として直すとき） */
export function stripBuilderData(html: string): string {
  return html.replace(DATA_ATTR, '')
}

/** 設定データとして読める形か（画面の並びがある） */
function isBuilderData(value: unknown): value is TemplateData {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Array.isArray((value as TemplateData)['screens'])
}

/**
 * HTMLから設定データと Widget の名前（uid）を取り出す。
 * 部品で作っていない・設定データが無い・壊れているときは null（＝HTMLとして直す）。
 */
export function extractBuilderData(html: string): { data: TemplateData; uid: string } | null {
  const root = BUILDER_ROOT.exec(html)
  if (root === null) return null
  const uid = root[1] ?? ''
  // 属性はこの要素の開始タグの中だけを見る（見本の中身に同じ属性があっても取り違えない）
  const tagEnd = html.indexOf('>', root.index)
  const tag = html.slice(root.index, tagEnd === -1 ? undefined : tagEnd)
  const attr = DATA_ATTR.exec(tag)
  if (attr === null) return null
  try {
    const parsed: unknown = JSON.parse(unescapeAttr(attr[1] ?? ''))
    return isBuilderData(parsed) ? { data: parsed, uid } : null
  } catch {
    return null
  }
}

/** 書き出したHTMLから `<style>` を全部取り出す（見本の部品の `<style>` も含む）。残りが本文 */
export function splitStyles(html: string): { css: string; body: string } {
  const css: string[] = []
  const body = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (_whole, inner: string) => {
    css.push(inner)
    return ''
  })
  return { css: css.join('\n'), body }
}

/**
 * 書き出しの通し番号（`nc-b-12` の 12。画面をまたいで上から順）から、その部品の場所（path）。
 * builder.ts の render は画面の順に部品を数えるので、同じ数え方で探す。無ければ null
 */
export function blockPathAt(data: TemplateData, n: number): Path | null {
  let counter = 0
  const screens = items(data, 'screens')
  for (const [screenIndex, screen] of screens.entries()) {
    const blocks = items(screen, 'blocks')
    for (const blockIndex of blocks.keys()) {
      counter += 1
      if (counter === n) return ['screens', screenIndex, 'blocks', blockIndex]
    }
  }
  return null
}

/** 要素のクラス（`nc-b nc-b-heading nc-b-12`）から通し番号。無ければ null */
export function blockNumberOf(className: string): number | null {
  const m = /(?:^|\s)nc-b-(\d+)(?:\s|$)/.exec(className)
  return m === null ? null : Number(m[1])
}

/** 見本の <style>・<script>（sample-dom と同じ見分け方） */
const ASSET = /<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi
const LEADING_ASSETS = /^(?:\s*<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>)+/i
const TRAILING_ASSETS = /(?:<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>\s*)+$/i

/**
 * 見本の部品の中身を、見たまま画面（DOM）から読み戻すときの形。
 * 画面に出すときは <style> を外し、同じ見本を分けた部品の <script> は最初の1つしか出さないので、
 * 読み戻した本文には資産（<style>・<script>）が無い／欠けている。元の中身の資産をそのままの位置
 * （先頭のものは先頭・末尾のものは末尾）で付け直す（末尾のスクリプトは本文の後で動く決まりを保つ）。
 */
export function withSampleAssets(original: string, body: string): string {
  const leading = LEADING_ASSETS.exec(original)?.[0] ?? ''
  const trailing = TRAILING_ASSETS.exec(original)?.[0] ?? ''
  const inner = body.replace(ASSET, '')
  return `${leading}${inner}${trailing}`
}

/** 部品の呼び名に添える、いちばん最初の文字（見出しの文言・ボタンの文字・見本の名前）。飾りは外す */
export function blockSnippet(block: ItemData): string {
  const text = str(block, 'text') || str(block, 'label') || str(block, 'heading') || str(block, 'title')
  const line = plainTextOfRich(text).replace(/\s+/g, ' ').trim()
  return Array.from(line).slice(0, 18).join('')
}

/**
 * 設定データを持たないWidget（自作の見本・手で書いたHTML・以前の部品Widget）を、
 * 「見本の部品1つ」の設定データにする（2026-09-24・第3弾＝どのWidgetも同じ画面で直す）。
 * 見え方を変えないよう、Widget全体の余白は 0・背景は「なし」にする。
 */
export function wrapHtmlAsBuilder(html: string, title: string, defaults: TemplateData): TemplateData {
  return {
    ...defaults,
    padding: 0,
    background: 'none',
    screens: [{ id: 's1', name: '画面①', blocks: [{ type: 'sample', title, html }] }],
  }
}

const STYLE_BLOCK = /<style\b[^>]*>[\s\S]*?<\/style\s*>/gi

/**
 * 見本の部品のCSSを差し替える（「見た目の細かい設定」のカードから）。
 * 見本の <style> は全部外して、先頭に1つにまとめて置く（複数あっても並び順は保たれるので効き方は同じ）。
 */
export function replaceSampleCss(html: string, css: string): string {
  const body = html.replace(STYLE_BLOCK, '')
  return `<style>${css}</style>${body}`
}
