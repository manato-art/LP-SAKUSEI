/**
 * もっと増やした部品の書き出し（2026-09-24・入力欄は builder-blocks-extra.ts）。
 * 決まりは builder-blocks-more-render.ts と同じ: 部品ごとの色はその部品だけのクラスに、形の土台は使っている部品の分だけ1回、
 * 入力の文字は esc か richText、色は safeColor、画像は safeImage を通す。
 * 飾りの擬似要素は ::after に置く（::before は見たまま画面の空の案内に使う＝ui-forge pseudo-element-slot-collision）。
 */
import { ALIGNS } from './block-kit.ts'
import { FEATURE_ICONS, splitRows, telDigits } from './builder-blocks-extra.ts'
import { esc, inkOn, linkAttrs, safeColor, safeImage, shade } from './kit.ts'
import { richText } from '../rich-text.ts'
import { bool, int, pick, str, type ItemData } from './types.ts'

type Part = { html: string; css: string }

const PERSON_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8.5" r="4.5"/><path d="M3.5 21a8.5 8.5 0 0 1 17 0z"/></svg>'
const lineSvg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

/** もっと増やした部品の HTML と、その部品だけの CSS。この部品でなければ null */
export function renderExtraBlock(item: ItemData, i: number, s: string): Part | null {
  const cls = `nc-b-${i}`
  const sel = `${s} .${cls}`
  switch (str(item, 'type')) {
    case 'band': {
      const color = safeColor(str(item, 'color'), '#E5573F')
      const look = pick(item, 'look', ['fill', 'ribbon', 'line'] as const, 'fill')
      const size = int(item, 'size', 13, 30, 18)
      const paint = look === 'line' ? `color:${shade(color, -0.25)}` : `background:${color};color:${inkOn(color)}`
      return {
        html: `<div class="nc-b nc-b-band nc-b-band--${look} ${cls}"><span class="nc-b-band__text">${richText(str(item, 'text'))}</span></div>`,
        css: `${sel} .nc-b-band__text{font-size:${size}px;${paint}}`,
      }
    }
    case 'marker': {
      const color = safeColor(str(item, 'color'), '#FFE45C')
      const align = pick(item, 'align', ALIGNS, 'center')
      return {
        html: `<p class="nc-b nc-b-marker nc-b--${align} ${cls}"><span class="nc-b-marker__text">${richText(str(item, 'text'))}</span></p>`,
        css:
          `${sel}{font-size:${int(item, 'size', 13, 26, 17)}px;font-weight:${bool(item, 'bold') ? 800 : 500}}` +
          `${sel} .nc-b-marker__text{background:linear-gradient(transparent 58%,${color} 58%)}`,
      }
    }
    case 'iconText': {
      const color = safeColor(str(item, 'color'), '#1F7AE0')
      const icon = FEATURE_ICONS[pick(item, 'icon', Object.keys(FEATURE_ICONS), 'check')]?.body ?? ''
      return {
        html:
          `<div class="nc-b nc-b-iconText ${cls}"><span class="nc-b-iconText__icon">${lineSvg(icon)}</span>` +
          `<div class="nc-b-iconText__body"><p class="nc-b-iconText__title">${richText(str(item, 'title'))}</p>` +
          `<p class="nc-b-iconText__text">${richText(str(item, 'text'))}</p></div></div>`,
        css: `${sel} .nc-b-iconText__icon{background:${shade(color, 0.88)};color:${shade(color, -0.15)}}`,
      }
    }
    case 'quote': {
      const stars = int(item, 'stars', 0, 5, 5)
      const photo = safeImage(str(item, 'photo'))
      const name = str(item, 'name').trim()
      const who =
        name === '' && photo === ''
          ? ''
          : `<figcaption class="nc-b-quote__who">${photo === '' ? '' : `<img src="${photo}" alt="">`}<span>${esc(name)}</span></figcaption>`
      return {
        html:
          `<figure class="nc-b nc-b-quote ${cls}">` +
          (stars === 0
            ? ''
            : `<p class="nc-b-quote__stars" role="img" aria-label="5点中${stars}点"><span class="nc-b-quote__on">${'★'.repeat(stars)}</span>` +
              `<span class="nc-b-quote__off">${'★'.repeat(5 - stars)}</span></p>`) +
          `<blockquote class="nc-b-quote__text">${richText(str(item, 'text'))}</blockquote>${who}</figure>`,
        css: '',
      }
    }
    case 'profile': {
      const color = safeColor(str(item, 'color'), '#1F7AE0')
      const photo = safeImage(str(item, 'photo'))
      const role = str(item, 'role').trim()
      return {
        html:
          `<div class="nc-b nc-b-profile ${cls}"><span class="nc-b-profile__photo">${photo === '' ? PERSON_SVG : `<img src="${photo}" alt="">`}</span>` +
          `<div class="nc-b-profile__body">` +
          (role === '' ? '' : `<p class="nc-b-profile__role">${esc(role)}</p>`) +
          `<p class="nc-b-profile__name">${esc(str(item, 'name').trim())}</p>` +
          `<p class="nc-b-profile__text">${richText(str(item, 'text'))}</p></div></div>`,
        css: `${sel} .nc-b-profile__role{color:${shade(color, -0.2)};border-color:${shade(color, 0.6)}}`,
      }
    }
    case 'cover': {
      const image = safeImage(str(item, 'image'))
      const align = pick(item, 'align', ALIGNS, 'center')
      const shadeAlpha = int(item, 'shade', 0, 80, 35) / 100
      return {
        html:
          `<div class="nc-b nc-b-cover nc-b--${align} ${cls}"><div class="nc-b-cover__bg">${image === '' ? '' : `<img src="${image}" alt="">`}</div>` +
          `<div class="nc-b-cover__body"><h3 class="nc-b-cover__heading">${richText(str(item, 'heading'))}</h3>` +
          `<p class="nc-b-cover__text">${richText(str(item, 'text'))}</p></div></div>`,
        css: `${sel}{min-height:${int(item, 'height', 120, 520, 240)}px}${sel} .nc-b-cover__bg::after{background:rgba(0,0,0,${shadeAlpha})}`,
      }
    }
    case 'beforeAfter': {
      const color = safeColor(str(item, 'color'), '#E5573F')
      const side = (key: string, labelKey: string, fallback: string, isAfter: boolean): string => {
        const src = safeImage(str(item, key))
        const label = str(item, labelKey).trim() || fallback
        return (
          `<figure class="nc-b-beforeAfter__side${isAfter ? ' nc-b-beforeAfter__side--after' : ''}">` +
          `<div class="nc-b-beforeAfter__img">${src === '' ? '' : `<img src="${src}" alt="">`}</div>` +
          `<figcaption class="nc-b-beforeAfter__label">${esc(label)}</figcaption></figure>`
        )
      }
      return {
        html:
          `<div class="nc-b nc-b-beforeAfter ${cls}">${side('before', 'beforeLabel', 'Before', false)}` +
          `<span class="nc-b-beforeAfter__arrow" aria-hidden="true"></span>${side('after', 'afterLabel', 'After', true)}</div>`,
        css: `${sel} .nc-b-beforeAfter__side--after .nc-b-beforeAfter__label{background:${color};color:${inkOn(color)}}${sel} .nc-b-beforeAfter__arrow{border-left-color:${color}}`,
      }
    }
    case 'tel': {
      const color = safeColor(str(item, 'color'), '#0B7A3E')
      const digits = telDigits(str(item, 'number'))
      const label = str(item, 'label').trim()
      const hours = str(item, 'hours').trim()
      const href = digits === '' ? ' href="#"' : linkAttrs(`tel:${digits}`, { track: bool(item, 'track'), newTab: false })
      return {
        html:
          `<div class="nc-b nc-b-tel ${cls}"><a class="nc-b-tel__a"${href}><span class="nc-b-tel__icon">${lineSvg(FEATURE_ICONS['phone']?.body ?? '')}</span>` +
          `<span class="nc-b-tel__body">${label === '' ? '' : `<span class="nc-b-tel__label">${esc(label)}</span>`}` +
          `<span class="nc-b-tel__num">${esc(str(item, 'number').trim())}</span></span></a>` +
          (hours === '' ? '' : `<p class="nc-b-tel__hours">${esc(hours)}</p>`) +
          `</div>`,
        css: `${sel} .nc-b-tel__a{background:${color};color:${inkOn(color)};box-shadow:0 3px 0 ${shade(color, -0.3)}}`,
      }
    }
    case 'coupon': {
      const color = safeColor(str(item, 'color'), '#E5573F')
      const title = str(item, 'title').trim()
      const code = str(item, 'code').trim()
      const note = str(item, 'note').trim()
      return {
        html:
          `<div class="nc-b nc-b-coupon ${cls}"><div class="nc-b-coupon__ticket"><div class="nc-b-coupon__main">` +
          (title === '' ? '' : `<p class="nc-b-coupon__title">${esc(title)}</p>`) +
          `<p class="nc-b-coupon__amount">${esc(str(item, 'amount').trim())}</p></div>` +
          (code === '' ? '' : `<div class="nc-b-coupon__stub"><p class="nc-b-coupon__codeLabel">クーポンコード</p><p class="nc-b-coupon__code">${esc(code)}</p></div>`) +
          `</div>${note === '' ? '' : `<p class="nc-b-coupon__note">${esc(note)}</p>`}</div>`,
        css:
          `${sel} .nc-b-coupon__ticket{border-color:${color};background:${shade(color, 0.93)}}` +
          `${sel} .nc-b-coupon__amount{color:${shade(color, -0.15)}}${sel} .nc-b-coupon__stub{border-color:${shade(color, 0.4)}}`,
      }
    }
    case 'numbers': {
      const color = safeColor(str(item, 'color'), '#E5573F')
      const rows = splitRows(str(item, 'text'), 4)
      const cells = rows
        .map(
          ([label = '', value = '', unit = '']) =>
            `<div class="nc-b-numbers__item">${label === '' ? '' : `<p class="nc-b-numbers__label">${esc(label)}</p>`}` +
            `<p class="nc-b-numbers__value"><span class="nc-b-numbers__num">${esc(value)}</span>` +
            (unit === '' ? '' : `<span class="nc-b-numbers__unit">${esc(unit)}</span>`) +
            `</p></div>`,
        )
        .join('')
      return {
        html: `<div class="nc-b nc-b-numbers nc-b-numbers--${Math.max(1, rows.length)} ${cls}">${cells}</div>`,
        css: `${sel} .nc-b-numbers__value{color:${color}}`,
      }
    }
    case 'ranking': {
      const items = splitRows(str(item, 'text'), 10)
        .map(([name = '', desc = ''], n) => {
          const rank = n < 3 ? String(n + 1) : 'other'
          return (
            `<li class="nc-b-ranking__item nc-b-ranking__item--${rank}"><span class="nc-b-ranking__rank">${n + 1}<small>位</small></span>` +
            `<span class="nc-b-ranking__body"><span class="nc-b-ranking__name">${esc(name)}</span>` +
            (desc === '' ? '' : `<span class="nc-b-ranking__desc">${esc(desc)}</span>`) +
            `</span></li>`
          )
        })
        .join('')
      return { html: `<ol class="nc-b nc-b-ranking ${cls}">${items}</ol>`, css: '' }
    }
    case 'ornament': {
      const color = safeColor(str(item, 'color'), '#E5573F')
      const look = pick(item, 'look', ['wave', 'zigzag', 'dots', 'slant'] as const, 'wave')
      return {
        html: `<div class="nc-b nc-b-ornament nc-b-ornament--${look} ${cls}" aria-hidden="true"></div>`,
        css: `${sel}{--nc-orn:${color};height:${int(item, 'height', 6, 64, 14)}px}`,
      }
    }
    default:
      return null
  }
}

