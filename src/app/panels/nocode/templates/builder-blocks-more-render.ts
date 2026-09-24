/**
 * 増やした部品の書き出し（2026-09-24・入力欄は builder-blocks-more.ts）。
 *
 * - 部品ごとの色などは、その部品だけのクラス（nc-b-12）に書く。形の土台（どの部品でも同じCSS）は、
 *   その部品を使っているWidgetにだけ1回出す（moreBaseCss。使っていない部品のCSSでLPを重くしない）
 * - 入力の文字は esc か richText を通す（タグにしない）。色は safeColor、画像は safeImage を通す
 * - 移行先（renderHotspot）は builder.ts が、被せる部品の中（閉じるタグの前）に入れる
 */
import { PLACES, hrefOf } from './block-kit.ts'
import { pressAttrs, pressLabel, type PressContext } from './press-actions.ts'
import { esc, inkOn, linkAttrs, safeColor, safeImage, shade } from './kit.ts'
import { richText } from '../rich-text.ts'
import { hotspotRect } from '../hotspot-model.ts'
import { tableRows } from './builder-blocks-more.ts'
import { bool, int, pick, str, type ItemData } from './types.ts'
import { EXTRA_BASE_CSS, EXTRA_PREVIEW_CSS, renderExtraBlock } from './builder-blocks-extra-render.ts'

type Part = { html: string; css: string }

/** 人物の写真が無いときの絵 */
const PERSON_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8.5" r="4.5"/><path d="M3.5 21a8.5 8.5 0 0 1 17 0z"/></svg>'

/** 全角の数字も数として読む（「９，８００円」→ 9800）。読めなければ NaN */
function amountOf(text: string): number {
  const digits = text.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).replace(/[^0-9]/g, '')
  return digits === '' ? Number.NaN : Number(digits)
}

/** 通常価格と特別価格から割引率（%）。出せないときは null */
export function discountOf(regular: string, price: string): number | null {
  const was = amountOf(regular)
  const now = amountOf(price)
  if (!(was > 0) || !(now >= 0)) return null
  const off = Math.round((1 - now / was) * 100)
  return off > 0 && off < 100 ? off : null
}

/** 点数（0〜5・0.1刻み） */
function scoreOf(item: ItemData): number {
  const value = item['score']
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(n) ? Math.min(5, Math.max(0, Math.round(n * 10) / 10)) : 5
}

/**
 * 移行先（被せた部品の中に入る、透明な押せる範囲）。screenName は移る先・小窓に出す画面の名前（読み上げ用）。
 * リンク（URL・電話）は <a href>、画面へ移る・LP上のアクションは <span 印>
 */
export function renderHotspot(item: ItemData, i: number, s: string, press: PressContext, screenName: string): Part {
  const cls = `nc-b-${i}`
  const { x, y, w, h } = hotspotRect(item)
  const css = `${s} .${cls}{left:${x}%;top:${y}%;width:${w}%;height:${h}%}`
  const label = esc(pressLabel(item, screenName))
  const href = hrefOf(item)
  if (href !== null) {
    const attrs = linkAttrs(href, { track: bool(item, 'track'), newTab: false })
    return { html: `<a class="nc-b nc-b-hotspot ${cls}"${attrs} aria-label="${label}"></a>`, css }
  }
  const attrs = pressAttrs(item, i, press, false)
  if (attrs !== '') return { html: `<span class="nc-b nc-b-hotspot ${cls}"${attrs} aria-label="${label}"></span>`, css }
  // 移る先がまだ無い（保存の前に知らせる。見たまま画面では「移る先が未設定」と出す）
  return { html: `<span class="nc-b nc-b-hotspot ${cls}" aria-hidden="true"></span>`, css }
}

