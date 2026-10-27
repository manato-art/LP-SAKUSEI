/**
 * LP設定の背景の画像の「位置と大きさ」（2026-10-27 指示⑱ 本人「背景画像なんだけど、ここでトリミングや大きさの調整をしたい」
 * → 選択「位置と大きさを動かす」）。画像は切らずにそのまま持ち、見え方だけ決める＝何度でもやり直せる。
 *
 * - 合わせ方: 全体を覆う／全体を見せる／自分で決める
 * - 大きさ: 「全体を覆う大きさ」に対する%（動かすと「自分で決める」になる）
 * - 小さな見本: 画像をつかんで動かす・角を引っぱって大きさを変える。見本は配信と同じCSS（page-bg-look.ts）で描く＝見たまま
 * つかむ・引っぱるの計算はノーコードWidgetの背景と同じ（bg-move-math.ts）。
 */
import { bgRect, movedLook, type Box, type Corner, type Natural } from './nocode/bg-move-math.ts'
import type { BgLook } from './nocode/templates/bg-image.ts'
import { cssUrl } from '../master-style.ts'
import {
  formatPageBgLook,
  PAGE_BG_POSITION_MAX,
  PAGE_BG_POSITION_MIN,
  PAGE_BG_SIZE_MAX,
  PAGE_BG_SIZE_MIN,
  pageBgImageDecls,
  parsePageBgLook,
  type PageBgFit,
  type PageBgLook,
} from '../../shared/page-bg-look.ts'

export interface BgLookFieldOptions {
  readonly src: string
  /** 保存してある値（'' ＝全体を覆う・真ん中） */
  readonly look: string
  /** inner＝LP内背景（スマホの縦長の画面で見せる）・outer＝外枠背景（PCの横長の画面） */
  readonly kind: 'inner' | 'outer'
  readonly onChange: (look: string) => void
  /** 画像の縦横の大きさ（テスト用。無ければ画像を読んで測る） */
  readonly natural?: Natural
}

const FITS: ReadonlyArray<readonly [PageBgFit, string]> = [
  ['cover', '全体を覆う'],
  ['contain', '全体を見せる'],
  ['free', '自分で決める'],
]

/** 見本の大きさ（px）。LP内背景はスマホの画面（9:16）、外枠背景はPCの画面（16:9） */
const FRAME: Readonly<Record<BgLookFieldOptions['kind'], { width: number; height: number; label: string }>> = {
  inner: { width: 150, height: 267, label: 'スマホで見たとき' },
  outer: { width: 284, height: 160, label: 'PCで見たとき' },
}

const CORNERS: readonly Corner[] = ['nw', 'ne', 'sw', 'se']

/** 「全体を見せる」の大きさ（全体を覆う大きさに対する%） */
function containPercent(box: Box, natural: Natural): number {
  const sx = box.width / Math.max(natural.width, 1)
  const sy = box.height / Math.max(natural.height, 1)
  return (Math.min(sx, sy) / Math.max(sx, sy)) * 100
}

/** つかむ・引っぱるの計算（bg-move-math.ts）の形へ。全体を見せるは、その大きさの「自分で決める」として測る */
function toMath(look: PageBgLook, box: Box, natural: Natural): BgLook {
  if (look.fit === 'cover') return { image: '', fit: 'cover', size: 100, x: look.x, y: look.y }
  return { image: '', fit: 'free', size: look.fit === 'contain' ? containPercent(box, natural) : look.size, x: look.x, y: look.y }
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/**
 * 画像の真ん中を動かさずに factor 倍する（角を引っぱったとき。どの角でも同じ動き）。
 * 見本の外にはみ出した画像の角は見本の端に寄せて見せているので、向かいの角を基準にすると、引っぱった角と違う所が動いて見えていた
 */
export function scaledLook(look: PageBgLook, box: Box, natural: Natural, factor: number): PageBgLook {
  const start = toMath(look, box, natural)
  const rect = bgRect(box, natural, start)
  const startSize = start.fit === 'cover' ? 100 : start.size
  const size = Math.round(clamp(startSize * factor, PAGE_BG_SIZE_MIN, PAGE_BG_SIZE_MAX))
  const scale = size / startSize
  // 新しい大きさで、真ん中が同じ所に来る位置（%）。枠と同じ大きさの向きは今のまま
  const position = (center: number, length: number, boxStart: number, boxLength: number, current: number): number => {
    const room = boxLength - length
    if (Math.abs(room) < 0.5) return current
    return Math.round(clamp(((center - length / 2 - boxStart) / room) * 100, PAGE_BG_POSITION_MIN, PAGE_BG_POSITION_MAX))
  }
  return {
    fit: 'free',
    size,
    x: position(rect.left + rect.width / 2, rect.width * scale, box.left, box.width, look.x),
    y: position(rect.top + rect.height / 2, rect.height * scale, box.top, box.height, look.y),
    ratio: look.ratio,
  }
}

function button(label: string): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.textContent = label
  el.style.cssText =
    'padding:4px 10px;border:1px solid var(--sb-c-cccccc, #CCCCCC);border-radius:6px;background:#FFFFFF;color:#333333;font-size:12px;cursor:pointer'
  return el
}

