/**
 * 設定画面の「テーマカラー」。色を選ぶ部品そのものは `accent-picker.ts` と共用する
 * （サイドバーからも同じものを開くため）。
 */
import { T, el } from '../ui.ts'
import { buildAccentPicker } from './accent-picker.ts'

export function buildThemeColorSection(): HTMLElement {
  const wrap = el('div', { style: 'margin-top:28px' })
  wrap.append(
    el('div', {
      text: 'テーマカラー',
      style: `font-size:14px;font-weight:700;color:${T.text};margin-bottom:6px`,
    }),
    el('div', {
      text: 'ボタンや選択中の項目に使う色です。選ぶとすぐ画面に反映され、次回以降も同じ色になります。サイドバーの「テーマカラー」からも変えられます。',
      style: `font-size:12px;color:${T.sub};line-height:1.8;margin-bottom:14px`,
    }),
    buildAccentPicker({ dotSize: 34 }),
  )
  return wrap
}
