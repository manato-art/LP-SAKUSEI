/**
 * 選ぶ入力（select）の選択肢の絵（2026-09-24・本人の依頼）。
 *
 * 本人「プルダウンで文字で選んでいる所を、パッと見で分かるように。言葉が違う人でも、形や色なら分かる。
 * なるべく視覚的にすぐ選べるのが理想」。選択肢に icon を持たせると、入力欄は絵のタイルの並びになる
 * （form-controls.ts）。絵は固定のSVG（入力の文字は入らない）。色は currentColor（選んでいると青くなる）。
 * 大きさは 32×24 にそろえる。
 */

const svg = (body: string, extra = ''): string =>
  `<svg viewBox="0 0 32 24" width="32" height="24" aria-hidden="true" ${extra}>${body}</svg>`
const fill = (body: string): string => svg(body, 'fill="currentColor"')
const line = (body: string, width = 2): string =>
  svg(body, `fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`)

/* ── 図形の形（部品「図形」） ── */
export const SHAPE_ICONS = {
  round: fill('<rect x="3" y="4" width="26" height="16" rx="5"/>'),
  rect: fill('<rect x="3" y="4" width="26" height="16"/>'),
  circle: fill('<circle cx="16" cy="12" r="10"/>'),
  pill: fill('<rect x="2" y="6" width="28" height="12" rx="6"/>'),
  ellipse: fill('<ellipse cx="16" cy="12" rx="14" ry="9"/>'),
  diamond: fill('<path d="M16 1 L28 12 L16 23 L4 12 Z"/>'),
  hexagon: fill('<path d="M9 3 H23 L29 12 L23 21 H9 L3 12 Z"/>'),
  bubble: fill('<rect x="3" y="2" width="26" height="15" rx="4"/><path d="M13 17 H19 L16 22 Z"/>'),
  arrow: fill('<path d="M2 5 H22 L30 12 L22 19 H2 Z"/>'),
  down: fill('<path d="M4 2 H28 V14 L16 22 L4 14 Z"/>'),
  ribbon: fill('<path d="M1 5 H31 L26 12 L31 19 H1 L6 12 Z"/>'),
} as const

/* ── 文字の寄せ ── */
export const ALIGN_ICONS = {
  left: line('<path d="M5 6 H27 M5 12 H19 M5 18 H23"/>'),
  center: line('<path d="M5 6 H27 M10 12 H22 M7 18 H25"/>'),
  right: line('<path d="M5 6 H27 M13 12 H27 M9 18 H27"/>'),
} as const

/* ── 部品を置く位置（枠の中で左・中央・右） ── */
const placeIcon = (x: number): string =>
  svg(
    `<path d="M2 3 V21 M30 3 V21" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".5"/>` +
      `<rect x="${x}" y="7" width="12" height="10" rx="2" fill="currentColor"/>`,
  )
export const PLACE_ICONS = {
  left: placeIcon(4),
  center: placeIcon(10),
  right: placeIcon(16),
} as const

