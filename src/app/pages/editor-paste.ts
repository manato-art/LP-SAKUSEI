/**
 * ほかから文字をコピーして貼ったとき、コピー元の見た目を持ち込まない（2026-10-27 本人の指示⑩
 * 「他から文字をコピーした際に、フォントや行間がコピー元を引き継ぐことがあるのでやめて欲しい」）。
 * 貼った文字は、LPのふだんの文字と同じ見た目になる。残すのは太字・斜め・リンク（と見出し・箇条書きなどの形）。
 *
 * - ブラウザ（Chrome）はコピーするとき、見えている見た目（書体・大きさ・文字の色・ページの背景の色・字の間 など）を
 *   全部の文字に書き込む。ふつうの文でもコピー元の色・背景のまま入っていた（2026-10-27 本人「コピー元のテキストスタイルが
 *   変わらない」→ 色・背景も外す。選んでもらった「大きさもLPにそろえる」のあと）
 * - Versionの編集画面（Quill）: 貼った文字の書体・大きさ・色・背景の色・寄せ（font・size・color・background・align）を外す。
 *   行間・字の間は Quill の書式に無いので、もともと持ち込まれない
 * - 同じ編集画面の中でコピーした物は、そのまま貼る（コピーのときに印を一緒に入れて見分ける）
 * - Widget編集の見たまま画面（ブラウザの貼り付け）: 貼る HTML の style は太字・斜めだけ残す・class も外す（cleanPastedHtml）
 */
import type Quill from 'quill'
import type { Op } from 'quill'

/** 同じ編集画面からコピーした印（クリップボードに一緒に入れる） */
export const INTERNAL_COPY_TYPE = 'application/x-lp-sakusei-copy'

/** 貼るときに外す、コピー元の見た目（Quill の書式の名前） */
const DROPPED_FORMATS: ReadonlySet<string> = new Set(['font', 'size', 'color', 'background', 'align'])

/** 貼った中身（Quill の変更）から、コピー元の見た目を外した新しい ops */
export function withoutSourceLook(ops: readonly Op[]): Op[] {
  return ops.map((op) => {
    if (op.attributes === undefined || !Object.keys(op.attributes).some((name) => DROPPED_FORMATS.has(name))) return op
    const rest = Object.fromEntries(Object.entries(op.attributes).filter(([name]) => !DROPPED_FORMATS.has(name)))
    return Object.keys(rest).length === 0 ? Object.fromEntries(Object.entries(op).filter(([key]) => key !== 'attributes')) : { ...op, attributes: rest }
  })
}

/** style の「名前: 値」の組 */
const declarations = (style: string): ReadonlyArray<readonly [string, string]> =>
  style
    .split(';')
    .map((part) => part.split(':'))
    .filter((pair) => pair.length >= 2)
    .map(([name, ...value]) => [(name ?? '').trim().toLowerCase(), value.join(':').trim().toLowerCase()] as const)

const isBold = (weight: string): boolean => weight.startsWith('bold') || Number.parseInt(weight, 10) >= 700

/**
 * 貼る HTML の style のうち残す物（太字・斜めだけ。無くなったら ''）。tag は大文字のタグ名。
 * Google ドキュメントは全体を <b style="font-weight:normal"> で包むので、b・strong の「太字にしない」は残す
 */
export function pastedStyle(style: string, tag: string): string {
  const found = new Map(declarations(style))
  const weight = found.get('font-weight')
  const kept = [
    weight === undefined ? null : isBold(weight) ? 'font-weight: bold' : tag === 'B' || tag === 'STRONG' ? 'font-weight: normal' : null,
    found.get('font-style') === 'italic' ? 'font-style: italic' : null,
  ]
  return kept.filter((part): part is string => part !== null).join('; ')
}

/** 貼る HTML から、コピー元の見た目を外す（style は太字・斜めだけ・class・<font face size color>）。ブラウザの貼り付けと同じく、文字でない物（script・style・meta 等）も入れない */
export function cleanPastedHtml(html: string, parse: (html: string) => Element): string {
  const root = parse(copiedFragment(html))
  for (const el of Array.from(root.querySelectorAll('script, style, meta, link, title'))) el.remove()
  for (const el of Array.from(root.querySelectorAll('[style]'))) {
    const next = pastedStyle(el.getAttribute('style') ?? '', el.tagName.toUpperCase())
    if (next === '') el.removeAttribute('style')
    else el.setAttribute('style', next)
  }
  for (const el of Array.from(root.querySelectorAll('[class]'))) el.removeAttribute('class')
  for (const font of Array.from(root.querySelectorAll('font'))) {
    for (const name of ['face', 'size', 'color']) font.removeAttribute(name)
  }
  return root.innerHTML
}

/** コピーした所だけ（ブラウザはクリップボードの HTML を <!--StartFragment-->〜<!--EndFragment--> で区切る。貼るときも中だけ使う） */
function copiedFragment(html: string): string {
  const start = html.indexOf('<!--StartFragment-->')
  const end = html.indexOf('<!--EndFragment-->')
  return start === -1 || end < start ? html : html.slice(start + '<!--StartFragment-->'.length, end)
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
  // 貼り付けの間だけ見た目を外す（Widget を入れるとき等、Quill に HTML を渡すほかの使い方では外さない）
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
  quill.clipboard.addMatcher(Node.ELEMENT_NODE, (_node, delta) => (external ? new Delta(withoutSourceLook(delta.ops)) : delta) as typeof delta)
}
