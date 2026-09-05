/**
 * コンテンツエリア上部の水平ツールバー（指示77）。
 *
 * サイドバーにあったテキスト書式ツールをコンテンツ上部に横一列で配置する。
 * 実物のスクショ2枚目に合わせた配置:
 *   [← →] [sans-serif ∨] [− 17 +] | [B] [U] [S̶] [≡∨] [I] [🎨] [🖼] [↵] [✏∨] [🔗] [Tx]
 */
import type Quill from 'quill'
import {
  TOOLBAR_FONT_SIZES,
  TOOLBAR_FONT_FAMILIES,
  cssFontFamilyValue,
  fontFamilyLabel,
  fontSizeLabel,
  allowPxSizeAndFreeFont,
} from './toolbar/text-format.ts'
import { pickAndInsertMedia } from './media-insert.ts'

// ── SVG アイコン（16px）──

const SVG = {
  undo: '<svg viewBox="0 0 20 20" width="18" height="18"><path d="M6 9l-4-3.5L6 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 5.5h10a5 5 0 010 10H9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  redo: '<svg viewBox="0 0 20 20" width="18" height="18"><path d="M14 9l4-3.5L14 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5.5H8a5 5 0 000 10h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  bold: '<svg viewBox="0 0 18 18" width="14" height="14"><path d="M5 3h5a3 3 0 010 6H5zm0 6h6a3 3 0 010 6H5z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  underline: '<svg viewBox="0 0 18 18" width="14" height="14"><path d="M5 2v7a4 4 0 008 0V2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="4" y1="16" x2="14" y2="16" stroke="currentColor" stroke-width="1.5"/></svg>',
  strike: '<svg viewBox="0 0 18 18" width="14" height="14"><line x1="3" y1="9" x2="15" y2="9" stroke="currentColor" stroke-width="1.5"/><path d="M6 3h6a2 2 0 010 4H6m0 4h7a2 2 0 000-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  italic: '<svg viewBox="0 0 18 18" width="14" height="14"><line x1="11" y1="3" x2="7" y2="15" stroke="currentColor" stroke-width="2"/></svg>',
  alignLeft: '<svg viewBox="0 0 18 18" width="14" height="14"><line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="2"/><line x1="2" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="2"/><line x1="2" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="2"/></svg>',
  color: '<svg viewBox="0 0 18 18" width="14" height="14"><path d="M3 15h12M5 11L9 3l4 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="6" y1="9" x2="12" y2="9" stroke="currentColor" stroke-width="1.5"/></svg>',
  image: '<svg viewBox="0 0 18 18" width="14" height="14"><rect x="2" y="3" width="14" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="7" r="1.5" fill="currentColor"/><path d="M2 13l4-4 3 3 2-2 5 5H3z" fill="currentColor" opacity=".3"/></svg>',
  link: '<svg viewBox="0 0 18 18" width="14" height="14"><path d="M7.5 10.5l3-3m-1.5-1.5a2.12 2.12 0 013 3l-4.5 4.5a2.12 2.12 0 01-3-3l4.5-4.5z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  lineBreak: '<svg viewBox="0 0 18 18" width="14" height="14"><path d="M14 4v6a2 2 0 01-2 2H5m0 0l3-3m-3 3l3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bgColor: '<svg viewBox="0 0 18 18" width="14" height="14"><path d="M3 14h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M11 2L5 10h5l-1 5 6-8h-5z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  clearFmt: '<svg viewBox="0 0 18 18" width="14" height="14"><text x="1" y="13" font-size="13" font-weight="bold" fill="currentColor">T</text><text x="11" y="8" font-size="9" fill="currentColor">x</text></svg>',
} as const

// ── CSS ──