/** 増やした部品の HTML と、その部品だけの CSS。増やした部品でなければ null */
export function renderMoreBlock(item: ItemData, i: number, s: string, press?: PressContext): Part | null {
  const cls = `nc-b-${i}`
  const sel = `${s} .${cls}`
  switch (str(item, 'type')) {
    case 'speech': {
      const side = pick(item, 'side', ['left', 'right'] as const, 'left')
      const color = safeColor(str(item, 'color'), '#F1F3F5')
      const avatar = safeImage(str(item, 'avatar'))
      const name = str(item, 'name').trim()
      const face = avatar === '' ? PERSON_SVG : `<img src="${avatar}" alt="">`
      return {
        html:
          `<div class="nc-b nc-b-speech nc-b-speech--${side} ${cls}">` +
          `<div class="nc-b-speech__who"><span class="nc-b-speech__face">${face}</span>` +
          (name === '' ? '' : `<span class="nc-b-speech__name">${esc(name)}</span>`) +
          `</div><div class="nc-b-speech__bubble">${richText(str(item, 'text'))}</div></div>`,
        css: `${sel} .nc-b-speech__bubble{background:${color};color:${inkOn(color)}}`,
      }
    }
    case 'price': {
      const color = safeColor(str(item, 'color'), '#E5573F')
      const regular = str(item, 'regular').trim()
      const regularLabel = str(item, 'regularLabel').trim()
      const label = str(item, 'label').trim()
      const unit = str(item, 'unit').trim()
      const off = bool(item, 'off') ? discountOf(regular, str(item, 'price')) : null
      const was =
        regular === ''
          ? ''
          : `<p class="nc-b-price__regular">${regularLabel === '' ? '' : `<span>${esc(regularLabel)}</span>`}` +
            `<s class="nc-b-price__was">${esc(regular)}</s></p>`
      return {
        html:
          `<div class="nc-b nc-b-price ${cls}">${was}<p class="nc-b-price__now">` +
          (off === null ? '' : `<span class="nc-b-price__off">${off}<small>%OFF</small></span>`) +
          (label === '' ? '' : `<span class="nc-b-price__label">${esc(label)}</span>`) +
          `<span class="nc-b-price__num">${esc(str(item, 'price').trim())}</span>` +
          (unit === '' ? '' : `<span class="nc-b-price__unit">${esc(unit)}</span>`) +
          `</p></div>`,
        css:
          `${sel} .nc-b-price__num,${sel} .nc-b-price__label,${sel} .nc-b-price__unit{color:${color}}` +
          `${sel} .nc-b-price__off{background:${color};color:${inkOn(color)}}`,
      }
    }
    case 'box': {
      const color = safeColor(str(item, 'color'), '#1F7AE0')
      const title = richText(str(item, 'title'))
      // 帯の見出しは、見出しがあるときだけ（無ければ枠線）
      const look = ((l) => (l === 'label' && title === '' ? 'line' : l))(pick(item, 'look', ['soft', 'line', 'label'] as const, 'soft'))
      const css =
        look === 'soft'
          ? `${sel}{background:${shade(color, 0.9)}}${sel} .nc-b-box__title{color:${shade(color, -0.35)}}`
          : look === 'line'
            ? `${sel}{border:2px solid ${color};background:#FFFFFF}${sel} .nc-b-box__title{color:${shade(color, -0.35)}}`
            : `${sel}{border:2px solid ${color};background:#FFFFFF}${sel} .nc-b-box__title{background:${color};color:${inkOn(color)}}`
      return {
        html:
          `<div class="nc-b nc-b-box nc-b-box--${look} ${cls}">` +
          (title === '' ? '' : `<p class="nc-b-box__title">${title}</p>`) +
          `<div class="nc-b-box__text">${richText(str(item, 'text'))}</div></div>`,
        css,
      }
    }
    case 'note': {
      const mark = bool(item, 'mark')
      const lines = str(item, 'text')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== '')
        // 自分で「※」を書いた行は、印を二重にしない
        .map((line) => (mark ? line.replace(/^※\s*/, '') : line))
      const lis = lines.map((line) => `<li>${esc(line)}</li>`).join('')
      return { html: `<ul class="nc-b nc-b-note${mark ? ' nc-b-note--mark' : ''} ${cls}">${lis}</ul>`, css: '' }
    }
    case 'table': {
      const color = safeColor(str(item, 'color'), '#1F7AE0')
      const rows = tableRows(str(item, 'text'))
      const cols = Math.max(1, ...rows.map((r) => r.length))
      const cellsOf = (row: readonly string[]): string[] => Array.from({ length: cols }, (_, n) => esc(row[n] ?? ''))
      const head = bool(item, 'head') && rows.length > 0 ? rows[0] : undefined
      const body = head === undefined ? rows : rows.slice(1)
      const thead = head === undefined ? '' : `<thead><tr>${cellsOf(head).map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead>`
      const tbody = body
        .map((row) => {
          const cells = cellsOf(row)
          // 2列以上なら、左の列は行の見出し
          return cols > 1
            ? `<tr><th scope="row">${cells[0] ?? ''}</th>${cells.slice(1).map((c) => `<td>${c}</td>`).join('')}</tr>`
            : `<tr><td>${cells[0] ?? ''}</td></tr>`
        })
        .join('')
      return {
        html: `<div class="nc-b nc-b-table ${cls}"><table>${thead}<tbody>${tbody}</tbody></table></div>`,
        css:
          `${sel} tbody th{background:${shade(color, 0.92)};color:${shade(color, -0.45)}}` +
          `${sel} thead th{background:${color};color:${inkOn(color)};border-color:${color}}`,
      }
    }
    case 'rating': {
      const score = scoreOf(item)
      const color = safeColor(str(item, 'color'), '#F2A516')
      const label = str(item, 'label').trim()
      const note = str(item, 'note').trim()
      return {
        html:
          `<div class="nc-b nc-b-rating ${cls}">` +
          (label === '' ? '' : `<p class="nc-b-rating__label">${esc(label)}</p>`) +
          `<div class="nc-b-rating__row"><span class="nc-b-rating__stars" role="img" aria-label="5点中${score}点">` +
          `<span class="nc-b-rating__base" aria-hidden="true">★★★★★</span><span class="nc-b-rating__fill" aria-hidden="true">★★★★★</span></span>` +
          `<span class="nc-b-rating__num" aria-hidden="true">${score}</span></div>` +
          (note === '' ? '' : `<p class="nc-b-rating__note">${esc(note)}</p>`) +
          `</div>`,
        css: `${sel} .nc-b-rating__fill{width:${Math.round((score / 5) * 1000) / 10}%}${sel} .nc-b-rating__stars{color:${color}}`,
      }
    }
    case 'badge': {
      const color = safeColor(str(item, 'color'), '#E5573F')
      const look = pick(item, 'look', ['pill', 'ribbon', 'circle', 'tag'] as const, 'pill')
      const align = pick(item, 'place', PLACES, 'center')
      return {
        html: `<div class="nc-b nc-b-badge ${cls}"><span class="nc-b-badge__in nc-b-badge__in--${look}">${esc(str(item, 'text').trim())}</span></div>`,
        css: `${sel}{text-align:${align}}${sel} .nc-b-badge__in{background:${color};color:${inkOn(color)}}`,
      }
    }
    case 'gallery': {
      const images = [str(item, 'image1'), str(item, 'image2'), str(item, 'image3')].map(safeImage)
      const count = images[2] === '' ? 2 : 3
      const cells = images
        .slice(0, count)
        .map((src) => `<div class="nc-b-gallery__cell">${src === '' ? '' : `<img src="${src}" alt="">`}</div>`)
        .join('')
      const round = bool(item, 'round') ? ' nc-b-gallery--round' : ''
      return {
        html: `<div class="nc-b nc-b-gallery nc-b-gallery--${count}${round} ${cls}">${cells}</div>`,
        css: `${sel}{gap:${int(item, 'gap', 0, 24, 8)}px}`,
      }
    }
    case 'point': {
      const color = safeColor(str(item, 'color'), '#E5573F')
      const kicker = str(item, 'kicker').trim()
      return {
        html:
          `<div class="nc-b nc-b-point ${cls}">` +
          (kicker === '' ? '' : `<p class="nc-b-point__kicker">${esc(kicker)}</p>`) +
          `<h3 class="nc-b-point__heading">${richText(str(item, 'heading'))}</h3>` +
          `<p class="nc-b-point__text">${richText(str(item, 'text'))}</p></div>`,
        css: `${sel} .nc-b-point__kicker{color:${shade(color, -0.2)}}`,
      }
    }
    case 'stat': {
      const color = safeColor(str(item, 'color'), '#E5573F')
      const label = str(item, 'label').trim()
      const unit = str(item, 'unit').trim()
      const note = str(item, 'note').trim()
      return {
        html:
          `<div class="nc-b nc-b-stat ${cls}">` +
          (label === '' ? '' : `<p class="nc-b-stat__label">${esc(label)}</p>`) +
          `<p class="nc-b-stat__value"><span class="nc-b-stat__num">${esc(str(item, 'value').trim())}</span>` +
          (unit === '' ? '' : `<span class="nc-b-stat__unit">${esc(unit)}</span>`) +
          `</p>` +
          (note === '' ? '' : `<p class="nc-b-stat__note">${esc(note)}</p>`) +
          `</div>`,
        css: `${sel} .nc-b-stat__value{color:${color}}`,
      }
    }
    case 'accordion': {
      const color = safeColor(str(item, 'color'), '#1F2A37')
      return {
        html:
          `<details class="nc-b nc-b-accordion ${cls}"${bool(item, 'open') ? ' open' : ''}>` +
          `<summary class="nc-b-accordion__summary"><span class="nc-b-accordion__title">${esc(str(item, 'title').trim())}</span>` +
          `<span class="nc-b-accordion__icon" aria-hidden="true"></span></summary>` +
          `<div class="nc-b-accordion__body">${richText(str(item, 'text'))}</div></details>`,
        css: `${sel}{border-color:${shade(color, 0.72)}}${sel} .nc-b-accordion__summary{color:${color}}`,
      }
    }
    case 'cue': {
      const color = safeColor(str(item, 'color'), '#E5573F')
      const text = str(item, 'text').trim()
      return {
        html:
          `<div class="nc-b nc-b-cue${bool(item, 'move') ? ' nc-b-cue--move' : ''} ${cls}">` +
          (text === '' ? '' : `<p class="nc-b-cue__text">${esc(text)}</p>`) +
          `<span class="nc-b-cue__arrows" aria-hidden="true"><i></i><i></i></span></div>`,
        css: `${sel}{color:${color}}`,
      }
    }
    default:
      // もっと増やした部品（builder-blocks-extra-render.ts）
      return renderExtraBlock(item, i, s, press)
  }
}

