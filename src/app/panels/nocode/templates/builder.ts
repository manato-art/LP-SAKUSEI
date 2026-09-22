/**
 * 「部品を積んで作る」（2026-09-22・本人の依頼。ノーコードでWidgetを作る④）。
 *
 * 画面①・画面②…を作り、画面ごとに部品（builder-blocks.ts）を上から順に積む。
 * 部品の「押したとき」で「画面へ移る」を選ぶと、押した瞬間にその画面へ切り替わる
 * （本人の依頼「アンケートでボタンを押したら transfer①→② のように瞬時に移行」）。
 * Widget全体の背景の色・上下の余白・箇条書きの印の色・切り替わり方も選べる。
 *
 * ⚠️ 切り替えのスクリプト（countdown.ts と同じ決まり）
 *  - 入力は一切入れない。移る先は data-nc-go、画面は data-nc-screen から読む
 *  - 「動かし始めた」目印は要素のプロパティに持つ（Widget編集で動いた状態が保存されても、LPで止まらない）
 *  - 編集中の本文（.ql-editor）の中では動かさない
 *  - 最初の画面以外は HTML の hidden で隠しておく（スクリプトが無くても最初の画面は出る）
 *  - 押したときは「押す前」（capture）に受け取って止める。見本の部品のボタンは、見本自身のスクリプト
 *    （次の設問へ・ページ移動）も持っているので、画面へ移る指定を先に効かせる
 *  - 中に別の「部品を積んで作る」が入っていたら、その中の切り替えはその持ち主に任せる（idがぶつからない）
 */
import { SCREEN_ID, BLOCK_TYPES, actionOf, blockLabel, goTarget, renderBlock } from './builder-blocks.ts'
import { goTargetsIn } from '../sample-model.ts'
import { baseCss, esc, safeColor, safeImage, safeVideo, shade, wrapWidget } from './kit.ts'
import { ACCENT_PRESETS, items, pick, str, type ItemData, type NocodeTemplate } from './types.ts'

export { BLOCK_TYPES } from './builder-blocks.ts'

/** 背景の色の候補（白と、淡い地） */
const BACKGROUND_PRESETS: readonly string[] = ['#FFFFFF', '#F7F8FA', '#FFF8E7', '#FDF1EE', '#EEF6FF', '#EEF8F1']
const PADDING: Readonly<Record<string, number>> = { s: 24, m: 40, l: 56 }
const SPACER: Readonly<Record<string, number>> = { s: 16, m: 32, l: 56 }
const TRANSITIONS = ['none', 'fade', 'slide'] as const

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

/** 固定の文（入力の文字は入らない）。ES5 */
export const SCREENS_SCRIPT = `(function(){
var roots=document.querySelectorAll('[data-nc-screens]');
for(var i=0;i<roots.length;i++)start(roots[i]);
function start(root){
if(root.__ncScreens)return;
if(root.closest&&root.closest('.ql-editor'))return;
root.__ncScreens=true;
var screens=[];
for(var k=0;k<root.children.length;k++)if(root.children[k].hasAttribute('data-nc-screen'))screens.push(root.children[k]);
if(!screens.length)return;
var effect=root.getAttribute('data-nc-transition')||'none';
var reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function videos(screen,on){
var list=screen.querySelectorAll('video');
for(var v=0;v<list.length;v++){try{if(on){if(list[v].hasAttribute('autoplay'))list[v].play();}else{list[v].pause();}}catch(e){}}
}
function show(id,moved){
var next=null;
for(var j=0;j<screens.length;j++)if(screens[j].getAttribute('data-nc-screen')===id)next=screens[j];
if(!next)return;
for(var n=0;n<screens.length;n++){var on=screens[n]===next;screens[n].hidden=!on;videos(screens[n],on);}
if(!moved)return;
if(effect!=='none'&&!reduce&&next.animate){
next.animate(effect==='slide'?[{opacity:0,transform:'translateX(24px)'},{opacity:1,transform:'none'}]:[{opacity:0},{opacity:1}],{duration:240,easing:'ease-out'});
}
if(root.getBoundingClientRect().top<0)root.scrollIntoView({block:'start',behavior:reduce?'auto':'smooth'});
}
function go(e){
var t=e.target&&e.target.closest?e.target.closest('[data-nc-go]'):null;
if(!t||!root.contains(t))return null;
if(t.closest('[data-nc-screens]')!==root)return null;
return t;
}
root.addEventListener('click',function(e){
var t=go(e);
if(!t)return;
e.preventDefault();
e.stopPropagation();
show(t.getAttribute('data-nc-go'),true);
},true);
root.addEventListener('keydown',function(e){
if(e.key!=='Enter'&&e.key!==' ')return;
var t=go(e);
if(!t||t.tagName==='A'||t.tagName==='BUTTON')return;
e.preventDefault();
e.stopPropagation();
show(t.getAttribute('data-nc-go'),true);
},true);
show(root.getAttribute('data-nc-start')||screens[0].getAttribute('data-nc-screen'),false);
}
})();`

