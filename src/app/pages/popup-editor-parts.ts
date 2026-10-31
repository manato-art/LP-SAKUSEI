/**
 * ポップアップの編集画面で3種類（離脱防止・表示直後・追従型）が使う同じ欄（2026-10-31 案A「3種類を同じ型に」）。
 * 同じ設定は同じ部品で作る（種類ごとに作り分けると、形・名前・置き場所がまたずれる）。並べ方は popup-editor-layout.ts の表。
 */
import { codeCopyButton } from '../panels/code-copy.ts'
import { highlight } from '../panels/syntax-highlight.ts'
import { T, el } from '../ui.ts'
import { injectPositionGridCss } from './exit-popup-styles.ts'
import { makeSuffixField, updateGutter } from './exit-popup-fields.ts'
import { CODE_TABS, labelOf, setOff, usableIn, type CodeTab, type PopupKind } from './popup-editor-layout.ts'

/** 欄の下に出す小さな説明 */
export function hint(text: string): HTMLElement {
  return el('p', { style: `font-size:11px;color:${T.sub};margin:4px 0 0;line-height:1.6`, text })
}

/** スイッチ1つの行（押すたびに onToggle へ次の状態を渡す） */
export function toggleRow(label: string, on: boolean, onToggle: (next: boolean) => void): HTMLElement {
  const row = el('div', { class: 'ep-toggle-row' })
  const toggle = el('button', { class: `ep-toggle${on ? ' on' : ''}` })
  toggle.type = 'button'
  toggle.setAttribute('aria-label', label)
  let current = on
  toggle.addEventListener('click', () => {
    current = !current
    toggle.classList.toggle('on', current)
    onToggle(current)
  })
  row.append(toggle, el('span', { class: 'ep-toggle-label', text: label }))
  return row
}

/** スイッチと、スイッチがオンのときだけ触れる欄（オフのときは薄くして触れない・隠さない） */
export function switchWith(label: string, on: boolean, sub: HTMLElement, onToggle: (next: boolean) => void): HTMLElement {
  const wrap = el('div')
  wrap.append(
    toggleRow(label, on, (next) => {
      onToggle(next)
      setOff(sub, !next)
    }),
    sub,
  )
  setOff(sub, !on)
  return wrap
}

/** 表示アニメーションの名前（本番準拠: 日本語名）。追従型は配信で動く物だけ（同じ名前・同じ順） */
export const ANIMATION_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'fade', label: 'フェード' },
  { value: 'spiral', label: '渦巻' },
  { value: 'slideUp', label: 'スライドアップ' },
  { value: 'slideDown', label: 'スライドダウン' },
  { value: 'slideLeft', label: 'スライドレフト' },
  { value: 'slideRight', label: 'スライドライト' },
  { value: 'zoomIn', label: 'ズームイン' },
  { value: 'bounceIn', label: 'バウンスイン' },
  { value: 'elastic', label: 'エラスティック' },
  { value: 'flipIn', label: 'フリップイン' },
  { value: 'none', label: 'なし' },
]

export function animationField(values: readonly string[] | null, value: string, onChange: (next: string) => void): HTMLElement {
  const field = el('div', { class: 'ep-field' })
  field.append(el('label', { text: labelOf('animation') }))
  const select = document.createElement('select')
  for (const opt of ANIMATION_OPTIONS) {
    if (values !== null && !values.includes(opt.value)) continue
    const o = document.createElement('option')
    o.value = opt.value
    o.textContent = opt.label
    if (opt.value === value) o.selected = true
    select.append(o)
  }
  select.addEventListener('change', () => onChange(select.value))
  field.append(select)
  return field
}

/** 「スクロールで表示」＋「↓まで読んだら表示」（数字＋%＋つまみ）。名前は指示40 */
export function scrollField(on: boolean, pct: number, onChange: (on: boolean, pct: number) => void): HTMLElement {
  let current = pct
  const posField = makeSuffixField('↓まで読んだら表示', pct, '%', (v) => {
    current = v
    slider.value = String(v)
    onChange(true, v)
  })
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = '0'
  slider.max = '100'
  slider.value = String(pct)
  slider.className = 'ep-range'
  slider.style.cssText = 'width:100%;margin-top:6px;accent-color:' + T.primary
  slider.addEventListener('input', () => {
    current = Number(slider.value)
    const num = posField.querySelector('input')
    if (num !== null) num.value = String(current)
    onChange(true, current)
  })
  posField.append(slider)
  return switchWith(labelOf('scroll'), on, posField, (next) => onChange(next, current))
}

