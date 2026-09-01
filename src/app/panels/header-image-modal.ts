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
 * 画像グリッド: 既定は採取物の空状態（`_noImageDescription_1ap6m_29`「画像がありません」）。
 * 「アップロードする」は本番サーバーへは上げず（§3-2）、選んだ画像をその場で dataURL にして
 * ①グリッドにサムネイルとして足し、②本文上部のヘッダー画像枠へ実際に反映する＝クローン内で完結。
 * 採取物に焼き付いた実画像（架空ホスト）は出さない。
 */
import rawModal from '../fragments/ab_tests__UID__articles__header-image-modal.portals.html?raw'
import { toast } from '../ui.ts'
import { bindBackdropClose, findByExactText, openPortal } from './portal.ts'

/** アップロードしたヘッダー画像（dataURL・セッション内。実サーバーへは上げない） */
const uploadedImages: string[] = []

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
    open(trigger)
  })
}

function open(headerBox: HTMLElement): void {
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
  const applyAndClose = (dataUrl: string): void => {
    setHeaderImage(headerBox, dataUrl)
    portal.close()
  }
  renderGrid(portal.root, applyAndClose)
  wireTabs(portal.root)

  const closeButton = findByExactText(portal.root, HEADER_IMAGE_HOOK.button, HEADER_IMAGE_HOOK.close)
  closeButton?.addEventListener('click', () => portal.close())

  const uploadButton = findByExactText(portal.root, HEADER_IMAGE_HOOK.button, HEADER_IMAGE_HOOK.upload)
  uploadButton?.addEventListener('click', () => pickImage(portal.root, applyAndClose))
}

/** 標準のファイル選択で画像を読み、dataURL 化して控え、その場で反映する（実サーバーへは上げない） */
function pickImage(modalRoot: HTMLElement, apply: (dataUrl: string) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.style.display = 'none'
  modalRoot.append(input)
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.remove()
    if (file === undefined) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const dataUrl = String(reader.result ?? '')
      if (dataUrl === '') return
      if (!uploadedImages.includes(dataUrl)) uploadedImages.push(dataUrl)
      renderGrid(modalRoot, apply)
      apply(dataUrl)
      toast('ヘッダー画像を設定しました（クローン内保存・外部サーバーへは送信しません）')
    })
    reader.readAsDataURL(file)
  })
  input.click()
}

/** 本文上部のヘッダー画像枠に、選んだ画像を実際に表示する（右上に×＝削除ボタン付き） */
function setHeaderImage(headerBox: HTMLElement, dataUrl: string): void {
  headerBox.style.position = 'relative'
  let img = headerBox.querySelector<HTMLImageElement>('img[data-clone-header="true"]')
  if (img === null) {
    img = document.createElement('img')
    img.dataset['cloneHeader'] = 'true'
    img.style.cssText = 'display:block;width:100%;height:auto;border-radius:10px 10px 0 0'
    headerBox.prepend(img)
  }
  img.src = dataUrl
  // 「ヘッダー画像を追加する」の案内文は隠す（画像が入ったので不要）。
  // クラスは匿名化され得るので**文言で**引く（`[class*=…]` は当たらない）。
  const prompt = findPrompt(headerBox)
  if (prompt !== null) prompt.style.display = 'none'

  // 削除ボタン（×）。採取物に削除UIが無いため、実物を真似ず汎用の×で「消せる」を担保する。
  if (headerBox.querySelector('[data-clone-header-remove="true"]') === null) {
    const remove = document.createElement('button')
    remove.dataset['cloneHeaderRemove'] = 'true'
    remove.type = 'button'
    remove.textContent = '×'
    remove.title = 'ヘッダー画像を削除'
    remove.style.cssText =
      'position:absolute;top:8px;right:8px;z-index:2;width:28px;height:28px;border:none;border-radius:50%;' +
      'background:rgba(0,0,0,.6);color:#fff;font-size:18px;line-height:1;cursor:pointer;display:flex;' +
      'align-items:center;justify-content:center'
    remove.addEventListener('click', (event) => {
      // 枠クリック＝モーダルを開く挙動へ伝播させない（×は削除だけ）
      event.stopPropagation()
      removeHeaderImage(headerBox)
    })
    headerBox.append(remove)
  }
}

/** ヘッダー画像を外して、元の「ヘッダー画像を追加する」状態へ戻す */
function removeHeaderImage(headerBox: HTMLElement): void {
  headerBox.querySelector('img[data-clone-header="true"]')?.remove()
  headerBox.querySelector('[data-clone-header-remove="true"]')?.remove()
  const prompt = findPrompt(headerBox)
  if (prompt !== null) prompt.style.display = ''
  toast('ヘッダー画像を削除しました')
}

/** 「ヘッダー画像を追加する」の案内 span を文言で探す（クラスは匿名化され得るため） */
function findPrompt(headerBox: HTMLElement): HTMLElement | null {
  return (
    [...headerBox.querySelectorAll<HTMLElement>('span')].find(
      (s) => s.textContent?.trim() === 'ヘッダー画像を追加する',
    ) ?? null
  )
}

/**
 * グリッドを描く。アップロード済みが無ければ採取物の空状態（「画像がありません」）、
 * あればサムネイルを並べ、クリックでヘッダー画像に反映する。
 * 採取物に焼き付いた実画像（架空ホスト）は出さない。
 */
function renderGrid(root: HTMLElement, apply: (dataUrl: string) => void): void {
  const grid = root.querySelector<HTMLElement>(HEADER_IMAGE_HOOK.grid)
  if (grid === null) return
  grid.innerHTML = ''
  if (uploadedImages.length === 0) {
    const empty = document.createElement('div')
    empty.className = HEADER_IMAGE_HOOK.emptyClass
    empty.textContent = HEADER_IMAGE_HOOK.emptyText
    grid.append(empty)
    return
  }
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;padding:12px'
  for (const dataUrl of uploadedImages) {
    const thumb = document.createElement('img')
    thumb.src = dataUrl
    thumb.style.cssText =
      'width:120px;height:80px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid transparent'
    thumb.addEventListener('click', () => apply(dataUrl))
    grid.append(thumb)
  }
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
