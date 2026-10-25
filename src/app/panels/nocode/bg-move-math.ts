/**
 * 背景の画像を見たまま画面でつかんで動かす・角を引っぱって大きさを変えるときの計算（2026-10-24・DOMを使わない）。
 * 位置は背景の決まり（0＝左端・50＝真ん中・100＝右端）＝「枠と画像の差」に対する%。大きさは「枠いっぱいに覆う大きさ」に対する%
 * （2026-10-25 横幅に対する%だと、スマホで細くなった枠の上下に色が出た。配信では bg-fit-script.ts が同じ計算で当てる）。
 * 画面の上の場所（px）は、枠の外側（線を含む）を基準にする（bg-image.ts の background-origin:border-box と同じ）。
 */
import { BG_POSITION_MAX, BG_POSITION_MIN, BG_SIZE_MAX, BG_SIZE_MIN, type BgLook } from './templates/bg-image.ts'

export interface Box {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface Natural {
  readonly width: number
  readonly height: number
}

/** 角（つまむ所）。n＝上・s＝下・w＝左・e＝右 */
export type Corner = 'nw' | 'ne' | 'sw' | 'se'

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/** 枠いっぱいに覆う大きさ（px）＝自由な大きさの 100% */
function coverSize(box: Box, natural: Natural): { width: number; height: number } {
  const scale = Math.max(box.width / Math.max(natural.width, 1), box.height / Math.max(natural.height, 1))
  return { width: natural.width * scale, height: natural.height * scale }
}

/** 画像の大きさ（px） */
function imageSize(box: Box, natural: Natural, look: BgLook): { width: number; height: number } {
  const cover = coverSize(box, natural)
  const scale = look.fit === 'cover' ? 1 : look.size / 100
  return { width: cover.width * scale, height: cover.height * scale }
}

/** 見たまま画面で当てる background-size（配信のスクリプトが当てるのと同じ px） */
export function bgSizeCss(box: Box, natural: Natural, look: BgLook): string {
  return look.fit === 'cover' ? 'cover' : `${Math.round(imageSize(box, natural, look).width * 100) / 100}px auto`
}

/** 画像のいる場所（px・はみ出した所も含む） */
export function bgRect(box: Box, natural: Natural, look: BgLook): Box {
  const size = imageSize(box, natural, look)
  return {
    left: box.left + ((box.width - size.width) * look.x) / 100,
    top: box.top + ((box.height - size.height) * look.y) / 100,
    width: size.width,
    height: size.height,
  }
}

/** 画像の左上（px）から位置（%）。枠と同じ大きさの向きは動かない（今の値のまま） */
function percentOf(start: number, room: number, current: number): number {
  if (Math.abs(room) < 0.5) return current
  return Math.round(clamp((start / room) * 100, BG_POSITION_MIN, BG_POSITION_MAX))
}

/** つかんで dx・dy（px）動かしたあと */
export function movedLook(look: BgLook, box: Box, natural: Natural, dx: number, dy: number): BgLook {
  const rect = bgRect(box, natural, look)
  return {
    ...look,
    x: percentOf(rect.left + dx - box.left, box.width - rect.width, look.x),
    y: percentOf(rect.top + dy - box.top, box.height - rect.height, look.y),
  }
}

/**
 * 角を dx・dy（px）引っぱったあと。向かいの角はそのまま、縦横の比はそのまま。大きさを自分で決める形に切り替わる
 */
export function resizedLook(look: BgLook, box: Box, natural: Natural, corner: Corner, dx: number, dy: number): BgLook {
  const rect = bgRect(box, natural, look)
  const ratio = rect.width > 0 ? rect.height / rect.width : 1
  const east = corner === 'ne' || corner === 'se'
  const south = corner === 'sw' || corner === 'se'
  // 引っぱった向きに大きくなる（横と縦のうち、大きく動かした方に合わせる）
  const fromX = rect.width + (east ? dx : -dx)
  const fromY = (rect.height + (south ? dy : -dy)) / ratio
  const wanted = Math.abs(fromX - rect.width) >= Math.abs(fromY - rect.width) ? fromX : fromY
  const full = coverSize(box, natural).width
  const size = Math.round(clamp((wanted / full) * 100, BG_SIZE_MIN, BG_SIZE_MAX))
  const width = (full * size) / 100
  const height = width * ratio
  const left = east ? rect.left : rect.left + rect.width - width
  const top = south ? rect.top : rect.top + rect.height - height
  return {
    ...look,
    fit: 'free',
    size,
    x: percentOf(left - box.left, box.width - width, look.x),
    y: percentOf(top - box.top, box.height - height, look.y),
  }
}
