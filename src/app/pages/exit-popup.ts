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
import { api, type ExitPopup, type FollowPopup } from '../api.ts'
import { isStale } from '../main.ts'
import { T, el, button, toast } from '../ui.ts'
import { setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'
import { PRESETS, type PopupPreset } from './exit-popup-presets.ts'
import { highlight } from '../panels/syntax-highlight.ts'
import { FOLLOW_PRESETS, type FollowPreset } from './follow-popup-presets.ts'

// ─── CSS注入 ────────────────────────────────────────

function injectPopupCss(): void {
  if (document.getElementById('sb-exit-popup-css') !== null) return
  const s = document.createElement('style')
  s.id = 'sb-exit-popup-css'
  s.textContent = `
    .ep-root { display:flex; flex-direction:column; flex:1; min-width:0; font-family:${T.font}; color:${T.text}; background:#f9f9fb; }
    /* ── 管理パネル（モーダル風オーバーレイ） ── */
    .ep-panel { position:fixed; inset:0; z-index:8000; background:rgba(0,0,0,.15); display:flex; align-items:center; justify-content:center; font-family:${T.font}; }
    .ep-panel-inner { background:#fff; border-radius:10px; width:820px; max-width:92vw; max-height:85vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,.12); }
    .ep-panel-head { display:flex; align-items:center; padding:16px 20px; border-bottom:1px solid #eee; position:relative; }
    .ep-panel-close { background:none; border:none; cursor:pointer; font-size:13px; color:${T.sub}; font-family:${T.font}; padding:0; }
    .ep-panel-close:hover { color:${T.text}; }
    .ep-panel-title { position:absolute; left:50%; transform:translateX(-50%); font-size:15px; font-weight:600; }
    .ep-subtabs { display:flex; gap:0; padding:0 20px; }
    .ep-subtab { padding:10px 16px; font-size:13px; cursor:pointer; border:none; border-bottom:2px solid transparent; background:none; color:${T.sub}; font-family:${T.font}; }
    .ep-subtab.active { color:${T.text}; border-bottom-color:${T.text}; font-weight:600; }
    .ep-delivery { display:flex; align-items:center; justify-content:space-between; padding:12px 20px; border-bottom:1px solid #f0f0f0; }
    .ep-delivery-label { font-size:13px; color:${T.text}; }
    .ep-toggle { width:40px; height:22px; border-radius:11px; background:#ccc; position:relative; cursor:pointer; transition:background .2s; border:none; padding:0; flex-shrink:0; }
    .ep-toggle.on { background:${T.primary}; }
    .ep-toggle::after { content:''; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition:left .2s; box-shadow:0 1px 2px rgba(0,0,0,.2); }
    .ep-toggle.on::after { left:20px; }
    .ep-list-head { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; }
    .ep-list-head h3 { font-size:14px; font-weight:600; margin:0; }
    .ep-add-btn { display:flex; align-items:center; gap:4px; font-size:13px; color:${T.primary}; cursor:pointer; background:none; border:none; font-family:${T.font}; }
    .ep-add-btn:hover { text-decoration:underline; }
    .ep-empty { padding:40px 20px; text-align:center; color:${T.sub}; font-size:13px; }
    .ep-card-grid { display:flex; flex-wrap:wrap; gap:16px; padding:4px 20px 20px; overflow-y:auto; flex:1; min-height:0; }
    .ep-card { width:180px; border:1px solid #e8e8e8; border-radius:8px; overflow:hidden; cursor:pointer; transition:box-shadow .15s; position:relative; background:#fff; }
    .ep-card:hover { box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .ep-card-thumb { width:100%; aspect-ratio:16/11; background:#f5f5f5; display:flex; align-items:center; justify-content:center; color:${T.sub}; font-size:11px; overflow:hidden; }
    .ep-card-body { padding:10px 12px; }
    .ep-card-name { font-size:12px; font-weight:500; margin:0 0 8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ep-card-footer { display:flex; align-items:center; justify-content:space-between; }
    .ep-card-ratio { font-size:11px; color:${T.sub}; display:flex; align-items:center; gap:4px; }
    .ep-card-menu { position:absolute; top:6px; right:6px; background:rgba(255,255,255,.9); border:none; cursor:pointer; font-size:18px; color:${T.sub}; padding:2px 6px; border-radius:4px; line-height:1; }
    .ep-card-menu:hover { background:#f0f0f0; }

    /* プリセットモーダル */
    .ep-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:9000; display:flex; align-items:center; justify-content:center; font-family:${T.font}; }
    .ep-modal { background:#fff; border-radius:10px; width:680px; max-width:92vw; max-height:85vh; display:flex; flex-direction:column; overflow:hidden; }
    .ep-modal-head { display:flex; align-items:center; padding:14px 18px; border-bottom:1px solid #eee; position:relative; }
    .ep-modal-head h2 { font-size:15px; margin:0; font-weight:600; position:absolute; left:50%; transform:translateX(-50%); white-space:nowrap; }
    .ep-modal-close { background:none; border:none; cursor:pointer; font-size:13px; color:${T.sub}; font-family:${T.font}; padding:0; }
    .ep-modal-close:hover { color:${T.text}; }
    .ep-modal-search { padding:12px 18px; }
    .ep-modal-search input { width:100%; padding:8px 12px 8px 32px; border:1px solid #ddd; border-radius:6px; font-size:13px; font-family:${T.font}; background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") 10px center no-repeat; box-sizing:border-box; }
    .ep-modal-toolbar { display:flex; align-items:center; padding:0 18px 0; gap:12px; border-bottom:1px solid #eee; }
    .ep-modal-tabs { display:flex; gap:0; }
    .ep-modal-tab { padding:10px 16px; font-size:13px; cursor:pointer; border-bottom:2px solid transparent; color:${T.sub}; background:none; border:none; border-bottom:2px solid transparent; font-family:${T.font}; }
    .ep-modal-tab.active { color:${T.text}; border-bottom-color:${T.text}; font-weight:600; }
    .ep-modal-new { margin-left:auto; font-size:12px; color:${T.primary}; background:none; border:none; cursor:pointer; font-family:${T.font}; white-space:nowrap; padding:10px 0; }
    .ep-modal-new:hover { text-decoration:underline; }
    .ep-preset-list { flex:1; overflow-y:auto; }
    .ep-preset-item { display:flex; align-items:center; gap:14px; padding:14px 18px; border-bottom:1px solid #f0f0f0; }
    .ep-preset-item:hover { background:#fafafa; }
    .ep-preset-thumb { width:100px; height:70px; background:#f5f5f5; border-radius:6px; flex-shrink:0; overflow:hidden; display:flex; align-items:center; justify-content:center; }
    .ep-preset-info { flex:1; min-width:0; }
    .ep-preset-name { font-size:13px; font-weight:600; margin:0 0 6px; line-height:1.4; }
    .ep-preset-detail { font-size:11px; color:${T.sub}; line-height:1.6; }
    .ep-preset-detail span { margin-right:16px; }
    .ep-preset-add { padding:6px 16px; font-size:12px; background:${T.primary}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-family:${T.font}; flex-shrink:0; white-space:nowrap; }
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
    .ep-html-tabs { display:flex; gap:0; margin-bottom:0; }
    .ep-html-tab { padding:8px 16px; font-size:12px; cursor:pointer; background:#2B2B2B; border:none; border-bottom:2px solid transparent; color:#888; font-family:${T.font}; }
    .ep-html-tab:first-child { border-radius:0; }
    .ep-html-tab:last-child { border-radius:0; }
    .ep-html-tab:hover { color:#ccc; }
    .ep-html-tab.active { color:#fff; border-bottom-color:#1976d2; }
    .ep-html-code-wrap { background:#151515; border-radius:0 0 4px 4px; overflow:hidden; }
    .ep-html-code-inner { display:flex; min-height:300px; }
    .ep-html-gutter { width:40px; background:#151515; border-right:1px solid #333; padding:10px 6px 10px 0; text-align:right; font:12px/1.6 "SF Mono",Menlo,monospace; color:#555; user-select:none; flex-shrink:0; overflow:hidden; }
    .ep-html-textarea { position:relative; z-index:1; width:100%; height:100%; border:none; resize:none; padding:10px 12px; font:12px/1.6 "SF Mono",Menlo,monospace; color:transparent; caret-color:#eeffff; background:transparent; outline:none; white-space:pre; tab-size:2; box-sizing:border-box; }
    .ep-html-editor-box { flex:1; position:relative; overflow:auto; min-height:0; background:#151515; }
    .ep-html-highlight { position:absolute; inset:0; margin:0; padding:10px 12px; font:12px/1.6 "SF Mono",Menlo,monospace; white-space:pre; pointer-events:none; overflow:hidden; tab-size:2; word-wrap:normal; }
    .ep-back-link { background:none; border:none; cursor:pointer; font-size:13px; color:${T.primary}; font-family:${T.font}; padding:0; }
    .ep-back-link:hover { text-decoration:underline; }

    /* ドロップダウンメニュー */
    .ep-dropdown { position:absolute; right:8px; top:32px; background:#fff; border-radius:6px; box-shadow:0 4px 16px rgba(0,0,0,.15); z-index:100; min-width:160px; overflow:hidden; }
    .ep-dropdown-item { display:flex; align-items:center; width:100%; padding:10px 14px; font-size:13px; text-align:left; cursor:pointer; background:none; border:none; font-family:${T.font}; color:${T.text}; gap:8px; }
    .ep-dropdown-item:hover { background:#f5f5f5; }
    .ep-dropdown-item.danger { color:#D0021B; }
  `
  document.head.append(s)
}

// ─── メインのrender関数 ─────────────────────────────

/** 現在のサブタブ */
type SubTab = 'exit' | 'follow'

/** 現在の表示状態 */
interface PopupPageState {
  abTestUid: string
  folderUid: string
  popups: ExitPopup[]
  followPopups: FollowPopup[]
  deliveryEnabled: boolean
  editingPopup: ExitPopup | null
  activeSubTab: SubTab
  root: HTMLElement
}

export async function renderExitPopup(
  container: HTMLElement,
  abTestUid: string,
  generation?: number,
): Promise<void> {
  container.innerHTML = ''
  container.style.cssText = 'flex:1;min-width:0'

  const [{ ab_test }, { folders }, { exit_popups }, { follow_popups }] = await Promise.all([
    api.abTest(abTestUid),
    api.folders(),
    api.exitPopups(abTestUid),
    api.followPopups(abTestUid),
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
    followPopups: follow_popups,
    deliveryEnabled: exit_popups.some((p) => p.enabled),
    editingPopup: null,
    activeSubTab: 'exit',
    root,
  }

  renderPanel(state)
}

// ─── 管理パネル（一覧画面） ─────────────────────────

function renderPanel(state: PopupPageState): void {
  // 既存のパネルを除去して再描画
  const existing = state.root.querySelector('.ep-panel, .ep-editor')
  if (existing !== null) existing.remove()

  const panel = el('div', { class: 'ep-panel' })
  const inner = el('div', { class: 'ep-panel-inner' })

  // ── ヘッダ: 閉じる + タイトル ──
  const head = el('div', { class: 'ep-panel-head' })
  const closeBtn = el('button', { class: 'ep-panel-close', text: '閉じる' })
  closeBtn.addEventListener('click', () => panel.remove())
  head.append(closeBtn)
  head.append(el('span', { class: 'ep-panel-title', text: 'ポップアップ' }))
  inner.append(head)

  // ── サブタブ: 離脱防止 / 追従型 ──
  const subtabs = el('div', { class: 'ep-subtabs' })
  const isExit = state.activeSubTab === 'exit'
  const tabExit = el('button', { class: `ep-subtab${isExit ? ' active' : ''}`, text: '離脱防止' })
  const tabFollow = el('button', { class: `ep-subtab${!isExit ? ' active' : ''}`, text: '追従型' })
  subtabs.append(tabExit, tabFollow)
  inner.append(subtabs)

  tabExit.addEventListener('click', () => {
    if (state.activeSubTab === 'exit') return
    state.activeSubTab = 'exit'
    renderPanel(state)
  })
  tabFollow.addEventListener('click', () => {
    if (state.activeSubTab === 'follow') return
    state.activeSubTab = 'follow'
    renderPanel(state)
  })

  // ── 配信トグル ──
  const delivery = el('div', { class: 'ep-delivery' })
  const deliveryLabel = el('span', { class: 'ep-delivery-label', text: 'このVersionで配信' })
  const toggle = el('button', { class: `ep-toggle${state.deliveryEnabled ? ' on' : ''}` })
  toggle.addEventListener('click', () => {
    state.deliveryEnabled = !state.deliveryEnabled
    toggle.classList.toggle('on', state.deliveryEnabled)
  })
  delivery.append(deliveryLabel, toggle)
  inner.append(delivery)

  if (state.activeSubTab === 'exit') {
    renderExitList(inner, state)
  } else {
    renderFollowList(inner, state)
  }

  panel.append(inner)
  // パネル背景クリックで閉じる
  panel.addEventListener('click', (e) => {
    if (e.target === panel) panel.remove()
  })
  state.root.append(panel)
}

/** 離脱防止タブの一覧 */
function renderExitList(container: HTMLElement, state: PopupPageState): void {
  const listHead = el('div', { class: 'ep-list-head' })
  const listTitle = el('h3', { text: '離脱防止一覧' })
  const addBtn = el('button', { class: 'ep-add-btn', html: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> 追加` })
  addBtn.addEventListener('click', () => openPresetModal(state))
  listHead.append(listTitle, addBtn)
  container.append(listHead)

  if (state.popups.length === 0) {
    container.append(el('div', { class: 'ep-empty', text: 'ポップアップがまだ設定されていません。上にある「+追加」ボタンから選択してみましょう。' }))
  } else {
    const grid = el('div', { class: 'ep-card-grid' })
    for (const popup of state.popups) {
      grid.append(renderPopupCard(state, popup))
    }
    container.append(grid)
  }
}

/** 追従型タブの一覧 */
function renderFollowList(container: HTMLElement, state: PopupPageState): void {
  const listHead = el('div', { class: 'ep-list-head' })
  const listTitle = el('h3', { text: '追従型一覧' })
  const addBtn = el('button', { class: 'ep-add-btn', html: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> 追加` })
  addBtn.addEventListener('click', () => openFollowPresetModal(state))
  listHead.append(listTitle, addBtn)
  container.append(listHead)

  if (state.followPopups.length === 0) {
    container.append(el('div', { class: 'ep-empty', text: 'ポップアップがまだ設定されていません。上にある「+追加」ボタンから選択してみましょう。' }))
  } else {
    const grid = el('div', { class: 'ep-card-grid' })
    for (const fp of state.followPopups) {
      grid.append(renderFollowCard(state, fp))
    }
    container.append(grid)
  }
}

function renderPopupCard(state: PopupPageState, popup: ExitPopup): HTMLElement {
  const card = el('div', { class: 'ep-card' })

  // ⋯ メニューボタン（サムネイル右上に配置）
  const menuBtn = el('button', { class: 'ep-card-menu', text: '⋯' })
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleDropdown(card, state, popup)
  })
  card.append(menuBtn)

  // サムネイル
  const thumb = el('div', { class: 'ep-card-thumb' })
  const preset = popup.preset_id !== null ? PRESETS.find((p) => p.id === popup.preset_id) : null
  if (preset !== null && preset !== undefined) {
    thumb.innerHTML = preset.thumbnailSvg
  } else {
    thumb.textContent = 'NO IMAGE'
  }
  card.append(thumb)

  // カード下部
  const body = el('div', { class: 'ep-card-body' })
  body.append(el('p', { class: 'ep-card-name', text: popup.name }))

  const footer = el('div', { class: 'ep-card-footer' })

  // 割合
  const ratioWrap = el('div', { class: 'ep-card-ratio' })
  ratioWrap.append(el('span', { text: `割合 : ${popup.ratio}` }))
  footer.append(ratioWrap)

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
  footer.append(itemToggle)

  body.append(footer)
  card.append(body)

  // カードクリック → 編集
  card.addEventListener('click', () => openEditor(state, popup))

  return card
}

