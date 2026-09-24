/**
 * 離脱防止ポップアップの編集モーダル（exit-popup.ts から分離）。
 *
 * 中身（見た目）は「中身を編集」から Widget編集と同じ画面で直す（2026-09-24・本人の決定「中身だけWidget編集で」。
 * 以前の「デザイン」タブ・HTMLの欄は無くした＝直す画面を1つにする）。
 * ここは5つのタブ（基本設定 / 表示条件 / 表示位置 / 出し分け / コード）と、
 * その場で見た目を確かめるプレビュー表示を受け持つ。
 *
 * 依存は一方向にしてある: このファイルは exit-popup.ts を import しない。
 * 一覧の描き直しは `state.rerender()` を通す。
 */
import { codeCopyButton } from '../panels/code-copy.ts'
import { api, type ExitPopup } from '../api.ts'
import { T, el, toast } from '../ui.ts'
import { withTrackingParam, isTrackingLink } from '../../shared/link-html.ts'
import { highlight } from '../panels/syntax-highlight.ts'
import { PRESETS } from './exit-popup-presets.ts'
import type { PopupPageState } from './exit-popup-state.ts'
import { injectPositionGridCss } from './exit-popup-styles.ts'
import { makeCheckboxRow, makeSuffixField, makeTextField, updateGutter } from './exit-popup-fields.ts'
import { openPopupStudio } from '../panels/popup-studio.ts'
import { popupContentCard } from './popup-content-card.ts'
import { runWidgetScripts } from '../panels/widget-run-scripts.ts'