/** 見本の中身（そのまま入れられる例。1画面目で答えを選ぶと2画面目へ移る） */
const DEFAULT_SCREENS: readonly ItemData[] = [
  {
    id: 's1',
    name: '画面①',
    blocks: [
      { type: 'heading', text: 'いちばん気になるのは？', size: 'l', align: 'center', color: '#1F2A37' },
      { type: 'text', text: '当てはまるものを1つ選んでください。', size: 'm', align: 'center' },
      { type: 'button', label: '毎日の時間が足りない', look: 'choice', color: '#E5573F', action: 'screen', target: 's2', url: '', track: true },
      { type: 'button', label: '続けられるか不安', look: 'choice', color: '#E5573F', action: 'screen', target: 's2', url: '', track: true },
      { type: 'button', label: '費用が気になる', look: 'choice', color: '#E5573F', action: 'screen', target: 's2', url: '', track: true },
    ],
  },
  {
    id: 's2',
    name: '画面②',
    blocks: [
      { type: 'heading', text: 'ご回答ありがとうございます', size: 'm', align: 'center', color: '#1F2A37' },
      { type: 'list', text: '全国どこでも送料無料\n届いてから30日は返品できます\nチャットでいつでも相談できます', marker: 'check' },
      { type: 'spacer', size: 's' },
      { type: 'button', label: '詳しく見る', look: 'cta', color: '#E5573F', action: 'none', target: '', url: '', track: true },
    ],
  },
]

function screenName(screen: ItemData, index: number): string {
  const name = str(screen, 'name').trim()
  return name === '' ? `画面${index + 1}` : name
}

