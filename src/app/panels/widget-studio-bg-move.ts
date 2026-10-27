/**
 * 背景の画像を見たまま画面でつかんで動かす・角を引っぱって大きさを変える（2026-10-24 本人「その画像も位置だったり大きさは
 * 自由に決めれる」・本人の選択「画面でつかんで動かす（右の欄の数字でも直せる）」）。
 *
 * - 画像のいる場所に枠（はみ出した所も薄く見せる）。枠の中をつかむと動き、四隅を引っぱると大きさが変わる（縦横の比はそのまま）
 * - 矢印のキーで 1%（⇧で 10%）動く。Esc・「終わる」・枠の外を押すと終わる
 * - 動かしている間は面に直に見た目を当てる。離したら設定データへ（commit）。計算は nocode/bg-move-math.ts
 * - 背景が動画（2026-10-27）のときは、面のいちばん後ろの動画の層（bg-image.ts の .nc-bgv）の動画に当てる
 */
import { bgRect, bgSizeCss, movedLook, resizedLook, type Box, type Corner, type Natural } from './nocode/bg-move-math.ts'
import { blockElementAt } from './nocode/canvas-sync.ts'
import { getAt, setAt, type Path } from './nocode/form-state.ts'
import { BG_POSITION_MAX, BG_POSITION_MIN, BG_VIDEO_CLASS, bgDeclarations, bgTargetOf, bgVideoDeclarations, isBgVideo, type BgLook } from './nocode/templates/bg-image.ts'
import { isVideoMedia } from './nocode/templates/kit.ts'
import { items, str, type ItemData, type TemplateData } from './nocode/templates/types.ts'

/**
 * 背景を持つ所（[]＝Widget全体・[画面の欄, 画面]・[画面の欄, 画面, 'blocks', 部品]・見本の中の箱＝[…, 'bgs', 何番目]）の、
 * 見たまま画面で背景を敷いた面。部品は色の付いた面（ボタンなら押す所＝bg-image.ts の bgTargetOf）
 */
export function bgSurfaceOf(data: TemplateData, contentDiv: HTMLElement, uid: string, itemPath: Path): HTMLElement | null {
  const root = contentDiv.querySelector<HTMLElement>(`.${uid}`)
  if (itemPath.length === 0) return root
  const [screensKey, screenIndex, , blockIndex] = itemPath
  if (typeof screensKey !== 'string' || typeof screenIndex !== 'number') return null
  if (itemPath.length === 2) {
    const id = str(items(data, screensKey)[screenIndex] ?? {}, 'id')
    return root?.querySelector<HTMLElement>(`[data-nc-screen="${id}"]`) ?? null
  }
  if (typeof blockIndex !== 'number') return null
  const el = blockElementAt(data, contentDiv, screenIndex, blockIndex)
  // 見本の部品の中の箱（[…, 'bgs', 何番目]）は、印の付いた要素
  if (itemPath.length === 6) {
    const id = str((getAt(data, itemPath) as ItemData | undefined) ?? {}, 'id')
    return /^b\d{1,4}$/.test(id) ? (el?.querySelector<HTMLElement>(`[data-nc-bg="${id}"]`) ?? null) : null
  }
  const suffix = bgTargetOf(str((getAt(data, itemPath) as ItemData | undefined) ?? {}, 'type'))
  if (el === null || suffix === null) return null
  return suffix === '' ? el : el.querySelector<HTMLElement>(suffix.trim())
}

/** 動かした背景の画像（合わせ方・大きさ・位置）を設定データへ */
export function withBgLook(data: TemplateData, itemPath: Path, look: BgLook): TemplateData {
  const values: Readonly<Record<string, string | number>> = { bgFit: look.fit, bgSize: look.size, bgX: look.x, bgY: look.y }
  return Object.entries(values).reduce((next, [key, value]) => setAt(next, [...itemPath, key], value), data)
}

export interface BgMoveDeps {
  /** 背景を敷いた面（描き直しで要素が入れ替わるので、そのつど取り直す。無くなったら終わる） */
  readonly target: () => HTMLElement | null
  /** 今の背景の画像 */
  readonly look: () => BgLook | null
  /** 離したとき・キーで動かしたとき（確定） */
  readonly commit: (next: BgLook) => void
  /** 終わったとき */
  readonly onEnd?: () => void
}

export interface BgMoveSession {
  readonly stop: () => void
}

const ACCENT = '#0091FF'
const CORNERS: readonly Corner[] = ['nw', 'ne', 'sw', 'se']
const CORNER_CURSOR: Readonly<Record<Corner, string>> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' }

