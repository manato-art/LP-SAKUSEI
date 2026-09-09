/**
 * ポップアップのプリセットに埋め込む小さなJS（exit-popup-presets.ts から分離）。
 *
 * カウントダウン・紙吹雪・クーポンのコピー・ルーレットなど、
 * プリセットHTMLと一緒に配信ページへ出る動きの部分。
 */

/** カウントダウンタイマーJS（.cd-num 要素を毎秒更新） */
export const COUNTDOWN_JS = `
overlay.addEventListener('ep-show',function(){
  var nums=overlay.querySelectorAll('.cd-num');
  if(nums.length<3)return;
  var h=parseInt(nums[0].textContent)||0;
  var m=parseInt(nums[1].textContent)||0;
  var s=parseInt(nums[2].textContent)||0;
  var total=h*3600+m*60+s;
  var iv=setInterval(function(){
    if(total<=0){clearInterval(iv);return}
    total--;
    nums[0].textContent=String(Math.floor(total/3600)).padStart(2,'0');
    nums[1].textContent=String(Math.floor((total%3600)/60)).padStart(2,'0');
    nums[2].textContent=String(total%60).padStart(2,'0');
  },1000);
});`
/** 紙吹雪エフェクトJS（.ep-content 内に40個のパーティクルを生成） */
export const CONFETTI_JS = `
overlay.addEventListener('ep-show',function(){
  var content=overlay.querySelector('.ep-content');
  if(!content)return;
  var colors=['#FF6B35','var(--sb-accent, #0091FF)','#2FA84F','#FFD700','#E040FB','#FF4081'];
  for(var i=0;i<40;i++){
    var p=document.createElement('div');
    var sz=4+Math.random()*8;
    p.style.cssText='position:absolute;top:-10px;width:'+sz+'px;height:'+sz+'px;background:'+colors[i%colors.length]+';left:'+(Math.random()*100)+'%;animation:epConfettiFall '+(2+Math.random()*2)+'s ease-in '+(Math.random()*1.2)+'s forwards;pointer-events:none;z-index:0;border-radius:'+(Math.random()>.5?'50%':'2px')+';';
    content.appendChild(p);
  }
});`
/** クーポンコピーJS（.ep-copy-btn クリックで .ep-coupon-code をコピー＋フィードバック） */
export const COUPON_COPY_JS = `
overlay.addEventListener('ep-show',function(){
  var btn=overlay.querySelector('.ep-copy-btn');
  if(!btn)return;
  btn.addEventListener('click',function(){
    var code=overlay.querySelector('.ep-coupon-code');
    if(code)navigator.clipboard.writeText(code.textContent.trim());
    btn.textContent='\\u2713 \\u30B3\\u30D4\\u30FC\\u3057\\u307E\\u3057\\u305F';
    btn.style.background='#2FA84F';
    setTimeout(function(){btn.textContent='\\u30B3\\u30D4\\u30FC\\u3059\\u308B';btn.style.background='var(--sb-accent, #0091FF)'},2000);
  });
});`
/** ルーレットJS（.ep-roulette-wheel を回転→結果表示） */
export const ROULETTE_JS = `
overlay.addEventListener('ep-show',function(){
  var wheel=overlay.querySelector('.ep-roulette-wheel');
  var btn=overlay.querySelector('.ep-roulette-btn');
  var result=overlay.querySelector('.ep-roulette-result');
  if(!btn||!wheel)return;
  btn.addEventListener('click',function(){
    btn.disabled=true;
    btn.style.opacity='.5';
    var deg=720+Math.random()*1080;
    wheel.style.transition='transform 3s cubic-bezier(0.17,0.67,0.12,0.99)';
    wheel.style.transform='rotate('+deg+'deg)';
    setTimeout(function(){
      if(result){result.style.display='block';result.style.animation='epBounceIn .5s ease'}
    },3200);
  });
});`
/** タブ切替JS（.ep-tab-btn クリックで .ep-tab-panel 表示切替） */
export const TAB_SWITCH_JS = `
overlay.addEventListener('ep-show',function(){
  var tabs=overlay.querySelectorAll('.ep-tab-btn');
  var panels=overlay.querySelectorAll('.ep-tab-panel');
  tabs.forEach(function(tab,i){
    tab.addEventListener('click',function(){
      tabs.forEach(function(t){t.style.background='#f5f5f5';t.style.color='#888'});
      tab.style.background='var(--sb-accent, #0091FF)';tab.style.color='#fff';
      panels.forEach(function(p){p.style.display='none'});
      if(panels[i])panels[i].style.display='block';
    });
  });
});`
/** CTA パルスJS（.ep-cta ボタンにパルスアニメ付与） */
export const CTA_PULSE_JS = `
overlay.addEventListener('ep-show',function(){
  var cta=overlay.querySelector('.ep-cta');
  if(cta)cta.style.animation='epPulse 2s ease-in-out infinite';
});`
/** 画像切替JS（.ep-switch-img を一定間隔でクロスフェード） */
export const IMAGE_SWITCH_JS = `
overlay.addEventListener('ep-show',function(){
  var imgs=overlay.querySelectorAll('.ep-switch-img');
  if(imgs.length<2)return;
  var i=0;
  imgs.forEach(function(im,idx){im.style.transition='opacity .5s';im.style.opacity=idx===0?'1':'0';});
  setInterval(function(){
    imgs[i].style.opacity='0';
    i=(i+1)%imgs.length;
    imgs[i].style.opacity='1';
  },1600);
});`
/** 閉じるボタンJS（.ep-close クリックでポップアップを閉じる＝Widgetクローズ相当） */
export const CLOSE_BTN_JS = `
overlay.addEventListener('ep-show',function(){
  overlay.querySelectorAll('.ep-close').forEach(function(b){
    b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();overlay.remove();});
  });
});`
