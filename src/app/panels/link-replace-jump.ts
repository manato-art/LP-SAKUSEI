/**
 * リンク置換の一覧の行を押すと、本文のそのリンクの場所へ移る（2026-10-28 指示36 本人「余白を押したらその場所に飛ぶように」）。
 *
 * 一覧の番号は、本文の HTML から数えた出現順（link-html.ts の extractLinksFromHtml）。
 * 本文の要素（文字のリンク・リンクを付けた画像・動画）を前から順に、種類と行き先が同じものと結ぶ
 * （本文に見つからないリンクは結ばない＝ほかの行の結び先がずれない）。
 *
 * 移ったことが分かるよう、少しのあいだ枠で示す。枠は本文の外（body の直下）に重ねる。
 * 本文の要素に印やクラスを付けると、そのまま保存されてしまうので、本文には何も書き込まない。
 */
import type { LpLink } from '../../shared/link-html.ts'

/** 枠を出しておく長さ */
const FLASH_MS = 1600

const LINK_ELEMENTS = 'a, img[data-link-url]:not([data-link-url=""]), video[data-link-url]:not([data-link-url=""])'

function kindOf(el: Element): LpLink['kind'] {
  const tag = el.tagName.toLowerCase()
  return tag === 'img' ? 'image' : tag === 'video' ? 'video' : 'text'
}

function hrefOf(el: Element): string {
  return (kindOf(el) === 'text' ? el.getAttribute('href') : el.getAttribute('data-link-url')) ?? ''
}

/** 一覧の番号と本文の要素を結ぶ */
export function linkElementsByIndex(body: ParentNode, links: readonly LpLink[]): ReadonlyMap<number, HTMLElement> {
  const elements = [...body.querySelectorAll<HTMLElement>(LINK_ELEMENTS)]
  const out = new Map<number, HTMLElement>()
  let from = 0
  for (const link of links) {
    const at = elements.findIndex((el, i) => i >= from && kindOf(el) === link.kind && hrefOf(el) === link.href)
    if (at === -1) continue
    out.set(link.index, elements[at] as HTMLElement)
    from = at + 1
  }
  return out
}

/** その要素を画面の真ん中へ送り、少しのあいだ枠で示す */
export function jumpToLink(el: HTMLElement): void {
  el.scrollIntoView({ block: 'center' })
  document.querySelector('[data-link-jump-flash]')?.remove()
  const rect = el.getBoundingClientRect()
  const flash = document.createElement('div')
  flash.setAttribute('data-link-jump-flash', '')
  flash.setAttribute('aria-hidden', 'true')
  flash.style.cssText = [
    'position:fixed',
    `left:${rect.left - 4}px`,
    `top:${rect.top - 4}px`,
    `width:${rect.width + 8}px`,
    `height:${rect.height + 8}px`,
    'border:2px solid #F08A00',
    'border-radius:6px',
    'background:rgba(240,138,0,.12)',
    'pointer-events:none',
    'z-index:2147483000',
    'transition:opacity .4s',
  ].join(';')
  document.body.append(flash)
  setTimeout(() => {
    flash.style.opacity = '0'
  }, FLASH_MS - 400)
  setTimeout(() => flash.remove(), FLASH_MS)
}