/** 部品の形の土台（使っている部品の分だけ、Widgetに1回） */
export const EXTRA_BASE_CSS: Readonly<Record<string, (s: string) => string>> = {
  band: (s) =>
    `${s} .nc-b-band{text-align:center}` +
    `${s} .nc-b-band__text{display:block;font-weight:800;line-height:1.45}` +
    `${s} .nc-b-band--fill .nc-b-band__text{padding:12px 16px;border-radius:8px}` +
    `${s} .nc-b-band--ribbon .nc-b-band__text{padding:12px 40px;clip-path:polygon(0 0,100% 0,calc(100% - 16px) 50%,100% 100%,0 100%,16px 50%)}` +
    `${s} .nc-b-band--line .nc-b-band__text{display:inline-block;padding:0 4px 8px;border-bottom:3px solid currentColor}`,
  marker: (s) => `${s} .nc-b-marker{line-height:1.8;color:#1F2A37}${s} .nc-b-marker__text{-webkit-box-decoration-break:clone;box-decoration-break:clone;padding:0 2px}`,
  iconText: (s) =>
    `${s} .nc-b-iconText{display:flex;align-items:flex-start;gap:14px}` +
    `${s} .nc-b-iconText__icon{flex:0 0 48px;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center}` +
    `${s} .nc-b-iconText__icon svg{width:26px;height:26px;display:block}` +
    `${s} .nc-b-iconText__body{min-width:0;flex:1 1 auto}` +
    `${s} .nc-b-iconText__title{margin:2px 0 4px;font-size:16.5px;font-weight:800;line-height:1.5;color:#1F2A37}` +
    `${s} .nc-b-iconText__text{font-size:14.5px;line-height:1.8;color:#3A4452}`,
  quote: (s) =>
    `${s} .nc-b-quote{position:relative;margin:0;padding:18px 20px;border-radius:12px;background:#F6F7F9}` +
    `${s} .nc-b-quote::after{content:"\\201C";position:absolute;right:14px;top:2px;font-size:56px;line-height:1;color:#DDE2E8;font-family:Georgia,serif}` +
    `${s} .nc-b-quote__stars{margin:0 0 6px;font-size:18px;letter-spacing:2px;line-height:1}` +
    `${s} .nc-b-quote__on{color:#F2A516}${s} .nc-b-quote__off{color:#DADFE6}` +
    `${s} .nc-b-quote__text{position:relative;z-index:1;margin:0;font-size:15px;line-height:1.85;color:#1F2A37}` +
    `${s} .nc-b-quote__who{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12.5px;color:#5B6572}` +
    `${s} .nc-b-quote__who img{width:32px;height:32px;border-radius:50%;object-fit:cover}`,
  profile: (s) =>
    `${s} .nc-b-profile{display:flex;align-items:flex-start;gap:16px}` +
    `${s} .nc-b-profile__photo{flex:0 0 88px;width:88px;height:88px;border-radius:50%;overflow:hidden;background:#E6EAF0;color:#9AA3AE;` +
    `display:flex;align-items:flex-end;justify-content:center}` +
    `${s} .nc-b-profile__photo img{width:100%;height:100%;object-fit:cover}` +
    `${s} .nc-b-profile__photo svg{width:70px;height:70px;display:block}` +
    `${s} .nc-b-profile__body{min-width:0;flex:1 1 auto}` +
    `${s} .nc-b-profile__role{display:inline-block;margin:0 0 4px;padding:2px 10px;border:1.5px solid;border-radius:999px;font-size:12px;font-weight:800}` +
    `${s} .nc-b-profile__name{margin:0 0 6px;font-size:18px;font-weight:800;line-height:1.4;color:#1F2A37}` +
    `${s} .nc-b-profile__text{font-size:14px;line-height:1.8;color:#3A4452}`,
  cover: (s) =>
    `${s} .nc-b-cover{position:relative;display:flex;align-items:center;overflow:hidden;border-radius:12px;background:#3A4452;color:#FFFFFF}` +
    `${s} .nc-b-cover__bg{position:absolute;inset:0}` +
    `${s} .nc-b-cover__bg img{width:100%;height:100%;object-fit:cover}` +
    `${s} .nc-b-cover__bg::after{content:"";position:absolute;inset:0}` +
    `${s} .nc-b-cover__body{position:relative;z-index:1;width:100%;padding:24px 22px;text-shadow:0 1px 8px rgba(0,0,0,.35)}` +
    `${s} .nc-b-cover__heading{margin:0 0 6px;font-size:23px;font-weight:900;line-height:1.45}` +
    `${s} .nc-b-cover__text{font-size:15px;line-height:1.8}`,
  beforeAfter: (s) =>
    `${s} .nc-b-beforeAfter{display:grid;grid-template-columns:minmax(0,1fr) 22px minmax(0,1fr);align-items:center;gap:6px}` +
    `${s} .nc-b-beforeAfter__side{position:relative;margin:0}` +
    `${s} .nc-b-beforeAfter__img img{width:100%;height:auto;display:block;border-radius:10px}` +
    `${s} .nc-b-beforeAfter__label{position:absolute;left:8px;top:8px;padding:3px 10px;border-radius:999px;background:#5B6572;color:#FFFFFF;` +
    `font-size:12px;font-weight:800;line-height:1.4}` +
    `${s} .nc-b-beforeAfter__arrow{justify-self:center;width:0;height:0;border-style:solid;border-width:10px 0 10px 14px;border-color:transparent}`,
  tel: (s) =>
    `${s} .nc-b-tel{text-align:center}` +
    `${s} .nc-b-tel__a{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;max-width:520px;margin:0 auto;padding:12px 18px;` +
    `border-radius:12px;text-decoration:none;-webkit-tap-highlight-color:transparent;transition:transform .12s ease}` +
    `${s} .nc-b-tel__a:active{transform:translateY(2px)}` +
    `${s} .nc-b-tel__a:focus-visible{outline:3px solid #1F2A37;outline-offset:3px}` +
    `${s} .nc-b-tel__icon svg{width:28px;height:28px;display:block}` +
    `${s} .nc-b-tel__body{display:flex;flex-direction:column;align-items:flex-start;text-align:left;line-height:1.25}` +
    `${s} .nc-b-tel__label{font-size:12.5px;font-weight:700}` +
    `${s} .nc-b-tel__num{font-size:24px;font-weight:900;letter-spacing:.02em;font-variant-numeric:tabular-nums}` +
    `${s} .nc-b-tel__hours{margin:8px 0 0;font-size:12px;color:#5B6572}` +
    `@media (prefers-reduced-motion:reduce){${s} .nc-b-tel__a{transition:none}}`,
  coupon: (s) =>
    `${s} .nc-b-coupon__ticket{display:flex;align-items:stretch;border:2px dashed;border-radius:12px;overflow:hidden}` +
    `${s} .nc-b-coupon__main{flex:1 1 auto;min-width:0;padding:14px 16px;text-align:center}` +
    `${s} .nc-b-coupon__title{margin:0 0 2px;font-size:13px;font-weight:800;color:#3A4452}` +
    `${s} .nc-b-coupon__amount{margin:0;font-size:30px;font-weight:900;line-height:1.2}` +
    `${s} .nc-b-coupon__stub{flex:0 0 auto;display:flex;flex-direction:column;justify-content:center;padding:10px 14px;border-left:2px dashed;` +
    `background:#FFFFFF;text-align:center}` +
    `${s} .nc-b-coupon__codeLabel{margin:0 0 2px;font-size:11px;color:#5B6572}` +
    `${s} .nc-b-coupon__code{margin:0;font-size:16px;font-weight:900;letter-spacing:.06em;font-family:ui-monospace,Menlo,monospace;` +
    `user-select:all;-webkit-user-select:all;color:#1F2A37}` +
    `${s} .nc-b-coupon__note{margin:6px 0 0;font-size:11.5px;color:#6B7480;text-align:center}`,
  numbers: (s) =>
    `${s} .nc-b-numbers{display:grid;text-align:center}` +
    `${s} .nc-b-numbers--2{grid-template-columns:repeat(2,minmax(0,1fr))}` +
    `${s} .nc-b-numbers--3{grid-template-columns:repeat(3,minmax(0,1fr))}` +
    `${s} .nc-b-numbers--4{grid-template-columns:repeat(4,minmax(0,1fr))}` +
    `${s} .nc-b-numbers__item{min-width:0;padding:6px 4px}` +
    `${s} .nc-b-numbers__item+.nc-b-numbers__item{box-shadow:inset 1px 0 0 #E3E6EA}` +
    `${s} .nc-b-numbers__label{margin:0 0 4px;font-size:12.5px;font-weight:700;color:#3A4452}` +
    `${s} .nc-b-numbers__value{margin:0;line-height:1.1;display:flex;justify-content:center;align-items:baseline;gap:1px}` +
    `${s} .nc-b-numbers__num{font-size:30px;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:-.01em}` +
    `${s} .nc-b-numbers__unit{font-size:13px;font-weight:800}`,
  ranking: (s) =>
    `${s} .nc-b-ranking{list-style:none;margin:0;padding:0}` +
    `${s} .nc-b-ranking__item{display:flex;align-items:center;gap:12px;padding:12px 2px}` +
    `${s} .nc-b-ranking__item+.nc-b-ranking__item{box-shadow:inset 0 1px 0 #EEF0F2}` +
    `${s} .nc-b-ranking__rank{flex:0 0 44px;width:44px;height:44px;border-radius:50%;display:flex;align-items:baseline;justify-content:center;` +
    `padding-top:10px;font-size:18px;font-weight:900;line-height:1;background:#EEF0F3;color:#3A4452}` +
    `${s} .nc-b-ranking__rank small{font-size:10px;margin-left:1px}` +
    `${s} .nc-b-ranking__item--1 .nc-b-ranking__rank{background:#D4A017;color:#1F2A37}` +
    `${s} .nc-b-ranking__item--2 .nc-b-ranking__rank{background:#AEB6BF;color:#1F2A37}` +
    `${s} .nc-b-ranking__item--3 .nc-b-ranking__rank{background:#C0804A;color:#1F2A37}` +
    `${s} .nc-b-ranking__body{min-width:0;display:flex;flex-direction:column}` +
    `${s} .nc-b-ranking__name{font-size:16px;font-weight:800;line-height:1.45;color:#1F2A37}` +
    `${s} .nc-b-ranking__desc{font-size:13px;line-height:1.6;color:#5B6572}`,
  ornament: (s) =>
    `${s} .nc-b-ornament{width:100%}` +
    `${s} .nc-b-ornament--wave{background:radial-gradient(circle at 10px 0,transparent 9px,var(--nc-orn) 10px) 0 0/20px 100% repeat-x}` +
    `${s} .nc-b-ornament--zigzag{background:linear-gradient(135deg,var(--nc-orn) 25%,transparent 25%) -10px 0/20px 20px repeat-x,` +
    `linear-gradient(225deg,var(--nc-orn) 25%,transparent 25%) -10px 0/20px 20px repeat-x}` +
    `${s} .nc-b-ornament--dots{background:radial-gradient(circle,var(--nc-orn) 2.5px,transparent 3px) center/14px 100% repeat-x}` +
    `${s} .nc-b-ornament--slant{background:var(--nc-orn);clip-path:polygon(0 100%,100% 0,100% 100%)}`,
}

/** 見たまま画面だけの見え方（空の部品の薄い案内） */
export const EXTRA_PREVIEW_CSS =
  '.nc-b-band__text:empty::before{content:"帯の文字を入れてください";opacity:.55}' +
  '.nc-b-marker__text:empty::before{content:"マーカーを引く文章を入れてください";opacity:.4}' +
  '.nc-b-iconText__title:empty::before{content:"見出しを入れてください";opacity:.35}' +
  '.nc-b-iconText__text:empty::before{content:"文章を入れてください";opacity:.35}' +
  '.nc-b-quote__text:empty::before{content:"口コミの文を入れてください";opacity:.4}' +
  '.nc-b-profile__name:empty::before{content:"名前を入れてください";opacity:.35}' +
  '.nc-b-cover__heading:empty::before{content:"見出しを入れてください";opacity:.7}' +
  '.nc-b-beforeAfter__img:empty{min-height:120px;background:#EEF0F3;border-radius:10px}' +
  '.nc-b-tel__num:empty::before{content:"電話番号を入れてください";opacity:.8;font-size:15px}' +
  '.nc-b-ranking:empty::before{content:"「名前|説明」を1行に1つ入れてください";opacity:.5}'
