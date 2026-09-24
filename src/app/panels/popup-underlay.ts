/**
 * ポップアップの中身を直す画面の「LPの上に重ねて見る」（2026-09-24・本人「必ず実装したい」）。
 *
 * 見たまま画面（editorBody）の後ろに、そのLPのプレビュー（/preview/:versionUid?bare=1＝帯とポップアップ抜き）を
 * iframe で敷き、配信と同じ暗い幕を重ねる。直しているポップアップ（contentDiv）はその上。
 * 左上の切り替えで「LPの上に重ねて見る／中身だけ」。LPが無いとき（まだ読めない・無い）は切り替えを出さない。
 * 後ろのLPは見るだけ（押せない）。sandbox は allow-scripts allow-same-origin（LPの見え方に要るスクリプトは動かし、
 * 画面ごとの移動＝top の書き換えは止める）。allow-scripts だけ（別の出どころ扱い）にすると、ブラウザによっては
 * 読み込み自体を止める（2026-09-24 実測: ERR_BLOCKED_BY_CLIENT）。中身は自分のLP（Widgetのスクリプトは編集画面でも動かしている）。
 */

/** 配信の暗い幕（delivery-popup-html.ts の .ep-overlay と同じ濃さ） */
const DIM = 'rgba(0,0,0,.4)'

export function attachPopupUnderlay(editorBody: HTMLElement, contentDiv: HTMLElement, lpUrl: Promise<string | null>): void {
  const body = editorBody // eslint-safe alias（no-param-reassign 回避）
  const content = contentDiv
  body.style.position = 'relative'
  content.style.position = 'relative'
  content.style.zIndex = '1'

  const layer = document.createElement('div')
  layer.dataset['popupUnderlay'] = 'true'
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;display:none;overflow:hidden'
  const frame = document.createElement('iframe')
  frame.title = '後ろのLP'
  frame.tabIndex = -1
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff'
  const dim = document.createElement('div')
  dim.style.cssText = `position:absolute;inset:0;background:${DIM}`
  layer.append(frame, dim)

  // 左上の切り替え（見たまま画面の中で上にとどまる）
  const toggle = document.createElement('div')
  toggle.dataset['popupUnderlayToggle'] = 'true'
  toggle.setAttribute('role', 'radiogroup')
  toggle.setAttribute('aria-label', '見え方')
  toggle.style.cssText =
    'position:sticky;top:0;z-index:2;display:none;width:max-content;gap:2px;padding:3px;margin:0 0 12px;' +
    'background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(16,24,40,.18)'
  const option = (label: string, on: boolean): HTMLButtonElement => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = label
    b.setAttribute('role', 'radio')
    b.style.cssText = 'height:30px;padding:0 12px;border:none;border-radius:8px;font:12.5px/1 "Hiragino Sans",sans-serif;cursor:pointer'
    paint(b, on)
    return b
  }
  const over = option('LPの上に重ねて見る', true)
  const only = option('中身だけ', false)
  toggle.append(over, only)
  const setMode = (showLp: boolean): void => {
    layer.style.display = showLp ? 'block' : 'none'
    paint(over, showLp)
    paint(only, !showLp)
  }
  over.addEventListener('click', () => setMode(true))
  only.addEventListener('click', () => setMode(false))

  body.prepend(layer)
  body.insertBefore(toggle, content)

  void lpUrl.then(
    (url) => {
      if (url === null) return
      frame.src = url
      toggle.style.display = 'inline-flex'
      setMode(true)
    },
    () => undefined, // LPが読めなければ、今までどおり中身だけ
  )
}

function paint(button: HTMLButtonElement, on: boolean): void {
  const b = button // eslint-safe alias（no-param-reassign 回避）
  b.setAttribute('aria-checked', String(on))
  b.style.background = on ? '#1F2430' : 'transparent'
  b.style.color = on ? '#fff' : '#3F4450'
  b.style.fontWeight = on ? '700' : '400'
}