function injectStyles(): void {
  if (document.getElementById('sb-content-toolbar-css') !== null) return
  const s = document.createElement('style')
  s.id = 'sb-content-toolbar-css'
  s.textContent = `
    .sb-ct { display:flex; align-items:center; gap:2px; padding:6px 8px;
      background:#fff; border-bottom:1px solid #e5e5ea; flex-shrink:0;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
      font-size:13px; user-select:none; flex-wrap:nowrap; min-height:40px;
      overflow:hidden; max-width:100%; box-sizing:border-box; }
    .sb-ct-btn { display:inline-flex; align-items:center; justify-content:center;
      width:30px; height:30px; border:none; border-radius:6px; background:transparent;
      color:#333; cursor:pointer; padding:0; flex-shrink:0; transition:background .12s; }
    .sb-ct-btn:hover { background:#f0f0f5; }
    .sb-ct-btn.active { background:#e3f2fd; color:#1976d2; }
    .sb-ct-btn:disabled { opacity:.3; cursor:default; }
    .sb-ct-sep { width:1px; height:20px; background:#ddd; margin:0 4px; flex-shrink:0; }
    .sb-ct-select { height:30px; border:1px solid #ddd; border-radius:6px;
      font-size:12px; padding:0 6px; background:#fff; cursor:pointer; outline:none;
      max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .sb-ct-select:focus { border-color:#90caf9; }
    .sb-ct-size { display:inline-flex; align-items:center; gap:0; }
    .sb-ct-size-btn { width:26px; height:30px; border:1px solid #ddd; background:#fff;
      cursor:pointer; font-size:15px; color:#333; display:flex; align-items:center;
      justify-content:center; padding:0; transition:background .12s; }
    .sb-ct-size-btn:first-child { border-radius:6px 0 0 6px; }
    .sb-ct-size-btn:last-child { border-radius:0 6px 6px 0; }
    .sb-ct-size-btn:hover { background:#f5f5f5; }
    .sb-ct-size-val { height:30px; min-width:36px; border-top:1px solid #ddd;
      border-bottom:1px solid #ddd; font-size:13px; color:#333; display:flex;
      align-items:center; justify-content:center; padding:0 4px; background:#fff; }
    .sb-ct-color-wrap { position:relative; }
    .sb-ct-color-input { position:absolute; opacity:0; width:0; height:0; pointer-events:none; }
    .sb-ct-color-bar { position:absolute; bottom:3px; left:50%; transform:translateX(-50%);
      width:16px; height:3px; border-radius:1px; }
    /* リンクポップオーバー */
    .sb-ct-link-pop { position:absolute; top:100%; left:50%; transform:translateX(-50%);
      z-index:300; background:#fff; border:1px solid #ddd; border-radius:8px;
      box-shadow:0 4px 16px rgba(0,0,0,.12); padding:12px; width:320px;
      display:flex; flex-direction:column; gap:8px; margin-top:4px; }
    .sb-ct-link-pop::before { content:''; position:absolute; top:-6px; left:50%;
      transform:translateX(-50%) rotate(45deg); width:10px; height:10px;
      background:#fff; border-top:1px solid #ddd; border-left:1px solid #ddd; }
    .sb-ct-link-label { font:600 12px/1.4 -apple-system,sans-serif; color:#333; }
    .sb-ct-link-input { width:100%; height:34px; border:1px solid #ddd; border-radius:6px;
      padding:0 10px; font-size:13px; outline:none; box-sizing:border-box; }
    .sb-ct-link-input:focus { border-color:#0091ff; box-shadow:0 0 0 2px rgba(0,145,255,.15); }
    .sb-ct-link-row { display:flex; align-items:center; gap:8px; }
    .sb-ct-link-row label { font:400 12px/1.4 -apple-system,sans-serif; color:#555;
      display:flex; align-items:center; gap:4px; cursor:pointer; }
    .sb-ct-link-btns { display:flex; gap:8px; justify-content:flex-end; margin-top:4px; }
    .sb-ct-link-cancel { height:32px; padding:0 16px; border:1px solid #ddd; border-radius:6px;
      background:#fff; font-size:13px; color:#333; cursor:pointer; }
    .sb-ct-link-cancel:hover { background:#f5f5f5; }
    .sb-ct-link-submit { height:32px; padding:0 16px; border:none; border-radius:6px;
      background:#0091ff; font-size:13px; color:#fff; cursor:pointer; font-weight:600; }
    .sb-ct-link-submit:hover { background:#007ae6; }
    .sb-ct-link-submit:disabled { background:#ccc; cursor:default; }
    .sb-ct-link-remove { height:32px; padding:0 12px; border:1px solid #e53935; border-radius:6px;
      background:#fff; font-size:12px; color:#e53935; cursor:pointer; }
    .sb-ct-link-remove:hover { background:#ffebee; }
    .sb-ct-link-target { display:flex; gap:12px; margin-top:2px; }
    .sb-ct-link-target label { font:400 12px/1.4 -apple-system,sans-serif; color:#555;
      display:flex; align-items:center; gap:4px; cursor:pointer; }
  `
  document.head.append(s)
}

