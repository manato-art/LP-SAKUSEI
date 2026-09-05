/**
 * 右プロパティパネル（エディタ右端 260px）。
 *
 * キャンバスで選択中のテキスト要素のプロパティを表示・編集する。
 * 旧コンテンツツールバーにあった全機能をここに集約する。
 *
 * タブ: コンテンツ / スタイル
 * セクション:
 *   テキスト / フォント / サイズ / 太字 / 斜体 / 文字色 / 背景色
 *   文字間隔 / 行間 / 配置 / 位置・サイズ / 書式 / 挿入 / アクション
 */
import type Quill from 'quill'
import {
  TOOLBAR_FONT_FAMILIES,
  cssFontFamilyValue,
  fontFamilyLabel,
  fontSizeLabel,
  allowPxSizeAndFreeFont,
} from './toolbar/text-format.ts'
import { pickAndInsertMedia } from './media-insert.ts'

/* ── CSS ── */

function injectStyles(): void {
  if (document.getElementById('sb-props-panel-css') !== null) return
  const s = document.createElement('style')
  s.id = 'sb-props-panel-css'
  s.textContent = `
    .sb-props-panel {
      width:260px; background:#fff; border-left:1px solid #e5e5ea;
      display:flex; flex-direction:column; flex-shrink:0;
      overflow-y:auto; overflow-x:hidden;
      height:calc(100vh - 92px);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,
        "Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;
      font-size:12px; user-select:none;
      box-sizing:border-box;
    }
    .sb-props-header {
      padding:10px 12px; border-bottom:1px solid #e5e5ea;
      display:flex; align-items:center; justify-content:space-between;
      flex-shrink:0;
    }
    .sb-props-header h3 {
      font-size:12px; font-weight:600; color:#1a1a1a; margin:0;
    }
    .sb-props-close {
      width:20px; height:20px; border:none; background:none;
      cursor:pointer; color:#b0b0b0; display:flex;
      align-items:center; justify-content:center; border-radius:4px;
      transition:background .12s,color .12s;
    }
    .sb-props-close:hover { background:#f0f0f2; color:#666; }
    .sb-props-tabs {
      display:flex; border-bottom:1px solid #e5e5ea; flex-shrink:0;
    }
    .sb-props-tab {
      flex:1; padding:9px; text-align:center; font-size:12px;
      font-weight:500; color:#666; cursor:pointer;
      border-bottom:2px solid transparent;
      transition:color .12s,border-color .12s;
      background:none; border-top:none; border-left:none; border-right:none;
      font-family:inherit;
    }
    .sb-props-tab:hover { color:#333; }
    .sb-props-tab.active { color:#0091ff; border-bottom-color:#0091ff; }
    .sb-props-body {
      padding:12px; display:flex; flex-direction:column; gap:12px;
      flex:1; overflow-y:auto;
    }
    .sb-props-empty {
      padding:32px 16px; text-align:center; color:#999;
      font-size:12px; line-height:1.8;
    }
    .sb-pg { display:flex; flex-direction:column; gap:5px; }
    .sb-pg-title {
      font-size:10px; font-weight:700; color:#1a1a1a;
      letter-spacing:.3px;
    }
    .sb-pr { display:flex; align-items:center; gap:6px; }
    .sb-pr-label {
      font-size:11px; color:#666; width:54px; flex-shrink:0;
    }
    .sb-pr-input {
      flex:1; height:28px; border:1px solid #e5e5ea; border-radius:4px;
      padding:0 6px; font-size:11px; color:#1a1a1a;
      font-family:inherit; outline:none; background:#fff;
      box-sizing:border-box;
    }
    .sb-pr-input:focus { border-color:#0091ff; }
    .sb-pr-select {
      flex:1; height:28px; border:1px solid #e5e5ea; border-radius:4px;
      padding:0 4px; font-size:11px; color:#1a1a1a;
      font-family:inherit; background:#fff; cursor:pointer;
    }
    .sb-pr-textarea {
      width:100%; min-height:44px; border:1px solid #e5e5ea; border-radius:4px;
      padding:6px; font-size:11px; color:#1a1a1a;
      font-family:inherit; outline:none; resize:vertical;
      background:#fff; box-sizing:border-box;
    }
    .sb-pr-textarea:focus { border-color:#0091ff; }
    .sb-pr-toggle {
      width:34px; height:18px; border-radius:9px; border:none;
      background:#e5e5ea; position:relative; cursor:pointer;
      transition:background .2s; flex-shrink:0; padding:0;
    }
    .sb-pr-toggle.on { background:#0091ff; }
    .sb-pr-toggle::after {
      content:''; position:absolute; top:2px; left:2px;
      width:14px; height:14px; border-radius:50%; background:#fff;
      transition:left .2s; box-shadow:0 1px 2px rgba(0,0,0,.2);
    }
    .sb-pr-toggle.on::after { left:18px; }
    .sb-pr-color-swatch {
      width:22px; height:22px; border-radius:3px;
      border:1px solid #e5e5ea; cursor:pointer; flex-shrink:0;
      position:relative;
    }
    .sb-pr-color-swatch input[type="color"] {
      position:absolute; opacity:0; width:0; height:0; pointer-events:none;
    }
    .sb-pr-color-hex {
      flex:1; height:26px; border:1px solid #e5e5ea; border-radius:3px;
      padding:0 6px; font-size:11px; color:#1a1a1a;
      font-family:inherit; font-variant-numeric:tabular-nums;
      box-sizing:border-box; outline:none;
    }
    .sb-pr-color-hex:focus { border-color:#0091ff; }
    .sb-pr-unit {
      font-size:10px; color:#b0b0b0; flex-shrink:0;
    }
    .sb-align-btns { display:flex; gap:0; }
    .sb-align-btn {
      width:32px; height:28px; border:1px solid #e5e5ea; background:#fff;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      color:#666; transition:background .12s; padding:0;
    }
    .sb-align-btn:first-child { border-radius:4px 0 0 4px; }
    .sb-align-btn:last-child { border-radius:0 4px 4px 0; }
    .sb-align-btn + .sb-align-btn { border-left:none; }
    .sb-align-btn:hover { background:#f0f0f2; }
    .sb-align-btn.active {
      background:rgba(0,145,255,.08); color:#0091ff; border-color:#0091ff;
    }
    .sb-fmt-btns { display:flex; gap:2px; flex-wrap:wrap; }
    .sb-fmt-btn {
      width:30px; height:28px; border:1px solid #e5e5ea; border-radius:4px;
      background:#fff; cursor:pointer; display:flex; align-items:center;
      justify-content:center; color:#666; transition:background .12s; padding:0;
    }
    .sb-fmt-btn:hover { background:#f0f0f2; }
    .sb-fmt-btn.active {
      background:rgba(0,145,255,.08); color:#0091ff; border-color:#0091ff;
    }
    .sb-pr-action {
      width:100%; height:32px; border:1px solid #e5e5ea; border-radius:5px;
      background:#fff; font-size:11px; color:#1a1a1a; cursor:pointer;
      font-family:inherit; display:flex; align-items:center;
      justify-content:center; gap:4px; transition:background .12s; padding:0;
    }
    .sb-pr-action:hover { background:#f0f0f2; }
    .sb-pr-action.danger { color:#e5573f; border-color:rgba(229,87,63,.3); }
    .sb-pr-action.danger:hover { background:rgba(229,87,63,.06); }
    .sb-ins-btns { display:flex; gap:4px; }
    .sb-ins-btn {
      flex:1; height:28px; border:1px solid #e5e5ea; border-radius:4px;
      background:#fff; font-size:10px; color:#1a1a1a; cursor:pointer;
      font-family:inherit; display:flex; align-items:center;
      justify-content:center; gap:3px; transition:background .12s; padding:0;
    }
    .sb-ins-btn:hover { background:#f0f0f2; }
    .sb-pr-size-grid {
      display:grid; grid-template-columns:auto 1fr auto auto 1fr auto;
      gap:3px; align-items:center;
    }
    .sb-pr-size-label {
      font-size:10px; color:#b0b0b0; font-weight:500;
    }
    .sb-pr-size-input {
      width:100%; height:26px; border:1px solid #e5e5ea; border-radius:3px;
      padding:0 4px; font-size:11px; color:#1a1a1a;
      font-family:inherit; text-align:center;
      font-variant-numeric:tabular-nums; box-sizing:border-box;
      outline:none;
    }
    .sb-pr-size-input:focus { border-color:#0091ff; }
    .sb-pr-size-unit {
      font-size:9px; color:#b0b0b0;
    }
    .sb-pr-stepper-wrap {
      display:flex; flex-direction:column; gap:0; margin-left:2px;
    }
    .sb-pr-stepper-btn {
      width:16px; height:12px; border:1px solid #e5e5ea; background:#fff;
      cursor:pointer; font-size:7px; display:flex;
      align-items:center; justify-content:center; color:#666;
      padding:0; line-height:1;
    }
    .sb-pr-stepper-btn:first-child { border-radius:2px 2px 0 0; }
    .sb-pr-stepper-btn:last-child { border-radius:0 0 2px 2px; border-top:none; }
    .sb-pr-stepper-btn:hover { background:#f0f0f2; }
  `
  document.head.append(s)
}

