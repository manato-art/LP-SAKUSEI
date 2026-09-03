/**
 * 左固定サイドバーツールバー（テキスト書式パネル）。
 *
 * フローティングバブルツールバーの代替。常時表示でエディタ左側に固定配置。
 * Quill API 経由で書式を適用する点は既存のツールバーと同じ。
 */
import type Quill from 'quill'
import { T } from '../ui.ts'
import {
  TOOLBAR_FONT_SIZES,
  TOOLBAR_FONT_FAMILIES,
  cssFontFamilyValue,
  fontFamilyLabel,
  fontSizeLabel,
  headerLabel,
  allowPxSizeAndFreeFont,
} from './toolbar/text-format.ts'
import { pickAndInsertMedia } from './media-insert.ts'

// ── 定数 ──

const ALIGN_VALUES: readonly (string | false)[] = [false, 'center', 'right', 'justify']
const ALIGN_LABELS = ['左揃え', '中央揃え', '右揃え', '両端揃え'] as const
const PANEL_WIDTH = 380

// ── SVG アイコン ──

const ICONS: Readonly<Record<string, string>> = {
  bold: '<svg viewBox="0 0 18 18"><path d="M5 4h5.5a2.5 2.5 0 010 5H5zm0 5h6.5a2.5 2.5 0 010 5H5z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  underline: '<svg viewBox="0 0 18 18"><path d="M5 3v6a4 4 0 008 0V3" fill="none" stroke="currentColor" stroke-width="2"/><line x1="4" y1="16" x2="14" y2="16" stroke="currentColor" stroke-width="2"/></svg>',
  italic: '<svg viewBox="0 0 18 18"><line x1="11" y1="3" x2="7" y2="15" stroke="currentColor" stroke-width="2"/><line x1="8" y1="3" x2="13" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="5" y1="15" x2="10" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>',
  strike: '<svg viewBox="0 0 18 18"><line x1="3" y1="9" x2="15" y2="9" stroke="currentColor" stroke-width="1.5"/><path d="M6 3h6a2 2 0 010 4H6m0 4h7a2 2 0 000-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  superscript: '<svg viewBox="0 0 18 18"><text x="2" y="14" font-size="11" font-weight="bold" fill="currentColor">x</text><text x="11" y="8" font-size="8" font-weight="bold" fill="currentColor">2</text></svg>',
  subscript: '<svg viewBox="0 0 18 18"><text x="2" y="12" font-size="11" font-weight="bold" fill="currentColor">x</text><text x="11" y="16" font-size="8" font-weight="bold" fill="currentColor">2</text></svg>',
  link: '<svg viewBox="0 0 18 18"><path d="M7.5 10.5l3-3m-1.5-1.5a2.12 2.12 0 013 3l-4.5 4.5a2.12 2.12 0 01-3-3l4.5-4.5z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  image: '<svg viewBox="0 0 18 18"><rect x="2" y="3" width="14" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="7" r="1.5" fill="currentColor"/><path d="M2 13l4-4 3 3 2-2 5 5H3z" fill="currentColor" opacity=".3"/></svg>',
  alignLeft: '<svg viewBox="0 0 18 18"><line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="2"/><line x1="2" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="2"/><line x1="2" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="2"/><line x1="2" y1="16" x2="10" y2="16" stroke="currentColor" stroke-width="2"/></svg>',
  alignCenter: '<svg viewBox="0 0 18 18"><line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="2"/><line x1="4" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="2"/><line x1="2" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="2"/><line x1="5" y1="16" x2="13" y2="16" stroke="currentColor" stroke-width="2"/></svg>',
  alignRight: '<svg viewBox="0 0 18 18"><line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="2"/><line x1="6" y1="8" x2="16" y2="8" stroke="currentColor" stroke-width="2"/><line x1="2" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="2"/><line x1="8" y1="16" x2="16" y2="16" stroke="currentColor" stroke-width="2"/></svg>',
  alignJustify: '<svg viewBox="0 0 18 18"><line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="2"/><line x1="2" y1="8" x2="16" y2="8" stroke="currentColor" stroke-width="2"/><line x1="2" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="2"/><line x1="2" y1="16" x2="16" y2="16" stroke="currentColor" stroke-width="2"/></svg>',
  clearFormat: '<svg viewBox="0 0 18 18"><text x="2" y="13" font-size="12" font-style="italic" fill="currentColor">T</text><text x="11" y="8" font-size="9" fill="currentColor">x</text></svg>',
}

