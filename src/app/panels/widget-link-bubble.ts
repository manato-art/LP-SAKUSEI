/**
 * Widget編集の見たまま画面で、リンクのボタンを押すと出る「リンク先」の吹き出し（2026-09-22）。
 *
 * 本人の決定「単独のボタン（申し込みボタン等）はリンクのまま残し、リンク先を入れやすくする」。
 * SBの見本のボタンは、リンク先が仮（ooooo・○○○○○・# など）のまま入っている（約450件）。
 * これまでは、ボタンの文字を選んでツールバーの「リンク」から入れ直すか、コードを直すしかなかった。
 *  - ボタンを押す（編集の押し方）と、下にリンク先を出す。仮なら「仮のリンク」と知らせる
 *  - 「リンク先を入れる／変える」でその場で入れる。開けない形（javascript: 等）は入れない
 *  - 計測の目印（sb_tracking）は元のリンクに合わせる（link-placeholder.ts の replacedHref）
 *  - 押すと画面が切り替わるボタン（data-nc-go）はリンクではないので、そう知らせるだけ
 * 保存はいつもどおりコード欄へ書き出す（onChange＝見たまま画面の input）。
 */
import { toast } from '../ui.ts'
import { TRACKING_ATTRIBUTE } from '../../shared/link-html.ts'
import { isPlaceholderHref, replacedHref } from './link-placeholder.ts'
import { COLOR, FONT } from './widget-editor-theme.ts'

const BUBBLE_ATTR = 'data-widget-link-bubble'

let detach: (() => void) | null = null

export function closeLinkBubble(): void {
  detach?.()
  detach = null
  document.querySelector(`[${BUBBLE_ATTR}]`)?.remove()
}

function button(text: string, primary: boolean): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = text
  b.style.cssText = primary
    ? `border:none;background:${COLOR.brand};color:#fff;border-radius:6px;padding:5px 10px;cursor:pointer;font:12px ${FONT};flex-shrink:0`
    : `border:1px solid #d5d5d5;background:#fff;color:#333;border-radius:6px;padding:4px 10px;cursor:pointer;font:12px ${FONT};flex-shrink:0`
  return b
}

/** 吹き出しの置き場所（ボタンの下。下に入らなければ上）。画面の端からはみ出さない */
function positionOf(box: HTMLElement, anchor: HTMLElement): { left: string; top: string } {
  const r = anchor.getBoundingClientRect()
  const below = r.bottom + 6
  return {
    left: `${Math.max(8, Math.min(r.left, window.innerWidth - box.offsetWidth - 8))}px`,
    top: below + box.offsetHeight > window.innerHeight - 8 ? `${Math.max(8, r.top - box.offsetHeight - 6)}px` : `${below}px`,
  }
}

/** anchor のリンク先の吹き出しを出す。リンク先を入れたら onChange（コード欄へ書き出す） */
export function openLinkBubble(anchor: HTMLAnchorElement, onChange: () => void): void {
  closeLinkBubble()
  const box = document.createElement('div')
  box.setAttribute(BUBBLE_ATTR, 'true')
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-label', 'リンク先')
  box.style.cssText =
    `position:fixed;z-index:9600;background:#fff;border:1px solid #ddd;border-radius:8px;` +
    `box-shadow:0 4px 18px rgba(0,0,0,.18);padding:8px 10px;display:flex;flex-wrap:wrap;gap:6px 8px;` +
    `align-items:center;max-width:min(380px,calc(100vw - 16px));font:12px/1.5 ${FONT};color:#333`
  // 吹き出しの中を押しても、見たまま画面の選択や「外を押したら閉じる」に拾わせない
  box.addEventListener('mousedown', (e) => e.stopPropagation())

  const label = document.createElement('span')
  label.style.cssText = 'color:#6B7480;flex-shrink:0'

  const go = anchor.getAttribute('data-nc-go')
  if (go !== null) {
    label.textContent = '押したとき'
    const note = document.createElement('span')
    note.textContent = '同じWidgetの中の次の画面へ移ります（リンクではありません）'
    box.append(label, note)
  } else {
    const view = (): void => {
      const href = anchor.getAttribute('href') ?? ''
      const placeholder = isPlaceholderHref(href)
      label.textContent = 'リンク先'
      const value = document.createElement('span')
      value.textContent = placeholder ? '（まだ入っていません）' : href
      value.title = href
      value.style.cssText = 'min-width:0;flex:1 1 140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1F2A37'
      const parts: HTMLElement[] = [label, value]
      if (placeholder) {
        const pill = document.createElement('span')
        pill.textContent = '仮のリンク'
        pill.style.cssText = 'flex-shrink:0;border-radius:999px;padding:1px 8px;background:#FFF1DB;color:#8A5300;font-weight:700'
        parts.push(pill)
      }
      const change = button(placeholder ? 'リンク先を入れる' : '変える', placeholder)
      change.addEventListener('click', edit)
      parts.push(change)
      box.replaceChildren(...parts)
      Object.assign(box.style, positionOf(box, anchor))
    }
    const edit = (): void => {
      const href = anchor.getAttribute('href') ?? ''
      label.textContent = 'リンク先'
      const input = document.createElement('input')
      input.type = 'url'
      input.placeholder = 'https://'
      input.value = isPlaceholderHref(href) ? '' : href
      input.setAttribute('aria-label', 'リンク先のURL')
      input.style.cssText = `flex:1 1 200px;min-width:0;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;outline:none;font:12px ${FONT}`
      const warn = document.createElement('span')
      warn.style.cssText = 'flex-basis:100%;color:#C4321C'
      warn.hidden = true
      const ok = button('適用', true)
      const cancel = button('やめる', false)
      const apply = (): void => {
        const next = replacedHref(anchor.getAttribute('href') ?? '', anchor.getAttribute(TRACKING_ATTRIBUTE), input.value)
        if (next === null) {
          warn.textContent = 'このリンクは開けません。https:// から始まるURLか、# で始まるページ内の場所を書いてください'
          warn.hidden = false
          return
        }
        anchor.setAttribute('href', next)
        onChange()
        closeLinkBubble()
        toast('リンク先を入れました')
      }
      ok.addEventListener('click', apply)
      cancel.addEventListener('click', view)
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          apply()
        }
        if (e.key === 'Escape') view()
      })
      box.replaceChildren(label, input, ok, cancel, warn)
      Object.assign(box.style, positionOf(box, anchor))
      input.focus()
    }
    view()
  }

  document.body.append(box)
  Object.assign(box.style, positionOf(box, anchor))
  const onOutside = (e: MouseEvent): void => {
    if (e.target instanceof Node && (box.contains(e.target) || anchor.contains(e.target))) return
    closeLinkBubble()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') closeLinkBubble()
  }
  // 見たまま画面が動いたら、吹き出しをボタンについて行かせる（ボタンが消えたら閉じる）
  const onScroll = (): void => {
    if (!anchor.isConnected) {
      closeLinkBubble()
      return
    }
    Object.assign(box.style, positionOf(box, anchor))
  }
  setTimeout(() => {
    document.addEventListener('mousedown', onOutside, true)
    document.addEventListener('keydown', onKey)
    document.addEventListener('scroll', onScroll, true)
  }, 0)
  detach = () => {
    document.removeEventListener('mousedown', onOutside, true)
    document.removeEventListener('keydown', onKey)
    document.removeEventListener('scroll', onScroll, true)
  }
}
