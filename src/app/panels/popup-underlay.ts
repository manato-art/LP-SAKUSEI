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

/** ポップアップが出る所（離脱防止＝まん中・追従型＝上の帯／下の帯／右下／左下） */
export type UnderlayPlace = 'center' | 'top' | 'bottom' | 'bottom-right' | 'bottom-left'

/** 後ろにLPを敷いたときの見せ方 */
export interface UnderlayStyle {
  /** 暗い幕（離脱防止だけ。追従型はLPにそのまま重なる） */
  readonly dim: boolean
  readonly place: UnderlayPlace
}

/** 出る所ごとの、見たまま画面の中での中身の置き方（縦に並べた箱の中の余白） */
const PLACE_MARGIN: Readonly<Record<UnderlayPlace, string>> = {
  center: 'auto',
  top: '0 auto auto',
  bottom: 'auto auto 0',
  'bottom-right': 'auto 0 0 auto',
  'bottom-left': 'auto auto 0 0',
}

export interface PopupUnderlay {
  /** 後ろのLPの幅（スマホで見るときは 375px。null は見たまま画面の幅いっぱい） */
  readonly setWidth: (width: number | null) => void
}

export function attachPopupUnderlay(
  editorBody: HTMLElement,
  contentDiv: HTMLElement,
  lpUrl: Promise<string | null>,
  look: UnderlayStyle,
): PopupUnderlay {
  const body = editorBody // eslint-safe alias（no-param-reassign 回避）
  const content = contentDiv
  body.style.position = 'relative'
  content.style.position = 'relative'
  content.style.zIndex = '1'
  /** 「中身だけ」に戻すときの、元の並べ方 */
  const original = {
    margin: content.style.margin,
    minHeight: content.style.minHeight,
    background: content.style.background,
    boxShadow: content.style.boxShadow,
    paddingTop: body.style.paddingTop,
    paddingBottom: body.style.paddingBottom,
  }

  const layer = document.createElement('div')
  layer.dataset['popupUnderlay'] = 'true'
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;display:none;overflow:hidden'
  const frame = document.createElement('iframe')
  frame.title = '後ろのLP'
  frame.tabIndex = -1
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  frame.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:0;background:#fff'
  layer.append(frame)
  if (look.dim) {
    const dim = document.createElement('div')
    dim.style.cssText = `position:absolute;inset:0;background:${DIM}`
    layer.append(dim)
  }

  // 切り替え（見たまま画面の左上。上の帯のときは帯と重ならないよう左下）
  const toggle = document.createElement('div')
  toggle.dataset['popupUnderlayToggle'] = 'true'
  toggle.setAttribute('role', 'radiogroup')
  toggle.setAttribute('aria-label', '見え方')
  toggle.style.cssText =
    `position:absolute;left:12px;${look.place === 'top' ? 'bottom' : 'top'}:12px;z-index:3;display:none;gap:2px;padding:3px;` +
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

  /** LPを敷くときは、配信で出る所へ中身を置く（見たまま画面を縦の箱にして余白で寄せる） */
  const setMode = (showLp: boolean): void => {
    layer.style.display = showLp ? 'block' : 'none'
    body.style.display = showLp ? 'flex' : ''
    body.style.flexDirection = showLp ? 'column' : ''
    content.style.margin = showLp ? PLACE_MARGIN[look.place] : original.margin
    content.style.flexShrink = showLp ? '0' : ''
    // LPの上では白い紙（地・影・最低の高さ）を消す（帯の下に白い余りが出ていた）。中身の地はポップアップ自身の色
    content.style.minHeight = showLp ? '0' : original.minHeight
    content.style.background = showLp ? 'transparent' : original.background
    content.style.boxShadow = showLp ? 'none' : original.boxShadow
    body.style.paddingTop = showLp && look.place === 'top' ? '0' : original.paddingTop
    body.style.paddingBottom = showLp && look.place.startsWith('bottom') ? '0' : original.paddingBottom
    paint(over, showLp)
    paint(only, !showLp)
    // 選択枠・つまみを新しい位置へ合わせ直す（大きさは変わらないので、ResizeObserver では気づかない）
    window.dispatchEvent(new Event('resize'))
  }
  over.addEventListener('click', () => setMode(true))
  only.addEventListener('click', () => setMode(false))

  body.prepend(layer)
  body.append(toggle)

  void lpUrl.then(
    (url) => {
      if (url === null) return
      frame.src = url
      toggle.style.display = 'inline-flex'
      setMode(true)
    },
    () => undefined, // LPが読めなければ、今までどおり中身だけ
  )

  return {
    setWidth: (width) => {
      frame.style.width = width === null ? '100%' : `${width}px`
      frame.style.left = width === null ? '0' : '50%'
      frame.style.transform = width === null ? '' : 'translateX(-50%)'
    },
  }
}

function paint(button: HTMLButtonElement, on: boolean): void {
  const b = button // eslint-safe alias（no-param-reassign 回避）
  b.setAttribute('aria-checked', String(on))
  b.style.background = on ? '#1F2430' : 'transparent'
  b.style.color = on ? '#fff' : '#3F4450'
  b.style.fontWeight = on ? '700' : '400'
}
