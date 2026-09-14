/**
 * LPエディタのスマホ版（2026-09-13・本人指示「スマホでも編集できるようにする」）。
 *
 * PCは「Version一覧 / キャンバス / プロパティ」を横に3つ並べるが、375pxだと
 * キャンバスが50pxまで潰れて編集できない。スマホでは**キャンバスを主役**にし、
 * 残りは必要なときだけ下から出す:
 *   - 編集ツール（アイコンレール）… 画面下に横並びで固定（CSS側）
 *   - Version一覧 / プロパティ    … ここが出す2つのボタンで下から開く
 * 実際の見た目の組み替えは `mobile-css.ts`（@media の中）。ここは開閉の合図だけ持つ。
 */
import { T, el } from '../ui.ts'

const BAR_ID = 'sb-m-editor-bar'
/** body に付ける合図。CSSがこれを見て下から出す */
export const VERSIONS_OPEN_CLASS = 'sb-m-versions-open'
export const PROPS_OPEN_CLASS = 'sb-m-props-open'

/** どちらか片方だけを開く（2つ重なると何も見えなくなる） */
function toggle(open: string, other: string): void {
  document.body.classList.remove(other)
  document.body.classList.toggle(open)
  paint()
}

function paint(): void {
  const bar = document.getElementById(BAR_ID)
  if (bar === null) return
  for (const btn of bar.querySelectorAll<HTMLElement>('[data-open]')) {
    const on = document.body.classList.contains(btn.dataset['open'] ?? '')
    btn.style.color = on ? 'var(--sb-accent-ink, #FFF)' : T.text
    btn.style.background = on ? 'var(--sb-accent, #0091FF)' : T.surface
    btn.style.borderColor = on ? 'var(--sb-accent, #0091FF)' : T.line
  }
}

/** スマホのエディタに、Version一覧とプロパティを開くボタンを足す */
export function applyMobileEditor(root: HTMLElement): void {
  teardownMobileEditor()
  const bar = el('div', {
    style: [
      `position:sticky;top:0;z-index:60;background:${T.surface}`,
      `border-bottom:1px solid ${T.line};display:flex;gap:8px;padding:8px 12px`,
      `font-family:${T.font}`,
    ].join(';'),
  })
  bar.id = BAR_ID
  for (const { label, open, other } of [
    { label: 'Version', open: VERSIONS_OPEN_CLASS, other: PROPS_OPEN_CLASS },
    { label: 'プロパティ', open: PROPS_OPEN_CLASS, other: VERSIONS_OPEN_CLASS },
  ]) {
    const btn = el('button', {
      text: label,
      class: 'sb-mobile-tap',
      style: [
        `flex:1;border:1px solid ${T.line};border-radius:8px;background:${T.surface}`,
        `color:${T.text};font-size:13px;font-family:${T.font};cursor:pointer;padding:10px`,
      ].join(';'),
    })
    btn.type = 'button'
    btn.dataset['open'] = open
    btn.addEventListener('click', () => toggle(open, other))
    bar.append(btn)
  }
  root.prepend(bar)
  paint()
}

/** エディタから離れるとき。開きっぱなしの合図を残さない */
export function teardownMobileEditor(): void {
  document.getElementById(BAR_ID)?.remove()
  document.body.classList.remove(VERSIONS_OPEN_CLASS, PROPS_OPEN_CLASS)
}
