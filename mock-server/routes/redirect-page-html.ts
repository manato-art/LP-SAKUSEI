/**
 * 中間ページ（`/redirect_pages/:uid`）の応答HTML（純粋関数）。
 *
 * SquadBeyond 本体の中間ページ（2026-09-11 に本人の画面でテスト用を作って確かめた）と同じ作りにする:
 *   - 本文に `.js-redirect-url`（リダイレクト先）と `.js-referrer-type`（リファラー設定）を data-value で置き、
 *     「自動でジャンプしない場合は…」の案内と `.js-redirect-url-link` を出す
 *   - スクリプトが、開いたURLのパラメーターを article_url / sbrp / sbrpuid を除いてリダイレクト先へ引き継ぎ、
 *     リダイレクト時間待ってから移動する（待つのはタグが送信を終えるため）
 *   - リファラー設定: Version なら article_url（LPのURL・同じドメイン）へ、中間ページなら中間ページのURL
 *     （パラメーターを外す）へ URL を書き換えてから移動する。どちらも squadbeyond_uid / sb_article_uid を付ける
 *     （値が無いときは名前だけ）。article_url が無い・別ドメインのときは書き換えない
 * Referrer-Policy（no-referrer-when-downgrade）はレスポンスヘッダーで付ける（routes/redirect-page-delivery.ts）。
 */
import { escapeHtml } from './delivery-notice.ts'

export type RedirectReferrerType = 'version' | 'redirect_page'

export interface RedirectPageHtmlInput {
  /** 移動先（検証済みの http / https の絶対URL） */
  readonly destination: string
  /** 移動するまでの秒数 */
  readonly redirectSeconds: number
  readonly referrerType: RedirectReferrerType
  readonly headTags: string
  readonly bodyTags: string
  readonly noindex: boolean
}

/** 移動のスクリプト（ブラウザで動く。値は本文の data-value から読むので、ここへ文字列を埋め込まない） */
function redirectScript(waitMs: number): string {
  return `(function(){
var params=new URLSearchParams(location.search);
var articleUrl=params.get('article_url');
params.delete('article_url');params.delete('sbrp');params.delete('sbrpuid');
var destination=new URL(document.querySelector('.js-redirect-url').dataset.value);
params.forEach(function(value,key){destination.searchParams.append(key,value);});
var to=destination.toString();
Array.prototype.forEach.call(document.querySelectorAll('.js-redirect-url-link'),function(link){link.href=to;});
function withIds(base){
var uid=params.get('squadbeyond_uid');var articleUid=params.get('sb_article_uid');
return base+(base.indexOf('?')===-1?'?':'&')+'squadbeyond_uid'+(uid===null?'':'='+encodeURIComponent(uid))+'&sb_article_uid'+(articleUid===null?'':'='+encodeURIComponent(articleUid));
}
function sameSite(raw){
if(raw===null)return null;
try{var url=new URL(raw);return url.origin===location.origin?url:null;}catch(e){return null;}
}
setTimeout(function(){
var type=document.querySelector('.js-referrer-type').dataset.value;
if(type==='version'){var article=sameSite(articleUrl);if(article!==null)history.replaceState(null,'',withIds(article.href));}
else if(type==='redirect_page'){history.replaceState(null,'',withIds(location.origin+location.pathname));}
location.replace(to);
},${waitMs});
})();`
}

export function buildRedirectPageHtml(input: RedirectPageHtmlInput): string {
  const robots = input.noindex ? 'noindex,nofollow,noarchive' : 'nofollow,noarchive'
  return (
    '<!DOCTYPE html><html><head><link href="data:," rel="icon" /><meta charset="utf-8" />' +
    `<meta content="${robots}" name="robots" />` +
    '<meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" name="viewport" />' +
    input.headTags +
    '</head><body>' +
    `<div class="js-redirect-url" data-value="${escapeHtml(input.destination)}"></div>` +
    `<div class="js-referrer-type" data-value="${input.referrerType}"></div>` +
    input.bodyTags +
    '<div>自動でジャンプしない場合は、下記のＵＲＬをクリックしてください。</div>\n' +
    '<a class="js-redirect-url-link">URL</a>\n' +
    `<script>${redirectScript(Math.round(input.redirectSeconds * 1000))}</script>` +
    '</body></html>'
  )
}
