/**
 * ダークモードの色変換（2026-09-13・本人指示）。
 *
 * 採取した実物CSS（約971KB）は書き換えない。ダークのときだけ読み込む上書きCSSを、
 * ここのルールで機械的に作る（tools/rehydrate/build-dark-css.ts）。
 *
 * 考え方:
 *   - 灰色系（彩度が低い色）＝地・文字・罫線なので、明るさを反転する
 *   - ブランド色（彩度のある色）＝そのまま残す。色を回すと実物の印象が変わってしまう
 *   - ただし「薄い色の地」は暗い地に置き換える（暗い画面で眩しいため）
 *   - 影は黒のまま。反転すると暗い画面で白く光ってしまう
 */

/** 影は色を変えない（黒い影は暗い画面でもそのまま使える） */
const KEEP_AS_IS = new Set([
  'box-shadow',
  '-webkit-box-shadow',
  'text-shadow',
  'filter',
  '-webkit-filter',
])

/**
 * 文字として使う色（この向きは「暗い色だけ明るくする」）。
 * 明るい文字は、暗い地（実物のアイコンレール等）の上に載っていることがあり、
 * 反転すると読めなくなるのでそのままにする。
 */
const TEXT_PROPS = new Set(['color', 'fill', 'stroke', 'caret-color', '-webkit-text-fill-color'])

/** 彩度がこれ以下なら「灰色系」とみなす */
const NEUTRAL_SATURATION = 0.15
/**
 * わずかに色みのある黒・白に近い色（#1F2937 のようなスレート系）も灰色として扱う。
 * 見た目は灰色なのに彩度だけ高く、そのままだと暗い画面で読めない文字が残る。
 */
const NEARLY_NEUTRAL_SATURATION = 0.35
const NEARLY_NEUTRAL_DARK = 0.35
const NEARLY_NEUTRAL_LIGHT = 0.9

/** 灰色として扱ってよい色か */
function isNeutralish(s: number, l: number): boolean {
  if (s <= NEUTRAL_SATURATION) return true
  return s <= NEARLY_NEUTRAL_SATURATION && (l <= NEARLY_NEUTRAL_DARK || l >= NEARLY_NEUTRAL_LIGHT)
}
/** 反転後の明るさの下限・上限（真っ黒／真っ白にしない） */
const MIN_LIGHTNESS = 0.09
const MAX_LIGHTNESS = 0.9
/** 彩度のある色のうち、これより明るい地は暗い地に置き換える */
const PALE_LIGHTNESS = 0.85
const PALE_REPLACEMENT = 0.22

interface Rgba {
  r: number
  g: number
  b: number
  a: number | null
}

const HEX = /#([0-9a-f]{3,8})\b/gi
const FUNC = /\brgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)/gi

function parseHex(hex: string): Rgba | null {
  const v = hex.slice(1)
  const part = (s: string): number => Number.parseInt(s.length === 1 ? s + s : s, 16)
  if (v.length === 3 || v.length === 4) {
    return {
      r: part(v[0] ?? ''),
      g: part(v[1] ?? ''),
      b: part(v[2] ?? ''),
      a: v.length === 4 ? part(v[3] ?? '') / 255 : null,
    }
  }
  if (v.length === 6 || v.length === 8) {
    return {
      r: part(v.slice(0, 2)),
      g: part(v.slice(2, 4)),
      b: part(v.slice(4, 6)),
      a: v.length === 8 ? part(v.slice(6, 8)) / 255 : null,
    }
  }
  return null
}

function toHsl({ r, g, b }: Rgba): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return { h, s, l }
}

function fromHsl(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number): number => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return {
    r: Math.round(channel(h + 1 / 3) * 255),
    g: Math.round(channel(h) * 255),
    b: Math.round(channel(h - 1 / 3) * 255),
  }
}

function format({ r, g, b }: { r: number; g: number; b: number }, alpha: number | null): string {
  return alpha === null ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * 1色をダーク用に写す。変える必要がなければ null。
 * `isText` ＝ 文字として使う色か（地・罫線なら false）。向きで写すかどうかを決める。
 */
function mapColor(color: Rgba, isText: boolean): string | null {
  const { h, s, l } = toHsl(color)
  if (isNeutralish(s, l)) {
    // 文字は「暗いものだけ明るく」、地・罫線は「明るいものだけ暗く」。
    // 両方向に反転すると、暗い地の上の明るい文字まで裏返って読めなくなる。
    if (isText ? l >= 0.5 : l <= 0.5) return null
    const next = Math.min(MAX_LIGHTNESS, Math.max(MIN_LIGHTNESS, 1 - l))
    if (Math.abs(next - l) < 0.02) return null
    return format(fromHsl(h, s, next), color.a)
  }
  // 彩度のある薄い地は暗い地に置き換える（暗い画面で眩しいため）。文字はそのまま
  if (!isText && l >= PALE_LIGHTNESS) return format(fromHsl(h, s, PALE_REPLACEMENT), color.a)
  return null
}

/**
 * 宣言1つをダーク用に写す。変える必要がなければ null。
 * 値の中の色を全部（`1px solid #FFF` のような複合値も）写す。
 */
export function mapDarkDeclaration(property: string, value: string): string | null {
  const name = property.trim().toLowerCase()
  if (KEEP_AS_IS.has(name)) return null
  const isText = TEXT_PROPS.has(name)
  let changed = false
  // rgb()/rgba() を先に写す。あとで写す `#RRGGBB` の出力も rgb() 形式なので、
  // 逆順にすると写した色をもう一度写してしまい、元の明るさへ戻ってしまう。
  const withFunc = value.replace(FUNC, (match, r: string, g: string, b: string, a?: string) => {
    const color: Rgba = {
      r: Number(r),
      g: Number(g),
      b: Number(b),
      a: a === undefined ? null : Number(a),
    }
    const mapped = mapColor(color, isText)
    if (mapped === null) return match
    changed = true
    return mapped
  })
  const out = withFunc.replace(HEX, (match) => {
    const color = parseHex(match)
    if (color === null) return match
    const mapped = mapColor(color, isText)
    if (mapped === null) return match
    changed = true
    return mapped
  })
  return changed ? out : null
}
