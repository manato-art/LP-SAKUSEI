/**
 * ヘッダー画像設定モーダル（エディタ本文上部の破線ボックス・企画書 §11 capture-and-rehydrate）。
 *
 * **手書きでUIを似せない。** モーダル本体は採取した実DOM
 * `fragments/ab_tests__UID__articles__header-image-modal.portals.html`（ReactModal）を
 * そのまま土台にし、**挙動だけ**を後付けする。見た目は採取済み実CSS
 * `/clean/ab_tests__UID__articles/header-image-modal/cssom.css`（index.html が読み込む）が担保する。
 *
 * トリガーは本文上部の「ヘッダー画像を追加する」破線ボックス（`_articleHeaderPhoto_1pk5s_1`・実DOM）。
 *
 * 画像グリッド: モックに**ヘッダー画像ストアが無い**ため、採取物に焼き付いた画像（架空ホスト）は
 * 出さず、採取物に実在する空状態（`_noImageDescription_1ap6m_29` の「画像がありません」）に差し替える。
 * アップロード／設定する／削除は実挙動が未採取なので確認＋未実装トーストで正直に扱う。
 */
import rawModal from '../fragments/ab_tests__UID__articles__header-image-modal.portals.html?raw'
import { toast } from '../ui.ts'
import { bindBackdropClose, findByExactText, openPortal } from './portal.ts'

/** 採取物の目印（実物のクラス／文言。書き換えていない） */
export const HEADER_IMAGE_HOOK = {
  /** トリガー（本文上部の破線ボックス） */
  trigger: '._articleHeaderPhoto_1pk5s_1',
  /** モーダル本体 */
  overlay: '.ReactModal__Overlay',
  /** 検索範囲タブ */
  tab: '._tab_1pk5s_139',
  /** 選択中タブに付くクラス */
  tabActive: '_active_1pk5s_88',
  /** 画像グリッドの入れ物 */
  grid: '._headerPhotoWrapper_1pk5s_72',
  /** 空状態の文言（採取物に実在） */
  emptyClass: '_noImageDescription_1ap6m_29',
  emptyText: '画像がありません',
  /** 「閉じる」ボタン */
  close: '閉じる',
  /** 「アップロードする」ボタン */
  upload: 'アップロードする',
  /** ボタンの当たり判定 */
  button: '[class*="_btn_1bcs1_2"]',
} as const

/** 採取物の検索範囲タブ（文言の並び・実物のとおり） */
export const HEADER_IMAGE_TABS: readonly string[] = [
  '全て',
  'フォルダ内',
  'beyondページ内',
  'Version内',
]

let isOpen = false

/**
 * 本文上部の破線ボックスにヘッダー画像モーダルを配線する。
 * 土台にトリガーが居ることが前提（居なければ何も配線しない）。
 */
export function mountHeaderImageModal(root: HTMLElement): void {
  const trigger = root.querySelector<HTMLElement>(HEADER_IMAGE_HOOK.trigger)
  if (trigger === null) {
    console.warn('[header-image-modal] トリガー', HEADER_IMAGE_HOOK.trigger, 'が土台に見つかりませんでした')
    return
  }
  if (trigger.dataset['cloneHeaderImageWired'] === 'true') return
  trigger.dataset['cloneHeaderImageWired'] = 'true'
  trigger.style.cursor = 'pointer'
  trigger.addEventListener('click', (event) => {
    // 破線ボックス内には隠しファイル入力の form があるが、そこは触らない
    const target = event.target as HTMLElement | null
    if (target !== null && target.closest('form') !== null) return
    open()
  })
}

function open(): void {
  if (isOpen) return
  const portal = openPortal(rawModal, HEADER_IMAGE_HOOK.overlay, () => {
    isOpen = false
  })
  if (portal === null) {
    toast('ヘッダー画像設定のマークアップが壊れています', 'error')
    return
  }
  isOpen = true

  bindBackdropClose(portal.root, portal.close)
  showEmptyState(portal.root)
  wireTabs(portal.root)

  const closeButton = findByExactText(portal.root, HEADER_IMAGE_HOOK.button, HEADER_IMAGE_HOOK.close)
  closeButton?.addEventListener('click', () => portal.close())

  const uploadButton = findByExactText(portal.root, HEADER_IMAGE_HOOK.button, HEADER_IMAGE_HOOK.upload)
  uploadButton?.addEventListener('click', () => toast('画像のアップロードは未実装です', 'error'))
}

/**
 * 採取物に焼き付いた画像（架空ホスト）を出さず、採取物の空状態に差し替える。
 * 使うクラス・文言はどちらも採取物（同じ断片ファイル）に実在するものだけ。
 */
function showEmptyState(root: HTMLElement): void {
  const grid = root.querySelector<HTMLElement>(HEADER_IMAGE_HOOK.grid)
  if (grid === null) return
  grid.innerHTML = ''
  const empty = document.createElement('div')
  empty.className = HEADER_IMAGE_HOOK.emptyClass
  empty.textContent = HEADER_IMAGE_HOOK.emptyText
  grid.append(empty)
}

/** タブの見た目上の切り替え（active クラスを移す・採取物のクラスだけ使う） */
function wireTabs(root: HTMLElement): void {
  const tabs = [...root.querySelectorAll<HTMLElement>(HEADER_IMAGE_HOOK.tab)]
  for (const tab of tabs) {
    tab.style.cursor = 'pointer'
    tab.addEventListener('click', () => {
      for (const other of tabs) other.classList.remove(HEADER_IMAGE_HOOK.tabActive)
      tab.classList.add(HEADER_IMAGE_HOOK.tabActive)
    })
  }
}
