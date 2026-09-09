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
import { el, toast, confirmCard } from '../ui.ts'
import { setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'
import { PRESETS, type PopupPreset } from './exit-popup-presets.ts'
import { popupKindOf, type PopupPageState, type SubTab } from './exit-popup-state.ts'
import { openFollowPresetModal, renderFollowCard } from './exit-popup-follow.ts'
import { openEditor, previewPopup } from './exit-popup-editor.ts'
import { injectPopupCss } from './exit-popup-styles.ts'

// ─── CSS注入 ────────────────────────────────────────


// ─── メインのrender関数 ─────────────────────────────




export async function renderExitPopup(
  container: HTMLElement,
  abTestUid: string,
  generation?: number,
): Promise<void> {
  container.innerHTML = ''
  // 指示: ページを画面高に収め、内容はスクロールバー付きで内部スクロールさせる。
  // （採取CSSが body の縦スクロールバーを全消ししているため、ページ全体スクロールだと
  //   スクロールバーが出ず「スクロールバーが無い」状態になっていた。）
  container.style.cssText = 'flex:1;min-width:0;height:100vh;overflow:hidden;display:flex;flex-direction:column'

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

  // タブバー・パンくず（共通部品）— これらは上部固定（スクロールしない）
  setupHorizTabs(root, 'popup', { abTestUid, folderUid })
  setupBreadcrumb(root, folder?.name ?? '', ab_test.title, folder?.uid)

  // 一覧・編集はこのスクロール領域の中に描画する（可視スクロールバー付き）。
  const scroll = el('div', { class: 'ep-scroll' })
  root.append(scroll)

  const state: PopupPageState = {
    abTestUid,
    folderUid,
    popups: exit_popups,
    followPopups: follow_popups,
    deliveryEnabled: exit_popups.some((p) => p.enabled),
    editingPopup: null,
    activeSubTab: 'exit',
    root: scroll,
    rerender: () => renderPanel(state),
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

  // ── サブタブ: 離脱防止 / 追従型 / 表示直後（指示176） ──
  const subtabs = el('div', { class: 'ep-subtabs' })
  const mkTab = (id: SubTab, label: string): HTMLElement =>
    el('button', { class: `ep-subtab${state.activeSubTab === id ? ' active' : ''}`, text: label })
  const tabExit = mkTab('exit', '離脱防止')
  const tabFollow = mkTab('follow', '追従型')
  const tabInstant = mkTab('instant', '表示直後')
  subtabs.append(tabExit, tabFollow, tabInstant)
  inner.append(subtabs)

  tabInstant.addEventListener('click', () => {
    if (state.activeSubTab === 'instant') return
    state.activeSubTab = 'instant'
    renderPanel(state)
  })

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

  if (state.activeSubTab === 'follow') {
    renderFollowList(inner, state)
  } else if (state.activeSubTab === 'instant') {
    renderInstantList(inner, state)
  } else {
    renderExitList(inner, state)
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

  const exitPopups = state.popups.filter((p) => popupKindOf(p) === 'exit')
  if (exitPopups.length === 0) {
    container.append(el('div', { class: 'ep-empty', text: 'ポップアップがまだ設定されていません。上にある「+追加」ボタンから選択してみましょう。' }))
  } else {
    const grid = el('div', { class: 'ep-card-grid' })
    for (const popup of exitPopups) {
      grid.append(renderPopupCard(state, popup))
    }
    container.append(grid)
  }
}

/** 表示直後タブの一覧（指示176）。離脱防止ポップと同じ編集画面を使い、配信時にLP表示直後へ出す。 */
function renderInstantList(container: HTMLElement, state: PopupPageState): void {
  const listHead = el('div', { class: 'ep-list-head' })
  const listTitle = el('h3', { text: '表示直後一覧' })
  const addBtn = el('button', { class: 'ep-add-btn', html: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> 追加` })
  addBtn.addEventListener('click', () => openPresetModal(state))
  listHead.append(listTitle, addBtn)
  container.append(listHead)

  const instantPopups = state.popups.filter((p) => popupKindOf(p) === 'instant')
  if (instantPopups.length === 0) {
    container.append(el('div', { class: 'ep-empty', text: 'ポップアップがまだ設定されていません。上にある「+追加」ボタンから選択してみましょう。' }))
  } else {
    const grid = el('div', { class: 'ep-card-grid' })
    for (const popup of instantPopups) {
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
  card.setAttribute('data-popup-uid', popup.uid)

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

  // 配信割合（Versionと同じ −値%＋ ステッパー。2個のときは片方調整で合計100に追従）
  const ratioWrap = el('div', { class: 'ep-card-ratio' })
  ratioWrap.addEventListener('click', (e) => e.stopPropagation()) // カードのクリック（編集）を止める
  const ratioLabel = el('span', { class: 'ep-ratio-label', text: '割合' })
  const minus = el('button', { class: 'ep-ratio-btn', text: '−' })
  const valueInput = document.createElement('input')
  valueInput.className = 'ep-ratio-value'
  valueInput.type = 'text'
  valueInput.inputMode = 'numeric'
  valueInput.value = String(popup.ratio)
  const pct = el('span', { class: 'ep-ratio-pct', text: '%' })
  const plus = el('button', { class: 'ep-ratio-btn', text: '＋' })
  ratioWrap.append(ratioLabel, minus, valueInput, pct, plus)

  const setValue = (v: number): void => {
    valueInput.value = String(v)
  }
  const saveRatio = (raw: number): void => {
    const clamped = Math.max(0, Math.min(100, Math.round(raw)))
    setValue(clamped) // 楽観的に即反映
    void api.updateExitPopup(state.abTestUid, popup.uid, { ratio: clamped }).then(
      (res) => {
        popup.ratio = res.exit_popup.ratio
        setValue(popup.ratio)
        // 2個のとき相方が 100-新値 に追従（サーバー計算）。相方カードの表示も更新。
        for (const sib of res.adjusted_siblings ?? []) {
          const sibObj = state.popups.find((p) => p.uid === sib.uid)
          if (sibObj !== undefined) sibObj.ratio = sib.ratio
          const sibVal = state.root.querySelector<HTMLInputElement>(
            `[data-popup-uid="${sib.uid}"] .ep-ratio-value`,
          )
          if (sibVal !== null) sibVal.value = String(sib.ratio)
        }
      },
      (err: unknown) => {
        toast((err as Error).message, 'error')
        setValue(popup.ratio) // 失敗したら元に戻す
      },
    )
  }
  const currentVal = (): number => {
    const n = parseInt(valueInput.value, 10)
    return Number.isNaN(n) ? 0 : n
  }
  minus.addEventListener('click', (e) => {
    e.stopPropagation()
    saveRatio(currentVal() - 1)
  })
  plus.addEventListener('click', (e) => {
    e.stopPropagation()
    saveRatio(currentVal() + 1)
  })
  // 直接入力（Version同様、値をタイプして一気に決められる）
  valueInput.addEventListener('click', (e) => e.stopPropagation())
  valueInput.addEventListener('change', () => saveRatio(currentVal()))
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
    void confirmCard('このポップアップを削除しますか？', '削除する').then((ok) => {
      if (!ok) return
      void api.deleteExitPopup(state.abTestUid, popup.uid).then(
        () => {
          state.popups = state.popups.filter((p) => p.uid !== popup.uid)
          renderPanel(state)
          toast('ポップアップを削除しました')
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

// ─── プリセット選択モーダル ──────────────────────────

function openPresetModal(state: PopupPageState): void {
  const overlay = el('div', { class: 'ep-modal-overlay' })
  const modal = el('div', { class: 'ep-modal' })

  // ヘッダ（閉じる + センタータイトル）
  const head = el('div', { class: 'ep-modal-head' })
  const closeBtn = el('button', { class: 'ep-modal-close', text: '閉じる' })
  closeBtn.addEventListener('click', () => overlay.remove())
  head.append(closeBtn)
  head.append(el('h2', { text: `ポップアップ追加（${state.activeSubTab === 'instant' ? '表示直後' : '離脱防止'}）` }))
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
      popup_kind: state.activeSubTab === 'instant' ? 'instant' : 'exit',
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
    // 新規ポップアップも「中身が入った状態」で始める（従来は無装飾のプレースホルダ文字だけで、
    // 配信すると何も入っていないように見えていた）。カード型の見た目＋編集しやすい要素で用意する。
    html:
      `<div style="background:#ffffff;border-radius:12px;padding:28px 24px;` +
      `box-shadow:0 8px 32px rgba(0,0,0,.18);max-width:360px;margin:auto;text-align:center;` +
      `font-family:'Hiragino Sans',sans-serif">` +
      `<p style="font-size:18px;font-weight:700;color:#333333;margin:0 0 10px">タイトルを入力してください</p>` +
      `<p style="font-size:14px;color:#666666;line-height:1.7;margin:0 0 20px">本文を入力してください。「デザイン」タブや「HTML」タブから文言・色・ボタンを編集できます。</p>` +
      `<a href="#" style="display:inline-block;background:#E5532A;color:#ffffff;padding:12px 28px;` +
      `border-radius:6px;text-decoration:none;font-weight:700">ボタン</a>` +
      `</div>`,
    popup_kind: state.activeSubTab === 'instant' ? 'instant' : 'exit',
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





// ── 基本タブ ──





// ── デザインタブ（HTMLを要素カードに分解して文言・色を編集） ──









// ── 表示タブ ──



// ── 位置タブ ──





// ── 出し分けタブ ──


// ── HTMLタブ ──


// ─── プレビュー ─────────────────────────────────────


// ─── 追従型ポップアップ ─────────────────────────────



// ─── 追従型プリセット選択モーダル ─────────────────────




// ─── 追従型ポップアップ編集画面 ─────────────────────







// ─── 追従型プレビュー ──────────────────────────────


// ─── ヘルパー ───────────────────────────────────────




