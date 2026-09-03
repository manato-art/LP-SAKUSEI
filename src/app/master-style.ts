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
  if (s.inner_background_image !== '') {
    d.push(`background-image:url("${s.inner_background_image}")`, 'background-size:cover')
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
  if (s.outer_background_image !== '') {
    d.push(`background-image:url("${s.outer_background_image}")`, 'background-size:cover')
  }
  return d
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
  ].join('')
}

/**
 * 編集画面用。Quill本文（`.ql-editor`）へ当てる宣言だけを返す
 * （フォント/色/行間/文字間/余白/Version背景/枠線）。配信幅/全体背景は編集画面の骨格を壊すので当てない。
 */
export function masterStyleEditorDecls(s: MasterStyleSheet): string {
  return containerDecls(s).join(';')
}
