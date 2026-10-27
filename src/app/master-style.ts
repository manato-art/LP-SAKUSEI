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

/** CSS の背景にできる画像だけ（動画は CSS の背景にできないので、動画の層＝masterStyleVideoHtml で敷く） */
const imageOnly = (url: string): string => (isVideoBackground(url) ? '' : url)

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
  const innerImage = imageOnly(s.inner_background_image)
  if (innerImage !== '') {
    d.push(`background-image:url("${innerImage}")`, 'background-size:cover')
  }
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
  const outerImage = imageOnly(s.outer_background_image)
  if (outerImage !== '') {
    d.push(`background-image:url("${outerImage}")`, 'background-size:cover')
  }
  return d
}

/** 背景の動画の層の共通の見た目（いちばん後ろ・押せない・枠いっぱいに覆う） */
const VIDEO_LAYER = 'width:100%;height:100%;max-width:none;margin:0;object-fit:cover;z-index:-1;pointer-events:none'

/**
 * 背景の動画の層の CSS。全体背景＝画面に張り付けて敷く（html の背景と同じく、本文の外に見える）。
 * Version背景＝本文（body）の大きさに敷き、本文の白い地を外す（画像のときの body の背景と同じ範囲）
 */
function videoLayerCss(s: MasterStyleSheet): string {
  const outer = isVideoBackground(s.outer_background_image) ? `.lp-bgv--outer{position:fixed;inset:0;${VIDEO_LAYER}}` : ''
  const inner = isVideoBackground(s.inner_background_image)
    ? `body{position:relative;background-color:transparent}.lp-bgv--inner{position:absolute;inset:0;${VIDEO_LAYER}}`
    : ''
  return outer + inner
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * 記事設定の背景が動画のとき、本文の先頭に入れる動画の層（自動で再生・音なし・くり返し）。動画でなければ ''。
 * 配信・プレビュー・ヒートマップの LP で、masterStyleIframeCss と一緒に使う
 */
export function masterStyleVideoHtml(s: MasterStyleSheet): string {
  const layer = (kind: 'outer' | 'inner', src: string): string =>
    `<video class="lp-bgv lp-bgv--${kind}" src="${escapeAttribute(src)}" autoplay muted loop playsinline preload="auto" aria-hidden="true"></video>`
  return (
    (isVideoBackground(s.outer_background_image) ? layer('outer', s.outer_background_image) : '') +
    (isVideoBackground(s.inner_background_image) ? layer('inner', s.inner_background_image) : '')
  )
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
    videoLayerCss(s),
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
 * 色と画像を1つの値にまとめるのは、`background` ショートハンドが
 * 画像側を打ち消すため（片方だけ変数に入れると、もう片方が消える）。
 */
function backgroundValue(color: string, image: string): string {
  const c = hex(color)
  const parts: string[] = []
  if (c !== null) parts.push(c)
  // 動画は CSS の背景にできない（編集画面では editor-bg-video.ts が動画を敷く）
  if (imageOnly(image) !== '') parts.push(`url("${image}") center/cover no-repeat`)
  return parts.join(' ')
}

/** 土台（LPの外側）＝記事設定の「全体背景設定」。 */
export function masterStyleCanvasBackground(s: MasterStyleSheet): string {
  return backgroundValue(s.outer_background_color, s.outer_background_image)
}

/** LP本体＝記事設定の「Version背景設定」。 */
export function masterStylePageBackground(s: MasterStyleSheet): string {
  return backgroundValue(s.inner_background_color, s.inner_background_image)
}
