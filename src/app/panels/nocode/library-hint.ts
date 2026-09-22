/**
 * Widgetライブラリの下に浮かせて出す案内（2026-09-22・ノーコードでWidgetを作る）。
 *
 * 一覧は「左にカテゴリー｜右にカード」の横並びなので、間に差し込むと3列目になって崩れる
 * （2026-09-22 実測）。並びの外に浮かせる。カテゴリーを切り替えてもカードの中身だけが
 * 入れ替わるので、ここに置けば消えない。
 */
import { T, el } from '../../ui.ts'

const HINT_ATTR = 'data-nocode-hint'

export function removeLibraryHint(libraryRoot: HTMLElement): void {
  libraryRoot.querySelector(`[${HINT_ATTR}]`)?.remove()
}

/** 案内を出す（「やめる」で取り消せる）。返り値で消せる */
export function showLibraryHint(libraryRoot: HTMLElement, message: string, onCancel: () => void): () => void {
  removeLibraryHint(libraryRoot)
  const paper = libraryRoot.querySelector<HTMLElement>('.MuiDialog-paper') ?? libraryRoot
  paper.style.position = 'relative'
  const hint = el('div', {
    style:
      `position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:5;` +
      `display:flex;align-items:center;gap:14px;max-width:calc(100% - 32px);box-sizing:border-box;` +
      `padding:10px 16px;border-radius:999px;background:${T.text};color:${T.surface};` +
      `box-shadow:0 6px 24px rgba(0,0,0,.18);font:13px/1.6 ${T.font}`,
  })
  hint.setAttribute(HINT_ATTR, 'true')
  hint.setAttribute('role', 'status')
  const text = el('span', { text: message, style: 'min-width:0' })
  const cancel = el('button', {
    text: 'やめる',
    style: `flex-shrink:0;border:0;background:transparent;color:inherit;opacity:.75;font:600 12px ${T.font};cursor:pointer;padding:4px 0;text-decoration:underline`,
  })
  cancel.addEventListener('click', () => {
    hint.remove()
    onCancel()
  })
  hint.append(text, cancel)
  paper.append(hint)
  return () => hint.remove()
}
