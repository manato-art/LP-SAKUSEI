/**
 * 外部LPに貼る計測スクリプトの本体（サーバーが `/t/:uid.js` として配信する）。
 *
 * 貼るのは1行のローダー（`<script src="…/t/<uid>.js" async>`）だけにして、
 * 中身はここから配る。こうすると計測ロジックを直したときに、相手のLPへ貼り直して
 * もらう必要がなくなる（GA・Metaピクセルと同じ方式）。
 *
 * 収集するもの:
 *   pv      : 表示ごとに1（着地URLの広告パラメータ params を添える）
 *   click   : 「計測機能付きリンク」(`sb_tracking=true`)のクリック（同上）
 *   heatmap : ページを100バンドに割った 到達 / 滞在(ms) / 離脱位置 / クリック座標 /
 *             画面1枚ぶんの幅(fv) / 最初の計測リンクの位置(offer) /
 *             着地URLの広告パラメータ(params・utm_* のみ)
 *             ＝ FVER・SVER・FSVER・OAR の材料（2026-09-15）
 *             到達と離脱位置は「画面の下端がページの何割まで来たか」で数える（rb:1・2026-09-24）。
 *             rb が無い送信は古いタグ（スクロールの進み具合で数えていた）
 *   load    : ヒートマップに添える、読み込み完了までの時間 { ms, done }（表示が遅い人の割合・2026-09-16）
 *   wd      : 自動操作中のブラウザ（navigator.webdriver）のときだけ 1。サーバーはボットとして数えない（2026-09-16）
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
    /* 自動操作中のブラウザ（Selenium・Puppeteer・Playwright）はサーバーで数えない。人のときは何も付けない */
    if(navigator.webdriver===true)obj.wd=1;
    var s=JSON.stringify(V===null?obj:Object.assign({version:V},obj));
    try{
      if(navigator.sendBeacon&&navigator.sendBeacon(U,new Blob([s],{type:'text/plain'})))return;
    }catch(e){}
    try{
      fetch(U,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain'},body:s,keepalive:true});
    }catch(e){}
  }
  /* 着地URLの広告パラメータ。ヒートマップを広告ごとに見るための絞り込みに使う。
     拾うのは utm_ で始まるものだけ: 他のクエリにはメールアドレスやトークンが紛れ得るし、
     実物のヒートマップに並ぶのも utm_* だけだった（採取物で確認）。
     あとで replaceState でURLが書き換わるので、着地した時点で取っておく。 */
  var PRM=(function(){
    try{
      var out=[];
      new URLSearchParams(location.search).forEach(function(v,k){
        if(out.length>=20)return;
        if(!/^utm_[A-Za-z0-9_]{1,24}$/.test(k))return;
        if(v==='')return;
        out.push(k+'='+String(v).slice(0,120));
      });
      return out;
    }catch(e){return []}
  })();
  /* ヒートマップの背景に実LPを敷くため、どのページで測っているかを1度だけ知らせる。
     クエリとハッシュは落とす（広告パラメータや個人情報が紛れ得るので保存しない）。
     背景に使うのは見た目だけなので origin+pathname で足りる。 */
  post(withVid({event:'pv',u:location.origin+location.pathname,params:PRM},VID));

  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest&&e.target.closest('a');
    if(!a)return;
    var h=a.getAttribute('href')||'';
    var t=/^tel:/i.test(h)?(a.getAttribute('data-sb-'+'tracking')==='true')
                          :/[?&]sb_tracking=true(?:[&#]|$)/.test(h);
    /* 押したリンクに付いた目印（遷移先に届くのと同じ値）を優先する */
    if(t){var q=/[?&]squadbeyond_uid=([^&#]+)/.exec(h);post(withVid({event:'click',params:PRM},q?decodeURIComponent(q[1]):VID));}
  },true);

  var reach=new Array(B).fill(0),dwell=new Array(B).fill(0),clicks=[];
  var lastT=Date.now(),maxBand=0,sent=false;
  /* 前に時間を足したときの画面の位置。次に足す時間は、この位置を見ていた時間（2026-09-25） */
  var lastY=window.scrollY,lastH=window.innerHeight;
  function docH(){return Math.max(1,document.documentElement.scrollHeight-window.innerHeight)}
  /* 到達の物差しは「画面の下端がページの何割まで来たか」（2026-09-24）。
     リンクの位置・FV・滞在・クリックと同じ「ページ上の位置」でそろえる。
     以前はスクロールの進み具合（scrollY/(ページ-画面)）だったので、最初の画面にあるリンクでも
     スクロールしないと「到達していない」ことになっていた。送る中身に rb:1 を付けて新旧を見分ける。 */
  function curBand(){
    var full=docH()+window.innerHeight;
    return Math.max(0,Math.min(B-1,Math.ceil(((window.scrollY+window.innerHeight)/full)*B)-1));
  }
  /* 滞在時間は「前に足したときから今まで画面に出ていた場所」に付ける。
     スクロールした瞬間に呼ばれたとき、それまでの時間はスクロール前の場所で読んでいた時間なので、
     今の（スクロール後の）場所に付けない（以前はそうしていて、1回のスクロールで最大1秒ずれた・2026-09-25）。
     ページの高さは画像の読み込みで伸びるので、割合は今の高さで出す。 */
  function tick(){
    var now=Date.now(),b=curBand(),full=docH()+window.innerHeight;
    var from=Math.max(0,Math.floor((lastY/full)*B));
    var to=Math.min(B-1,Math.floor(((lastY+lastH)/full)*B));
    for(var i=from;i<=to;i++)dwell[i]+=(now-lastT);
    lastT=now; lastY=window.scrollY; lastH=window.innerHeight; if(b>maxBand)maxBand=b;
  }
  window.addEventListener('scroll',tick,{passive:true});
  // 滞在時間用の定期計測。タブが裏に回ったら止める（見ていない間は数えない・負荷も落とす）
  var timer=setInterval(tick,1000);
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){ if(timer){clearInterval(timer);timer=null} }
    else if(!timer){ lastT=Date.now(); lastY=window.scrollY; lastH=window.innerHeight; timer=setInterval(tick,1000) }
  });
  document.addEventListener('click',function(e){
    var h=document.documentElement.scrollHeight||1,w=window.innerWidth||1;
    /* cx＝画面の真ん中から何px（2026-09-25）。LPは真ん中寄せなので、画面の幅が違っても同じ場所を指す */
    clicks.push({x:Math.round((e.clientX/w)*1000)/1000,y:Math.round((e.pageY/h)*1000)/1000,cx:Math.round(e.clientX-w/2)});
    if(clicks.length>300)clicks.shift();
  },true);
  /* 画面1枚ぶん（ファーストビュー）が何バンドぶんかを返す。
     FVER/SVER は「最初の画面／2画面目の中で離脱した割合」なので、この幅が要る。
     ページが1画面に収まるときは全体＝ファーストビュー。 */
  function fvBands(){
    var full=docH()+window.innerHeight;
    return Math.max(1,Math.min(B,Math.ceil((window.innerHeight/full)*B)));
  }
  /* 最初の「計測機能付きリンク」が何バンド目にあるか（オファー到達率の基準位置）。
     クリック計測と同じ判定（sb_tracking=true）で拾う。無ければ -1。 */
  function offerBand(){
    var full=docH()+window.innerHeight,best=-1;
    var list=document.querySelectorAll('a[href]');
    for(var i=0;i<list.length;i++){
      var h=list[i].getAttribute('href')||'';
      if(!/[?&]sb_tracking=true(?:[&#]|$)/.test(h))continue;
      var r=list[i].getBoundingClientRect();
      var y=r.top+window.scrollY;
      var b=Math.max(0,Math.min(B-1,Math.floor((y/full)*B)));
      if(best<0||b<best)best=b;
    }
    return best;
  }
  /* 読み込み完了までの時間（表示の遅さ）。終わっていなければ、帰るまでの時間を done:0 で返す。
     遅くて帰った人ほど「終わった記録」を残さないので、捨てずに送る。測れなければ null。 */
  function loadInfo(){
    try{
      if(typeof performance==='undefined')return null;
      var n=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];
      if(n&&n.loadEventEnd>0)return {ms:Math.round(n.loadEventEnd),done:1};
      var t=performance.timing;
      if(t&&t.loadEventEnd>0&&t.navigationStart>0)return {ms:t.loadEventEnd-t.navigationStart,done:1};
      if(typeof performance.now==='function')return {ms:Math.round(performance.now()),done:0};
    }catch(e){}
    return null;
  }
  function flush(){
    if(sent)return; sent=true; tick();
    for(var i=0;i<=maxBand;i++)reach[i]=1;
    var body={event:'heatmap',bands:B,reach:reach,dwell:dwell,exit_band:curBand(),
      fv:fvBands(),offer:offerBand(),params:PRM,clicks:clicks,rb:1};
    var ld=loadInfo();
    if(ld)body.load=ld;
    post(body);
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
  var o={event:'cv',amount:amt,vid:uid};
  /* 自動操作中のブラウザ（動作確認など）の成果は数えない。人のときは何も付けない */
  if(navigator.webdriver===true)o.wd=1;
  var s=JSON.stringify(o);
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
