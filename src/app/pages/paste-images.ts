/**
 * ほかのサイトから貼った中身の画像も入れる（2026-10-31 本人「スクワットビヨンドで作成したLPを全選択してそのままエビヨンに
 * はりつけたいんだけど、文字はコピーできるけど、画像がそのままコピーできない」）。
 *
 * 本人の選択: 画像は EBIyon に写して置く（サーバーが取ってきて /uploads に置く・routes/remote-images.ts）／
 * 画像に付いているリンクは付けない。文字は今までどおり書式なし（2026-10-27「書式はコピーしないで」・editor-paste.ts）。
 *  - 貼った中身（text/html）を上から順に「文字」「画像」に分ける（pasteParts）。画像は1行に1枚
 *  - 画像を全部写してから、元の並びのまま入れる（pasteWithImages）。写している間は編集を止める（入れる場所がずれないように）。
 *    入れる前に止めるのをやめる（Quill は止めている間の 'user' の書き換えを捨てる＝止めたまま入れると何も入らなかった）
 *  - 写せなかった画像は入れずに数えて知らせる
 */

export type PastePart = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'image'; readonly src: string }

/** 段落の区切りになる要素（前後で行を変える） */
const BLOCK_TAGS: ReadonlySet<string> = new Set([
  'P', 'DIV', 'LI', 'UL', 'OL', 'DL', 'DT', 'DD', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'TR', 'SECTION', 'ARTICLE',
  'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV', 'FIGURE', 'FIGCAPTION', 'BLOCKQUOTE', 'PRE', 'FORM', 'CENTER',
])
/** 中身を入れない要素 */
const SKIP_TAGS: ReadonlySet<string> = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'IFRAME', 'HEAD', 'TITLE', 'META', 'LINK', 'VIDEO', 'AUDIO', 'OBJECT'])
/** 遅れて読み込む画像が本物の住所を入れておく所 */
const LAZY_ATTRS = ['data-src', 'data-original', 'data-lazy-src', 'data-lazy']

const isHttp = (url: string): boolean => /^https?:\/\/[^\s]+$/i.test(url)
/** 埋め込みの画像（小さな仮の画像＝遅れて読み込むときの置き物は除く） */
const isEmbeddedImage = (url: string): boolean => /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i.test(url) && url.length > 120

/** 画像の住所（写せる http(s) か、埋め込みの画像）。読めなければ null */
export function imageSourceOf(img: Element): string | null {
  const src = (img.getAttribute('src') ?? '').trim()
  if (isHttp(src)) return src
  for (const name of LAZY_ATTRS) {
    const lazy = (img.getAttribute(name) ?? '').trim()
    if (isHttp(lazy)) return lazy
  }
  const firstOfSet = (img.getAttribute('srcset') ?? img.getAttribute('data-srcset') ?? '').trim().split(/\s+/)[0] ?? ''
  if (isHttp(firstOfSet)) return firstOfSet
  return isEmbeddedImage(src) ? src : null
}

/** 見えない要素（hidden・display:none） */
function isHidden(el: Element): boolean {
  return el.hasAttribute('hidden') || /display\s*:\s*none/i.test(el.getAttribute('style') ?? '')
}

/** 計測用の1px の画像 */
function isPixel(img: Element): boolean {
  const size = (name: string): number => Number(img.getAttribute(name) ?? 'NaN')
  return size('width') <= 1 || size('height') <= 1
}

/** 貼った中身を上から順に文字と画像に分ける（文字は書式なし・画像のリンクは付けない） */
export function pasteParts(root: Node): PastePart[] {
  const parts: PastePart[] = []
  let text = ''
  /** 段落の区切り（続けて来ても1つ・先頭には付けない） */
  const breakLine = (): void => {
    if (text !== '' && !text.endsWith('\n')) text += '\n'
  }
  const flushText = (): void => {
    const tidy = text.replace(/ *\n */g, '\n').replace(/^\n+/, '')
    if (tidy.trim() !== '') parts.push({ kind: 'text', text: tidy })
    text = ''
  }
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        const value = (child.textContent ?? '').replace(/\s+/g, ' ')
        // 行の頭の空白は入れない
        text += text === '' || text.endsWith('\n') ? value.trimStart() : value
        continue
      }
      if (child.nodeType !== 1) continue
      const el = child as Element
      const tag = el.tagName.toUpperCase()
      if (SKIP_TAGS.has(tag) || isHidden(el)) continue
      if (tag === 'BR') {
        text += '\n'
        continue
      }
      if (tag === 'IMG') {
        const src = imageSourceOf(el)
        if (src === null || isPixel(el)) continue
        breakLine()
        flushText()
        parts.push({ kind: 'image', src })
        continue
      }
      const block = BLOCK_TAGS.has(tag)
      if (block) breakLine()
      walk(el)
      if (block) breakLine()
    }
  }
  walk(root)
  flushText()
  return parts
}