/** 画像・動画の元の大きさ（読めなければ null） */
function loadNatural(src: string): Promise<Natural | null> {
  return new Promise((resolve) => {
    if (isVideoMedia(src)) {
      const video = document.createElement('video')
      video.muted = true
      video.preload = 'metadata'
      video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight })
      video.onerror = () => resolve(null)
      video.src = src
      return
    }
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

const boxOf = (el: HTMLElement): Box => {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

const PREVIEW_PROPERTIES = Object.keys(bgDeclarations({ image: '', fit: 'cover', size: 100, x: 50, y: 50 }))
const VIDEO_PREVIEW_PROPERTIES = Object.keys(bgVideoDeclarations({ image: '', fit: 'cover', size: 100, x: 50, y: 50 }))

/** 面の背景の動画（動画の層の中の動画）。無ければ null */
function bgVideoOf(el: HTMLElement): HTMLVideoElement | null {
  for (const child of el.children) {
    if (child.classList.contains(BG_VIDEO_CLASS)) return child.querySelector('video')
  }
  return null
}

/**
 * 自由な大きさの背景の画像を測り直す（配信のスクリプト bg-fit-script.ts が外枠に付けた __ncBgFit を呼ぶ）。
 * Widget編集で見た目（CSS）だけ変えたときは要素が入れ替わらず、スクリプトも動き直さないので、ここから呼ぶ
 */
export function refitBgImages(container: Element): void {
  const roots = new Set([container.closest('[data-nc-bgfree]'), ...container.querySelectorAll('[data-nc-bgfree]')])
  for (const root of roots) (root as (Element & { __ncBgFit?: () => void }) | null)?.__ncBgFit?.()
}

/** 面に直に当てた見た目（描き直せば消える）を外し、自由な大きさは配信のスクリプトに当て直してもらう */
function clearPreview(el: HTMLElement | null): void {
  if (el === null) return
  for (const property of PREVIEW_PROPERTIES) el.style.removeProperty(property)
  const video = bgVideoOf(el)
  if (video !== null) for (const property of VIDEO_PREVIEW_PROPERTIES) video.style.removeProperty(property)
  refitBgImages(el)
}

/**
 * 動かしている間の見た目。自由な大きさは、配信のスクリプトと同じく枠いっぱいに覆う大きさに対する%を px で当てる
 * （CSSの px なので、画面の拡大縮小を受けない offsetWidth・offsetHeight で測る＝スクリプトと同じ）
 */
function applyPreview(el: HTMLElement, look: BgLook, natural: Natural): void {
  if (isBgVideo(look)) {
    const video = bgVideoOf(el)
    if (video === null) return
    for (const [property, value] of Object.entries(bgVideoDeclarations(look))) video.style.setProperty(property, value, 'important')
    return
  }
  const layoutBox: Box = { left: 0, top: 0, width: el.offsetWidth, height: el.offsetHeight }
  const declarations = { ...bgDeclarations(look), 'background-size': bgSizeCss(layoutBox, natural, look) }
  for (const [property, value] of Object.entries(declarations)) el.style.setProperty(property, value, 'important')
}

/** 画像を読めたら始める（読めなければ null＝呼ぶ側が知らせる） */
export async function startBgMove(deps: BgMoveDeps): Promise<BgMoveSession | null> {
  const first = deps.look()
  if (first === null) return null
  const natural = await loadNatural(first.image)
  if (natural === null || natural.width === 0) return null
  let current: BgLook = first
  let previewTarget: HTMLElement | null = null
  let ended = false
  let frameId = 0

  const layer = document.createElement('div')
  layer.dataset['bgMove'] = 'true'
  // つかんで動かす間に、まわりの文字が選ばれないように
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10000;user-select:none;-webkit-user-select:none'
  const frame = document.createElement('div')
  frame.setAttribute('aria-label', '背景の画像（つかんで動かす）')
  frame.style.cssText =
    `position:fixed;box-sizing:border-box;outline:2px dashed ${ACCENT};outline-offset:0;cursor:move;pointer-events:auto;touch-action:none`
  const ghost = document.createElement('div')
  // 動画は CSS の背景で写せないので、はみ出した所を薄く見せない（枠と四隅だけ）
  ghost.style.cssText = isBgVideo(first)
    ? 'position:absolute;inset:0;pointer-events:none'
    : `position:absolute;inset:0;opacity:.35;pointer-events:none;background:url("${first.image}") center/100% 100% no-repeat`
  frame.append(ghost)
  const handles = CORNERS.map((corner) => {
    const h = document.createElement('div')
    h.dataset['corner'] = corner
    h.setAttribute('aria-label', '角を引っぱって大きさを変える')
    h.style.cssText =
      `position:absolute;width:12px;height:12px;box-sizing:border-box;background:#fff;border:2px solid ${ACCENT};border-radius:2px;` +
      `cursor:${CORNER_CURSOR[corner]};pointer-events:auto;touch-action:none;` +
      `${corner.startsWith('n') ? 'top' : 'bottom'}:-7px;${corner.endsWith('w') ? 'left' : 'right'}:-7px`
    frame.append(h)
    return h
  })
  const bar = document.createElement('div')
  bar.style.cssText =
    'position:fixed;display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;border-radius:999px;background:#1F2A37;color:#fff;' +
    'font:600 12.5px "Hiragino Sans",sans-serif;pointer-events:auto;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.18)'
  const barText = document.createElement('span')
  barText.textContent = isBgVideo(first) ? '背景の動画を動かしています（四隅で大きさ）' : '背景の画像を動かしています（四隅で大きさ）'
  const done = document.createElement('button')
  done.type = 'button'
  done.textContent = '終わる'
  done.style.cssText =
    `border:0;border-radius:999px;padding:5px 12px;background:${ACCENT};color:#fff;font:700 12px "Hiragino Sans",sans-serif;cursor:pointer`
  bar.append(barText, done)
  layer.append(frame, bar)
  document.body.append(layer)

  const layout = (): void => {
    const target = deps.target()
    // 面が無くなった（Widget編集を閉じた・部品を消した）ら終わる
    if (target === null || !target.isConnected) {
      stop()
      return
    }
    const box = boxOf(target)
    const rect = bgRect(box, natural, current)
    frame.style.left = `${rect.left}px`
    frame.style.top = `${rect.top}px`
    frame.style.width = `${rect.width}px`
    frame.style.height = `${rect.height}px`
    // 帯は画像にも面にも重ならない所（上に空きが無ければ下）
    const top = Math.min(box.top, rect.top)
    const bottom = Math.max(box.top + box.height, rect.top + rect.height)
    bar.style.left = `${Math.max(8, Math.min(box.left, rect.left))}px`
    bar.style.top = `${top > 48 ? top - 40 : Math.min(window.innerHeight - 44, bottom + 8)}px`
  }
  const loop = (): void => {
    layout()
    if (!ended) frameId = requestAnimationFrame(loop)
  }

  const preview = (next: BgLook): void => {
    current = next
    const target = deps.target()
    if (target === null) return
    if (previewTarget !== target) clearPreview(previewTarget)
    previewTarget = target
    applyPreview(target, next, natural)
    layout()
  }

  const drag = (event: PointerEvent, corner: Corner | null): void => {
    const target = deps.target()
    if (target === null) return
    event.preventDefault()
    event.stopPropagation()
    const start = { x: event.clientX, y: event.clientY, look: current, box: boxOf(target) }
    const grabbed = event.currentTarget as HTMLElement
    grabbed.setPointerCapture(event.pointerId)
    const move = (e: PointerEvent): void => {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      preview(corner === null ? movedLook(start.look, start.box, natural, dx, dy) : resizedLook(start.look, start.box, natural, corner, dx, dy))
    }
    const up = (): void => {
      grabbed.removeEventListener('pointermove', move)
      grabbed.removeEventListener('pointerup', up)
      grabbed.removeEventListener('pointercancel', up)
      if (current !== start.look) deps.commit(current)
    }
    grabbed.addEventListener('pointermove', move)
    grabbed.addEventListener('pointerup', up)
    grabbed.addEventListener('pointercancel', up)
  }
  frame.addEventListener('pointerdown', (e) => {
    if (e.target === frame || e.target === ghost) drag(e, null)
  })
  handles.forEach((h, i) => h.addEventListener('pointerdown', (e) => drag(e, CORNERS[i] ?? 'se')))

  const clamp = (value: number): number => Math.min(BG_POSITION_MAX, Math.max(BG_POSITION_MIN, value))
  const onKey = (e: KeyboardEvent): void => {
    // 右の欄で数字を打っている間の矢印は、欄のもの
    const typing = e.target instanceof HTMLElement && (e.target.closest('input,textarea,select,[contenteditable="true"]') !== null)
    if (typing) return
    if (e.key === 'Escape') {
      e.preventDefault()
      stop()
      return
    }
    const step = e.shiftKey ? 10 : 1
    const delta: Readonly<Record<string, readonly [number, number]>> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const d = delta[e.key]
    if (d === undefined) return
    e.preventDefault()
    e.stopPropagation()
    const next = { ...current, x: clamp(current.x + d[0]), y: clamp(current.y + d[1]) }
    preview(next)
    deps.commit(next)
  }
  /** 枠・帯の外を押したら終わる（押した所はそのまま効く） */
  const onOutside = (e: PointerEvent): void => {
    if (!(e.target instanceof Node) || !layer.contains(e.target)) stop()
  }

  function stop(): void {
    if (ended) return
    ended = true
    cancelAnimationFrame(frameId)
    document.removeEventListener('keydown', onKey, true)
    document.removeEventListener('pointerdown', onOutside, true)
    layer.remove()
    clearPreview(previewTarget)
    deps.onEnd?.()
  }
  done.addEventListener('click', stop)
  document.addEventListener('keydown', onKey, true)
  document.addEventListener('pointerdown', onOutside, true)
  loop()
  return { stop }
}