/* ── SVG icons ── */

const SVG = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  underline: '<svg viewBox="0 0 18 18" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3v6a4 4 0 0 0 8 0V3"/><line x1="3" y1="16" x2="15" y2="16"/></svg>',
  strike: '<svg viewBox="0 0 18 18" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="2" y1="9" x2="16" y2="9"/><path d="M12.5 5C12 3.5 10.5 3 9 3c-2 0-3.5 1-3.5 2.5S7 8 9 9c2.5 1 3.5 1.5 3.5 3S11 15 9 15c-1.5 0-3-.5-3.5-2"/></svg>',
  link: '<svg viewBox="0 0 18 18" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7.5 10.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M10.5 7.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1"/></svg>',
  clearFmt: '<svg viewBox="0 0 18 18" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 3h8l-3 12"/><line x1="3" y1="15" x2="10" y2="15"/><line x1="13" y1="3" x2="3" y2="15" stroke-width="1.5" stroke-dasharray="2 2"/></svg>',
  image: '<svg viewBox="0 0 18 18" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="14" height="14" rx="2"/><circle cx="7" cy="7" r="1.5"/><path d="M16 12l-4-4-8 8"/></svg>',
  lineBreak: '<svg viewBox="0 0 18 18" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 4v6a2 2 0 0 1-2 2H5"/><polyline points="7 10 5 12 7 14"/></svg>',
  duplicate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  alignLeft: '<svg viewBox="0 0 18 18" width="13" height="13"><line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="2"/><line x1="2" y1="9" x2="10" y2="9" stroke="currentColor" stroke-width="2"/><line x1="2" y1="14" x2="14" y2="14" stroke="currentColor" stroke-width="2"/></svg>',
  alignCenter: '<svg viewBox="0 0 18 18" width="13" height="13"><line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="2"/><line x1="5" y1="9" x2="13" y2="9" stroke="currentColor" stroke-width="2"/><line x1="2" y1="14" x2="16" y2="14" stroke="currentColor" stroke-width="2"/></svg>',
  alignRight: '<svg viewBox="0 0 18 18" width="13" height="13"><line x1="4" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="2"/><line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" stroke-width="2"/><line x1="4" y1="14" x2="16" y2="14" stroke="currentColor" stroke-width="2"/></svg>',
  alignJustify: '<svg viewBox="0 0 18 18" width="13" height="13"><line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="2"/><line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" stroke-width="2"/><line x1="2" y1="14" x2="16" y2="14" stroke="currentColor" stroke-width="2"/></svg>',
} as const

