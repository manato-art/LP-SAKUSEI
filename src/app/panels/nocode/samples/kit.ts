/**
 * 自作の見本（新しい見本）の土台（2026-09-23・本人の依頼「SB由来の見本は使い勝手が悪いので作り直す」）。
 *
 * 決定（AskUserQuestion 2026-09-23）: **白地・余白広め・素直な形**。どのLPに入れても浮かない中立な作り。
 *  - 色はWidgetごとに1色だけ（角丸カード＋色付き左線のような定番の型は使わない）
 *  - 絵文字は使わない（印は固定のSVG）
 *  - 外から読み込むもの（フォント・スクリプト・画像URL）はゼロ。1つのHTMLだけで完結する
 *  - CSSは必ずこのWidgetの名前（`.nc-xxxxxxxx`）の中だけ。LPに入れるたび `rekeyUid` で名前を付け直せる形にする
 *  - 画像は data: の仮の絵。入れた人が「画像を変える」で差し替える前提
 * 見本そのものは samples/*.ts、一覧は samples/index.ts（テストは tests/nocode-new-samples.test.ts）。
 */

/** 文字色（濃い＝本文）・淡い文字・細い線。どの見本でも共通 */
export const INK = '#1F2A37'
export const INK_SUB = '#5B6572'
export const LINE = '#D8DEE6'
export const LINE_LIGHT = '#EDF0F3'

/**
 * どの見本にも敷く土台のCSS（このWidgetの中だけ）。
 * `[hidden]` は `display:none !important` で押さえる（画面の切り替えはこの属性で行うので、
 * 見本自身のCSSが display を指定していると hidden が負ける）。
 */
export function sampleBase(uid: string): string {
  const s = `.${uid}`
  return (
    `${s}{box-sizing:border-box;margin:0;padding:32px 16px;background:#FFFFFF;color:${INK};` +
    `font-family:inherit;font-size:15px;line-height:1.75;text-align:left;letter-spacing:.01em}` +
    `${s} *,${s} *::before,${s} *::after{box-sizing:border-box}` +
    `${s} h2,${s} h3,${s} p,${s} ul,${s} li,${s} figure{margin:0;padding:0}` +
    `${s} li{list-style:none}` +
    `${s} img{max-width:100%;height:auto;display:block}` +
    `${s} [hidden]{display:none !important}` +
    // 見出しは最後の行に数文字だけ残さない（ui-forge text-wrap-balance-cjk-orphan）
    `${s} h2,${s} h3{text-wrap:balance;word-break:auto-phrase}`
  )
}

const svg = (body: string, stroke = '2'): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

/** 右向きの山形（選択肢・ボタンの右端） */
export const CHEVRON_RIGHT = svg('<polyline points="9 5 16 12 9 19"/>', '2.4')
/** 左向きの山形（もどる） */
export const CHEVRON_LEFT = svg('<polyline points="15 5 8 12 15 19"/>', '2.4')
/** チェック（安心材料の行頭） */
export const CHECK = svg('<polyline points="4 12.5 9.5 18 20 6.5"/>', '2.6')
/** 右向きの矢印（ボタンの右端） */
export const ARROW_RIGHT_LABEL = svg('<line x1="4" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>', '2.6')

/** 星（お客様の声の評価） */
export const STAR =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4 6.2 20.4l1.1-6.4L2.6 9.4l6.5-.9z"/></svg>'

/**
 * 見出し＋リード（どの見本でも同じ形・同じ大きさ）。
 * 見出しは真ん中、リードは薄い文字。リードが空なら出さない。
 */
export function headCss(uid: string): string {
  const s = `.${uid}`
  return (
    `${s} .nsx-title{font-size:21px;font-weight:800;line-height:1.5;text-align:center;margin:0 0 6px}` +
    `${s} .nsx-lead{font-size:14px;line-height:1.85;color:${INK_SUB};text-align:center;margin:0 0 24px}` +
    `@media (max-width:480px){${s} .nsx-title{font-size:19px}}`
  )
}

export function head(title: string, lead = ''): string {
  return `<h2 class="nsx-title">${title}</h2>` + (lead === '' ? '' : `<p class="nsx-lead">${lead}</p>`)
}

/** 仮の画像（入れた人が「画像を変える」で差し替える前提の灰色の絵） */
export const IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='100%25' height='100%25' fill='%23ededed'/%3E%3Ctext x='50%25' y='50%25' fill='%23a8a8a8' font-family='sans-serif' font-size='15' text-anchor='middle' dominant-baseline='middle'%3E画像%3C/text%3E%3C/svg%3E"

/**
 * 見本の分け方（ライブラリの左の一覧に出る順）。
 * 100種まで増やす前提なので、1つの画面に全部は出さず、ここで選んで絞る（2026-09-23・本人の依頼）。
 * 並びはLPの上から下＋道具類。
 */
export const SAMPLE_CATEGORIES = [
  '冒頭・つかみ',
  '悩み・共感',
  '特徴・価値',
  '説明・使い方',
  '信頼・実績',
  '比較・違い',
  '料金・プラン',
  '申し込み・CTA',
  'よくある質問',
  'アンケート・診断',
  '限定・急ぎ',
  '文章・区切り',
  '画像・動画',
  'フッター・注意書き',
] as const

export type SampleCategory = (typeof SAMPLE_CATEGORIES)[number]

/** 見本1つ（ライブラリのカードに出す） */
export interface NewSample {
  /** 種類の名前（英小文字とハイフン）。カードの並び順はこの一覧の順 */
  readonly id: string
  /** 左の一覧のどこに出すか */
  readonly category: SampleCategory
  /** カードに出す名前 */
  readonly name: string
  /** カードの下に出す一言 */
  readonly summary: string
  /** LPに入れるHTML（`<style>` ＋ `<div class="nc nc-sample nc-xxxxxxxx" data-nocode="sample">` ＋ 必要なら `<script>`） */
  readonly html: string
}

/**
 * Widget 1つぶんのHTML。名前（uid）は `nc-` ＋ 8文字（`rekeyUid` が付け直せる形）。
 * 画面①②…を持つ見本は screens に切り替えのスクリプトを渡す。
 */
export function sampleHtml(parts: {
  uid: string
  css: string
  body: string
  /** 画面①②…を持つ見本（切り替わり方と、固定の切り替えスクリプト） */
  screens?: { transition: 'none' | 'fade' | 'slide'; script: string }
}): string {
  const screens = parts.screens === undefined ? '' : ` data-nc-screens="" data-nc-transition="${parts.screens.transition}"`
  const script = parts.screens === undefined ? '' : `<script>${parts.screens.script}</script>`
  return (
    `<style>${sampleBase(parts.uid)}${parts.css}</style>` +
    `<div class="nc nc-sample ${parts.uid}" data-nocode="sample"${screens}>${parts.body}</div>` +
    script
  )
}

/** 画面1つ（画面①②…を持つ見本の中身） */
export function screen(id: string, name: string, body: string, options: { first?: boolean } = {}): string {
  const hidden = options.first === true ? '' : ' hidden=""'
  return `<div class="nc-screen" data-nc-screen="${id}" data-nc-name="${name}"${hidden}>${body}</div>`
}
