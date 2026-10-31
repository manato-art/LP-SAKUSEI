/**
 * 追従型ポップアップの中身を直す画面の「LPの上に重ねて見る」で、バナーをつまんで好きな場所へ動かす
 * （2026-10-30 本人「表示位置を動かしたい」→「つまんで好きな場所へ」「スマホとPCで同じ位置」）。
 *
 * バナーの横に「つまんで動かす」の手を出す（部品の選択枠のつかみ所＝部品を動かす とは別。あちらはバナーの中の並び）。
 * 置いた場所は割合で覚える（src/shared/follow-free-place.ts）。帯は上下だけ、右下・左下の小さい物は上下左右。
 * 画面＝後ろのLPの見えている所（スマホで見るときは 375px の幅）。保存は「中身を編集」の「保存」のとき（呼ぶ側）。
 * 「元の位置」で、選んだ表示位置（上の帯・下の帯・右下・左下）に戻す。
 *
 * Ctrl（Mac は ⌘）を押しながら動かすと、画面の真ん中の補助線を出し、真ん中の近く（SNAP_PX 以内）でカチッと止める
 * （指示43・2026-10-31 本人「WindowsはCtrlキー、Macはcommandキーを押しながら位置を調整すると補助線を出して。
 * カチッと真ん中にハマるようにしてほしい。補助の説明も表示して」）。説明は手の下に出す。
 */
import { freeBoxPlace, freePositionAt, type FreeKind, type FreePosition } from '../../shared/follow-free-place.ts'

/** 置いた場所の出し入れ（呼ぶ側が持つ。null＝選んだ表示位置のまま） */
export interface FreePlaceControl {
  readonly kind: FreeKind
  readonly get: () => FreePosition | null
  readonly set: (place: FreePosition | null) => void
}

export interface FreeDrag {
  /** LPを敷いて見ているか（敷いていないときは手を隠し、中身は元の並べ方） */
  readonly setShown: (shown: boolean) => void
  /** 後ろのLPの幅（スマホで見るときは 375px。null は見たまま画面の幅いっぱい） */
  readonly setStageWidth: (width: number | null) => void
}

const MOVE_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/></svg>'

/** 真ん中に止める近さ（px） */
export const SNAP_PX = 12

/**
 * 箱の真ん中が画面の真ん中に近ければ、ぴったり真ん中にする（左右・上下それぞれ）。
 * stage は画面（body の中の x の位置・幅・高さ）、at は箱の左上（body の中）
 */
export function snapToCenter(
  stage: { readonly x: number; readonly w: number; readonly h: number },
  box: { readonly w: number; readonly h: number },
  at: { readonly left: number; readonly top: number },
): { left: number; top: number; snappedX: boolean; snappedY: boolean } {
  const centerLeft = stage.x + stage.w / 2 - box.w / 2
  const centerTop = stage.h / 2 - box.h / 2
  const snappedX = Math.abs(at.left - centerLeft) <= SNAP_PX
  const snappedY = Math.abs(at.top - centerTop) <= SNAP_PX
  return { left: snappedX ? centerLeft : at.left, top: snappedY ? centerTop : at.top, snappedX, snappedY }
}

/** 補助線の色（止まったら濃い実線） */
const GUIDE_COLOR = '#1A73E8'

/** 矢印キー1回で動かす割合（Shift で10倍） */
const KEY_STEP = 1
/** 手とバナーのあき */
const GAP = 8
/** 手をバナーの上に置くときのあき（選んだ部品の札の高さぶん空ける） */
const ABOVE_GAP = 26

/**
 * body（見たまま画面・position:relative）の中の content（バナー）を動かす。
 * restore: 置いた場所が無いときの並べ方に戻す（LPを敷いたときの余白で寄せる・popup-underlay.ts）
 */
