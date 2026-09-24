/**
 * 「押したとき」のLP上のアクション（2026-09-24・本人「LP上アクションをできるように。例えば画像を表示したりクーポンみたいな」）。
 *
 * 画像を大きく・動画を大きく・クーポン＝押すと小窓（中身はWidgetの中に隠して置く）／小窓で見せる＝選んだ画面を小窓に出す／
 * LPの場所へ移動／文字をコピー／閉じる（入っているポップアップ・小窓を閉じる）。電話をかける＝tel: のリンク（block-kit.ts の hrefOf）。
 * 押せる部品すべて（ボタン・画像・図形・動画・画像と文章・移行先・押せる型）で使える。
 *
 * ⚠️ スクリプトの決まり（builder.ts の SCREENS_SCRIPT・countdown.ts と同じ）
 *  - 入力は一切入れない固定の文。中身は属性（data-nc-pop・data-nc-copy など）から読む
 *  - Widgetごとに1回（root.__ncActs）。編集中の本文（.ql-editor）では動かさない
 *  - 押したときは「押す前」（capture）に受け取って止める（見本や型の中のボタンの動き・ポップアップの「押したら移動」より先）
 *  - Widget編集の見たまま画面では、ふつうに押すと部品を選ぶ（画面が先に止める）。⌘/Ctrl＋押すと動きを確かめられる
 *  - 小窓は Widget の中に置く（Widgetだけに効くCSSのまま出すため）。position:fixed で画面いっぱいに重ねる
 */
import { SCREEN_ID, actionOf, goAttrs, goTarget, telDigits } from './block-kit.ts'
import { esc, safeColor, safeImage, safeVideo, shade, inkOn } from './kit.ts'
import { str, type ItemData } from './types.ts'

/** 書き出しの途中で集めるもの（小窓の中身と、使ったアクションの種類） */
export interface PressContext {
  readonly screenIds: ReadonlySet<string>
  /** Widgetの名前（小窓の id の頭） */
  readonly uid: string
  readonly pops: string[]
  /** 小窓ごとのCSS（クーポンの色など） */
  readonly css: string[]
  /** 'act'＝スクリプトと小窓のCSSが要る／'modal'＝画面を出す小窓が要る */
  readonly flags: Set<string>
}

export function pressContext(screenIds: ReadonlySet<string>, uid: string): PressContext {
  return { screenIds, uid, pops: [], css: [], flags: new Set<string>() }
}

/** LPの目印（id）に使える文字 */
const ANCHOR = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/

/** 移動する場所（top・below・#目印）。目印が使えない文字なら null */
function scrollWhere(item: ItemData): string | null {
  const where = str(item, 'actScroll')
  if (where === 'top') return 'top'
  if (where === 'id') {
    const anchor = str(item, 'actAnchor').trim()
    return ANCHOR.test(anchor) ? `#${anchor}` : null
  }
  return 'below'
}

/** 小窓（×・背景・Esc で閉じる）。中身は隠しておき、押したらスクリプトが出す */
function popLayer(id: string, kind: string, label: string, content: string): string {
  return (
    `<div class="nc-pop" id="${id}" role="dialog" aria-modal="true" aria-label="${label}" hidden>` +
    `<div class="nc-pop__box nc-pop__box--${kind}"><button type="button" class="nc-pop__x" data-nc-close="true" aria-label="閉じる">×</button>` +
    `${content}</div></div>`
  )
}

/** 画面を出す小窓（Widgetに1つ。押したら、選んだ画面をここへ移して出す） */
export const MODAL_LAYER =
  `<div class="nc-pop" data-nc-modal-layer="true" role="dialog" aria-modal="true" aria-label="小窓" hidden>` +
  `<div class="nc-pop__box nc-pop__box--screen"><button type="button" class="nc-pop__x" data-nc-close="true" aria-label="閉じる">×</button>` +
  `<div class="nc-pop__slot"></div></div></div>`

function couponHtml(item: ItemData): string {
  const title = str(item, 'actTitle').trim()
  const code = str(item, 'actCode').trim()
  const note = str(item, 'actNote').trim()
  return (
    `<div class="nc-pop-coupon">` +
    (title === '' ? '' : `<p class="nc-pop-coupon__title">${esc(title)}</p>`) +
    `<p class="nc-pop-coupon__amount">${esc(str(item, 'actAmount').trim())}</p>` +
    (code === ''
      ? ''
      : `<div class="nc-pop-coupon__code"><span class="nc-pop-coupon__value">${esc(code)}</span>` +
        `<button type="button" class="nc-pop-coupon__copy" data-nc-copy="${esc(code)}">コピー</button></div>`) +
    (note === '' ? '' : `<p class="nc-pop-coupon__note">${esc(note)}</p>`) +
    `</div>`
  )
}

