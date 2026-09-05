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
import { toast } from '../ui.ts'
import { convertImageToWebP } from './webp-convert.ts'

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

  // 指示95: モーダルは開かず、直接Finder（ファイル選択ダイアログ）を開く
  trigger.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    if (target !== null && target.closest('form') !== null) return
    // 削除ボタンのクリックは伝播させない（setHeaderImage 内で stopPropagation 済み）
    if (target !== null && target.closest('[data-clone-header-remove]') !== null) return
    pickImageDirect(trigger)
  })

  // 指示95: ドラッグ&ドロップでも画像を受け付ける
  trigger.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.stopPropagation()
    trigger.style.outline = '2px dashed #0091ff'
    trigger.style.outlineOffset = '-2px'
  })
  trigger.addEventListener('dragleave', () => {
    trigger.style.outline = ''
    trigger.style.outlineOffset = ''
  })
  trigger.addEventListener('drop', (e) => {
    e.preventDefault()
    e.stopPropagation()
    trigger.style.outline = ''
    trigger.style.outlineOffset = ''
    const file = e.dataTransfer?.files[0]
    if (file === undefined || !file.type.startsWith('image/')) {
      toast('画像ファイルをドロップしてください', 'error')
      return
    }
    void convertImageToWebP(file).then((dataUrl) => {
      if (dataUrl === '') return
      if (!uploadedImages.includes(dataUrl)) uploadedImages.push(dataUrl)
      setHeaderImage(trigger, dataUrl)
      toast('ヘッダー画像を設定しました')
    })
  })
}

/** 指示95: モーダルを開かず直接Finderのファイル選択を開く */
function pickImageDirect(headerBox: HTMLElement): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.style.display = 'none'
  document.body.append(input)
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    input.remove()
    if (file === undefined) return
    void convertImageToWebP(file).then((dataUrl) => {
      if (dataUrl === '') return
      if (!uploadedImages.includes(dataUrl)) uploadedImages.push(dataUrl)
      setHeaderImage(headerBox, dataUrl)
      toast('ヘッダー画像を設定しました')
    })
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

// 旧モーダル用の renderGrid / wireTabs は指示95で廃止（直接ファイル選択に移行）
