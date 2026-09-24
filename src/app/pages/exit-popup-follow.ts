/**
 * 追尾型ポップアップの一覧のカード・追加画面（exit-popup.ts から分離）。
 *
 * 離脱防止ポップアップと違い、オーバーレイを出さず画面の端に貼り付いて
 * スクロールに追従する種類。編集画面は exit-popup-follow-editor.ts。
 *
 * 依存は一方向にしてある: このファイルは exit-popup.ts を import しない。
 * 一覧の描き直しは `state.rerender()` を通す。
 */
import { popupApi, type FollowPopup } from '../api-popups.ts'
import { el, toast } from '../ui.ts'
import { confirmCard } from '../dialog.ts'
import { FOLLOW_PRESETS, type FollowPreset } from './follow-popup-presets.ts'
import type { PopupPageState } from './exit-popup-state.ts'
import { drawPopupThumb } from './popup-content-card.ts'
import { isCornerPosition, openFollowEditor, previewFollowPopup } from './exit-popup-follow-editor.ts'
import { copyTabList, publishStatusPill } from './popup-list-parts.ts'

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
  // 今の中身そのもの（中身が空ならプリセットの絵）
  const thumb = el('div', { class: 'ep-card-thumb' })
  const preset = fp.preset_id !== null ? FOLLOW_PRESETS.find((p) => p.id === fp.preset_id) : undefined
  card.append(thumb)
  drawPopupThumb(thumb, { html: fp.html, css: fp.css }, isCornerPosition(fp.position) ? 360 : 620, preset?.thumbnailSvg)

  // カード下部
  const body = el('div', { class: 'ep-card-body' })
  body.append(el('p', { class: 'ep-card-name', text: fp.name }))
  body.append(publishStatusPill(fp.publish_status))

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
    const current = state.followPopups.find((p) => p.uid === fp.uid) ?? fp
    const newEnabled = !current.enabled
    void popupApi.updateFollowPopup(state.abTestUid, fp.uid, { enabled: newEnabled }).then(
      ({ follow_popup }) => {
        state.followPopups = state.followPopups.map((p) => (p.uid === follow_popup.uid ? follow_popup : p))
        itemToggle.classList.toggle('on', follow_popup.enabled)
      },
      (err: unknown) => toast((err as Error).message, 'error'),
    )
  })
  footer.append(itemToggle)

  body.append(footer)
  card.append(body)

  // 一覧を描いたあとに保存したときも、最新の形で開く
  card.addEventListener('click', () => openFollowEditor(state, state.followPopups.find((p) => p.uid === fp.uid) ?? fp))
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
    void confirmCard({
      title: 'この追従型ポップアップを削除しますか？',
      message: 'このbeyondページから外れ、配信ページにも出なくなります。',
      detail: '削除すると元に戻せません。',
      submitLabel: '削除する',
      danger: true,
    }).then((ok) => {
      if (!ok) return
      void popupApi.deleteFollowPopup(state.abTestUid, fp.uid).then(
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

  // 複製タブ: このLPの追従型を並べ、選んだ物の下書きを写した別の追従型を作る（本番反映するまで配信しない）
  tabCopy.addEventListener('click', () => {
    tabPreset.classList.remove('active')
    tabCopy.classList.add('active')
    const sources = state.followPopups.map((p) => ({ uid: p.uid, name: p.name, note: '追従型' }))
    list.replaceChildren(copyTabList(sources, (uid) => {
      void popupApi.duplicateFollowPopup(state.abTestUid, uid).then(
        ({ follow_popup }) => {
          state.followPopups = [...state.followPopups, follow_popup]
          overlay.remove()
          state.rerender()
          toast(`「${follow_popup.name}」を作りました（本番反映するまで配信しません）`)
        },
        (err: unknown) => toast((err as Error).message, 'error'),
      )
    }))
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
    void popupApi.createFollowPopup(state.abTestUid, {
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
        toast(`「${preset.name}」を追加しました（本番反映するまで配信しません）`)
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
  void popupApi.createFollowPopup(state.abTestUid, {
    name: '新規追従型ポップアップ',
    html: '<div style="padding:12px 20px;background:var(--sb-c-333333, #333333);color:var(--sb-c-ffffff, #FFFFFF);font-family:sans-serif;text-align:center;font-size:13px">追従型ポップアップの内容</div>',
    position: 'bottom',
  }).then(
    ({ follow_popup }) => {
      state.followPopups = [...state.followPopups, follow_popup]
      state.rerender()
      toast('新規追従型ポップアップを作成しました（本番反映するまで配信しません）')
      openFollowEditor(state, follow_popup)
    },
    (err: unknown) => toast((err as Error).message, 'error'),
  )
}