/** 画像も入れるときに使う Quill の一部（テストでは代わりを渡す） */
export interface ImagePasteQuill {
  getSelection(focus?: boolean): { index: number; length: number } | null
  getFormat(index: number, length: number): Record<string, unknown>
  deleteText(index: number, length: number, source?: string): unknown
  insertText(index: number, text: string, formats: Record<string, unknown>, source?: string): unknown
  insertEmbed(index: number, type: string, value: string, source?: string): unknown
  getText(index: number, length: number): string
  setSelection(index: number, length: number, source?: string): unknown
  enable(enabled?: boolean): unknown
}

/** 貼るときに持ち込まない行の書式（貼った所の行のままにする・editor-paste.ts と同じ） */
const LINE_FORMATS: ReadonlySet<string> = new Set(['header', 'list', 'blockquote', 'code-block', 'align', 'indent', 'direction'])

/** いちどに写す枚数 */
const PARALLEL = 4

/** 画像を写す（同じ住所は1回だけ・埋め込みの画像は写さずそのまま）。写せなければ null */
async function copyAll(sources: readonly string[], copy: (src: string) => Promise<string | null>): Promise<Map<string, string | null>> {
  const unique = [...new Set(sources)]
  const done = new Map<string, string | null>()
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < unique.length) {
      const src = unique[next]!
      next += 1
      done.set(src, src.startsWith('data:') ? src : await copy(src).catch(() => null))
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, unique.length) }, worker))
  return done
}

/**
 * 画像を全部写してから、カーソルの所へ元の並びのまま入れる（選んでいた文字は置き換える）。
 * 文字は貼った所の文字と同じ見た目。画像は1行に1枚。写している間は編集を止める。
 */
export async function pasteWithImages(
  quill: ImagePasteQuill,
  parts: readonly PastePart[],
  copy: (src: string) => Promise<string | null>,
): Promise<{ images: number; failed: number }> {
  const range = quill.getSelection(true)
  if (range === null) return { images: 0, failed: 0 }
  const here = Object.fromEntries(Object.entries(quill.getFormat(range.index, 0)).filter(([name]) => !LINE_FORMATS.has(name)))
  quill.enable(false)
  let copied: Map<string, string | null>
  try {
    copied = await copyAll(
      parts.flatMap((part) => (part.kind === 'image' ? [part.src] : [])),
      copy,
    )
  } finally {
    quill.enable(true)
  }
  if (range.length > 0) quill.deleteText(range.index, range.length, 'user')
  let index = range.index
  let images = 0
  let failed = 0
  const ready = parts.filter((part) => {
    if (part.kind === 'text') return true
    if ((copied.get(part.src) ?? null) === null) failed += 1
    return (copied.get(part.src) ?? null) !== null
  })
  ready.forEach((part, at) => {
    if (part.kind === 'text') {
      quill.insertText(index, part.text, here, 'user')
      index += part.text.length
      return
    }
    // 画像は1行に1枚（前の文字と同じ行にしない・あとの文字も次の行から）
    if (index > 0 && quill.getText(index - 1, 1) !== '\n') {
      quill.insertText(index, '\n', {}, 'user')
      index += 1
    }
    quill.insertEmbed(index, 'image', copied.get(part.src) ?? '', 'user')
    index += 1
    images += 1
    const following = ready[at + 1]
    const nextStartsLine = following?.kind === 'text' ? following.text.startsWith('\n') : following === undefined && quill.getText(index, 1) === '\n'
    if (!nextStartsLine) {
      quill.insertText(index, '\n', {}, 'user')
      index += 1
    }
  })
  quill.setSelection(index, 0, 'user')
  return { images, failed }
}