function toggleDropdown(cardEl: HTMLElement, state: PopupPageState, popup: ExitPopup): void {
  const existing = cardEl.querySelector('.ep-dropdown')
  if (existing !== null) { existing.remove(); return }
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

  const deleteBtn = el('button', { class: 'ep-dropdown-item danger', html: `削除 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>` })
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
  cardEl.append(dropdown)

  const close = (e: MouseEvent): void => {
    if (!cardEl.contains(e.target as Node)) {
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

  // ヘッダ（閉じる + センタータイトル）
  const head = el('div', { class: 'ep-modal-head' })
  const closeBtn = el('button', { class: 'ep-modal-close', text: '閉じる' })
  closeBtn.addEventListener('click', () => overlay.remove())
  head.append(closeBtn)
  head.append(el('h2', { text: 'ポップアップ追加（離脱防止）' }))
  modal.append(head)

  // 検索バー
  const searchWrap = el('div', { class: 'ep-modal-search' })
  const searchInput = document.createElement('input')
  searchInput.type = 'text'
  searchInput.placeholder = '入力してください'
  searchWrap.append(searchInput)
  modal.append(searchWrap)

  // ツールバー（タブ + 新規作成）
  const toolbar = el('div', { class: 'ep-modal-toolbar' })
  const tabs = el('div', { class: 'ep-modal-tabs' })
  const tabPreset = el('button', { class: 'ep-modal-tab active', text: 'プリセット' })
  const tabCopy = el('button', { class: 'ep-modal-tab', text: '複製' })
  tabs.append(tabPreset, tabCopy)
  toolbar.append(tabs)
  const newBtn = el('button', { class: 'ep-modal-new', text: '+ 新規ポップアップ作成' })
  newBtn.addEventListener('click', () => {
    overlay.remove()
    createBlankPopup(state)
  })
  toolbar.append(newBtn)
  modal.append(toolbar)

  // プリセットリスト
  const list = el('div', { class: 'ep-preset-list' })
  for (const preset of PRESETS) {
    list.append(renderPresetItem(state, preset, overlay))
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

  // 複製タブ（空状態）
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
    for (const preset of PRESETS) {
      list.append(renderPresetItem(state, preset, overlay))
    }
  })

  overlay.append(modal)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
  document.body.append(overlay)
}

function renderPresetItem(
  state: PopupPageState,
  preset: PopupPreset,
  overlay: HTMLElement,
): HTMLElement {
  const item = el('div', { class: 'ep-preset-item' })

  // サムネイル
  const thumb = el('div', { class: 'ep-preset-thumb' })
  thumb.innerHTML = preset.thumbnailSvg
  item.append(thumb)

  // 情報（名前 + 詳細）
  const info = el('div', { class: 'ep-preset-info' })
  info.append(el('p', { class: 'ep-preset-name', text: preset.name }))
  const details = el('div', { class: 'ep-preset-detail' })
  const scrollPos = preset.defaults.scroll_position ?? 50
  const scrollText = preset.defaults.scroll_trigger ? `${scrollPos}%到達後0秒で表示` : '2%到達後0秒で表示'
  const animText = preset.defaults.animation ?? 'fade'
  details.innerHTML = `<span>スクロール位置　　${scrollText}</span><br><span>出現アニメーション　　${animText}</span><br><span>出現場所　　中央</span>`
  info.append(details)
  item.append(info)

  // 追加ボタン
  const addBtn = el('button', { class: 'ep-preset-add', text: '追加' })
  let adding = false
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation()
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
  })
  item.append(addBtn)

  return item
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
  // モーダルパネルとエディタを除去してから再描画
  for (const p of state.root.querySelectorAll('.ep-panel')) p.remove()
  for (const e of state.root.querySelectorAll('.ep-editor')) e.remove()

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

    const sync = (): void => {
      if (activeSubTab === 'html') draft.html = textarea.value
      else if (activeSubTab === 'javascript') draft.javascript = textarea.value
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

// ─── プレビュー ─────────────────────────────────────

function previewPopup(popup: ExitPopup | Partial<ExitPopup>): void {
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
    style: 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:#fff;font-size:13px;opacity:.7',
  })
  overlay.append(closeHint)

  overlay.addEventListener('click', (e) => {
    // frame 内のクリック（ボタン等）は閉じない
    if (frame.contains(e.target as Node)) return
    overlay.remove()
    styleEl.remove()
  })
  document.body.append(overlay)

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

