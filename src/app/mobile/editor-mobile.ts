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
const PROPS_BTN_ID = 'sb-m-props-btn'
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

/**
 * プロパティを開く丸ボタン（キャンバスの右下・ツールバーの上）。
 * スマホはタップするとカーソルが立つだけで「選択」にならないので、
 * 選択したときの自動表示だけでは開けない場面がある（2026-09-14 本人指摘）。
 */
function ensurePropsButton(): void {
  if (document.getElementById(PROPS_BTN_ID) !== null) return
  const btn = el('button', {
    style: [
      'position:fixed;right:12px;z-index:9300;display:flex',
      `width:48px;height:48px;border-radius:50%;border:1px solid ${T.line}`,
      `background:${T.surface};color:${T.text};cursor:pointer`,
      'align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.22)',
    ].join(';'),
  })
  btn.id = PROPS_BTN_ID
  btn.type = 'button'
  btn.title = 'プロパティ'
  btn.setAttribute('aria-label', 'プロパティ')
  // 押した瞬間に本文の選択が外れると、パネルが「選択してください」に戻ってしまう
  for (const type of ['mousedown', 'pointerdown', 'touchstart'] as const) {
    btn.addEventListener(type, (event) => event.preventDefault())
  }
  btn.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/>' +
    '<circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>'
  btn.addEventListener('click', () => {
    openOnly(document.body.classList.contains(PROPS_OPEN_CLASS) ? null : PROPS_OPEN_CLASS)
  })
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
    // 文字を選んだら開く。カーソルだけに戻したときは、閉じずにそのままにする
    // （閉じると、書式を変えようとした先から消えてしまう）
    if (selection.toString().length > 0) openOnly(PROPS_OPEN_CLASS)
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
  ensurePropsButton()
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
  document.getElementById(PROPS_BTN_ID)?.remove()
  document.body.classList.remove(VERSIONS_OPEN_CLASS, PROPS_OPEN_CLASS)
}
