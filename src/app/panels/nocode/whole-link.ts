/**
 * 見本の中の要素「全体」に付けるリンク（2026-10-31 本人「このポップ全体に対して反映したいのに、ボタンだけになってしまう。
 * ボタンだけがいい時はボタンだけ押してリンク先にリンク入れますから」）。
 *
 * 全体（囲み・帯など）を選んだときは「この要素全体のリンク先」（sample-link-field.ts）、ボタンを選んだときは今までどおり
 * 「ボタンのリンク先」（form-sample.ts）。全体のリンクは、要素の中いっぱいに広げた見えないリンク（本物の <a>）を先頭に入れる:
 *  - 本物のリンクなので、配信のLPパラメーター・クリックの計測・リンク置換の一覧にもそのまま乗る
 *  - 要素を <a> で包むと、中のボタン（<a>）と入れ子になって壊れるので包まない
 *  - 見えないリンクの見た目は style に !important で書く（見本のCSSの「a { … }」がボタンの見た目を付けないように）
 *  - 中のボタン・入力は見えないリンクより上に出す（書き出しのCSS・wholeLinkCss）。ボタンに別のリンク先があればボタンはそちら、
 *    リンク先が仮（#）のボタンは上に出さない＝押すと全体のリンク先へ移る
 */
import { isAllowedLinkUrl, isTrackingLink, withTrackingParam } from '../../../shared/link-html.ts'
import { str, type ItemData, type TemplateData } from './templates/types.ts'

/** 見えないリンクの印 */
export const COVER_ATTR = 'data-nc-cover'
/** 全体のリンクを付けた要素の印（値は l1・l2…。組み立て直したあとも同じ要素を選ぶのに使う） */
export const LINK_BOX_ATTR = 'data-nc-link-box'
const LINK_BOX_ID = /^l(\d{1,4})$/

/** 全体のリンクを付けない要素（リンク・ボタン・入力そのもの、子を持てない画像・動画など） */
const NO_WHOLE_TAGS: ReadonlySet<string> = new Set([
  'A', 'BUTTON', 'LABEL', 'INPUT', 'SELECT', 'TEXTAREA', 'OPTION',
  'IMG', 'VIDEO', 'PICTURE', 'SOURCE', 'SVG', 'IFRAME', 'BR', 'HR', 'SCRIPT', 'STYLE',
])

/** 見えないリンクの見た目（要素の中いっぱい・何も描かない） */
const COVER_STYLE =
  'position:absolute!important;inset:0!important;z-index:1!important;display:block!important;margin:0!important;' +
  'padding:0!important;border:0!important;background:transparent!important;opacity:1!important;transform:none!important;' +
  'width:auto!important;height:auto!important;min-width:0!important;min-height:0!important;max-width:none!important;' +
  'max-height:none!important;font-size:0!important;line-height:0!important;box-shadow:none!important'

/** 全体のリンクを付けられる要素か（ボタンの中・見えないリンクそのものも付けない） */
export function canLinkWhole(element: Element): boolean {
  if (NO_WHOLE_TAGS.has(element.tagName.toUpperCase())) return false
  return element.closest('a,button') === null
}

/** 要素の見えないリンク（その要素の直下の物だけ） */
function coverOf(element: Element): HTMLAnchorElement | null {
  return Array.from(element.children).find((child) => child.tagName === 'A' && child.hasAttribute(COVER_ATTR)) as HTMLAnchorElement | null ?? null
}

/** いまの全体のリンク先（無ければ空） */
export function wholeLinkOf(element: Element): string {
  return coverOf(element)?.getAttribute('href') ?? ''
}

/** 要素の文字（読み上げで行き先が分かるように、見えないリンクの名前にする） */
function textOf(element: Node): string {
  const parts: string[] = []
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        const text = (child.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (text !== '') parts.push(text)
      } else if (child.nodeType === 1 && !['SCRIPT', 'STYLE'].includes((child as Element).tagName.toUpperCase())) {
        walk(child)
      }
    }
  }
  walk(element)
  return parts.join(' ').slice(0, 80)
}

/**
 * 全体のリンクを付ける・直す（url が空なら外す）。id は要素に付ける印（l1 など）。
 * 開けないリンク・付けられない要素なら何もしないで false
 */
export function setWholeLink(element: Element, url: string, id: string): boolean {
  const target = url.trim()
  const current = coverOf(element)
  if (target === '') {
    current?.remove()
    element.removeAttribute(LINK_BOX_ATTR)
    return true
  }
  if (!canLinkWhole(element) || !isAllowedLinkUrl(target) || !LINK_BOX_ID.test(id)) return false
  const cover = current ?? element.ownerDocument.createElement('a')
  // 計測の目印（sb_tracking）は元のリンクに合わせる（新しく付けたときは入れたまま＝あとでリンク置換でも付け外しできる）
  const keepAsTyped = current === null || target.startsWith('#')
  const tracking = isTrackingLink(current?.getAttribute('href') ?? '', null)
  cover.setAttribute('href', keepAsTyped ? target : withTrackingParam(target, tracking))
  if (current === null) {
    cover.setAttribute(COVER_ATTR, '')
    cover.setAttribute('style', COVER_STYLE)
    const label = textOf(element)
    cover.setAttribute('aria-label', label === '' ? 'リンク' : label)
    element.prepend(cover)
  }
  element.setAttribute(LINK_BOX_ATTR, id)
  return true
}

/** 新しく付ける印の名前（l1・l2…の空いている番号。見本の中にもう付いている印と重ならない） */
export function nextLinkBoxId(html: string): string {
  const used = new Set(Array.from(html.matchAll(/data-nc-link-box="l(\d{1,4})"/g), (m) => Number(m[1])))
  let n = 1
  while (used.has(n)) n += 1
  return `l${n}`
}

/** 押した所が全体のリンクを付けた要素の中なら、その見えないリンク（編集画面の動作確認で開く） */
export function wholeLinkCover(target: Element): HTMLAnchorElement | null {
  const box = target.closest(`[${LINK_BOX_ATTR}]`)
  return box === null ? null : coverOf(box)
}

/** 全体のリンクを使っているか（見本の部品の中身に印がある） */
export function usesWholeLink(value: TemplateData | ItemData): boolean {
  if (str(value, 'type') === 'sample' && str(value, 'html').includes(LINK_BOX_ATTR)) return true
  return Object.values(value).some(
    (child) => Array.isArray(child) && child.some((entry: unknown) => typeof entry === 'object' && entry !== null && usesWholeLink(entry as ItemData)),
  )
}

/**
 * 書き出しのCSS（全体のリンクを使っているWidgetだけ）。要素を見えないリンクの入れ物にし（もう位置を決めている要素はそのまま）、
 * 中のボタン・入力を見えないリンクより上に出す。:where で強さを0にして、見本自身の指定（位置・重なり）が勝つようにする
 */
export function wholeLinkCss(s: string): string {
  return (
    // 重なりは要素の中だけで決める（isolation）。しないと見えないリンクが外の物（追従型の ✕ など）より上に出て、✕ が押せなかった
    `${s} :where([${LINK_BOX_ATTR}]){position:relative;isolation:isolate}` +
    // 仮のリンク（# や空）のボタンは上に出さない＝押すと全体のリンク先へ移る
    `${s} :where([${LINK_BOX_ATTR}]) :where(a:not([${COVER_ATTR}]):not([href="#"]):not([href=""]),button,input,select,textarea,label,[data-nc-go],[role="button"])` +
    '{position:relative;z-index:2}'
  )
}
