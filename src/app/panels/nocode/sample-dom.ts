/**
 * 「部品を積んで作る」の見本の部品：見本のHTMLを読む・直す（2026-09-22・本人の依頼）。
 *
 * 見分け方は sample-model.ts（DOMを使わない形）。ここはブラウザで見本のHTMLを組み立てて使う。
 *  - readSample: 中身の一覧と、もともとある設問①②…。設問は、見本を画面の外で（スクリプトなしで）描いて、
 *    見えている・隠れているで見つける（HTMLだけでは、どれが隠れているか分からない）
 *  - editSample: 文字・ボタンの文字・画像・リンク先・押したときを1か所直した新しいHTMLを返す
 *  - previewWithStep: 見え方だけ、選んだ設問を出したHTML（保存するHTMLには入れない）
 * どれも見本を <div id="nc-sample-root"> に包んで組み立てる（先頭の <style> も中に残る＝番号がそろう）。
 */
import { LP_BASE_CSS } from '../../lp-base-css.ts'
import { WIDGET_RESET_CSS } from '../../../shared/sb-preview-css.ts'
import { isAllowedLinkUrl, isTrackingLink, withTrackingParam } from '../../../shared/link-html.ts'
import { elementsInOrder, findStepGroup, nestedScreens, nodeAt, sampleSlots, type Slot, type SlotNode } from './sample-model.ts'
import { SCREEN_ID } from './templates/builder-blocks.ts'
import { safeImage } from './templates/kit.ts'

const ROOT_ID = 'nc-sample-root'
/** 見え方だけで使う目印（保存するHTMLには入れない） */
export const PREVIEW_STEP_ATTR = 'data-nc-preview-step'
/** 見え方で、選んだ設問だけを出すCSS */
export const PREVIEW_STEP_CSS = `[${PREVIEW_STEP_ATTR}="off"]{display:none !important}[${PREVIEW_STEP_ATTR}="on"]{display:block !important}`

function wrap(html: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"></head><body><div id="${ROOT_ID}">${html}</div></body></html>`
}

function parse(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(wrap(html), 'text/html')
  const root = doc.getElementById(ROOT_ID)
  if (root === null) throw new Error('見本を読み込めませんでした')
  return root
}

const asNode = (el: Node): SlotNode => el as unknown as SlotNode

/**
 * 見本を画面の外で描き、もともとある設問①②…の箱（番号 e12 など）を返す。スクリプトは動かさない。
 * 画面①②…に作り変えた見本（中に data-nc-screens の入れ物がある）は、その画面をそのまま設問にする（描かずに決まる）。
 */
async function findSteps(html: string): Promise<string[]> {
  const parsed = asNode(parse(html))
  const screens = nestedScreens(parsed)
  if (screens.length >= 2) {
    const order = elementsInOrder(parsed)
    return screens.map((screen) => `e${order.indexOf(screen)}`)
  }
  const frame = document.createElement('iframe')
  // 同じ場所（allow-same-origin）で描いて見え方を調べる。スクリプトは許さない（見本の動きは起きない）
  frame.setAttribute('sandbox', 'allow-same-origin')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:620px;height:900px;border:0;opacity:0;pointer-events:none'
  const loaded = new Promise<void>((resolve) => frame.addEventListener('load', () => resolve(), { once: true }))
  frame.srcdoc =
    '<!doctype html><html lang="ja"><head><meta charset="utf-8">' +
    `<style>body{margin:0 auto;max-width:620px;font-family:"Hiragino Sans",sans-serif}${LP_BASE_CSS}${WIDGET_RESET_CSS}</style></head>` +
    `<body><section class="sb-widget-block"><div id="${ROOT_ID}">${html}</div></section></body></html>`
  document.body.append(frame)
  try {
    await loaded
    const doc = frame.contentDocument
    const view = frame.contentWindow
    const root = doc?.getElementById(ROOT_ID)
    if (doc === null || doc === undefined || view === null || root === null || root === undefined) return []
    const visible = (node: SlotNode): boolean => {
      const style = view.getComputedStyle(node as unknown as Element)
      return style.display !== 'none' && style.visibility !== 'hidden'
    }
    const steps = findStepGroup(asNode(root), visible)
    const order = elementsInOrder(asNode(root))
    return steps.map((step) => `e${order.indexOf(step)}`)
  } finally {
    frame.remove()
  }
}

