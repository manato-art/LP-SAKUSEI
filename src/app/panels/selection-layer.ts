/**
 * 見たまま画面で「選んでいるもの」を示す枠と、大きさ・位置を直接ドラッグする道具（2026-09-23・Widget編集 第2弾。
 * 2026-09-24: 部品を動かすつかみ所・マウスを乗せたときの薄い枠・並び替えの線を足した）。
 *
 * 押した部品の外側に枠と名前を出す。右側の入力欄と同じ部品を指す（Canva の選択枠）。
 * 枠は Widget の中身（contentDiv）の外の層に置く（中に置くとコード欄へ書き出されて保存されてしまう。
 * 並んでいる部品の操作ボタン item-toolbar.ts と同じ作り）。スクロール・打ち直し・大きさの変化に追従する。
 *
 * つまみ: 右の辺（左に置いた部品は左の辺）＝幅、下の辺＝高さ、右下の角＝文字の大きさ、上下の辺＝Widgetの上下の余白。
 * つかみ所（枠の上のまん中）: つかんで動かすと部品ごと動く（左右で置く位置、上下で並び順。何をするかは呼ぶ側）。
 * 何をどう変えるかは呼ぶ側が渡す。動かしている間は preview（見た目だけ）、離したら commit（確定）。値の計算は drag-math.ts。
 * 補助線（2026-09-24）: 吸い付いた所にピンクの線、離したら収まる所に点線の影。つまみは snaps の値に吸い付く。
 */
import { dragValue, nearestSnap, type NumberRange, type Span } from './drag-math.ts'

const ACCENT = 'var(--sb-accent, #0091FF)'
const INK = 'var(--sb-accent-ink, #FFFFFF)'
const FONT = '"Hiragino Sans",sans-serif'
/** 補助線の色（選択枠の青と見分ける。デザインの道具でよく使うピンク） */
const GUIDE = '#E8338A'

export type HandleKind = 'width' | 'widthLeft' | 'height' | 'font' | 'padTop' | 'padBottom'

/** 縦の補助線（画面の x と、線を引く上下の範囲） */
export interface GuideLine {
  readonly x: number
  readonly top: number
  readonly bottom: number
}

/** つまみの吸い付き先（その値になったら、lines に補助線を出す） */
export interface SnapPoint {
  readonly value: number
  readonly lines: readonly GuideLine[]
}

/** 画面の上の四角（getBoundingClientRect と同じ座標） */
export interface ScreenBox {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

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
  /** 吸い付き先（動かし始めたときに1回だけ読む） */
  readonly snaps?: () => readonly SnapPoint[]
}

/** 部品ごと動かす（つかみ所・部品そのものをつかんだとき）。動かしている間の説明を返すと吹き出しに出す */
export interface SelectionMove {
  /** startX・startY は押した所（動かした量＝今 − 押した所） */
  readonly update: (clientX: number, clientY: number, startX: number, startY: number) => string
  readonly commit: (clientX: number, clientY: number) => void
  readonly cancel: () => void
}

export interface SelectOptions {
  /** 薄い枠（Widget全体） */
  readonly soft?: boolean
  /** 部品ごと動かせる（つかみ所を出す） */
  readonly move?: SelectionMove
}

export interface SelectionLayer {
  /** 枠を出す（null で消す）。label は枠の上に出す名前。handles はつまみ */
  readonly select: (el: HTMLElement | null, label?: string, handles?: readonly SelectionHandle[], options?: SelectOptions) => void
  readonly current: () => HTMLElement | null
  /** マウスを乗せた部品の薄い枠（null で消す） */
  readonly hover: (el: HTMLElement | null, label?: string) => void
  /** 並び替えで入る位置の線（画面の y・左端・幅。null で消す） */
  readonly dropLine: (at: { y: number; left: number; width: number } | null) => void
  /** 補助線（空で消す） */
  readonly guides: (lines: readonly GuideLine[]) => void
  /** 離したら収まる所の点線の影（null で消す） */
  readonly ghost: (box: ScreenBox | null) => void
  /** 位置を合わせ直す（描き直したあとなど） */
  readonly refresh: () => void
  /** 部品そのものをつかんで動かし始める（呼ぶ側が pointerdown で渡す。少し動いてから動き出す） */
  readonly startMove: (event: PointerEvent, move: SelectionMove) => void
}

