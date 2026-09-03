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
  // ヘッダー画像を追加したら、スクロールしても上部に固定する（指示追加）。
  // scroll ancestor は container（overflow:auto, height:100vh）なので sticky が効く。
  // 上部ナビ（80px 前後）の下に張り付くようにする。
  headerBox.style.position = 'sticky'
  headerBox.style.top = '0'
  headerBox.style.zIndex = '5'
  headerBox.style.background = '#fff'
  // 「ヘッダー画像を追加する」の案内文は隠す（画像が入ったので不要）。
  // クラスは匿名化され得るので**文言で**引く（`[class*=…]` は当たらない）。
  const prompt = findPrompt(headerBox)
  if (prompt !== null) prompt.style.display = 'none'

  // 削除リンク。実物は画像右上に白い角丸の中に青文字「削除」が出る（ユーザー提示の実画面）。
  if (headerBox.querySelector('[data-clone-header-remove="true"]') === null) {
    const remove = document.createElement('button')
    remove.dataset['cloneHeaderRemove'] = 'true'
    remove.type = 'button'
    remove.textContent = '削除'
    remove.title = 'ヘッダー画像を削除'
    remove.style.cssText =
      'position:absolute;top:15px;right:15px;z-index:2;padding:8px 16px;border:none;border-radius:6px;' +
      'background:#fff;color:#0091FF;font-size:14px;line-height:1;cursor:pointer;' +
      'box-shadow:0 1px 4px rgba(0,0,0,.2)'
    remove.addEventListener('click', (event) => {
      // 枠クリック＝モーダルを開く挙動へ伝播させない（削除だけ）
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
  // sticky を解除（画像が無い状態では固定不要）
  headerBox.style.position = 'relative'
  headerBox.style.top = ''
  headerBox.style.zIndex = ''
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
  // 実物は横幅いっぱいのバナーを縦に積む一覧（ユーザー提示の実画面）。同じ並びにする。
  grid.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:12px'
  // 新しく足したものが上に来るよう逆順で
  for (const dataUrl of [...uploadedImages].reverse()) {
    const item = document.createElement('div')
    item.style.cssText = 'position:relative;cursor:pointer;border-radius:6px;overflow:hidden'
    const thumb = document.createElement('img')
    thumb.src = dataUrl
    thumb.style.cssText = 'display:block;width:100%;height:auto'
    item.addEventListener('click', () => apply(dataUrl))
    // 一覧からの削除（過去追加したヘッダーを消す）
    const del = document.createElement('button')
    del.type = 'button'
    del.textContent = '削除'
    del.style.cssText =
      'position:absolute;top:8px;right:8px;padding:6px 12px;border:none;border-radius:6px;background:#fff;' +
      'color:#0091FF;font-size:13px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.2)'
    del.addEventListener('click', (event) => {
      event.stopPropagation()
      const idx = uploadedImages.indexOf(dataUrl)
      if (idx >= 0) uploadedImages.splice(idx, 1)
      renderGrid(root, apply)
      toast('一覧から削除しました')
    })
    item.append(thumb, del)
    grid.append(item)
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