const ALIGN_VALUES: readonly (string | false)[] = [false, 'center', 'right', 'justify']

export function mountContentToolbar(quill: Quill): HTMLElement {
  injectStyles()
  allowPxSizeAndFreeFont(quill)

  const bar = document.createElement('div')
  bar.className = 'sb-ct'
  bar.setAttribute('data-content-toolbar', 'true')

  // mousedown で Quill の選択を奪わない
  bar.addEventListener('mousedown', (e) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'SELECT') return
    e.preventDefault()
  })

  // ── ヘルパー ──
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

  // ── 1. Undo / Redo ──
  const undoBtn = makeBtn(SVG.undo, 'undo', '元に戻す')
  undoBtn.addEventListener('click', () => quill.history.undo())
  const redoBtn = makeBtn(SVG.redo, 'redo', 'やり直す')
  redoBtn.addEventListener('click', () => quill.history.redo())
  bar.append(undoBtn, redoBtn, sep())

  // ── 2. Font family ──
  const fontSelect = document.createElement('select')
  fontSelect.className = 'sb-ct-select'
  for (const f of TOOLBAR_FONT_FAMILIES) {
    const o = document.createElement('option')
    o.value = f
    o.textContent = f
    fontSelect.append(o)
  }
  fontSelect.addEventListener('change', () => {
    applyInline('font', cssFontFamilyValue(fontSelect.value))
  })
  bar.append(fontSelect, sep())

  // ── 3. Font size (− N +) ──
  const sizeWrap = document.createElement('span')
  sizeWrap.className = 'sb-ct-size'
  const sizeMinus = document.createElement('button')
  sizeMinus.className = 'sb-ct-size-btn'
  sizeMinus.textContent = '−'
  const sizeVal = document.createElement('span')
  sizeVal.className = 'sb-ct-size-val'
  sizeVal.textContent = '17'
  const sizePlus = document.createElement('button')
  sizePlus.className = 'sb-ct-size-btn'
  sizePlus.textContent = '+'
  sizeWrap.append(sizeMinus, sizeVal, sizePlus)

  const sizeStep = (dir: 1 | -1): void => {
    const cur = fontSizeLabel(getFormats()['size'])
    const idx = TOOLBAR_FONT_SIZES.indexOf(cur)
    const next = idx + dir
    if (next >= 0 && next < TOOLBAR_FONT_SIZES.length) {
      applyInline('size', TOOLBAR_FONT_SIZES[next] ?? cur)
    }
  }
  sizeMinus.addEventListener('click', () => sizeStep(-1))
  sizePlus.addEventListener('click', () => sizeStep(1))
  bar.append(sizeWrap, sep())

  // ── 4. Bold / Underline / Strikethrough ──
  const boldBtn = makeBtn(SVG.bold, 'bold', '太字')
  boldBtn.addEventListener('click', () => toggleInline('bold'))
  const ulBtn = makeBtn(SVG.underline, 'underline', '下線')
  ulBtn.addEventListener('click', () => toggleInline('underline'))
  const stBtn = makeBtn(SVG.strike, 'strike', '打消し')
  stBtn.addEventListener('click', () => toggleInline('strike'))
  bar.append(boldBtn, ulBtn, stBtn)

  // ── 5. Alignment (cycle) ──
  let alignIdx = 0
  const alignBtn = makeBtn(SVG.alignLeft, 'align', '整列')
  alignBtn.style.position = 'relative'
  // ドロップダウン矢印
  const alignArrow = document.createElement('span')
  alignArrow.textContent = '▾'
  alignArrow.style.cssText = 'font-size:8px;margin-left:-2px;color:#999'
  alignBtn.append(alignArrow)
  alignBtn.style.width = '34px'
  alignBtn.addEventListener('click', () => {
    alignIdx = (alignIdx + 1) % ALIGN_VALUES.length
    applyBlock('align', ALIGN_VALUES[alignIdx] ?? false)
  })
  bar.append(alignBtn, sep())

  // ── 6. Italic ──
  const italicBtn = makeBtn(SVG.italic, 'italic', '斜体')
  italicBtn.addEventListener('click', () => toggleInline('italic'))
  bar.append(italicBtn)

  // ── 7. Text color ──
  const textColorWrap = document.createElement('span')
  textColorWrap.className = 'sb-ct-color-wrap'
  const textColorBtn = makeBtn(SVG.color, 'textColor', 'テキストカラー')
  const textColorBar = document.createElement('span')
  textColorBar.className = 'sb-ct-color-bar'
  textColorBar.style.background = '#000'
  textColorBtn.append(textColorBar)
  const textColorPicker = document.createElement('input')
  textColorPicker.type = 'color'
  textColorPicker.value = '#000000'
  textColorPicker.className = 'sb-ct-color-input'
  textColorBtn.addEventListener('click', () => textColorPicker.click())
  textColorPicker.addEventListener('input', () => {
    const c = textColorPicker.value
    textColorBar.style.background = c
    applyInline('color', c)
  })
  textColorWrap.append(textColorBtn, textColorPicker)
  bar.append(textColorWrap)

  // ── 8. Background color ──
  const bgColorWrap = document.createElement('span')
  bgColorWrap.className = 'sb-ct-color-wrap'
  const bgColorBtn = makeBtn(SVG.bgColor, 'bgColor', '背景色')
  const bgColorBar = document.createElement('span')
  bgColorBar.className = 'sb-ct-color-bar'
  bgColorBar.style.background = '#fff'
  bgColorBtn.append(bgColorBar)
  const bgColorPicker = document.createElement('input')
  bgColorPicker.type = 'color'
  bgColorPicker.value = '#ffffff'
  bgColorPicker.className = 'sb-ct-color-input'
  bgColorBtn.addEventListener('click', () => bgColorPicker.click())
  bgColorPicker.addEventListener('input', () => {
    const c = bgColorPicker.value
    bgColorBar.style.background = c
    applyInline('background', c)
  })
  bgColorWrap.append(bgColorBtn, bgColorPicker)
  bar.append(bgColorWrap)

  // ── 9. Image ──
  const imgBtn = makeBtn(SVG.image, 'image', '画像')
  imgBtn.addEventListener('click', () => pickAndInsertMedia(quill))
  bar.append(imgBtn)

  // ── 10. Line break ──
  const brBtn = makeBtn(SVG.lineBreak, 'lineBreak', '改行')
  brBtn.addEventListener('click', () => {
    const r = getRange()
    if (r === null) return
    quill.insertText(r.index, '\n', 'user')
  })
  bar.append(brBtn)

  // ── 11. Link（インラインポップオーバー） ──
  const linkWrap = document.createElement('div')
  linkWrap.style.cssText = 'position:relative;display:inline-flex'
  const linkBtn = makeBtn(SVG.link, 'link', 'リンク')

  /** 既存のポップオーバーを閉じる */
  const closeLinkPop = (): void => {
    linkWrap.querySelector('.sb-ct-link-pop')?.remove()
  }

  /** ポップオーバーを開く */
  const openLinkPop = (savedRange: { index: number; length: number }, existingUrl: string): void => {
    closeLinkPop()
    const pop = document.createElement('div')
    pop.className = 'sb-ct-link-pop'
    pop.addEventListener('mousedown', (e) => e.stopPropagation()) // Quill の選択解除を防ぐ

    // URL 入力
    const label = document.createElement('div')
    label.className = 'sb-ct-link-label'
    label.textContent = 'リンクURL'
    const input = document.createElement('input')
    input.className = 'sb-ct-link-input'
    input.type = 'url'
    input.placeholder = 'https://...'
    input.value = existingUrl || 'https://'

    // ページ遷移設定
    const targetDiv = document.createElement('div')
    targetDiv.className = 'sb-ct-link-target'
    const mkRadio = (val: string, text: string, checked: boolean): HTMLLabelElement => {
      const lb = document.createElement('label')
      const rb = document.createElement('input')
      rb.type = 'radio'
      rb.name = 'sb-link-target'
      rb.value = val
      rb.checked = checked
      lb.append(rb, ` ${text}`)
      return lb
    }
    targetDiv.append(
      mkRadio('_self', '現在のウィンドウ（推奨）', true),
      mkRadio('_blank', '新しいタブ', false),
    )

    // ボタン行
    const btns = document.createElement('div')
    btns.className = 'sb-ct-link-btns'
    const cancelB = document.createElement('button')
    cancelB.className = 'sb-ct-link-cancel'
    cancelB.textContent = 'キャンセル'
    cancelB.addEventListener('click', closeLinkPop)
    const submitB = document.createElement('button')
    submitB.className = 'sb-ct-link-submit'
    submitB.textContent = existingUrl ? '更新' : 'リンクを追加'
    submitB.addEventListener('click', () => {
      const urlVal = input.value.trim()
      if (urlVal === '' || urlVal === 'https://') return
      quill.formatText(savedRange.index, savedRange.length, 'link', urlVal, 'user')
      // target 設定
      const target = (targetDiv.querySelector<HTMLInputElement>('input[name="sb-link-target"]:checked'))?.value
      if (target === '_blank') {
        for (const line of quill.getLines(savedRange.index, savedRange.length)) {
          const node = line.domNode as HTMLElement
          for (const a of node.querySelectorAll<HTMLAnchorElement>(`a[href="${urlVal}"]`)) {
            a.setAttribute('target', '_blank')
          }
        }
      }
      closeLinkPop()
      refresh()
    })
    btns.append(cancelB, submitB)

    // リンク削除（既存リンクがある場合のみ）
    if (existingUrl) {
      const removeB = document.createElement('button')
      removeB.className = 'sb-ct-link-remove'
      removeB.textContent = 'リンクを削除'
      removeB.addEventListener('click', () => {
        quill.formatText(savedRange.index, savedRange.length, 'link', false, 'user')
        closeLinkPop()
        refresh()
      })
      btns.prepend(removeB)
    }

    pop.append(label, input, targetDiv, btns)
    linkWrap.append(pop)

    // 開いたら即フォーカス + 全選択
    requestAnimationFrame(() => {
      input.focus()
      input.select()
    })

    // Enter で確定
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submitB.click() }
      if (e.key === 'Escape') { e.preventDefault(); closeLinkPop() }
    })
  }

  linkBtn.addEventListener('click', () => {
    // ポップオーバーが既に開いていたら閉じる
    if (linkWrap.querySelector('.sb-ct-link-pop') !== null) { closeLinkPop(); return }
    const r = getRange()
    if (r === null || r.length === 0) return
    const fmt = quill.getFormat(r.index, r.length)
    const existing = typeof fmt['link'] === 'string' ? fmt['link'] : ''
    openLinkPop({ index: r.index, length: r.length }, existing)
  })

  // 外部クリックで閉じる
  document.addEventListener('mousedown', (e) => {
    const pop = linkWrap.querySelector('.sb-ct-link-pop')
    if (pop !== null && !pop.contains(e.target as Node) && !linkBtn.contains(e.target as Node)) {
      closeLinkPop()
    }
  })

  linkWrap.append(linkBtn)
  bar.append(linkWrap)

  // ── 12. Clear format ──
  const clearBtn = makeBtn(SVG.clearFmt, 'clear', '書式をクリア')
  clearBtn.addEventListener('click', () => {
    const r = getRange()
    if (r === null || r.length === 0) return
    quill.removeFormat(r.index, r.length, 'user')
    refresh()
  })
  bar.append(clearBtn)

  // ── 状態の同期 ──
  const tracked = { boldBtn, ulBtn, stBtn, italicBtn, linkBtn, fontSelect, sizeVal, textColorBar, bgColorBar }
  function refresh(): void {
    const fmt = getFormats()
    tracked.boldBtn.classList.toggle('active', fmt['bold'] === true)
    tracked.ulBtn.classList.toggle('active', fmt['underline'] === true)
    tracked.stBtn.classList.toggle('active', fmt['strike'] === true)
    tracked.italicBtn.classList.toggle('active', fmt['italic'] === true)
    tracked.linkBtn.classList.toggle('active', fmt['link'] !== undefined && fmt['link'] !== false)
    tracked.fontSelect.value = fontFamilyLabel(fmt['font'])
    tracked.sizeVal.textContent = fontSizeLabel(fmt['size']).replace('px', '')
    const tc = typeof fmt['color'] === 'string' ? fmt['color'] : '#000000'
    tracked.textColorBar.style.background = tc
    const bg = typeof fmt['background'] === 'string' ? fmt['background'] : '#ffffff'
    tracked.bgColorBar.style.background = bg
  }
  quill.on('selection-change', () => refresh())
  quill.on('text-change', () => refresh())
  setTimeout(refresh, 50)

  return bar
}

function makeBtn(svg: string, _key: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'sb-ct-btn'
  btn.title = title
  btn.innerHTML = svg
  return btn
}

function sep(): HTMLSpanElement {
  const s = document.createElement('span')
  s.className = 'sb-ct-sep'
  return s
}
