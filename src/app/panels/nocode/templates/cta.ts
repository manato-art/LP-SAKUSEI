/**
 * 型「ボタン」（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * 上の一言（＼ 今なら送料無料 ／）＋ボタン＋下の小さな文字。
 * 押せるボタンに見せる下の縁と、ときどき自分から沈む動き（ui-forge button-press3d）。
 * 動きを減らす設定の人には止める。リンクの計測は今のリンク設定と同じ目印（kit.linkAttrs）。
 */
import { baseCss, contrastWithWhite, esc, inkOn, linkAttrs, safeColor, shade, wrapWidget } from './kit.ts'
import { ACCENT_PRESETS, bool, pick, str, type NocodeTemplate } from './types.ts'
import { CTA_MOTION_ICONS, CTA_SHAPE_ICONS, CTA_WIDTH_ICONS } from './option-icons.ts'

const SHAPES = ['soft', 'round', 'square'] as const
const RADIUS: Readonly<Record<(typeof SHAPES)[number], string>> = { soft: '12px', round: '999px', square: '4px' }
const MOTIONS = ['press', 'none'] as const
const WIDTHS = ['full', 'auto'] as const

/**
 * 押せるボタンの見た目（「ボタン」の型と「部品を積んで作る」のボタンで共通）。
 * 下の濃い縁で厚みを出し、押すと沈む。press を渡すと、ときどき自分から沈む（動きを減らす設定の人には止める）。
 * sel はボタンそのもののセレクター（Widgetのクラスから始まる）。
 */
export function pressButtonCss(
  sel: string,
  options: { color: string; radius: string; full: boolean; press?: { name: string } },
): string {
  const { color, radius, full, press } = options
  const edge = shade(color, -0.28)
  const ink = inkOn(color)
  // 明るい地に白い文字を載せるときは、文字の縁で読みやすくする（ui-forge contrast-discipline）
  const inkShadow = ink === '#FFFFFF' && contrastWithWhite(color) < 4.5 ? 'text-shadow:0 1px 2px rgba(0,0,0,.28);' : ''
  const rest = `0 6px 0 ${edge},0 12px 22px rgba(0,0,0,.14)`
  const sunk = `0 2px 0 ${edge},0 5px 12px rgba(0,0,0,.12)`
  return (
    `${sel}{display:${full ? 'flex' : 'inline-flex'};width:${full ? '100%' : 'auto'};max-width:520px;` +
    `margin:0 auto;align-items:center;justify-content:center;gap:10px;min-height:62px;padding:16px 28px;` +
    `border-radius:${radius};background:${color};color:${ink};${inkShadow}font-size:19px;font-weight:800;` +
    `line-height:1.35;text-decoration:none;box-shadow:${rest};transition:transform .15s ease,box-shadow .15s ease;` +
    `-webkit-tap-highlight-color:transparent}` +
    `${sel}:active{transform:translateY(5px);box-shadow:0 1px 0 ${edge},0 4px 10px rgba(0,0,0,.12)}` +
    `${sel}:focus-visible{outline:3px solid ${shade(color, -0.4)};outline-offset:4px}` +
    (press === undefined
      ? ''
      : `${sel}{animation:${press.name} 2.8s cubic-bezier(.34,1.56,.64,1) infinite}` +
        `${sel}:hover{animation-play-state:paused}` +
        `${sel}:active{animation:none}` +
        `@keyframes ${press.name}{0%,40%,100%{transform:translateY(0);box-shadow:${rest}}` +
        `54%,70%{transform:translateY(4px);box-shadow:${sunk}}}` +
        `@media (prefers-reduced-motion:reduce){${sel}{animation:none}}`)
  )
}

/** ボタンの右の矢印（固定のSVG） */
export const ARROW_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 5 16 12 9 19"/></svg>'

const ARROW = ARROW_SVG.replace('<svg ', '<svg class="nc-cta__arrow" ')

