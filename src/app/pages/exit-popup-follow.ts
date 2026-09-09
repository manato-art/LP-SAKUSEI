/**
 * 追尾型ポップアップ（exit-popup.ts から分離）。
 *
 * 離脱防止ポップアップと違い、オーバーレイを出さず画面の端に貼り付いて
 * スクロールに追従する種類。カード表示・プリセット選択・編集モーダルまでを受け持つ。
 *
 * 依存は一方向にしてある: このファイルは exit-popup.ts を import しない。
 * 一覧の描き直しは `state.rerender()` を通す。
 */
import { api, type FollowPopup } from '../api.ts'
import { T, el, toast, confirmCard } from '../ui.ts'
import { highlight } from '../panels/syntax-highlight.ts'
import { FOLLOW_PRESETS, type FollowPreset } from './follow-popup-presets.ts'
import type { PopupPageState } from './exit-popup-state.ts'
import { makeNumberField, updateGutter } from './exit-popup-fields.ts'

export function renderFollowCard(state: PopupPageState, fp: FollowPopup): HTMLElement {
  const card = el('div', { class: 'ep-card' })

  // ⋯ メニューボタン
  const menuBtn = el('button', { class: 'ep-card-menu', text: '⋯' })
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleFollowDropdown(card, state, fp)
  })
  card.append(menuBtn)

  // サムネイル
  const thumb = el('div', { class: 'ep-card-thumb' })
  const preset = fp.preset_id !== null ? FOLLOW_PRESETS.find((p) => p.id === fp.preset_id) : null
  if (preset !== null && preset !== undefined) {
    thumb.innerHTML = preset.thumbnailSvg
  } else {
    thumb.textContent = 'NO IMAGE'
  }
  card.append(thumb)

  // カード下部
  const body = el('div', { class: 'ep-card-body' })
  body.append(el('p', { class: 'ep-card-name', text: fp.name }))

  const footer = el('div', { class: 'ep-card-footer' })

  const posLabels: Record<string, string> = { top: '上部', bottom: '下部', 'bottom-right': '右下', 'bottom-left': '左下' }
  const ratioWrap = el('div', { class: 'ep-card-ratio' })
  ratioWrap.append(el('span', { text: posLabels[fp.position] ?? fp.position }))
  footer.append(ratioWrap)

  // 配信トグル
  const itemToggle = el('button', { class: `ep-toggle${fp.enabled ? ' on' : ''}` })
  itemToggle.style.cssText = 'width:34px;height:18px'
  itemToggle.addEventListener('click', (e) => {
    e.stopPropagation()
    const newEnabled = !fp.enabled
    void api.updateFollowPopup(state.abTestUid, fp.uid, { enabled: newEnabled }).then(
      () => {
        fp.enabled = newEnabled
        itemToggle.classList.toggle('on', newEnabled)
      },
      (err: unknown) => toast((err as Error).message, 'error'),
    )
  })
  footer.append(itemToggle)

  body.append(footer)
  card.append(body)

  card.addEventListener('click', () => openFollowEditor(state, fp))
  return card
}
export function toggleFollowDropdown(cardEl: HTMLElement, state: PopupPageState, fp: FollowPopup): void {
  const existing = cardEl.querySelector('.ep-dropdown')
  if (existing !== null) { existing.remove(); return }
  for (const d of document.querySelectorAll('.ep-dropdown')) d.remove()

  const dropdown = el('div', { class: 'ep-dropdown' })

  const editBtn = el('button', { class: 'ep-dropdown-item', text: '編集' })
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.remove()
    openFollowEditor(state, fp)
  })

  const previewBtn = el('button', { class: 'ep-dropdown-item', text: 'プレビュー' })
  previewBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.remove()
    previewFollowPopup(fp)
  })

  const deleteBtn = el('button', { class: 'ep-dropdown-item danger', html: `削除 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>` })
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.remove()
    void confirmCard('この追従型ポップアップを削除しますか？', '削除する').then((ok) => {
      if (!ok) return
      void api.deleteFollowPopup(state.abTestUid, fp.uid).then(
        () => {
          state.followPopups = state.followPopups.filter((p) => p.uid !== fp.uid)
          state.rerender()
          toast('追従型ポップアップを削除しました')
        },
        (err: unknown) => toast((err as Error).message, 'error'),
      )
    })
  })

  dropdown.append(editBtn, previewBtn, deleteBtn)
  cardEl.append(dropdown)

  const close = (e: MouseEvent): void => {
    if (!cardEl.contains(e.target as Node)) {
      dropdown.remove()
      document.removeEventListener('click', close)
    }
  }
  setTimeout(() => document.addEventListener('click', close), 0)
}
export function openFollowPresetModal(state: PopupPageState): void {
  const overlay = el('div', { class: 'ep-modal-overlay' })
  const modal = el('div', { class: 'ep-modal' })

  // ヘッダ
  const head = el('div', { class: 'ep-modal-head' })
  const closeBtn = el('button', { class: 'ep-modal-close', text: '閉じる' })
  closeBtn.addEventListener('click', () => overlay.remove())
  head.append(closeBtn)
  head.append(el('h2', { text: 'ポップアップ追加（追従型）' }))
  modal.append(head)

  // 検索バー
  const searchWrap = el('div', { class: 'ep-modal-search' })
  const searchInput = document.createElement('input')
  searchInput.type = 'text'
  searchInput.placeholder = '入力してください'
  searchWrap.append(searchInput)
  modal.append(searchWrap)

  // ツールバー
  const toolbar = el('div', { class: 'ep-modal-toolbar' })
  const tabs = el('div', { class: 'ep-modal-tabs' })
  const tabPreset = el('button', { class: 'ep-modal-tab active', text: 'プリセット' })
  const tabCopy = el('button', { class: 'ep-modal-tab', text: '複製' })
  tabs.append(tabPreset, tabCopy)
  toolbar.append(tabs)
  const newBtn = el('button', { class: 'ep-modal-new', text: '+ 新規ポップアップ作成' })
  newBtn.addEventListener('click', () => {
    overlay.remove()
    createBlankFollowPopup(state)
  })
  toolbar.append(newBtn)
  modal.append(toolbar)

  // プリセットリスト
  const list = el('div', { class: 'ep-preset-list' })
  for (const preset of FOLLOW_PRESETS) {
    list.append(renderFollowPresetItem(state, preset, overlay))
  }
  modal.append(list)

  // 検索フィルタリング
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase()
    for (const item of list.querySelectorAll<HTMLElement>('.ep-preset-item')) {
      const name = (item.querySelector('.ep-preset-name')?.textContent ?? '').toLowerCase()
      item.style.display = query === '' || name.includes(query) ? '' : 'none'
    }
  })

  // 複製タブ
  tabCopy.addEventListener('click', () => {
    tabPreset.classList.remove('active')
    tabCopy.classList.add('active')
    list.innerHTML = ''
    list.append(el('div', { class: 'ep-empty', text: '複製可能なポップアップはありません。' }))
  })
  tabPreset.addEventListener('click', () => {
    tabCopy.classList.remove('active')
    tabPreset.classList.add('active')
    list.innerHTML = ''
    for (const preset of FOLLOW_PRESETS) {
      list.append(renderFollowPresetItem(state, preset, overlay))
    }
  })

  overlay.append(modal)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
  document.body.append(overlay)
}
export function renderFollowPresetItem(
  state: PopupPageState,
  preset: FollowPreset,
  overlay: HTMLElement,
): HTMLElement {
  const item = el('div', { class: 'ep-preset-item' })

  const thumb = el('div', { class: 'ep-preset-thumb' })
  thumb.innerHTML = preset.thumbnailSvg
  item.append(thumb)

  const info = el('div', { class: 'ep-preset-info' })
  info.append(el('p', { class: 'ep-preset-name', text: preset.name }))
  const details = el('div', { class: 'ep-preset-detail' })
  const posLabels: Record<string, string> = { top: '上部', bottom: '下部', 'bottom-right': '右下', 'bottom-left': '左下' }
  const posText = posLabels[preset.defaults.position ?? 'bottom'] ?? preset.defaults.position ?? '下部'
  const animText = preset.defaults.animation ?? 'slideUp'
  details.innerHTML = `<span>表示位置　　${posText}</span><br><span>出現アニメーション　　${animText}</span>`
  info.append(details)
  item.append(info)

  const addBtn = el('button', { class: 'ep-preset-add', text: '追加' })
  let adding = false
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (adding) return
    adding = true
    addBtn.disabled = true
    addBtn.textContent = '追加中…'
    void api.createFollowPopup(state.abTestUid, {
      name: preset.name,
      preset_id: preset.id,
      html: preset.defaultHtml,
      css: preset.defaultCss,
      javascript: preset.defaultJavascript,
      position: preset.defaults.position ?? 'bottom',
      show_after_scroll: preset.defaults.show_after_scroll ?? 0,
      show_close_button: preset.defaults.show_close_button ?? true,
      animation: preset.defaults.animation ?? 'slideUp',
    }).then(
      ({ follow_popup }) => {
        state.followPopups = [...state.followPopups, follow_popup]
        overlay.remove()
        state.rerender()
        toast(`「${preset.name}」を追加しました`)
      },
      (err: unknown) => {
        adding = false
        addBtn.disabled = false
        addBtn.textContent = '追加'
        toast((err as Error).message, 'error')
      },
    )
  })
  item.append(addBtn)

  return item
}
export function createBlankFollowPopup(state: PopupPageState): void {
  void api.createFollowPopup(state.abTestUid, {
    name: '新規追従型ポップアップ',
    html: '<div style="padding:12px 20px;background:#333;color:#fff;font-family:sans-serif;text-align:center;font-size:13px">追従型ポップアップの内容</div>',
    position: 'bottom',
  }).then(
    ({ follow_popup }) => {
      state.followPopups = [...state.followPopups, follow_popup]
      state.rerender()
      toast('新規追従型ポップアップを作成しました')
      openFollowEditor(state, follow_popup)
    },
    (err: unknown) => toast((err as Error).message, 'error'),
  )
}
export type FollowEditorTab = 'settings' | 'device' | 'html'
export const FOLLOW_EDITOR_TABS: readonly { id: FollowEditorTab; label: string }[] = [
  { id: 'settings', label: '表示設定' },
  { id: 'device', label: '出し分け' },
  { id: 'html', label: 'HTML' },
]
export function openFollowEditor(state: PopupPageState, fp: FollowPopup): void {
  for (const p of state.root.querySelectorAll('.ep-panel')) p.remove()
  for (const e of state.root.querySelectorAll('.ep-editor')) e.remove()

  const draft = { ...fp }

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
  previewBtn.addEventListener('click', () => previewFollowPopup(draft))
  const checkDraftBtn = el('button', { class: 'ep-editor-btn-draft' })
  checkDraftBtn.innerHTML = `下書きを確認 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`
  btnLeft.append(previewBtn, checkDraftBtn)

  const btnRight = el('div', { class: 'ep-editor-btn-group' })
  const saveDraftBtn = el('button', { class: 'ep-editor-btn-draft', text: '下書き反映' })
  const saveProdBtn = el('button', { class: 'ep-editor-btn-prod', text: '本番反映' })

  const handleSave = (btn: HTMLElement): void => {
    const origText = btn.textContent ?? ''
    btn.textContent = '保存中…'
    ;(btn as HTMLButtonElement).disabled = true
    const { id: _id, uid: _uid, ab_test_id: _abid, ...patch } = draft
    void api.updateFollowPopup(state.abTestUid, fp.uid, patch).then(
      ({ follow_popup }) => {
        state.followPopups = state.followPopups.map((p) => (p.uid === fp.uid ? follow_popup : p))
        Object.assign(fp, follow_popup)
        ;(btn as HTMLButtonElement).disabled = false
        btn.textContent = origText
        toast('追従型ポップアップを保存しました')
      },
      (err: unknown) => {
        ;(btn as HTMLButtonElement).disabled = false
        btn.textContent = origText
        toast((err as Error).message, 'error')
      },
    )
  }
  saveDraftBtn.addEventListener('click', () => handleSave(saveDraftBtn))
  saveProdBtn.addEventListener('click', () => handleSave(saveProdBtn))

  const moreBtn = el('button', { class: 'ep-editor-btn-more', text: '⋯' })
  btnRight.append(saveDraftBtn, saveProdBtn, moreBtn)
  btnBar.append(btnLeft, btnRight)
  editor.append(btnBar)

  // ── フォーム上部: サムネイル + 配信/名前 ──
  const formTop = el('div', { class: 'ep-form-top' })
  const thumbWrap = el('div', { class: 'ep-form-thumb' })
  const presetDef = fp.preset_id !== null ? FOLLOW_PRESETS.find((p) => p.id === fp.preset_id) : null
  if (presetDef !== null && presetDef !== undefined) {
    thumbWrap.innerHTML = presetDef.thumbnailSvg
  } else {
    thumbWrap.textContent = 'NO IMAGE'
  }
  formTop.append(thumbWrap)

  const fields = el('div', { class: 'ep-form-fields' })

  const deliveryRow = el('div', { style: 'display:flex;align-items:center;gap:8px' })
  const deliveryLabel = el('span', { style: 'font-size:13px', text: '配信' })
  const editorToggle = el('button', { class: `ep-toggle${draft.enabled ? ' on' : ''}` })
  editorToggle.addEventListener('click', () => {
    draft.enabled = !draft.enabled
    editorToggle.classList.toggle('on', draft.enabled)
  })
  deliveryRow.append(deliveryLabel, editorToggle)
  fields.append(deliveryRow)

  const nameField = el('div', { class: 'ep-field', style: 'margin-bottom:0' })
  nameField.append(el('label', { text: '名前' }))
  const nameInput = document.createElement('input') as HTMLInputElement
  nameInput.className = 'ep-editor-name'
  nameInput.value = draft.name
  nameInput.addEventListener('input', () => { draft.name = nameInput.value })
  nameField.append(nameInput)
  fields.append(nameField)

  formTop.append(fields)
  editor.append(formTop)

  // ── タブ ──
  const tabBar = el('div', { class: 'ep-editor-tabs' })
  const body = el('div', { class: 'ep-editor-body' })
  let activeTab: FollowEditorTab = 'settings'

  for (const tab of FOLLOW_EDITOR_TABS) {
    const btn = el('button', { class: `ep-editor-tab${tab.id === activeTab ? ' active' : ''}`, text: tab.label })
    btn.dataset['tab'] = tab.id
    btn.addEventListener('click', () => {
      activeTab = tab.id
      for (const b of tabBar.querySelectorAll('.ep-editor-tab')) b.classList.remove('active')
      btn.classList.add('active')
      renderFollowEditorTab(body, draft)
    })
    tabBar.append(btn)
  }
  editor.append(tabBar)
  editor.append(body)
  renderFollowEditorTab(body, draft)

  state.root.append(editor)

  function renderFollowEditorTab(container: HTMLElement, d: typeof draft): void {
    container.innerHTML = ''
    switch (activeTab) {
      case 'settings': renderFollowSettingsTab(container, d); break
      case 'device': renderFollowDeviceTab(container, d); break
      case 'html': renderFollowHtmlTab(container, d); break
    }
  }
}
export function renderFollowSettingsTab(body: HTMLElement, draft: FollowPopup): void {
  // 表示位置
  const posField = el('div', { class: 'ep-field' })
  posField.append(el('label', { text: '表示位置' }))
  const posSelect = document.createElement('select')
  const posOptions: { value: string; label: string }[] = [
    { value: 'top', label: '上部（画面上端に固定）' },
    { value: 'bottom', label: '下部（画面下端に固定）' },
    { value: 'bottom-right', label: '右下（フローティング）' },
    { value: 'bottom-left', label: '左下（フローティング）' },
  ]
  for (const opt of posOptions) {
    const o = document.createElement('option')
    o.value = opt.value
    o.textContent = opt.label
    if (opt.value === draft.position) o.selected = true
    posSelect.append(o)
  }
  posSelect.addEventListener('change', () => {
    draft.position = posSelect.value as typeof draft.position
  })
  posField.append(posSelect)
  body.append(posField)

  // 表示アニメーション
  const animField = el('div', { class: 'ep-field' })
  animField.append(el('label', { text: '表示アニメーション' }))
  const animSelect = document.createElement('select')
  for (const opt of ['slideUp', 'slideDown', 'fade', 'none']) {
    const o = document.createElement('option')
    o.value = opt
    o.textContent = opt
    if (opt === draft.animation) o.selected = true
    animSelect.append(o)
  }
  animSelect.addEventListener('change', () => { draft.animation = animSelect.value })
  animField.append(animSelect)
  body.append(animField)

  // スクロール%で表示
  body.append(makeNumberField('スクロール表示位置 (%)', draft.show_after_scroll, (v) => { draft.show_after_scroll = v }))

  // 閉じるボタン
  const closeRow = el('div', { class: 'ep-toggle-row' })
  const closeToggle = el('button', { class: `ep-toggle${draft.show_close_button ? ' on' : ''}` })
  closeToggle.addEventListener('click', () => {
    draft.show_close_button = !draft.show_close_button
    closeToggle.classList.toggle('on', draft.show_close_button)
  })
  closeRow.append(closeToggle, el('span', { class: 'ep-toggle-label', text: '閉じるボタンを表示' }))
  body.append(closeRow)
}
export function renderFollowDeviceTab(body: HTMLElement, draft: FollowPopup): void {
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
export function renderFollowHtmlTab(body: HTMLElement, draft: FollowPopup): void {
  type HtmlSubTab = 'html' | 'css' | 'javascript'
  const subTabs: { id: HtmlSubTab; label: string }[] = [
    { id: 'html', label: 'HTML' },
    { id: 'css', label: 'CSS' },
    { id: 'javascript', label: 'JavaScript' },
  ]

  let activeSubTab: HtmlSubTab = 'html'
  const tabBar = el('div', { class: 'ep-html-tabs' })
  const editorArea = el('div')

  function renderSubTab(): void {
    editorArea.innerHTML = ''
    const wrap = el('div', { class: 'ep-html-code-wrap' })
    const inner = el('div', { class: 'ep-html-code-inner' })

    const gutter = el('div', { class: 'ep-html-gutter' })
    const content = draft[activeSubTab]
    updateGutter(gutter, content)

    // overlay パターン: pre(ハイライト) + textarea(入力)
    const editorBox = el('div', { class: 'ep-html-editor-box' })
    const pre = document.createElement('pre')
    pre.className = 'ep-html-highlight'
    pre.innerHTML = highlight(content, activeSubTab)

    const textarea = document.createElement('textarea')
    textarea.className = 'ep-html-textarea'
    textarea.spellcheck = false
    textarea.value = content

    const sync = (): void => {
      if (activeSubTab === 'html') draft.html = textarea.value
      else if (activeSubTab === 'css') draft.css = textarea.value
      else if (activeSubTab === 'javascript') draft.javascript = textarea.value
      pre.innerHTML = highlight(textarea.value, activeSubTab)
      updateGutter(gutter, textarea.value)
    }
    textarea.addEventListener('input', sync)
    textarea.addEventListener('scroll', () => {
      pre.style.transform = `translate(-${textarea.scrollLeft}px,-${textarea.scrollTop}px)`
      gutter.scrollTop = textarea.scrollTop
    })
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
    editorArea.append(wrap)
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
export function previewFollowPopup(fp: FollowPopup | Partial<FollowPopup>): void {
  document.getElementById('fp-preview-overlay')?.remove()

  const overlay = el('div', {
    style: `position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:9999;font-family:${T.font}`,
  })
  overlay.id = 'fp-preview-overlay'

  // 追従型は位置に合わせて表示
  const pos = fp.position ?? 'bottom'
  const frame = el('div', { style: 'position:absolute;left:0;right:0' })

  if (pos === 'top') {
    frame.style.top = '0'
  } else if (pos === 'bottom') {
    frame.style.bottom = '0'
  } else if (pos === 'bottom-right') {
    frame.style.cssText = 'position:absolute;bottom:20px;right:20px;left:auto'
  } else if (pos === 'bottom-left') {
    frame.style.cssText = 'position:absolute;bottom:20px;left:20px;right:auto'
  }

  frame.innerHTML = fp.html ?? '<p>プレビューできるHTMLがありません</p>'

  // CSSを適用
  if (fp.css) {
    const styleEl = document.createElement('style')
    styleEl.textContent = fp.css
    frame.prepend(styleEl)
  }

  overlay.append(frame)

  const closeHint = el('div', {
    text: 'クリックで閉じる',
    style: 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:14px;opacity:.8;background:rgba(0,0,0,.5);padding:8px 16px;border-radius:6px',
  })
  overlay.append(closeHint)

  overlay.addEventListener('click', (e) => {
    if (frame.contains(e.target as Node)) return
    overlay.remove()
  })
  document.body.append(overlay)

  // JavaScriptを実行
  if (fp.javascript) {
    try {
      const fn = new Function(fp.javascript)
      fn()
    } catch (e) {
      console.warn('[fp-preview] JS実行エラー:', e)
    }
  }
}
