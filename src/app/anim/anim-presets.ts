/**
 * アニメーション（入場エフェクト）プリセット。CapCutのアニメーション機能のイメージ。
 *
 * テキスト（Quillインライン属性 `data-anim` の span）と画像（`img[data-anim]`）の両方へ、
 * 15種の入場エフェクトを付けられる。配信LP/プレビューでは要素が画面に入った瞬間に1回再生し、
 * エディタではプロパティパネルの操作で即プレビュー再生する。
 *
 * この定義とCSS/スクリプトは配信(mock-server/routes/delivery.ts)からも import して二重管理を避ける
 * （DOM非依存の純粋な文字列生成関数・lp-base-css.ts と同じ扱い）。
 */

export interface AnimPreset {
  /** data-anim の値（安定ID・保存される） */
  id: string
  /** 表示名（日本語） */
  label: string
  /** @keyframes 本体（0%/100% を含む） */
  keyframes: string
}

/** 速度プリセット（--sb-anim-dur に反映） */
export const ANIM_SPEEDS: readonly { id: string; label: string; dur: string }[] = [
  { id: 'slow', label: '遅い', dur: '1200ms' },
  { id: 'normal', label: '標準', dur: '700ms' },
  { id: 'fast', label: '速い', dur: '400ms' },
]

/** 15種の入場エフェクト。keyframe名は sbA_<id>。 */
export const ANIM_PRESETS: readonly AnimPreset[] = [
  { id: 'fade', label: 'フェードイン', keyframes: 'from{opacity:0}to{opacity:1}' },
  { id: 'zoomin', label: 'ズームイン', keyframes: 'from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}' },
  { id: 'zoomout', label: 'ズームアウト', keyframes: 'from{opacity:0;transform:scale(1.35)}to{opacity:1;transform:scale(1)}' },
  { id: 'up', label: 'せり上がり', keyframes: 'from{opacity:0;transform:translateY(42px)}to{opacity:1;transform:translateY(0)}' },
  { id: 'down', label: '上から落下', keyframes: 'from{opacity:0;transform:translateY(-42px)}to{opacity:1;transform:translateY(0)}' },
  { id: 'left', label: '左から', keyframes: 'from{opacity:0;transform:translateX(-64px)}to{opacity:1;transform:translateX(0)}' },
  { id: 'right', label: '右から', keyframes: 'from{opacity:0;transform:translateX(64px)}to{opacity:1;transform:translateX(0)}' },
  { id: 'pop', label: 'ポップ', keyframes: '0%{opacity:0;transform:scale(0)}70%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:scale(1)}' },
  { id: 'bounce', label: 'バウンス', keyframes: '0%{opacity:0;transform:translateY(-48px)}55%{opacity:1;transform:translateY(10px)}75%{transform:translateY(-6px)}100%{opacity:1;transform:translateY(0)}' },
  { id: 'rotate', label: '回転イン', keyframes: 'from{opacity:0;transform:rotate(-14deg) scale(.8)}to{opacity:1;transform:rotate(0) scale(1)}' },
  { id: 'blur', label: 'ブラー解除', keyframes: 'from{opacity:0;filter:blur(14px)}to{opacity:1;filter:blur(0)}' },
  { id: 'flip', label: 'フリップ', keyframes: 'from{opacity:0;transform:perspective(600px) rotateX(90deg)}to{opacity:1;transform:perspective(600px) rotateX(0)}' },
  { id: 'slideblur', label: 'スライド＋ぼかし', keyframes: 'from{opacity:0;filter:blur(10px);transform:translateX(48px)}to{opacity:1;filter:blur(0);transform:translateX(0)}' },
  { id: 'swing', label: 'スウィング', keyframes: '0%{opacity:0;transform:rotate(18deg)}40%{opacity:1;transform:rotate(-12deg)}70%{transform:rotate(6deg)}100%{opacity:1;transform:rotate(0)}' },
  { id: 'shine', label: 'シャイン', keyframes: '0%{opacity:0;filter:brightness(2.2)}60%{opacity:1;filter:brightness(1.6)}100%{opacity:1;filter:brightness(1)}' },
]

/** id → preset の索引 */
export function findAnimPreset(id: string): AnimPreset | undefined {
  return ANIM_PRESETS.find((p) => p.id === id)
}

/**
 * アニメーション用CSS（@keyframes＋土台＋速度＋再生トリガ）を返す。
 * エディタ・配信・プレビューの全てに同じものを注入する。
 *
 * - `span[data-anim]` はテキスト用に inline-block（transformを効かせる）。
 * - `.sb-anim-ready [data-anim]:not(.sb-anim-run)` = **JS有効時だけ初期非表示**
 *   （配信LPで画面イン前に隠す。JS無効なら隠れず表示されるフェイルセーフ）。
 * - `.sb-anim-run[data-anim="<id>"]` で該当エフェクトを1回再生（fill:both で終了状態を保持）。
 */
export function buildAnimCss(): string {
  const speedVars = ANIM_SPEEDS.map((s) => `[data-anim-speed="${s.id}"]{--sb-anim-dur:${s.dur}}`).join('')
  const triggers = ANIM_PRESETS.map(
    (p) => `.sb-anim-run[data-anim="${p.id}"]{animation:sbA_${p.id} var(--sb-anim-dur,700ms) both cubic-bezier(.22,.61,.36,1)}`,
  ).join('')
  const frames = ANIM_PRESETS.map((p) => `@keyframes sbA_${p.id}{${p.keyframes}}`).join('')
  // ループ設定: data-anim-loop="1" の要素は無限に往復再生（alternate）して滑らかに繰り返す。
  // triggers と同じ詳細度なので、後に置いて iteration-count / direction だけ上書きする。
  const loop = `.sb-anim-run[data-anim-loop="1"]{animation-iteration-count:infinite;animation-direction:alternate}`
  return (
    `span[data-anim]{display:inline-block}` +
    `[data-anim]{--sb-anim-dur:700ms}` +
    speedVars +
    `.sb-anim-ready [data-anim]:not(.sb-anim-run){opacity:0}` +
    triggers +
    loop +
    frames
  )
}

/**
 * 配信LP/プレビュー用の再生スクリプト（文字列）。
 * body に `.sb-anim-ready` を付けて初期非表示にし、IntersectionObserver で
 * 画面に入った要素へ `.sb-anim-run` を付けて1回だけ再生する。
 */
export function buildAnimRuntimeScript(): string {
  return `<script>(function(){
    var els=document.querySelectorAll('[data-anim]');
    if(!els.length)return;
    // 保存HTMLに sb-anim-run が焼き込まれている場合があるため、まず全部リセットする。
    // これをしないと読み込み時点で全アニメが一斉再生され、画面外で再生し終えてしまい
    // スクロール表示トリガが効かない（＝アニメが動かないように見える）。指示164。
    els.forEach(function(el){el.classList.remove('sb-anim-run')});
    document.body.classList.add('sb-anim-ready');
    var run=function(el){el.classList.add('sb-anim-run')};
    if(!('IntersectionObserver' in window)){els.forEach(run);return;}
    // 画面に少しでも入ったら再生（大きい要素でも確実に発火するよう rootMargin で前倒し）。
    var io=new IntersectionObserver(function(ents){
      ents.forEach(function(e){if(e.isIntersecting){run(e.target);io.unobserve(e.target);}});
    },{threshold:0.01,rootMargin:'0px 0px -10% 0px'});
    els.forEach(function(el){io.observe(el)});
  })()</script>`
}
