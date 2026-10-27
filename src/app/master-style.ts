/**
 * 記事設定（Version設定 / MasterStyleSheet）を**LPの見た目へ反映**するためのCSS生成。
 *
 * 記事設定モーダルは値を保存するだけで、これまで配信/プレビュー/編集画面に反映されていなかった。
 * ここで sheet → CSS に変換し、配信ページ・プレビュー・エディタ本文へ適用する。
 *
 * 色は実機仕様で `#` なしの6桁（例 `000000`）なので、CSSにするとき `#` を補う。
 */
export interface MasterStyleSheet {
  readonly font_size: number | null
  readonly font_family: string
  readonly color: string
  readonly text_align: string
  readonly line_height: number | null
  readonly letter_spacing: number | null
  readonly img_margin_top: number | null
  readonly img_margin_bottom: number | null
  readonly padding_top: number | null
  readonly padding_bottom: number | null
  readonly padding_right: number | null
  readonly padding_left: number | null
  readonly iframe_height: number | null
  readonly iframe_height_unit: string
  readonly delivery_version_width: number | null
  readonly delivery_version_width_unit: string
  readonly border_size: number | null
  readonly border_type: string
  readonly border_color: string
  readonly outer_background_color: string
  readonly outer_background_image: string
  readonly inner_background_color: string
  readonly inner_background_image: string
}

/**
 * 背景が動画か（2026-10-27 本人「画像を入れられる所は動画も」→「記事設定の背景も動画OK」）。
 * 選んだ動画は保存で /uploads/…mp4 になる（panel-version-settings.ts）。data:video/… のままでも動画として扱う
 */
export function isVideoBackground(url: string): boolean {
  return /^data:video\//i.test(url) || /\.(?:mp4|webm|ogv|mov|m4v)(?:[?#]|$)/i.test(url)
}


function hex(value: string): string | null {
  return value !== '' && /^[0-9a-fA-F]{3,8}$/.test(value) ? `#${value}` : null
}

/** 本文コンテナ（body / エディタ本文）に当てる宣言。 */
function containerDecls(s: MasterStyleSheet): string[] {
  const d: string[] = []
  if (s.font_size !== null) d.push(`font-size:${s.font_size}px`)
  if (s.font_family !== '') d.push(`font-family:${s.font_family}`)
  const c = hex(s.color)
  if (c !== null) d.push(`color:${c}`)
  if (s.text_align !== '' && s.text_align !== undefined) d.push(`text-align:${s.text_align}`)
  if (s.line_height !== null) d.push(`line-height:${s.line_height}`)
  if (s.letter_spacing !== null) d.push(`letter-spacing:${s.letter_spacing}px`)
  const pt = s.padding_top ?? 0
  const pb = s.padding_bottom ?? 0
  const pr = s.padding_right ?? 0
  const pl = s.padding_left ?? 0
  d.push(`padding:${pt}px ${pr}px ${pb}px ${pl}px`)
  if (s.border_size !== null && s.border_type !== '') {
    d.push(`border:${s.border_size}px ${s.border_type} ${hex(s.border_color) ?? '#000000'}`)
  }
  const ibc = hex(s.inner_background_color)
  if (ibc !== null) d.push(`background-color:${ibc}`)
  // 画像・動画は CSS の背景にしない（いちばん後ろの層で敷く＝masterStyleBackgroundHtml）
  return d
}

/** 画像の上下余白。 */
function imgDecls(s: MasterStyleSheet): string[] {
  const d: string[] = []
  if (s.img_margin_top !== null) d.push(`margin-top:${s.img_margin_top}px`)
  if (s.img_margin_bottom !== null) d.push(`margin-bottom:${s.img_margin_bottom}px`)
  return d
}

/** ページ全体（html＝全体背景）。 */
function outerDecls(s: MasterStyleSheet): string[] {
  const d: string[] = []
  const obc = hex(s.outer_background_color)
  if (obc !== null) d.push(`background-color:${obc}`)
  return d
}

/**
 * 記事設定の背景の画像・動画の層の CSS（2026-10-27 本人選択「画面に固定した壁紙にする」）。
 * どちらも画面に固定していちばん後ろに敷き、文字や画像だけが上を流れる（長いLPでも画像を引き伸ばさない）。
 *   全体背景      … 画面いっぱい（本文の外に見える。本文の白い地の後ろ）
 *   Version背景   … 本文と同じ幅（本文の max-width を継ぐ）。本文の白い地を外して見せる
 * 層は本文（body）の先頭に入る（masterStyleBackgroundHtml）。iOS の Safari は背景の「固定」（background-attachment）が
 * 効かないので、固定した層で敷く
 */