export interface SampleInfo {
  readonly slots: readonly Slot[]
  /** もともとある設問①②…の箱（番号）。無ければ空 */
  readonly stepIds: readonly string[]
}

export async function readSample(html: string): Promise<SampleInfo> {
  const stepIds = await findSteps(html)
  const root = parse(html)
  const steps = stepIds.map((id) => nodeAt(asNode(root), id)).filter((node): node is SlotNode => node !== null)
  return { slots: sampleSlots(asNode(root), steps), stepIds }
}

/** 文字の前後の空白はそのまま、中身だけ入れ替える */
function replaceText(node: Text, value: string): void {
  const raw = node.data
  const lead = /^\s*/.exec(raw)?.[0] ?? ''
  const trail = /\s*$/.exec(raw)?.[0] ?? ''
  node.data = `${lead}${value}${trail}`
}

export type SampleChange =
  | { readonly kind: 'text'; readonly value: string }
  /** ボタンの文字（ボタンの中の最初の文字を入れ替える） */
  | { readonly kind: 'label'; readonly value: string }
  | { readonly kind: 'image'; readonly value: string }
  /** リンク先（a だけ）。計測の目印（sb_tracking）は元のリンクに合わせる */
  | { readonly kind: 'href'; readonly value: string }
  /** 押したら移る画面（null＝見本のまま） */
  | { readonly kind: 'go'; readonly value: string | null }

/** 1か所直した新しいHTML。直せない（場所が無い・値が使えない）ときは元のHTML */
export function editSample(html: string, id: string, change: SampleChange): string {
  const root = parse(html)
  const node = nodeAt(asNode(root), id) as unknown as Node | null
  if (node === null) return html
  switch (change.kind) {
    case 'text':
      if (!(node instanceof Text)) return html
      replaceText(node, change.value)
      break
    case 'label': {
      if (!(node instanceof Element)) return html
      const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT)
      let text: Text | null = null
      for (let current = walker.nextNode(); current !== null; current = walker.nextNode()) {
        if ((current.textContent ?? '').trim() !== '') {
          text = current as Text
          break
        }
      }
      if (text === null) node.append(node.ownerDocument.createTextNode(change.value))
      else replaceText(text, change.value)
      break
    }
    case 'image': {
      const src = safeImage(change.value)
      if (!(node instanceof Element) || src === '') return html
      node.setAttribute('src', src)
      // 遅れて読み込む見本（data-src）や、画面の幅で出し分ける見本（srcset・<source>）も、選んだ画像にそろえる
      for (const name of ['srcset', 'data-src', 'data-srcset']) node.removeAttribute(name)
      const picture = node.parentElement
      if (picture?.tagName === 'PICTURE') {
        for (const source of picture.querySelectorAll('source')) {
          source.setAttribute('srcset', src)
          source.removeAttribute('data-srcset')
        }
      }
      break
    }
    case 'href': {
      const url = change.value.trim()
      if (!(node instanceof Element) || node.tagName !== 'A' || (url !== '' && !isAllowedLinkUrl(url))) return html
      const tracking = isTrackingLink(node.getAttribute('href') ?? '', node.getAttribute('data-sb-tracking'))
      node.setAttribute('href', url === '' ? '#' : url.startsWith('#') ? url : withTrackingParam(url, tracking))
      break
    }
    case 'go':
      if (!(node instanceof Element)) return html
      if (change.value !== null && SCREEN_ID.test(change.value)) node.setAttribute('data-nc-go', change.value)
      else node.removeAttribute('data-nc-go')
      break
  }
  return root.innerHTML
}

/** 見え方だけ、選んだ設問を出したHTML（ほかの設問は隠す）。保存するHTMLには入れない */
export function previewWithStep(html: string, stepIds: readonly string[], active: number): string {
  const root = parse(html)
  stepIds.forEach((id, i) => {
    const node = nodeAt(asNode(root), id) as unknown as Node | null
    if (node instanceof Element) node.setAttribute(PREVIEW_STEP_ATTR, i === active ? 'on' : 'off')
  })
  return root.innerHTML
}
