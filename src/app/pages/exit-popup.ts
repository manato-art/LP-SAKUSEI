/**
 * 離脱防止ポップアップ管理（指示80）。
 *
 * `/ab_tests/:ab_test_uid/articles/exit_popups`
 *
 * 実物SquadBeyondで確認した全フローを再現:
 *   - ポップアップ管理パネル（離脱防止/追従型タブ、配信トグル、一覧）
 *   - ＋追加 → プリセット選択モーダル
 *   - ポップアップ編集（5タブ: 基本/表示/位置/出し分け/HTML）
 *   - LP上での離脱防止ポップアップ表示
 */
import { api, type ExitPopup } from '../api.ts'
import { isStale } from '../main.ts'
import { T, el, button, toast } from '../ui.ts'
import { setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'
import { PRESETS, type PopupPreset } from './exit-popup-presets.ts'

// ─── CSS注入 ────────────────────────────────────────

function injectPopupCss(): void {
  if (document.getElementById('sb-exit-popup-css') !== null) return
  const s = document.createElement('style')
  s.id = 'sb-exit-popup-css'
  s.textContent = `
    .ep-root { display:flex; flex-direction:column; flex:1; min-width:0; font-family:${T.font}; color:${T.text}; background:#f9f9fb; }
    .ep-panel { max-width:900px; width:100%; margin:24px auto; background:#fff; border-radius:10px; box-shadow:0 1px 4px rgba(0,0,0,.06); overflow:hidden; }
    .ep-panel-head { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid #eee; }
    .ep-subtabs { display:flex; gap:0; }
    .ep-subtab { padding:8px 16px; font-size:13px; cursor:pointer; border:1px solid #ddd; background:#f5f5f5; color:${T.sub}; }
    .ep-subtab:first-child { border-radius:6px 0 0 6px; }
    .ep-subtab:last-child { border-radius:0 6px 6px 0; }
    .ep-subtab.active { background:${T.primary}; color:#fff; border-color:${T.primary}; }
    .ep-delivery { display:flex; align-items:center; gap:8px; font-size:13px; color:${T.sub}; }
    .ep-toggle { width:40px; height:22px; border-radius:11px; background:#ccc; position:relative; cursor:pointer; transition:background .2s; border:none; padding:0; }
    .ep-toggle.on { background:${T.primary}; }
    .ep-toggle::after { content:''; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition:left .2s; box-shadow:0 1px 2px rgba(0,0,0,.2); }
    .ep-toggle.on::after { left:20px; }
    .ep-list-head { display:flex; align-items:center; justify-content:space-between; padding:12px 20px; }
    .ep-list-head h3 { font-size:14px; font-weight:600; margin:0; }
    .ep-add-btn { display:flex; align-items:center; gap:4px; font-size:13px; color:${T.primary}; cursor:pointer; background:none; border:none; font-family:${T.font}; }
    .ep-add-btn:hover { text-decoration:underline; }
    .ep-empty { padding:40px 20px; text-align:center; color:${T.sub}; font-size:13px; }
    .ep-card { display:flex; align-items:center; gap:12px; padding:12px 20px; border-top:1px solid #f0f0f0; cursor:pointer; transition:background .15s; }
    .ep-card:hover { background:#f8f8fa; }
    .ep-card.selected { background:#EBF5FF; }
    .ep-card-thumb { width:72px; height:52px; border-radius:4px; background:#f0f0f0; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:${T.sub}; font-size:10px; }
    .ep-card-info { flex:1; min-width:0; }
    .ep-card-name { font-size:13px; font-weight:500; margin:0 0 4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ep-card-meta { font-size:11px; color:${T.sub}; }
    .ep-card-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
    .ep-card-ratio { font-size:12px; color:${T.sub}; display:flex; align-items:center; gap:4px; }
    .ep-card-ratio select { border:1px solid #ddd; border-radius:4px; padding:2px 4px; font-size:12px; font-family:${T.font}; }
    .ep-menu-btn { background:none; border:none; cursor:pointer; font-size:16px; color:${T.sub}; padding:4px; line-height:1; }

    /* プリセットモーダル */
    .ep-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:9000; display:flex; align-items:center; justify-content:center; font-family:${T.font}; }
    .ep-modal { background:#fff; border-radius:10px; width:680px; max-width:92vw; max-height:85vh; display:flex; flex-direction:column; overflow:hidden; }
    .ep-modal-head { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid #eee; }
    .ep-modal-head h2 { font-size:15px; margin:0; font-weight:600; }
    .ep-modal-close { background:none; border:none; cursor:pointer; font-size:18px; color:${T.sub}; }
    .ep-modal-tabs { display:flex; gap:0; padding:0 18px; border-bottom:1px solid #eee; }
    .ep-modal-tab { padding:10px 16px; font-size:13px; cursor:pointer; border-bottom:2px solid transparent; color:${T.sub}; background:none; border-top:none; border-left:none; border-right:none; font-family:${T.font}; }
    .ep-modal-tab.active { color:${T.primary}; border-bottom-color:${T.primary}; font-weight:600; }
    .ep-preset-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:14px; padding:18px; overflow-y:auto; }
    .ep-preset-card { border:1px solid #e8e8e8; border-radius:8px; overflow:hidden; cursor:pointer; transition:box-shadow .15s, border-color .15s; }
    .ep-preset-card:hover { box-shadow:0 2px 8px rgba(0,0,0,.1); border-color:${T.primary}; }
    .ep-preset-thumb { aspect-ratio:200/140; background:#f5f5f5; }
    .ep-preset-info { padding:10px 12px; }
    .ep-preset-name { font-size:12px; font-weight:500; margin:0 0 6px; line-height:1.4; }
    .ep-preset-add { display:block; width:100%; padding:6px; font-size:11px; background:${T.primary}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-family:${T.font}; }
    .ep-preset-add:hover { background:${T.primaryDark}; }

    /* 編集画面 */
    .ep-editor { max-width:900px; width:100%; margin:16px auto; background:#fff; border-radius:10px; box-shadow:0 1px 4px rgba(0,0,0,.06); overflow:hidden; }
    .ep-editor-head { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid #eee; gap:12px; }
    .ep-editor-head-left { display:flex; align-items:center; gap:8px; }
    .ep-editor-name { border:1px solid #ddd; border-radius:4px; padding:6px 10px; font-size:13px; font-family:${T.font}; width:200px; }
    .ep-editor-tabs { display:flex; gap:0; border-bottom:1px solid #eee; }
    .ep-editor-tab { padding:10px 20px; font-size:13px; cursor:pointer; background:none; border:none; border-bottom:2px solid transparent; color:${T.sub}; font-family:${T.font}; }
    .ep-editor-tab.active { color:${T.primary}; border-bottom-color:${T.primary}; font-weight:600; }
    .ep-editor-body { padding:20px; min-height:200px; }
    .ep-field { margin-bottom:16px; }
    .ep-field label { display:block; font-size:12px; color:${T.sub}; margin-bottom:6px; }
    .ep-field input, .ep-field select { width:100%; padding:8px 10px; border:1px solid #ddd; border-radius:4px; font-size:13px; font-family:${T.font}; box-sizing:border-box; }
    .ep-field select { appearance:auto; }
    .ep-field textarea { width:100%; min-height:200px; padding:10px; border:1px solid #ddd; border-radius:4px; font-size:12px; font-family:monospace; box-sizing:border-box; resize:vertical; }
    .ep-row { display:flex; gap:12px; }
    .ep-row > .ep-field { flex:1; }
    .ep-toggle-row { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
    .ep-toggle-label { font-size:13px; }
    .ep-position-picker { width:200px; height:300px; background:#222; border-radius:6px; position:relative; cursor:crosshair; }
    .ep-position-dot { width:16px; height:16px; background:${T.primary}; border:2px solid #fff; border-radius:50%; position:absolute; transform:translate(-50%,-50%); box-shadow:0 1px 4px rgba(0,0,0,.3); pointer-events:none; }
    .ep-device-row { display:flex; align-items:center; gap:16px; padding:8px 0; border-bottom:1px solid #f0f0f0; }
    .ep-device-row:last-child { border-bottom:none; }
    .ep-device-name { font-size:13px; width:80px; font-weight:500; }
    .ep-html-tabs { display:flex; gap:0; margin-bottom:12px; }
    .ep-html-tab { padding:6px 14px; font-size:12px; cursor:pointer; background:#f5f5f5; border:1px solid #ddd; color:${T.sub}; font-family:${T.font}; }
    .ep-html-tab:first-child { border-radius:4px 0 0 4px; }
    .ep-html-tab:last-child { border-radius:0 4px 4px 0; }
    .ep-html-tab.active { background:${T.primary}; color:#fff; border-color:${T.primary}; }
    .ep-back-link { background:none; border:none; cursor:pointer; font-size:13px; color:${T.primary}; font-family:${T.font}; padding:0; }
    .ep-back-link:hover { text-decoration:underline; }

    /* ドロップダウンメニュー */
    .ep-dropdown { position:absolute; right:0; top:100%; background:#fff; border-radius:6px; box-shadow:0 4px 16px rgba(0,0,0,.15); z-index:100; min-width:140px; overflow:hidden; }
    .ep-dropdown-item { display:block; width:100%; padding:10px 14px; font-size:13px; text-align:left; cursor:pointer; background:none; border:none; font-family:${T.font}; color:${T.text}; }
    .ep-dropdown-item:hover { background:#f5f5f5; }
    .ep-dropdown-item.danger { color:#D0021B; }
  `
  document.head.append(s)
}

// ─── メインのrender関数 ─────────────────────────────

/** 現在の表示状態 */
interface PopupPageState {
  abTestUid: string
  folderUid: string
  popups: ExitPopup[]
  deliveryEnabled: boolean
  editingPopup: ExitPopup | null
  root: HTMLElement
}

export async function renderExitPopup(
  container: HTMLElement,
  abTestUid: string,
  generation?: number,
): Promise<void> {
  container.innerHTML = ''
  container.style.cssText = 'flex:1;min-width:0'

  const [{ ab_test }, { folders }, { exit_popups }] = await Promise.all([
    api.abTest(abTestUid),
    api.folders(),
    api.exitPopups(abTestUid),
  ])
  if (generation !== undefined && isStale(generation)) return

  const folder = folders.find((f) => f.id === ab_test.folder_id) ?? null
  const folderUid = folder?.uid ?? ''

  injectPopupCss()

  const root = el('div', { class: 'ep-root' })
  container.append(root)

  // タブバー・パンくず（共通部品）
  setupHorizTabs(root, 'popup', { abTestUid, folderUid })
  setupBreadcrumb(root, folder?.name ?? '', ab_test.title, folder?.uid)

  const state: PopupPageState = {
    abTestUid,
    folderUid,
    popups: exit_popups,
    deliveryEnabled: exit_popups.some((p) => p.enabled),
    editingPopup: null,
    root,
  }

  renderPanel(state)
}

// ─── 管理パネル（一覧画面） ─────────────────────────

function renderPanel(state: PopupPageState): void {
  // ep-root の中でタブバー・パンくず以外をクリアして再描画
  const existing = state.root.querySelector('.ep-panel, .ep-editor')
  if (existing !== null) existing.remove()

  const panel = el('div', { class: 'ep-panel' })

  // ── ヘッダ: 離脱防止 / 追従型タブ ──
  const head = el('div', { class: 'ep-panel-head' })
  const subtabs = el('div', { class: 'ep-subtabs' })
  const tabExit = el('div', { class: 'ep-subtab active', text: '離脱防止' })
  const tabFollow = el('div', { class: 'ep-subtab', text: '追従型' })
  subtabs.append(tabExit, tabFollow)

  tabExit.addEventListener('click', () => {
    tabExit.classList.add('active')
    tabFollow.classList.remove('active')
  })
  tabFollow.addEventListener('click', () => {
    tabFollow.classList.add('active')
    tabExit.classList.remove('active')
    toast('追従型ポップアップは未実装です', 'error')
  })

  // 配信トグル
  const delivery = el('div', { class: 'ep-delivery' })
  const deliveryLabel = el('span', { text: 'このVersionで配信' })
  const toggle = el('button', { class: `ep-toggle${state.deliveryEnabled ? ' on' : ''}` })
  toggle.addEventListener('click', () => {
    state.deliveryEnabled = !state.deliveryEnabled
    toggle.classList.toggle('on', state.deliveryEnabled)
  })
  delivery.append(deliveryLabel, toggle)
  head.append(subtabs, delivery)
  panel.append(head)

  // ── リストヘッダ ──
  const listHead = el('div', { class: 'ep-list-head' })
  const listTitle = el('h3', { text: '離脱防止一覧' })
  const addBtn = el('button', { class: 'ep-add-btn', html: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> 追加` })
  addBtn.addEventListener('click', () => openPresetModal(state))
  listHead.append(listTitle, addBtn)
  panel.append(listHead)

  // ── ポップアップ一覧 ──
  if (state.popups.length === 0) {
    panel.append(el('div', { class: 'ep-empty', text: 'ポップアップはまだ追加されていません。上の ＋追加 ボタンからプリセットを選択してください。' }))
  } else {
    for (const popup of state.popups) {
      panel.append(renderPopupCard(state, popup))
    }
  }

  state.root.append(panel)
}

function renderPopupCard(state: PopupPageState, popup: ExitPopup): HTMLElement {
  const card = el('div', { class: 'ep-card' })

  // サムネイル
  const thumb = el('div', { class: 'ep-card-thumb' })
  const preset = popup.preset_id !== null ? PRESETS.find((p) => p.id === popup.preset_id) : null
  if (preset !== null && preset !== undefined) {
    thumb.innerHTML = preset.thumbnailSvg
  } else {
    thumb.textContent = 'NO IMAGE'
  }
  card.append(thumb)

  // 情報
  const info = el('div', { class: 'ep-card-info' })
  info.append(el('p', { class: 'ep-card-name', text: popup.name }))
  const meta: string[] = []
  if (popup.animation !== '') meta.push(`アニメ: ${popup.animation}`)
  if (popup.scroll_trigger) meta.push(`スクロール: ${popup.scroll_position}%`)
  info.append(el('div', { class: 'ep-card-meta', text: meta.join(' / ') || '設定なし' }))
  card.append(info)

  // アクション
  const actions = el('div', { class: 'ep-card-actions' })

  // 割合
  const ratioWrap = el('div', { class: 'ep-card-ratio' })
  const ratioSelect = document.createElement('select')
  for (let i = 0; i <= 100; i += 10) {
    const opt = document.createElement('option')
    opt.value = String(i)
    opt.textContent = String(i)
    if (i === popup.ratio) opt.selected = true
    ratioSelect.append(opt)
  }
  ratioSelect.addEventListener('change', () => {
    const newRatio = Number(ratioSelect.value)
    void api.updateExitPopup(state.abTestUid, popup.uid, { ratio: newRatio }).then(
      () => { popup.ratio = newRatio },
      (err: unknown) => toast((err as Error).message, 'error'),
    )
  })
  ratioWrap.append(ratioSelect, el('span', { text: '%' }))
  actions.append(ratioWrap)

  // 配信トグル
  const itemToggle = el('button', { class: `ep-toggle${popup.enabled ? ' on' : ''}` })
  itemToggle.style.cssText = 'width:34px;height:18px'
  itemToggle.addEventListener('click', (e) => {
    e.stopPropagation()
    const newEnabled = !popup.enabled
    void api.updateExitPopup(state.abTestUid, popup.uid, { enabled: newEnabled }).then(
      () => {
        popup.enabled = newEnabled
        itemToggle.classList.toggle('on', newEnabled)
      },
      (err: unknown) => toast((err as Error).message, 'error'),
    )
  })
  actions.append(itemToggle)

  // ... メニュー
  const menuWrap = el('div', { style: 'position:relative' })
  const menuBtn = el('button', { class: 'ep-menu-btn', text: '⋯' })
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleDropdown(menuWrap, state, popup)
  })
  menuWrap.append(menuBtn)
  actions.append(menuWrap)

  card.append(actions)

  // カードクリック → 編集
  card.addEventListener('click', () => openEditor(state, popup))

  return card
}

function toggleDropdown(menuWrap: HTMLElement, state: PopupPageState, popup: ExitPopup): void {
  const existing = menuWrap.querySelector('.ep-dropdown')
  if (existing !== null) { existing.remove(); return }
  // 他のドロップダウンを閉じる
  for (const d of document.querySelectorAll('.ep-dropdown')) d.remove()

  const dropdown = el('div', { class: 'ep-dropdown' })

  const editBtn = el('button', { class: 'ep-dropdown-item', text: '編集' })
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.remove()
    openEditor(state, popup)
  })

  const previewBtn = el('button', { class: 'ep-dropdown-item', text: 'プレビュー' })
  previewBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.remove()
    previewPopup(popup)
  })

  const deleteBtn = el('button', { class: 'ep-dropdown-item danger', text: '削除' })
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.remove()
    if (!confirm('このポップアップを削除しますか？')) return
    void api.deleteExitPopup(state.abTestUid, popup.uid).then(
      () => {
        state.popups = state.popups.filter((p) => p.uid !== popup.uid)
        renderPanel(state)
        toast('ポップアップを削除しました')
      },
      (err: unknown) => toast((err as Error).message, 'error'),
    )
  })

  dropdown.append(editBtn, previewBtn, deleteBtn)
  menuWrap.append(dropdown)

  // 外側クリックで閉じる
  const close = (e: MouseEvent): void => {
    if (!menuWrap.contains(e.target as Node)) {
      dropdown.remove()
      document.removeEventListener('click', close)
    }
  }
  setTimeout(() => document.addEventListener('click', close), 0)
}

// ─── プリセット選択モーダル ──────────────────────────

function openPresetModal(state: PopupPageState): void {
  const overlay = el('div', { class: 'ep-modal-overlay' })
  const modal = el('div', { class: 'ep-modal' })

  // ヘッダ
  const head = el('div', { class: 'ep-modal-head' })
  head.append(el('h2', { text: 'ポップアップを追加' }))
  const closeBtn = el('button', { class: 'ep-modal-close', text: '✕' })
  closeBtn.addEventListener('click', () => overlay.remove())
  head.append(closeBtn)
  modal.append(head)

  // タブ
  const tabs = el('div', { class: 'ep-modal-tabs' })
  const tabPreset = el('button', { class: 'ep-modal-tab active', text: 'プリセット' })
  const tabNew = el('button', { class: 'ep-modal-tab', text: '＋ 新規ポップアップ作成' })
  tabs.append(tabPreset, tabNew)
  modal.append(tabs)

  // プリセットグリッド
  const grid = el('div', { class: 'ep-preset-grid' })
  for (const preset of PRESETS) {
    grid.append(renderPresetCard(state, preset, overlay))
  }
  modal.append(grid)

  // 新規作成タブ切替
  tabNew.addEventListener('click', () => {
    overlay.remove()
    createBlankPopup(state)
  })

  overlay.append(modal)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
  document.body.append(overlay)
}

function renderPresetCard(
  state: PopupPageState,
  preset: PopupPreset,
  overlay: HTMLElement,
): HTMLElement {
  const card = el('div', { class: 'ep-preset-card' })

  const thumb = el('div', { class: 'ep-preset-thumb' })
  thumb.innerHTML = preset.thumbnailSvg
  card.append(thumb)

  const info = el('div', { class: 'ep-preset-info' })
  info.append(el('p', { class: 'ep-preset-name', text: preset.name }))

  const addBtn = el('button', { class: 'ep-preset-add', text: '追加' })
  info.append(addBtn)
  card.append(info)

  // カード全体をクリック可能にする（ボタンだけでなくサムネ・名前どこでも押せる）
  let adding = false
  function doAdd(): void {
    if (adding) return
    adding = true
    addBtn.disabled = true
    addBtn.textContent = '追加中…'
    void api.createExitPopup(state.abTestUid, {
      name: preset.name,
      preset_id: preset.id,
      html: preset.defaultHtml,
      javascript: preset.defaultJavascript,
      animation: preset.defaults.animation ?? 'fade',
      scroll_trigger: preset.defaults.scroll_trigger ?? false,
      scroll_position: preset.defaults.scroll_position ?? 50,
      countdown_trigger: preset.defaults.countdown_trigger ?? false,
      countdown_seconds: preset.defaults.countdown_seconds ?? 0,
    }).then(
      ({ exit_popup }) => {
        state.popups = [...state.popups, exit_popup]
        overlay.remove()
        renderPanel(state)
        toast(`「${preset.name}」を追加しました`)
      },
      (err: unknown) => {
        adding = false
        addBtn.disabled = false
        addBtn.textContent = '追加'
        toast((err as Error).message, 'error')
      },
    )
  }
  card.addEventListener('click', doAdd)

  return card
}

function createBlankPopup(state: PopupPageState): void {
  void api.createExitPopup(state.abTestUid, {
    name: '新規ポップアップ',
    html: '<div class="popup-wrap"><p>ポップアップの内容をここに記述</p></div>',
  }).then(
    ({ exit_popup }) => {
      state.popups = [...state.popups, exit_popup]
      renderPanel(state)
      toast('新規ポップアップを作成しました')
      openEditor(state, exit_popup)
    },
    (err: unknown) => toast((err as Error).message, 'error'),
  )
}

// ─── ポップアップ編集画面 ───────────────────────────

type EditorTab = 'basic' | 'display' | 'position' | 'device' | 'html'

const EDITOR_TABS: readonly { id: EditorTab; label: string }[] = [
  { id: 'basic', label: '基本' },
  { id: 'display', label: '表示' },
  { id: 'position', label: '位置' },
  { id: 'device', label: '出し分け' },
  { id: 'html', label: 'HTML' },
]

function openEditor(state: PopupPageState, popup: ExitPopup): void {
  // パネルを隠してエディタを出す
  const panel = state.root.querySelector('.ep-panel')
  if (panel !== null) panel.remove()
  const existingEditor = state.root.querySelector('.ep-editor')
  if (existingEditor !== null) existingEditor.remove()

  // 編集用のコピー（保存まで元データを壊さない）
  const draft = { ...popup }

  const editor = el('div', { class: 'ep-editor' })

  // ── ヘッダ ──
  const head = el('div', { class: 'ep-editor-head' })
  const headLeft = el('div', { class: 'ep-editor-head-left' })
  const backLink = el('button', { class: 'ep-back-link', text: '← 一覧に戻る' })
  backLink.addEventListener('click', () => {
    editor.remove()
    renderPanel(state)
  })
  headLeft.append(backLink)

  const nameInput = document.createElement('input') as HTMLInputElement
  nameInput.className = 'ep-editor-name'
  nameInput.value = draft.name
  nameInput.addEventListener('input', () => { draft.name = nameInput.value })
  headLeft.append(nameInput)
  head.append(headLeft)

  // 保存ボタン群
  const headRight = el('div', { style: 'display:flex;gap:8px;align-items:center' })
  const previewBtn = button('プレビュー', 'ghost')
  previewBtn.style.fontSize = '12px'
  previewBtn.style.padding = '6px 12px'
  previewBtn.addEventListener('click', () => previewPopup(draft))

  const saveBtn = button('保存')
  saveBtn.style.fontSize = '12px'
  saveBtn.style.padding = '6px 12px'
  saveBtn.addEventListener('click', () => {
    saveBtn.disabled = true
    saveBtn.textContent = '保存中…'
    const { id: _id, uid: _uid, ab_test_id: _abid, ...patch } = draft
    void api.updateExitPopup(state.abTestUid, popup.uid, patch).then(
      ({ exit_popup }) => {
        // state のポップアップリストを更新
        state.popups = state.popups.map((p) => (p.uid === popup.uid ? exit_popup : p))
        Object.assign(popup, exit_popup)
        saveBtn.disabled = false
        saveBtn.textContent = '保存'
        toast('ポップアップを保存しました')
      },
      (err: unknown) => {
        saveBtn.disabled = false
        saveBtn.textContent = '保存'
        toast((err as Error).message, 'error')
      },
    )
  })

  // 配信トグル
  const editorToggle = el('button', { class: `ep-toggle${draft.enabled ? ' on' : ''}` })
  editorToggle.addEventListener('click', () => {
    draft.enabled = !draft.enabled
    editorToggle.classList.toggle('on', draft.enabled)
  })

  headRight.append(previewBtn, saveBtn, editorToggle)
  head.append(headRight)
  editor.append(head)

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
    case 'html': renderHtmlTab(body, draft); break
  }
}

// ── 基本タブ ──

function renderBasicTab(body: HTMLElement, draft: ExitPopup): void {
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
  // リンク
  body.append(makeTextField('リンク', draft.link_url, (v) => { draft.link_url = v }, 'https://example.com'))
}

// ── 表示タブ ──

function renderDisplayTab(body: HTMLElement, draft: ExitPopup): void {
  // 表示アニメーション
  const animField = el('div', { class: 'ep-field' })
  animField.append(el('label', { text: '表示アニメーション' }))
  const animSelect = document.createElement('select')
  for (const opt of ['fade', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'zoomIn', 'bounceIn', 'elastic', 'flipIn', 'none']) {
    const o = document.createElement('option')
    o.value = opt
    o.textContent = opt
    if (opt === draft.animation) o.selected = true
    animSelect.append(o)
  }
  animSelect.addEventListener('change', () => { draft.animation = animSelect.value })
  animField.append(animSelect)
  body.append(animField)

  // 秒数
  body.append(makeNumberField('表示までの秒数', draft.delay_seconds, (v) => { draft.delay_seconds = v }))

  // スクロールで表示
  const scrollRow = el('div', { class: 'ep-toggle-row' })
  const scrollToggle = el('button', { class: `ep-toggle${draft.scroll_trigger ? ' on' : ''}` })
  scrollToggle.addEventListener('click', () => {
    draft.scroll_trigger = !draft.scroll_trigger
    scrollToggle.classList.toggle('on', draft.scroll_trigger)
    scrollSlider.disabled = !draft.scroll_trigger
  })
  scrollRow.append(scrollToggle, el('span', { class: 'ep-toggle-label', text: 'スクロールで表示' }))
  body.append(scrollRow)

  // スクロール位置スライダー
  const scrollField = el('div', { class: 'ep-field' })
  scrollField.append(el('label', { text: `スクロール位置: ${draft.scroll_position}%` }))
  const scrollSlider = document.createElement('input')
  scrollSlider.type = 'range'
  scrollSlider.min = '0'
  scrollSlider.max = '100'
  scrollSlider.value = String(draft.scroll_position)
  scrollSlider.disabled = !draft.scroll_trigger
  scrollSlider.style.cssText = 'width:100%'
  scrollSlider.addEventListener('input', () => {
    draft.scroll_position = Number(scrollSlider.value)
    const label = scrollField.querySelector('label')
    if (label !== null) label.textContent = `スクロール位置: ${draft.scroll_position}%`
  })
  scrollField.append(scrollSlider)
  body.append(scrollField)

  // カウントダウンで表示
  const cdRow = el('div', { class: 'ep-toggle-row' })
  const cdToggle = el('button', { class: `ep-toggle${draft.countdown_trigger ? ' on' : ''}` })
  cdToggle.addEventListener('click', () => {
    draft.countdown_trigger = !draft.countdown_trigger
    cdToggle.classList.toggle('on', draft.countdown_trigger)
  })
  cdRow.append(cdToggle, el('span', { class: 'ep-toggle-label', text: 'カウントダウンで表示' }))
  body.append(cdRow)

  body.append(makeNumberField('カウントダウン秒数', draft.countdown_seconds, (v) => { draft.countdown_seconds = v }))
}

// ── 位置タブ ──

function renderPositionTab(body: HTMLElement, draft: ExitPopup): void {
  body.append(el('div', { class: 'ep-field' }, [el('label', { text: 'ポップアップの表示位置（クリックで変更）' })]))

  const picker = el('div', { class: 'ep-position-picker' })
  const dot = el('div', { class: 'ep-position-dot' })
  dot.style.left = `${draft.position_x}%`
  dot.style.top = `${draft.position_y}%`
  picker.append(dot)

  picker.addEventListener('click', (e) => {
    const rect = picker.getBoundingClientRect()
    draft.position_x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    draft.position_y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    dot.style.left = `${draft.position_x}%`
    dot.style.top = `${draft.position_y}%`
    posLabel.textContent = `位置: X=${draft.position_x}%, Y=${draft.position_y}%`
  })

  body.append(picker)
  const posLabel = el('div', {
    style: `font-size:12px;color:${T.sub};margin-top:8px`,
    text: `位置: X=${draft.position_x}%, Y=${draft.position_y}%`,
  })
  body.append(posLabel)
}

// ── 出し分けタブ ──

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

// ── HTMLタブ ──

function renderHtmlTab(body: HTMLElement, draft: ExitPopup): void {
  type HtmlSubTab = 'html' | 'javascript' | 'head_tag' | 'body_tag'
  const subTabs: { id: HtmlSubTab; label: string }[] = [
    { id: 'html', label: 'HTML' },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'head_tag', label: 'HeadTag' },
    { id: 'body_tag', label: 'BodyTag' },
  ]

  let activeSubTab: HtmlSubTab = 'html'
  const tabBar = el('div', { class: 'ep-html-tabs' })
  const editorArea = el('div')

  function renderSubTab(): void {
    editorArea.innerHTML = ''
    const textarea = document.createElement('textarea')
    textarea.className = 'ep-field'
    textarea.style.cssText = 'width:100%;min-height:300px;padding:10px;border:1px solid #ddd;border-radius:4px;font-size:12px;font-family:monospace;box-sizing:border-box;resize:vertical'
    textarea.value = draft[activeSubTab]
    textarea.addEventListener('input', () => {
      // activeSubTab は 'html' | 'javascript' | 'head_tag' | 'body_tag' のいずれか
      // TypeScriptのindex signatureの制約回避: 個別に代入する
      if (activeSubTab === 'html') draft.html = textarea.value
      else if (activeSubTab === 'javascript') draft.javascript = textarea.value
      else if (activeSubTab === 'head_tag') draft.head_tag = textarea.value
      else if (activeSubTab === 'body_tag') draft.body_tag = textarea.value
    })
    editorArea.append(textarea)
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

// ─── プレビュー ─────────────────────────────────────

function previewPopup(popup: ExitPopup | Partial<ExitPopup>): void {
  const overlay = el('div', {
    style: `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;
      display:flex;align-items:center;justify-content:center;font-family:${T.font}`,
  })

  const frame = el('div', { style: 'max-width:500px;max-height:80vh;overflow:auto' })
  frame.innerHTML = popup.html ?? '<p>プレビューできるHTMLがありません</p>'
  overlay.append(frame)

  const closeHint = el('div', {
    text: 'クリックで閉じる',
    style: 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:#fff;font-size:13px;opacity:.7',
  })
  overlay.append(closeHint)

  overlay.addEventListener('click', () => overlay.remove())
  document.body.append(overlay)
}

// ─── ヘルパー ───────────────────────────────────────

function makeTextField(
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

function makeNumberField(
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
