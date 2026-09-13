/**
 * サイドバーの「テーマカラー」から開く小さな色選び（2026-09-13・本人指示）。
 * これまでは「設定＞アカウント」の一番下まで行かないと色を変えられなかった。
 */
import { api } from '../api.ts'
import { T, el, toast } from '../ui.ts'
import { setThemeMode, storedMode, type ThemeMode } from '../theme-mode.ts'
import { buildAccentPicker } from './accent-picker.ts'

let currentMenu: HTMLElement | null = null

function closeMenu(): void {
  currentMenu?.remove()
  currentMenu = null
  document.removeEventListener('click', closeMenu)
}

/** サイドバーの項目の横に色選びを出す */
export function openThemeColorMenu(anchor: HTMLElement): void {
  closeMenu()

  const menu = el('div', {
    style: [
      'position:fixed;z-index:9999',
      `background:${T.surface};border-radius:10px;padding:16px`,
      'box-shadow:0 6px 24px rgba(0,0,0,.18)',
      `font-family:${T.font};width:260px`,
    ].join(';'),
  })
  menu.addEventListener('click', (event) => event.stopPropagation())
  menu.append(
    el('div', {
      text: '表示モード',
      style: `font-size:13px;font-weight:700;color:${T.text};margin-bottom:10px`,
    }),
    buildModeSwitch(),
    el('div', {
      text: 'テーマカラー',
      style: `font-size:13px;font-weight:700;color:${T.text};margin:18px 0 10px`,
    }),
    buildAccentPicker({ dotSize: 26 }),
  )

  document.body.append(menu)
  currentMenu = menu

  // サイドバーは画面の左下にあるので、項目の右上に出す（画面からはみ出さないよう寄せる）
  const rect = anchor.getBoundingClientRect()
  const height = menu.offsetHeight
  menu.style.left = `${rect.right + 8}px`
  menu.style.top = `${Math.max(8, Math.min(rect.bottom - height, window.innerHeight - height - 8))}px`

  // 1フレーム遅らせる（今のクリックが伝播して即閉じるのを防ぐ）
  requestAnimationFrame(() => document.addEventListener('click', closeMenu))
}

/** ライト／ダークの切り替え（既定はライト＝今までと同じ見た目） */
function buildModeSwitch(): HTMLElement {
  const row = el('div', { style: 'display:flex;gap:8px' })
  let current = storedMode()

  const buttons: { mode: ThemeMode; el: HTMLButtonElement }[] = []
  const paint = (): void => {
    for (const b of buttons) {
      const isOn = b.mode === current
      b.el.style.borderColor = isOn ? 'var(--sb-accent, #0091FF)' : T.line
      b.el.style.color = isOn ? 'var(--sb-accent, #0091FF)' : T.sub
      b.el.style.fontWeight = isOn ? '700' : '400'
    }
  }

  for (const { mode, label } of [
    { mode: 'light' as const, label: 'ライト' },
    { mode: 'dark' as const, label: 'ダーク' },
  ]) {
    const btn = el('button', {
      text: label,
      style: [
        `flex:1;padding:8px 0;border-radius:8px;border:1.5px solid ${T.line}`,
        `background:${T.surface};cursor:pointer;font-size:12px;font-family:${T.font}`,
      ].join(';'),
    })
    btn.type = 'button'
    btn.addEventListener('click', () => {
      if (mode === current) return
      current = mode
      paint()
      void setThemeMode(mode, (v) => api.saveThemeMode(v)).then(
        () => toast(mode === 'dark' ? 'ダークモードにしました' : 'ライトモードにしました'),
        (error: Error) => toast(error.message, 'error'),
      )
    })
    buttons.push({ mode, el: btn })
    row.append(btn)
  }

  paint()
  return row
}
