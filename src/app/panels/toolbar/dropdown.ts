/**
 * ツールバー内のドロップダウン（書式 / 文字サイズ / フォント / 整列）の開閉。
 * 開いたときに付くクラスと inline style は `toolbar-align-open/dom.html` から verbatim。
 */
import { CLS, HOOK } from './hooks.ts'
import type { QuillRange } from './placement.ts'

/** 開いたドロップダウンに実物が付ける inline style（toolbar-align-open/dom.html より verbatim） */
const DROPDOWN_OPEN_STYLE = 'top: 24px; border-top: 8px solid transparent; left: 50%; margin-left: -15px;'
const DROPDOWN_ARROW_STYLE = 'left: 7px;'

export interface ToolbarState {
  lastRange: QuillRange | null
  /** ドロップダウン等を開いている間は、選択が外れてもツールバーを出したままにする */
  keepOpen: boolean
}

export interface Dropdown {
  readonly body: HTMLElement
  readonly open: () => void
  readonly close: () => void
  readonly isOpen: () => boolean
}

export type DropdownName = 'align' | 'header' | 'fontSize' | 'fontFamily'
export type DropdownMap = Partial<Record<DropdownName, Dropdown>>

export function wireDropdowns(wrapper: HTMLElement, ctx: ToolbarState): DropdownMap {
  const alignItem = [...wrapper.querySelectorAll<HTMLElement>(HOOK.align)].find(
    (node) => node.querySelector(HOOK.alignIcon) !== null,
  )
  const map: DropdownMap = {
    align: alignItem === undefined ? undefined : createDropdown(alignItem, ctx),
    header: createDropdown(wrapper.querySelector<HTMLElement>(HOOK.header), ctx),
    fontSize: createDropdown(wrapper.querySelector<HTMLElement>(HOOK.fontSize), ctx),
    fontFamily: createDropdown(wrapper.querySelector<HTMLElement>(HOOK.fontFamily), ctx),
  }
  // 1つ開いたら他は閉じる
  for (const [name, dropdown] of Object.entries(map)) {
    if (dropdown === undefined) continue
    dropdown.body.addEventListener('sb-dropdown-open', () => {
      for (const [other, otherDropdown] of Object.entries(map)) {
        if (other !== name) otherDropdown?.close()
      }
    })
  }
  return map
}

export function createDropdown(item: HTMLElement | null, ctx: ToolbarState): Dropdown | undefined {
  if (item === null) return undefined
  const trigger = item.querySelector<HTMLElement>(HOOK.trigger)
  const body = item.querySelector<HTMLElement>(HOOK.bodyWrapper)
  if (trigger === null || body === null) return undefined

  const arrow = body.querySelector<HTMLElement>(HOOK.dropdownArrow)
  const isOpen = (): boolean => body.classList.contains(CLS.dropdownOpen)

  const close = (): void => {
    if (!isOpen()) return
    body.classList.remove(CLS.dropdownOpen)
    body.removeAttribute('style')
    arrow?.classList.remove(CLS.dropdownArrowTop)
    arrow?.removeAttribute('style')
    ctx.keepOpen = false
  }
  const open = (): void => {
    body.classList.add(CLS.dropdownOpen)
    body.setAttribute('style', DROPDOWN_OPEN_STYLE)
    arrow?.classList.add(CLS.dropdownArrowTop)
    arrow?.setAttribute('style', DROPDOWN_ARROW_STYLE)
    ctx.keepOpen = true
    body.dispatchEvent(new Event('sb-dropdown-open'))
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation()
    if (isOpen()) close()
    else open()
  })
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    if (target !== null && item.contains(target)) return
    close()
  })
  return { body, open, close, isOpen }
}

export function closeAllDropdowns(dropdowns: DropdownMap): void {
  for (const dropdown of Object.values(dropdowns)) dropdown?.close()
}
