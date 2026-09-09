/**
 * 比較モードのパネルのCSSとアイコン（compare-mode.ts から分離）。
 */
import { PANEL_W } from './compare-mode-metrics.ts'

export const ICON_CLOSE = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.54 4.46a.56.56 0 010 .79L8.79 8l2.75 2.75a.56.56 0 01-.79.79L8 8.79l-2.75 2.75a.56.56 0 01-.79-.79L7.21 8 4.46 5.25a.56.56 0 01.79-.79L8 7.21l2.75-2.75a.56.56 0 01.79 0z"/></svg>`
export const ICON_DOTS = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="4" cy="6.5" r="1.1"/><circle cx="4" cy="9.5" r="1.1"/><circle cx="8" cy="6.5" r="1.1"/><circle cx="8" cy="9.5" r="1.1"/><circle cx="12" cy="6.5" r="1.1"/><circle cx="12" cy="9.5" r="1.1"/></svg>`
export const ICON_EYE = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 4.2c-2.6 0-4.81 1.36-5.59 3.24a.14.14 0 000 .08C3.19 9.4 5.4 10.75 8 10.75s4.81-1.35 5.59-3.24a.14.14 0 000-.07C12.81 5.56 10.6 4.2 8 4.2zm0-.73c-3 0-5.55 1.56-6.45 3.73a.87.87 0 000 .54c.9 2.17 3.44 3.73 6.45 3.73s5.55-1.56 6.45-3.73a.87.87 0 000-.54C13.55 5.03 11 3.47 8 3.47zM10.5 7.47a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm-1.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>`
export const ICON_HEATMAP = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.83 2.5a1 1 0 011-1H13.5a1 1 0 011 1v11a1 1 0 01-1 1h-1.67a1 1 0 01-1-1V2.5zm2.67 0h-1.67v11H13.5V2.5zM6.17 5.83a1 1 0 011-1h1.66a1 1 0 011 1V13.5a1 1 0 01-1 1H7.17a1 1 0 01-1-1V5.83zm2.66 0H7.17V13.5h1.66V5.83zM1.5 8.5a1 1 0 011-1h1.67a1 1 0 011 1v5a1 1 0 01-1 1H2.5a1 1 0 01-1-1v-5zm2.67 0H2.5v5h1.67v-5z"/></svg>`
export const ICON_VERSION = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.1 2.5c-.07 0-.1.05-.1.08v.93A5.12 5.12 0 0111 8.62v2.88H12.9c.07 0 .1-.05.1-.08V6.81A1.3 1.3 0 0011.7 5.58h-.8a1 1 0 01-1.1-1.08V3.73A1.3 1.3 0 008.5 2.5H6.1zm4.9.45a3.3 3.3 0 011.86 1.77A3.22 3.22 0 0011.7 4.58h-.8a.2.2 0 01-.1.02V3.73c0-.27-.05-.55-.14-.78zM3 4.58c0-.02.03-.08.1-.08H5.5c.74 0 1.3.57 1.3 1.23V6.5A1 1 0 007.9 7.58h.8c.74 0 1.3.57 1.3 1.23v5.62c0 .02-.03.08-.1.08H3.1c-.07 0-.1-.06-.1-.08V4.58zm4.66.37a3.3 3.3 0 011.86 1.77c-.26-.1-.53-.15-.82-.15H7.9a.2.2 0 01-.1-.02V5.73c0-.28-.05-.55-.14-.78zM6.1 1.5A1.1 1.1 0 005 2.58V3.5h-.5A1.1 1.1 0 002 4.58v8.85A1.1 1.1 0 003.1 14.5h6.8A1.1 1.1 0 0011 13.42V12.5h1.9A1.1 1.1 0 0014 11.42V6.81 6.62A5.3 5.3 0 008.7 1.5H6.1z"/></svg>`
export const ICON_HISTORY = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M7.68 1.46a6.5 6.5 0 11-4.18 10.6.5.5 0 01.68-.68l.15.17.16.19A5.5 5.5 0 107.61 2.46a5.48 5.48 0 00-3.17 1.91L3.73 5.26 5.26 3.73h0l.93.76C3.27 6.36 3.18 7.36 3.17 7.52l.77-.76a.4.4 0 01.57 0 .4.4 0 010 .57l-1.61 1.6a.4.4 0 01-.57 0L.72 7.33a.4.4 0 010-.57.4.4 0 01.57 0l.86.86A6.5 6.5 0 017.68 1.46z"/><path d="M8.5 4a.5.5 0 00-1 0v4a.5.5 0 00.5.5h3a.5.5 0 000-1H8.5V4z"/></svg>`
export const ICON_BENCHMARK = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M9.79 3.39a2 2 0 012.83 2.83l-.98.98a.6.6 0 10.85.85l.98-.98a3.2 3.2 0 00-4.53-4.53l-2.4 2.4a3.2 3.2 0 004.53 4.53.5.5 0 10-.72-.68l-.03-.04a2 2 0 01-2.83-2.83l2.3-2.53z"/><path d="M9.28 6.37a.5.5 0 10-.72.68.03.03 0 01.03.04 2 2 0 01-2.83 2.83l-2.4 2.4a2 2 0 112.83-2.83l.98-.98a.6.6 0 10-.85-.85l-.98.98a3.2 3.2 0 104.53 4.53l2.4-2.4a3.2 3.2 0 00-4.53-4.53l.18.17z"/></svg>`
export const ICON_COPY = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M14 4a2 2 0 00-2-2H6.5a2 2 0 00-2 2v1H4a2 2 0 00-2 2v5a2 2 0 002 2h5a2 2 0 002-2v-.5h1a2 2 0 002-2V4zm-3 6.5V7a2 2 0 00-2-2H5.5V4a1 1 0 011-1H12a1 1 0 011 1v5.5a1 1 0 01-1 1h-1zM9 6a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h5z"/></svg>`
export const ICON_QR = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><g stroke="currentColor" stroke-width="1.33" stroke-linecap="round" stroke-linejoin="round"><rect width="3.33" height="3.33" x="2" y="2" rx=".67"/><rect width="3.33" height="3.33" x="10.67" y="2" rx=".67"/><rect width="3.33" height="3.33" x="2" y="10.67" rx=".67"/><path d="M14 10.67h-2a1.33 1.33 0 00-1.33 1.33v2"/><path d="M14 14v.01"/><path d="M8 4.67v2A1.33 1.33 0 016.67 8H4.67"/><path d="M2 8h.01"/><path d="M8 2h.01"/><path d="M8 10.67v.01"/><path d="M10.67 8h.66"/><path d="M14 8v.01"/><path d="M8 14v-.67"/></g></svg>`
export const ICON_EXTERNAL = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.5 2a.48.48 0 00-.48-.48l-3.39-.01a.48.48 0 000 .97h2.22L6.9 8.44a.48.48 0 00.68.68l5.95-5.95v2.22a.49.49 0 00.97 0V2zM3 3.5A1.5 1.5 0 001.5 5v8A1.5 1.5 0 003 14.5h8a1.5 1.5 0 001.5-1.5V8a.5.5 0 00-1 0v5a.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5V5a.5.5 0 01.5-.5h5a.5.5 0 000-1H3z"/></svg>`
export function injectStyles(): void {
  if (document.getElementById('sb-cmp-panel-css') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-cmp-panel-css'
  style.textContent = `
/* ── フローティングパネル ── */
.sb-cmp-panel {
  position: fixed;
  z-index: 9000;
  width: ${PANEL_W}px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06);
  overflow: hidden;
  animation: sb-cmp-fadein .15s ease;
  user-select: none;
}
@keyframes sb-cmp-fadein { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: scale(1); } }

/* ── ヘッダ ── */
.sb-cmp-header {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  gap: 8px;
  border-bottom: 1px solid #e5e5ea;
  flex-shrink: 0;
}
.sb-cmp-title {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
  margin-right: auto;
}
.sb-cmp-hdr-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-family: inherit;
  transition: background .12s;
}
.sb-cmp-hdr-btn:hover { background: #f0f0f0; }
.sb-cmp-drag-handle { cursor: grab; }
.sb-cmp-drag-handle:active { cursor: grabbing; }

/* ── タブバー ── */
.sb-cmp-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 10px;
  border-bottom: 1px solid #e5e5ea;
  flex-shrink: 0;
  overflow-x: auto;
}
.sb-cmp-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 8px;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  color: #888;
  font-size: 10px;
  font-family: inherit;
  white-space: pre-line;
  text-align: center;
  line-height: 1.3;
  transition: background .12s, color .12s;
  min-width: 0;
  flex-shrink: 0;
}
.sb-cmp-tab:hover { background: #f5f5f5; color: #555; }
.sb-cmp-tab.active {
  background: #f0f0f5;
  color: #1a1a1a;
  font-weight: 600;
}
.sb-cmp-tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

/* ── コンテンツ ── */
.sb-cmp-content {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* ── URL バー ── */
.sb-cmp-url-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e5ea;
  flex-shrink: 0;
}
.sb-cmp-url-label {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
  flex-shrink: 0;
}
.sb-cmp-url-text {
  font-size: 11px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 0;
  min-width: 0;
}
.sb-cmp-url-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 3px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: color .12s, background .12s;
}
.sb-cmp-url-btn:hover { color: #333; background: #f0f0f0; }

/* ── デバイスセレクタ ── */
.sb-cmp-device {
  display: flex;
  align-items: center;
  padding: 6px 12px 8px;
  border-bottom: 1px solid #e5e5ea;
  flex-shrink: 0;
}
.sb-cmp-device-select {
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  background: #f5f5f7;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 7px 32px 7px 12px;
  font-size: 13px;
  color: #1a1a1a;
  font-family: inherit;
  cursor: pointer;
  outline: none;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='%23888' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
.sb-cmp-device-select:focus {
  border-color: #4A8DF8;
  box-shadow: 0 0 0 2px rgba(74,141,248,.15);
}

/* ── フォンフレーム ── */
.sb-cmp-phone-area {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 10px 20px;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.sb-cmp-phone {
  background: #1a1a1a;
  border-radius: 40px;
  padding: 12px 8px;
  box-shadow: 0 4px 24px rgba(0,0,0,.12), inset 0 0 0 1px rgba(255,255,255,.06);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}
.sb-cmp-phone-notch {
  width: 90px;
  height: 22px;
  background: #1a1a1a;
  border-radius: 0 0 16px 16px;
  margin: -2px auto 0;
  position: relative;
  z-index: 2;
}
.sb-cmp-phone-screen {
  background: #fff;
  border-radius: 30px;
  overflow: hidden;
  position: relative;
}
.sb-cmp-phone-screen iframe {
  border: none;
  display: block;
}

/* ── 準備中プレースホルダ ── */
.sb-cmp-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #aaa;
  font-size: 14px;
  padding: 40px 16px;
}
.sb-cmp-placeholder svg { opacity: .4; }

/* ── リサイズハンドル（四隅） ── */
.sb-cmp-resize {
  position: absolute;
  width: 14px;
  height: 14px;
  z-index: 2;
}
.sb-cmp-resize-tl { top: -2px; left: -2px; cursor: nwse-resize; }
.sb-cmp-resize-tr { top: -2px; right: -2px; cursor: nesw-resize; }
.sb-cmp-resize-bl { bottom: -2px; left: -2px; cursor: nesw-resize; }
.sb-cmp-resize-br { bottom: -2px; right: -2px; cursor: nwse-resize; }
  `
  document.head.append(style)
}
export function injectOtherVersionsStyles(): void {
  if (document.getElementById('sb-cmp-ov-css') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-cmp-ov-css'
  style.textContent = `
    .sb-cmp-ov-layout { display:flex; height:100%; min-height:0; }
    .sb-cmp-ov-list {
      width:150px; flex:none; overflow-y:auto; border-right:1px solid #e6e8ec;
      padding:10px; display:flex; flex-direction:column; gap:10px; background:#fafbfc;
    }
    .sb-cmp-ov-card {
      display:flex; flex-direction:column; gap:6px; padding:6px; cursor:pointer;
      border:2px solid transparent; border-radius:8px; background:#fff; text-align:left;
      box-shadow:0 1px 2px rgba(0,0,0,.06); font-family:inherit;
    }
    .sb-cmp-ov-card:hover { border-color:#bcd8ff; }
    .sb-cmp-ov-card.active { border-color:var(--sb-accent, #0091FF); background:#f2f8ff; }
    .sb-cmp-ov-thumb {
      position:relative; width:100%; height:150px; overflow:hidden;
      border:1px solid #e6e8ec; border-radius:5px; background:#fff;
    }
    .sb-cmp-ov-thumb-frame {
      position:absolute; top:0; left:0; width:375px; height:812px; border:0;
      transform:scale(0.336); transform-origin:top left; pointer-events:none;
    }
    .sb-cmp-ov-meta { display:flex; flex-direction:column; gap:2px; }
    .sb-cmp-ov-name { font-size:12px; font-weight:700; color:#1a2233; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .sb-cmp-ov-ratio { font-size:11px; color:var(--sb-accent, #0091FF); font-weight:600; }
    .sb-cmp-ov-preview { flex:1; min-width:0; display:flex; flex-direction:column; }
  `
  document.head.append(style)
}
