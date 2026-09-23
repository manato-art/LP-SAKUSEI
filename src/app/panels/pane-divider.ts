/**
 * 左右の幅を変える仕切り（2026-09-24・本人の指摘「黒いところがダサい。サイズ調整できると分かりやすく・シンプルに」）。
 *
 * 以前は幅10pxの濃い帯（本番の実測色 #2B2B2B）で、動かせると気付きにくかった。
 *  - 見た目: 白地に細い線1本＋真ん中につまみ（点が縦に2列×3つ）。何でも箱にしない
 *  - マウスを乗せる・つかむ・キーで選ぶと、線とつまみが青くなる
 *  - ドラッグで右の幅を変える（左は残り全部）。ダブルクリックで元の幅に戻す
 *  - キーボード: ← で右を広く、→ で右を狭く（24pxずつ）
 * 左右とも最小幅を確保する。
 */
const STYLE_ID = 'pane-divider-css'
const MIN_PANE = 280
const KEY_STEP = 24

const GRIP_SVG =
  '<svg width="6" height="14" viewBox="0 0 6 14" aria-hidden="true">' +
  '<circle cx="1" cy="2" r="1"/><circle cx="5" cy="2" r="1"/>' +
  '<circle cx="1" cy="7" r="1"/><circle cx="5" cy="7" r="1"/>' +
  '<circle cx="1" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>'

const CSS = `
.pane-divider{position:relative;flex:0 0 12px;width:12px;background:#FFFFFF;cursor:col-resize;
  touch-action:none;outline:none;user-select:none}
.pane-divider::before{content:"";position:absolute;top:0;bottom:0;left:50%;width:1px;transform:translateX(-50%);
  background:#E3E6EA;transition:background .15s,width .15s}
.pane-divider__grip{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:14px;height:36px;
  box-sizing:border-box;border:1px solid #D5DAE0;border-radius:999px;background:#FFFFFF;color:#8A94A3;
  display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.08);
  transition:border-color .15s,color .15s,box-shadow .15s}
.pane-divider__grip svg{display:block;fill:currentColor}
.pane-divider:hover::before,.pane-divider:focus-visible::before,.pane-divider[data-dragging="true"]::before{
  width:2px;background:var(--sb-accent,#0091FF)}
.pane-divider:hover .pane-divider__grip,.pane-divider:focus-visible .pane-divider__grip,
.pane-divider[data-dragging="true"] .pane-divider__grip{border-color:var(--sb-accent,#0091FF);color:var(--sb-accent,#0091FF);
  box-shadow:0 0 0 3px rgba(0,145,255,.15)}
@media (prefers-reduced-motion:reduce){.pane-divider::before,.pane-divider__grip{transition:none}}
`

function ensureCss(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.append(style)
}

export interface PaneDividerOptions {
  /** 幅を変える右の列（左は残り全部） */
  readonly rightPane: HTMLElement
  /** 左右の列を並べている器（全体の幅を測る） */
  readonly container: HTMLElement
  /** ダブルクリックで戻す、右の列の元の flex（例 `0 0 560px`） */
  readonly defaultFlex: string
}

export function buildPaneDivider(options: PaneDividerOptions): HTMLElement {
  ensureCss()
  const { rightPane, container, defaultFlex } = options
  const pane = rightPane // eslint-safe alias（no-param-reassign 回避）
  const divider = document.createElement('div')
  divider.className = 'pane-divider'
  divider.setAttribute('role', 'separator')
  divider.setAttribute('aria-orientation', 'vertical')
  divider.setAttribute('aria-label', '左右の幅を変える')
  divider.tabIndex = 0
  divider.title = 'ドラッグで左右の幅を変える（ダブルクリックで元の幅）'
  const grip = document.createElement('span')
  grip.className = 'pane-divider__grip'
  grip.innerHTML = GRIP_SVG
  divider.append(grip)

  /** 右の列の幅を決める（左右とも最小幅を残す） */
  const setRightWidth = (width: number): void => {
    const max = container.clientWidth - divider.offsetWidth - MIN_PANE
    const next = Math.round(Math.min(Math.max(width, MIN_PANE), Math.max(max, MIN_PANE)))
    pane.style.flex = `0 0 ${next}px`
  }

  divider.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = pane.getBoundingClientRect().width
    divider.dataset['dragging'] = 'true'
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    try {
      divider.setPointerCapture(event.pointerId)
    } catch {
      /* 掴めない環境でも、仕切りの上で動かせば効く */
    }
    const onMove = (ev: PointerEvent): void => setRightWidth(startWidth - (ev.clientX - startX))
    const onUp = (): void => {
      divider.removeEventListener('pointermove', onMove)
      divider.removeEventListener('pointerup', onUp)
      divider.removeEventListener('pointercancel', onUp)
      delete divider.dataset['dragging']
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    divider.addEventListener('pointermove', onMove)
    divider.addEventListener('pointerup', onUp)
    divider.addEventListener('pointercancel', onUp)
  })

  divider.addEventListener('dblclick', () => {
    pane.style.flex = defaultFlex
  })

  divider.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const width = pane.getBoundingClientRect().width
    setRightWidth(event.key === 'ArrowLeft' ? width + KEY_STEP : width - KEY_STEP)
  })

  return divider
}
