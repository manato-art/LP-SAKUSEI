/**
 * 離脱防止・表示直後ポップアップの「追加」画面（exit-popup.ts から分離・2026-09-24）。
 *
 * タブ: プリセット／複製（このLPのポップアップを写す）。「+ 新規ポップアップ作成」も。
 * 作ったポップアップは本番反映するまで配信しない（下書きと本番を分けた）。
 */
import { popupApi } from '../api-popups.ts'
import { el, toast } from '../ui.ts'
import { PRESETS, type PopupPreset } from './exit-popup-presets.ts'
import { popupKindOf, type PopupPageState } from './exit-popup-state.ts'
import { openEditor } from './exit-popup-editor.ts'
import { copyTabList } from './popup-list-parts.ts'

// ─── プリセット選択モーダル ──────────────────────────

export function openPresetModal(state: PopupPageState): void {
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

  // 複製タブ: このLPの離脱防止・表示直後を並べ、選んだ物の下書きを写した別のポップアップを
  // いま開いているタブの種類で作る（本番反映するまで配信しない）
  tabCopy.addEventListener('click', () => {
    tabPreset.classList.remove('active')
    tabCopy.classList.add('active')
    const kind = state.activeSubTab === 'instant' ? 'instant' : 'exit'
    const sources = state.popups.map((p) => ({
      uid: p.uid,
      name: p.name,
      note: popupKindOf(p) === 'instant' ? '表示直後' : '離脱防止',
    }))
    list.replaceChildren(copyTabList(sources, (uid) => {
      void popupApi.duplicateExitPopup(state.abTestUid, uid, kind).then(
        ({ exit_popup }) => {
          state.popups = [...state.popups, exit_popup]
          overlay.remove()
          state.rerender()
          toast(`「${exit_popup.name}」を作りました（本番反映するまで配信しません）`)
        },
        (err: unknown) => toast((err as Error).message, 'error'),
      )
    }))
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
  // 表示直後は開いて「秒数」のあとに出す（スクロールのきっかけは使わない＝配信と同じ説明にする）
  const whenText = state.activeSubTab === 'instant'
    ? '<span>表示タイミング　　LPを開いて0秒で表示</span>'
    : `<span>スクロール位置　　${scrollText}</span>`
  details.innerHTML = `${whenText}<br><span>出現アニメーション　　${animText}</span><br><span>出現場所　　中央</span>`
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
    void popupApi.createExitPopup(state.abTestUid, {
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

function createBlankPopup(state: PopupPageState): void {
  void popupApi.createExitPopup(state.abTestUid, {
    name: '新規ポップアップ',
    // 新規ポップアップも「中身が入った状態」で始める（従来は無装飾のプレースホルダ文字だけで、
    // 配信すると何も入っていないように見えていた）。カード型の見た目＋編集しやすい要素で用意する。
    html:
      `<div style="background:var(--sb-c-ffffff, #FFFFFF);border-radius:12px;padding:28px 24px;` +
      `box-shadow:0 8px 32px rgba(0,0,0,.18);max-width:360px;margin:auto;text-align:center;` +
      `font-family:'Hiragino Sans',sans-serif">` +
      `<p style="font-size:18px;font-weight:700;color:var(--sb-c-333333, #333333);margin:0 0 10px">タイトルを入力してください</p>` +
      `<p style="font-size:14px;color:var(--sb-c-666666, #666666);line-height:1.7;margin:0 0 20px">本文を入力してください。文言・色・ボタンは「中身を編集」から直せます。</p>` +
      `<a href="#" style="display:inline-block;background:#E5532A;color:#FFFFFF;padding:12px 28px;` +
      `border-radius:6px;text-decoration:none;font-weight:700">ボタン</a>` +
      `</div>`,
    popup_kind: state.activeSubTab === 'instant' ? 'instant' : 'exit',
  }).then(
    ({ exit_popup }) => {
      state.popups = [...state.popups, exit_popup]
      toast('新規ポップアップを作成しました（本番反映するまで配信しません）')
      openEditor(state, exit_popup)
    },
    (err: unknown) => toast((err as Error).message, 'error'),
  )
}