function backgroundLayerCss(s: MasterStyleSheet): string {
  const hasOuter = s.outer_background_image !== ''
  const hasInner = s.inner_background_image !== ''
  if (!hasOuter && !hasInner) return ''
  return (
    '.lp-bg{position:fixed;top:0;right:0;bottom:0;left:0;width:100%;height:100%;margin:0 auto;padding:0;border:0;' +
    'box-sizing:border-box;z-index:-1;pointer-events:none;object-fit:cover;' +
    'background-position:center;background-size:cover;background-repeat:no-repeat}' +
    (hasOuter ? '.lp-bg--outer{max-width:none}' : '') +
    // ページ（html）に背景が無いと、本文（body）の地が画面全体に塗られる（CSS の決まり）＝本文の白い地が
    // 全体背景の層より下になり、本文の幅に出なくなる。ページに色を置いて、本文の地を本文の幅にとどめる（層の下で見えない）
    (hasOuter && hex(s.outer_background_color) === null ? 'html{background-color:#fff}' : '') +
    (hasInner ? 'body{background-color:transparent}.lp-bg--inner{max-width:inherit}' : '')
  )
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** CSS の url("…") の中に入れられる住所（「"」「\」・改行で CSS が壊れないように） */
export const cssUrl = (url: string): string => url.replace(/["\\\n]/g, (c) => encodeURIComponent(c))

/**
 * 記事設定の背景が画像・動画のとき、本文の先頭に入れる層（画面に固定した壁紙・動画は自動で再生・音なし・くり返し）。
 * 無ければ ''。配信・プレビュー・ヒートマップの LP で、masterStyleIframeCss と一緒に使う
 */
export function masterStyleBackgroundHtml(s: MasterStyleSheet): string {
  const layer = (kind: 'outer' | 'inner', src: string): string => {
    if (src === '') return ''
    const cls = `lp-bg lp-bg--${kind}`
    return isVideoBackground(src)
      ? `<video class="${cls}" src="${escapeAttribute(src)}" autoplay muted loop playsinline preload="auto" aria-hidden="true"></video>`
      : `<div class="${cls}" style="${escapeAttribute(`background-image:url("${cssUrl(src)}")`)}" aria-hidden="true"></div>`
  }
  return layer('outer', s.outer_background_image) + layer('inner', s.inner_background_image)
}

/**
 * 配信/プレビューの iframe に流し込む `<style>` の中身。
 * html＝全体背景、body＝本文（フォント/色/行間/余白/枠線/Version背景/配信幅）、img＝画像余白。
 */
export function masterStyleIframeCss(s: MasterStyleSheet): string {
  const body = containerDecls(s)
  if (s.delivery_version_width !== null) {
    body.push(
      `max-width:${s.delivery_version_width}${s.delivery_version_width_unit || 'px'}`,
      'margin-left:auto',
      'margin-right:auto',
    )
  }
  const outer = outerDecls(s)
  const img = imgDecls(s)
  return [
    outer.length > 0 ? `html{${outer.join(';')}}` : '',
    body.length > 0 ? `body{${body.join(';')}}` : '',
    img.length > 0 ? `img{${img.join(';')}}` : '',
    backgroundLayerCss(s),
  ].join('')
}

/**
 * 編集画面用。Quill本文（`.ql-editor`）へ当てる宣言だけを返す
 * （フォント/色/行間/文字間/余白/Version背景/枠線）。配信幅は編集画面の骨格を壊すので当てない。
 */
export function masterStyleEditorDecls(s: MasterStyleSheet): string {
  return containerDecls(s).join(';')
}

/**
 * 編集画面のキャンバスに当てる `background` の**値**（宣言ではなく値）。
 *
 * 編集画面のキャンバスは、クローン自身のCSSが `background: … !important` で
 * 塗っている。そのため記事設定の色をインラインで足しても勝てず、
 * 「設定したのに編集画面だけ変わらない」状態だった（指示179）。
 * CSS変数を1つ挟んで、そこにこの値を入れることで効かせる。
 * 未設定なら空文字＝変数を置かない＝既定色のまま。
 *
 * 色だけ。画像・動画は、配信と同じく画面に固定したいちばん後ろの層で敷く（editor-bg-layers.ts・2026-10-27）
 */
function backgroundValue(color: string): string {
  return hex(color) ?? ''
}

/** 土台（LPの外側）＝記事設定の「全体背景設定」。 */
export function masterStyleCanvasBackground(s: MasterStyleSheet): string {
  return backgroundValue(s.outer_background_color)
}

/** LP本体＝記事設定の「Version背景設定」。 */
export function masterStylePageBackground(s: MasterStyleSheet): string {
  return backgroundValue(s.inner_background_color)
}