/** 9か所（上/中/下 × 左/中/右）。保存は呼ぶ側（離脱防止＝position_x/y の 0/50/100・追従型＝上/下/左下/右下） */
export interface PositionCell {
  readonly x: number
  readonly y: number
  readonly icon: string
  readonly title: string
}
export const POSITION_CELLS: readonly PositionCell[] = [
  { x: 0, y: 0, icon: '↖', title: '左上' }, { x: 50, y: 0, icon: '↑', title: '上' }, { x: 100, y: 0, icon: '↗', title: '右上' },
  { x: 0, y: 50, icon: '←', title: '左' }, { x: 50, y: 50, icon: '◉', title: '中央' }, { x: 100, y: 50, icon: '→', title: '右' },
  { x: 0, y: 100, icon: '↙', title: '左下' }, { x: 50, y: 100, icon: '↓', title: '下' }, { x: 100, y: 100, icon: '↘', title: '右下' },
]

export interface PositionFieldOptions {
  /** 9か所のうち今の場所 */
  readonly grid: { readonly x: number; readonly y: number }
  /** つまんで置いた場所に出しているか（そのときは9か所を選んでいない） */
  readonly isFree: boolean
  /** 押せる所（追従型は上・下・左下・右下だけ） */
  readonly usable: (cell: PositionCell) => boolean
  /** 見本の箱を横いっぱいにする所（追従型の上下の帯） */
  readonly wide: (cell: { readonly x: number; readonly y: number }) => boolean
  readonly onPick: (cell: PositionCell) => void
  /** 押せる所の説明（全部押せるときは無し） */
  readonly note?: string
}

export function positionField(options: PositionFieldOptions): HTMLElement {
  injectPositionGridCss()
  const field = el('div', { class: 'ep-field' })
  field.append(el('label', { text: labelOf('position') }))
  // つまんで置いた場所があるときは、9か所は選んでいない（9か所を押すと置いた場所を消してそこへ・指示39）
  const freeNote = hint('いまは「つまんで置いた場所」に出します（上の「LPの上で決める」か「中身を編集」で動かせます）。下の9か所を押すと、そこに戻します。')
  freeNote.hidden = !options.isFree
  field.append(freeNote)

  const layout = el('div', { class: 'ep-pos-layout' })
  const grid = el('div', { class: 'ep-pos-grid' })
  const preview = el('div', { class: 'ep-pos-preview' })
  const bar = el('div', { class: 'ep-pos-preview-bar' })
  preview.append(bar)
  const showAt = (at: { readonly x: number; readonly y: number }): void => {
    const wide = options.wide(at)
    bar.style.width = wide ? '100%' : ''
    bar.style.left = wide ? '0' : `${at.x}%`
    bar.style.top = `${at.y}%`
    bar.style.transform = `translate(-${wide ? 0 : at.x}%, -${at.y}%)`
  }

  const cells: HTMLElement[] = []
  for (const cell of POSITION_CELLS) {
    const btn = el('button', { class: 'ep-pos-cell', text: cell.icon })
    btn.type = 'button'
    btn.title = cell.title
    if (!options.usable(cell)) {
      btn.setAttribute('disabled', '')
    } else {
      if (!options.isFree && cell.x === options.grid.x && cell.y === options.grid.y) btn.classList.add('active')
      btn.addEventListener('click', () => {
        options.onPick(cell)
        freeNote.hidden = true
        for (const b of cells) b.classList.remove('active')
        btn.classList.add('active')
        showAt(cell)
      })
    }
    cells.push(btn)
    grid.append(btn)
  }
  layout.append(grid, preview)
  field.append(layout)
  if (options.note !== undefined) field.append(hint(options.note))
  showAt(options.grid)
  return field
}

