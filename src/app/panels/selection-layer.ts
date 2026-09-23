/**
 * 見たまま画面で「選んでいるもの」を示す枠と、大きさを直接ドラッグするハンドル（2026-09-23・Widget編集 第2弾）。
 *
 * 押した部品の外側に枠と名前を出す。右側の入力欄と同じ部品を指す（Canva の選択枠）。
 * 枠は Widget の中身（contentDiv）の外の層に置く（中に置くとコード欄へ書き出されて保存されてしまう。
 * 並んでいる部品の操作ボタン item-toolbar.ts と同じ作り）。スクロール・打ち直し・大きさの変化に追従する。
 *
 * ハンドル（つまみ）: 右の辺＝幅、下の辺＝高さ、右下の角＝文字の大きさ、上下の辺＝Widgetの上下の余白。
 * 何をどう変えるかは呼ぶ側が SelectionHandle で渡す（部品モードは設定データ、HTMLモードはCSSの設定）。
 * 動かしている間は preview（見た目だけ）、離したら commit（確定）。値の計算は drag-math.ts。
 */
import { dragValue, type NumberRange } from './drag-math.ts'

const ACCENT = 'var(--sb-accent, #0091FF)'
const INK = 'var(--sb-accent-ink, #FFFFFF)'
const FONT = '"Hiragino Sans",sans-serif'

export type HandleKind = 'width' | 'height' | 'font' | 'padTop' | 'padBottom'

export interface SelectionHandle {
  readonly kind: HandleKind
  /** つまみの上に出す名前（「幅」「文字の大きさ」） */
  readonly label: string
  readonly unit: string
  readonly range: NumberRange
  readonly read: () => number
  /** 値の1単位あたりのマウスの動き(px)。幅% なら 親の幅/100、px なら 1、文字の大きさは 3 */
  readonly pxPerUnit: () => number
  /** 動かしている間（見た目だけ） */
  readonly preview: (value: number) => void
  /** 離したとき（確定） */
  readonly commit: (value: number) => void
}

export interface SelectionLayer {
  /** 枠を出す（null で消す）。label は枠の上に出す名前。handles はつまみ。soft は薄い枠（Widget全体） */
  readonly select: (el: HTMLElement | null, label?: string, handles?: readonly SelectionHandle[], options?: { soft?: boolean }) => void
  readonly current: () => HTMLElement | null
  /** 位置を合わせ直す（描き直したあとなど） */
  readonly refresh: () => void
}

/** つまみの置き場所と、マウスの動きのどちらを使うか */
const HANDLE_PLACE: Readonly<Record<HandleKind, { style: string; cursor: string; delta: (dx: number, dy: number) => number }>> = {
  width: { style: 'left:100%;top:50%', cursor: 'ew-resize', delta: (dx) => dx },
  height: { style: 'left:50%;top:100%', cursor: 'ns-resize', delta: (_dx, dy) => dy },
  font: { style: 'left:100%;top:100%', cursor: 'nwse-resize', delta: (dx, dy) => (dx + dy) / 2 },
  padTop: { style: 'left:50%;top:0', cursor: 'ns-resize', delta: (_dx, dy) => -dy },
  padBottom: { style: 'left:50%;top:100%', cursor: 'ns-resize', delta: (_dx, dy) => dy },
}

