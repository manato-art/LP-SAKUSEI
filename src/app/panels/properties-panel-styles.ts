/**
 * 右プロパティパネルのCSSとアイコン（properties-panel.ts から分離）。
 */

import { buildAnimCss } from '../anim/anim-presets.ts'

/** rgb(r,g,b) やカラーネームを #hex に正規化する（input[type=color]用） */
export function normalizeColor(c: string): string {
  // すでに #hex ならそのまま
  if (/^#[0-9a-f]{6}$/i.test(c)) return c
  if (/^#[0-9a-f]{3}$/i.test(c)) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
  }
  // rgb(r,g,b)
  const m = c.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/)
  if (m !== null) {
    const r = parseInt(m[1] ?? '0', 10)
    const g = parseInt(m[2] ?? '0', 10)
    const b = parseInt(m[3] ?? '0', 10)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }
  // フォールバック（カラーネームなど）
  const ctx = document.createElement('canvas').getContext('2d')
  if (ctx !== null) {
    ctx.fillStyle = c
    return ctx.fillStyle // ブラウザが #hex に変換する
  }
  return c
}
export function injectStyles(): void {
  if (document.getElementById('sb-props-panel-css') !== null) return
  const s = document.createElement('style')
  s.id = 'sb-props-panel-css'
  s.textContent = `
    /* 指示171: スタイル(プロパティ)パネルを赤ライン（＝旧アイコンレール左端）まで左へ拡張。
       キャンバス(quillEditorContentWrapper)は flex:1 なので、この幅を広げるとキャンバスが縮み、
       間に挟まるアイコンレール(68px)とキャンバス右端のスクロールバーが同じ分だけ左へ移動する。
       260(元) + 68(アイコンレール幅) = 328px。 */
    .sb-props-panel {
      width:328px; background:#fff; border-left:1px solid #e5e5ea;
      display:flex; flex-direction:column; flex-shrink:0;
      overflow-y:auto; overflow-x:hidden;
      height:calc(100vh - 92px);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,
        "Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;
      font-size:12px; user-select:none;
      box-sizing:border-box;
    }
    .sb-props-header {
      padding:10px 12px; border-bottom:1px solid #e5e5ea;
      display:flex; align-items:center; justify-content:space-between;
      flex-shrink:0;
    }
    .sb-props-header h3 {
      font-size:12px; font-weight:600; color:#1a1a1a; margin:0;
    }
    .sb-props-close {
      width:20px; height:20px; border:none; background:none;
      cursor:pointer; color:#b0b0b0; display:flex;
      align-items:center; justify-content:center; border-radius:4px;
      transition:background .12s,color .12s;
    }
    .sb-props-close:hover { background:#f0f0f2; color:#666; }
    .sb-props-tabs {
      display:flex; border-bottom:1px solid #e5e5ea; flex-shrink:0;
    }
    .sb-props-tab {
      flex:1; padding:9px; text-align:center; font-size:12px;
      font-weight:500; color:#666; cursor:pointer;
      border-bottom:2px solid transparent;
      transition:color .12s,border-color .12s;
      background:none; border-top:none; border-left:none; border-right:none;
      font-family:inherit;
    }
    .sb-props-tab:hover { color:#333; }
    .sb-props-tab.active { color:var(--sb-accent, #0091FF); border-bottom-color:var(--sb-accent, #0091FF); }
    .sb-props-body {
      padding:12px; display:flex; flex-direction:column; gap:12px;
      flex:1; overflow-y:auto;
    }
    .sb-props-empty {
      padding:16px 16px; text-align:center; color:#999;
      font-size:12px; line-height:1.8;
    }
    .sb-pg { display:flex; flex-direction:column; gap:5px; }
    .sb-pg-title {
      font-size:10px; font-weight:700; color:#1a1a1a;
      letter-spacing:.3px;
    }
    .sb-pr { display:flex; align-items:center; gap:6px; }
    .sb-pr-label {
      font-size:11px; color:#666; width:54px; flex-shrink:0;
    }
    .sb-pr-input {
      flex:1; height:28px; border:1px solid #e5e5ea; border-radius:4px;
      padding:0 6px; font-size:11px; color:#1a1a1a;
      font-family:inherit; outline:none; background:#fff;
      box-sizing:border-box;
    }
    .sb-pr-input:focus { border-color:var(--sb-accent, #0091FF); }
    .sb-pr-select {
      flex:1; height:28px; border:1px solid #e5e5ea; border-radius:4px;
      padding:0 4px; font-size:11px; color:#1a1a1a;
      font-family:inherit; background:#fff; cursor:pointer;
    }
    .sb-pr-textarea {
      width:100%; min-height:44px; border:1px solid #e5e5ea; border-radius:4px;
      padding:6px; font-size:11px; color:#1a1a1a;
      font-family:inherit; outline:none; resize:vertical;
      background:#fff; box-sizing:border-box;
    }
    .sb-pr-textarea:focus { border-color:var(--sb-accent, #0091FF); }
    .sb-pr-toggle {
      width:34px; height:18px; border-radius:9px; border:none;
      background:#e5e5ea; position:relative; cursor:pointer;
      transition:background .2s; flex-shrink:0; padding:0;
    }
    .sb-pr-toggle.on { background:var(--sb-accent, #0091FF); }
    .sb-pr-toggle::after {
      content:''; position:absolute; top:2px; left:2px;
      width:14px; height:14px; border-radius:50%; background:#fff;
      transition:left .2s; box-shadow:0 1px 2px rgba(0,0,0,.2);
    }
    .sb-pr-toggle.on::after { left:18px; }
    .sb-pr-color-swatch {
      width:22px; height:22px; border-radius:3px;
      border:1px solid #e5e5ea; cursor:pointer; flex-shrink:0;
      position:relative;
    }
    .sb-pr-color-swatch input[type="color"] {
      position:absolute; opacity:0; width:0; height:0; pointer-events:none;
    }
    .sb-pr-color-hex {
      flex:1; height:26px; border:1px solid #e5e5ea; border-radius:3px;
      padding:0 6px; font-size:11px; color:#1a1a1a;
      font-family:inherit; font-variant-numeric:tabular-nums;
      box-sizing:border-box; outline:none;
    }
    .sb-pr-color-hex:focus { border-color:var(--sb-accent, #0091FF); }
    .sb-pr-unit {
      font-size:10px; color:#b0b0b0; flex-shrink:0;
    }
    .sb-align-btns { display:flex; gap:0; }
    .sb-align-btn {
      width:32px; height:28px; border:1px solid #e5e5ea; background:#fff;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      color:#666; transition:background .12s; padding:0;
    }
    .sb-align-btn:first-child { border-radius:4px 0 0 4px; }
    .sb-align-btn:last-child { border-radius:0 4px 4px 0; }
    .sb-align-btn + .sb-align-btn { border-left:none; }
    .sb-align-btn:hover { background:#f0f0f2; }
    .sb-align-btn.active {
      background:rgba(0,145,255,.08); color:var(--sb-accent, #0091FF);
      /* 指示169: 隣接ボタンで border-left:none にしているため、選択時は左境界も復活させて
         四辺を完全に囲む。隣の右境界と重ならないよう margin-left:-1px で重ねる（二重線防止）。 */
      border:1px solid var(--sb-accent, #0091FF);
      margin-left:-1px; position:relative; z-index:1;
    }
    .sb-align-btn.active:first-child { margin-left:0; }
    .sb-fmt-btns { display:flex; gap:2px; flex-wrap:wrap; }
    .sb-fmt-btn {
      width:30px; height:28px; border:1px solid #e5e5ea; border-radius:4px;
      background:#fff; cursor:pointer; display:flex; align-items:center;
      justify-content:center; color:#666; transition:background .12s; padding:0;
    }
    .sb-fmt-btn:hover { background:#f0f0f2; }
    .sb-fmt-btn.active {
      background:rgba(0,145,255,.08); color:var(--sb-accent, #0091FF); border-color:var(--sb-accent, #0091FF);
    }
    .sb-pr-action {
      width:100%; height:32px; border:1px solid #e5e5ea; border-radius:5px;
      background:#fff; font-size:11px; color:#1a1a1a; cursor:pointer;
      font-family:inherit; display:flex; align-items:center;
      justify-content:center; gap:4px; transition:background .12s; padding:0;
    }
    .sb-pr-action:hover { background:#f0f0f2; }
    .sb-pr-action.danger { color:#e5573f; border-color:rgba(229,87,63,.3); }
    .sb-pr-action.danger:hover { background:rgba(229,87,63,.06); }
    .sb-ins-btns { display:flex; gap:4px; }
    .sb-ins-btn {
      flex:1; height:28px; border:1px solid #e5e5ea; border-radius:4px;
      background:#fff; font-size:10px; color:#1a1a1a; cursor:pointer;
      font-family:inherit; display:flex; align-items:center;
      justify-content:center; gap:3px; transition:background .12s; padding:0;
    }
    .sb-ins-btn:hover { background:#f0f0f2; }
    .sb-pr-size-grid {
      display:grid; grid-template-columns:auto 1fr auto auto 1fr auto;
      gap:3px; align-items:center;
    }
    .sb-pr-size-label {
      font-size:10px; color:#b0b0b0; font-weight:500;
    }
    .sb-pr-size-input {
      width:100%; height:26px; border:1px solid #e5e5ea; border-radius:3px;
      padding:0 4px; font-size:11px; color:#1a1a1a;
      font-family:inherit; text-align:center;
      font-variant-numeric:tabular-nums; box-sizing:border-box;
      outline:none;
    }
    .sb-pr-size-input:focus { border-color:var(--sb-accent, #0091FF); }
    .sb-pr-size-unit {
      font-size:9px; color:#b0b0b0;
    }
    .sb-pr-stepper-wrap {
      display:flex; flex-direction:column; gap:0; margin-left:2px;
    }
    .sb-pr-stepper-btn {
      width:16px; height:12px; border:1px solid #e5e5ea; background:#fff;
      cursor:pointer; font-size:7px; display:flex;
      align-items:center; justify-content:center; color:#666;
      padding:0; line-height:1;
    }
    .sb-pr-stepper-btn:first-child { border-radius:2px 2px 0 0; }
    .sb-pr-stepper-btn:last-child { border-radius:0 0 2px 2px; border-top:none; }
    .sb-pr-stepper-btn:hover { background:#f0f0f2; }
    /* アニメーション欄 */
    .sb-pr-anim-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
    .sb-pr-anim-btn {
      padding:8px 4px; font-size:11px; border:1px solid #e5e5ea; border-radius:6px;
      background:#fff; color:#444; cursor:pointer; font-family:inherit; line-height:1.2;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap; transition:all .12s;
    }
    .sb-pr-anim-btn:hover { border-color:#8ab4ff; background:#f5f8ff; }
    .sb-pr-anim-btn.active { border-color:var(--sb-accent, #0091FF); background:#eaf4ff; color:#0072d6; font-weight:700; }
    .sb-pr-anim-ctl { display:flex; gap:6px; align-items:center; margin-top:8px; }
    .sb-pr-anim-replay {
      padding:7px 10px; font-size:11px; border:1px solid var(--sb-accent, #0091FF); border-radius:6px;
      background:var(--sb-accent, #0091FF); color:#fff; cursor:pointer; font-family:inherit; white-space:nowrap; flex-shrink:0;
    }
    .sb-pr-anim-replay:hover { background:#007ee0; }
    .sb-pr-anim-loop { display:flex; align-items:center; gap:7px; margin-top:8px; font-size:12px; color:#444; cursor:pointer; user-select:none; }
    .sb-pr-anim-loop input { width:15px; height:15px; cursor:pointer; accent-color:var(--sb-accent, #0091FF); }
  `
  document.head.append(s)
}
export const SVG = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  underline: '<svg viewBox="0 0 18 18" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3v6a4 4 0 0 0 8 0V3"/><line x1="3" y1="16" x2="15" y2="16"/></svg>',
  strike: '<svg viewBox="0 0 18 18" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="2" y1="9" x2="16" y2="9"/><path d="M12.5 5C12 3.5 10.5 3 9 3c-2 0-3.5 1-3.5 2.5S7 8 9 9c2.5 1 3.5 1.5 3.5 3S11 15 9 15c-1.5 0-3-.5-3.5-2"/></svg>',
  link: '<svg viewBox="0 0 18 18" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7.5 10.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M10.5 7.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1"/></svg>',
  clearFmt: '<svg viewBox="0 0 18 18" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 3h8l-3 12"/><line x1="3" y1="15" x2="10" y2="15"/><line x1="13" y1="3" x2="3" y2="15" stroke-width="1.5" stroke-dasharray="2 2"/></svg>',
  image: '<svg viewBox="0 0 18 18" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="14" height="14" rx="2"/><circle cx="7" cy="7" r="1.5"/><path d="M16 12l-4-4-8 8"/></svg>',
  lineBreak: '<svg viewBox="0 0 18 18" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 4v6a2 2 0 0 1-2 2H5"/><polyline points="7 10 5 12 7 14"/></svg>',
  duplicate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  alignLeft: '<svg viewBox="0 0 18 18" width="13" height="13"><line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="2"/><line x1="2" y1="9" x2="10" y2="9" stroke="currentColor" stroke-width="2"/><line x1="2" y1="14" x2="14" y2="14" stroke="currentColor" stroke-width="2"/></svg>',
  alignCenter: '<svg viewBox="0 0 18 18" width="13" height="13"><line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="2"/><line x1="5" y1="9" x2="13" y2="9" stroke="currentColor" stroke-width="2"/><line x1="2" y1="14" x2="16" y2="14" stroke="currentColor" stroke-width="2"/></svg>',
  alignRight: '<svg viewBox="0 0 18 18" width="13" height="13"><line x1="4" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="2"/><line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" stroke-width="2"/><line x1="4" y1="14" x2="16" y2="14" stroke="currentColor" stroke-width="2"/></svg>',
  alignJustify: '<svg viewBox="0 0 18 18" width="13" height="13"><line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="2"/><line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" stroke-width="2"/><line x1="2" y1="14" x2="16" y2="14" stroke="currentColor" stroke-width="2"/></svg>',
} as const
export const ALIGN_LABELS: readonly { value: string | false; svg: string; title: string }[] = [
  { value: false, svg: SVG.alignLeft, title: '左揃え' },
  { value: 'center', svg: SVG.alignCenter, title: '中央揃え' },
  { value: 'right', svg: SVG.alignRight, title: '右揃え' },
  { value: 'justify', svg: SVG.alignJustify, title: '両端揃え' },
]
/** アニメーション用CSS（@keyframes・土台・再生トリガ）をエディタ文書へ1回だけ注入する。 */
export function injectAnimCssOnce(): void {
  if (document.getElementById('sb-anim-css') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-anim-css'
  style.textContent = buildAnimCss()
  document.head.append(style)
}