/** 出し分け（スマホ・タブレット・PC） */
export function deviceField(draft: { device_sp: boolean; device_tablet: boolean; device_pc: boolean }): HTMLElement {
  const field = el('div', { class: 'ep-field' })
  field.append(el('label', { text: labelOf('device') }))
  const devices: { key: 'device_sp' | 'device_tablet' | 'device_pc'; label: string }[] = [
    { key: 'device_sp', label: 'スマートフォン (SP)' },
    { key: 'device_tablet', label: 'タブレット' },
    { key: 'device_pc', label: 'PC' },
  ]
  for (const device of devices) {
    const row = el('div', { class: 'ep-device-row' })
    const toggle = el('button', { class: `ep-toggle${draft[device.key] ? ' on' : ''}` })
    toggle.type = 'button'
    toggle.setAttribute('aria-label', device.label)
    toggle.addEventListener('click', () => {
      draft[device.key] = !draft[device.key]
      toggle.classList.toggle('on', draft[device.key])
    })
    row.append(el('div', { class: 'ep-device-name', text: device.label }), toggle)
    field.append(row)
  }
  return field
}

export type CodeSources = Partial<Record<CodeTab, { readonly get: () => string; readonly set: (value: string) => void }>>

/**
 * コード（JavaScript・CSS・HeadTag・BodyTag）。並びは3種類とも同じで、その種類で使えない物は薄く出す
 * （押すと、どの種類で使えるかを書く）。どの欄にも「まとめてコピー」を付ける。
 */
export function codeField(kind: PopupKind, sources: CodeSources): HTMLElement {
  const field = el('div', { class: 'ep-field' })
  field.append(el('label', { text: labelOf('code') }))
  const tabBar = el('div', { class: 'ep-html-tabs' })
  const editorArea = el('div')
  const usable = CODE_TABS.filter((tab) => tab.kinds.includes(kind))
  let active: CodeTab = usable[0]?.id ?? 'javascript'

  const renderSub = (): void => {
    editorArea.innerHTML = ''
    const tab = CODE_TABS.find((t) => t.id === active)
    const source = sources[active]
    if (tab === undefined || source === undefined || !tab.kinds.includes(kind)) {
      editorArea.append(hint(`${tab?.label ?? ''} は${usableIn(tab?.kinds ?? [])}`))
      return
    }
    const lang = active === 'javascript' ? 'javascript' : active === 'css' ? 'css' : 'html'
    const wrap = el('div', { class: 'ep-html-code-wrap' })
    const inner = el('div', { class: 'ep-html-code-inner' })
    const gutter = el('div', { class: 'ep-html-gutter' })
    const content = source.get()
    updateGutter(gutter, content)
    // overlay パターン: pre(ハイライト) + textarea(入力)
    const editorBox = el('div', { class: 'ep-html-editor-box' })
    const pre = document.createElement('pre')
    pre.className = 'ep-html-highlight'
    pre.innerHTML = highlight(content, lang)
    const textarea = document.createElement('textarea')
    textarea.className = 'ep-html-textarea'
    textarea.spellcheck = false
    textarea.value = content
    // コード全体をまとめてコピー（本人指示）。小さなタブの右端に置く
    const copyBar = el('div', { class: 'ep-html-copy' })
    copyBar.append(codeCopyButton(textarea))
    const sync = (): void => {
      source.set(textarea.value)
      pre.innerHTML = highlight(textarea.value, lang)
      updateGutter(gutter, textarea.value)
    }
    textarea.addEventListener('input', sync)
    textarea.addEventListener('scroll', () => {
      pre.style.transform = `translate(-${textarea.scrollLeft}px,-${textarea.scrollTop}px)`
      gutter.scrollTop = textarea.scrollTop
    })
    // Tab キーでインデント
    textarea.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Tab') return
      ev.preventDefault()
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end)
      textarea.selectionStart = textarea.selectionEnd = start + 2
      sync()
    })
    editorBox.append(pre, textarea)
    inner.append(gutter, editorBox)
    wrap.append(inner)
    editorArea.append(copyBar, wrap)
  }

  for (const tab of CODE_TABS) {
    const off = !tab.kinds.includes(kind)
    const btn = el('button', { class: `ep-html-tab${tab.id === active ? ' active' : ''}${off ? ' off' : ''}`, text: tab.label })
    btn.type = 'button'
    btn.addEventListener('click', () => {
      active = tab.id
      for (const b of tabBar.querySelectorAll('.ep-html-tab')) b.classList.remove('active')
      btn.classList.add('active')
      renderSub()
    })
    tabBar.append(btn)
  }
  field.append(tabBar, editorArea)
  renderSub()
  return field
}
