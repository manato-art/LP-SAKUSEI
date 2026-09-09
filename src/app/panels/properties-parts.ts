/**
 * 右プロパティパネルの小部品（properties-panel.ts から分離）。
 *
 * 見出し付きのグループ、ラベル + 中身の1行、色ピッカー、書式ボタン。
 * どれも状態を持たず、渡されたものだけを見る。
 */

export function group(titleText: string): HTMLElement {
  const g = document.createElement('div')
  g.className = 'sb-pg'
  const t = document.createElement('div')
  t.className = 'sb-pg-title'
  t.textContent = titleText
  g.append(t)
  return g
}
export function row(labelText: string): HTMLElement {
  const r = document.createElement('div')
  r.className = 'sb-pr'
  const l = document.createElement('span')
  l.className = 'sb-pr-label'
  l.textContent = labelText
  r.append(l)
  return r
}
export function colorPicker(initial: string): {
  wrap: HTMLElement
  swatch: HTMLElement
  picker: HTMLInputElement
  hex: HTMLInputElement
} {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:flex;align-items:center;gap:6px;flex:1'

  const swatch = document.createElement('div')
  swatch.className = 'sb-pr-color-swatch'
  swatch.style.background = initial

  const picker = document.createElement('input')
  picker.type = 'color'
  picker.value = initial
  swatch.append(picker)
  swatch.addEventListener('click', () => picker.click())

  const hex = document.createElement('input')
  hex.className = 'sb-pr-color-hex'
  hex.value = initial.toUpperCase()

  wrap.append(swatch, hex)
  return { wrap, swatch, picker, hex }
}
export function fmtBtn(svg: string, titleText: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'sb-fmt-btn'
  btn.title = titleText
  btn.innerHTML = svg
  return btn
}
