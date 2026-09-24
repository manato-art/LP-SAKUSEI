/**
 * 本文上部のヘッダー画像枠（「ヘッダー画像を追加する」の破線ボックス）の出し入れ。
 *
 * 以前は「画像を置く」「外す」が header-image-modal.ts と editor-html.ts に別々に書かれていて、
 * Versionを切り替えたときに**外す側が無かった**（2026-09-24 点検1）。
 * 画像の無いVersionを開いても前のVersionの画像が残り、そのまま自動保存で別のVersionへ書き込まれていた。
 * ここに1か所にまとめ、置く・外すの両方を持つ。
 *
 * 画像を置く・外すは Quill の外の変更なので、Quill の text-change では自動保存が動かない。
 * 利用者の操作で変えたときは `notifyEditorChanged` で自動保存を起こす（点検11）。
 */
import { toast } from '../ui.ts'
import { notifyEditorChanged } from './editor-change.ts'

/** 採取物の枠（クラスは匿名化され得るので前方一致で探す） */
const HEADER_BOX = '[class*="_articleHeaderPhoto_"]'
const HEADER_IMG = 'img[data-clone-header="true"]'
const REMOVE_BUTTON = '[data-clone-header-remove]'
const PROMPT_TEXT = 'ヘッダー画像を追加する'

export function findHeaderBox(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(HEADER_BOX)
}

/** いま枠に出ているヘッダー画像の src（無ければ null） */
export function headerImageSrc(root: ParentNode): string | null {
  return root.querySelector<HTMLImageElement>(HEADER_IMG)?.src ?? null
}

function promptSpans(headerBox: HTMLElement): HTMLElement[] {
  return [...headerBox.querySelectorAll<HTMLElement>('span')].filter((s) => s.textContent?.trim() === PROMPT_TEXT)
}

/** 高さが変わったことをミニマップへ伝える */
const relayout = (): void => void requestAnimationFrame(() => dispatchEvent(new Event('resize')))

/** 枠に画像を出す（右上に「削除」ボタン付き。押したら外して自動保存の合図を出す） */
export function showHeaderImage(headerBox: HTMLElement, src: string): void {
  headerBox.style.position = 'relative'
  headerBox.style.border = 'none'
  headerBox.style.padding = '0'
  headerBox.style.margin = '0'
  headerBox.style.outline = 'none'
  headerBox.style.background = 'var(--sb-c-ffffff, #FFFFFF)'
  let img = headerBox.querySelector<HTMLImageElement>(HEADER_IMG)
  if (img === null) {
    img = document.createElement('img')
    img.dataset['cloneHeader'] = 'true'
    // 高さ制限でキャンバスを圧迫しない + 枠なし
    img.style.cssText = 'display:block;width:100%;max-height:200px;object-fit:cover;border-radius:0'
    headerBox.prepend(img)
  }
  img.src = src
  // 青い点線枠の内側要素(sample_token)と案内文を隠す
  for (const el of headerBox.querySelectorAll<HTMLElement>('[class*="sample_token"]')) el.style.display = 'none'
  for (const span of promptSpans(headerBox)) span.style.display = 'none'
  // 削除ボタン。実物は画像右上に白い角丸の中に青文字「削除」が出る
  headerBox.querySelector(REMOVE_BUTTON)?.remove()
  const remove = document.createElement('button')
  remove.dataset['cloneHeaderRemove'] = 'true'
  remove.type = 'button'
  remove.textContent = '削除'
  remove.title = 'ヘッダー画像を削除'
  remove.style.cssText =
    'position:absolute;top:15px;right:15px;z-index:2;padding:8px 16px;border:none;border-radius:6px;' +
    'background:var(--sb-c-ffffff, #FFFFFF);color:var(--sb-accent, #0091FF);font-size:14px;line-height:1;cursor:pointer;' +
    'box-shadow:0 1px 4px rgba(0,0,0,.2)'
  remove.addEventListener('click', (event) => {
    // 枠クリック＝モーダルを開く挙動へ伝播させない（削除だけ）
    event.stopPropagation()
    hideHeaderImage(headerBox)
    toast('ヘッダー画像を削除しました')
    notifyEditorChanged(headerBox)
    relayout()
  })
  headerBox.append(remove)
}

/** 枠から画像を外して、元の「ヘッダー画像を追加する」の状態に戻す（画像が無ければ何もしない） */
export function hideHeaderImage(headerBox: HTMLElement): void {
  headerBox.querySelector(HEADER_IMG)?.remove()
  headerBox.querySelector(REMOVE_BUTTON)?.remove()
  for (const el of headerBox.querySelectorAll<HTMLElement>('[class*="sample_token"]')) el.style.display = ''
  for (const span of promptSpans(headerBox)) span.style.display = ''
  headerBox.style.position = 'relative'
  headerBox.style.border = ''
  headerBox.style.padding = ''
  headerBox.style.margin = ''
  headerBox.style.outline = ''
  headerBox.style.background = ''
}

/** Versionを開いたとき: そのVersionの画像にそろえる（無ければ外す） */
export function syncHeaderImage(root: ParentNode, src: string | null): void {
  const headerBox = findHeaderBox(root)
  if (headerBox === null) return
  if (src === null) hideHeaderImage(headerBox)
  else showHeaderImage(headerBox, src)
  relayout()
}

/** 利用者が画像を選んで置いたとき（自動保存の合図も出す） */
export function placeHeaderImage(headerBox: HTMLElement, src: string): void {
  showHeaderImage(headerBox, src)
  notifyEditorChanged(headerBox)
  relayout()
}