/** つまみの置き場所と、マウスの動きのどちらを使うか */
const HANDLE_PLACE: Readonly<Record<HandleKind, { style: string; cursor: string; delta: (dx: number, dy: number) => number }>> = {
  width: { style: 'left:100%;top:50%', cursor: 'ew-resize', delta: (dx) => dx },
  widthLeft: { style: 'left:0;top:50%', cursor: 'ew-resize', delta: (dx) => -dx },
  height: { style: 'left:50%;top:100%', cursor: 'ns-resize', delta: (_dx, dy) => dy },
  font: { style: 'left:100%;top:100%', cursor: 'nwse-resize', delta: (dx, dy) => (dx + dy) / 2 },
  padTop: { style: 'left:50%;top:0', cursor: 'ns-resize', delta: (_dx, dy) => -dy },
  padBottom: { style: 'left:50%;top:100%', cursor: 'ns-resize', delta: (_dx, dy) => dy },
}

/** 部品そのものをつかんだとき、この距離(px)動いてから動かし始める（ただの押下＝選ぶ、と区別する） */
const MOVE_THRESHOLD = 5

const MOVE_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/></svg>'

/**
 * 要素の中身の箱（枠線と padding の内側・画面の座標）。
 * 幅%や左右の置き場所はこの箱が基準（部品を置ける横の範囲）
 */
export function contentBoxOf(el: HTMLElement): Span & { readonly top: number; readonly bottom: number } {
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  const px = (value: string): number => Number.parseFloat(value) || 0
  return {
    left: r.left + px(cs.borderLeftWidth) + px(cs.paddingLeft),
    right: r.right - px(cs.borderRightWidth) - px(cs.paddingRight),
    top: r.top + px(cs.borderTopWidth) + px(cs.paddingTop),
    bottom: r.bottom - px(cs.borderBottomWidth) - px(cs.paddingBottom),
  }
}