export function createSelectionLayer(editorBody: HTMLElement, contentDiv: HTMLElement): SelectionLayer {
  const layer = document.createElement('div')
  layer.dataset['widgetSelectionLayer'] = 'true'
  layer.style.cssText = 'position:relative;height:0;width:0'
  editorBody.prepend(layer)

  const frame = document.createElement('div')
  frame.style.cssText =
    `position:absolute;display:none;pointer-events:none;z-index:9997;box-sizing:border-box;` +
    `outline:2px solid ${ACCENT};outline-offset:2px;border-radius:2px`
  const tag = document.createElement('div')
  tag.style.cssText =
    `position:absolute;left:-2px;top:-2px;transform:translateY(-100%);padding:2px 7px;border-radius:4px 4px 0 0;` +
    `background:${ACCENT};color:${INK};font:600 11px/1.4 ${FONT};white-space:nowrap`
  const handleBox = document.createElement('div')
  handleBox.style.cssText = 'position:absolute;inset:0'
  /** 動かしている間に出す値（「幅 80%」） */
  const tip = document.createElement('div')
  tip.style.cssText =
    `position:absolute;display:none;z-index:1;padding:3px 8px;border-radius:4px;background:#1F2A37;color:#fff;` +
    `font:600 11px/1.4 ${FONT};white-space:nowrap;transform:translate(-50%,-140%);pointer-events:none`
  frame.append(tag, handleBox, tip)
  layer.append(frame)

  let current: HTMLElement | null = null

  const place = (): void => {
    if (current === null || !contentDiv.contains(current)) {
      frame.style.display = 'none'
      current = null
      return
    }
    const origin = layer.getBoundingClientRect()
    const rect = current.getBoundingClientRect()
    frame.style.display = 'block'
    frame.style.top = `${rect.top - origin.top}px`
    frame.style.left = `${rect.left - origin.left}px`
    frame.style.width = `${rect.width}px`
    frame.style.height = `${rect.height}px`
    // 枠がいちばん上にあるときは名前を枠の中に入れる（見たまま画面の上端で切れないように）
    const view = editorBody.getBoundingClientRect()
    const inside = rect.top - view.top < 24
    tag.style.transform = inside ? 'none' : 'translateY(-100%)'
    tag.style.borderRadius = inside ? '0 0 4px 0' : '4px 4px 0 0'
  }

  let raf = 0
  const schedule = (): void => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(place)
  }
  editorBody.addEventListener('scroll', schedule)
  contentDiv.addEventListener('input', schedule)
  window.addEventListener('resize', schedule)
  const observer = new ResizeObserver(schedule)
  observer.observe(contentDiv)

  const buildHandle = (handle: SelectionHandle): HTMLElement => {
    const spot = HANDLE_PLACE[handle.kind]
    const knob = document.createElement('div')
    knob.dataset['widgetHandle'] = handle.kind
    knob.setAttribute('role', 'slider')
    knob.setAttribute('aria-label', `${handle.label}をドラッグで変える`)
    knob.title = `${handle.label}（ドラッグで変える）`
    knob.style.cssText =
      `position:absolute;${spot.style};width:12px;height:12px;box-sizing:border-box;transform:translate(-50%,-50%);` +
      `border:2px solid ${ACCENT};background:#fff;border-radius:3px;cursor:${spot.cursor};pointer-events:auto;` +
      `touch-action:none;box-shadow:0 1px 3px rgba(0,0,0,.25)`
    knob.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      const start = handle.read()
      if (!Number.isFinite(start)) return
      const startX = event.clientX
      const startY = event.clientY
      const perUnit = handle.pxPerUnit()
      let value = start
      try {
        knob.setPointerCapture(event.pointerId)
      } catch {
        /* 掴めない環境（合成イベントなど）でも、つまみの上で動かせば効く */
      }
      document.body.style.cursor = spot.cursor
      const showTip = (): void => {
        tip.style.display = 'block'
        tip.style.left = `${knob.offsetLeft}px`
        tip.style.top = `${knob.offsetTop}px`
        tip.textContent = `${handle.label} ${value}${handle.unit}`
      }
      showTip()
      const onMove = (ev: PointerEvent): void => {
        value = dragValue(start, spot.delta(ev.clientX - startX, ev.clientY - startY), perUnit, handle.range)
        handle.preview(value)
        place()
        showTip()
      }
      const onUp = (): void => {
        knob.removeEventListener('pointermove', onMove)
        knob.removeEventListener('pointerup', onUp)
        knob.removeEventListener('pointercancel', onUp)
        document.body.style.cursor = ''
        tip.style.display = 'none'
        if (value !== start) handle.commit(value)
        schedule()
      }
      knob.addEventListener('pointermove', onMove)
      knob.addEventListener('pointerup', onUp)
      knob.addEventListener('pointercancel', onUp)
    })
    return knob
  }

  return {
    select: (el, label = '', handles = [], options = {}) => {
      current = el
      tag.textContent = label
      tag.style.display = label === '' ? 'none' : 'block'
      frame.style.outline = options.soft === true ? `1px dashed ${ACCENT}` : `2px solid ${ACCENT}`
      tag.style.opacity = options.soft === true ? '.8' : '1'
      handleBox.replaceChildren(...handles.map(buildHandle))
      place()
    },
    current: () => current,
    refresh: schedule,
  }
}
