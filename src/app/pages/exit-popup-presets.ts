/**
 * 離脱防止ポップアップのプリセット一覧（指示80・アニメーション拡充）。
 *
 * 実物SquadBeyondで確認した12種のプリセットを再現する。
 * サムネイルはインラインSVGで描く（外部画像は使わない）。
 *
 * 各プリセットは defaultJavascript を持ち、delivery.ts / preview-page.ts の
 * 統合IIFEスコープ内で実行される。スコープ変数:
 *   - overlay: ポップアップオーバーレイ要素
 *   - epId: ポップアップのDOM ID
 * 内部アニメは 'ep-show' カスタムイベントで起動する。
 */

export interface PopupPreset {
  id: string
  name: string
  /** プリセット説明テキスト */
  description: string
  /** SVGサムネイル（インライン） */
  thumbnailSvg: string
  /** プリセットの既定HTML */
  defaultHtml: string
  /** プリセットの既定JavaScript（delivery.tsのIIFE内で実行される） */
  defaultJavascript: string
  /** 既定の表示設定 */
  defaults: {
    animation?: string
    scroll_trigger?: boolean
    scroll_position?: number
    countdown_trigger?: boolean
    countdown_seconds?: number
  }
}

/** 共通カラー */
const C = {
  bg: '#F5F5F5',
  accent: '#FF6B35',
  accentDark: '#E5532A',
  blue: '#0091FF',
  green: '#2FA84F',
  white: '#FFFFFF',
  text: '#333333',
  sub: '#888888',
  border: '#DDDDDD',
} as const

function thumbSvg(content: string): string {
  return `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
    <rect width="200" height="140" rx="6" fill="${C.bg}" stroke="${C.border}" stroke-width="1"/>
    ${content}
  </svg>`
}

// ── 共通の内部アニメーションJS ──────────────────────────

/** カウントダウンタイマーJS（.cd-num 要素を毎秒更新） */
const COUNTDOWN_JS = `
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
const CONFETTI_JS = `
overlay.addEventListener('ep-show',function(){
  var content=overlay.querySelector('.ep-content');
  if(!content)return;
  var colors=['#FF6B35','#0091FF','#2FA84F','#FFD700','#E040FB','#FF4081'];
  for(var i=0;i<40;i++){
    var p=document.createElement('div');
    var sz=4+Math.random()*8;
    p.style.cssText='position:absolute;top:-10px;width:'+sz+'px;height:'+sz+'px;background:'+colors[i%colors.length]+';left:'+(Math.random()*100)+'%;animation:epConfettiFall '+(2+Math.random()*2)+'s ease-in '+(Math.random()*1.2)+'s forwards;pointer-events:none;z-index:0;border-radius:'+(Math.random()>.5?'50%':'2px')+';';
    content.appendChild(p);
  }
});`

/** クーポンコピーJS（.ep-copy-btn クリックで .ep-coupon-code をコピー＋フィードバック） */
const COUPON_COPY_JS = `
overlay.addEventListener('ep-show',function(){
  var btn=overlay.querySelector('.ep-copy-btn');
  if(!btn)return;
  btn.addEventListener('click',function(){
    var code=overlay.querySelector('.ep-coupon-code');
    if(code)navigator.clipboard.writeText(code.textContent.trim());
    btn.textContent='\\u2713 \\u30B3\\u30D4\\u30FC\\u3057\\u307E\\u3057\\u305F';
    btn.style.background='#2FA84F';
    setTimeout(function(){btn.textContent='\\u30B3\\u30D4\\u30FC\\u3059\\u308B';btn.style.background='#0091FF'},2000);
  });
});`

/** ルーレットJS（.ep-roulette-wheel を回転→結果表示） */
const ROULETTE_JS = `
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
const TAB_SWITCH_JS = `
overlay.addEventListener('ep-show',function(){
  var tabs=overlay.querySelectorAll('.ep-tab-btn');
  var panels=overlay.querySelectorAll('.ep-tab-panel');
  tabs.forEach(function(tab,i){
    tab.addEventListener('click',function(){
      tabs.forEach(function(t){t.style.background='#f5f5f5';t.style.color='#888'});
      tab.style.background='#0091FF';tab.style.color='#fff';
      panels.forEach(function(p){p.style.display='none'});
      if(panels[i])panels[i].style.display='block';
    });
  });
});`

/** CTA パルスJS（.ep-cta ボタンにパルスアニメ付与） */
const CTA_PULSE_JS = `
overlay.addEventListener('ep-show',function(){
  var cta=overlay.querySelector('.ep-cta');
  if(cta)cta.style.animation='epPulse 2s ease-in-out infinite';
});`

