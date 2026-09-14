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
    // 押して開けるものだと一目で分かる形にする（2026-09-14 本人指摘）。
    // 左に一覧アイコン、右に「開く」向きの矢印。色はアクセント色で「触れる物」に見せる。
    const trigger = el('button', {
      class: 'sb-mobile-tap',
      style: [
        `display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:12px 14px`,
        `border:1px solid var(--sb-accent, #2563EB);border-radius:8px;background:${T.surface}`,
        `color:var(--sb-accent, #2563EB);font-weight:600`,
        `font-size:14px;font-family:${T.font};cursor:pointer;width:100%;justify-content:space-between`,
      ].join(';'),
    })
    trigger.innerHTML =
      '<span style="display:flex;align-items:center;gap:8px">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>' +
      'カテゴリーを選ぶ</span>' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>'
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
    // **body ではなくモーダルの中に入れる**。body に付けると、モーダル（MUIのDialogは
    // 自前の重なり順を作る）より手前に来てしまい、引き出しの上に暗幕が乗って
    // 触れなくなる（2026-09-14 実機で発覚）。同じ重なり順の中なら z-index で並ぶ。
    root.append(backdrop)
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