/** 部品の形の土台（使っている部品の分だけ、Widgetに1回） */
const BASE_CSS: Readonly<Record<string, (s: string) => string>> = {
  hotspot: (s) =>
    // 被せた部品の中の、透明な押せる範囲（位置と大きさは部品ごとのクラス）。部品の間の余白は付けない
    `${s} .nc-b.nc-b-hotspot{position:absolute;z-index:5;display:block;margin:0;padding:0;border:0;background:transparent;` +
    `cursor:pointer;-webkit-tap-highlight-color:transparent}` +
    `${s} .nc-b-hotspot:focus-visible{outline:3px solid #1F2A37;outline-offset:2px}`,
  speech: (s) =>
    `${s} .nc-b-speech{display:flex;align-items:flex-start;gap:12px}` +
    `${s} .nc-b-speech--right{flex-direction:row-reverse}` +
    `${s} .nc-b-speech__who{flex:0 0 64px;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}` +
    `${s} .nc-b-speech__face{width:56px;height:56px;border-radius:50%;overflow:hidden;background:#E6EAF0;color:#9AA3AE;` +
    `display:flex;align-items:flex-end;justify-content:center}` +
    `${s} .nc-b-speech__face img{width:100%;height:100%;object-fit:cover}` +
    `${s} .nc-b-speech__face svg{width:44px;height:44px;display:block}` +
    `${s} .nc-b-speech__name{font-size:11px;line-height:1.35;color:#5B6572;text-align:center;overflow-wrap:anywhere}` +
    `${s} .nc-b-speech__bubble{position:relative;flex:1 1 auto;min-width:0;margin-top:4px;padding:12px 16px;border-radius:14px;` +
    `font-size:15px;line-height:1.75;text-align:left}` +
    // しっぽ（三角）は ::after（::before は、見たまま画面の「セリフを入れてください」に使う）
    `${s} .nc-b-speech__bubble::after{content:"";position:absolute;top:18px;left:-9px;width:10px;height:14px;background:inherit;` +
    `clip-path:polygon(100% 0,0 50%,100% 100%)}` +
    `${s} .nc-b-speech--right .nc-b-speech__bubble::after{left:auto;right:-9px;clip-path:polygon(0 0,100% 50%,0 100%)}`,
  price: (s) =>
    `${s} .nc-b-price{text-align:center}` +
    `${s} .nc-b-price__regular{display:flex;justify-content:center;align-items:baseline;gap:8px;margin:0 0 6px;font-size:14px;color:#5B6572}` +
    `${s} .nc-b-price__was{text-decoration-thickness:1.5px}` +
    `${s} .nc-b-price__now{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:4px 8px;margin:0;line-height:1.1}` +
    `${s} .nc-b-price__off{align-self:center;display:inline-flex;align-items:baseline;padding:5px 10px;border-radius:999px;` +
    `font-size:17px;font-weight:900;line-height:1.1}` +
    `${s} .nc-b-price__off small{margin-left:1px;font-size:11px;font-weight:800}` +
    `${s} .nc-b-price__label{font-size:15px;font-weight:800}` +
    `${s} .nc-b-price__num{font-size:44px;font-weight:900;letter-spacing:-.01em;font-variant-numeric:tabular-nums}` +
    `${s} .nc-b-price__unit{font-size:15px;font-weight:800}`,
  box: (s) =>
    `${s} .nc-b-box{border-radius:12px;padding:16px 18px;color:#1F2A37}` +
    `${s} .nc-b-box__title{margin:0 0 6px;font-size:16px;font-weight:800;line-height:1.5}` +
    `${s} .nc-b-box__text{font-size:15px;line-height:1.8}` +
    `${s} .nc-b-box--label{padding-top:0;overflow:hidden}` +
    `${s} .nc-b-box--label .nc-b-box__title{margin:0 -18px 12px;padding:9px 18px;font-size:15px}`,
  note: (s) =>
    `${s} .nc-b-note{list-style:none;margin:0;padding:0;font-size:12px;line-height:1.7;color:#6B7480}` +
    `${s} .nc-b-note--mark li{position:relative;padding-left:1.2em}` +
    `${s} .nc-b-note--mark li::before{content:"※";position:absolute;left:0}`,
  table: (s) =>
    `${s} .nc-b-table{overflow-x:auto}` +
    `${s} .nc-b-table table{width:100%;border-collapse:collapse;font-size:14px;line-height:1.6}` +
    `${s} .nc-b-table th,${s} .nc-b-table td{padding:10px 12px;border:1px solid #DDE2E8;text-align:left;vertical-align:top}` +
    `${s} .nc-b-table tbody th{width:34%;font-weight:700}`,
  rating: (s) =>
    `${s} .nc-b-rating{text-align:center}` +
    `${s} .nc-b-rating__label{margin:0 0 4px;font-size:14px;font-weight:700;color:#3A4452}` +
    `${s} .nc-b-rating__row{display:inline-flex;align-items:center;gap:10px}` +
    `${s} .nc-b-rating__stars{position:relative;display:inline-block;font-size:28px;line-height:1;letter-spacing:2px;white-space:nowrap}` +
    `${s} .nc-b-rating__base{color:#DADFE6}` +
    `${s} .nc-b-rating__fill{position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap}` +
    `${s} .nc-b-rating__num{font-size:30px;font-weight:900;line-height:1;color:#1F2A37;font-variant-numeric:tabular-nums}` +
    `${s} .nc-b-rating__note{margin:6px 0 0;font-size:11.5px;color:#6B7480}`,
  badge: (s) =>
    `${s} .nc-b-badge{line-height:1}` +
    `${s} .nc-b-badge__in{display:inline-flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;line-height:1.3;text-align:center}` +
    `${s} .nc-b-badge__in--pill{padding:7px 18px;border-radius:999px}` +
    `${s} .nc-b-badge__in--ribbon{padding:9px 30px;clip-path:polygon(0 0,100% 0,calc(100% - 12px) 50%,100% 100%,0 100%,12px 50%)}` +
    `${s} .nc-b-badge__in--circle{width:92px;height:92px;padding:10px;border-radius:50%;font-size:16px}` +
    `${s} .nc-b-badge__in--tag{padding:8px 28px 8px 16px;clip-path:polygon(0 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,0 100%)}`,
  gallery: (s) =>
    `${s} .nc-b-gallery{display:grid}` +
    `${s} .nc-b-gallery--2{grid-template-columns:repeat(2,minmax(0,1fr))}` +
    `${s} .nc-b-gallery--3{grid-template-columns:repeat(3,minmax(0,1fr))}` +
    `${s} .nc-b-gallery__cell{min-width:0}` +
    `${s} .nc-b-gallery__cell img{width:100%;height:auto;display:block}` +
    `${s} .nc-b-gallery--round .nc-b-gallery__cell img{border-radius:10px}`,
  point: (s) =>
    `${s} .nc-b-point__kicker{display:flex;align-items:center;gap:8px;margin:0 0 6px;font-size:12.5px;font-weight:900;letter-spacing:.14em}` +
    `${s} .nc-b-point__kicker::after{content:"";flex:0 0 28px;height:2px;background:currentColor;opacity:.5}` +
    `${s} .nc-b-point__heading{margin:0 0 8px;font-size:19px;font-weight:800;line-height:1.5;color:#1F2A37}` +
    `${s} .nc-b-point__text{font-size:15px;line-height:1.85;color:#3A4452}`,
  stat: (s) =>
    `${s} .nc-b-stat{text-align:center}` +
    `${s} .nc-b-stat__label{margin:0 0 2px;font-size:15px;font-weight:800;color:#1F2A37}` +
    `${s} .nc-b-stat__value{display:flex;justify-content:center;align-items:baseline;gap:2px;margin:0;line-height:1}` +
    `${s} .nc-b-stat__num{font-size:56px;font-weight:900;letter-spacing:-.02em;font-variant-numeric:tabular-nums}` +
    `${s} .nc-b-stat__unit{font-size:22px;font-weight:900}` +
    `${s} .nc-b-stat__note{margin:8px 0 0;font-size:11.5px;color:#6B7480}`,
  accordion: (s) =>
    `${s} .nc-b-accordion{border:1.5px solid #D5DAE0;border-radius:12px;background:#FFFFFF;overflow:hidden}` +
    `${s} .nc-b-accordion__summary{display:flex;align-items:center;gap:12px;padding:14px 16px;font-size:15.5px;font-weight:800;` +
    `line-height:1.5;cursor:pointer;list-style:none}` +
    `${s} .nc-b-accordion__summary::-webkit-details-marker{display:none}` +
    `${s} .nc-b-accordion__title{flex:1 1 auto;min-width:0}` +
    `${s} .nc-b-accordion__icon{position:relative;flex:0 0 18px;height:18px}` +
    `${s} .nc-b-accordion__icon::before,${s} .nc-b-accordion__icon::after{content:"";position:absolute;left:2px;right:2px;top:8px;` +
    `height:2px;border-radius:1px;background:currentColor;transition:transform .2s ease}` +
    `${s} .nc-b-accordion__icon::after{transform:rotate(90deg)}` +
    `${s} .nc-b-accordion[open] .nc-b-accordion__icon::after{transform:rotate(0)}` +
    `${s} .nc-b-accordion__body{padding:0 16px 16px;font-size:14.5px;line-height:1.85;color:#3A4452}` +
    `@media (prefers-reduced-motion:reduce){${s} .nc-b-accordion__icon::before,${s} .nc-b-accordion__icon::after{transition:none}}`,
  cue: (s) =>
    `${s} .nc-b-cue{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}` +
    `${s} .nc-b-cue__text{margin:0;font-size:14px;font-weight:800}` +
    `${s} .nc-b-cue__arrows{display:flex;flex-direction:column;align-items:center;padding-top:4px}` +
    `${s} .nc-b-cue__arrows i{display:block;width:16px;height:16px;margin-top:-6px;border-right:3px solid currentColor;` +
    `border-bottom:3px solid currentColor;transform:rotate(45deg)}` +
    `${s} .nc-b-cue__arrows i+i{opacity:.55}` +
    `${s} .nc-b-cue--move .nc-b-cue__arrows{animation:nc-b-cue-bob 1.4s ease-in-out infinite}` +
    `@keyframes nc-b-cue-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}` +
    `@media (prefers-reduced-motion:reduce){${s} .nc-b-cue--move .nc-b-cue__arrows{animation:none}}`,
}