const ALIGN_ICON_KEYS = ['alignLeft', 'alignCenter', 'alignRight', 'alignJustify'] as const

// ── ヘルパー ──

function icon(key: string, size = 16): HTMLSpanElement {
  const span = document.createElement('span')
  span.innerHTML = ICONS[key] ?? ''
  const svg = span.querySelector('svg')
  if (svg !== null) {
    svg.setAttribute('width', String(size))
    svg.setAttribute('height', String(size))
  }
  return span
}

function makeSelect(options: readonly string[], current: string): HTMLSelectElement {
  const sel = document.createElement('select')
  sel.style.cssText = `
    flex:1;padding:4px 6px;border:1px solid #ddd;border-radius:4px;
    font-size:12px;font-family:${T.font};background:#fff;cursor:pointer;
    outline:none;min-width:0;
  `
  for (const opt of options) {
    const o = document.createElement('option')
    o.value = opt
    o.textContent = opt
    if (opt === current) o.selected = true
    sel.append(o)
  }
  return sel
}

// ── CSS ──

function injectStyles(): void {
  if (document.getElementById('sb-sidebar-toolbar-css') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-sidebar-toolbar-css'
  style.textContent = `
    .sb-side-tb { font-family: ${T.font}; font-size: 12px; color: #333; }
    .sb-side-tb * { box-sizing: border-box; }

    /* セクション区切り */
    .sb-side-tb-section {
      padding: 10px 12px;
      border-bottom: 1px solid #eee;
    }
    .sb-side-tb-section:last-child { border-bottom: none; }

    /* ── 大きいラベル付きボタン（2×4グリッド）── */
    .sb-side-tb-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
    }
    .sb-side-tb-big-btn {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 2px; padding: 8px 2px; border: 1px solid #ddd; border-radius: 6px;
      background: #fff; cursor: pointer; transition: background .15s;
      min-height: 52px;
    }
    .sb-side-tb-big-btn:hover { background: #f5f5f5; }
    .sb-side-tb-big-btn.active { background: #e3f2fd; border-color: #90caf9; }
    .sb-side-tb-big-btn span.label { font-size: 10px; color: #666; white-space: nowrap; }

    /* ── フィールド行 ── */
    .sb-side-tb-field {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 8px;
    }
    .sb-side-tb-field:last-child { margin-bottom: 0; }
    .sb-side-tb-field-label {
      font-size: 11px; color: #888; white-space: nowrap; min-width: 72px;
    }

    /* ── カラー表示 ── */
    .sb-side-tb-color-swatch {
      width: 22px; height: 22px; border-radius: 4px;
      border: 1px solid #ccc; cursor: pointer; flex-shrink: 0;
    }
    .sb-side-tb-color-input {
      flex: 1; padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px;
      font-size: 12px; font-family: monospace; outline: none;
      min-width: 0;
    }

    /* ── 整列ボタン行 ── */
    .sb-side-tb-align-row {
      display: flex; gap: 4px;
    }
    .sb-side-tb-align-btn {
      flex: 1; display: flex; align-items: center; justify-content: center;
      padding: 8px; border: 1px solid #ddd; border-radius: 6px;
      background: #fff; cursor: pointer; transition: background .15s;
      color: #555;
    }
    .sb-side-tb-align-btn:hover { background: #f5f5f5; }
    .sb-side-tb-align-btn.active { background: #2196F3; border-color: #2196F3; color: #fff; }

    /* ── その他の設定 ── */
    .sb-side-tb-accordion-header {
      display: flex; align-items: center; justify-content: space-between;
      cursor: pointer; padding: 8px 0; user-select: none;
    }
    .sb-side-tb-accordion-header .arrow {
      transition: transform .2s; font-size: 10px; color: #999;
    }
    .sb-side-tb-accordion-header.open .arrow { transform: rotate(180deg); }
    .sb-side-tb-accordion-body { display: none; padding-top: 6px; }
    .sb-side-tb-accordion-body.open { display: block; }
  `
  document.head.append(style)
}

// ── メイン ──

export function mountSidebarToolbar(quill: Quill, _editorRoot: HTMLElement): HTMLElement {
  injectStyles()
  allowPxSizeAndFreeFont(quill)

  const panel = document.createElement('div')
  panel.classList.add('sb-side-tb')
  panel.setAttribute('data-sidebar-toolbar', 'true')
  panel.style.cssText = `
    width:${PANEL_WIDTH}px;min-width:${PANEL_WIDTH}px;
    background:#fff;border-right:1px solid #e0e0e0;
    overflow-y:auto;overflow-x:hidden;
    height:100%;
  `

  // mousedown で選択を奪わない
  panel.addEventListener('mousedown', (e) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
    e.preventDefault()
  })

  // ── 書式適用ヘルパー ──
  const getRange = () => quill.getSelection()
  const getFormats = () => {
    const r = getRange()
    return r !== null ? quill.getFormat(r.index, r.length) : {}
  }
  const applyInline = (name: string, value: unknown): void => {
    const r = getRange()
    if (r === null || r.length === 0) return
    quill.formatText(r.index, r.length, name, value, 'user')
    quill.setSelection(r.index, r.length, 'silent')
    refresh()
  }
  const applyBlock = (name: string, value: unknown): void => {
    const r = getRange()
    if (r === null) return
    quill.formatLine(r.index, r.length, name, value, 'user')
    quill.setSelection(r.index, r.length, 'silent')
    refresh()
  }
  const toggleInline = (name: string): void => {
    applyInline(name, getFormats()[name] === true ? false : true)
  }

  // ── セクション1: 大きいラベル付きボタン（2×4） ──
  const sec1 = section()
  const grid = document.createElement('div')
  grid.classList.add('sb-side-tb-grid')

  interface BigBtn { key: string; icon: string; label: string; action: () => void }
  const bigButtons: BigBtn[] = [
    { key: 'bold', icon: 'bold', label: '大字', action: () => toggleInline('bold') },
    { key: 'underline', icon: 'underline', label: '下線', action: () => toggleInline('underline') },
    { key: 'italic', icon: 'italic', label: '斜体', action: () => toggleInline('italic') },
    { key: 'strike', icon: 'strike', label: '打消し', action: () => toggleInline('strike') },
    { key: 'super', icon: 'superscript', label: '上付き', action: () => applyInline('script', getFormats()['script'] === 'super' ? false : 'super') },
    { key: 'sub', icon: 'subscript', label: '下付き', action: () => applyInline('script', getFormats()['script'] === 'sub' ? false : 'sub') },
    { key: 'link', icon: 'link', label: 'リンク', action: () => wireLinkAction(quill) },
    { key: 'image', icon: 'image', label: '画像', action: () => pickAndInsertMedia(quill) },
  ]
  const btnElements = new Map<string, HTMLElement>()
  for (const btn of bigButtons) {
    const el = document.createElement('button')
    el.type = 'button'
    el.classList.add('sb-side-tb-big-btn')
    el.append(icon(btn.icon, 20))
    const lbl = document.createElement('span')
    lbl.classList.add('label')
    lbl.textContent = btn.label
    el.append(lbl)
    el.addEventListener('click', btn.action)
    grid.append(el)
    btnElements.set(btn.key, el)
  }
  sec1.append(grid)
  panel.append(sec1)

  // ── セクション2: テキストカラー + 背景色 ──
  const sec2 = section()

  const textColorHex = { value: '#000000' }
  const bgColorHex = { value: '#FFFFFF' }

  const { row: textColorRow, swatch: textSwatch, input: textColorInput } =
    colorField('テキストカラー', textColorHex.value)
  const { row: bgColorRow, swatch: bgSwatch, input: bgColorInput } =
    colorField('背景色', bgColorHex.value)

  textSwatch.addEventListener('click', () => {
    const color = prompt('テキスト色 (hex)', textColorHex.value)
    if (color !== null && /^#[0-9a-fA-F]{3,8}$/.test(color)) {
      textColorHex.value = color
      textSwatch.style.background = color
      textColorInput.value = color
      applyInline('color', color)
    }
  })
  textColorInput.addEventListener('change', () => {
    const v = textColorInput.value.trim()
    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) {
      textColorHex.value = v
      textSwatch.style.background = v
      applyInline('color', v)
    }
  })

  bgSwatch.addEventListener('click', () => {
    const color = prompt('背景色 (hex)', bgColorHex.value)
    if (color !== null && /^#[0-9a-fA-F]{3,8}$/.test(color)) {
      bgColorHex.value = color
      bgSwatch.style.background = color
      bgColorInput.value = color
      applyInline('background', color)
    }
  })
  bgColorInput.addEventListener('change', () => {
    const v = bgColorInput.value.trim()
    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) {
      bgColorHex.value = v
      bgSwatch.style.background = v
      applyInline('background', v)
    }
  })

  sec2.append(textColorRow, bgColorRow)
  panel.append(sec2)

  // ── セクション3: フォント + サイズ ──
  const sec3 = section()

  // フォント
  const fontField = document.createElement('div')
  fontField.classList.add('sb-side-tb-field')
  const fontLabel = document.createElement('div')
  fontLabel.classList.add('sb-side-tb-field-label')
  fontLabel.textContent = 'フォント'
  const fontSelect = makeSelect(TOOLBAR_FONT_FAMILIES, 'serif')
  fontSelect.addEventListener('change', () => {
    applyInline('font', cssFontFamilyValue(fontSelect.value))
  })
  fontField.append(fontLabel, fontSelect)

  // サイズ
  const sizeField = document.createElement('div')
  sizeField.classList.add('sb-side-tb-field')
  const sizeLabel = document.createElement('div')
  sizeLabel.classList.add('sb-side-tb-field-label')
  sizeLabel.textContent = 'サイズ'
  const sizeSelect = makeSelect(TOOLBAR_FONT_SIZES, '17px')
  sizeSelect.addEventListener('change', () => {
    applyInline('size', sizeSelect.value)
  })
  sizeField.append(sizeLabel, sizeSelect)

  // 書式
  const headerField = document.createElement('div')
  headerField.classList.add('sb-side-tb-field')
  const headerLbl = document.createElement('div')
  headerLbl.classList.add('sb-side-tb-field-label')
  headerLbl.textContent = '書式'
  const headerSelect = makeSelect(['Normal', '見出し1', '見出し2', '見出し3'], 'Normal')
  headerSelect.addEventListener('change', () => {
    const val = headerSelect.value
    if (val === 'Normal') applyBlock('header', false)
    else if (val === '見出し1') applyBlock('header', 1)
    else if (val === '見出し2') applyBlock('header', 2)
    else if (val === '見出し3') applyBlock('header', 3)
  })
  headerField.append(headerLbl, headerSelect)

  sec3.append(headerField, fontField, sizeField)
  panel.append(sec3)

  // ── セクション4: 整列 ──
  const sec4 = section()
  const alignRow = document.createElement('div')
  alignRow.classList.add('sb-side-tb-align-row')
  const alignBtns: HTMLElement[] = []
  ALIGN_ICON_KEYS.forEach((iconKey, i) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.classList.add('sb-side-tb-align-btn')
    btn.title = ALIGN_LABELS[i] ?? ''
    btn.append(icon(iconKey, 18))
    btn.addEventListener('click', () => {
      applyBlock('align', ALIGN_VALUES[i] ?? false)
    })
    alignRow.append(btn)
    alignBtns.push(btn)
  })
  sec4.append(alignRow)
  panel.append(sec4)

  // ── セクション5: その他の設定 ──
  const sec5 = section()
  const accHeader = document.createElement('div')
  accHeader.classList.add('sb-side-tb-accordion-header')
  accHeader.textContent = 'その他の設定'
  const arrow = document.createElement('span')
  arrow.classList.add('arrow')
  arrow.textContent = '▼'
  accHeader.append(arrow)

  const accBody = document.createElement('div')
  accBody.classList.add('sb-side-tb-accordion-body')

  // 書式クリアボタン
  const clearBtn = document.createElement('button')
  clearBtn.type = 'button'
  clearBtn.style.cssText = `
    display:flex;align-items:center;gap:6px;
    padding:8px 12px;border:1px solid #ddd;border-radius:6px;
    background:#fff;cursor:pointer;font-size:12px;font-family:${T.font};
    width:100%;
  `
  clearBtn.append(icon('clearFormat', 16))
  const clrLbl = document.createElement('span')
  clrLbl.textContent = '書式をクリア'
  clearBtn.append(clrLbl)
  clearBtn.addEventListener('click', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    quill.removeFormat(r.index, r.length, 'user')
    quill.setSelection(r.index, r.length, 'silent')
    refresh()
  })
  accBody.append(clearBtn)

  accHeader.addEventListener('click', () => {
    accHeader.classList.toggle('open')
    accBody.classList.toggle('open')
  })

  sec5.append(accHeader, accBody)
  panel.append(sec5)

  // ── 状態の同期 ──
  function refresh(): void {
    const fmt = getFormats()

    // 大ボタンの active 状態
    btnElements.get('bold')?.classList.toggle('active', fmt['bold'] === true)
    btnElements.get('underline')?.classList.toggle('active', fmt['underline'] === true)
    btnElements.get('italic')?.classList.toggle('active', fmt['italic'] === true)
    btnElements.get('strike')?.classList.toggle('active', fmt['strike'] === true)
    btnElements.get('super')?.classList.toggle('active', fmt['script'] === 'super')
    btnElements.get('sub')?.classList.toggle('active', fmt['script'] === 'sub')
    btnElements.get('link')?.classList.toggle('active', fmt['link'] !== undefined && fmt['link'] !== false)

    // ドロップダウンの同期
    headerSelect.value = headerLabel(fmt['header'])
    fontSelect.value = fontFamilyLabel(fmt['font'])
    sizeSelect.value = fontSizeLabel(fmt['size'])

    // カラー
    const tc = typeof fmt['color'] === 'string' ? fmt['color'] : '#000000'
    textSwatch.style.background = tc
    textColorInput.value = tc
    textColorHex.value = tc

    const bg = typeof fmt['background'] === 'string' ? fmt['background'] : '#FFFFFF'
    bgSwatch.style.background = bg
    bgColorInput.value = bg
    bgColorHex.value = bg

    // 整列
    const align = fmt['align']
    alignBtns.forEach((btn, i) => {
      const val = ALIGN_VALUES[i]
      btn.classList.toggle('active', val === false ? (align === undefined || align === false) : align === val)
    })
  }

  quill.on('selection-change', () => refresh())
  quill.on('text-change', () => refresh())
  // 初回同期
  setTimeout(refresh, 50)

  return panel
}