/**
 * 押したときの印（画面へ移る・小窓・場所へ移動・コピー・閉じる）。リンク（URL・電話）は hrefOf で <a href> にする。
 * 小窓の中身は ctx.pops に集める（i は部品の通し番号＝小窓の id）。ボタン・リンク以外には「押せる」印も付ける
 */
export function pressAttrs(item: ItemData, i: number, ctx: PressContext, isControl: boolean): string {
  const role = isControl ? '' : ' role="button" tabindex="0"'
  const pop = (kind: string, label: string, content: string): string => {
    const id = `${ctx.uid}-p${i}`
    ctx.pops.push(popLayer(id, kind, label, content))
    ctx.flags.add('act')
    return ` data-nc-pop="${id}"${role}`
  }
  switch (actionOf(item)) {
    case 'screen':
      return goAttrs(goTarget(item, ctx.screenIds), isControl)
    case 'modal': {
      const target = str(item, 'target')
      if (!SCREEN_ID.test(target) || !ctx.screenIds.has(target)) return ''
      ctx.flags.add('act')
      ctx.flags.add('modal')
      return ` data-nc-modal="${target}"${role}`
    }
    case 'image': {
      const src = safeImage(str(item, 'actImage'))
      return src === '' ? '' : pop('image', '画像', `<img class="nc-pop__img" src="${src}" alt="">`)
    }
    case 'video': {
      const src = safeVideo(str(item, 'actVideo'))
      return src === '' ? '' : pop('video', '動画', `<video class="nc-pop__video" src="${src}" controls playsinline preload="none"></video>`)
    }
    case 'coupon': {
      if (str(item, 'actAmount').trim() === '') return ''
      // クーポンの色は、押した部品の色（無ければ朱）。Widgetだけに効くCSSで渡す（style 属性は使わない）
      const color = safeColor(str(item, 'color'), '#E5573F')
      ctx.css.push(`.${ctx.uid} #${ctx.uid}-p${i}{--nc-pop-accent:${color};--nc-pop-ink:${inkOn(color)};--nc-pop-deep:${shade(color, -0.2)}}`)
      return pop('coupon', 'クーポン', couponHtml(item))
    }
    case 'scroll': {
      const where = scrollWhere(item)
      if (where === null) return ''
      ctx.flags.add('act')
      return ` data-nc-scroll="${where}"${role}`
    }
    case 'copy': {
      const text = str(item, 'actCopy')
      if (text.trim() === '') return ''
      ctx.flags.add('act')
      return ` data-nc-copy="${esc(text)}"${role}`
    }
    case 'close':
      ctx.flags.add('act')
      return ` data-nc-close="true"${role}`
    default:
      return ''
  }
}

/** 移行先の読み上げの名前（押したら何が起きるか） */
export function pressLabel(item: ItemData, screenName: string): string {
  switch (actionOf(item)) {
    case 'screen':
      return `${screenName}へ`
    case 'modal':
      return `${screenName}を開く`
    case 'image':
      return '画像を大きく見る'
    case 'video':
      return '動画を再生'
    case 'coupon':
      return 'クーポンを見る'
    case 'scroll':
      return 'ページの中を移動'
    case 'copy':
      return 'コピー'
    case 'close':
      return '閉じる'
    case 'tel':
      return '電話をかける'
    default:
      return 'リンクを開く'
  }
}

/** LP上のアクションの、保存の前の確かめ。問題が無ければ null */
export function lpActionProblem(item: ItemData, where: string, screenIds: ReadonlySet<string>): string | null {
  switch (actionOf(item)) {
    case 'image':
      return safeImage(str(item, 'actImage')) === '' ? `大きく見せる画像が選ばれていません（${where}）。「押したとき」で画像を選んでください` : null
    case 'video':
      return safeVideo(str(item, 'actVideo')) === '' ? `大きく再生する動画が選ばれていません（${where}）。「押したとき」で動画を選んでください` : null
    case 'coupon':
      return str(item, 'actAmount').trim() === '' ? `クーポンの割引が空です（${where}）。「500円OFF」などを書いてください` : null
    case 'modal': {
      const target = str(item, 'target')
      return SCREEN_ID.test(target) && screenIds.has(target) ? null : `小窓に出す画面が選ばれていません（${where}）。「小窓に出す画面」を選んでください`
    }
    case 'scroll':
      return scrollWhere(item) === null ? `LPの目印（id）が空か、使えない文字があります（${where}）。半角英数字・-・_ で書いてください` : null
    case 'copy':
      return str(item, 'actCopy').trim() === '' ? `コピーする文字が空です（${where}）。文字を書いてください` : null
    case 'tel':
      return telDigits(str(item, 'actTel')).replace('+', '').length < 3 ? `電話番号が空か、数字がありません（${where}）。番号を書いてください` : null
    default:
      return null
  }
}

