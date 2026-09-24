/**
 * 離脱防止・表示直後ポップアップの編集画面のタブ（exit-popup-editor.ts から分離・2026-09-24）。
 *
 * 5つのタブ（基本 / 表示 / 位置 / 出し分け / コード）。どのタブも下書き（draft）を書き換えるだけで、
 * 保存は編集画面の「下書き反映」「本番反映」が受け持つ。中身（見た目）は「中身を編集」＝Widget編集と同じ画面。
 */
import { codeCopyButton } from '../panels/code-copy.ts'
import type { ExitPopup } from '../api-popups.ts'
import { T, el } from '../ui.ts'
import { withTrackingParam, isTrackingLink } from '../../shared/link-html.ts'
import { highlight } from '../panels/syntax-highlight.ts'
import { injectPositionGridCss } from './exit-popup-styles.ts'
import { makeCheckboxRow, makeSuffixField, makeTextField, updateGutter } from './exit-popup-fields.ts'

export type EditorTab = 'basic' | 'display' | 'position' | 'device' | 'code'
export const EDITOR_TABS: readonly { id: EditorTab; label: string }[] = [
  { id: 'basic', label: '基本' },
  { id: 'display', label: '表示' },
  { id: 'position', label: '位置' },
  { id: 'device', label: '出し分け' },
  // 中身の HTML は「中身を編集」で直す。ここは動き（JavaScript）と head・body に足すタグだけ
  { id: 'code', label: 'コード' },
]

export function renderEditorTab(body: HTMLElement, draft: ExitPopup, tab: EditorTab): void {
  body.innerHTML = ''
  switch (tab) {
    case 'basic': renderBasicTab(body, draft); break
    case 'display': renderDisplayTab(body, draft); break
    case 'position': renderPositionTab(body, draft); break
    case 'device': renderDeviceTab(body, draft); break
    case 'code': renderCodeTab(body, draft); break
  }
}
function renderBasicTab(body: HTMLElement, draft: ExitPopup): void {
  // セクション見出し（実SB準拠: 「基本設定」）
  body.append(el('div', { class: 'ep-section-title', text: '基本設定' }))
  // 訪問回数
  const visitField = el('div', { class: 'ep-field' })
  visitField.append(el('label', { text: '訪問回数' }))
  const visitSelect = document.createElement('select')
  for (const opt of [
    { value: 'all', label: '全て' },
    { value: 'first', label: '初回のみ' },
    { value: '2+', label: '2回目以降' },
    { value: '3+', label: '3回目以降' },
  ]) {
    const o = document.createElement('option')
    o.value = opt.value
    o.textContent = opt.label
    if (opt.value === draft.visit_count) o.selected = true
    visitSelect.append(o)
  }
  visitSelect.addEventListener('change', () => { draft.visit_count = visitSelect.value })
  visitField.append(visitSelect)
  body.append(visitField)

  // 電話番号
  const phoneField = makeTextField('電話番号', draft.phone_number, (v) => { draft.phone_number = v }, '電話番号を入力')
  phoneField.append(hint('「ポップアップを触ったときの動作」を「電話をかける」にすると、ポップアップを押した人がこの番号に電話をかけます（数字と + だけを使います）'))
  body.append(phoneField)
  // リンク（クリック時の遷移先）＋計測 — キャンバス画像のリンク設定と同じ作り
  body.append(makePopupLinkField(draft))
  // 計測URL（クリックでビーコン発火・複数可）— 画像の「計測URL」と同じ
  body.append(makePopupTrackingField(draft))
}
/**
 * ポップアップの「リンク」設定（キャンバス画像の image-link.ts と同じ規約）:
 *   - 遷移先URL
 *   - 新しいタブで開く（link_target）
 *   - このシステムで計測する（遷移先に sb_tracking=true を付与 → 配信の計測が拾う）
 * ポップアップを触ると、この遷移先へ移動する（delivery.ts の buildPopupSnippet が配線）。
 */
