/**
 * Widgetライブラリのカテゴリーを「左から出す引き出し」にする（2026-09-14・本人指示）。
 *
 * 実物は「左にカテゴリー／右にカード」の横並び。390pxだとカテゴリーが場所を取り、
 * 縦に積んでも画面の上半分を使ってしまう。スマホでは普段しまっておき、
 * 「カテゴリー」ボタンで左から重ねて出す（選ぶ・暗幕を押すと閉じる）。
 * 見た目の組み替えは mobile-css.ts、ここは開閉の合図と部品だけ持つ。
 */
import { T, el } from '../ui.ts'
import { WIDGET_CATEGORY_OPEN_CLASS } from './sheet-classes.ts'

const TRIGGER_ID = 'sb-m-widget-cat'
const BACKDROP_ID = 'sb-m-widget-cat-backdrop'

function close(): void {
  document.body.classList.remove(WIDGET_CATEGORY_OPEN_CLASS)
}

/** ライブラリを開いたときに呼ぶ（スマホのときだけ） */
export function applyMobileWidgetLibrary(root: HTMLElement): void {
  const content = root.querySelector<HTMLElement>('.MuiDialogContent-root')
  const wrapper = content?.querySelector<HTMLElement>(':scope > .MuiBox-root')
  const category = wrapper?.firstElementChild
  if (content === null || content === undefined || !(category instanceof HTMLElement)) return
  close()

  if (document.getElementById(TRIGGER_ID) === null) {
    const trigger = el('button', {
      text: 'カテゴリー',
      class: 'sb-mobile-tap',
      style: [
        `display:flex;align-items:center;gap:6px;margin:0 0 10px;padding:10px 14px`,
        `border:1px solid ${T.line};border-radius:8px;background:${T.surface};color:${T.text}`,
        `font-size:13px;font-family:${T.font};cursor:pointer;width:100%;justify-content:center`,
      ].join(';'),
    })
    trigger.id = TRIGGER_ID
    trigger.type = 'button'
    trigger.addEventListener('click', () => {
      document.body.classList.toggle(WIDGET_CATEGORY_OPEN_CLASS)
    })
    content.prepend(trigger)
  }

  if (document.getElementById(BACKDROP_ID) === null) {
    const backdrop = el('div', {
      style: 'position:fixed;inset:0;z-index:9700;background:rgba(0,0,0,.4);display:none',
    })
    backdrop.id = BACKDROP_ID
    backdrop.addEventListener('click', close)
    document.body.append(backdrop)
  }

  // カテゴリーを選んだら引き出しを閉じる（選んだ結果をすぐ見たいので）
  category.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('button, a, li, [role="button"]') !== null) close()
  })
}

/** ライブラリを閉じたとき。合図と部品を残さない */
export function teardownMobileWidgetLibrary(): void {
  close()
  document.getElementById(TRIGGER_ID)?.remove()
  document.getElementById(BACKDROP_ID)?.remove()
}
