/**
 * 型「画像スライダー」（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * 横にスワイプして画像を送る。送る仕組みはCSS（scroll-snap）なので、スクリプトが無くても指で送れる。
 * 固定のスクリプトは、左右の矢印・下の点・自動で送る（任意）だけを足す。
 *  - 自動で送るのは、見えている間だけ。マウスを乗せる・触る・矢印を押したら止める
 *  - 動きを減らす設定の人には自動で送らない
 *  - 「動かし始めた」目印は要素のプロパティに持ち、編集中の本文（.ql-editor）では動かさない（countdown と同じ理由）
 */
import { INK_DARK, baseCss, esc, linkAttrs, safeColor, safeImage, shade, wrapWidget } from './kit.ts'
import { ACCENT_PRESETS, bool, items, pick, str, type ItemData, type NocodeTemplate } from './types.ts'
import { AUTOPLAY_ICONS, RATIO_ICONS } from './option-icons.ts'

const RATIOS = ['auto', '1/1', '4/5', '16/9'] as const
const AUTOPLAY = ['0', '3', '5', '8'] as const

const CHEVRON = (points: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" ` +
  `stroke-linejoin="round" aria-hidden="true"><polyline points="${points}"/></svg>`

/** 固定の文（入力の文字は入らない）。ES5 */
export const SLIDER_SCRIPT = `(function(){
var roots=document.querySelectorAll('[data-nc-slider]');
for(var i=0;i<roots.length;i++)start(roots[i]);
function start(root){
if(root.__ncSlider)return;
if(root.closest&&root.closest('.ql-editor'))return;
root.__ncSlider=true;
var track=root.querySelector('.nc-sl__track');
if(!track)return;
var slides=[];
for(var k=0;k<track.children.length;k++)slides.push(track.children[k]);
var prev=root.querySelector('.nc-sl__prev'),next=root.querySelector('.nc-sl__next'),dots=root.querySelector('.nc-sl__dots');
var reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var many=slides.length>1;
if(prev)prev.hidden=!many;
if(next)next.hidden=!many;
if(dots){dots.hidden=!many;while(dots.firstChild)dots.removeChild(dots.firstChild);}
if(!many)return;
var marks=[];
for(var d=0;d<slides.length;d++){var dot=document.createElement('span');dot.className='nc-sl__dot';if(dots)dots.appendChild(dot);marks.push(dot);}
var stopped=false,hold=false,seen=true,wait=0;
function index(){var w=track.clientWidth||1;return Math.max(0,Math.min(slides.length-1,Math.round(track.scrollLeft/w)));}
function paint(){var n=index();for(var j=0;j<marks.length;j++)marks[j].className=j===n?'nc-sl__dot is-on':'nc-sl__dot';}
function go(n){var len=slides.length;n=((n%len)+len)%len;var left=n*track.clientWidth;if(track.scrollTo)track.scrollTo({left:left,behavior:reduce?'auto':'smooth'});else track.scrollLeft=left;}
track.addEventListener('scroll',function(){if(wait)return;wait=window.setTimeout(function(){wait=0;paint();},80);});
if(prev)prev.addEventListener('click',function(){stopped=true;go(index()-1);});
if(next)next.addEventListener('click',function(){stopped=true;go(index()+1);});
paint();
var sec=Number(root.getAttribute('data-nc-autoplay'))||0;
if(sec<=0||reduce)return;
root.addEventListener('pointerenter',function(){hold=true;});
root.addEventListener('pointerleave',function(){hold=false;});
root.addEventListener('focusin',function(){hold=true;});
root.addEventListener('focusout',function(){hold=false;});
track.addEventListener('touchstart',function(){stopped=true;},{passive:true});
if('IntersectionObserver' in window){new IntersectionObserver(function(entries){seen=!!(entries[0]&&entries[0].isIntersecting);}).observe(root);}
window.setInterval(function(){if(!stopped&&!hold&&seen&&!document.hidden)go(index()+1);},sec*1000);
}
})();`

function slide(item: ItemData, ratio: (typeof RATIOS)[number], track: boolean): string {
  const image = safeImage(str(item, 'image'))
  const caption = str(item, 'caption').trim()
  const url = str(item, 'url').trim()
  const picture =
    image === ''
      ? `<div class="nc-sl__ph"><span>画像を選んでください</span></div>`
      : `<img src="${image}" alt="${esc(str(item, 'alt').trim())}"${ratio === 'auto' ? '' : ' class="nc-sl__fit"'}>`
  const linked = image !== '' && url !== '' ? `<a class="nc-sl__link"${linkAttrs(url, { track, newTab: false })}>${picture}</a>` : picture
  return (
    `<figure class="nc-sl__slide">${linked}` +
    (caption === '' ? '' : `<figcaption class="nc-sl__cap">${esc(caption)}</figcaption>`) +
    `</figure>`
  )
}

export const SLIDER_TEMPLATE: NocodeTemplate = {
  id: 'slider',
  name: '画像スライダー',
  summary: '何枚もの画像を、横にスワイプして見せます。自動で送ることもできます',
  icon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="5" y="5" width="14" height="11" rx="1.5"/><path d="M2 8v5M22 8v5"/><circle cx="10" cy="20" r=".9"/><circle cx="14" cy="20" r=".9"/></svg>',
  fields: [
    {
      kind: 'list',
      key: 'items',
      label: '画像',
      itemLabel: '画像',
      min: 1,
      max: 10,
      fields: [
        { kind: 'image', key: 'image', label: '画像' },
        { kind: 'text', key: 'alt', label: '画像の説明（読み上げ用）', placeholder: '商品を使っているところ' },
        { kind: 'text', key: 'caption', label: '画像の下の文字（任意）' },
        { kind: 'url', key: 'url', label: '押したときに開くページ（任意）', placeholder: 'https://' },
      ],
      newItem: () => ({ image: '', alt: '', caption: '', url: '' }),
    },
    {
      kind: 'select',
      key: 'ratio',
      label: '画像の形',
      options: [
        { value: 'auto', label: 'そのまま（切り取らない）', short: 'そのまま', icon: RATIO_ICONS.auto },
        { value: '1/1', label: '正方形', icon: RATIO_ICONS['1/1'] },
        { value: '4/5', label: '縦長（4:5）', short: '縦長', icon: RATIO_ICONS['4/5'] },
        { value: '16/9', label: '横長（16:9）', short: '横長', icon: RATIO_ICONS['16/9'] },
      ],
    },
    {
      kind: 'select',
      key: 'autoplay',
      label: '自動で送る',
      options: [
        { value: '0', label: '送らない', icon: AUTOPLAY_ICONS['0'] },
        { value: '3', label: '3秒ごと', icon: AUTOPLAY_ICONS['3'] },
        { value: '5', label: '5秒ごと', icon: AUTOPLAY_ICONS['5'] },
        { value: '8', label: '8秒ごと', icon: AUTOPLAY_ICONS['8'] },
      ],
    },
    { kind: 'toggle', key: 'track', label: 'リンクのクリック数をレポートで数える' },
    { kind: 'color', key: 'color', label: '点の色', presets: ACCENT_PRESETS },
  ],
  defaults: () => ({
    items: [
      { image: '', alt: '', caption: '', url: '' },
      { image: '', alt: '', caption: '', url: '' },
      { image: '', alt: '', caption: '', url: '' },
    ],
    ratio: 'auto',
    autoplay: '0',
    track: true,
    color: '#1F2A37',
  }),
  validate: (data) => {
    const list = items(data, 'items')
    if (list.length === 0 || list.every((item) => safeImage(str(item, 'image')) === '')) return '画像を1枚以上選んでください'
    if (list.some((item) => safeImage(str(item, 'image')) === '')) {
      return '画像が選ばれていない1枚があります。画像を選ぶか、その1枚を消してください'
    }
    return null
  },
  render: (data, uid) => {
    const s = `.${uid}`
    const color = safeColor(str(data, 'color'), '#1F2A37')
    const ratio = pick(data, 'ratio', RATIOS, 'auto')
    const aspect = ratio === 'auto' ? '4 / 3' : ratio.replace('/', ' / ')

    const css =
      baseCss(s) +
      `${s}{padding:16px 0}` +
      `${s} .nc-sl__viewport{position:relative}` +
      `${s} .nc-sl__track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;` +
      `-webkit-overflow-scrolling:touch;scrollbar-width:none}` +
      `${s} .nc-sl__track::-webkit-scrollbar{display:none}` +
      `${s} .nc-sl__track:focus-visible{outline:2px solid ${shade(color, -0.2)};outline-offset:2px}` +
      `${s} .nc-sl__slide{flex:0 0 100%;min-width:0;margin:0;scroll-snap-align:center;scroll-snap-stop:always}` +
      `${s} .nc-sl__slide img{width:100%}` +
      `${s} .nc-sl__slide .nc-sl__fit{aspect-ratio:${aspect};object-fit:cover}` +
      `${s} .nc-sl__link{display:block}` +
      `${s} .nc-sl__ph{aspect-ratio:${aspect};display:flex;align-items:center;justify-content:center;` +
      `background:#EEF0F3;color:#8A94A3;font-size:13px}` +
      `${s} .nc-sl__cap{padding:8px 16px 0;font-size:13px;line-height:1.6;color:#3A4452;text-align:center}` +
      `${s} .nc-sl__nav{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;padding:0;` +
      `border:0;border-radius:50%;background:rgba(255,255,255,.92);color:${INK_DARK};cursor:pointer;` +
      `box-shadow:0 2px 10px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center}` +
      `${s} .nc-sl__nav svg{width:18px;height:18px}` +
      `${s} .nc-sl__prev{left:8px}` +
      `${s} .nc-sl__next{right:8px}` +
      `${s} .nc-sl__dots{display:flex;justify-content:center;gap:6px;margin-top:10px}` +
      `${s} .nc-sl__dot{width:7px;height:7px;border-radius:50%;background:#C9CFD6;transition:transform .2s ease,background .2s ease}` +
      `${s} .nc-sl__dot.is-on{background:${color};transform:scale(1.25)}` +
      `@media (prefers-reduced-motion:reduce){${s} .nc-sl__track{scroll-behavior:auto}${s} .nc-sl__dot{transition:none}}`

    const trackLinks = bool(data, 'track')
    const slides = items(data, 'items')
      .map((item) => slide(item, ratio, trackLinks))
      .join('')
    const body =
      `<div class="nc-sl__viewport">` +
      `<div class="nc-sl__track" tabindex="0" role="region" aria-label="画像（横にスワイプして次の画像へ）">${slides}</div>` +
      `<button type="button" class="nc-sl__nav nc-sl__prev" aria-label="前の画像" hidden>${CHEVRON('15 5 8 12 15 19')}</button>` +
      `<button type="button" class="nc-sl__nav nc-sl__next" aria-label="次の画像" hidden>${CHEVRON('9 5 16 12 9 19')}</button>` +
      `</div>` +
      `<div class="nc-sl__dots" aria-hidden="true" hidden></div>`
    const attrs = ` data-nc-slider="true" data-nc-autoplay="${pick(data, 'autoplay', AUTOPLAY, '0')}"`
    return wrapWidget({ uid, type: 'slider', css, body, attrs, script: SLIDER_SCRIPT })
  },
}