type EditorTab = 'basic' | 'display' | 'position' | 'device' | 'code'
const EDITOR_TABS: readonly { id: EditorTab; label: string }[] = [
  { id: 'basic', label: '基本' },
  { id: 'display', label: '表示' },
  { id: 'position', label: '位置' },
  { id: 'device', label: '出し分け' },
  // 中身の HTML は「中身を編集」で直す。ここは動き（JavaScript）と head・body に足すタグだけ
  { id: 'code', label: 'コード' },
]
export function openEditor(state: PopupPageState, popup: ExitPopup): void {
  // モーダルパネルとエディタを除去してから再描画
  for (const p of state.root.querySelectorAll('.ep-panel')) p.remove()
  for (const e of state.root.querySelectorAll('.ep-editor')) e.remove()

  // 編集用のコピー（保存まで元データを壊さない）
  const draft = { ...popup }

  const editor = el('div', { class: 'ep-editor' })

  // ── ヘッダ上段: 戻る | ポップアップ | (spacer) ──
  const headTop = el('div', { class: 'ep-editor-head-top' })
  const headTopLeft = el('div', { class: 'ep-editor-head-top-left' })
  const backBtn = el('button', { class: 'ep-editor-head-back', text: '戻る' })
  backBtn.addEventListener('click', () => {
    editor.remove()
    state.rerender()
  })
  headTopLeft.append(backBtn)
  const headTopCenter = el('div', { class: 'ep-editor-head-top-center', text: 'ポップアップ' })
  const headTopRight = el('div', { class: 'ep-editor-head-top-right' })
  headTop.append(headTopLeft, headTopCenter, headTopRight)
  editor.append(headTop)

  // ── ヘッダ下段: ボタン群 ──
  const btnBar = el('div', { class: 'ep-editor-btn-bar' })
  const btnLeft = el('div', { class: 'ep-editor-btn-group' })

  const previewBtn = el('button', { class: 'ep-editor-btn-draft', text: 'プレビュー' })
  previewBtn.addEventListener('click', () => previewPopup(draft))
  const checkDraftBtn = el('button', { class: 'ep-editor-btn-draft' })
  checkDraftBtn.innerHTML = `下書きを確認 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`
  btnLeft.append(previewBtn, checkDraftBtn)

  const btnRight = el('div', { class: 'ep-editor-btn-group' })
  const saveDraftBtn = el('button', { class: 'ep-editor-btn-draft', text: '下書き反映' })
  const saveProdBtn = el('button', { class: 'ep-editor-btn-prod', text: '本番反映' })

  /** 保存（下書き反映・本番反映・中身の「ポップアップに反映」で共通）。保存できたら true */
  const saveDraft = async (): Promise<boolean> => {
    const { id: _id, uid: _uid, ab_test_id: _abid, ...patch } = draft
    try {
      const { exit_popup } = await api.updateExitPopup(state.abTestUid, popup.uid, patch)
      state.popups = state.popups.map((p) => (p.uid === popup.uid ? exit_popup : p))
      Object.assign(popup, exit_popup)
      toast('ポップアップを保存しました')
      return true
    } catch (err: unknown) {
      toast((err as Error).message, 'error')
      return false
    }
  }
  const handleSave = (btn: HTMLElement): void => {
    const origText = btn.textContent ?? ''
    btn.textContent = '保存中…'
    ;(btn as HTMLButtonElement).disabled = true
    void saveDraft().then(() => {
      ;(btn as HTMLButtonElement).disabled = false
      btn.textContent = origText
    })
  }
  saveDraftBtn.addEventListener('click', () => handleSave(saveDraftBtn))
  saveProdBtn.addEventListener('click', () => handleSave(saveProdBtn))

  const moreBtn = el('button', { class: 'ep-editor-btn-more', text: '⋯' })
  btnRight.append(saveDraftBtn, saveProdBtn, moreBtn)
  btnBar.append(btnLeft, btnRight)
  editor.append(btnBar)

  // ── フォーム上部: サムネイル + 配信/名前/割合 ──
  const formTop = el('div', { class: 'ep-form-top' })

  // 中身: 見え方の小さな絵（今の中身そのもの）＋「中身を編集」＝Widget編集と同じ画面
  const presetDef = popup.preset_id !== null ? PRESETS.find((p) => p.id === popup.preset_id) : undefined
  const content = popupContentCard({
    read: () => ({ html: draft.html, css: '' }),
    renderWidth: 500,
    ...(presetDef === undefined ? {} : { emptyArt: presetDef.thumbnailSvg }),
    onEdit: () =>
      openPopupStudio({
        html: draft.html,
        css: '',
        name: draft.name,
        frame: 'overlay',
        onSave: (html) => {
          draft.html = html
          content.refresh()
          return saveDraft()
        },
      }),
  })
  formTop.append(content.el)

  const fields = el('div', { class: 'ep-form-fields' })

  // 配信トグル
  const deliveryRow = el('div', { style: 'display:flex;align-items:center;gap:8px' })
  const deliveryLabel = el('span', { style: 'font-size:13px', text: '配信' })
  const editorToggle = el('button', { class: `ep-toggle${draft.enabled ? ' on' : ''}` })
  editorToggle.addEventListener('click', () => {
    draft.enabled = !draft.enabled
    editorToggle.classList.toggle('on', draft.enabled)
  })
  deliveryRow.append(deliveryLabel, editorToggle)
  fields.append(deliveryRow)

  // 名前
  const nameField = el('div', { class: 'ep-field', style: 'margin-bottom:0' })
  nameField.append(el('label', { text: '名前' }))
  const nameInput = document.createElement('input') as HTMLInputElement
  nameInput.className = 'ep-editor-name'
  nameInput.value = draft.name
  nameInput.addEventListener('input', () => { draft.name = nameInput.value })
  nameField.append(nameInput)
  fields.append(nameField)

  // 割合
  const ratioField = el('div', { class: 'ep-field', style: 'margin-bottom:0' })
  ratioField.append(el('label', { text: '割合' }))
  const ratioInput = document.createElement('input') as HTMLInputElement
  ratioInput.type = 'number'
  ratioInput.min = '0'
  ratioInput.value = String(draft.ratio)
  ratioInput.style.cssText = 'width:100%;padding:8px 10px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:4px;font-size:13px;box-sizing:border-box'
  ratioInput.addEventListener('input', () => {
    const n = Number(ratioInput.value)
    if (Number.isFinite(n)) draft.ratio = n
  })
  ratioField.append(ratioInput)
  fields.append(ratioField)

  formTop.append(fields)
  editor.append(formTop)

  // ── タブ ──
  const tabBar = el('div', { class: 'ep-editor-tabs' })
  const body = el('div', { class: 'ep-editor-body' })
  let activeTab: EditorTab = 'basic'

  for (const tab of EDITOR_TABS) {
    const btn = el('button', { class: `ep-editor-tab${tab.id === activeTab ? ' active' : ''}`, text: tab.label })
    btn.dataset['tab'] = tab.id
    btn.addEventListener('click', () => {
      activeTab = tab.id
      for (const b of tabBar.querySelectorAll('.ep-editor-tab')) b.classList.remove('active')
      btn.classList.add('active')
      renderEditorTab(body, draft, activeTab)
    })
    tabBar.append(btn)
  }
  editor.append(tabBar)
  editor.append(body)
  renderEditorTab(body, draft, activeTab)

  state.root.append(editor)
}
function renderEditorTab(body: HTMLElement, draft: ExitPopup, tab: EditorTab): void {
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
  body.append(makeTextField('電話番号', draft.phone_number, (v) => { draft.phone_number = v }, '電話番号を入力'))
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

  // 指示172: 動作の選択 — 遷移先URLへ移動 / LPに戻る（閉じて元の位置へ・×と同じ）
  const actionRow = el('div', { style: 'display:flex;align-items:center;gap:16px;margin:2px 0 10px' })
  const rLink = document.createElement('input')
  rLink.type = 'radio'; rLink.name = `ep-action-${draft.uid}`; rLink.value = 'link'
  const rClose = document.createElement('input')
  rClose.type = 'radio'; rClose.name = `ep-action-${draft.uid}`; rClose.value = 'close'
  if (draft.link_action === 'close') rClose.checked = true
  else rLink.checked = true
  // 指示: ラベルは折り返さず横一列に（white-space:nowrap + flex-shrink:0）
  const lLink = el('label', { style: 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;white-space:nowrap;flex-shrink:0' })
  lLink.append(rLink, el('span', { text: '遷移先URLへ移動' }))
  const lClose = el('label', { style: 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;white-space:nowrap;flex-shrink:0' })
  lClose.append(rClose, el('span', { text: 'LPに戻る（閉じて元の位置へ）' }))
  actionRow.append(lLink, lClose)
  field.append(actionRow)

  // 遷移先URL入力群（動作=LPに戻る のときは隠す）
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
  const applyAction = (): void => {
    const isClose = rClose.checked
    draft.link_action = isClose ? 'close' : 'link'
    urlWrap.hidden = isClose // LPに戻る のときは遷移先URL群を隠す（link_url は保持して切替時に復元可）
  }
  input.addEventListener('input', sync)
  newTabCb.addEventListener('change', sync)
  trackCb.addEventListener('change', sync)
  rLink.addEventListener('change', applyAction)
  rClose.addEventListener('change', applyAction)
  applyAction()

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

  // 秒数
  body.append(makeSuffixField('秒数', draft.delay_seconds, '秒', (v) => { draft.delay_seconds = v }))

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
export function previewPopup(popup: ExitPopup | Partial<ExitPopup>): void {
  // 既存プレビューを除去（二重表示防止）
  document.getElementById('ep-preview-overlay')?.remove()
  document.getElementById('ep-preview-style')?.remove()

  // 内部アニメーション用キーフレームを注入
  const styleEl = document.createElement('style')
  styleEl.id = 'ep-preview-style'
  styleEl.textContent = `
    @keyframes epConfettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(400px) rotate(720deg);opacity:0}}
    @keyframes epPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
    @keyframes epBounceIn{0%{opacity:0;transform:scale(.3)}50%{opacity:1;transform:scale(1.05)}70%{transform:scale(.95)}100%{opacity:1;transform:scale(1)}}
  `
  document.head.append(styleEl)

  const overlay = el('div', {
    style: `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;
      display:flex;align-items:center;justify-content:center;font-family:${T.font}`,
  })
  overlay.id = 'ep-preview-overlay'

  const frame = el('div', { style: 'max-width:500px;max-height:80vh;overflow:auto;position:relative' })
  frame.innerHTML = popup.html ?? '<p>プレビューできるHTMLがありません</p>'
  overlay.append(frame)

  const closeHint = el('div', {
    text: 'クリックで閉じる',
    style: 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:#FFFFFF;font-size:13px;opacity:.7',
  })
  overlay.append(closeHint)

  overlay.addEventListener('click', (e) => {
    // frame 内のクリック（ボタン等）は閉じない
    if (frame.contains(e.target as Node)) return
    overlay.remove()
    styleEl.remove()
  })
  document.body.append(overlay)
  // 中身の <script> を動かす（innerHTML では動かない。部品で作った「次へ」で画面②へ移る・見本の動き）。
  // 配信と同じ順番: 中身のスクリプト → ポップアップの動き（下）
  runWidgetScripts(frame)

  // ポップアップのJavaScriptを実行（delivery.ts と同じスコープ変数を提供）
  if (popup.javascript) {
    try {
      const epId = 'ep-preview-overlay'
      // overlay / epId をスコープに入れて実行
      const fn = new Function('overlay', 'epId', popup.javascript)
      fn(overlay, epId)
    } catch (e) {
      console.warn('[ep-preview] JS実行エラー:', e)
    }
  }
  // ep-show イベントを発火して内部アニメを起動
  try { overlay.dispatchEvent(new CustomEvent('ep-show')) } catch (_) { /* noop */ }
}
