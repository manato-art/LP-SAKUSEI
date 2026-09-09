/**
 * 配信ページに埋め込むポップアップのHTML（delivery.ts から分離）。
 *
 * 離脱防止ポップアップ（オーバーレイ）と追尾型ポップアップ（画面端に固定）の
 * それぞれについて、CSS・マークアップ・起動用スクリプトを1つの断片にまとめる。
 */

import type { ExitPopup, FollowPopup } from '../store/types.ts'
/**
 * 離脱防止ポップアップのHTMLスニペットを構築する（指示80）。
 * デバイスフィルタを適用し、マッチしないポップアップは出さない。
 * 離脱防止トリガー: ページ離脱（mouseout / visibilitychange）で表示。
 */
export function buildPopupSnippet(popup: ExitPopup, device: 'sp' | 'tablet' | 'pc'): string {
  // デバイスフィルタ
  if (device === 'sp' && !popup.device_sp) return ''
  if (device === 'tablet' && !popup.device_tablet) return ''
  if (device === 'pc' && !popup.device_pc) return ''

  const popupId = `exit-popup-${popup.uid}`
  const animClass = popup.animation !== 'none' ? popup.animation : ''

  // リンク設定（キャンバス画像と同じ規約）: 遷移先 link_url / 新タブ link_target / 計測URL tracking_urls。
  // 旧データはこれらを持たない場合があるので既定値で守る。
  const epLink = popup.link_url ?? ''
  const epTarget = popup.link_target === '_self' ? '_self' : '_blank'
  const epPins = Array.isArray(popup.tracking_urls) ? popup.tracking_urls : []

  // アニメーションCSS（エントランス9種 + 内部アニメ用キーフレーム）
  const animCss = `
    @keyframes epFadeIn { from{opacity:0} to{opacity:1} }
    @keyframes epSlideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
    @keyframes epSlideDown { from{opacity:0;transform:translateY(-30px)} to{opacity:1;transform:translateY(0)} }
    @keyframes epSlideLeft { from{opacity:0;transform:translateX(-50px)} to{opacity:1;transform:translateX(0)} }
    @keyframes epSlideRight { from{opacity:0;transform:translateX(50px)} to{opacity:1;transform:translateX(0)} }
    @keyframes epZoomIn { from{opacity:0;transform:scale(.8)} to{opacity:1;transform:scale(1)} }
    @keyframes epBounceIn { 0%{opacity:0;transform:scale(.3)} 50%{opacity:1;transform:scale(1.05)} 70%{transform:scale(.95)} 100%{opacity:1;transform:scale(1)} }
    @keyframes epElastic { 0%{opacity:0;transform:scale(.5)} 55%{opacity:1;transform:scale(1.12)} 75%{transform:scale(.96)} 100%{opacity:1;transform:scale(1)} }
    @keyframes epFlipIn { 0%{opacity:0;transform:perspective(400px) rotateX(90deg)} 40%{transform:perspective(400px) rotateX(-10deg)} 70%{transform:perspective(400px) rotateX(10deg)} 100%{opacity:1;transform:perspective(400px) rotateX(0)} }
    @keyframes epConfettiFall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(400px) rotate(720deg);opacity:0} }
    @keyframes epPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
    .ep-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:99999; display:none; align-items:center; justify-content:center; }
    .ep-overlay.visible { display:flex; }
    .ep-content { max-width:min(500px,92vw); width:fit-content; max-height:80vh; overflow:auto; position:relative; scrollbar-width:none; -ms-overflow-style:none; }
    .ep-content::-webkit-scrollbar { width:0; height:0; display:none; }
    .ep-content.fade { animation:epFadeIn .3s ease }
    .ep-content.slideUp { animation:epSlideUp .4s ease }
    .ep-content.slideDown { animation:epSlideDown .4s ease }
    .ep-content.slideLeft { animation:epSlideLeft .4s ease }
    .ep-content.slideRight { animation:epSlideRight .4s ease }
    .ep-content.zoomIn { animation:epZoomIn .3s ease }
    .ep-content.bounceIn { animation:epBounceIn .6s ease }
    .ep-content.elastic { animation:epElastic .8s ease }
    .ep-content.flipIn { animation:epFlipIn .6s ease }
    .ep-close { position:absolute; top:8px; right:8px; width:28px; height:28px; border-radius:50%; background:#fff; border:1px solid #ddd; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 4px rgba(0,0,0,.15); z-index:2; }
  `

  // 種別（指示176）とクリック動作（指示172）
  const popupKind = popup.popup_kind === 'instant' ? 'instant' : 'exit'
  const linkAction = popup.link_action === 'close' ? 'close' : 'link'

  // 統合IIFE: 内部アニメJS(popup.javascript) + トリガーJS を1つのスコープにまとめ、
  // overlay / epId をスコープ変数として共有。'ep-show' カスタムイベントで内部アニメを起動。
  const scriptBody = `(function(){
    var epId='${popupId}';
    var overlay=document.getElementById(epId);
    if(!overlay)return;
    var shown=false;
    var delay=${popup.delay_seconds * 1000};
    var scrollTrigger=${popup.scroll_trigger};
    var scrollPos=${popup.scroll_position};
    var kind=${JSON.stringify(popupKind)};
    var exitTrig=${popup.exit_trigger !== false};
    var backTrig=${popup.back_button_trigger === true};
    var cdTrig=${popup.countdown_trigger === true};
    var cdSec=${popup.countdown_seconds || 0};
    var linkAction=${JSON.stringify(linkAction)};

    function showPopup(){
      if(shown)return;
      // 指示160: 離脱防止ポップは同時に1つだけ表示する（複数有効時に重なって×が2個出るのを防ぐ）。
      if(document.querySelector('.ep-overlay.visible'))return;
      shown=true;
      overlay.classList.add('visible');
      try{overlay.dispatchEvent(new CustomEvent('ep-show'))}catch(e){}
    }
    function closePopup(){ overlay.classList.remove('visible'); }

    // ── 内部アニメーションJS（プリセットが設定）──
    ${popup.javascript}

    if(kind==='instant'){
      // ── 指示176: 表示直後 — LPを開いた直後（delay後・既定0）にオーバーレイ表示 ──
      setTimeout(showPopup, delay);
    } else {
      // ── 指示175: 離脱防止 — 開いた直後には出さず「離脱意図」でのみ出す ──
      // （旧: mouseout全辺 + visibilitychange が読み込み直後に誤発火していた。両方やめる）
      var armed=false;
      setTimeout(function(){ armed=true; }, delay); // 読み込み直後の誤発火を防ぐ猶予
      // PC: カーソルが画面「上端」の外へ出た（＝タブ/URLバー方向へ抜けた）とき。exit_trigger時。
      if(exitTrig){
        document.addEventListener('mouseout',function(e){
          if(!armed)return;
          if(e.clientY<=0 && !e.relatedTarget)showPopup();
        });
      }
      // 戻る操作（ブラウザ戻る/スマホの戻るジェスチャ）で発動。exit_trigger または back_button_trigger時。
      if(exitTrig||backTrig){
        var trapped=false;
        try{history.pushState({epTrap:1},'')}catch(e){}
        window.addEventListener('popstate',function(){
          if(trapped)return;            // 2回目の戻るは通す（離脱を許可）
          trapped=true;
          showPopup();
          try{history.pushState({epTrap:1},'')}catch(e){} // 戻るを1回だけ捕まえてポップ表示
        });
      }
      // カウントダウンで表示
      if(cdTrig&&cdSec>0)setTimeout(showPopup, cdSec*1000);
      // スクロールで表示
      if(scrollTrigger){
        window.addEventListener('scroll',function(){
          var pct=(window.scrollY/(document.body.scrollHeight-window.innerHeight))*100;
          if(pct>=scrollPos)showPopup();
        });
      }
    }

    // ── クリック時の動作（指示172）──
    var epLink=${JSON.stringify(epLink)};
    var epTarget=${JSON.stringify(epTarget)};
    var epPins=${JSON.stringify(epPins)};
    var content=overlay.querySelector('.ep-content');
    if(linkAction!=='close'&&epLink&&content)content.style.cursor='pointer';

    overlay.addEventListener('click',function(e){
      var t=e.target;
      // 背景 or ×ボタン → 閉じる
      if(t===overlay||(t.classList&&t.classList.contains('ep-close'))){closePopup();return;}
      // 指示172: 動作=LPに戻る → 中身タップでも閉じて、元のLPの見ていた位置へ戻る（×と同じ）
      if(linkAction==='close'){closePopup();return;}
      if(!epLink)return;
      // 中身が本物のリンク/ボタン（href が # や javascript: 以外）ならそれを生かす
      var inner=t.closest&&t.closest('a[href]');
      if(inner){var h=inner.getAttribute('href')||'';if(h&&h!=='#'&&!/^javascript:/i.test(h))return;}
      if(t.closest&&t.closest('button'))return;
      // ポップアップ本体クリック → 遷移先へ
      e.preventDefault();
      // 計測URL（ピクセル）発火
      epPins.forEach(function(u){try{navigator.sendBeacon(u)}catch(err){new Image().src=u}});
      // レポート計測(sb_tracking)も拾えるよう、実 <a> クリックで遷移する（画像リンクと同じ経路）
      var a=document.createElement('a');a.href=epLink;a.target=epTarget;
      if(epTarget==='_blank')a.rel='noopener noreferrer';
      document.body.appendChild(a);a.click();a.remove();
    });
  })()`

  return `<style>${animCss}</style>` +
    `<div id="${popupId}" class="ep-overlay">` +
    `<div class="ep-content ${animClass}">` +
    `<button class="ep-close">✕</button>` +
    popup.html +
    `</div></div>` +
    (popup.head_tag !== '' ? popup.head_tag : '') +
    (popup.body_tag !== '' ? popup.body_tag : '') +
    `<script>${scriptBody}</script>`
}
/**
 * 追尾型ポップアップのHTMLスニペットを構築する（指示85）。
 * スクロール追従バナー: 画面の上端/下端/角に固定表示される。
 * オーバーレイ無し、ページ閲覧を妨げない控えめな表示。
 */
