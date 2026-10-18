/**
 * 画像・動画を選んだときの右の欄の「配置」（左・中央・右・2026-10-18 本人「動画や画像の位置も左右で選びたい」）。
 * 文字の「配置」と同じ形のボタン。何を寄せるか（画像は行・動画は動画自身）は呼ぶ側が決める（media-align.ts）。
 */
import type { MediaAlign } from './media-align.ts'
import { group } from './properties-parts.ts'
import { SVG } from './properties-panel-styles.ts'

const CHOICES: readonly { align: MediaAlign; svg: string; title: string }[] = [
  { align: 'left', svg: SVG.alignLeft, title: '左に寄せる' },
  { align: 'center', svg: SVG.alignCenter, title: '中央に置く' },
  { align: 'right', svg: SVG.alignRight, title: '右に寄せる' },
]

const ALIGN_DATA = 'data-media-align'

/** 「配置」の欄（押した位置を onPick に知らせる） */
export function buildMediaAlignGroup(onPick: (align: MediaAlign) => void): HTMLElement {
  const el = group('配置')
  const buttons = document.createElement('div')
  buttons.className = 'sb-align-btns'
  for (const choice of CHOICES) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'sb-align-btn'
    btn.title = choice.title
    btn.innerHTML = choice.svg
    btn.setAttribute(ALIGN_DATA, choice.align)
    btn.addEventListener('click', () => onPick(choice.align))
    buttons.append(btn)
  }
  el.append(buttons)
  return el
}

/** 今の位置を光らせる。寄せられないもの（null）のときは欄ごと隠す */
export function syncMediaAlign(el: HTMLElement, align: MediaAlign | null): void {
  if (align === null) el.style.setProperty('display', 'none')
  else el.style.removeProperty('display')
  for (const btn of el.querySelectorAll<HTMLElement>(`[${ALIGN_DATA}]`)) {
    btn.classList.toggle('active', btn.getAttribute(ALIGN_DATA) === align)
  }
}