// ── ユーティリティ ──

function section(): HTMLDivElement {
  const div = document.createElement('div')
  div.classList.add('sb-side-tb-section')
  return div
}

function colorField(label: string, initial: string): {
  row: HTMLElement
  swatch: HTMLElement
  input: HTMLInputElement
} {
  const row = document.createElement('div')
  row.classList.add('sb-side-tb-field')

  const lbl = document.createElement('div')
  lbl.classList.add('sb-side-tb-field-label')
  lbl.textContent = label

  const swatch = document.createElement('div')
  swatch.classList.add('sb-side-tb-color-swatch')
  swatch.style.background = initial

  const input = document.createElement('input')
  input.type = 'text'
  input.value = initial
  input.classList.add('sb-side-tb-color-input')

  row.append(lbl, swatch, input)
  return { row, swatch, input }
}

/** リンクの適用（簡易版: prompt でURLを入力） */
function wireLinkAction(quill: Quill): void {
  const range = quill.getSelection()
  if (range === null || range.length === 0) return

  const currentFormat = quill.getFormat(range.index, range.length)
  const currentLink = typeof currentFormat['link'] === 'string' ? currentFormat['link'] : ''

  if (currentLink !== '') {
    // リンク済み → 解除
    quill.formatText(range.index, range.length, 'link', false, 'user')
    return
  }

  const url = prompt('リンクURL', 'https://')
  if (url === null || url.trim() === '' || url.trim() === 'https://') return
  quill.formatText(range.index, range.length, 'link', url.trim(), 'user')
}
