/**
 * 配信LP（`/lp/:uid`）の中間ページリンクに、SquadBeyond 本体と同じパラメーターを付けるスクリプト。
 *
 * 本体の配信LP（2026-09-11 に配信HTMLで確認・assignParameterToLink）は、本文の http リンクに
 * LP を開いたときのパラメーター（sbrd / sb_tu_id / step_uid を除く）を足し、中間ページへのリンク（/redirect_pages/）には
 * article_url（LPのURL＋開いたときのパラメーター）を付け直す。中間ページはこの article_url を、
 * リファラー設定「Version」の書き換え先に使う（redirect-page-html.ts）。
 * このクローンでは中間ページへのリンクだけに付ける（本体はほかのリンクにも足すが、そちらは未対応）。
 */
export const REDIRECT_LINK_SCRIPT = `<script>(function(){
var current=new URL(location.href);
['sbrd','sb_tu_id','step_uid'].forEach(function(key){current.searchParams.delete(key);});
var articleUrl=location.origin+location.pathname+location.search;
Array.prototype.forEach.call(document.querySelectorAll('a[href*="/redirect_pages/"]'),function(link){
var url=new URL(link.href);
current.searchParams.forEach(function(value,key){url.searchParams.append(key,value);});
url.searchParams.delete('article_url');
url.searchParams.append('article_url',articleUrl);
link.href=url.toString();
});
})()</script>`
