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
import { placeHeaderImage } from './header-image-dom.ts'

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
    // 削除ボタンのクリックは伝播させない（header-image-dom.ts で stopPropagation 済み）
    if (target !== null && target.closest('[data-clone-header-remove]') !== null) return
    pickImageDirect(trigger)
  })

  // 指示95: ドラッグ&ドロップでも画像を受け付ける
  trigger.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.stopPropagation()
    trigger.style.outline = '2px dashed var(--sb-accent, #0091FF)'
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
      placeHeaderImage(trigger, dataUrl)
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
      placeHeaderImage(headerBox, dataUrl)
      toast('ヘッダー画像を設定しました')
    })
  })
  input.click()
}

// 旧モーダル用の renderGrid / wireTabs は指示95で廃止（直接ファイル選択に移行）
