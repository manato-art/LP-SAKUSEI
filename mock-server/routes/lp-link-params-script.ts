/**
 * 配信LP（`/lp/:uid`）のリンクに、SquadBeyond 本体と同じパラメーターを付けるスクリプト（2026-09-11 本体の配信HTMLで確認）。
 *
 * 本体の assignParameterToLink と同じ動き:
 *   - 本文の http リンク全部に、LP を開いたときのパラメーター（sbrd / sb_tu_id / step_uid を除く）を足す
 *   - squadbeyond_uid＝訪問者ID（Cookie _sb_tu）、sb_article_uid＝記事uid を付け直す（値が無ければ名前だけ）
 *   - 中間ページ（/redirect_pages/）へのリンクには article_url（LPのURL＋開いたときのパラメーター）を付け直す。
 *     中間ページはこれを、リファラー設定「Version」の書き換え先に使う（redirect-page-html.ts）
 *   - リンクを押したとき、LPのURLに sb_article_uid と sb_tu_id を付けて書き換える
 * 名前だけ（= なし）を作れるよう、クエリは自前で組み立てる（URLSearchParams だと必ず = が付く）。
 */
export function buildLpLinkParamsScript(articleUid: string): string {
  const uid = JSON.stringify(articleUid).replace(/</g, '\\u003c')
  return `<script>(function(){
var ARTICLE_UID=${uid};
function cookie(name){var m=document.cookie.match(new RegExp('(^| )'+name+'=([^;]+)'));return m?m[2]:null;}
function pairsOf(params){var out=[];params.forEach(function(value,key){out.push([key,value]);});return out;}
function without(pairs,key){return pairs.filter(function(p){return p[0]!==key;});}
function withQuery(url,pairs){var q=pairs.map(function(p){return encodeURIComponent(p[0])+(p[1]===null?'':'='+encodeURIComponent(p[1]));}).join('&');return url.origin+url.pathname+(q===''?'':'?'+q)+url.hash;}
var visitorId=cookie('_sb_tu');
var current=new URL(location.href);
['sbrd','sb_tu_id','step_uid'].forEach(function(key){current.searchParams.delete(key);});
var lpPairs=pairsOf(current.searchParams);
var articleUrl=location.origin+location.pathname+location.search;
Array.prototype.forEach.call(document.body.querySelectorAll('a[href^="http"]'),function(link){
if(link.href.indexOf('tel:')!==-1)return;
var url=new URL(link.href);
var pairs=without(pairsOf(url.searchParams).concat(lpPairs),'squadbeyond_uid');
pairs.push(['squadbeyond_uid',visitorId]);
pairs=without(pairs,'sb_article_uid');
pairs.push(['sb_article_uid',ARTICLE_UID]);
if(/\\/redirect_pages\\//.test(url.pathname)){pairs=without(pairs,'article_url');pairs.push(['article_url',articleUrl]);}
link.href=withQuery(url,pairs);
link.addEventListener('click',function(){
var lp=without(lpPairs,'sb_article_uid');lp.push(['sb_article_uid',ARTICLE_UID]);
lp=without(lp,'sb_tu_id');lp.push(['sb_tu_id',visitorId]);
history.replaceState(null,'',withQuery(new URL(location.href),lp));
});
});
})()</script>`
}
