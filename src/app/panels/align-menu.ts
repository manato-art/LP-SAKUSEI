/**
 * 上のツールバーの「配置」から出す、左・中央・右を選ぶ小窓（2026-09-24・本人が見せたデザインの「配置 ⌄」）。
 *
 * 部品を選んでいれば、その部品の置く位置（見出し・文章は文字の寄せ）。
 * 選んでいなければ（見本の中の文字など）、選んだ文字の寄せ（左・中央・右・両端）。
 * 絵のボタンで選び、今の値は青く見せる。押したら閉じる。外を押すか Esc でも閉じる。
 * 文字を選んだまま使えるように、ボタンを押しても選択は外さない（mousedown を止める）。
 */
import { ALIGN_ICONS, PLACE_ICONS } from './nocode/templates/option-icons.ts'

const ATTR = 'data-align-menu'
const FONT = '"Hiragino Sans",sans-serif'
const ACCENT = 'var(--sb-accent, #0091FF)'

export type AlignSide = 'left' | 'center' | 'right'

/** 選んだ部品の、配置で変えるもの（部品を選んでいないときは null） */
export interface AlignTarget {
  /** place＝部品の置く位置、text＝見出し・文章の文字の寄せ */
  readonly kind: 'place' | 'text'
  readonly value: AlignSide
  readonly set: (value: AlignSide) => void
}

interface Choice {
  readonly value: string
  readonly label: string
  readonly icon: string
}

const JUSTIFY_ICON =
  '<svg viewBox="0 0 32 24" width="32" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round"><path d="M5 6 H27 M5 12 H27 M5 18 H27"/></svg>'

const PLACE_CHOICES: readonly Choice[] = [
  { value: 'left', label: '左に置く', icon: PLACE_ICONS.left },
  { value: 'center', label: '中央に置く', icon: PLACE_ICONS.center },
  { value: 'right', label: '右に置く', icon: PLACE_ICONS.right },
]
const TEXT_CHOICES: readonly Choice[] = [
  { value: 'left', label: '左寄せ', icon: ALIGN_ICONS.left },
  { value: 'center', label: '中央寄せ', icon: ALIGN_ICONS.center },
  { value: 'right', label: '右寄せ', icon: ALIGN_ICONS.right },
]
/** 部品を選んでいないとき（選んだ文字の寄せ。execCommand の justify*） */
const FREE_TEXT_CHOICES: readonly Choice[] = [
  ...TEXT_CHOICES,
  { value: 'full', label: '両端そろえ', icon: JUSTIFY_ICON },
]

export function closeAlignMenu(): void {
  document.querySelector(`[${ATTR}]`)?.remove()
}

/**
 * 小窓を開く。target が null なら、選んだ文字の寄せ（onFreeText に 'left'|'center'|'right'|'full' を渡す）
 */
export function openAlignMenu(anchor: HTMLElement, target: AlignTarget | null, onFreeText: (value: string) => void): void {
  closeAlignMenu()
  const title = target === null ? '文字の寄せ' : target.kind === 'place' ? '置く位置' : '文字の寄せ'
  const choices = target === null ? FREE_TEXT_CHOICES : target.kind === 'place' ? PLACE_CHOICES : TEXT_CHOICES
  const current = target?.value ?? null

  const box = document.createElement('div')
  box.setAttribute(ATTR, 'true')
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-label', title)
  box.style.cssText =
    `position:fixed;z-index:9600;background:var(--sb-c-ffffff, #FFFFFF);border:1px solid var(--sb-c-e3e5e9, #E3E5E9);border-radius:10px;box-shadow:0 6px 22px rgba(0,0,0,.14);` +
    `padding:8px 10px 10px;display:flex;flex-direction:column;gap:6px;font:12px/1.4 ${FONT};color:var(--sb-c-555555, #555555)`
  box.addEventListener('mousedown', (e) => {
    e.preventDefault() // 選んだ文字を外さない
    e.stopPropagation()
  })
  const head = document.createElement('div')
  head.textContent = title
  head.style.cssText = 'color:var(--sb-c-6b7480, #6B7480);font-size:11px'
  const row = document.createElement('div')
  row.setAttribute('role', 'radiogroup')
  row.setAttribute('aria-label', title)
  row.style.cssText = 'display:flex;gap:6px'
  for (const choice of choices) {
    const on = choice.value === current
    const b = document.createElement('button')
    b.type = 'button'
    b.dataset['align'] = choice.value
    b.setAttribute('role', 'radio')
    b.setAttribute('aria-checked', String(on))
    b.setAttribute('aria-label', choice.label)
    b.title = choice.label
    b.innerHTML = choice.icon
    b.style.cssText =
      `display:flex;align-items:center;justify-content:center;width:46px;height:36px;padding:0;border-radius:7px;cursor:pointer;` +
      `border:1px solid ${on ? ACCENT : 'var(--sb-c-dddddd, #DDDDDD)'};background:${on ? 'var(--sb-accent-tint, #E6F4FF)' : 'var(--sb-c-ffffff, #FFFFFF)'};color:${on ? ACCENT : 'var(--sb-c-6b7480, #6B7480)'}`
    b.addEventListener('click', () => {
      close()
      if (target === null) onFreeText(choice.value)
      else target.set(choice.value as AlignSide)
    })
    row.append(b)
  }
  box.append(head, row)
  document.body.append(box)
  const r = anchor.getBoundingClientRect()
  box.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - box.offsetWidth - 8))}px`
  box.style.top = `${r.bottom + 6}px`

  const onOutside = (e: MouseEvent): void => {
    if (box.contains(e.target as Node) || anchor.contains(e.target as Node)) return
    close()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close()
  }
  const close = (): void => {
    box.remove()
    document.removeEventListener('mousedown', onOutside, true)
    document.removeEventListener('keydown', onKey, true)
  }
  setTimeout(() => {
    document.addEventListener('mousedown', onOutside, true)
    document.addEventListener('keydown', onKey, true)
  }, 0)
}