// ─── 追従型ポップアップ ─────────────────────────────

function renderFollowCard(state: PopupPageState, fp: FollowPopup): HTMLElement {
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

function toggleFollowDropdown(cardEl: HTMLElement, state: PopupPageState, fp: FollowPopup): void {
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
    if (!confirm('この追従型ポップアップを削除しますか？')) return
    void api.deleteFollowPopup(state.abTestUid, fp.uid).then(
      () => {
        state.followPopups = state.followPopups.filter((p) => p.uid !== fp.uid)
        renderPanel(state)
        toast('追従型ポップアップを削除しました')
      },
      (err: unknown) => toast((err as Error).message, 'error'),
    )
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

// ─── 追従型プリセット選択モーダル ─────────────────────

function openFollowPresetModal(state: PopupPageState): void {
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

function renderFollowPresetItem(
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
  })
  item.append(addBtn)

  return item
}

function createBlankFollowPopup(state: PopupPageState): void {
  void api.createFollowPopup(state.abTestUid, {
    name: '新規追従型ポップアップ',
    html: '<div style="padding:12px 20px;background:#333;color:#fff;font-family:sans-serif;text-align:center;font-size:13px">追従型ポップアップの内容</div>',
    position: 'bottom',
  }).then(
    ({ follow_popup }) => {
      state.followPopups = [...state.followPopups, follow_popup]
      renderPanel(state)
      toast('新規追従型ポップアップを作成しました')
      openFollowEditor(state, follow_popup)
    },
    (err: unknown) => toast((err as Error).message, 'error'),
  )
}

// ─── 追従型ポップアップ編集画面 ─────────────────────

type FollowEditorTab = 'settings' | 'device' | 'html'

const FOLLOW_EDITOR_TABS: readonly { id: FollowEditorTab; label: string }[] = [
  { id: 'settings', label: '表示設定' },
  { id: 'device', label: '出し分け' },
  { id: 'html', label: 'HTML' },
]

function openFollowEditor(state: PopupPageState, fp: FollowPopup): void {
  for (const p of state.root.querySelectorAll('.ep-panel')) p.remove()
  for (const e of state.root.querySelectorAll('.ep-editor')) e.remove()

  const draft = { ...fp }

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

  const headRight = el('div', { style: 'display:flex;gap:8px;align-items:center' })
  const previewBtn = button('プレビュー', 'ghost')
  previewBtn.style.fontSize = '12px'
  previewBtn.style.padding = '6px 12px'
  previewBtn.addEventListener('click', () => previewFollowPopup(draft))

  const saveBtn = button('保存')
  saveBtn.style.fontSize = '12px'
  saveBtn.style.padding = '6px 12px'
  saveBtn.addEventListener('click', () => {
    saveBtn.disabled = true
    saveBtn.textContent = '保存中…'
    const { id: _id, uid: _uid, ab_test_id: _abid, ...patch } = draft
    void api.updateFollowPopup(state.abTestUid, fp.uid, patch).then(
      ({ follow_popup }) => {
        state.followPopups = state.followPopups.map((p) => (p.uid === fp.uid ? follow_popup : p))
        Object.assign(fp, follow_popup)
        saveBtn.disabled = false
        saveBtn.textContent = '保存'
        toast('追従型ポップアップを保存しました')
      },
      (err: unknown) => {
        saveBtn.disabled = false
        saveBtn.textContent = '保存'
        toast((err as Error).message, 'error')
      },
    )
  })

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

function renderFollowSettingsTab(body: HTMLElement, draft: FollowPopup): void {
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

function renderFollowDeviceTab(body: HTMLElement, draft: FollowPopup): void {
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

function renderFollowHtmlTab(body: HTMLElement, draft: FollowPopup): void {
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

// ─── 追従型プレビュー ──────────────────────────────

function previewFollowPopup(fp: FollowPopup | Partial<FollowPopup>): void {
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

/** コードエディタの行番号ガターを更新する。 */
function updateGutter(gutter: HTMLElement, content: string): void {
  const count = (content.match(/\n/g)?.length ?? 0) + 1
  const lines: string[] = []
  for (let i = 1; i <= Math.max(count, 20); i++) lines.push(String(i))
  gutter.textContent = lines.join('\n')
}