export function buildFollowPopupSnippet(fp: FollowPopup, device: 'sp' | 'tablet' | 'pc'): string {
  if (device === 'sp' && !fp.device_sp) return ''
  if (device === 'tablet' && !fp.device_tablet) return ''
  if (device === 'pc' && !fp.device_pc) return ''

  const fpId = `follow-popup-${fp.uid}`

  // 位置に応じたCSS
  const positionStyles: Record<string, string> = {
    top: 'top:0;left:0;right:0',
    bottom: 'bottom:0;left:0;right:0',
    'bottom-right': 'bottom:16px;right:16px',
    'bottom-left': 'bottom:16px;left:16px',
  }
  const posStyle = positionStyles[fp.position] ?? positionStyles.bottom

  // アニメーション
  const animMap: Record<string, string> = {
    slideUp: 'fpSlideUp .4s ease',
    slideDown: 'fpSlideDown .4s ease',
    fade: 'fpFadeIn .3s ease',
  }
  const animValue = animMap[fp.animation] ?? ''

  const css = `
    @keyframes fpSlideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fpSlideDown { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fpFadeIn { from{opacity:0} to{opacity:1} }
    #${fpId} { position:fixed;${posStyle};z-index:99990;display:none;${animValue !== '' ? `animation:${animValue};` : ''} }
    #${fpId}.fp-visible { display:block; }
    #${fpId} .fp-close { position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;border:none;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;z-index:1; }
    ${fp.css}
  `

  const showAfterScroll = fp.show_after_scroll
  const scriptBody = `(function(){
    var el=document.getElementById('${fpId}');if(!el)return;
    var scrollThreshold=${showAfterScroll};
    function show(){el.classList.add('fp-visible')}
    ${showAfterScroll > 0
      ? `window.addEventListener('scroll',function(){
          var pct=(window.scrollY/(document.body.scrollHeight-window.innerHeight))*100;
          if(pct>=scrollThreshold)show();
        });`
      : `show();`
    }
    el.querySelector('.fp-close')?.addEventListener('click',function(){el.remove()});
    ${fp.javascript}
  })()`

  const closeButton = fp.show_close_button
    ? `<button class="fp-close">✕</button>`
    : ''

  return `<style>${css}</style>` +
    `<div id="${fpId}">` +
    closeButton +
    fp.html +
    `</div>` +
    `<script>${scriptBody}</script>`
}