export const PRESETS: readonly PopupPreset[] = [
  // ─── 1. カウントダウン付きバナー ───
  {
    id: 'countdown-banner',
    name: 'カウントダウン付きバナー',
    description: 'スクロール位置 / 出現アニメーション / カウントダウン',
    thumbnailSvg: thumbSvg(`
      <rect x="20" y="30" width="160" height="80" rx="4" fill="${C.white}" stroke="${C.border}"/>
      <rect x="30" y="40" width="80" height="12" rx="2" fill="${C.accent}"/>
      <text x="35" y="49" font-size="7" fill="${C.white}" font-family="sans-serif">限定セール</text>
      <rect x="30" y="60" width="140" height="8" rx="2" fill="#EEE"/>
      <text x="35" y="67" font-size="6" fill="${C.sub}" font-family="sans-serif">本日の受付終了まで</text>
      <rect x="30" y="76" width="30" height="24" rx="3" fill="${C.accent}"/>
      <text x="38" y="92" font-size="12" fill="${C.white}" font-family="sans-serif" font-weight="bold">05</text>
      <rect x="65" y="76" width="8" height="24" rx="1" fill="none"/>
      <text x="67" y="92" font-size="12" fill="${C.text}" font-family="sans-serif">:</text>
      <rect x="78" y="76" width="30" height="24" rx="3" fill="${C.accent}"/>
      <text x="86" y="92" font-size="12" fill="${C.white}" font-family="sans-serif" font-weight="bold">30</text>
      <text x="113" y="92" font-size="12" fill="${C.text}" font-family="sans-serif">:</text>
      <rect x="123" y="76" width="30" height="24" rx="3" fill="${C.accent}"/>
      <text x="131" y="92" font-size="12" fill="${C.white}" font-family="sans-serif" font-weight="bold">00</text>
    `),
    defaultHtml: `<div style="background:#fff;border-radius:8px;padding:16px;box-shadow:0 4px 24px rgba(0,0,0,.15);max-width:360px;margin:auto;text-align:center">
  <div style="background:#FF6B35;color:#fff;padding:8px 12px;border-radius:4px;font-weight:bold;margin-bottom:12px">限定セール実施中</div>
  <p style="color:#333;font-size:13px;margin:0 0 12px">本日の受付終了まで</p>
  <div style="display:flex;justify-content:center;gap:4px;font-size:24px;font-weight:bold">
    <span class="cd-num" style="background:#FF6B35;color:#fff;padding:6px 10px;border-radius:4px">00</span>
    <span style="line-height:40px">:</span>
    <span class="cd-num" style="background:#FF6B35;color:#fff;padding:6px 10px;border-radius:4px">05</span>
    <span style="line-height:40px">:</span>
    <span class="cd-num" style="background:#FF6B35;color:#fff;padding:6px 10px;border-radius:4px">00</span>
  </div>
  <a class="ep-cta" href="#" style="display:inline-block;margin-top:16px;background:#FF6B35;color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:bold">今すぐ購入</a>
</div>`,
    defaultJavascript: COUNTDOWN_JS + CTA_PULSE_JS,
    defaults: { animation: 'slideUp', scroll_trigger: true, scroll_position: 30 },
  },

  // ─── 2. クーポンコード（コピー機能付き） ───
  {
    id: 'coupon-copy',
    name: 'クーポンコード（コピー機能付き）',
    description: '出現アニメーション / コピー機能',
    thumbnailSvg: thumbSvg(`
      <rect x="30" y="25" width="140" height="90" rx="6" fill="${C.white}" stroke="${C.border}"/>
      <text x="100" y="50" text-anchor="middle" font-size="8" fill="${C.text}" font-family="sans-serif" font-weight="bold">特別クーポン</text>
      <rect x="50" y="60" width="100" height="20" rx="3" fill="#FFF3E0" stroke="${C.accent}" stroke-dasharray="4,2"/>
      <text x="100" y="74" text-anchor="middle" font-size="10" fill="${C.accent}" font-family="monospace" font-weight="bold">SAVE20</text>
      <rect x="60" y="88" width="80" height="18" rx="3" fill="${C.blue}"/>
      <text x="100" y="100" text-anchor="middle" font-size="7" fill="${C.white}" font-family="sans-serif">コピーする</text>
    `),
    defaultHtml: `<div style="background:#fff;border-radius:8px;padding:20px;box-shadow:0 4px 24px rgba(0,0,0,.15);max-width:320px;margin:auto;text-align:center">
  <p style="font-weight:bold;font-size:16px;margin:0 0 8px;color:#333">特別クーポン</p>
  <p style="color:#888;font-size:12px;margin:0 0 16px">今だけ使える限定コード</p>
  <div style="background:#FFF3E0;border:2px dashed #FF6B35;padding:12px;border-radius:6px;margin-bottom:16px">
    <span class="ep-coupon-code" style="font-family:monospace;font-size:20px;font-weight:bold;color:#FF6B35;letter-spacing:2px">SAVE20</span>
  </div>
  <button class="ep-copy-btn" style="background:#0091FF;color:#fff;border:none;padding:10px 24px;border-radius:4px;cursor:pointer;font-weight:bold">コピーする</button>
</div>`,
    defaultJavascript: COUPON_COPY_JS,
    defaults: { animation: 'bounceIn' },
  },

  // ─── 3. カウントダウン（毎日指定時間まで） ───
  {
    id: 'countdown-daily',
    name: 'カウントダウン（毎日指定時間まで）',
    description: 'スクロール位置 / 出現アニメーション / 毎日リセット',
    thumbnailSvg: thumbSvg(`
      <rect x="30" y="25" width="140" height="90" rx="6" fill="${C.white}" stroke="${C.border}"/>
      <text x="100" y="48" text-anchor="middle" font-size="7" fill="${C.sub}" font-family="sans-serif">本日限定</text>
      <rect x="45" y="55" width="28" height="28" rx="4" fill="${C.accentDark}"/>
      <text x="59" y="74" text-anchor="middle" font-size="14" fill="${C.white}" font-family="sans-serif" font-weight="bold">03</text>
      <text x="78" y="74" font-size="14" fill="${C.text}" font-family="sans-serif">:</text>
      <rect x="85" y="55" width="28" height="28" rx="4" fill="${C.accentDark}"/>
      <text x="99" y="74" text-anchor="middle" font-size="14" fill="${C.white}" font-family="sans-serif" font-weight="bold">45</text>
      <text x="118" y="74" font-size="14" fill="${C.text}" font-family="sans-serif">:</text>
      <rect x="125" y="55" width="28" height="28" rx="4" fill="${C.accentDark}"/>
      <text x="139" y="74" text-anchor="middle" font-size="14" fill="${C.white}" font-family="sans-serif" font-weight="bold">12</text>
      <text x="100" y="100" text-anchor="middle" font-size="6" fill="${C.sub}" font-family="sans-serif">毎日23:59にリセット</text>
    `),
    defaultHtml: `<div style="background:#fff;border-radius:8px;padding:20px;box-shadow:0 4px 24px rgba(0,0,0,.15);max-width:360px;margin:auto;text-align:center">
  <p style="color:#888;font-size:12px;margin:0 0 12px">本日限定キャンペーン終了まで</p>
  <div style="display:flex;justify-content:center;gap:6px;font-size:28px;font-weight:bold">
    <span class="cd-num" style="background:#E5532A;color:#fff;padding:8px 12px;border-radius:6px">03</span>
    <span style="line-height:50px">:</span>
    <span class="cd-num" style="background:#E5532A;color:#fff;padding:8px 12px;border-radius:6px">45</span>
    <span style="line-height:50px">:</span>
    <span class="cd-num" style="background:#E5532A;color:#fff;padding:8px 12px;border-radius:6px">12</span>
  </div>
  <a class="ep-cta" href="#" style="display:inline-block;margin-top:16px;background:#E5532A;color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:bold">今すぐ確認</a>
</div>`,
    defaultJavascript: COUNTDOWN_JS + CTA_PULSE_JS,
    defaults: { animation: 'slideUp', countdown_trigger: true, countdown_seconds: 60 },
  },

  // ─── 4. カウントダウン（日付指定） ───
  {
    id: 'countdown-date',
    name: 'カウントダウン（日付指定）',
    description: '出現アニメーション / 日付指定',
    thumbnailSvg: thumbSvg(`
      <rect x="30" y="25" width="140" height="90" rx="6" fill="${C.white}" stroke="${C.border}"/>
      <text x="100" y="45" text-anchor="middle" font-size="7" fill="${C.text}" font-family="sans-serif" font-weight="bold">セール終了まで</text>
      <text x="52" y="72" font-size="18" fill="${C.accent}" font-family="sans-serif" font-weight="bold">2</text>
      <text x="62" y="72" font-size="8" fill="${C.sub}" font-family="sans-serif">日</text>
      <text x="80" y="72" font-size="18" fill="${C.accent}" font-family="sans-serif" font-weight="bold">14</text>
      <text x="98" y="72" font-size="8" fill="${C.sub}" font-family="sans-serif">時間</text>
      <text x="118" y="72" font-size="18" fill="${C.accent}" font-family="sans-serif" font-weight="bold">30</text>
      <text x="138" y="72" font-size="8" fill="${C.sub}" font-family="sans-serif">分</text>
      <rect x="50" y="82" width="100" height="16" rx="3" fill="${C.accent}"/>
      <text x="100" y="93" text-anchor="middle" font-size="7" fill="${C.white}" font-family="sans-serif">詳細はこちら</text>
    `),
    defaultHtml: `<div style="background:#fff;border-radius:8px;padding:20px;box-shadow:0 4px 24px rgba(0,0,0,.15);max-width:360px;margin:auto;text-align:center">
  <p style="font-weight:bold;font-size:15px;color:#333;margin:0 0 12px">セール終了まで</p>
  <div style="display:flex;justify-content:center;gap:12px;margin-bottom:16px">
    <div><span class="cd-num" style="font-size:28px;font-weight:bold;color:#FF6B35">02</span><span style="font-size:12px;color:#888">日</span></div>
    <div><span class="cd-num" style="font-size:28px;font-weight:bold;color:#FF6B35">14</span><span style="font-size:12px;color:#888">時間</span></div>
    <div><span class="cd-num" style="font-size:28px;font-weight:bold;color:#FF6B35">30</span><span style="font-size:12px;color:#888">分</span></div>
  </div>
  <a class="ep-cta" href="#" style="display:inline-block;background:#FF6B35;color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:bold">詳細はこちら</a>
</div>`,
    defaultJavascript: COUNTDOWN_JS + CTA_PULSE_JS,
    defaults: { animation: 'elastic', countdown_trigger: true, countdown_seconds: 120 },
  },

  // ─── 5. ルーレット後に結果表示 ───
  {
    id: 'roulette',
    name: 'ルーレット後に結果表示',
    description: '出現アニメーション / ゲーミフィケーション',
    thumbnailSvg: thumbSvg(`
      <circle cx="100" cy="65" r="40" fill="${C.white}" stroke="${C.accent}" stroke-width="2"/>
      <line x1="100" y1="25" x2="100" y2="65" stroke="${C.accent}" stroke-width="1.5"/>
      <line x1="100" y1="65" x2="130" y2="45" stroke="${C.blue}" stroke-width="1.5"/>
      <line x1="100" y1="65" x2="70" y2="85" stroke="${C.green}" stroke-width="1.5"/>
      <circle cx="100" cy="65" r="4" fill="${C.accent}"/>
      <text x="100" y="118" text-anchor="middle" font-size="7" fill="${C.text}" font-family="sans-serif" font-weight="bold">回してみよう!</text>
      <polygon points="100,22 96,16 104,16" fill="${C.accent}"/>
    `),
    defaultHtml: `<div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.15);max-width:320px;margin:auto;text-align:center">
  <p style="font-weight:bold;font-size:16px;color:#333;margin:0 0 16px">今日の運勢は?</p>
  <div style="position:relative;width:140px;height:140px;margin:0 auto 16px">
    <div class="ep-roulette-wheel" style="width:140px;height:140px;border-radius:50%;border:3px solid #FF6B35;display:flex;align-items:center;justify-content:center;font-size:48px;background:conic-gradient(#FF6B35 0deg 60deg,#0091FF 60deg 120deg,#2FA84F 120deg 180deg,#FFD700 180deg 240deg,#E040FB 240deg 300deg,#FF4081 300deg 360deg)">
      <span style="background:#fff;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:bold;color:#333">?</span>
    </div>
    <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);font-size:18px">&#9660;</div>
  </div>
  <button class="ep-roulette-btn" style="background:#FF6B35;color:#fff;border:none;padding:10px 24px;border-radius:4px;cursor:pointer;font-weight:bold;font-size:14px">回してみよう!</button>
  <div class="ep-roulette-result" style="display:none;margin-top:16px;padding:12px;background:#FFF3E0;border-radius:8px">
    <p style="font-weight:bold;font-size:18px;color:#FF6B35;margin:0 0 4px">大当たり!</p>
    <p style="font-size:13px;color:#333;margin:0">特別クーポン <b>LUCKY30</b> を獲得!</p>
  </div>
</div>`,
    defaultJavascript: ROULETTE_JS,
    defaults: { animation: 'elastic' },
  },

  // ─── 6. タブメニュー ───
  {
    id: 'tab-menu',
    name: 'タブメニュー',
    description: 'タブ切り替え型のポップアップ',
    thumbnailSvg: thumbSvg(`
      <rect x="20" y="25" width="160" height="90" rx="4" fill="${C.white}" stroke="${C.border}"/>
      <rect x="20" y="25" width="54" height="18" rx="0" fill="${C.blue}"/>
      <text x="47" y="37" text-anchor="middle" font-size="6" fill="${C.white}" font-family="sans-serif">タブ1</text>
      <rect x="74" y="25" width="53" height="18" rx="0" fill="#EEE"/>
      <text x="100" y="37" text-anchor="middle" font-size="6" fill="${C.sub}" font-family="sans-serif">タブ2</text>
      <rect x="127" y="25" width="53" height="18" rx="0" fill="#EEE"/>
      <text x="153" y="37" text-anchor="middle" font-size="6" fill="${C.sub}" font-family="sans-serif">タブ3</text>
      <rect x="30" y="52" width="140" height="6" rx="2" fill="#EEE"/>
      <rect x="30" y="64" width="120" height="6" rx="2" fill="#EEE"/>
      <rect x="30" y="76" width="100" height="6" rx="2" fill="#EEE"/>
      <rect x="50" y="92" width="100" height="16" rx="3" fill="${C.blue}"/>
      <text x="100" y="103" text-anchor="middle" font-size="7" fill="${C.white}" font-family="sans-serif">選択</text>
    `),
    defaultHtml: `<div style="background:#fff;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.15);max-width:400px;margin:auto;overflow:hidden">
  <div style="display:flex;border-bottom:1px solid #eee">
    <div class="ep-tab-btn" style="flex:1;padding:10px;text-align:center;background:#0091FF;color:#fff;font-weight:bold;font-size:13px;cursor:pointer">プラン1</div>
    <div class="ep-tab-btn" style="flex:1;padding:10px;text-align:center;background:#f5f5f5;color:#888;font-size:13px;cursor:pointer">プラン2</div>
    <div class="ep-tab-btn" style="flex:1;padding:10px;text-align:center;background:#f5f5f5;color:#888;font-size:13px;cursor:pointer">プラン3</div>
  </div>
  <div class="ep-tab-panel" style="padding:20px;text-align:center;display:block">
    <p style="font-weight:bold;color:#333;margin:0 0 8px">ベーシックプラン</p>
    <p style="color:#888;font-size:13px;margin:0 0 16px">月額 ¥980 で基本機能をすべて利用可能</p>
    <a href="#" style="display:inline-block;background:#0091FF;color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:bold">選択する</a>
  </div>
  <div class="ep-tab-panel" style="padding:20px;text-align:center;display:none">
    <p style="font-weight:bold;color:#333;margin:0 0 8px">スタンダードプラン</p>
    <p style="color:#888;font-size:13px;margin:0 0 16px">月額 ¥1,980 でプレミアム機能も利用可能</p>
    <a href="#" style="display:inline-block;background:#0091FF;color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:bold">選択する</a>
  </div>
  <div class="ep-tab-panel" style="padding:20px;text-align:center;display:none">
    <p style="font-weight:bold;color:#333;margin:0 0 8px">プレミアムプラン</p>
    <p style="color:#888;font-size:13px;margin:0 0 16px">月額 ¥3,980 で全機能を無制限に利用可能</p>
    <a href="#" style="display:inline-block;background:#0091FF;color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:bold">選択する</a>
  </div>
</div>`,
    defaultJavascript: TAB_SWITCH_JS,
    defaults: { animation: 'slideUp' },
  },

  // ─── 7. キャンペーン誘導（全画面） ───
  {
    id: 'campaign-fullscreen',
    name: 'キャンペーン誘導（全画面）',
    description: '全画面表示 / 出現アニメーション',
    thumbnailSvg: thumbSvg(`
      <rect x="10" y="10" width="180" height="120" rx="4" fill="rgba(0,0,0,0.6)"/>
      <rect x="35" y="30" width="130" height="80" rx="6" fill="${C.white}"/>
      <text x="100" y="52" text-anchor="middle" font-size="8" fill="${C.accent}" font-family="sans-serif" font-weight="bold">期間限定</text>
      <text x="100" y="66" text-anchor="middle" font-size="10" fill="${C.text}" font-family="sans-serif" font-weight="bold">50% OFF</text>
      <rect x="55" y="76" width="90" height="18" rx="3" fill="${C.accent}"/>
      <text x="100" y="88" text-anchor="middle" font-size="7" fill="${C.white}" font-family="sans-serif">キャンペーンページへ</text>
      <text x="100" y="104" text-anchor="middle" font-size="6" fill="${C.sub}" font-family="sans-serif">閉じる</text>
    `),
    defaultHtml: `<div style="background:#fff;border-radius:12px;padding:32px;max-width:400px;margin:auto;text-align:center">
  <p style="color:#FF6B35;font-size:14px;font-weight:bold;margin:0 0 8px">期間限定キャンペーン</p>
  <p style="font-size:36px;font-weight:bold;color:#333;margin:0 0 4px">50% OFF</p>
  <p style="color:#888;font-size:12px;margin:0 0 20px">初回ご購入のお客様限定</p>
  <a class="ep-cta" href="#" style="display:inline-block;background:#FF6B35;color:#fff;padding:14px 36px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px">キャンペーンページへ</a>
</div>`,
    defaultJavascript: CTA_PULSE_JS,
    defaults: { animation: 'elastic' },
  },

  // ─── 8. カウントダウン（開いてからの時間指定） ───
  {
    id: 'countdown-since-open',
    name: 'カウントダウン（開いてからの時間指定）',
    description: 'ページを開いてからの経過時間でカウントダウン',
    thumbnailSvg: thumbSvg(`
      <rect x="30" y="25" width="140" height="90" rx="6" fill="${C.white}" stroke="${C.border}"/>
      <text x="100" y="48" text-anchor="middle" font-size="7" fill="${C.sub}" font-family="sans-serif">特典の有効期限</text>
      <rect x="55" y="55" width="22" height="22" rx="3" fill="${C.blue}"/>
      <text x="66" y="70" text-anchor="middle" font-size="10" fill="${C.white}" font-family="sans-serif" font-weight="bold">10</text>
      <text x="82" y="70" font-size="10" fill="${C.text}">:</text>
      <rect x="88" y="55" width="22" height="22" rx="3" fill="${C.blue}"/>
      <text x="99" y="70" text-anchor="middle" font-size="10" fill="${C.white}" font-family="sans-serif" font-weight="bold">00</text>
      <text x="115" y="70" font-size="10" fill="${C.text}">:</text>
      <rect x="121" y="55" width="22" height="22" rx="3" fill="${C.blue}"/>
      <text x="132" y="70" text-anchor="middle" font-size="10" fill="${C.white}" font-family="sans-serif" font-weight="bold">00</text>
      <rect x="50" y="86" width="100" height="16" rx="3" fill="${C.blue}"/>
      <text x="100" y="97" text-anchor="middle" font-size="7" fill="${C.white}" font-family="sans-serif">お申し込み</text>
    `),
    defaultHtml: `<div style="background:#fff;border-radius:8px;padding:20px;box-shadow:0 4px 24px rgba(0,0,0,.15);max-width:360px;margin:auto;text-align:center">
  <p style="color:#888;font-size:12px;margin:0 0 12px">この特典の有効期限</p>
  <div style="display:flex;justify-content:center;gap:4px;font-size:24px;font-weight:bold;margin-bottom:16px">
    <span class="cd-num" style="background:#0091FF;color:#fff;padding:6px 10px;border-radius:4px">00</span>
    <span style="line-height:40px">:</span>
    <span class="cd-num" style="background:#0091FF;color:#fff;padding:6px 10px;border-radius:4px">10</span>
    <span style="line-height:40px">:</span>
    <span class="cd-num" style="background:#0091FF;color:#fff;padding:6px 10px;border-radius:4px">00</span>
  </div>
  <a class="ep-cta" href="#" style="display:inline-block;background:#0091FF;color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:bold">お申し込みはこちら</a>
</div>`,
    defaultJavascript: COUNTDOWN_JS + CTA_PULSE_JS,
    defaults: { animation: 'flipIn', countdown_trigger: true, countdown_seconds: 600 },
  },

  // ─── 9. 紙吹雪付き ───
  {
    id: 'confetti',
    name: '紙吹雪付き',
    description: '紙吹雪アニメーション付きポップアップ',
    thumbnailSvg: thumbSvg(`
      <rect x="30" y="35" width="140" height="75" rx="6" fill="${C.white}" stroke="${C.border}"/>
      <circle cx="40" cy="25" r="3" fill="#FF6B35"/>
      <circle cx="70" cy="18" r="2" fill="#0091FF"/>
      <circle cx="130" cy="22" r="3" fill="#2FA84F"/>
      <circle cx="160" cy="28" r="2" fill="#FFD700"/>
      <circle cx="55" cy="30" r="2" fill="#E040FB"/>
      <circle cx="145" cy="15" r="2" fill="#FF6B35"/>
      <rect x="80" y="12" width="4" height="8" rx="1" fill="#0091FF" transform="rotate(30,82,16)"/>
      <rect x="110" y="18" width="4" height="8" rx="1" fill="#2FA84F" transform="rotate(-20,112,22)"/>
      <text x="100" y="60" text-anchor="middle" font-size="10" fill="${C.accent}" font-family="sans-serif" font-weight="bold">おめでとう!</text>
      <text x="100" y="76" text-anchor="middle" font-size="7" fill="${C.text}" font-family="sans-serif">特別クーポンを獲得しました</text>
      <rect x="55" y="85" width="90" height="16" rx="3" fill="${C.green}"/>
      <text x="100" y="96" text-anchor="middle" font-size="7" fill="${C.white}" font-family="sans-serif">受け取る</text>
    `),
    defaultHtml: `<div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.15);max-width:320px;margin:auto;text-align:center;position:relative;overflow:hidden">
  <p style="font-size:32px;margin:0 0 8px">&#127882;</p>
  <p style="font-weight:bold;font-size:18px;color:#FF6B35;margin:0 0 8px">おめでとうございます!</p>
  <p style="color:#333;font-size:13px;margin:0 0 16px">特別クーポンを獲得しました</p>
  <div style="background:#FFF3E0;border:2px dashed #FF6B35;padding:8px;border-radius:6px;margin-bottom:16px">
    <span class="ep-coupon-code" style="font-family:monospace;font-size:18px;font-weight:bold;color:#FF6B35;letter-spacing:2px">CONGRATS15</span>
  </div>
  <button class="ep-copy-btn" style="background:#2FA84F;color:#fff;border:none;padding:10px 24px;border-radius:4px;cursor:pointer;font-weight:bold">コピーして使う</button>
</div>`,
    defaultJavascript: CONFETTI_JS + COUPON_COPY_JS,
    defaults: { animation: 'bounceIn' },
  },

  // ─── 10. 画像の上にボタンリンク ───
  {
    id: 'image-button-link',
    name: '画像の上にボタンリンク',
    description: '画像とCTAボタンのシンプルなポップアップ',
    thumbnailSvg: thumbSvg(`
      <rect x="30" y="20" width="140" height="100" rx="6" fill="${C.white}" stroke="${C.border}"/>
      <rect x="40" y="28" width="120" height="54" rx="3" fill="#E0E0E0"/>
      <text x="100" y="58" text-anchor="middle" font-size="8" fill="${C.sub}" font-family="sans-serif">画像</text>
      <rect x="50" y="90" width="100" height="20" rx="4" fill="${C.accent}"/>
      <text x="100" y="103" text-anchor="middle" font-size="8" fill="${C.white}" font-family="sans-serif">詳しくはこちら</text>
    `),
    defaultHtml: `<div style="background:#fff;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.15);max-width:360px;margin:auto;overflow:hidden;text-align:center">
  <div style="background:#E0E0E0;height:180px;display:flex;align-items:center;justify-content:center;color:#888;font-size:13px">画像を設定してください</div>
  <div style="padding:16px">
    <a class="ep-cta" href="#" style="display:inline-block;background:#FF6B35;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold">詳しくはこちら</a>
  </div>
</div>`,
    defaultJavascript: CTA_PULSE_JS,
    defaults: { animation: 'slideUp' },
  },

  // ─── 11. リンク2つ配置 ───
  {
    id: 'two-links',
    name: 'リンク2つ配置',
    description: '2つの選択肢を提示するポップアップ',
    thumbnailSvg: thumbSvg(`
      <rect x="30" y="25" width="140" height="90" rx="6" fill="${C.white}" stroke="${C.border}"/>
      <text x="100" y="48" text-anchor="middle" font-size="8" fill="${C.text}" font-family="sans-serif" font-weight="bold">どちらをご希望?</text>
      <rect x="38" y="58" width="56" height="44" rx="4" fill="${C.blue}"/>
      <text x="66" y="78" text-anchor="middle" font-size="7" fill="${C.white}" font-family="sans-serif">プランA</text>
      <text x="66" y="92" text-anchor="middle" font-size="6" fill="rgba(255,255,255,0.8)" font-family="sans-serif">お得な方</text>
      <rect x="106" y="58" width="56" height="44" rx="4" fill="${C.accent}"/>
      <text x="134" y="78" text-anchor="middle" font-size="7" fill="${C.white}" font-family="sans-serif">プランB</text>
      <text x="134" y="92" text-anchor="middle" font-size="6" fill="rgba(255,255,255,0.8)" font-family="sans-serif">人気の方</text>
    `),
    defaultHtml: `<div style="background:#fff;border-radius:8px;padding:20px;box-shadow:0 4px 24px rgba(0,0,0,.15);max-width:360px;margin:auto;text-align:center">
  <p style="font-weight:bold;font-size:15px;color:#333;margin:0 0 16px">どちらをご希望ですか?</p>
  <div style="display:flex;gap:12px">
    <a href="#" style="flex:1;display:block;background:#0091FF;color:#fff;padding:16px;border-radius:6px;text-decoration:none;font-weight:bold;transition:transform .15s" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">プランA<br><span style="font-size:12px;opacity:.8">お得な方</span></a>
    <a href="#" style="flex:1;display:block;background:#FF6B35;color:#fff;padding:16px;border-radius:6px;text-decoration:none;font-weight:bold;transition:transform .15s" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">プランB<br><span style="font-size:12px;opacity:.8">人気の方</span></a>
  </div>
</div>`,
    defaultJavascript: '',
    defaults: { animation: 'flipIn' },
  },

  // ─── 12. 紙吹雪付きカウントダウン ───
  {
    id: 'confetti-countdown',
    name: '紙吹雪付きカウントダウン',
    description: '紙吹雪 + カウントダウンの組み合わせ',
    thumbnailSvg: thumbSvg(`
      <circle cx="30" cy="20" r="2" fill="#FF6B35"/>
      <circle cx="170" cy="25" r="3" fill="#0091FF"/>
      <circle cx="50" cy="15" r="2" fill="#2FA84F"/>
      <circle cx="150" cy="18" r="2" fill="#E040FB"/>
      <rect x="30" y="30" width="140" height="85" rx="6" fill="${C.white}" stroke="${C.border}"/>
      <text x="100" y="50" text-anchor="middle" font-size="7" fill="${C.accent}" font-family="sans-serif" font-weight="bold">タイムセール開催中!</text>
      <rect x="50" y="58" width="24" height="22" rx="3" fill="${C.accent}"/>
      <text x="62" y="73" text-anchor="middle" font-size="11" fill="${C.white}" font-family="sans-serif" font-weight="bold">01</text>
      <text x="78" y="73" font-size="11" fill="${C.text}">:</text>
      <rect x="84" y="58" width="24" height="22" rx="3" fill="${C.accent}"/>
      <text x="96" y="73" text-anchor="middle" font-size="11" fill="${C.white}" font-family="sans-serif" font-weight="bold">23</text>
      <text x="112" y="73" font-size="11" fill="${C.text}">:</text>
      <rect x="118" y="58" width="24" height="22" rx="3" fill="${C.accent}"/>
      <text x="130" y="73" text-anchor="middle" font-size="11" fill="${C.white}" font-family="sans-serif" font-weight="bold">45</text>
      <rect x="55" y="88" width="90" height="16" rx="3" fill="${C.accent}"/>
      <text x="100" y="99" text-anchor="middle" font-size="7" fill="${C.white}" font-family="sans-serif">今すぐチェック</text>
    `),
    defaultHtml: `<div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.15);max-width:360px;margin:auto;text-align:center;position:relative;overflow:hidden">
  <p style="font-weight:bold;font-size:16px;color:#FF6B35;margin:0 0 12px">&#127882; タイムセール開催中!</p>
  <div style="display:flex;justify-content:center;gap:4px;font-size:24px;font-weight:bold;margin-bottom:16px">
    <span class="cd-num" style="background:#FF6B35;color:#fff;padding:6px 10px;border-radius:4px">01</span>
    <span style="line-height:40px">:</span>
    <span class="cd-num" style="background:#FF6B35;color:#fff;padding:6px 10px;border-radius:4px">23</span>
    <span style="line-height:40px">:</span>
    <span class="cd-num" style="background:#FF6B35;color:#fff;padding:6px 10px;border-radius:4px">45</span>
  </div>
  <a class="ep-cta" href="#" style="display:inline-block;background:#FF6B35;color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:bold">今すぐチェック</a>
</div>`,
    defaultJavascript: CONFETTI_JS + COUNTDOWN_JS + CTA_PULSE_JS,
    defaults: { animation: 'bounceIn', countdown_trigger: true, countdown_seconds: 300 },
  },
]