export const BUILDER_TEMPLATE: NocodeTemplate = {
  id: 'builder',
  name: '組み立てたWidget',
  summary: '見出し・文章・画像・ボタンなどを上から順に積んで、自由に作ります。画面を切り替えることもできます',
  icon: svg('<rect x="4" y="3" width="16" height="5" rx="1.5"/><rect x="4" y="10" width="16" height="5" rx="1.5"/><path d="M12 17v4M10 19h4"/>'),
  fields: [
    { kind: 'screens', key: 'screens', label: '画面と部品', min: 1, max: 20, blockMax: 30, types: BLOCK_TYPES },
    { kind: 'color', key: 'background', label: '背景の色', presets: BACKGROUND_PRESETS },
    {
      kind: 'select',
      key: 'padding',
      label: '上下の余白',
      options: [
        { value: 's', label: '狭い' },
        { value: 'm', label: '普通' },
        { value: 'l', label: '広い' },
      ],
    },
    { kind: 'color', key: 'accent', label: '箇条書きの印の色', presets: ACCENT_PRESETS },
    {
      kind: 'select',
      key: 'transition',
      label: '画面の切り替わり方',
      options: [
        { value: 'none', label: '瞬時に切り替える' },
        { value: 'fade', label: 'ふわっと切り替える' },
        { value: 'slide', label: '横から切り替える' },
      ],
      showIf: (data) => items(data, 'screens').length > 1,
    },
  ],
  defaults: () => ({
    screens: DEFAULT_SCREENS,
    background: '#FFFFFF',
    padding: 'm',
    accent: '#E5573F',
    transition: 'none',
  }),
  validate: (data) => {
    const screens = items(data, 'screens')
    if (screens.length === 0) return '画面を1つ以上作ってください'
    const ids = new Set(screens.map((screen) => str(screen, 'id')).filter((id) => SCREEN_ID.test(id)))
    for (const [index, screen] of screens.entries()) {
      const name = screenName(screen, index)
      const blocks = items(screen, 'blocks')
      if (blocks.length === 0) return `「${name}」に部品がありません。部品を足すか、その画面を消してください`
      for (const item of blocks) {
        const type = str(item, 'type')
        const where = `「${name}」の${blockLabel(type)}`
        if (type === 'button' && str(item, 'label').trim() === '') return `ボタンの文字が空です（${where}）。文字を書くか、その部品を消してください`
        if ((type === 'image' || type === 'imageText') && safeImage(str(item, 'image')) === '') {
          return `画像が選ばれていません（${where}）。画像を選ぶか、その部品を消してください`
        }
        if (type === 'video' && safeVideo(str(item, 'video')) === '') return `動画が選ばれていません（${where}）。動画を選ぶか、その部品を消してください`
        if ((type === 'heading' || type === 'text' || type === 'list') && str(item, 'text').trim() === '') {
          return `文字が空です（${where}）。文字を書くか、その部品を消してください`
        }
        if (actionOf(item) === 'screen' && goTarget(item, ids) === null) {
          return `移る先の画面が選ばれていません（${where}）。「移る先の画面」を選んでください`
        }
        if (type === 'sample') {
          const html = str(item, 'html')
          if (html.trim() === '') return `見本が選ばれていません（${where}）。「見本を選ぶ」から選ぶか、その部品を消してください`
          if (goTargetsIn(html).some((target) => !ids.has(target))) {
            return `移る先の画面がありません（${where}のボタン）。「押したとき」の移る先を選び直してください`
          }
        }
      }
    }
    return null
  },
  render: (data, uid, view) => {
    const s = `.${uid}`
    const background = safeColor(str(data, 'background'), '#FFFFFF')
    const accent = safeColor(str(data, 'accent'), '#E5573F')
    const padding = PADDING[pick(data, 'padding', ['s', 'm', 'l'] as const, 'm')] ?? 40
    const transition = pick(data, 'transition', TRANSITIONS, 'none')
    const screens = items(data, 'screens').filter((screen) => SCREEN_ID.test(str(screen, 'id')))
    const ids = new Set(screens.map((screen) => str(screen, 'id')))
    const previewStart = view?.screen !== undefined && ids.has(view.screen) ? view.screen : null
    const start = previewStart ?? str(screens[0] ?? {}, 'id')

    let counter = 0
    const blockCss: string[] = []
    const screenHtml = screens
      .map((screen, index) => {
        const blocks = items(screen, 'blocks').map((item) => {
          counter += 1
          const part = renderBlock(item, counter, s, ids)
          blockCss.push(part.css)
          return part.html
        })
        const id = str(screen, 'id')
        const hidden = id === start ? '' : ' hidden'
        return `<div class="nc-screen" data-nc-screen="${id}" data-nc-name="${esc(screenName(screen, index))}"${hidden}>${blocks.join('')}</div>`
      })
      .join('')

    const css =
      // ライブラリの見本の部品には土台を効かせない（見本は自分のCSSで描く）
      baseCss(s, '.nc-b-sample') +
      `${s}{padding:${padding}px 16px;background:${background}}` +
      // 見本は、LPに1つで置いたときと同じ見え方にする（文字の色・大きさ・行間は配信の土台と同じ。左右いっぱい）
      `${s} .nc-b-sample{margin-left:-16px;margin-right:-16px;color:#000000;font-size:16px;line-height:1.5;` +
      `text-align:left;font-weight:400;letter-spacing:normal}` +
      `${s} .nc-b+.nc-b{margin-top:14px}` +
      `${s} .nc-b--center{text-align:center}` +
      `${s} [data-nc-go]{cursor:pointer;-webkit-tap-highlight-color:transparent}` +
      `${s} [data-nc-go][role="button"]:focus-visible{outline:3px solid ${shade(accent, -0.3)};outline-offset:3px}` +
      `${s} .nc-b-heading{font-weight:800;line-height:1.45}` +
      `${s} .nc-b-heading--l{font-size:26px}` +
      `${s} .nc-b-heading--m{font-size:21px}` +
      `${s} .nc-b-heading--s{font-size:17px}` +
      // 最後の行に数文字だけ残さない（真ん中寄せは行の長さもそろえる）
      `${s} .nc-b-text{font-size:15px;line-height:1.85;color:#3A4452;text-wrap:pretty}` +
      `${s} .nc-b-text.nc-b--center{text-wrap:balance}` +
      `${s} .nc-b-text--s{font-size:12.5px;line-height:1.75;color:#5B6572}` +
      `${s} .nc-b-image{margin-left:0;margin-right:0}` +
      `${s} .nc-b-image img{margin:0 auto}` +
      `${s} .nc-b-image--w80 img{width:80%}` +
      `${s} .nc-b-image--w60 img{width:60%}` +
      `${s} .nc-b-image--round img{border-radius:12px}` +
      `${s} .nc-b-image__link,${s} .nc-b-video__link,${s} .nc-b-imageText__link{display:block;color:inherit;text-decoration:none}` +
      `${s} .nc-b-button{margin-top:22px}` +
      `${s} .nc-b-button--choice+.nc-b-button--choice{margin-top:10px}` +
      `${s} .nc-b-button__label{min-width:0}` +
      `${s} .nc-b-button__a svg{flex:0 0 auto;width:18px;height:18px}` +
      `${s} .nc-b-shape{display:flex;align-items:center;justify-content:center;margin-left:auto;margin-right:auto;` +
      `padding:16px;text-align:center;font-size:17px;font-weight:800;line-height:1.4;text-decoration:none}` +
      `${s} .nc-b-shape--round{border-radius:16px;min-height:88px}` +
      `${s} .nc-b-shape--rect{border-radius:0;min-height:88px}` +
      `${s} .nc-b-shape--circle{border-radius:50%;aspect-ratio:1/1}` +
      `${s} .nc-b-shape--pill{border-radius:999px;min-height:56px}` +
      ['100', '80', '60', '40'].map((w) => `${s} .nc-b-shape--w${w}{width:${w}%}`).join('') +
      `${s} .nc-b-video__v{display:block;width:100%;height:auto;border-radius:10px;background:#000000}` +
      `${s} .nc-b-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}` +
      `${s} .nc-b-list__item{display:flex;align-items:flex-start;gap:10px}` +
      `${s} .nc-b-list__mark{flex:0 0 22px;width:22px;height:22px;margin-top:2px;color:${shade(accent, -0.15)};` +
      `display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px}` +
      `${s} .nc-b-list__mark svg{width:20px;height:20px;display:block}` +
      `${s} .nc-b-list__dot{width:7px;height:7px;border-radius:50%;background:currentColor}` +
      `${s} .nc-b-list__text{min-width:0;font-size:15px;line-height:1.7;font-weight:600}` +
      `${s} .nc-b-imageText,${s} .nc-b-imageText__link{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:16px;align-items:center}` +
      `${s} .nc-b-imageText--right .nc-b-imageText__img{order:2}` +
      `${s} .nc-b-imageText__img img{border-radius:10px;width:100%}` +
      `${s} .nc-b-imageText__heading{font-size:17px;font-weight:800;line-height:1.5;margin:0 0 6px}` +
      `${s} .nc-b-imageText__text{font-size:14.5px;line-height:1.8;color:#3A4452}` +
      `${s} .nc-b-spacer,${s} .nc-b+.nc-b-spacer,${s} .nc-b-spacer+.nc-b{margin-top:0}` +
      Object.entries(SPACER)
        .map(([size, px]) => `${s} .nc-b-spacer--${size}{height:${px}px}`)
        .join('') +
      `${s} .nc-b-divider{border:0;border-top:1px solid #D5DAE0;margin:22px 0}` +
      `${s} .nc-b-divider--dotted{border-top:2px dotted #C9CFD6}` +
      `${s} .nc-b+.nc-b-divider,${s} .nc-b-divider+.nc-b{margin-top:22px}` +
      // 狭い画面では画像と文章を縦に並べる（画像が上）
      `@media (max-width:480px){${s} .nc-b-imageText,${s} .nc-b-imageText__link{grid-template-columns:minmax(0,1fr)}` +
      `${s} .nc-b-imageText--right .nc-b-imageText__img{order:0}}` +
      blockCss.join('')

    const attrs =
      ` data-nc-screens="true" data-nc-transition="${transition}"` + (previewStart === null ? '' : ` data-nc-start="${previewStart}"`)
    return wrapWidget({
      uid,
      type: 'builder',
      css,
      body: screenHtml,
      attrs,
      script: screens.length > 1 ? SCREENS_SCRIPT : undefined,
    })
  },
}