export const CTA_TEMPLATE: NocodeTemplate = {
  id: 'cta',
  // 押す所がボタン1つなので、部品にしたときは「押したとき」で画面②③…へ移せる
  partPress: true,
  name: 'ボタン',
  summary: '申し込み・購入へ進むボタン。上下に一言を添えられます',
  icon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M13 12h4M15.5 10l2 2-2 2"/></svg>',
  fields: [
    { kind: 'text', key: 'micro', label: 'ボタンの上の一言', placeholder: '＼ 今なら送料無料 ／', note: '空にすると出しません' },
    { kind: 'text', key: 'label', label: 'ボタンの文字', placeholder: '今すぐ申し込む', maxLength: 40 },
    { kind: 'text', key: 'sub', label: 'ボタンの下の小さな文字', placeholder: '1分で完了・解約はいつでも', note: '空にすると出しません' },
    { kind: 'url', key: 'url', label: '押したときに開くページ', placeholder: 'https://', note: 'ページ内の場所へ移るときは #申し込み のように書きます' },
    { kind: 'toggle', key: 'track', label: 'クリック数をレポートで数える' },
    { kind: 'toggle', key: 'newTab', label: '新しいタブで開く' },
    { kind: 'color', key: 'color', label: 'ボタンの色', presets: ACCENT_PRESETS },
    {
      kind: 'select',
      key: 'shape',
      label: '形',
      options: [
        { value: 'soft', label: '角を少し丸く', short: '少し丸く', icon: CTA_SHAPE_ICONS.soft },
        { value: 'round', label: '丸く', icon: CTA_SHAPE_ICONS.round },
        { value: 'square', label: '四角', icon: CTA_SHAPE_ICONS.square },
      ],
    },
    {
      kind: 'select',
      key: 'width',
      label: '幅',
      options: [
        { value: 'full', label: '横いっぱい', icon: CTA_WIDTH_ICONS.full },
        { value: 'auto', label: '文字に合わせる', short: '文字なり', icon: CTA_WIDTH_ICONS.auto },
      ],
    },
    {
      kind: 'select',
      key: 'motion',
      label: '動き',
      options: [
        { value: 'press', label: 'ときどき押し込む（目を引く）', short: '押し込む', icon: CTA_MOTION_ICONS.press },
        { value: 'none', label: '動かさない', icon: CTA_MOTION_ICONS.none },
      ],
    },
  ],
  defaults: () => ({
    micro: '＼ 今なら送料無料 ／',
    label: '今すぐ申し込む',
    sub: '1分で完了・解約はいつでもできます',
    url: '',
    track: true,
    newTab: false,
    color: '#E5573F',
    shape: 'soft',
    width: 'full',
    motion: 'press',
  }),
  validate: (data) => {
    if (str(data, 'label').trim() === '') return 'ボタンの文字を入れてください'
    return null
  },
  render: (data, uid) => {
    const s = `.${uid}`
    const color = safeColor(str(data, 'color'), '#E5573F')
    const isPress = pick(data, 'motion', MOTIONS, 'press') === 'press'

    const css =
      baseCss(s) +
      `${s}{padding:24px 16px;text-align:center}` +
      `${s} .nc-cta__micro{margin:0 0 10px;font-size:16px;font-weight:800;line-height:1.5;color:${shade(color, -0.35)};text-wrap:balance}` +
      `${s} .nc-cta__label{min-width:0}` +
      `${s} .nc-cta__arrow{flex:0 0 auto;width:18px;height:18px}` +
      `${s} .nc-cta__sub{margin:12px 0 0;font-size:12.5px;line-height:1.6;color:#5B6572}` +
      pressButtonCss(`${s} .nc-cta__btn`, {
        color,
        radius: RADIUS[pick(data, 'shape', SHAPES, 'soft')],
        full: pick(data, 'width', WIDTHS, 'full') === 'full',
        press: isPress ? { name: `${uid}-press` } : undefined,
      })

    const micro = str(data, 'micro').trim()
    const sub = str(data, 'sub').trim()
    const link = linkAttrs(str(data, 'url'), { track: bool(data, 'track'), newTab: bool(data, 'newTab') })
    const body =
      (micro === '' ? '' : `<p class="nc-cta__micro">${esc(micro)}</p>`) +
      `<a class="nc-cta__btn"${link}><span class="nc-cta__label">${esc(str(data, 'label').trim())}</span>${ARROW}</a>` +
      (sub === '' ? '' : `<p class="nc-cta__sub">${esc(sub)}</p>`)
    return wrapWidget({ uid, type: 'cta', css, body })
  },
}
