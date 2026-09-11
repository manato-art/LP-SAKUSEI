/**
 * 外部LPに貼る計測スクリプトの本体（サーバーが `/t/:uid.js` として配信する）。
 *
 * 貼るのは1行のローダー（`<script src="…/t/<uid>.js" async>`）だけにして、
 * 中身はここから配る。こうすると計測ロジックを直したときに、相手のLPへ貼り直して
 * もらう必要がなくなる（GA・Metaピクセルと同じ方式）。
 *
 * 収集するもの:
 *   pv      : 表示ごとに1
 *   click   : 「計測機能付きリンク」(`sb_tracking=true`)のクリック
 *   heatmap : ページを20バンドに割った 到達 / 滞在(ms) / 離脱位置 / クリック座標
 *   vid     : pv / click に付ける訪問者の目印（Cookie _sb_tu、押したリンクに付いた squadbeyond_uid）。
 *             CVタグから届いた成果を、この表示・クリックのVersionに結びつける（2026-09-11）
 *             離脱時(pagehide/visibilitychange)に1回だけまとめて送る
 *
 * 送信の注意（実測で踏んだ）:
 *   sendBeacon は `application/json` だとクロスオリジンでプリフライトが要求されるが、
 *   sendBeacon はプリフライトできないため送信自体が失敗する。
 *   単純リクエストとして通る `text/plain` で送り、サーバー側でJSONとして解釈する。
 */

/** ページを縦に割る数。サーバーの集計（HeatmapStat.bands）と必ず揃える。 */
// 面のグラデーションを細かく出すため 100 分割で集める（行の目盛りは5%刻み21段のまま）。
// 20分割だとLP1本を20個の塊でしか見られず、どこで読まれたかが潰れてしまう。
export const HEATMAP_BANDS = 100

/**
 * 計測スクリプトの中身（`<script>` タグは含まない）。
 * @param endpoint ビーコンの送信先（絶対URL）
 * @param versionUid 自前配信でVersion別に集計したいときだけ渡す。外部LPでは省略。
 */
export function buildTrackingScriptBody(endpoint: string, versionUid?: string): string {
  const v = versionUid === undefined ? 'null' : JSON.stringify(versionUid)
  return `(function(){
  var U=${JSON.stringify(endpoint)},V=${v},B=${HEATMAP_BANDS};
  function cookie(n){var m=document.cookie.match(new RegExp('(^| )'+n+'=([^;]+)'));return m?m[2]:null}
  function withVid(obj,id){if(id)obj.vid=id;return obj}
  /* 訪問者の目印（SquadBeyond 本体と同じ Cookie _sb_tu）。CVタグの成果を、この表示・クリックに結びつける */
  var VID=cookie('_sb_tu');
  function post(obj){
    var s=JSON.stringify(V===null?obj:Object.assign({version:V},obj));
    try{
      if(navigator.sendBeacon&&navigator.sendBeacon(U,new Blob([s],{type:'text/plain'})))return;
    }catch(e){}
    try{
      fetch(U,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain'},body:s,keepalive:true});
    }catch(e){}
  }
  /* ヒートマップの背景に実LPを敷くため、どのページで測っているかを1度だけ知らせる。
     クエリとハッシュは落とす（広告パラメータや個人情報が紛れ得るので保存しない）。
     背景に使うのは見た目だけなので origin+pathname で足りる。 */
  post(withVid({event:'pv',u:location.origin+location.pathname},VID));

  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest&&e.target.closest('a');
    if(!a)return;
    var h=a.getAttribute('href')||'';
    var t=/^tel:/i.test(h)?(a.getAttribute('data-sb-'+'tracking')==='true')
                          :/[?&]sb_tracking=true(?:[&#]|$)/.test(h);
    /* 押したリンクに付いた目印（遷移先に届くのと同じ値）を優先する */
    if(t){var q=/[?&]squadbeyond_uid=([^&#]+)/.exec(h);post(withVid({event:'click'},q?decodeURIComponent(q[1]):VID));}
  },true);

  var reach=new Array(B).fill(0),dwell=new Array(B).fill(0),clicks=[];
  var lastT=Date.now(),maxBand=0,sent=false;
  function docH(){return Math.max(1,document.documentElement.scrollHeight-window.innerHeight)}
  function curBand(){return Math.max(0,Math.min(B-1,Math.floor((window.scrollY/docH())*B)))}
  function tick(){
    var now=Date.now(),b=curBand(),full=docH()+window.innerHeight;
    var from=Math.max(0,Math.floor((window.scrollY/full)*B));
    var to=Math.min(B-1,Math.floor(((window.scrollY+window.innerHeight)/full)*B));
    for(var i=from;i<=to;i++)dwell[i]+=(now-lastT);
    lastT=now; if(b>maxBand)maxBand=b;
  }
  window.addEventListener('scroll',tick,{passive:true});
  // 滞在時間用の定期計測。タブが裏に回ったら止める（見ていない間は数えない・負荷も落とす）
  var timer=setInterval(tick,1000);
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){ if(timer){clearInterval(timer);timer=null} }
    else if(!timer){ lastT=Date.now(); timer=setInterval(tick,1000) }
  });
  document.addEventListener('click',function(e){
    var h=document.documentElement.scrollHeight||1,w=window.innerWidth||1;
    clicks.push({x:Math.round((e.clientX/w)*1000)/1000,y:Math.round((e.pageY/h)*1000)/1000});
    if(clicks.length>300)clicks.shift();
  },true);
  function flush(){
    if(sent)return; sent=true; tick();
    for(var i=0;i<=maxBand;i++)reach[i]=1;
    post({event:'heatmap',bands:B,reach:reach,dwell:dwell,exit_band:curBand(),clicks:clicks});
  }
  window.addEventListener('pagehide',flush);
  document.addEventListener('visibilitychange',function(){if(document.hidden)flush()});
})()`
}

