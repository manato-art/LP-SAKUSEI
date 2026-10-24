/**
 * 部品「進み具合」（Q1 › Q2 › Q3・2026-10-24 本人「アンケート」・本人の選択「出す（消せる）」）。
 *
 * 質問の数に合わせて自動で並ぶ: Widget の中で「進み具合」を置いた画面の数が全体の数、その画面が何番目かが今の番号
 * （builder.ts が数えて渡す）。今の番号だけ色を付ける。頭の文字（Q）と色は変えられる。
 */
import { layoutFields } from './block-kit.ts'
import { esc, inkOn, safeColor } from './kit.ts'
import { str, type BlockType, type ItemData } from './types.ts'

export const PROGRESS_TYPE = 'progress'

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

/** 今の番号の色の候補（金・朱・ローズ・青・紺） */
const PROGRESS_PRESETS: readonly string[] = ['#C9A24B', '#E5573F', '#D6336C', '#1F7AE0', '#1F2A37']

export const PROGRESS_BLOCK_TYPE: BlockType = {
  type: PROGRESS_TYPE,
  label: '進み具合',
  icon: svg('<circle cx="4.5" cy="12" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="19.5" cy="12" r="2.5"/><path d="M7.5 12h1.5M15 12h1.5"/>'),
  fields: [
    ...layoutFields('boxWidth'),
    { kind: 'color', key: 'color', label: '今の質問の色', presets: PROGRESS_PRESETS },
    { kind: 'text', key: 'prefix', label: '頭の文字', placeholder: 'Q', maxLength: 4 },
  ],
  newItem: () => ({ type: PROGRESS_TYPE, color: '#C9A24B', prefix: 'Q' }),
}

/**
 * 進み具合のHTMLとCSS。position＝今の番号（1から）、total＝全体の数。
 * 部品だけを描くとき（サムネ）は、呼ぶ側が 1 / 3 を渡す
 */
export function renderProgress(item: ItemData, n: number, s: string, position: number, total: number): { html: string; css: string } {
  const color = safeColor(str(item, 'color'), '#C9A24B')
  const prefix = esc(str(item, 'prefix').trim().slice(0, 4) || 'Q')
  const count = Math.max(1, total)
  const steps = Array.from({ length: count }, (_, i) => {
    const current = i + 1 === position
    return `<li class="nc-b-progress__step${current ? ' is-current' : ''}"${current ? ' aria-current="step"' : ''}>${prefix}${i + 1}</li>`
  })
  return {
    html: `<ol class="nc-b nc-b-progress nc-b-${n}" aria-label="質問 ${position} / ${count}">${steps.join('')}</ol>`,
    css:
      `${s} .nc-b-${n} .nc-b-progress__step.is-current{background:${color};color:${inkOn(color)}}` +
      `${s} .nc-b-${n} .nc-b-progress__step+.nc-b-progress__step::before{border-color:${color}}`,
  }
}

/** 進み具合の形の土台（使っているWidgetに1回） */
export function progressBaseCss(s: string): string {
  return (
    `${s} .nc-b-progress{list-style:none;margin:0 auto;padding:0;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px 26px}` +
    `${s} .nc-b-progress__step{position:relative;display:flex;align-items:center;justify-content:center;width:52px;height:52px;` +
    `border-radius:50%;background:#D9D9D9;color:#8A8A8A;font-size:18px;font-weight:800;line-height:1}` +
    // 番号の間の「›」
    `${s} .nc-b-progress__step+.nc-b-progress__step::before{content:"";position:absolute;left:-17px;top:50%;width:7px;height:7px;` +
    `border-top:3px solid;border-right:3px solid;transform:translateY(-50%) rotate(45deg)}` +
    `@media (max-width:480px){${s} .nc-b-progress__step{width:44px;height:44px;font-size:16px}}`
  )
}