/** 使っている部品の形の土台 */
export function moreBaseCss(types: ReadonlySet<string>, s: string): string {
  return Object.entries({ ...BASE_CSS, ...EXTRA_BASE_CSS })
    .filter(([type]) => types.has(type))
    .map(([, css]) => css(s))
    .join('')
}

/**
 * 見たまま画面だけの見え方（保存するCSSには入らない）: 移行先は斜線の枠と移る先の名前、空の部品は薄い案内
 */
export const MORE_PREVIEW_CSS =
  '.nc-b-hotspot{background:repeating-linear-gradient(135deg,rgba(0,145,255,.2) 0 6px,rgba(0,145,255,.07) 6px 12px) !important;' +
  'outline:1.5px dashed #0091FF;outline-offset:-1.5px;border-radius:6px}' +
  '.nc-b-hotspot::after{content:attr(aria-label);position:absolute;left:4px;top:4px;max-width:calc(100% - 8px);overflow:hidden;' +
  'text-overflow:ellipsis;padding:2px 6px;border-radius:4px;background:#0091FF;color:#FFFFFF;font:700 11px/1.3 sans-serif;' +
  'white-space:nowrap;pointer-events:none}' +
  '.nc-b-hotspot:not([aria-label])::after{content:"移る先が未設定";background:#C0392B}' +
  '.nc-b-speech__bubble:empty::before{content:"セリフを入れてください";opacity:.4}' +
  '.nc-b-box__text:empty::before{content:"文章を入れてください";opacity:.4}' +
  '.nc-b-note:empty::before,.nc-b-note[data-nc-empty]::before{content:"※ 注意書きを入れてください（1行に1つ）";opacity:.6}' +
  '.nc-b-point__heading:empty::before{content:"見出しを入れてください";opacity:.35}' +
  '.nc-b-point__text:empty::before{content:"文章を入れてください";opacity:.35}' +
  '.nc-b-accordion__body:empty::before{content:"開いたときの文章を入れてください";opacity:.4}' +
  '.nc-b-gallery__cell:empty{min-height:96px;background:#EEF0F3;border-radius:8px}' +
  EXTRA_PREVIEW_CSS