/** 受け渡しタグとCVタグが、広告主サイトに目印を保存するキー（localStorage） */
const KEEP_KEY = 'sb_uid'

/** 目印（squadbeyond_uid）をURLから拾って1日保存する処理（受け渡しタグとCVタグで共通） */
function keepUidSnippet(): string {
  return `var K=${JSON.stringify(KEEP_KEY)},DAY=86400000;
  function fromUrl(){try{var v=new URLSearchParams(location.search).get('squadbeyond_uid');return v?v:null}catch(e){return null}}
  function keep(v){try{localStorage.setItem(K,JSON.stringify({v:v,t:Date.now()}))}catch(e){}}
  function kept(){try{var o=JSON.parse(localStorage.getItem(K)||'null');return o&&typeof o.v==='string'&&Date.now()-o.t<=DAY?o.v:null}catch(e){return null}}
  var UID=fromUrl();if(UID)keep(UID);`
}

/**
 * CV計測（サンクスページ用）。`amount` に金額を入れれば売上も計上する。
 * 成果は訪問者の目印（squadbeyond_uid）と一緒に送る。目印はサンクスページのURL、無ければ受け渡しタグが保存したもの（1日以内）。
 * 目印が無い成果は、どのLPを見た人か分からず数えられないので送らない（SquadBeyond 本体と同じ・2026-09-11）。
 */
export function buildCvScriptBody(endpoint: string): string {
  return `(function(){
  var U=${JSON.stringify(endpoint)};
  ${keepUidSnippet()}
  var uid=UID||kept();
  if(!uid)return;
  // 売上も計上する場合: window.__sbCvAmount = 12800 をこのタグより前に置く
  var amt=(typeof window.__sbCvAmount==='number')?window.__sbCvAmount:0;
  var s=JSON.stringify({event:'cv',amount:amt,vid:uid});
  try{
    if(navigator.sendBeacon&&navigator.sendBeacon(U,new Blob([s],{type:'text/plain'})))return;
  }catch(e){}
  try{
    fetch(U,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain'},body:s,keepalive:true});
  }catch(e){}
})()`
}

/**
 * 受け渡しタグ（広告主サイトの最初のページ＝LPのリンク先に貼る）。
 * LPのリンクに付いてきた目印（squadbeyond_uid）を、そのサイトに1日保存するだけ。
 * サンクスページまでURLの目印が引き継がれなくても、同じサイトのサンクスページのCVタグがこの目印を使える。
 */
export function buildKeepUidScriptBody(): string {
  return `(function(){
  ${keepUidSnippet()}
})()`
}
