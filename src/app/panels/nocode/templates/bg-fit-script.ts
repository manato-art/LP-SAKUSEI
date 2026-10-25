/**
 * 「大きさを自分で決める」背景の画像を、枠いっぱいに覆う大きさに対して%で当てる（配信のLPで動く・ES5・2026-10-25）。
 *
 * 本人「スマホで確認すると、画像入れるところがおかしい」: 大きさが横幅に対する%だったので、スマホで枠が細くなっても
 * 高さは縮まず、画像の上下に色が出た。CSSだけでは「覆う大きさ×%」を書けないので、ここで枠と画像の大きさを測って px で当てる
 * （計算は見たまま画面の bg-move-math.ts と同じ）。
 *
 * - 対象は印（--nc-bgfree＝大きさ%・bg-image.ts の bgCss が付ける）と背景の画像のある面だけ。Widgetの外枠（data-nc-bgfree）から探す
 * - 枠の大きさが変わったら（画面の幅・画面の切り替えで出たとき）測り直す。大きさ0（隠れている画面）は飛ばす
 * - 編集画面（.ql-editor の中）では動かない（CSSの横幅に対する%のまま）
 * - 外枠の __ncBgFit() で探し直して測り直す（Widget編集で見た目＝CSSだけ変えたときは要素が入れ替わらないので、
 *   widget-studio-builder.ts が呼ぶ。印が外れた面＝「いっぱい」に戻した面は、当てた大きさを外す）
 */

/** 固定の文（入力の文字は入らない）。ES5 */
export const BG_FIT_SCRIPT = `(function(){
var roots=document.querySelectorAll('[data-nc-bgfree]');
for(var i=0;i<roots.length;i++)start(roots[i]);
function start(root){
if(root.__ncBgFree)return;
if(root.closest&&root.closest('.ql-editor'))return;
root.__ncBgFree=true;
var list=[],sizes={};
var ro=window.ResizeObserver?new ResizeObserver(fit):null;
function scan(){
for(var p=0;p<list.length;p++)list[p].el.style.removeProperty('background-size');
list=[];
var all=[root],kids=root.querySelectorAll('*');
for(var k=0;k<kids.length;k++)all.push(kids[k]);
for(var a=0;a<all.length;a++){
var st=getComputedStyle(all[a]);
var pct=parseFloat(st.getPropertyValue('--nc-bgfree'));
var m=/url\\((['"]?)(.*?)\\1\\)/.exec(st.backgroundImage||'');
if(pct>0&&m){list.push({el:all[a],pct:pct,src:m[2]});load(m[2]);}
}
if(ro){ro.disconnect();for(var o=0;o<list.length;o++)ro.observe(list[o].el);}
}
function fit(){
for(var q=0;q<list.length;q++){
var t=list[q],n=sizes[t.src],w=t.el.offsetWidth,h=t.el.offsetHeight;
if(!n||!n.w||!n.h||!w||!h)continue;
var px=n.w*Math.max(w/n.w,h/n.h)*t.pct/100;
t.el.style.setProperty('background-size',Math.round(px*100)/100+'px auto','important');
}
}
function load(src){
if(sizes[src])return;
sizes[src]={};
var img=new Image();
img.onload=function(){sizes[src]={w:img.naturalWidth,h:img.naturalHeight};fit();};
img.src=src;
}
root.__ncBgFit=function(){scan();fit();};
scan();
fit();
if(!ro){
window.addEventListener('resize',fit);
root.addEventListener('click',function(){setTimeout(fit,0);});
}
}
})();`
