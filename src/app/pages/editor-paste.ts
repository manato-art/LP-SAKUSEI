/**
 * ほかから文字をコピーして貼ったとき、コピー元の書体・行間を持ち込まない（2026-10-27 本人の指示⑩
 * 「他から文字をコピーした際に、フォントや行間がコピー元を引き継ぐことがあるのでやめて欲しい」）。
 *
 * - Versionの編集画面（Quill）: 貼った文字の書体（font）・大きさ（size）を外す（LPのふだんの書体・大きさになる）。
 *   行間は Quill の書式に無いので、もともと持ち込まれない。色・太字・リンクなどはそのまま
 *   （大きさも外す＝2026-10-27 本人選択「大きさもLPにそろえる」）
 * - 同じ編集画面の中でコピーした物は、そのまま貼る（コピーのときに印を一緒に入れて見分ける）
 * - Widget編集の見たまま画面（ブラウザの貼り付け）: 貼る HTML の style から書体・大きさ・行間を外す（cleanPastedHtml）
 */
import type Quill from 'quill'
import type { Op } from 'quill'

/** 同じ編集画面からコピーした印（クリップボードに一緒に入れる） */
export const INTERNAL_COPY_TYPE = 'application/x-lp-sakusei-copy'

/** 貼るときに外す、コピー元の書体・大きさ・行間（style の名前） */
const DROPPED_STYLES = ['font-family', 'font-size', 'line-height'] as const

/** 貼るときに外す、コピー元の書体・大きさ（Quill の書式の名前） */
const DROPPED_FORMATS: ReadonlySet<string> = new Set(['font', 'size'])

/** 貼った中身（Quill の変更）から、コピー元の書体・大きさを外した新しい ops */
export function withoutSourceFonts(ops: readonly Op[]): Op[] {
  return ops.map((op) => {
    if (op.attributes === undefined || !Object.keys(op.attributes).some((name) => DROPPED_FORMATS.has(name))) return op
    const rest = Object.fromEntries(Object.entries(op.attributes).filter(([name]) => !DROPPED_FORMATS.has(name)))
    return Object.keys(rest).length === 0 ? Object.fromEntries(Object.entries(op).filter(([key]) => key !== 'attributes')) : { ...op, attributes: rest }
  })
}

/** style の中身から、コピー元の書体・大きさ・行間を外した style（無くなったら ''） */
export function withoutSourceTypeStyle(style: string): string {
  return style
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part !== '' && !DROPPED_STYLES.some((name) => part.toLowerCase().startsWith(`${name}:`) || part.toLowerCase().startsWith(`${name} :`)))
    .join('; ')
}

/** 貼る HTML から、コピー元の書体・大きさ・行間を外す（style・<font face size>）。ブラウザの貼り付けと同じく、文字でない物（script・style・meta 等）も入れない */
export function cleanPastedHtml(html: string, parse: (html: string) => Element): string {
  const root = parse(html)
  for (const el of Array.from(root.querySelectorAll('script, style, meta, link, title'))) el.remove()
  for (const el of Array.from(root.querySelectorAll('[style]'))) {
    const next = withoutSourceTypeStyle(el.getAttribute('style') ?? '')
    if (next === '') el.removeAttribute('style')
    else el.setAttribute('style', next)
  }
  for (const font of Array.from(root.querySelectorAll('font'))) {
    font.removeAttribute('face')
    font.removeAttribute('size')
  }
  return root.innerHTML
}

/** 同じ編集画面の中でコピー・切り取りしたとき、印を一緒に入れる（貼るときに見分ける） */
export function markInternalCopy(el: HTMLElement): void {
  const mark = (e: ClipboardEvent): void => {
    e.clipboardData?.setData(INTERNAL_COPY_TYPE, '1')
  }
  el.addEventListener('copy', mark)
  el.addEventListener('cut', mark)
}

/** ほかからの貼り付けか（同じ編集画面からコピーした印が無い） */
export const isExternalPaste = (e: ClipboardEvent): boolean => !(e.clipboardData?.types.includes(INTERNAL_COPY_TYPE) ?? false)

/** Versionの編集画面の貼り付けを配線する（Quill を作ったあとに呼ぶ＝Quill のコピーの後に印を足す） */
export function wireEditorPaste(quill: Quill): void {
  const root = quill.root
  markInternalCopy(root)
  // 貼り付けの間だけ書体・大きさを外す（Widget を入れるとき等、Quill に HTML を渡すほかの使い方では外さない）
  let external = false
  root.addEventListener(
    'paste',
    (e) => {
      external = isExternalPaste(e)
      window.setTimeout(() => {
        external = false
      }, 0)
    },
    true,
  )
  const Delta = (quill.constructor as typeof Quill).import('delta') as new (ops: Op[]) => { readonly ops: Op[] }
  quill.clipboard.addMatcher(Node.ELEMENT_NODE, (_node, delta) => (external ? new Delta(withoutSourceFonts(delta.ops)) : delta) as typeof delta)
}