/** つかみ所・つまみを押して動かす流れ（押す→動かす→離す）。setPointerCapture が使えない環境でも動く */
function dragLoop(
  el: HTMLElement,
  event: PointerEvent,
  onMove: (ev: PointerEvent) => void,
  onEnd: (ev: PointerEvent | null) => void,
  cursor: string,
): void {
  // 右の入力欄に入力の印が残っていると、その欄は（打っている途中とみなされ）動かした値に追いつかない。外しておく
  const active = document.activeElement
  if (active instanceof HTMLElement && active !== document.body && !el.contains(active)) active.blur()
  try {
    el.setPointerCapture(event.pointerId)
  } catch {
    /* 掴めない環境でも、要素の上で動かせば効く */
  }
  document.body.style.cursor = cursor
  document.body.style.userSelect = 'none'
  const end = (ev: PointerEvent | null): void => {
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', cancel)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    onEnd(ev)
  }
  const up = (ev: PointerEvent): void => end(ev)
  const cancel = (): void => end(null)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', cancel)
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
  /** 部品ごと動かすつかみ所（枠の上のまん中） */
  const grip = document.createElement('div')
  grip.dataset['widgetMoveGrip'] = 'true'
  grip.setAttribute('role', 'button')
  grip.setAttribute('aria-label', 'つかんで動かす（左右で置く位置・上下で並び順）')
  grip.title = 'つかんで動かす（左右で置く位置・上下で並び順）'
  grip.innerHTML = MOVE_ICON
  grip.style.cssText =
    `position:absolute;left:50%;top:0;transform:translate(-50%,-50%);display:none;align-items:center;justify-content:center;` +
    `width:26px;height:20px;box-sizing:border-box;border:1.5px solid ${ACCENT};border-radius:999px;background:#fff;color:${ACCENT};` +
    `cursor:grab;pointer-events:auto;touch-action:none;box-shadow:0 1px 3px rgba(0,0,0,.15)`
  /** 動かしている間に出す値（「幅 80%」「中央に置く」） */
  const tip = document.createElement('div')
  tip.style.cssText =
    `position:absolute;display:none;z-index:1;padding:3px 8px;border-radius:4px;background:#1F2A37;color:#fff;` +
    `font:600 11px/1.4 ${FONT};white-space:nowrap;transform:translate(-50%,-140%);pointer-events:none`
  frame.append(tag, handleBox, grip, tip)

  /** マウスを乗せた部品の薄い枠 */
  const hoverFrame = document.createElement('div')
  hoverFrame.style.cssText =
    `position:absolute;display:none;pointer-events:none;z-index:9996;box-sizing:border-box;` +
    `outline:1.5px dashed ${ACCENT};outline-offset:2px;border-radius:2px`
  const hoverTag = document.createElement('div')
  hoverTag.style.cssText =
    `position:absolute;left:-2px;top:-4px;transform:translateY(-100%);padding:1px 6px;border-radius:4px;` +
    `background:rgba(255,255,255,.92);color:${ACCENT};border:1px solid ${ACCENT};font:600 10.5px/1.4 ${FONT};white-space:nowrap`
  hoverFrame.append(hoverTag)
  /** 並び替えで入る位置の線 */
  const line = document.createElement('div')
  line.style.cssText =
    `position:absolute;display:none;height:3px;border-radius:2px;background:${ACCENT};pointer-events:none;z-index:9998;` +
    `box-shadow:0 0 0 2px rgba(255,255,255,.9)`
  /** 補助線（何本でも）と、収まる所の影。動かし終わったら必ず消す */
  const guideBox = document.createElement('div')
  guideBox.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:9999'
  const ghostBox = document.createElement('div')
  ghostBox.style.cssText =
    `position:absolute;display:none;pointer-events:none;z-index:9995;box-sizing:border-box;` +
    `border:1.5px dashed ${ACCENT};background:rgba(0,145,255,.08);border-radius:2px`
  layer.append(ghostBox, hoverFrame, frame, line, guideBox)

  let current: HTMLElement | null = null
  let hovered: HTMLElement | null = null
  let move: SelectionMove | null = null

  const boxOf = (el: HTMLElement, box: HTMLElement): void => {
    const origin = layer.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    const t = box // eslint-safe alias（no-param-reassign 回避）
    t.style.top = `${rect.top - origin.top}px`
    t.style.left = `${rect.left - origin.left}px`
    t.style.width = `${rect.width}px`
    t.style.height = `${rect.height}px`
  }

  const place = (): void => {
    if (current === null || !contentDiv.contains(current)) {
      frame.style.display = 'none'
      current = null
    } else {
      frame.style.display = 'block'
      boxOf(current, frame)
      // 枠がいちばん上にあるときは名前を枠の中に入れる（見たまま画面の上端で切れないように）
      const view = editorBody.getBoundingClientRect()
      const inside = current.getBoundingClientRect().top - view.top < 24
      tag.style.transform = inside ? 'none' : 'translateY(-100%)'
      tag.style.borderRadius = inside ? '0 0 4px 0' : '4px 4px 0 0'
    }
    if (hovered === null || hovered === current || !contentDiv.contains(hovered)) {
      hoverFrame.style.display = 'none'
    } else {
      hoverFrame.style.display = 'block'
      boxOf(hovered, hoverFrame)
    }
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

  const showGuides = (lines: readonly GuideLine[]): void => {
    const o = layer.getBoundingClientRect()
    guideBox.replaceChildren(
      ...lines.map((g) => {
        const bar = document.createElement('div')
        bar.dataset['widgetGuide'] = 'true'
        bar.style.cssText =
          `position:absolute;width:1px;background:${GUIDE};left:${Math.round(g.x - o.left) - 0.5}px;` +
          `top:${g.top - o.top}px;height:${Math.max(0, g.bottom - g.top)}px`
        return bar
      }),
    )
  }
  const showGhost = (box: ScreenBox | null): void => {
    if (box === null) {
      ghostBox.style.display = 'none'
      return
    }
    const o = layer.getBoundingClientRect()
    ghostBox.style.display = 'block'
    ghostBox.style.left = `${box.left - o.left}px`
    ghostBox.style.top = `${box.top - o.top}px`
    ghostBox.style.width = `${box.width}px`
    ghostBox.style.height = `${box.height}px`
  }
  const clearGuides = (): void => {
    showGuides([])
    showGhost(null)
  }

  const showTip = (text: string, x: number, y: number): void => {
    tip.style.display = text === '' ? 'none' : 'block'
    tip.style.left = `${x}px`
    tip.style.top = `${y}px`
    tip.textContent = text
  }

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
      const snaps = handle.snaps?.() ?? []
      let value = start
      showTip(`${handle.label} ${value}${handle.unit}`, knob.offsetLeft, knob.offsetTop)
      dragLoop(
        knob,
        event,
        (ev) => {
          const raw = dragValue(start, spot.delta(ev.clientX - startX, ev.clientY - startY), perUnit, handle.range)
          const hit = nearestSnap(raw, snaps, perUnit)
          value = hit?.value ?? raw
          showGuides(hit?.lines ?? [])
          handle.preview(value)
          place()
          showTip(`${handle.label} ${value}${handle.unit}`, knob.offsetLeft, knob.offsetTop)
        },
        () => {
          showTip('', 0, 0)
          clearGuides()
          if (value !== start) handle.commit(value)
          schedule()
        },
        spot.cursor,
      )
    })
    return knob
  }

  /** 部品ごと動かす（つかみ所から・部品そのものから）。threshold は動き出すまでの距離 */
  const runMove = (source: HTMLElement, event: PointerEvent, m: SelectionMove, threshold: number): void => {
    const startX = event.clientX
    const startY = event.clientY
    let moving = threshold === 0
    const origin = (): { x: number; y: number } => {
      const o = layer.getBoundingClientRect()
      return { x: o.left, y: o.top }
    }
    dragLoop(
      source,
      event,
      (ev) => {
        if (!moving && Math.hypot(ev.clientX - startX, ev.clientY - startY) < threshold) return
        moving = true
        grip.style.cursor = 'grabbing'
        const text = m.update(ev.clientX, ev.clientY, startX, startY)
        const o = origin()
        showTip(text, ev.clientX - o.x, ev.clientY - o.y)
        place()
      },
      (ev) => {
        grip.style.cursor = 'grab'
        showTip('', 0, 0)
        clearGuides()
        if (moving && ev !== null) m.commit(ev.clientX, ev.clientY)
        else m.cancel()
        schedule()
      },
      'grabbing',
    )
  }

  grip.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || move === null) return
    event.preventDefault()
    event.stopPropagation()
    runMove(grip, event, move, 0)
  })

  return {
    select: (el, label = '', handles = [], options = {}) => {
      current = el
      move = options.move ?? null
      tag.textContent = label
      tag.style.display = label === '' ? 'none' : 'block'
      frame.style.outline = options.soft === true ? `1px dashed ${ACCENT}` : `2px solid ${ACCENT}`
      tag.style.opacity = options.soft === true ? '.8' : '1'
      handleBox.replaceChildren(...handles.map(buildHandle))
      grip.style.display = move === null ? 'none' : 'flex'
      place()
    },
    current: () => current,
    hover: (el, label = '') => {
      if (el === hovered && hoverTag.textContent === label) return
      hovered = el
      hoverTag.textContent = label
      hoverTag.style.display = label === '' ? 'none' : 'block'
      place()
    },
    dropLine: (at) => {
      if (at === null) {
        line.style.display = 'none'
        return
      }
      const o = layer.getBoundingClientRect()
      line.style.display = 'block'
      line.style.top = `${at.y - o.top - 1.5}px`
      line.style.left = `${at.left - o.left}px`
      line.style.width = `${at.width}px`
    },
    guides: showGuides,
    ghost: showGhost,
    refresh: schedule,
    startMove: (event, m) => {
      const source = event.target instanceof HTMLElement ? event.target : contentDiv
      runMove(source, event, m, MOVE_THRESHOLD)
    },
  }
}