/** 小窓とコピーの知らせのCSS（アクションを使っているWidgetにだけ出す） */
export function popsCss(s: string): string {
  return (
    `${s} .nc-pop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;` +
    `background:rgba(15,17,21,.62);animation:nc-pop-in .16s ease-out}` +
    `${s} .nc-pop[hidden]{display:none}` +
    `${s} .nc-pop__box{position:relative;width:min(520px,100%);max-height:calc(100vh - 40px);overflow:auto;border-radius:14px;` +
    `background:#FFFFFF;box-shadow:0 20px 50px rgba(0,0,0,.35);text-align:left;color:#1F2A37}` +
    `${s} .nc-pop__box--image,${s} .nc-pop__box--video{width:auto;max-width:min(920px,100%);background:transparent;box-shadow:none;overflow:visible}` +
    `${s} .nc-pop__img{display:block;max-width:100%;max-height:calc(100vh - 80px);width:auto;height:auto;margin:0 auto;border-radius:10px}` +
    `${s} .nc-pop__video{display:block;width:min(880px,calc(100vw - 40px));max-height:calc(100vh - 80px);border-radius:10px;background:#000000}` +
    `${s} .nc-pop__box--screen{padding:36px 16px 20px}` +
    `${s} .nc-pop__x{position:absolute;right:8px;top:8px;z-index:2;width:32px;height:32px;border:1px solid #DDE2E8;border-radius:50%;` +
    `background:#FFFFFF;color:#1F2A37;font-size:18px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.18)}` +
    `${s} .nc-pop__x:focus-visible,${s} .nc-pop-coupon__copy:focus-visible{outline:3px solid #0074D9;outline-offset:2px}` +
    `${s} .nc-pop-coupon{padding:32px 24px 24px;text-align:center}` +
    `${s} .nc-pop-coupon__title{margin:0 0 4px;font-size:14px;font-weight:800;color:#3A4452}` +
    `${s} .nc-pop-coupon__amount{margin:0 0 16px;font-size:34px;font-weight:900;line-height:1.2;color:var(--nc-pop-deep)}` +
    `${s} .nc-pop-coupon__code{display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 12px;` +
    `border:2px dashed var(--nc-pop-accent);border-radius:10px}` +
    `${s} .nc-pop-coupon__value{font-size:18px;font-weight:900;letter-spacing:.06em;font-family:ui-monospace,Menlo,monospace;` +
    `user-select:all;-webkit-user-select:all;overflow-wrap:anywhere}` +
    `${s} .nc-pop-coupon__copy{flex:0 0 auto;min-height:36px;padding:0 14px;border:0;border-radius:8px;background:var(--nc-pop-accent);` +
    `color:var(--nc-pop-ink);font-size:14px;font-weight:800;cursor:pointer}` +
    `${s} .nc-pop-coupon__note{margin:12px 0 0;font-size:12px;color:#6B7480}` +
    `${s} .nc-toast{position:fixed;left:50%;bottom:24px;z-index:2147483001;transform:translateX(-50%);padding:10px 18px;border-radius:999px;` +
    `background:#1F2A37;color:#FFFFFF;font-size:14px;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.25)}` +
    `${s} .nc-toast[hidden]{display:none}` +
    `@keyframes nc-pop-in{from{opacity:0}to{opacity:1}}` +
    `@media (prefers-reduced-motion:reduce){${s} .nc-pop{animation:none}}`
  )
}

