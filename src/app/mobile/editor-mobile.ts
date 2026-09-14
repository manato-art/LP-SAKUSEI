/**
 * LPエディタのスマホ版（2026-09-13 / 14・本人指示）。
 *
 * PCは「Version一覧 / キャンバス / プロパティ」を横に3つ並べるが、375pxだと
 * キャンバスが潰れて編集できない。スマホでは**キャンバスを主役**にし、残りは下から出す。
 *
 * 出し方（2026-09-14 に変更・本人指示「上の2つのボタンはいらない」）:
 *   - プロパティ … 本文の文字を選ぶと自動で開き、選択を外すと閉じる（ボタンを置かない）
 *   - Version一覧 … 上のタブの「Version」をもう一度押すと開く（今いるタブなので遷移しない）
 * 実際の見た目の組み替えは `mobile-css.ts`（@media の中）。ここは開閉の合図だけ持つ。
 */
import { T, el } from '../ui.ts'

const CLOSE_ID = 'sb-m-sheet-close'
/** body に付ける合図。CSSがこれを見て下から出す */
export const VERSIONS_OPEN_CLASS = 'sb-m-versions-open'
export const PROPS_OPEN_CLASS = 'sb-m-props-open'

let wired: (() => void) | null = null

function openOnly(target: string | null): void {
  for (const name of [VERSIONS_OPEN_CLASS, PROPS_OPEN_CLASS]) {
    document.body.classList.toggle(name, name === target)
  }
}

/** 開いているものを閉じる「×」（開いている間だけ出す） */
function ensureCloseButton(): void {
  if (document.getElementById(CLOSE_ID) !== null) return
  const btn = el('button', {
    text: '×',
    style: [
      'position:fixed;right:10px;z-index:9600;display:none',
      `width:36px;height:36px;border-radius:50%;border:1px solid ${T.line}`,
      `background:${T.surface};color:${T.text};font-size:20px;line-height:1;cursor:pointer`,
      'align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.2)',
    ].join(';'),
  })
  btn.id = CLOSE_ID
  btn.type = 'button'
  btn.setAttribute('aria-label', '閉じる')
  btn.addEventListener('mousedown', (event) => event.preventDefault())
  btn.addEventListener('click', () => openOnly(null))
  document.body.append(btn)
}

/** 本文の文字を選んだら、プロパティを自動で開く（選択が外れたら閉じる） */
function watchSelection(root: HTMLElement): () => void {
  const onChange = (): void => {
    const selection = document.getSelection()
    if (selection === null || selection.rangeCount === 0) return
    const node = selection.anchorNode
    const inCanvas = node !== null && root.querySelector('.ql-editor')?.contains(node) === true
    if (!inCanvas) return
    // 文字を選んだら開く。カーソルだけ（選択なし）に戻したら閉じる
    if (selection.toString().length > 0) openOnly(PROPS_OPEN_CLASS)
    else if (document.body.classList.contains(PROPS_OPEN_CLASS)) openOnly(null)
  }
  document.addEventListener('selectionchange', onChange)
  return () => document.removeEventListener('selectionchange', onChange)
}

/** 上のタブの「Version」をもう一度押したら、Version一覧を開く */
function wireVersionTab(root: HTMLElement): () => void {
  const tab = [...root.querySelectorAll<HTMLElement>('.topnav-tab')].find(
    (t) => (t.textContent ?? '').trim() === 'Version',
  )
  if (tab === undefined) return () => undefined
  const onClick = (event: Event): void => {
    // 今いるタブを押したときだけ（別タブへの移動は邪魔しない）
    if (!tab.classList.contains('active')) return
    event.preventDefault()
    event.stopPropagation()
    openOnly(document.body.classList.contains(VERSIONS_OPEN_CLASS) ? null : VERSIONS_OPEN_CLASS)
  }
  tab.addEventListener('click', onClick, true)
  return () => tab.removeEventListener('click', onClick, true)
}

/** スマホのエディタに、開閉の仕掛けを付ける */
export function applyMobileEditor(root: HTMLElement): void {
  teardownMobileEditor()
  ensureCloseButton()
  const offSelection = watchSelection(root)
  const offTab = wireVersionTab(root)
  wired = (): void => {
    offSelection()
    offTab()
  }
}

/** エディタから離れるとき。開きっぱなしの合図も見張りも残さない */
export function teardownMobileEditor(): void {
  wired?.()
  wired = null
  document.getElementById(CLOSE_ID)?.remove()
  document.body.classList.remove(VERSIONS_OPEN_CLASS, PROPS_OPEN_CLASS)
}