export function attachFreeDrag(
  body: HTMLElement,
  content: HTMLElement,
  control: FreePlaceControl,
  restore: () => void,
  life: AbortSignal,
): FreeDrag {
  const box = content // eslint-safe alias（no-param-reassign 回避）
  let shown = false
  let stageWidth: number | null = null

  const tools = document.createElement('div')
  tools.dataset['popupFreeDrag'] = 'true'
  tools.style.cssText = 'position:absolute;z-index:4;display:none;flex-direction:column;align-items:stretch;gap:6px'
  const grip = document.createElement('button')
  grip.type = 'button'
  grip.innerHTML = `${MOVE_ICON}<span>つまんで動かす</span>`
  grip.title =
    control.kind === 'bar'
      ? 'つまんで上下へ動かす（矢印キーでも動く・スマホとPCで同じ位置）'
      : 'つまんで好きな場所へ動かす（矢印キーでも動く・スマホとPCで同じ位置）'
  grip.style.cssText =
    'display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border:none;border-radius:15px;' +
    'background:#1F2430;color:#fff;font:12.5px/1 "Hiragino Sans",sans-serif;cursor:grab;touch-action:none;' +
    'box-shadow:0 2px 10px rgba(16,24,40,.25);white-space:nowrap'
  const reset = document.createElement('button')
  reset.type = 'button'
  reset.textContent = '元の位置'
  reset.title = '選んだ表示位置（上の帯・下の帯・右下・左下）に戻す'
  reset.style.cssText =
    'height:26px;padding:0 10px;border:1px solid #D5D9E0;border-radius:13px;background:#fff;color:#3F4450;' +
    'font:12px/1 "Hiragino Sans",sans-serif;cursor:pointer;white-space:nowrap'
  // 補助の説明（指示43）
  const help = document.createElement('span')
  help.textContent = 'Ctrl（Mac は ⌘）を押しながら動かすと、真ん中の線が出てぴったり止まります'
  help.style.cssText =
    'max-width:190px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,.94);color:#4B5563;' +
    'font:11px/1.5 "Hiragino Sans",sans-serif;box-shadow:0 1px 4px rgba(16,24,40,.15);white-space:normal'
  tools.append(grip, reset, help)
  body.append(tools)

  // 真ん中の補助線（Ctrl・⌘ を押しながら動かしている間だけ）
  const guide = (vertical: boolean): HTMLElement => {
    const line = document.createElement('div')
    line.dataset['popupFreeGuide'] = vertical ? 'x' : 'y'
    line.style.cssText = `position:absolute;z-index:3;pointer-events:none;display:none;${vertical ? 'width:0;top:0' : 'height:0;left:0'}`
    body.append(line)
    return line
  }
  const guideX = guide(true)
  const guideY = guide(false)

  /** 画面（後ろのLPの見えている所）。左右はスマホのときだけ 375px のまん中 */
  const stage = (): { x: number; w: number; h: number } => {
    const w = stageWidth === null ? body.clientWidth : Math.min(stageWidth, body.clientWidth)
    return { x: (body.clientWidth - w) / 2, w, h: body.clientHeight }
  }
  const size = (): { w: number; h: number } => ({ w: box.offsetWidth, h: box.offsetHeight })

  /** 手をバナーの左へ（入らなければ右、それも無理なら上） */
  const placeTools = (): void => {
    tools.style.display = shown ? 'flex' : 'none'
    reset.hidden = control.get() === null
    if (!shown) return
    const left = box.offsetLeft
    const top = box.offsetTop
    tools.style.flexDirection = 'column'
    tools.style.flexWrap = 'nowrap'
    const midTop = Math.max(4, top + (box.offsetHeight - tools.offsetHeight) / 2)
    if (left - tools.offsetWidth - GAP >= 4) {
      tools.style.left = `${left - tools.offsetWidth - GAP}px`
      tools.style.top = `${midTop}px`
    } else if (left + box.offsetWidth + GAP + tools.offsetWidth <= body.clientWidth - 4) {
      tools.style.left = `${left + box.offsetWidth + GAP}px`
      tools.style.top = `${midTop}px`
    } else {
      // 上に置くときは横に並べ、選んだ部品の札（「見本」など・枠の左上の外）より上へ
      tools.style.flexDirection = 'row'
      tools.style.flexWrap = 'wrap'
      tools.style.maxWidth = `${Math.max(160, body.clientWidth - 8)}px`
      tools.style.left = `${Math.max(4, left)}px`
      tools.style.top = `${Math.max(4, top - tools.offsetHeight - ABOVE_GAP)}px`
    }
  }

  /** 置いた場所へ置く（無ければ元の並べ方）。選択枠を合わせ直すかは呼ぶ側 */
  const layout = (): void => {
    const place = control.get()
    if (!shown || place === null) {
      box.style.position = 'relative'
      box.style.left = ''
      box.style.top = ''
      if (shown) restore()
      placeTools()
      return
    }
    const s = stage()
    const at = freeBoxPlace(control.kind, s, size(), place)
    box.style.position = 'absolute'
    box.style.margin = '0'
    box.style.left = `${s.x + at.left}px`
    box.style.top = `${at.top}px`
    placeTools()
  }

  /** 選択枠・つまみを新しい位置へ合わせ直す（大きさは変わらないので、ResizeObserver では気づかない） */
  let realignQueued = false
  const realign = (): void => {
    if (realignQueued) return
    realignQueued = true
    requestAnimationFrame(() => {
      realignQueued = false
      window.dispatchEvent(new Event('resize'))
    })
  }

  /** 補助線を出す（止まった線は濃い実線）・消す */
  const paintGuides = (on: boolean, snappedX: boolean, snappedY: boolean): void => {
    const s = stage()
    guideX.style.display = on && control.kind === 'corner' ? 'block' : 'none'
    guideY.style.display = on ? 'block' : 'none'
    if (!on) return
    guideX.style.left = `${s.x + s.w / 2}px`
    guideX.style.height = `${s.h}px`
    guideX.style.borderLeft = `${snappedX ? 2 : 1}px ${snappedX ? 'solid' : 'dashed'} ${GUIDE_COLOR}`
    guideY.style.top = `${s.h / 2}px`
    guideY.style.left = `${s.x}px`
    guideY.style.width = `${s.w}px`
    guideY.style.borderTop = `${snappedY ? 2 : 1}px ${snappedY ? 'solid' : 'dashed'} ${GUIDE_COLOR}`
  }

  const moveTo = (left: number, top: number): void => {
    const s = stage()
    control.set(freePositionAt(control.kind, s, size(), { left: left - s.x, top }))
    layout()
    realign()
  }

  let drag: { readonly id: number; readonly dx: number; readonly dy: number } | null = null
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    grip.setPointerCapture(e.pointerId)
    grip.style.cursor = 'grabbing'
    drag = { id: e.pointerId, dx: e.clientX - box.offsetLeft, dy: e.clientY - box.offsetTop }
  })
  grip.addEventListener('pointermove', (e) => {
    if (drag === null || e.pointerId !== drag.id) return
    const at = { left: e.clientX - drag.dx, top: e.clientY - drag.dy }
    // Ctrl（Mac は ⌘）を押しながら＝補助線を出して真ん中に止める
    if (e.ctrlKey || e.metaKey) {
      const snapped = snapToCenter(stage(), size(), at)
      paintGuides(true, snapped.snappedX, snapped.snappedY)
      moveTo(snapped.left, snapped.top)
      return
    }
    paintGuides(false, false, false)
    moveTo(at.left, at.top)
  })
  const endDrag = (e: PointerEvent): void => {
    if (drag === null || e.pointerId !== drag.id) return
    drag = null
    grip.style.cursor = 'grab'
    paintGuides(false, false, false)
  }
  grip.addEventListener('pointerup', endDrag)
  grip.addEventListener('pointercancel', endDrag)

  grip.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? KEY_STEP * 10 : KEY_STEP
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
    const dx = control.kind === 'corner' ? (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0) : 0
    if (dx === 0 && dy === 0) return
    e.preventDefault()
    const s = stage()
    const now = control.get() ?? freePositionAt(control.kind, s, size(), { left: box.offsetLeft - s.x, top: box.offsetTop })
    const clamp = (n: number): number => Math.min(100, Math.max(0, n))
    control.set({ x: clamp(now.x + dx), y: clamp(now.y + dy) })
    layout()
    realign()
  })

  reset.addEventListener('click', () => {
    control.set(null)
    layout()
    realign()
  })

  // 中身の大きさ・画面の大きさが変わったら、同じ割合の所へ置き直す（Widget編集を閉じたら外す）
  const observer = new ResizeObserver(() => {
    if (shown && control.get() !== null) layout()
    else placeTools()
  })
  observer.observe(box)
  life.addEventListener('abort', () => observer.disconnect(), { once: true })
  window.addEventListener('resize', layout, { signal: life })

  return {
    setShown: (next) => {
      shown = next
      layout()
    },
    setStageWidth: (width) => {
      stageWidth = width
      layout()
    },
  }
}
