/**
 * 見たまま画面（DOM）で直した文字を、部品の設定データへ戻す（2026-09-23・Widget編集に統合）。
 *
 * 部品で作ったWidgetは「設定データ → 書き出し」で描くので、見たまま画面で文字を打ち直しても
 * そのままでは次の描き直しで消える。打ち直した要素がどの部品か（`nc-b-12` の通し番号）を見つけ、
 * その部品の文字の欄だけを DOM から読み戻す。書式（太字・色）は持たない＝部品の文字は素の文字。
 *
 * 読み戻せるのは、ふつうの部品の文字と、見本の部品の中身（HTMLごと）。
 * 画像・動画・余白・区切り線・型の部品は、右の入力欄で直す（見たまま画面では文字を打てない）。
 */
import { blockNumberOf, blockPathAt, withSampleAssets } from './builder-data.ts'
import { getAt, setAt, type Path } from './form-state.ts'
import { str, type ItemData, type TemplateData } from './templates/types.ts'

/** 塊になる要素（この切れ目は改行として読む） */
const BLOCK_TAGS: ReadonlySet<string> = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'SECTION', 'ARTICLE'])
const SKIP_TAGS: ReadonlySet<string> = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG'])

/**
 * 見たまま画面の要素から、いちばん外の部品（.nc-b で通し番号のあるもの）。
 * 見本の部品の中に別の部品（登録したWidgetを見本にした など）があっても、外のものを返す。
 */
export function outermostBlock(target: EventTarget | null, contentDiv: HTMLElement): HTMLElement | null {
  let found: HTMLElement | null = null
  let cur: HTMLElement | null = target instanceof HTMLElement ? target : target instanceof Node ? target.parentElement : null
  for (; cur !== null && cur !== contentDiv; cur = cur.parentElement) {
    if (cur.classList.contains('nc-b') && blockNumberOf(cur.className) !== null) found = cur
  }
  return found
}

/** 要素の中の文字。<br> と塊の要素の切れ目は改行。script・style・svg の中は見ない */
export function plainTextOf(el: Node): string {
  let out = ''
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      // 文字の中の改行（HTMLの字下げ）は行の切れ目ではない。行の切れ目は <br> と塊の要素だけ
      out += (node.textContent ?? '').replace(/\s+/g, ' ')
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const tag = (node as Element).tagName.toUpperCase()
    if (SKIP_TAGS.has(tag)) return
    if (tag === 'BR') {
      out += '\n'
      return
    }
    const isBlock = BLOCK_TAGS.has(tag) && node !== el
    if (isBlock && out !== '' && !out.endsWith('\n')) out += '\n'
    for (const child of node.childNodes) walk(child)
    if (isBlock && !out.endsWith('\n')) out += '\n'
  }
  walk(el)
  // 見た目のない改行（HTMLの字下げ）は空白にそろえる。行の前後の空白は落とす
  return out
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/^\n|\n$/g, '')
}

const oneLine = (text: string): string => text.replace(/\s*\n\s*/g, ' ').trim()

/** 部品の要素から、その部品の文字の欄を読み戻した中身。読み戻せない部品は null */
export function readBlockFromCanvas(el: HTMLElement, block: ItemData): ItemData | null {
  const pick = (selector: string): Element | null => el.querySelector(selector)
  switch (str(block, 'type')) {
    case 'heading':
      return { ...block, text: oneLine(plainTextOf(el)) }
    case 'text':
      return { ...block, text: plainTextOf(el) }
    case 'button': {
      const label = pick('.nc-b-button__label')
      return label === null ? null : { ...block, label: oneLine(plainTextOf(label)) }
    }
    case 'shape': {
      const text = pick('.nc-b-shape__text')
      return { ...block, text: oneLine(plainTextOf(text ?? el)) }
    }
    case 'list': {
      const lines = [...el.querySelectorAll('.nc-b-list__text')].map((item) => plainTextOf(item))
      return { ...block, text: lines.join('\n') }
    }
    case 'imageText': {
      const heading = pick('.nc-b-imageText__heading')
      const text = pick('.nc-b-imageText__text')
      return {
        ...block,
        heading: heading === null ? '' : oneLine(plainTextOf(heading)),
        text: text === null ? str(block, 'text') : plainTextOf(text),
      }
    }
    case 'sample':
      return { ...block, html: withSampleAssets(str(block, 'html'), el.innerHTML) }
    default:
      return null
  }
}

/** 見たまま画面で文字を打てる部品か（打てない部品は入力を止める） */
export function isTextEditableBlock(block: ItemData): boolean {
  return ['heading', 'text', 'button', 'shape', 'list', 'imageText', 'sample'].includes(str(block, 'type'))
}

/**
 * 打ち直した要素の部品を設定データへ戻す。戻したら新しい中身と部品の場所、戻せなければ null
 */
export function syncCanvasBlock(
  data: TemplateData,
  target: EventTarget | null,
  contentDiv: HTMLElement,
): { data: TemplateData; path: Path; block: ItemData } | null {
  const el = outermostBlock(target, contentDiv)
  if (el === null) return null
  const n = blockNumberOf(el.className)
  const path = n === null ? null : blockPathAt(data, n)
  if (path === null) return null
  const block = getAt(data, path) as ItemData | undefined
  if (block === undefined) return null
  const next = readBlockFromCanvas(el, block)
  if (next === null) return null
  return { data: setAt(data, path, next), path, block: next }
}

/** 部品の場所（path）から、見たまま画面のその部品の要素（画面の中の何番目か → 通し番号） */
export function blockElementAt(data: TemplateData, contentDiv: HTMLElement, screenIndex: number, blockIndex: number): HTMLElement | null {
  let n = 0
  const screens = getAt(data, ['screens']) as readonly ItemData[] | undefined
  for (const [si, screen] of (screens ?? []).entries()) {
    const blocks = getAt(screen, ['blocks']) as readonly ItemData[] | undefined
    for (const bi of (blocks ?? []).keys()) {
      n += 1
      if (si === screenIndex && bi === blockIndex) {
        for (const el of contentDiv.querySelectorAll<HTMLElement>('.nc-b')) {
          if (blockNumberOf(el.className) === n && outermostBlock(el, contentDiv) === el) return el
        }
        return null
      }
    }
  }
  return null
}
