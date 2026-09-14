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
import Quill from 'quill'
import { T, el } from '../ui.ts'
import { PROPS_OPEN_CLASS, VERSIONS_OPEN_CLASS } from './sheet-classes.ts'

const CLOSE_ID = 'sb-m-sheet-close'
const PROPS_BTN_ID = 'sb-m-props-btn'
const RANGE_BAR_ID = 'sb-m-range-bar'

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
  keepSelectionOnPress(btn)
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
  keepSelectionOnPress(btn)
  btn.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/>' +
    '<circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>'
  btn.addEventListener('click', () => {
    openOnly(document.body.classList.contains(PROPS_OPEN_CLASS) ? null : PROPS_OPEN_CLASS)
  })
  document.body.append(btn)
}

/**
 * ボタンを押しても本文の選択を保つ。
 *
 * **`touchstart` / `pointerdown` で preventDefault してはいけない**。
 * スマホでは後続の `click` が発火しなくなり、ボタンが無反応になる（2026-09-14 実機で発覚）。
 * PCの `mousedown` だけ止め、スマホは「最後に選んでいた範囲」を覚えておいて戻す。
 */
function keepSelectionOnPress(btn: HTMLElement): void {
  btn.addEventListener('mousedown', (event) => event.preventDefault())
}

/** 本文で最後に選んでいた範囲（スマホはボタンを押すと選択が外れるので覚えておく） */
let lastRange: { index: number; length: number } | null = null

/** 開いているエディタの Quill を掴む（描画側から渡さなくても取れる） */
function findQuill(root: HTMLElement): Quill | null {
  const container = root.querySelector('.ql-container')
  if (container === null) return null
  const found = Quill.find(container)
  return found instanceof Quill ? found : null
}

/**
 * 選択範囲を広げる（2026-09-14・本人指摘）。
 *
 * スマホはダブルタップすると**単語だけ**が選ばれる。端によってはそこから
 * 文章全体へ伸ばすのが難しく、段落まるごとに書式を当てられない。
 * 「この段落」「全部」を1回押すだけで選び直せるようにする。
 */
function expandSelection(root: HTMLElement, scope: 'line' | 'all'): void {
  const quill = findQuill(root)
  if (quill === null) return
  if (scope === 'all') {
    quill.setSelection(0, quill.getLength(), 'user')
    return
  }
  // ボタンを押した時点で選択が外れていることがあるので、覚えておいた範囲で補う
  const range = quill.getSelection() ?? lastRange
  if (range === null) return
  const [line] = quill.getLine(range.index)
  if (line === null) return
  const start = quill.getIndex(line)
  // line.length() は行末の改行を含む。改行まで含めると書式が次の行へにじむので1つ減らす
  const length = line.length() > 1 ? line.length() - 1 : line.length()
  quill.setSelection(start, length, 'user')
}

/** 「この段落」「全部」で選び直す小さなバー（プロパティを開いている間だけ出す） */
function ensureRangeBar(root: HTMLElement): void {
  if (document.getElementById(RANGE_BAR_ID) !== null) return
  const bar = el('div', {
    style: [
      'position:fixed;left:10px;z-index:9600;display:none;gap:6px',
      `font-family:${T.font}`,
    ].join(';'),
  })
  bar.id = RANGE_BAR_ID
  for (const { label, scope } of [
    { label: 'この段落を選ぶ', scope: 'line' as const },
    { label: '全部を選ぶ', scope: 'all' as const },
  ]) {
    const btn = el('button', {
      text: label,
      style: [
        `height:36px;padding:0 12px;border-radius:18px;border:1px solid ${T.line}`,
        `background:${T.surface};color:${T.text};font-size:12px;font-family:${T.font};cursor:pointer`,
        'box-shadow:0 2px 8px rgba(0,0,0,.18);white-space:nowrap',
      ].join(';'),
    })
    btn.type = 'button'
    keepSelectionOnPress(btn)
    btn.addEventListener('click', () => expandSelection(root, scope))
    bar.append(btn)
  }
  document.body.append(bar)
}

/** 本文の文字を選んだら、プロパティを自動で開く（選択が外れたら閉じる） */
function watchSelection(root: HTMLElement): () => void {
  const quill = findQuill(root)
  const onQuillChange = (range: { index: number; length: number } | null): void => {
    if (range !== null) lastRange = { index: range.index, length: range.length }
  }
  quill?.on('selection-change', onQuillChange)
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
  return () => {
    document.removeEventListener('selectionchange', onChange)
    quill?.off('selection-change', onQuillChange)
  }
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
  ensureRangeBar(root)
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
  lastRange = null
  document.getElementById(CLOSE_ID)?.remove()
  document.getElementById(PROPS_BTN_ID)?.remove()
  document.getElementById(RANGE_BAR_ID)?.remove()
  document.body.classList.remove(VERSIONS_OPEN_CLASS, PROPS_OPEN_CLASS)
}
