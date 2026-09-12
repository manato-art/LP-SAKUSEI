/**
 * サイドバーの「テーマカラー」から開く小さな色選び（2026-09-13・本人指示）。
 * これまでは「設定＞アカウント」の一番下まで行かないと色を変えられなかった。
 */
import { T, el } from '../ui.ts'
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
      text: 'テーマカラー',
      style: `font-size:13px;font-weight:700;color:${T.text};margin-bottom:10px`,
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