/* ── ボタンの見た目（目立つ・選択肢） ── */
export const BUTTON_LOOK_ICONS = {
  cta: fill('<rect x="2" y="6" width="28" height="12" rx="4"/><path d="M20 9.5 L23 12 L20 14.5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  choice: line('<rect x="3" y="7" width="26" height="10" rx="4"/>', 1.8),
} as const

/* ── 箇条書きの頭の印 ── */
export const MARKER_ICONS = {
  check: line('<path d="M4 7 L6 9 L9 5 M4 16 L6 18 L9 14" /><path d="M13 7 H28 M13 16 H28" />', 1.8),
  dot: svg('<circle cx="6" cy="7" r="2" fill="currentColor"/><circle cx="6" cy="16" r="2" fill="currentColor"/><path d="M12 7 H28 M12 16 H28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  number: svg('<text x="3" y="10" font-size="8" font-weight="700" fill="currentColor" font-family="sans-serif">1.</text><text x="3" y="20" font-size="8" font-weight="700" fill="currentColor" font-family="sans-serif">2.</text><path d="M13 7 H28 M13 17 H28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
} as const

/* ── 画像を置く側（画像と文章） ── */
export const SIDE_ICONS = {
  left: svg('<rect x="3" y="5" width="11" height="14" rx="2" fill="currentColor"/><path d="M18 8 H29 M18 12 H29 M18 16 H25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  right: svg('<rect x="18" y="5" width="11" height="14" rx="2" fill="currentColor"/><path d="M3 8 H14 M3 12 H14 M3 16 H10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
} as const

/* ── 区切り線 ── */
export const DIVIDER_ICONS = {
  solid: line('<path d="M3 12 H29"/>'),
  dotted: svg('<path d="M3 12 H29" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.1 4.5"/>'),
} as const

/* ── 画面の切り替わり方 ── */
export const TRANSITION_ICONS = {
  none: svg('<rect x="2" y="5" width="12" height="14" rx="2" fill="currentColor" opacity=".35"/><rect x="18" y="5" width="12" height="14" rx="2" fill="currentColor"/>'),
  fade: svg('<defs><linearGradient id="nc-fade-g" x1="0" x2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".1"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs><rect x="3" y="5" width="26" height="14" rx="2" fill="url(#nc-fade-g)"/>'),
  slide: svg('<rect x="14" y="5" width="15" height="14" rx="2" fill="currentColor"/><path d="M3 12 H10 M7 9 L10 12 L7 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
} as const

/* ── ボタンの型（形・幅・動き） ── */
export const CTA_SHAPE_ICONS = {
  soft: fill('<rect x="2" y="6" width="28" height="12" rx="3"/>'),
  round: fill('<rect x="2" y="6" width="28" height="12" rx="6"/>'),
  square: fill('<rect x="2" y="6" width="28" height="12"/>'),
} as const
export const CTA_WIDTH_ICONS = {
  full: svg('<path d="M2 3 V21 M30 3 V21" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".5"/><rect x="4" y="8" width="24" height="8" rx="3" fill="currentColor"/>'),
  auto: svg('<path d="M2 3 V21 M30 3 V21" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".5"/><rect x="10" y="8" width="12" height="8" rx="3" fill="currentColor"/>'),
} as const
export const CTA_MOTION_ICONS = {
  press: svg('<rect x="4" y="10" width="24" height="9" rx="3" fill="currentColor"/><path d="M16 2 V7 M13 5 L16 8 L19 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  none: fill('<rect x="4" y="8" width="24" height="9" rx="3"/>'),
} as const

/* ── カウントダウン ── */
export const COUNTDOWN_MODE_ICONS = {
  fixed: line('<rect x="6" y="5" width="20" height="16" rx="2"/><path d="M6 10 H26 M11 3 V7 M21 3 V7"/>', 1.8),
  evergreen: line('<circle cx="10" cy="8" r="3"/><path d="M4 20 C4 15 16 15 16 20"/><path d="M21 4 H29 M21 20 H29 M22 4 C22 9 28 9 28 12 C28 15 22 15 22 20 M28 4 C28 9 22 9 22 12"/>', 1.6),
} as const
export const COUNTDOWN_AFTER_ICONS = {
  message: line('<rect x="3" y="4" width="26" height="13" rx="3"/><path d="M12 17 L16 21 L20 17 M8 9 H24 M8 12.5 H18"/>', 1.6),
  hide: line('<path d="M3 12 C8 5 24 5 29 12 C24 19 8 19 3 12 Z"/><circle cx="16" cy="12" r="3"/><path d="M5 21 L27 3"/>', 1.6),
} as const

/* ── 画像スライダー ── */
export const RATIO_ICONS = {
  auto: svg('<rect x="3" y="3" width="26" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2"/><circle cx="11" cy="10" r="2" fill="currentColor"/><path d="M5 19 L12 13 L17 17 L22 12 L27 17 V19 Z" fill="currentColor"/>'),
  '1/1': fill('<rect x="7" y="3" width="18" height="18" rx="2"/>'),
  '4/5': fill('<rect x="9" y="1" width="14" height="22" rx="2"/>'),
  '16/9': fill('<rect x="1" y="5" width="30" height="14" rx="2"/>'),
} as const

const clock = (label: string): string =>
  svg(
    `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7 V12 L15 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>` +
      `<text x="23" y="17" font-size="10" font-weight="700" fill="currentColor" font-family="sans-serif">${label}</text>`,
  )
export const AUTOPLAY_ICONS = {
  '0': line('<rect x="9" y="5" width="4" height="14" rx="1"/><rect x="19" y="5" width="4" height="14" rx="1"/>', 1.6),
  '3': clock('3'),
  '5': clock('5'),
  '8': clock('8'),
} as const

/* ── お客様の声の星 ── */
const STAR = 'M0 -4 L1.2 -1.3 L4 -1.2 L1.9 0.7 L2.5 3.6 L0 2.1 L-2.5 3.6 L-1.9 0.7 L-4 -1.2 L-1.2 -1.3 Z'
const stars = (filled: number): string =>
  svg(
    [0, 1, 2, 3, 4]
      .map(
        (i) =>
          `<path transform="translate(${4 + i * 6} 12)" d="${STAR}" fill="${i < filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width=".9"/>`,
      )
      .join(''),
  )
export const RATING_ICONS = {
  '5': stars(5),
  '4': stars(4),
  '3': stars(3),
  none: line('<path d="M8 6 L24 18 M24 6 L8 18"/>', 1.8),
} as const

/* ── 囲み枠の見た目（2026-09-24・部品を増やした） ── */
export const BOX_LOOK_ICONS = {
  soft: svg('<rect x="3" y="4" width="26" height="16" rx="3" fill="currentColor" opacity=".35"/><path d="M8 10 H24 M8 14 H20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  line: line('<rect x="3" y="4" width="26" height="16" rx="3"/><path d="M8 10 H24 M8 14 H20"/>', 1.8),
  label: svg('<rect x="3" y="4" width="26" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 7 a3 3 0 0 1 3 -3 H26 a3 3 0 0 1 3 3 V9 H3 Z" fill="currentColor"/><path d="M8 14 H24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
} as const

/* ── バッジの形（2026-09-24・部品を増やした） ── */
export const BADGE_LOOK_ICONS = {
  pill: fill('<rect x="4" y="7" width="24" height="10" rx="5"/>'),
  ribbon: fill('<path d="M3 7 H29 L26 12 L29 17 H3 L6 12 Z"/>'),
  circle: fill('<circle cx="16" cy="12" r="9"/>'),
  tag: fill('<path d="M4 7 H22 L28 12 L22 17 H4 Z"/>'),
} as const

/* ── 帯見出しの見た目（2026-09-24・部品をもっと増やした） ── */
export const BAND_LOOK_ICONS = {
  fill: fill('<rect x="3" y="7" width="26" height="10" rx="2"/>'),
  ribbon: fill('<path d="M3 7 H29 L26 12 L29 17 H3 L6 12 Z"/>'),
  line: svg('<path d="M8 10 H24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 16 H26" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'),
} as const

/* ── 飾りの区切り ── */
export const ORNAMENT_ICONS = {
  wave: line('<path d="M3 13 q3.25 -5 6.5 0 t6.5 0 t6.5 0 t6.5 0"/>'),
  zigzag: line('<path d="M3 15 L7 9 L11 15 L15 9 L19 15 L23 9 L27 15"/>'),
  dots: svg('<circle cx="6" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="18" cy="12" r="1.8" fill="currentColor"/><circle cx="24" cy="12" r="1.8" fill="currentColor"/>'),
  slant: fill('<path d="M3 17 L29 7 V17 Z"/>'),
} as const

/* ── LPの中の場所へ移動（押したとき） ── */
export const SCROLL_ICONS = {
  top: line('<path d="M6 5 H26 M16 20 V9 M11 14 L16 9 L21 14"/>'),
  below: line('<rect x="8" y="3" width="16" height="8" rx="1.5"/><path d="M16 13 V21 M12 17.5 L16 21 L20 17.5"/>'),
  id: line('<path d="M9 9 H24 M8 15 H23 M13 5 L11 19 M20 5 L18 19"/>'),
} as const

/* ── ロード中の見た目 ── */
export const LOADING_ICONS = {
  spinner: svg('<circle cx="16" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".3"/><path d="M16 5 a7 7 0 0 1 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  bar: svg('<rect x="3" y="10" width="26" height="5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="10" width="15" height="5" rx="2.5" fill="currentColor"/>'),
  dots: svg('<circle cx="8" cy="12" r="2.6" fill="currentColor" opacity=".45"/><circle cx="16" cy="12" r="2.6" fill="currentColor"/><circle cx="24" cy="12" r="2.6" fill="currentColor" opacity=".45"/>'),
} as const