/** 固定の文（入力の文字は入らない）。ES5 */
export const ACTIONS_SCRIPT = `(function(){
var roots=document.querySelectorAll('[data-nc-screens]');
for(var i=0;i<roots.length;i++)start(roots[i]);
function start(root){
if(root.__ncActs)return;
if(root.closest&&root.closest('.ql-editor'))return;
root.__ncActs=true;
var SEL='[data-nc-pop],[data-nc-modal],[data-nc-scroll],[data-nc-copy],[data-nc-close]';
var reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var open=null,from=null,moved=null,home=null,next=null;
function own(t){return t.closest('[data-nc-screens]')===root;}
function close(){
if(!open)return;
var v=open.querySelectorAll('video');for(var k=0;k<v.length;k++){try{v[k].pause();}catch(e){}}
if(moved&&home){home.insertBefore(moved,next);moved.hidden=true;}
open.hidden=true;open=null;moved=null;home=null;next=null;
if(from&&from.focus){try{from.focus();}catch(e){}}
from=null;
}
function show(layer,t){
close();
open=layer;from=t;layer.hidden=false;
var x=layer.querySelector('.nc-pop__x');if(x&&x.focus){try{x.focus();}catch(e){}}
}
function toast(text){
var n=root.querySelector('.nc-toast');
if(!n){n=document.createElement('div');n.className='nc-toast';n.setAttribute('role','status');root.appendChild(n);}
n.textContent=text;n.hidden=false;clearTimeout(n.__ncT);n.__ncT=setTimeout(function(){n.hidden=true;},1600);
}
function copy(text){
function done(){toast('コピーしました');}
function old(){var a=document.createElement('textarea');a.value=text;a.setAttribute('readonly','');a.style.position='fixed';a.style.opacity='0';
document.body.appendChild(a);a.select();try{if(document.execCommand('copy'))done();}catch(e){}document.body.removeChild(a);}
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done,old);}else{old();}
}
function go(where){
var top=null;
if(where==='top')top=0;
else if(where==='below')top=root.getBoundingClientRect().bottom+window.pageYOffset;
else if(where.charAt(0)==='#'){var el=document.getElementById(where.slice(1));if(el)top=el.getBoundingClientRect().top+window.pageYOffset;}
if(top===null)return;
try{window.scrollTo({top:top,behavior:reduce?'auto':'smooth'});}catch(e){window.scrollTo(0,top);}
}
function shut(t){
if(open&&open.contains(t)){close();return;}
var ep=t.closest('.ep-overlay');if(ep){var x=ep.querySelector('.ep-close');if(x)x.click();return;}
var fp=t.closest('[id^="follow-popup-"]');if(fp){var c=fp.querySelector('.fp-close');if(c){c.click();}else if(fp.parentNode){fp.parentNode.removeChild(fp);}}
}
function act(t){
if(t.hasAttribute('data-nc-close')){shut(t);return;}
var id=t.getAttribute('data-nc-pop');
if(id){var layer=document.getElementById(id);if(layer&&root.contains(layer)){show(layer,t);var v=layer.querySelector('video');if(v){try{v.play();}catch(e){}}}return;}
var m=t.getAttribute('data-nc-modal');
if(m){
var box=root.querySelector('[data-nc-modal-layer]');var list=root.querySelectorAll('[data-nc-screen]');var sc=null;
for(var j=0;j<list.length;j++)if(list[j].getAttribute('data-nc-screen')===m)sc=list[j];
if(box&&sc&&!box.contains(t)){show(box,t);home=sc.parentNode;next=sc.nextSibling;moved=sc;box.querySelector('.nc-pop__slot').appendChild(sc);sc.hidden=false;}
return;}
var s=t.getAttribute('data-nc-scroll');if(s){close();go(s);return;}
var c=t.getAttribute('data-nc-copy');if(c!==null)copy(c);
}
root.addEventListener('click',function(e){
var t=e.target&&e.target.closest?e.target.closest(SEL):null;
if(t&&root.contains(t)&&own(t)){e.preventDefault();e.stopPropagation();act(t);return;}
if(!open)return;
if(e.target===open){e.preventDefault();e.stopPropagation();close();return;}
var g=e.target&&e.target.closest?e.target.closest('[data-nc-go]'):null;
if(g&&open.contains(g))setTimeout(close,0);
},true);
root.addEventListener('keydown',function(e){
if(e.key==='Escape'&&open){e.preventDefault();close();return;}
if(e.key!=='Enter'&&e.key!==' ')return;
var t=e.target&&e.target.closest?e.target.closest(SEL):null;
if(!t||!own(t)||t.tagName==='A'||t.tagName==='BUTTON')return;
e.preventDefault();e.stopPropagation();act(t);
},true);
}
})();`
