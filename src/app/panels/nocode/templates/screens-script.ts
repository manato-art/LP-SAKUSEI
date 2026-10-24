/**
 * 部品で作ったWidgetの、画面①②③の切り替え（配信のLPで動く・ES5）。builder.ts から分けた（2026-10-24）。
 *
 * - 「押したとき＝画面へ移る」の部品（data-nc-go）を押すと、その画面を出す
 * - 切り替わり方（data-nc-transition）: none＝瞬時／fade＝ふわっと／slide＝横から … どれも1画面だけ出す
 * - stack＝下に積み重ねる（2026-10-24 本人「アンケート」・手本は発酵本家のLP）… 押した画面の下に次の画面を出し、前の画面は残す。
 *   前の画面の答えを選び直すと、その下を出し直す。出した画面まで画面が動く
 * - 押した答えには aria-pressed="true" を付ける（同じ画面のほかの答えからは外す）＝選んだ答えが分かる
 * - 編集画面（.ql-editor の中）では動かない。Widget編集のプレビューでは「ロード中」の自動の移動をしない
 */

/** 固定の文（入力の文字は入らない）。ES5 */
export const SCREENS_SCRIPT = `(function(){
var roots=document.querySelectorAll('[data-nc-screens]');
for(var i=0;i<roots.length;i++)start(roots[i]);
function start(root){
if(root.__ncScreens)return;
if(root.closest&&root.closest('.ql-editor'))return;
root.__ncScreens=true;
var screens=[];
var pops=null;
for(var k=0;k<root.children.length;k++){
if(root.children[k].hasAttribute('data-nc-screen'))screens.push(root.children[k]);
else if((' '+root.children[k].className+' ').indexOf(' nc-pops ')>=0)pops=root.children[k];
}
if(!screens.length)return;
var effect=root.getAttribute('data-nc-transition')||'none';
var stack=effect==='stack';
var path=[];
var reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var editing=!!(root.closest&&root.closest('[data-widget-preview]'));
function wait(el,screen){
if(el.closest('[data-nc-screens]')!==root)return;
clearTimeout(el.__ncWait);
el.classList.remove('is-run');void el.offsetWidth;el.classList.add('is-run');
var ms=parseInt(el.getAttribute('data-nc-wait'),10);if(!(ms>0))ms=3000;
el.__ncWait=setTimeout(function(){
if(screen.hidden||editing)return;
var to=el.getAttribute('data-nc-then');
if(to){show(to,true,screen);return;}
var a=el.querySelector('.nc-b-loading__go');if(a)a.click();
},ms);
}
function arm(screen){
var list=screen.querySelectorAll('[data-nc-wait]');
for(var w=0;w<list.length;w++)wait(list[w],screen);
}
function seen(screen){
var list=screen.querySelectorAll('[data-nc-wait]');
if(!list.length)return;
if(!window.IntersectionObserver){arm(screen);return;}
var io=new IntersectionObserver(function(es){
for(var q=0;q<es.length;q++)if(es[q].isIntersecting){io.disconnect();if(!screen.hidden)arm(screen);return;}
},{threshold:0.3});
for(var v=0;v<list.length;v++)io.observe(list[v]);
}
function videos(screen,on){
var list=screen.querySelectorAll('video');
for(var v=0;v<list.length;v++){try{if(on){if(list[v].hasAttribute('autoplay'))list[v].play();}else{list[v].pause();}}catch(e){}}
}
function screenOf(el){
var p=el;
while(p&&p.parentNode!==root)p=p.parentNode;
return p&&p.hasAttribute&&p.hasAttribute('data-nc-screen')?p:null;
}
function show(id,moved,from){
var next=null;
for(var j=0;j<screens.length;j++)if(screens[j].getAttribute('data-nc-screen')===id)next=screens[j];
if(!next)return;
if(stack){
var at=from?path.indexOf(from):path.length-1;
path=path.slice(0,at+1);
var again=path.indexOf(next);
if(again>=0)path=path.slice(0,again);
path.push(next);
for(var m=0;m<path.length;m++)root.insertBefore(path[m],pops);
}else{path=[next];}
for(var n=0;n<screens.length;n++){var on=path.indexOf(screens[n])>=0;screens[n].hidden=!on;videos(screens[n],on);}
if(moved)arm(next);else seen(next);
if(!moved)return;
if(effect!=='none'&&!reduce&&next.animate){
next.animate(effect==='slide'?[{opacity:0,transform:'translateX(24px)'},{opacity:1,transform:'none'}]:[{opacity:0},{opacity:1}],{duration:240,easing:'ease-out'});
}
if(stack){if(next.scrollIntoView)next.scrollIntoView({block:'start',behavior:reduce?'auto':'smooth'});return;}
if(root.getBoundingClientRect().top<0)root.scrollIntoView({block:'start',behavior:reduce?'auto':'smooth'});
}
function choose(t){
var screen=screenOf(t);
if(!screen)return;
var list=screen.querySelectorAll('[data-nc-go]');
for(var c=0;c<list.length;c++)if(list[c].closest('[data-nc-screens]')===root)list[c].removeAttribute('aria-pressed');
t.setAttribute('aria-pressed','true');
}
function go(e){
var t=e.target&&e.target.closest?e.target.closest('[data-nc-go]'):null;
if(!t||!root.contains(t))return null;
if(t.closest('[data-nc-screens]')!==root)return null;
return t;
}
function off(t){
return t.hasAttribute('disabled')||t.getAttribute('aria-disabled')==='true'||/(^|\\s)(is-)?disabled(\\s|$)/.test(t.getAttribute('class')||'');
}
function press(t){
choose(t);
show(t.getAttribute('data-nc-go'),true,screenOf(t));
}
root.addEventListener('click',function(e){
var t=go(e);
if(!t)return;
e.preventDefault();
e.stopPropagation();
if(off(t))return;
press(t);
},true);
root.addEventListener('keydown',function(e){
if(e.key!=='Enter'&&e.key!==' ')return;
var t=go(e);
if(!t||t.tagName==='A'||t.tagName==='BUTTON')return;
e.preventDefault();
e.stopPropagation();
if(off(t))return;
press(t);
},true);
show(root.getAttribute('data-nc-start')||screens[0].getAttribute('data-nc-screen'),false);
}
})();`
