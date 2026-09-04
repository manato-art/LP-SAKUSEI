/**
 * 追尾型ポップアップのプリセット一覧（指示85）。
 *
 * 追尾型は離脱防止と異なり、画面下端や角に固定表示される小型バナー。
 * オーバーレイ無し・ページ閲覧を妨げない控えめな表示。
 */

export interface FollowPreset {
  id: string
  name: string
  description: string
  thumbnailSvg: string
  defaultHtml: string
  defaultCss: string
  defaultJavascript: string
  defaults: {
    position?: 'top' | 'bottom' | 'bottom-right' | 'bottom-left'
    show_after_scroll?: number
    show_close_button?: boolean
    animation?: string
  }
}

const C = {
  bg: '#F5F5F5',
  accent: '#FF6B35',
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

export const FOLLOW_PRESETS: readonly FollowPreset[] = [
  {
    id: 'follow-cta-bottom',
    name: 'ボトムCTAバナー',
    description: '画面下部に固定されるCTAボタン付きバナー',
    thumbnailSvg: thumbSvg(`
      <rect x="10" y="100" width="180" height="30" rx="4" fill="${C.blue}"/>
      <text x="100" y="120" text-anchor="middle" fill="${C.white}" font-size="11" font-weight="600">お申し込みはこちら →</text>
      <rect x="30" y="20" width="140" height="6" rx="2" fill="#ddd"/>
      <rect x="40" y="34" width="120" height="4" rx="2" fill="#eee"/>
      <rect x="50" y="46" width="100" height="4" rx="2" fill="#eee"/>
    `),
    defaultHtml: `<div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:14px 20px;background:linear-gradient(135deg,#0091FF,#0066CC);color:#fff;font-family:sans-serif">
  <span style="font-size:14px;font-weight:600">期間限定キャンペーン実施中！</span>
  <a href="#" style="display:inline-block;padding:8px 20px;background:#fff;color:#0091FF;border-radius:20px;font-size:13px;font-weight:600;text-decoration:none">お申し込み →</a>
</div>`,
    defaultCss: '',
    defaultJavascript: '',
    defaults: { position: 'bottom', show_after_scroll: 0, animation: 'slideUp' },
  },
  {
    id: 'follow-coupon-corner',
    name: 'クーポンバッジ',
    description: '右下に表示されるクーポンコードバッジ',
    thumbnailSvg: thumbSvg(`
      <rect x="110" y="80" width="80" height="50" rx="6" fill="${C.accent}"/>
      <text x="150" y="100" text-anchor="middle" fill="${C.white}" font-size="9" font-weight="600">SAVE20</text>
      <text x="150" y="118" text-anchor="middle" fill="${C.white}" font-size="7">20%OFF</text>
      <rect x="20" y="15" width="100" height="5" rx="2" fill="#ddd"/>
      <rect x="20" y="28" width="80" height="4" rx="2" fill="#eee"/>
    `),
    defaultHtml: `<div style="width:220px;padding:16px;background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.15);font-family:sans-serif;text-align:center">
  <div style="font-size:11px;color:#888;margin-bottom:6px">今だけ限定クーポン</div>
  <div style="font-size:24px;font-weight:700;color:#FF6B35;letter-spacing:2px;margin-bottom:8px">SAVE20</div>
  <div style="font-size:12px;color:#333;margin-bottom:10px">全品 <strong>20%OFF</strong></div>
  <button onclick="navigator.clipboard.writeText('SAVE20')" style="padding:8px 16px;background:#FF6B35;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">コードをコピー</button>
</div>`,
    defaultCss: '',
    defaultJavascript: '',
    defaults: { position: 'bottom-right', show_after_scroll: 30, show_close_button: true, animation: 'slideUp' },
  },
  {
    id: 'follow-line-cta',
    name: 'LINE誘導バナー',
    description: '画面下部のLINE友だち追加バナー',
    thumbnailSvg: thumbSvg(`
      <rect x="10" y="100" width="180" height="30" rx="4" fill="#06C755"/>
      <text x="100" y="120" text-anchor="middle" fill="${C.white}" font-size="10" font-weight="600">LINE友だち追加で特典GET</text>
      <rect x="30" y="20" width="140" height="6" rx="2" fill="#ddd"/>
      <rect x="40" y="34" width="120" height="4" rx="2" fill="#eee"/>
    `),
    defaultHtml: `<div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 20px;background:#06C755;color:#fff;font-family:sans-serif">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M12 2C6.48 2 2 5.82 2 10.5c0 2.65 1.33 5.02 3.42 6.6-.13.46-.84 2.96-.87 3.15 0 0-.02.15.07.21s.2.01.2.01c.27-.04 3.1-2.03 3.58-2.38.5.07 1.04.11 1.6.11 5.52 0 10-3.82 10-8.5S17.52 2 12 2z"/></svg>
  <span style="font-size:14px;font-weight:600">LINE友だち追加で特典GET</span>
  <span style="padding:6px 14px;background:#fff;color:#06C755;border-radius:16px;font-size:12px;font-weight:600">追加する</span>
</div>`,
    defaultCss: '',
    defaultJavascript: '',
    defaults: { position: 'bottom', show_after_scroll: 0, animation: 'slideUp' },
  },
  {
    id: 'follow-notification',
    name: '通知バナー',
    description: '画面上部に表示されるお知らせバナー',
    thumbnailSvg: thumbSvg(`
      <rect x="10" y="10" width="180" height="28" rx="4" fill="#333"/>
      <text x="100" y="28" text-anchor="middle" fill="${C.white}" font-size="9">セール終了まであと3日</text>
      <rect x="30" y="55" width="140" height="5" rx="2" fill="#ddd"/>
      <rect x="40" y="68" width="120" height="4" rx="2" fill="#eee"/>
    `),
    defaultHtml: `<div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 20px;background:#1a1a2e;color:#fff;font-family:sans-serif;font-size:13px">
  <span>セール終了まであと <strong style="color:#FFD700">3日</strong></span>
  <a href="#" style="padding:5px 14px;background:#FFD700;color:#1a1a2e;border-radius:4px;font-size:12px;font-weight:600;text-decoration:none">詳しく見る</a>
</div>`,
    defaultCss: '',
    defaultJavascript: '',
    defaults: { position: 'top', show_after_scroll: 0, show_close_button: true, animation: 'slideDown' },
  },
  {
    id: 'follow-timer-bottom',
    name: 'タイマー付きバナー',
    description: 'カウントダウン付きの緊急訴求バナー',
    thumbnailSvg: thumbSvg(`
      <rect x="10" y="98" width="180" height="32" rx="4" fill="#D0021B"/>
      <text x="100" y="114" text-anchor="middle" fill="${C.white}" font-size="9" font-weight="600">残り 00:29:59</text>
      <text x="100" y="126" text-anchor="middle" fill="${C.white}" font-size="7">お見逃しなく！</text>
      <rect x="30" y="20" width="140" height="6" rx="2" fill="#ddd"/>
    `),
    defaultHtml: `<div style="display:flex;align-items:center;justify-content:center;gap:16px;padding:12px 20px;background:linear-gradient(90deg,#D0021B,#FF4444);color:#fff;font-family:sans-serif">
  <div style="text-align:center">
    <div style="font-size:11px;opacity:.8">キャンペーン終了まで</div>
    <div class="fp-timer" style="font-size:22px;font-weight:700;font-variant-numeric:tabular-nums">00:30:00</div>
  </div>
  <a href="#" style="padding:10px 24px;background:#fff;color:#D0021B;border-radius:24px;font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap">今すぐ申し込む</a>
</div>`,
    defaultCss: '',
    defaultJavascript: `(function(){
  var el=document.querySelector('.fp-timer');if(!el)return;
  var sec=1800;
  function pad(n){return n<10?'0'+n:''+n;}
  function tick(){
    if(sec<=0){el.textContent='00:00:00';return;}
    sec--;
    var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    el.textContent=pad(h)+':'+pad(m)+':'+pad(s);
  }
  setInterval(tick,1000);
})();`,
    defaults: { position: 'bottom', show_after_scroll: 0, animation: 'slideUp' },
  },
  {
    id: 'follow-chat-widget',
    name: 'チャットウィジェット風',
    description: '右下にチャット風のお問い合わせ誘導',
    thumbnailSvg: thumbSvg(`
      <rect x="120" y="70" width="70" height="60" rx="8" fill="${C.white}" stroke="${C.border}"/>
      <circle cx="155" cy="85" r="10" fill="${C.blue}"/>
      <text x="155" y="89" text-anchor="middle" fill="${C.white}" font-size="10">?</text>
      <text x="155" y="108" text-anchor="middle" fill="${C.text}" font-size="7">お困りですか？</text>
      <rect x="128" y="116" width="54" height="8" rx="3" fill="${C.blue}"/>
    `),
    defaultHtml: `<div style="width:240px;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.15);font-family:sans-serif;overflow:hidden">
  <div style="padding:14px 16px;background:#0091FF;color:#fff;display:flex;align-items:center;gap:8px">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="#fff"><path d="M18 10c0 4.42-3.58 8-8 8a7.96 7.96 0 01-3.87-1L2 18l1.34-3.34A7.96 7.96 0 012 10c0-4.42 3.58-8 8-8s8 3.58 8 8z"/></svg>
    <span style="font-size:13px;font-weight:600">お困りですか？</span>
  </div>
  <div style="padding:14px 16px">
    <p style="font-size:12px;color:#555;margin:0 0 10px;line-height:1.5">ご質問やお見積もりなど、お気軽にお問い合わせください。</p>
    <a href="#" style="display:block;text-align:center;padding:10px;background:#0091FF;color:#fff;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none">チャットを始める</a>
  </div>
</div>`,
    defaultCss: '',
    defaultJavascript: '',
    defaults: { position: 'bottom-right', show_after_scroll: 50, show_close_button: true, animation: 'slideUp' },
  },
]