const ALIGN_LABELS: readonly { value: string | false; svg: string; title: string }[] = [
  { value: false, svg: SVG.alignLeft, title: '左揃え' },
  { value: 'center', svg: SVG.alignCenter, title: '中央揃え' },
  { value: 'right', svg: SVG.alignRight, title: '右揃え' },
  { value: 'justify', svg: SVG.alignJustify, title: '両端揃え' },
]

/* ── Public ── */

export function mountPropertiesPanel(quill: Quill): HTMLElement {
  injectStyles()
  allowPxSizeAndFreeFont(quill)

  const panel = document.createElement('div')
  panel.className = 'sb-props-panel'
  panel.setAttribute('data-props-panel', 'true')

  // ── ヘッダー ──
  const header = document.createElement('div')
  header.className = 'sb-props-header'
  const title = document.createElement('h3')
  title.innerHTML = 'プロパティ'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'sb-props-close'
  closeBtn.innerHTML = SVG.close
  closeBtn.title = '閉じる'
  closeBtn.addEventListener('click', () => {
    panel.style.display = 'none'
  })
  header.append(title, closeBtn)

  // ── タブ ──
  const tabs = document.createElement('div')
  tabs.className = 'sb-props-tabs'
  const contentTab = document.createElement('button')
  contentTab.type = 'button'
  contentTab.className = 'sb-props-tab active'
  contentTab.textContent = 'コンテンツ'
  const styleTab = document.createElement('button')
  styleTab.type = 'button'
  styleTab.className = 'sb-props-tab'
  styleTab.textContent = 'スタイル'
  contentTab.addEventListener('click', () => {
    contentTab.classList.add('active')
    styleTab.classList.remove('active')
  })
  styleTab.addEventListener('click', () => {
    styleTab.classList.add('active')
    contentTab.classList.remove('active')
  })
  tabs.append(contentTab, styleTab)

  // ── ボディ（コンテンツタブ） ──
  const body = document.createElement('div')
  body.className = 'sb-props-body'

  // 未選択時の表示
  const emptyMsg = document.createElement('div')
  emptyMsg.className = 'sb-props-empty'
  emptyMsg.textContent = 'テキストを選択すると\nここにプロパティが表示されます'
  emptyMsg.style.whiteSpace = 'pre-line'

  // ── helpers ──
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

  // ── テキスト ──
  const textGroup = group('テキスト')
  const textArea = document.createElement('textarea')
  textArea.className = 'sb-pr-textarea'
  textArea.readOnly = true
  textGroup.append(textArea)

  // ── フォント ──
  const fontRow = row('フォント')
  const fontSelect = document.createElement('select')
  fontSelect.className = 'sb-pr-select'
  for (const f of TOOLBAR_FONT_FAMILIES) {
    const o = document.createElement('option')
    o.value = f
    o.textContent = f
    fontSelect.append(o)
  }
  fontSelect.addEventListener('change', () => {
    applyInline('font', cssFontFamilyValue(fontSelect.value))
  })
  fontRow.append(fontSelect)

  // ── サイズ ──
  const sizeRow = row('サイズ')
  const sizeInput = document.createElement('input')
  sizeInput.className = 'sb-pr-input'
  sizeInput.type = 'number'
  sizeInput.min = '1'
  sizeInput.style.cssText = 'width:52px;flex:none;font-variant-numeric:tabular-nums'
  sizeInput.addEventListener('change', () => {
    const v = parseInt(sizeInput.value, 10)
    if (Number.isNaN(v) || v < 1) return
    applyInline('size', `${v}px`)
  })
  const sizeStepWrap = document.createElement('div')
  sizeStepWrap.className = 'sb-pr-stepper-wrap'
  const sizeUp = document.createElement('button')
  sizeUp.type = 'button'
  sizeUp.className = 'sb-pr-stepper-btn'
  sizeUp.textContent = '▲'
  sizeUp.addEventListener('click', () => {
    const v = parseInt(sizeInput.value, 10)
    if (Number.isNaN(v)) return
    sizeInput.value = String(v + 1)
    sizeInput.dispatchEvent(new Event('change'))
  })
  const sizeDown = document.createElement('button')
  sizeDown.type = 'button'
  sizeDown.className = 'sb-pr-stepper-btn'
  sizeDown.textContent = '▼'
  sizeDown.addEventListener('click', () => {
    const v = parseInt(sizeInput.value, 10)
    if (Number.isNaN(v) || v <= 1) return
    sizeInput.value = String(v - 1)
    sizeInput.dispatchEvent(new Event('change'))
  })
  sizeStepWrap.append(sizeUp, sizeDown)
  const sizeUnit = document.createElement('span')
  sizeUnit.className = 'sb-pr-unit'
  sizeUnit.textContent = 'px'
  sizeRow.append(sizeInput, sizeStepWrap, sizeUnit)

  // ── 太字 ──
  const boldRow = row('太字')
  const boldToggle = toggle(false)
  boldToggle.addEventListener('click', () => {
    toggleInline('bold')
  })
  const boldSpacer = document.createElement('div')
  boldSpacer.style.flex = '1'
  boldRow.append(boldSpacer, boldToggle)

  // ── 斜体 ──
  const italicRow = row('斜体')
  const italicToggle = toggle(false)
  italicToggle.addEventListener('click', () => {
    toggleInline('italic')
  })
  const italicSpacer = document.createElement('div')
  italicSpacer.style.flex = '1'
  italicRow.append(italicSpacer, italicToggle)

  // ── 文字色 ──
  const textColorRow = row('文字色')
  const { wrap: tcWrap, swatch: tcSwatch, picker: tcPicker, hex: tcHex } = colorPicker('#000000')
  tcPicker.addEventListener('input', () => {
    const c = tcPicker.value
    tcSwatch.style.background = c
    tcHex.value = c.toUpperCase()
    applyInline('color', c)
  })
  tcHex.addEventListener('change', () => {
    const c = tcHex.value.trim()
    if (/^#[0-9a-f]{6}$/i.test(c)) {
      tcSwatch.style.background = c
      tcPicker.value = c
      applyInline('color', c)
    }
  })
  textColorRow.append(tcWrap)

  // ── 背景色 ──
  const bgColorRow = row('背景色')
  const { wrap: bgWrap, swatch: bgSwatch, picker: bgPicker, hex: bgHex } = colorPicker('#FFFFFF')
  bgPicker.addEventListener('input', () => {
    const c = bgPicker.value
    bgSwatch.style.background = c
    bgHex.value = c.toUpperCase()
    applyInline('background', c)
  })
  bgHex.addEventListener('change', () => {
    const c = bgHex.value.trim()
    if (/^#[0-9a-f]{6}$/i.test(c)) {
      bgSwatch.style.background = c
      bgPicker.value = c
      applyInline('background', c)
    }
  })
  bgColorRow.append(bgWrap)

  // ── 文字間隔 ──
  const lsRow = row('文字間隔')
  const lsInput = document.createElement('input')
  lsInput.className = 'sb-pr-input'
  lsInput.type = 'number'
  lsInput.value = '0'
  lsInput.style.cssText = 'width:52px;flex:none;font-variant-numeric:tabular-nums'
  // 文字間隔は Quill 標準にはないので、選択テキストの DOM を直接操作する
  lsInput.addEventListener('change', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    const v = parseFloat(lsInput.value)
    if (Number.isNaN(v)) return
    // Quill の行ごとに letter-spacing を適用
    for (const line of quill.getLines(r.index, r.length)) {
      const node = line.domNode as HTMLElement
      node.style.letterSpacing = v === 0 ? '' : `${v}px`
    }
  })
  const lsUnit = document.createElement('span')
  lsUnit.className = 'sb-pr-unit'
  lsUnit.textContent = 'px'
  lsRow.append(lsInput, lsUnit)

  // ── 行間 ──
  const lhRow = row('行間')
  const lhInput = document.createElement('input')
  lhInput.className = 'sb-pr-input'
  lhInput.type = 'number'
  lhInput.value = '1.4'
  lhInput.step = '0.1'
  lhInput.min = '0.5'
  lhInput.style.cssText = 'width:52px;flex:none;font-variant-numeric:tabular-nums'
  lhInput.addEventListener('change', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    const v = parseFloat(lhInput.value)
    if (Number.isNaN(v) || v < 0.5) return
    for (const line of quill.getLines(r.index, r.length)) {
      const node = line.domNode as HTMLElement
      node.style.lineHeight = String(v)
    }
  })
  lhRow.append(lhInput)

  // ── 位置・サイズ ──
  const posGroup = group('位置・サイズ')
  const posGrid = document.createElement('div')
  posGrid.className = 'sb-pr-size-grid'

  const posXLabel = document.createElement('span')
  posXLabel.className = 'sb-pr-size-label'
  posXLabel.textContent = 'X'
  const posXInput = document.createElement('input')
  posXInput.className = 'sb-pr-size-input'
  posXInput.type = 'number'
  posXInput.value = '0'
  const posXUnit = document.createElement('span')
  posXUnit.className = 'sb-pr-size-unit'
  posXUnit.textContent = 'px'

  const posYLabel = document.createElement('span')
  posYLabel.className = 'sb-pr-size-label'
  posYLabel.textContent = 'Y'
  const posYInput = document.createElement('input')
  posYInput.className = 'sb-pr-size-input'
  posYInput.type = 'number'
  posYInput.value = '0'
  const posYUnit = document.createElement('span')
  posYUnit.className = 'sb-pr-size-unit'
  posYUnit.textContent = 'px'

  const posWLabel = document.createElement('span')
  posWLabel.className = 'sb-pr-size-label'
  posWLabel.textContent = 'W'
  const posWInput = document.createElement('input')
  posWInput.className = 'sb-pr-size-input'
  posWInput.type = 'number'
  posWInput.value = '0'
  const posWUnit = document.createElement('span')
  posWUnit.className = 'sb-pr-size-unit'
  posWUnit.textContent = 'px'

  const posHLabel = document.createElement('span')
  posHLabel.className = 'sb-pr-size-label'
  posHLabel.textContent = 'H'
  const posHInput = document.createElement('input')
  posHInput.className = 'sb-pr-size-input'
  posHInput.type = 'number'
  posHInput.value = '0'
  const posHUnit = document.createElement('span')
  posHUnit.className = 'sb-pr-size-unit'
  posHUnit.textContent = 'px'

  posGrid.append(
    posXLabel, posXInput, posXUnit,
    posYLabel, posYInput, posYUnit,
    posWLabel, posWInput, posWUnit,
    posHLabel, posHInput, posHUnit,
  )
  posGroup.append(posGrid)

  // ── 配置 ──
  const alignGroup = group('配置')
  const alignBtns = document.createElement('div')
  alignBtns.className = 'sb-align-btns'
  const alignButtons: HTMLButtonElement[] = []
  for (const a of ALIGN_LABELS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'sb-align-btn'
    btn.title = a.title
    btn.innerHTML = a.svg
    btn.addEventListener('click', () => {
      applyBlock('align', a.value)
    })
    alignButtons.push(btn)
    alignBtns.append(btn)
  }
  alignGroup.append(alignBtns)

  // ── 書式（ツールバーから移動したボタン群） ──
  const fmtGroup = group('書式')
  const fmtBtns = document.createElement('div')
  fmtBtns.className = 'sb-fmt-btns'

  const ulBtn = fmtBtn(SVG.underline, '下線')
  ulBtn.addEventListener('click', () => toggleInline('underline'))

  const stBtn = fmtBtn(SVG.strike, '打消し線')
  stBtn.addEventListener('click', () => toggleInline('strike'))

  const linkBtn = fmtBtn(SVG.link, 'リンク')
  linkBtn.addEventListener('click', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    const fmt = quill.getFormat(r.index, r.length)
    const existing = typeof fmt['link'] === 'string' ? fmt['link'] : ''
    const url = prompt('リンクURL', existing || 'https://')
    if (url === null) return
    if (url === '' || url === 'https://') {
      quill.formatText(r.index, r.length, 'link', false, 'user')
    } else {
      quill.formatText(r.index, r.length, 'link', url, 'user')
    }
    refresh()
  })

  const clearBtn = fmtBtn(SVG.clearFmt, '書式クリア')
  clearBtn.addEventListener('click', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    quill.removeFormat(r.index, r.length, 'user')
    refresh()
  })

  fmtBtns.append(ulBtn, stBtn, linkBtn, clearBtn)
  fmtGroup.append(fmtBtns)

  // ── 挿入 ──
  const insGroup = group('挿入')
  const insBtns = document.createElement('div')
  insBtns.className = 'sb-ins-btns'

  const imgInsBtn = document.createElement('button')
  imgInsBtn.type = 'button'
  imgInsBtn.className = 'sb-ins-btn'
  imgInsBtn.innerHTML = `${SVG.image}画像`
  imgInsBtn.addEventListener('click', () => pickAndInsertMedia(quill))

  const brInsBtn = document.createElement('button')
  brInsBtn.type = 'button'
  brInsBtn.className = 'sb-ins-btn'
  brInsBtn.innerHTML = `${SVG.lineBreak}改行`
  brInsBtn.addEventListener('click', () => {
    const r = getRange()
    if (r === null) return
    quill.insertText(r.index, '\n', 'user')
  })

  insBtns.append(imgInsBtn, brInsBtn)
  insGroup.append(insBtns)

  // ── アクション ──
  const actGroup = group('アクション')
  actGroup.style.gap = '6px'
  actGroup.style.marginTop = '2px'

  const dupBtn = document.createElement('button')
  dupBtn.type = 'button'
  dupBtn.className = 'sb-pr-action'
  dupBtn.innerHTML = `${SVG.duplicate}要素を複製`
  dupBtn.addEventListener('click', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    const delta = quill.getContents(r.index, r.length)
    quill.updateContents(
      // @ts-expect-error -- Delta 型は new Delta() を要求するが、insert の配列で代替
      { ops: [{ retain: r.index + r.length }, ...delta.ops] },
      'user',
    )
  })

  const delBtn = document.createElement('button')
  delBtn.type = 'button'
  delBtn.className = 'sb-pr-action danger'
  delBtn.innerHTML = `${SVG.trash}要素を削除`
  delBtn.addEventListener('click', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    quill.deleteText(r.index, r.length, 'user')
  })

  actGroup.append(dupBtn, delBtn)

  // ── 組み立て ──
  body.append(
    textGroup,
    fontRow, sizeRow, boldRow, italicRow,
    textColorRow, bgColorRow,
    lsRow, lhRow,
    alignGroup,
    posGroup,
    fmtGroup,
    insGroup,
    actGroup,
  )

  panel.append(header, tabs, body, emptyMsg)

  // ── 状態の同期 ──
  function refresh(): void {
    const r = getRange()
    const hasSelection = r !== null && r.length > 0

    const newBadge = '<span style="display:inline-block;font-size:8px;font-weight:700;color:#fff;background:#ff8c00;padding:1px 4px;border-radius:2px;letter-spacing:.3px;vertical-align:middle;margin-left:4px;line-height:1.3">NEW</span>'
    if (hasSelection) {
      body.style.display = 'flex'
      emptyMsg.style.display = 'none'
      title.innerHTML = `選択中：テキスト ${newBadge}`
    } else {
      body.style.display = 'none'
      emptyMsg.style.display = 'block'
      title.innerHTML = 'プロパティ'
      return
    }

    const fmt = getFormats()

    // テキスト内容
    if (r !== null) {
      textArea.value = quill.getText(r.index, r.length)
    }

    // フォント
    fontSelect.value = fontFamilyLabel(fmt['font'])

    // サイズ
    sizeInput.value = fontSizeLabel(fmt['size']).replace('px', '')

    // 太字/斜体
    setToggle(boldToggle, fmt['bold'] === true)
    setToggle(italicToggle, fmt['italic'] === true)

    // 文字色
    const tc = typeof fmt['color'] === 'string' ? fmt['color'] : '#000000'
    tcSwatch.style.background = tc
    tcHex.value = tc.toUpperCase()

    // 背景色
    const bg = typeof fmt['background'] === 'string' ? fmt['background'] : '#FFFFFF'
    bgSwatch.style.background = bg
    bgHex.value = bg.toUpperCase()

    // 配置
    const align = fmt['align']
    for (let i = 0; i < alignButtons.length; i++) {
      const expected = ALIGN_LABELS[i]?.value
      const btn = alignButtons[i]
      if (btn === undefined) continue
      const isActive =
        (expected === false && (align === undefined || align === false)) ||
        align === expected
      btn.classList.toggle('active', isActive)
    }

    // 書式ボタン
    ulBtn.classList.toggle('active', fmt['underline'] === true)
    stBtn.classList.toggle('active', fmt['strike'] === true)
    linkBtn.classList.toggle('active', fmt['link'] !== undefined && fmt['link'] !== false)

    // 位置・サイズ（選択テキストの最初の行ブロックの矩形を読み取る）
    if (r !== null) {
      const bounds = quill.getBounds(r.index, r.length)
      if (bounds !== null) {
        posXInput.value = String(Math.round(bounds.left))
        posYInput.value = String(Math.round(bounds.top))
        posWInput.value = String(Math.round(bounds.width))
        posHInput.value = String(Math.round(bounds.height))
      }
    }
  }

  quill.on('selection-change', () => refresh())
  quill.on('text-change', () => refresh())
  setTimeout(refresh, 100)

  // mousedown で Quill の選択を奪わないようにする
  panel.addEventListener('mousedown', (e) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
    e.preventDefault()
  })

  return panel
}

/* ── builders ── */

function group(titleText: string): HTMLElement {
  const g = document.createElement('div')
  g.className = 'sb-pg'
  const t = document.createElement('div')
  t.className = 'sb-pg-title'
  t.textContent = titleText
  g.append(t)
  return g
}

function row(labelText: string): HTMLElement {
  const r = document.createElement('div')
  r.className = 'sb-pr'
  const l = document.createElement('span')
  l.className = 'sb-pr-label'
  l.textContent = labelText
  r.append(l)
  return r
}

function toggle(on: boolean): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = `sb-pr-toggle${on ? ' on' : ''}`
  return btn
}

function setToggle(btn: HTMLElement, on: boolean): void {
  btn.classList.toggle('on', on)
}

function colorPicker(initial: string): {
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

function fmtBtn(svg: string, titleText: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'sb-fmt-btn'
  btn.title = titleText
  btn.innerHTML = svg
  return btn
}
