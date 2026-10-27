/**
 * カラーコードの入力欄を、押すとパレット（ブラウザの色選び）が開く欄にする（2026-10-27 本人
 * 「LP設定の背景をカラーコードではなくパレットで選択できるように。他にもカラーコードの部分があれば設定して」）。
 *
 * - 見た目は右のプロパティ欄の色と同じ並び（色見本＋コード）。欄のどこを押してもパレットが開く
 * - 選んだ色は元の入力欄へ入れる（元の欄は隠すだけ＝保存の仕組みはそのまま）
 * - コードで入れたいときは、パレットの中の欄（RGB と HEX の切り替え）で入れられる
 */

const STYLE_ID = 'lp-palette-field-css'

/** 欄の見た目を1回だけ入れる */
function injectCss(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent =
    '.lp-palette-field{position:relative;display:flex !important;align-items:center;gap:8px;width:100%;cursor:pointer;' +
    'text-align:left;font:inherit;color:#1a1a1a}' +
    '.lp-palette-swatch{width:22px;height:22px;border-radius:4px;border:1px solid rgba(0,0,0,.18);flex:none;box-sizing:border-box}' +
    '.lp-palette-code{font-variant-numeric:tabular-nums;letter-spacing:.02em}' +
    '.lp-palette-code[data-empty]{color:#999}' +
    // 色選びは欄の左下から開く（押した所の近く）。見えない・押せない
    '.lp-palette-field .lp-palette-picker{position:absolute !important;left:0 !important;bottom:0 !important;width:0 !important;' +
    'height:0 !important;margin:0 !important;padding:0 !important;border:0 !important;opacity:0 !important;pointer-events:none !important}' +
    // 元の欄の左の「#」（採取した CSS の ::before）は、コードの中に「#」があるので出さない
    '.lp-palette-group::before{content:none !important}'
  document.head.append(style)
}

/** `ffffff` / `#fff` / `#FFFFFF` を `#ffffff` に寄せる。色でなければ null */
export function toPaletteHex(raw: string): string | null {
  const value = raw.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{6}$/.test(value)) return `#${value}`
  if (/^[0-9a-f]{3}$/.test(value)) return `#${[...value].map((c) => c + c).join('')}`
  return null
}

/** 元の欄へ入れる値（# を付けない欄・付ける欄） */
export function toFieldValue(hex: string, withHash: boolean): string {
  return withHash ? hex : hex.slice(1)
}

export interface PaletteFieldOptions {
  /** 元の欄の値に「#」を付けるか（LP設定の欄は付けない） */
  readonly withHash: boolean
  /** 値が無いとき、パレットを開いたときの色 */
  readonly fallback: string
}

/** カラーコードの入力欄を、押すとパレットが開く欄にする。元の欄の値を先に入れておくこと */
export function paletteField(input: HTMLInputElement, options: PaletteFieldOptions): HTMLButtonElement {
  injectCss()
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `${input.className} lp-palette-field`.trim()
  button.title = 'クリックで色を選ぶ'
  const swatch = document.createElement('span')
  swatch.className = 'lp-palette-swatch'
  const code = document.createElement('span')
  code.className = 'lp-palette-code'
  const picker = document.createElement('input')
  picker.type = 'color'
  picker.className = 'lp-palette-picker'
  picker.tabIndex = -1
  picker.setAttribute('aria-hidden', 'true')
  button.append(swatch, code, picker)

  const show = (): void => {
    const hex = toPaletteHex(input.value)
    swatch.style.background = hex ?? '#ffffff'
    code.textContent = hex === null ? '未設定' : hex.toUpperCase()
    code.toggleAttribute('data-empty', hex === null)
    picker.value = hex ?? toPaletteHex(options.fallback) ?? '#ffffff'
  }
  show()

  button.addEventListener('click', () => {
    if (typeof picker.showPicker === 'function') picker.showPicker()
    else picker.click()
  })
  picker.addEventListener('input', () => {
    // eslint-disable-next-line no-param-reassign -- 選んだ色を元の欄へ入れるのがこの欄の役目（保存は元の欄から読む）
    input.value = toFieldValue(picker.value, options.withHash)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    show()
  })

  input.closest('[class*="_fontColorForm_"]')?.classList.add('lp-palette-group')
  // 採取した CSS が欄に display を付けているので、hidden 属性ではなく style で隠す
  input.style.setProperty('display', 'none', 'important')
  input.after(button)
  return button
}