export function bgLookField(options: BgLookFieldOptions): HTMLElement {
  const frameSize = FRAME[options.kind]
  const box: Box = { left: 0, top: 0, width: frameSize.width, height: frameSize.height }
  let look = parsePageBgLook(options.look)
  let natural: Natural | null = options.natural ?? null

  const wrap = document.createElement('div')
  wrap.setAttribute('data-bg-look-field', options.kind)
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:10px'
  // 押しても、まわりの「画像を選ぶ」が開かないように
  wrap.addEventListener('click', (event) => event.stopPropagation())

  const title = document.createElement('div')
  title.textContent = '位置と大きさ'
  title.style.cssText = 'font-size:12px;font-weight:700;color:#333333'

  const fits = document.createElement('div')
  fits.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap'
  const fitButtons = FITS.map(([fit, label]) => {
    const el = button(label)
    el.setAttribute('data-bg-look-fit', fit)
    el.addEventListener('click', () => {
      const size = fit === 'free' && look.fit === 'contain' && natural !== null ? Math.round(containPercent(box, natural)) : look.size
      update({ ...look, fit, size: fit === 'free' ? size : 100 })
    })
    fits.append(el)
    return el
  })

  const sizeRow = document.createElement('label')
  sizeRow.style.cssText = 'display:flex;align-items:center;gap:8px;max-width:360px;font-size:12px;color:#333333'
  const sizeText = document.createElement('span')
  sizeText.textContent = '大きさ'
  const range = document.createElement('input')
  range.type = 'range'
  range.min = String(PAGE_BG_SIZE_MIN)
  range.max = String(PAGE_BG_SIZE_MAX)
  range.style.cssText = 'flex:1;min-width:0;accent-color:var(--sb-accent, #0091FF)'
  const sizeValue = document.createElement('span')
  sizeValue.style.cssText = 'width:44px;text-align:right;font-variant-numeric:tabular-nums'
  range.addEventListener('input', () => update({ ...look, fit: 'free', size: Number(range.value) }))
  sizeRow.append(sizeText, range, sizeValue)

  const caption = document.createElement('div')
  caption.textContent = `${frameSize.label}の見本（画像をつかんで動かす・角を引っぱって大きさを変える）`
  caption.style.cssText = 'font-size:11px;color:var(--sb-c-666666, #666666)'

  // 見本: 枠（画像はここに配信と同じCSSで描く）の外にも角が出せるよう、まわりに余白をとる
  const stage = document.createElement('div')
  stage.style.cssText = `position:relative;align-self:flex-start;padding:12px;touch-action:none;user-select:none`
  const frame = document.createElement('div')
  frame.setAttribute('data-bg-look-frame', '')
  const outline = document.createElement('div')
  outline.style.cssText = 'position:absolute;border:1px dashed var(--sb-accent, #0091FF);pointer-events:none'
  const handles = CORNERS.map((corner) => {
    const handle = document.createElement('div')
    handle.setAttribute('data-bg-look-corner', corner)
    handle.style.cssText =
      `position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border:2px solid var(--sb-accent, #0091FF);background:#FFFFFF;` +
      `border-radius:2px;box-sizing:border-box;cursor:${corner === 'nw' || corner === 'se' ? 'nwse' : 'nesw'}-resize`
    return handle
  })
  stage.append(frame, outline, ...handles)

  wrap.append(title, fits, sizeRow, caption, stage)

  const render = (): void => {
    frame.setAttribute(
      'style',
      `width:${String(box.width)}px;height:${String(box.height)}px;border:1px solid var(--sb-c-cccccc, #CCCCCC);border-radius:4px;` +
        `background-color:var(--sb-c-f5f5f5, #F5F5F5);background-repeat:no-repeat;cursor:move;box-sizing:content-box;` +
        `background-image:url("${cssUrl(options.src)}");${pageBgImageDecls(look)};--lp-bg-h:${String(box.height)}px`,
    )
    for (const el of fitButtons) {
      const on = el.getAttribute('data-bg-look-fit') === look.fit
      el.setAttribute('aria-pressed', String(on))
      el.style.borderColor = on ? 'var(--sb-accent, #0091FF)' : ''
      el.style.color = on ? 'var(--sb-accent, #0091FF)' : ''
      el.style.fontWeight = on ? '700' : ''
    }
    const shownSize = look.fit === 'free' ? look.size : look.fit === 'contain' && natural !== null ? Math.round(containPercent(box, natural)) : 100
    range.value = String(shownSize)
    sizeValue.textContent = `${String(shownSize)}%`
    // 画像のいる場所（枠の外にはみ出した所も）。見本のまわりの余白の中に収めて角を出す
    const visible = natural !== null
    outline.hidden = !visible
    for (const handle of handles) handle.hidden = !visible
    if (natural === null) return
    const rect = bgRect(box, natural, toMath(look, box, natural))
    const pad = 12
    const clampX = (v: number): number => Math.min(box.width + pad, Math.max(-pad, v)) + pad + 1
    const clampY = (v: number): number => Math.min(box.height + pad, Math.max(-pad, v)) + pad + 1
    const [left, top, right, bottom] = [clampX(rect.left), clampY(rect.top), clampX(rect.left + rect.width), clampY(rect.top + rect.height)]
    outline.style.left = `${String(left)}px`
    outline.style.top = `${String(top)}px`
    outline.style.width = `${String(right - left)}px`
    outline.style.height = `${String(bottom - top)}px`
    for (const handle of handles) {
      const corner = handle.getAttribute('data-bg-look-corner') as Corner
      handle.style.left = `${String(corner === 'nw' || corner === 'sw' ? left : right)}px`
      handle.style.top = `${String(corner === 'nw' || corner === 'ne' ? top : bottom)}px`
    }
  }

  function update(next: PageBgLook): void {
    // 大きさを自分で決めるときは画像の横÷縦も持つ（配信で「全体を覆う大きさ」を求めるのに使う）
    look = { ...next, ratio: next.fit === 'free' && natural !== null ? Math.round((natural.width / natural.height) * 10000) / 10000 : null }
    render()
    options.onChange(formatPageBgLook(look))
  }

  // つかんで動かす（枠の上）・角を引っぱる（角の上＝画像の真ん中からの離れ具合で大きさを決める）
  let drag: {
    mode: 'move' | Corner
    x: number
    y: number
    start: BgLook
    look: PageBgLook
    center: { x: number; y: number }
  } | null = null
  const begin = (mode: 'move' | Corner) => (event: Event): void => {
    if (natural === null) return
    const e = event as PointerEvent
    event.preventDefault()
    event.stopPropagation()
    const start = toMath(look, box, natural)
    const rect = bgRect(box, natural, start)
    // 画像の真ん中（画面の上の場所）。枠の線（1px）の内側が画像の基準
    const frameBox = frame.getBoundingClientRect()
    const center = { x: frameBox.left + 1 + rect.left + rect.width / 2, y: frameBox.top + 1 + rect.top + rect.height / 2 }
    drag = { mode, x: e.clientX, y: e.clientY, start, look, center }
    stage.setPointerCapture?.(e.pointerId)
  }
  frame.addEventListener('pointerdown', begin('move'))
  for (const handle of handles) handle.addEventListener('pointerdown', begin(handle.getAttribute('data-bg-look-corner') as Corner))
  const onMove = (event: Event): void => {
    if (drag === null || natural === null) return
    const e = event as PointerEvent
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (drag.mode === 'move') {
      const moved = movedLook(drag.start, box, natural, dx, dy)
      // 動かすだけなら合わせ方・大きさはそのまま
      update({ ...drag.look, x: moved.x, y: moved.y })
      return
    }
    const from = Math.hypot(drag.x - drag.center.x, drag.y - drag.center.y)
    if (from < 4) return
    update(scaledLook(drag.look, box, natural, Math.hypot(e.clientX - drag.center.x, e.clientY - drag.center.y) / from))
  }
  const end = (): void => {
    drag = null
  }
  // 枠・角で始めた動きは、まわり（つかみ続ける先）で受ける
  stage.addEventListener('pointermove', onMove)
  stage.addEventListener('pointerup', end)
  stage.addEventListener('pointercancel', end)

  render()
  if (natural === null) {
    const image = new Image()
    image.addEventListener('load', () => {
      natural = { width: image.naturalWidth, height: image.naturalHeight }
      render()
    })
    image.src = options.src
  }
  return wrap
}