function makePopupLinkField(draft: ExitPopup): HTMLElement {
  const field = el('div', { class: 'ep-field' })
  field.append(el('label', { text: 'ポップアップを触ったときの動作' }))

  // 指示172: 動作の選択 — 遷移先URLへ移動 / LPに戻る（閉じて元の位置へ・×と同じ）/ 電話をかける
  const actionRow = el('div', { style: 'display:flex;align-items:center;gap:16px;margin:2px 0 10px' })
  const rLink = document.createElement('input')
  rLink.type = 'radio'; rLink.name = `ep-action-${draft.uid}`; rLink.value = 'link'
  const rClose = document.createElement('input')
  rClose.type = 'radio'; rClose.name = `ep-action-${draft.uid}`; rClose.value = 'close'
  // 電話をかける（基本設定の電話番号へ・2026-09-24）
  const rTel = document.createElement('input')
  rTel.type = 'radio'; rTel.name = `ep-action-${draft.uid}`; rTel.value = 'tel'
  if (draft.link_action === 'close') rClose.checked = true
  else if (draft.link_action === 'tel') rTel.checked = true
  else rLink.checked = true
  // 指示: ラベルは折り返さず横一列に（white-space:nowrap + flex-shrink:0）
  const lLink = el('label', { style: 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;white-space:nowrap;flex-shrink:0' })
  lLink.append(rLink, el('span', { text: '遷移先URLへ移動' }))
  const lClose = el('label', { style: 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;white-space:nowrap;flex-shrink:0' })
  lClose.append(rClose, el('span', { text: 'LPに戻る（閉じて元の位置へ）' }))
  const lTel = el('label', { style: 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;white-space:nowrap;flex-shrink:0' })
  lTel.append(rTel, el('span', { text: '電話をかける' }))
  actionRow.style.flexWrap = 'wrap'
  actionRow.append(lLink, lClose, lTel)
  field.append(actionRow)

  // 遷移先URL入力群（動作が「遷移先URLへ移動」のときだけ出す）
  const urlWrap = el('div', {})
  const rawUrl = draft.link_url
  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'https://example.com'
  // 入力欄には計測フラグ(sb_tracking)を外したきれいなURLを見せる。計測ON/OFFはチェックボックスで表す。
  input.value = rawUrl === '' ? '' : withTrackingParam(rawUrl, false)
  urlWrap.append(input)

  const opts = el('div', { style: 'display:flex;flex-direction:column;gap:6px;margin-top:8px' })
  const [newTabWrap, newTabCb] = makeCheckboxRow('新しいタブで開く', draft.link_target !== '_self')
  const [trackWrap, trackCb] = makeCheckboxRow(
    'このシステムで計測する（クリックをレポートに計上）',
    rawUrl !== '' && isTrackingLink(rawUrl, null),
  )
  opts.append(newTabWrap, trackWrap)
  urlWrap.append(opts)
  field.append(urlWrap)

  const sync = (): void => {
    const url = input.value.trim()
    draft.link_url = url === '' ? '' : withTrackingParam(url, trackCb.checked)
    draft.link_target = newTabCb.checked ? '_blank' : '_self'
  }
  const telNote = hint('押すと、「電話番号」に入れた番号に電話をかけます。計測URLは電話をかける前に送ります')
  field.append(telNote)
  // 遷移先URL群は「遷移先URLへ移動」のときだけ出す（link_url は保持して切替時に復元可）
  const showFor = (action: 'link' | 'close' | 'tel'): void => {
    urlWrap.hidden = action !== 'link'
    telNote.hidden = action !== 'tel'
  }
  const applyAction = (): void => {
    const action = rClose.checked ? 'close' : rTel.checked ? 'tel' : 'link'
    draft.link_action = action
    showFor(action)
  }
  input.addEventListener('input', sync)
  newTabCb.addEventListener('change', sync)
  trackCb.addEventListener('change', sync)
  rLink.addEventListener('change', applyAction)
  rClose.addEventListener('change', applyAction)
  rTel.addEventListener('change', applyAction)
  // 開いただけでは下書きを書き換えない（未設定の古いデータを「保存していない変更」にしない）
  showFor(draft.link_action ?? 'link')

  return field
}
/** 計測用URL（複数）。クリック時にビーコンを飛ばす。画像の data-tracking-urls と同じ。 */
function makePopupTrackingField(draft: ExitPopup): HTMLElement {
  const field = el('div', { class: 'ep-field' })
  field.append(el('label', { text: '計測URL（クリック時にリクエストを送信・複数可）' }))

  // draft の配列を直接破壊しない（popup とシャローコピーで共有しているため）。編集用に複製する。
  const urls: string[] = [...(draft.tracking_urls ?? [])]
  const commit = (): void => { draft.tracking_urls = urls.filter((u) => u.trim() !== '') }

  const list = el('div', { style: 'display:flex;flex-direction:column;gap:6px' })
  const rebuild = (): void => {
    list.innerHTML = ''
    if (urls.length === 0) urls.push('')
    urls.forEach((u, i) => {
      const row = el('div', { style: 'display:flex;align-items:center;gap:6px' })
      const inp = document.createElement('input')
      inp.type = 'text'
      inp.placeholder = 'https://tracking.example.com/pixel'
      inp.value = u
      inp.style.flex = '1'
      inp.addEventListener('input', () => { urls[i] = inp.value; commit() })
      const rm = el('button', {
        text: '✕',
        style: `flex-shrink:0;width:28px;height:28px;border:none;background:none;color:#E5573F;cursor:pointer;border-radius:4px;font-size:14px`,
      })
      rm.type = 'button'
      rm.addEventListener('click', () => { urls.splice(i, 1); commit(); rebuild() })
      row.append(inp, rm)
      list.append(row)
    })
  }
  rebuild()

  const addBtn = el('button', {
    text: '＋ URLを追加',
    style: `align-self:flex-start;margin-top:6px;padding:4px 0;border:none;background:none;color:${T.primary};cursor:pointer;font-size:12px;font-family:${T.font}`,
  })
  addBtn.type = 'button'
  addBtn.addEventListener('click', () => { urls.push(''); rebuild() })

  field.append(list, addBtn)
  return field
}
/** 表示アニメーションの選択肢（本番準拠: 日本語名） */
const ANIMATION_OPTIONS: { value: string; label: string }[] = [
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
function renderDisplayTab(body: HTMLElement, draft: ExitPopup): void {
  // セクションヘッダ
  body.append(el('div', { style: 'font-size:14px;font-weight:600;margin-bottom:16px', text: '表示設定' }))

  // 表示アニメーション
  const animField = el('div', { class: 'ep-field' })
  animField.append(el('label', { text: '表示アニメーション' }))
  const animSelect = document.createElement('select')
  for (const opt of ANIMATION_OPTIONS) {
    const o = document.createElement('option')
    o.value = opt.value
    o.textContent = opt.label
    if (opt.value === draft.animation) o.selected = true
    animSelect.append(o)
  }
  animSelect.addEventListener('change', () => { draft.animation = animSelect.value })
  animField.append(animSelect)
  body.append(animField)

  // 秒数（配信での意味を下に書く＝delivery-popup-html.ts）
  const isInstant = draft.popup_kind === 'instant'
  const delayField = makeSuffixField('秒数', draft.delay_seconds, '秒', (v) => { draft.delay_seconds = v })
  delayField.append(hint(isInstant
    ? 'LPを開いてから、この秒数がたったら出します'
    : 'LPを開いてからこの秒数のあいだは、離脱で表示（カーソルが画面の上へ抜ける）では出しません'))
  body.append(delayField)

  // 表示直後は、開いて「秒数」のあとに出す種類。下のきっかけは離脱防止だけで使う（配信もそう動く）
  if (isInstant) {
    body.append(hint('表示直後のポップアップは、LPを開いて「秒数」がたったら出ます。スクロール・カウントダウン・バックボタン・離脱で表示は、離脱防止のポップアップで使えます。'))
    return
  }

  // スクロールで表示
  const scrollRow = el('div', { class: 'ep-toggle-row' })
  const scrollToggle = el('button', { class: `ep-toggle${draft.scroll_trigger ? ' on' : ''}` })
  scrollToggle.addEventListener('click', () => {
    draft.scroll_trigger = !draft.scroll_trigger
    scrollToggle.classList.toggle('on', draft.scroll_trigger)
  })
  scrollRow.append(scrollToggle, el('span', { class: 'ep-toggle-label', text: 'スクロールで表示' }))
  body.append(scrollRow)

  // 表示位置（number input + % ＋ スライダー: 実SB準拠）
  const posField = makeSuffixField('表示位置', draft.scroll_position, '%', (v) => {
    draft.scroll_position = v
    posSlider.value = String(v)
  })
  const posSlider = document.createElement('input')
  posSlider.type = 'range'
  posSlider.min = '0'
  posSlider.max = '100'
  posSlider.value = String(draft.scroll_position)
  posSlider.className = 'ep-range'
  posSlider.style.cssText = 'width:100%;margin-top:6px;accent-color:' + T.primary
  posSlider.addEventListener('input', () => {
    const v = Number(posSlider.value)
    draft.scroll_position = v
    const numInput = posField.querySelector('input')
    if (numInput !== null) numInput.value = String(v)
  })
  posField.append(posSlider)
  body.append(posField)

  // カウントダウンで表示
  const cdRow = el('div', { class: 'ep-toggle-row' })
  const cdToggle = el('button', { class: `ep-toggle${draft.countdown_trigger ? ' on' : ''}` })
  cdToggle.addEventListener('click', () => {
    draft.countdown_trigger = !draft.countdown_trigger
    cdToggle.classList.toggle('on', draft.countdown_trigger)
  })
  cdRow.append(cdToggle, el('span', { class: 'ep-toggle-label', text: 'カウントダウンで表示' }))
  body.append(cdRow)

  body.append(makeSuffixField('秒数', draft.countdown_seconds, '秒', (v) => { draft.countdown_seconds = v }))

  // バックボタンで表示
  const backRow = el('div', { class: 'ep-toggle-row' })
  const backToggle = el('button', { class: `ep-toggle${draft.back_button_trigger ? ' on' : ''}` })
  backToggle.addEventListener('click', () => {
    draft.back_button_trigger = !draft.back_button_trigger
    backToggle.classList.toggle('on', draft.back_button_trigger)
  })
  backRow.append(backToggle, el('span', { class: 'ep-toggle-label', text: 'バックボタンで表示' }))
  body.append(backRow)

  // 離脱で表示
  const exitRow = el('div', { class: 'ep-toggle-row' })
  const exitToggle = el('button', { class: `ep-toggle${draft.exit_trigger ? ' on' : ''}` })
  exitToggle.addEventListener('click', () => {
    draft.exit_trigger = !draft.exit_trigger
    exitToggle.classList.toggle('on', draft.exit_trigger)
  })
  exitRow.append(exitToggle, el('span', { class: 'ep-toggle-label', text: '離脱で表示' }))
  body.append(exitRow)
}
/**
 * 表示位置。実SB準拠で「9分割グリッド（上/中/下 × 左/中/右）」で選ぶ方式にする。
 * 以前は自由X/Yクリックだったが、本物は9箇所の離散選択なので合わせる。
 * 保存は既存の position_x / position_y（%）に 0/50/100 でマッピングする。
 */
const POSITION_CELLS: readonly { x: number; y: number; icon: string; title: string }[] = [
  { x: 0, y: 0, icon: '↖', title: '左上' }, { x: 50, y: 0, icon: '↑', title: '上' }, { x: 100, y: 0, icon: '↗', title: '右上' },
  { x: 0, y: 50, icon: '←', title: '左' }, { x: 50, y: 50, icon: '◉', title: '中央' }, { x: 100, y: 50, icon: '→', title: '右' },
  { x: 0, y: 100, icon: '↙', title: '左下' }, { x: 50, y: 100, icon: '↓', title: '下' }, { x: 100, y: 100, icon: '↘', title: '右下' },
]
/** 自由座標を最寄りの 0/50/100 に丸める（旧データの互換） */
function snapPos(v: number): number {
  if (v < 25) return 0
  if (v > 75) return 100
  return 50
}
function renderPositionTab(body: HTMLElement, draft: ExitPopup): void {
  injectPositionGridCss()
  body.append(el('div', { class: 'ep-section-title', text: '表示位置' }))

  const layout = el('div', { class: 'ep-pos-layout' })
  const grid = el('div', { class: 'ep-pos-grid' })
  const preview = el('div', { class: 'ep-pos-preview' })
  const bar = el('div', { class: 'ep-pos-preview-bar' })
  preview.append(bar)

  const curX = snapPos(draft.position_x)
  const curY = snapPos(draft.position_y)

  const updatePreview = (): void => {
    bar.style.left = `${snapPos(draft.position_x)}%`
    bar.style.top = `${snapPos(draft.position_y)}%`
    const tx = snapPos(draft.position_x)
    const ty = snapPos(draft.position_y)
    bar.style.transform = `translate(-${tx}%, -${ty}%)`
  }

  const cellButtons: HTMLElement[] = []
  for (const cell of POSITION_CELLS) {
    const btn = el('button', { class: 'ep-pos-cell', text: cell.icon })
    btn.title = cell.title
    if (cell.x === curX && cell.y === curY) btn.classList.add('active')
    btn.addEventListener('click', () => {
      draft.position_x = cell.x
      draft.position_y = cell.y
      for (const b of cellButtons) b.classList.remove('active')
      btn.classList.add('active')
      updatePreview()
    })
    cellButtons.push(btn)
    grid.append(btn)
  }

  layout.append(grid, preview)
  body.append(layout)
  updatePreview()
}
function renderDeviceTab(body: HTMLElement, draft: ExitPopup): void {
  body.append(el('div', { class: 'ep-field' }, [el('label', { text: 'デバイス別の表示制御' })]))

  const devices: { key: 'device_sp' | 'device_tablet' | 'device_pc'; label: string }[] = [
    { key: 'device_sp', label: 'スマートフォン (SP)' },
    { key: 'device_tablet', label: 'タブレット' },
    { key: 'device_pc', label: 'PC' },
  ]

  for (const device of devices) {
    const row = el('div', { class: 'ep-device-row' })
    const name = el('div', { class: 'ep-device-name', text: device.label })
    const toggle = el('button', { class: `ep-toggle${draft[device.key] ? ' on' : ''}` })
    toggle.addEventListener('click', () => {
      draft[device.key] = !draft[device.key]
      toggle.classList.toggle('on', draft[device.key])
    })
    row.append(name, toggle)
    body.append(row)
  }
}
/** コード（中身の HTML は「中身を編集」で直す。ここは動きの JavaScript と、head・body に足すタグ） */
function renderCodeTab(body: HTMLElement, draft: ExitPopup): void {
  type HtmlSubTab = 'javascript' | 'head_tag' | 'body_tag'
  const subTabs: { id: HtmlSubTab; label: string }[] = [
    { id: 'javascript', label: 'JavaScript' },
    { id: 'head_tag', label: 'HeadTag' },
    { id: 'body_tag', label: 'BodyTag' },
  ]

  let activeSubTab: HtmlSubTab = 'javascript'
  const tabBar = el('div', { class: 'ep-html-tabs' })
  const editorArea = el('div')

  /** サブタブIDから構文ハイライト言語を判定 */
  function langOf(tab: HtmlSubTab): string {
    if (tab === 'javascript') return 'javascript'
    return 'html'
  }

  function renderSubTab(): void {
    editorArea.innerHTML = ''
    const wrap = el('div', { class: 'ep-html-code-wrap' })
    const inner = el('div', { class: 'ep-html-code-inner' })

    // 行番号ガター
    const gutter = el('div', { class: 'ep-html-gutter' })
    const content = draft[activeSubTab]
    updateGutter(gutter, content)

    // overlay パターン: pre(ハイライト) + textarea(入力)
    const editorBox = el('div', { class: 'ep-html-editor-box' })
    const pre = document.createElement('pre')
    pre.className = 'ep-html-highlight'
    pre.innerHTML = highlight(content, langOf(activeSubTab))

    const textarea = document.createElement('textarea')
    textarea.className = 'ep-html-textarea'
    textarea.spellcheck = false
    textarea.value = content
    // コード全体をまとめてコピー（本人指示）。サブタブの右端に置く
    const copyBar = el('div', { class: 'ep-html-copy' })
    copyBar.append(codeCopyButton(textarea))

    const sync = (): void => {
      if (activeSubTab === 'javascript') draft.javascript = textarea.value
      else if (activeSubTab === 'head_tag') draft.head_tag = textarea.value
      else if (activeSubTab === 'body_tag') draft.body_tag = textarea.value
      pre.innerHTML = highlight(textarea.value, langOf(activeSubTab))
      updateGutter(gutter, textarea.value)
    }
    textarea.addEventListener('input', sync)
    textarea.addEventListener('scroll', () => {
      pre.style.transform = `translate(-${textarea.scrollLeft}px,-${textarea.scrollTop}px)`
      gutter.scrollTop = textarea.scrollTop
    })
    // Tab キーでインデント
    textarea.addEventListener('keydown', (ev) => {
      if (ev.key === 'Tab') {
        ev.preventDefault()
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end)
        textarea.selectionStart = textarea.selectionEnd = start + 2
        sync()
      }
    })

    editorBox.append(pre, textarea)
    inner.append(gutter, editorBox)
    wrap.append(inner)
    editorArea.append(copyBar, wrap)
  }

  for (const sub of subTabs) {
    const btn = el('button', { class: `ep-html-tab${sub.id === activeSubTab ? ' active' : ''}`, text: sub.label })
    btn.addEventListener('click', () => {
      activeSubTab = sub.id
      for (const b of tabBar.querySelectorAll('.ep-html-tab')) b.classList.remove('active')
      btn.classList.add('active')
      renderSubTab()
    })
    tabBar.append(btn)
  }

  body.append(tabBar)
  body.append(editorArea)
  renderSubTab()
}

/** 欄の下に出す小さな説明 */
function hint(text: string): HTMLElement {
  return el('p', { style: `font-size:11px;color:${T.sub};margin:4px 0 0;line-height:1.6`, text })
}
