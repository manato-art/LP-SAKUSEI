/**
 * ポップアップ編集フォームの小さな部品（exit-popup.ts から分離）。
 *
 * 入力欄1個ぶんの組み立てと、インラインstyleの読み書きなど。
 * どれも状態を持たず、渡されたものだけを見る。
 */
import { T, el } from '../ui.ts'

/** ラベル付きチェックボックス行（[wrap, checkbox] を返す）。 */
export function makeCheckboxRow(label: string, checked: boolean): [HTMLElement, HTMLInputElement] {
  const wrap = el('label', {
    style: 'display:flex;align-items:center;justify-content:flex-start;gap:8px;cursor:pointer;font-size:13px;color:var(--sb-c-444444, #444444);margin-bottom:0',
  })
  const cb = document.createElement('input')
  cb.type = 'checkbox'
  cb.checked = checked
  // .ep-field input の width:100%/padding を打ち消す（チェックボックスは実サイズで左寄せ）
  cb.style.cssText = 'width:16px;height:16px;flex:0 0 auto;margin:0;padding:0;cursor:pointer'
  const txt = el('span', { text: label, style: 'flex:0 1 auto;line-height:1.4' })
  wrap.append(cb, txt)
  return [wrap, cb]
}
/** CSSの色文字列（hex/rgb/名前）を input[type=color] 用の #rrggbb に正規化する。 */
export function colorToHex(value: string): string {
  const v = value.trim()
  if (v === '' || v === 'transparent') return ''
  const probe = document.createElement('span')
  probe.style.color = ''
  probe.style.color = v
  if (probe.style.color === '') return '' // 不正な色
  document.body.append(probe)
  const rgb = getComputedStyle(probe).color
  probe.remove()
  const m = /rgba?\(([^)]+)\)/.exec(rgb)
  if (m === null || m[1] === undefined) return ''
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()))
  const [r, g, b] = parts
  if (r === undefined || g === undefined || b === undefined) return ''
  const toHex = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
/** 要素の直下テキスト（子要素を除く自分のテキストノードだけ）を取り出す。 */
export function directText(elm: Element): string {
  let t = ''
  for (const n of elm.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) t += n.textContent ?? ''
  }
  return t
}
/** style属性から特定プロパティの値を読む（無ければ ''）。 */
export function readStyleProp(elm: Element, prop: string): string {
  const style = elm.getAttribute('style') ?? ''
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i')
  const m = re.exec(style)
  return m?.[1]?.trim() ?? ''
}
/** style属性に特定プロパティを設定/更新する（インラインstyleを壊さない）。 */
export function writeStyleProp(elm: HTMLElement, prop: string, value: string): void {
  elm.style.setProperty(prop, value)
}
export function makeTextField(
  label: string,
  value: string,
  onChange: (v: string) => void,
  placeholder = '',
): HTMLElement {
  const field = el('div', { class: 'ep-field' })
  field.append(el('label', { text: label }))
  const input = document.createElement('input')
  input.type = 'text'
  input.value = value
  input.placeholder = placeholder
  input.addEventListener('input', () => onChange(input.value))
  field.append(input)
  return field
}
export function makeNumberField(
  label: string,
  value: number,
  onChange: (v: number) => void,
): HTMLElement {
  const field = el('div', { class: 'ep-field' })
  field.append(el('label', { text: label }))
  const input = document.createElement('input')
  input.type = 'number'
  input.value = String(value)
  input.min = '0'
  input.addEventListener('input', () => {
    const n = Number(input.value)
    if (Number.isFinite(n)) onChange(n)
  })
  field.append(input)
  return field
}
/** 数値入力 + サフィックスラベル（本番準拠: 「秒」「%」等） */
export function makeSuffixField(
  label: string,
  value: number,
  suffix: string,
  onChange: (v: number) => void,
): HTMLElement {
  const field = el('div', { class: 'ep-field' })
  field.append(el('label', { text: label }))
  const row = el('div', { style: 'display:flex;align-items:center;gap:6px' })
  const input = document.createElement('input')
  input.type = 'number'
  input.value = String(value)
  input.min = '0'
  input.style.cssText = 'flex:1;padding:8px 10px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:4px;font-size:13px;box-sizing:border-box'
  input.addEventListener('input', () => {
    const n = Number(input.value)
    if (Number.isFinite(n)) onChange(n)
  })
  const suffixEl = el('span', { text: suffix, style: `font-size:13px;color:${T.sub};flex-shrink:0` })
  row.append(input, suffixEl)
  field.append(row)
  return field
}
/** コードエディタの行番号ガターを更新する。 */
export function updateGutter(gutter: HTMLElement, content: string): void {
  const count = (content.match(/\n/g)?.length ?? 0) + 1
  const lines: string[] = []
  for (let i = 1; i <= Math.max(count, 20); i++) lines.push(String(i))
  gutter.textContent = lines.join('\n')
}
