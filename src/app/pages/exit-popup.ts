/**
 * 離脱防止ポップアップ管理（指示80）。
 *
 * `/ab_tests/:ab_test_uid/articles/exit_popups`
 *
 * 実物SquadBeyondで確認した全フローを再現:
 *   - ポップアップ管理パネル（離脱防止/追従型/表示直後タブ、このVersionで配信、一覧）
 *   - ＋追加 → プリセット／複製（exit-popup-add.ts・追従型は exit-popup-follow.ts）
 *   - ポップアップ編集（5タブ: 基本/表示/位置/出し分け/コード。中身は「中身を編集」＝Widget編集と同じ画面）
 *   - LP上での離脱防止ポップアップ表示
 *
 * 下書きと本番を分ける（2026-09-24・本人の決定）: カードに本番との違い（未公開／下書きあり／公開中）を出す。
 * カードの配信ON/OFFと割合は、変えたその場で保存する（下書き・本番に分けない）。
 */
import { api } from '../api.ts'
import { popupApi, type ExitPopup } from '../api-popups.ts'
import { isStale } from '../main.ts'
import { el, toast } from '../ui.ts'
import { confirmCard } from '../dialog.ts'
import { setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'
import { PRESETS } from './exit-popup-presets.ts'
import { popupKindOf, type PopupPageState, type SubTab } from './exit-popup-state.ts'
import { openFollowPresetModal, renderFollowCard } from './exit-popup-follow.ts'
import { openEditor, previewPopup } from './exit-popup-editor.ts'
import { openPresetModal } from './exit-popup-add.ts'
import { injectPopupCss } from './exit-popup-styles.ts'
import { drawPopupThumb } from './popup-content-card.ts'
import { closedPanelNotice, publishStatusPill } from './popup-list-parts.ts'
import { popupDeliveryControl } from './popup-delivery-control.ts'
import { RATIO_HELP, mainVersionUid } from './popup-draft.ts'

const ADD_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
const TRASH_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`
const EMPTY_TEXT = 'ポップアップがまだ設定されていません。上にある「+追加」ボタンから選択してみましょう。'

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

  const [{ ab_test }, { folders }, { exit_popups }, { follow_popups }, { versions }] = await Promise.all([
    api.abTest(abTestUid),
    api.folders(),
    popupApi.exitPopups(abTestUid),
    popupApi.followPopups(abTestUid),
    popupApi.popupDelivery(abTestUid),
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
    popups: [...exit_popups],
    followPopups: [...follow_popups],
    deliveryVersions: [...versions],
    // 「LPの上に重ねて見る」と同じ Version を最初に選んでおく
    deliveryVersionUid: mainVersionUid(versions) ?? versions[0]?.uid ?? null,
    editingPopup: null,
    activeSubTab: 'exit',
    root: scroll,
    rerender: () => renderPanel(state),
  }

  renderPanel(state)
}

// ─── 管理パネル（一覧画面） ─────────────────────────

function renderPanel(state: PopupPageState): void {
  // 前のパネル・編集画面・閉じた案内を外して描き直す
  for (const existing of state.root.querySelectorAll('.ep-panel, .ep-editor, .ep-closed')) existing.remove()

  const panel = el('div', { class: 'ep-panel' })
  const inner = el('div', { class: 'ep-panel-inner' })

  // ── ヘッダ: 閉じる + タイトル ──
  const head = el('div', { class: 'ep-panel-head' })
  const closeBtn = el('button', { class: 'ep-panel-close', text: '閉じる' })
  closeBtn.type = 'button'
  closeBtn.addEventListener('click', () => closePanel(state, panel))
  head.append(closeBtn)
  head.append(el('span', { class: 'ep-panel-title', text: 'ポップアップ' }))
  inner.append(head)

  // ── サブタブ: 離脱防止 / 追従型 / 表示直後（指示176） ──
  const subtabs = el('div', { class: 'ep-subtabs' })
  const tabs: readonly { id: SubTab; label: string }[] = [
    { id: 'exit', label: '離脱防止' },
    { id: 'follow', label: '追従型' },
    { id: 'instant', label: '表示直後' },
  ]
  for (const tab of tabs) {
    const btn = el('button', { class: `ep-subtab${state.activeSubTab === tab.id ? ' active' : ''}`, text: tab.label })
    btn.type = 'button'
    btn.addEventListener('click', () => {
      if (state.activeSubTab === tab.id) return
      state.activeSubTab = tab.id
      renderPanel(state)
    })
    subtabs.append(btn)
  }
  inner.append(subtabs)

  // ── このVersionで配信（Versionごとに保存・配信に効く） ──
  inner.append(popupDeliveryControl(state))

  if (state.activeSubTab === 'follow') {
    renderFollowList(inner, state)
  } else {
    renderOverlayList(inner, state, state.activeSubTab)
  }

  panel.append(inner)
  // パネル背景クリックで閉じる（閉じるボタンと同じ）
  panel.addEventListener('click', (e) => {
    if (e.target === panel) closePanel(state, panel)
  })
  state.root.append(panel)
}

/**
 * 閉じる: 以前はパネルを消して真っ白な画面のままだった（戻る手段が無かった）。
 * いまは「一覧を開く」の案内を出す（上のタブで基本情報・Version・レポートへも移れる）。
 */
function closePanel(state: PopupPageState, panel: HTMLElement): void {
  panel.remove()
  const notice = closedPanelNotice(() => renderPanel(state))
  state.root.append(notice)
}

/** 離脱防止タブ・表示直後タブ（指示176）の一覧。どちらも同じ編集画面を使う */
function renderOverlayList(container: HTMLElement, state: PopupPageState, kind: 'exit' | 'instant'): void {
  const listHead = el('div', { class: 'ep-list-head' })
  const listTitle = el('h3', { text: kind === 'instant' ? '表示直後一覧' : '離脱防止一覧' })
  const addBtn = el('button', { class: 'ep-add-btn', html: `${ADD_ICON} 追加` })
  addBtn.type = 'button'
  addBtn.addEventListener('click', () => openPresetModal(state))
  listHead.append(listTitle, addBtn)
  container.append(listHead)

  const popups = state.popups.filter((p) => popupKindOf(p) === kind)
  if (popups.length === 0) {
    container.append(el('div', { class: 'ep-empty', text: EMPTY_TEXT }))
    return
  }
  container.append(el('p', { class: 'ep-help', text: `割合: ${RATIO_HELP}` }))
  const grid = el('div', { class: 'ep-card-grid' })
  for (const popup of popups) grid.append(renderPopupCard(state, popup))
  container.append(grid)
}

/** 追従型タブの一覧 */
function renderFollowList(container: HTMLElement, state: PopupPageState): void {
  const listHead = el('div', { class: 'ep-list-head' })
  const listTitle = el('h3', { text: '追従型一覧' })
  const addBtn = el('button', { class: 'ep-add-btn', html: `${ADD_ICON} 追加` })
  addBtn.type = 'button'
  addBtn.addEventListener('click', () => openFollowPresetModal(state))
  listHead.append(listTitle, addBtn)
  container.append(listHead)

  if (state.followPopups.length === 0) {
    container.append(el('div', { class: 'ep-empty', text: EMPTY_TEXT }))
    return
  }
  const grid = el('div', { class: 'ep-card-grid' })
  for (const fp of state.followPopups) grid.append(renderFollowCard(state, fp))
  container.append(grid)
}

/** 一覧を描いたあとに保存したときも、最新の形を使う */
function latest(state: PopupPageState, uid: string): ExitPopup | undefined {
  return state.popups.find((p) => p.uid === uid)
}

function renderPopupCard(state: PopupPageState, popup: ExitPopup): HTMLElement {
  const card = el('div', { class: 'ep-card' })
  card.setAttribute('data-popup-uid', popup.uid)

  // ⋯ メニューボタン（サムネイル右上に配置）
  const menuBtn = el('button', { class: 'ep-card-menu', text: '⋯' })
  menuBtn.type = 'button'
  menuBtn.setAttribute('aria-label', 'そのほかの操作')
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleDropdown(card, state, popup.uid)
  })
  card.append(menuBtn)

  // サムネイル: 今の中身そのもの（中身が空ならプリセットの絵）
  const thumb = el('div', { class: 'ep-card-thumb' })
  const preset = popup.preset_id !== null ? PRESETS.find((p) => p.id === popup.preset_id) : undefined
  card.append(thumb)
  drawPopupThumb(thumb, { html: popup.html, css: '' }, 500, preset?.thumbnailSvg)

  // カード下部
  const body = el('div', { class: 'ep-card-body' })
  body.append(el('p', { class: 'ep-card-name', text: popup.name }))
  body.append(publishStatusPill(popup.publish_status))

  const footer = el('div', { class: 'ep-card-footer' })
  footer.append(ratioStepper(state, popup))

  // 配信トグル（その場で保存）
  const itemToggle = el('button', { class: `ep-toggle${popup.enabled ? ' on' : ''}` })
  itemToggle.type = 'button'
  itemToggle.setAttribute('aria-label', '配信')
  itemToggle.style.cssText = 'width:34px;height:18px'
  itemToggle.addEventListener('click', (e) => {
    e.stopPropagation()
    const newEnabled = !(latest(state, popup.uid) ?? popup).enabled
    void popupApi.updateExitPopup(state.abTestUid, popup.uid, { enabled: newEnabled }).then(
      ({ exit_popup }) => {
        state.popups = state.popups.map((p) => (p.uid === exit_popup.uid ? exit_popup : p))
        itemToggle.classList.toggle('on', exit_popup.enabled)
      },
      (err: unknown) => toast((err as Error).message, 'error'),
    )
  })
  footer.append(itemToggle)

  body.append(footer)
  card.append(body)

  // カードクリック → 編集
  card.addEventListener('click', () => openEditor(state, latest(state, popup.uid) ?? popup))

  return card
}

/** 配信割合（Versionと同じ −値%＋ ステッパー。2個のときは片方調整で合計100に追従） */
function ratioStepper(state: PopupPageState, popup: ExitPopup): HTMLElement {
  const ratioWrap = el('div', { class: 'ep-card-ratio' })
  ratioWrap.title = RATIO_HELP
  ratioWrap.addEventListener('click', (e) => e.stopPropagation()) // カードのクリック（編集）を止める
  const minus = el('button', { class: 'ep-ratio-btn', text: '−' })
  minus.type = 'button'
  minus.setAttribute('aria-label', '割合を1減らす')
  const valueInput = document.createElement('input')
  valueInput.className = 'ep-ratio-value'
  valueInput.type = 'text'
  valueInput.inputMode = 'numeric'
  valueInput.setAttribute('aria-label', '割合（%）')
  valueInput.value = String(popup.ratio)
  const plus = el('button', { class: 'ep-ratio-btn', text: '＋' })
  plus.type = 'button'
  plus.setAttribute('aria-label', '割合を1増やす')
  ratioWrap.append(el('span', { class: 'ep-ratio-label', text: '割合' }), minus, valueInput, el('span', { class: 'ep-ratio-pct', text: '%' }), plus)

  const savedRatio = (): number => (latest(state, popup.uid) ?? popup).ratio
  const saveRatio = (raw: number): void => {
    const clamped = Math.max(0, Math.min(100, Math.round(raw)))
    valueInput.value = String(clamped) // 楽観的に即反映
    void popupApi.updateExitPopup(state.abTestUid, popup.uid, { ratio: clamped }).then(
      (res) => {
        // 2個のとき相方が 100-新値 に追従（サーバー計算）。相方カードの表示も更新。
        const siblings = res.adjusted_siblings ?? []
        state.popups = state.popups.map((p) => {
          if (p.uid === res.exit_popup.uid) return res.exit_popup
          const sibling = siblings.find((s) => s.uid === p.uid)
          return sibling === undefined ? p : { ...p, ratio: sibling.ratio }
        })
        valueInput.value = String(res.exit_popup.ratio)
        for (const sib of siblings) {
          const sibVal = state.root.querySelector<HTMLInputElement>(`[data-popup-uid="${sib.uid}"] .ep-ratio-value`)
          if (sibVal !== null) sibVal.value = String(sib.ratio)
        }
      },
      (err: unknown) => {
        toast((err as Error).message, 'error')
        valueInput.value = String(savedRatio()) // 失敗したら元に戻す
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
  return ratioWrap
}

function toggleDropdown(cardEl: HTMLElement, state: PopupPageState, uid: string): void {
  const existing = cardEl.querySelector('.ep-dropdown')
  if (existing !== null) { existing.remove(); return }
  for (const d of document.querySelectorAll('.ep-dropdown')) d.remove()
  const popup = latest(state, uid)
  if (popup === undefined) return

  const dropdown = el('div', { class: 'ep-dropdown' })
  const item = (text: string, onClick: () => void): HTMLElement => {
    const btn = el('button', { class: 'ep-dropdown-item', text })
    btn.type = 'button'
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      dropdown.remove()
      onClick()
    })
    return btn
  }

  const editBtn = item('編集', () => openEditor(state, popup))
  const previewBtn = item('プレビュー', () => previewPopup(popup))
  const copyBtn = item('複製', () => {
    void popupApi.duplicateExitPopup(state.abTestUid, uid, popupKindOf(popup)).then(
      ({ exit_popup }) => {
        state.popups = [...state.popups, exit_popup]
        renderPanel(state)
        toast(`「${exit_popup.name}」を作りました（本番反映するまで配信しません）`)
      },
      (err: unknown) => toast((err as Error).message, 'error'),
    )
  })

  const deleteBtn = el('button', { class: 'ep-dropdown-item danger', html: `削除 ${TRASH_ICON}` })
  deleteBtn.type = 'button'
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.remove()
    void confirmCard({
      title: 'このポップアップを削除しますか？',
      message: 'このbeyondページから外れ、配信ページにも出なくなります。',
      detail: '削除すると元に戻せません。',
      submitLabel: '削除する',
      danger: true,
    }).then((ok) => {
      if (!ok) return
      void popupApi.deleteExitPopup(state.abTestUid, uid).then(
        () => {
          state.popups = state.popups.filter((p) => p.uid !== uid)
          renderPanel(state)
          toast('ポップアップを削除しました')
        },
        (err: unknown) => toast((err as Error).message, 'error'),
      )
    })
  })

  dropdown.append(editBtn, previewBtn, copyBtn, deleteBtn)
  cardEl.append(dropdown)

  const close = (e: MouseEvent): void => {
    if (!cardEl.contains(e.target as Node)) {
      dropdown.remove()
      document.removeEventListener('click', close)
    }
  }
  setTimeout(() => document.addEventListener('click', close), 0)
}
