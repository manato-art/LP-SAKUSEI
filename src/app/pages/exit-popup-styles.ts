/**
 * 離脱防止ポップアップ画面のCSS（exit-popup.ts から分離）。
 *
 * どれも「1回だけ <style> を差し込む」だけで、状態も引数も持たない。
 */
import { T } from '../ui.ts'

export function injectPopupCss(): void {
  if (document.getElementById('sb-exit-popup-css') !== null) return
  const s = document.createElement('style')
  s.id = 'sb-exit-popup-css'
  s.textContent = `
    .ep-root { display:flex; flex-direction:column; flex:1; min-width:0; min-height:0; height:100%; font-family:${T.font}; color:${T.text}; background:#f9f9fb; }
    /* 一覧・編集のスクロール領域。採取CSSが全消ししたスクロールバーをここでは明示的に復活させる。 */
    .ep-scroll { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; scrollbar-width:auto; }
    .ep-scroll::-webkit-scrollbar { display:block !important; width:12px; }
    .ep-scroll::-webkit-scrollbar-track { background:#f1f1f2; }
    .ep-scroll::-webkit-scrollbar-thumb { background:#c1c1c4; border-radius:6px; border:3px solid #f1f1f2; }
    .ep-scroll::-webkit-scrollbar-thumb:hover { background:#a8a8ac; }
    .ep-section-title { font-size:14px; font-weight:600; margin-bottom:16px; }
    /* ── 管理パネル（モーダル風オーバーレイ） ── */
    .ep-panel { position:fixed; inset:0; z-index:8000; background:rgba(0,0,0,.15); display:flex; align-items:center; justify-content:center; font-family:${T.font}; }
    .ep-panel-inner { background:#fff; border-radius:10px; width:820px; max-width:92vw; max-height:85vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,.12); }
    .ep-panel-head { display:flex; align-items:center; padding:16px 20px; border-bottom:1px solid #eee; position:relative; }
    .ep-panel-close { background:none; border:none; cursor:pointer; font-size:13px; color:${T.sub}; font-family:${T.font}; padding:0; }
    .ep-panel-close:hover { color:${T.text}; }
    .ep-panel-title { position:absolute; left:50%; transform:translateX(-50%); font-size:15px; font-weight:600; }
    .ep-subtabs { display:flex; gap:0; padding:0 20px; }
    .ep-subtab { padding:10px 16px; font-size:13px; cursor:pointer; border:none; border-bottom:2px solid transparent; background:none; color:${T.sub}; font-family:${T.font}; }
    .ep-subtab.active { color:${T.text}; border-bottom-color:${T.text}; font-weight:600; }
    .ep-delivery { display:flex; align-items:center; justify-content:space-between; padding:12px 20px; border-bottom:1px solid #f0f0f0; }
    .ep-delivery-label { font-size:13px; color:${T.text}; }
    .ep-toggle { width:40px; height:22px; border-radius:11px; background:#ccc; position:relative; cursor:pointer; transition:background .2s; border:none; padding:0; flex-shrink:0; }
    .ep-toggle.on { background:${T.primary}; }
    .ep-toggle::after { content:''; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition:left .2s; box-shadow:0 1px 2px rgba(0,0,0,.2); }
    .ep-toggle.on::after { left:20px; }
    .ep-list-head { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; }
    .ep-list-head h3 { font-size:14px; font-weight:600; margin:0; }
    .ep-add-btn { display:flex; align-items:center; gap:4px; font-size:13px; color:${T.primary}; cursor:pointer; background:none; border:none; font-family:${T.font}; }
    .ep-add-btn:hover { text-decoration:underline; }
    .ep-empty { padding:40px 20px; text-align:center; color:${T.sub}; font-size:13px; }
    .ep-card-grid { display:flex; flex-wrap:wrap; gap:16px; padding:4px 20px 20px; overflow-y:auto; flex:1; min-height:0; }
    .ep-card { width:180px; border:1px solid #e8e8e8; border-radius:8px; overflow:hidden; cursor:pointer; transition:box-shadow .15s; position:relative; background:#fff; }
    .ep-card:hover { box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .ep-card-thumb { width:100%; aspect-ratio:16/11; background:#f5f5f5; display:flex; align-items:center; justify-content:center; color:${T.sub}; font-size:11px; overflow:hidden; }
    .ep-card-body { padding:10px 12px; }
    .ep-card-name { font-size:12px; font-weight:500; margin:0 0 8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ep-card-footer { display:flex; align-items:center; justify-content:space-between; }
    .ep-card-ratio { font-size:11px; color:${T.sub}; display:flex; align-items:center; gap:3px; }
    .ep-ratio-label { margin-right:2px; }
    .ep-ratio-btn { width:18px; height:18px; border:1px solid #d6dae1; border-radius:50%; background:#fff; color:${T.primary}; font-size:13px; line-height:1; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .ep-ratio-btn:hover { background:${T.primary}; color:#fff; border-color:${T.primary}; }
    .ep-ratio-value { width:28px; text-align:center; font-size:13px; font-weight:700; color:${T.text}; font-variant-numeric:tabular-nums; border:1px solid transparent; border-radius:4px; background:transparent; padding:1px 0; font-family:${T.font}; }
    .ep-ratio-value:hover { border-color:#e0e0e0; }
    .ep-ratio-value:focus { border-color:${T.primary}; outline:none; background:#fff; }
    .ep-ratio-pct { color:${T.sub}; }
    .ep-card-menu { position:absolute; top:6px; right:6px; background:rgba(255,255,255,.9); border:none; cursor:pointer; font-size:18px; color:${T.sub}; padding:2px 6px; border-radius:4px; line-height:1; }
    .ep-card-menu:hover { background:#f0f0f0; }

    /* プリセットモーダル */
    .ep-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:9000; display:flex; align-items:center; justify-content:center; font-family:${T.font}; }
    .ep-modal { background:#fff; border-radius:10px; width:680px; max-width:92vw; max-height:85vh; display:flex; flex-direction:column; overflow:hidden; }
    .ep-modal-head { display:flex; align-items:center; padding:14px 18px; border-bottom:1px solid #eee; position:relative; }
    .ep-modal-head h2 { font-size:15px; margin:0; font-weight:600; position:absolute; left:50%; transform:translateX(-50%); white-space:nowrap; }
    .ep-modal-close { background:none; border:none; cursor:pointer; font-size:13px; color:${T.sub}; font-family:${T.font}; padding:0; }
    .ep-modal-close:hover { color:${T.text}; }
    .ep-modal-search { padding:12px 18px; }
    .ep-modal-search input { width:100%; padding:8px 12px 8px 32px; border:1px solid #ddd; border-radius:6px; font-size:13px; font-family:${T.font}; background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") 10px center no-repeat; box-sizing:border-box; }
    .ep-modal-toolbar { display:flex; align-items:center; padding:0 18px 0; gap:12px; border-bottom:1px solid #eee; }
    .ep-modal-tabs { display:flex; gap:0; }
    .ep-modal-tab { padding:10px 16px; font-size:13px; cursor:pointer; border-bottom:2px solid transparent; color:${T.sub}; background:none; border:none; border-bottom:2px solid transparent; font-family:${T.font}; }
    .ep-modal-tab.active { color:${T.text}; border-bottom-color:${T.text}; font-weight:600; }
    .ep-modal-new { margin-left:auto; font-size:12px; color:${T.primary}; background:none; border:none; cursor:pointer; font-family:${T.font}; white-space:nowrap; padding:10px 0; }
    .ep-modal-new:hover { text-decoration:underline; }
    .ep-preset-list { flex:1; overflow-y:auto; }
    .ep-preset-item { display:flex; align-items:center; gap:14px; padding:14px 18px; border-bottom:1px solid #f0f0f0; }
    .ep-preset-item:hover { background:#fafafa; }
    .ep-preset-thumb { width:100px; height:70px; background:#f5f5f5; border-radius:6px; flex-shrink:0; overflow:hidden; display:flex; align-items:center; justify-content:center; }
    .ep-preset-info { flex:1; min-width:0; }
    .ep-preset-name { font-size:13px; font-weight:600; margin:0 0 6px; line-height:1.4; }
    .ep-preset-detail { font-size:11px; color:${T.sub}; line-height:1.6; }
    .ep-preset-detail span { margin-right:16px; }
    .ep-preset-add { padding:6px 16px; font-size:12px; background:${T.primary}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-family:${T.font}; flex-shrink:0; white-space:nowrap; }
    .ep-preset-add:hover { background:${T.primaryDark}; }

    /* 編集画面 */
    .ep-editor { max-width:900px; width:100%; margin:16px auto; background:#fff; border-radius:10px; box-shadow:0 1px 4px rgba(0,0,0,.06); overflow:hidden; }
    .ep-editor-head { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid #eee; gap:12px; }
    .ep-editor-head-left { display:flex; align-items:center; gap:8px; }
    .ep-editor-name { border:1px solid #ddd; border-radius:4px; padding:6px 10px; font-size:13px; font-family:${T.font}; width:100%; }
    /* 本番準拠: 2行ヘッダ */
    .ep-editor-head-top { display:flex; align-items:center; padding:14px 20px; border-bottom:1px solid #eee; }
    .ep-editor-head-top-left { flex:1; }
    .ep-editor-head-top-center { font-size:15px; font-weight:600; }
    .ep-editor-head-top-right { flex:1; }
    .ep-editor-head-back { background:none; border:none; cursor:pointer; font-size:13px; color:${T.sub}; font-family:${T.font}; padding:0; }
    .ep-editor-head-back:hover { color:${T.text}; }
    .ep-editor-btn-bar { display:flex; align-items:center; justify-content:space-between; padding:10px 20px; border-bottom:1px solid #eee; }
    .ep-editor-btn-group { display:flex; align-items:center; gap:8px; }
    .ep-editor-btn-draft { padding:6px 14px; font-size:12px; background:#fff; color:${T.text}; border:1px solid #ddd; border-radius:4px; cursor:pointer; font-family:${T.font}; }
    .ep-editor-btn-draft:hover { background:#f5f5f5; }
    .ep-editor-btn-prod { padding:6px 14px; font-size:12px; background:${T.primary}; color:#fff; border:none; border-radius:4px; cursor:pointer; font-family:${T.font}; font-weight:600; }
    .ep-editor-btn-prod:hover { opacity:.9; }
    .ep-editor-btn-more { background:none; border:1px solid #ddd; border-radius:4px; cursor:pointer; padding:4px 8px; font-size:16px; color:${T.sub}; line-height:1; }
    .ep-editor-btn-more:hover { background:#f5f5f5; }
    /* フォーム上部: サムネイル + フィールド */
    .ep-form-top { display:flex; gap:16px; padding:16px 20px; border-bottom:1px solid #f0f0f0; }
    .ep-form-thumb { width:120px; height:126px; background:#f5f5f5; border-radius:6px; flex-shrink:0; overflow:hidden; display:flex; align-items:center; justify-content:center; color:${T.sub}; font-size:11px; position:relative; }
    .ep-form-thumb svg { width:100%; height:100%; }
    .ep-form-fields { flex:1; display:flex; flex-direction:column; gap:10px; min-width:0; }
    .ep-editor-tabs { display:flex; gap:0; border-bottom:1px solid #eee; }
    .ep-editor-tab { padding:10px 20px; font-size:13px; cursor:pointer; background:none; border:none; border-bottom:2px solid transparent; color:${T.sub}; font-family:${T.font}; }
    .ep-editor-tab.active { color:${T.primary}; border-bottom-color:${T.primary}; font-weight:600; }
    .ep-editor-body { padding:20px; min-height:200px; }
    .ep-field { margin-bottom:16px; }
    .ep-field label { display:block; font-size:12px; color:${T.sub}; margin-bottom:6px; }
    .ep-field input, .ep-field select { width:100%; padding:8px 10px; border:1px solid #ddd; border-radius:4px; font-size:13px; font-family:${T.font}; box-sizing:border-box; }
    .ep-field select { appearance:auto; }
    .ep-field textarea { width:100%; min-height:200px; padding:10px; border:1px solid #ddd; border-radius:4px; font-size:12px; font-family:monospace; box-sizing:border-box; resize:vertical; }
    .ep-row { display:flex; gap:12px; }
    .ep-row > .ep-field { flex:1; }
    .ep-toggle-row { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
    .ep-toggle-label { font-size:13px; }
    .ep-position-picker { width:200px; height:300px; background:#222; border-radius:6px; position:relative; cursor:crosshair; }
    .ep-position-dot { width:16px; height:16px; background:${T.primary}; border:2px solid #fff; border-radius:50%; position:absolute; transform:translate(-50%,-50%); box-shadow:0 1px 4px rgba(0,0,0,.3); pointer-events:none; }
    .ep-device-row { display:flex; align-items:center; gap:16px; padding:8px 0; border-bottom:1px solid #f0f0f0; }
    .ep-device-row:last-child { border-bottom:none; }
    .ep-device-name { font-size:13px; width:80px; font-weight:500; }
    .ep-html-tabs { display:flex; gap:0; margin-bottom:0; }
    .ep-html-tab { padding:8px 16px; font-size:12px; cursor:pointer; background:#2B2B2B; border:none; border-bottom:2px solid transparent; color:#888; font-family:${T.font}; }
    .ep-html-tab:first-child { border-radius:0; }
    .ep-html-tab:last-child { border-radius:0; }
    .ep-html-tab:hover { color:#ccc; }
    .ep-html-tab.active { color:#fff; border-bottom-color:#1976d2; }
    .ep-html-code-wrap { background:#151515; border-radius:0 0 4px 4px; overflow:hidden; }
    .ep-html-code-inner { display:flex; min-height:300px; }
    .ep-html-gutter { width:40px; background:#151515; border-right:1px solid #333; padding:10px 6px 10px 0; text-align:right; font:12px/1.6 "SF Mono",Menlo,monospace; color:#555; user-select:none; flex-shrink:0; overflow:hidden; }
    .ep-html-textarea { position:relative; z-index:1; width:100%; height:100%; border:none; resize:none; padding:10px 12px; font:12px/1.6 "SF Mono",Menlo,monospace; color:transparent; caret-color:#eeffff; background:transparent; outline:none; white-space:pre; tab-size:2; box-sizing:border-box; }
    /* 指示177: 透明テキスト方式なので、選択背景が不透明だと下の色付きコードが隠れる */
    .ep-html-textarea::selection { background:rgba(88,150,255,.34); color:transparent; }
    .ep-html-textarea::-moz-selection { background:rgba(88,150,255,.34); color:transparent; }
    .ep-html-editor-box { flex:1; position:relative; overflow:auto; min-height:0; background:#151515; }
    /* 指示177: inset:0 + overflow:hidden だと内容がコンテナ高さで切れ、スクロール先の行が消える */
    /* color は必須。ハイライトが取りこぼした語は span に包まれず素のまま出るので、
       これが無いと既定の黒文字がほぼ黒の地に溶ける（指示181）。 */
    .ep-html-highlight { position:absolute; top:0; left:0; min-width:100%; margin:0; padding:10px 12px; font:12px/1.6 "SF Mono",Menlo,monospace; color:#eeffff; white-space:pre; pointer-events:none; overflow:visible; tab-size:2; word-wrap:normal; }
    .ep-back-link { background:none; border:none; cursor:pointer; font-size:13px; color:${T.primary}; font-family:${T.font}; padding:0; }
    .ep-back-link:hover { text-decoration:underline; }

    /* ドロップダウンメニュー */
    .ep-dropdown { position:absolute; right:8px; top:32px; background:#fff; border-radius:6px; box-shadow:0 4px 16px rgba(0,0,0,.15); z-index:100; min-width:160px; overflow:hidden; }
    .ep-dropdown-item { display:flex; align-items:center; width:100%; padding:10px 14px; font-size:13px; text-align:left; cursor:pointer; background:none; border:none; font-family:${T.font}; color:${T.text}; gap:8px; }
    .ep-dropdown-item:hover { background:#f5f5f5; }
    .ep-dropdown-item.danger { color:#D0021B; }
  `
  document.head.append(s)
}
export function injectDesignTabCss(): void {
  if (document.getElementById('ep-design-css') !== null) return
  const s = document.createElement('style')
  s.id = 'ep-design-css'
  s.textContent = `
    .ep-design-note { font-size:12px; color:${T.sub}; line-height:1.7; margin-bottom:14px;
      background:#f5f8ff; border:1px solid #dbe7ff; border-radius:8px; padding:10px 12px; }
    .ep-design-grid { display:flex; flex-direction:column; gap:12px; }
    .ep-design-empty { font-size:13px; color:${T.sub}; padding:24px 8px; text-align:center;
      border:1px dashed #d6dae1; border-radius:8px; }
    .ep-design-card { border:1px solid #e5e5ea; border-radius:10px; padding:12px 14px; background:#fff; }
    .ep-design-card-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
    .ep-design-card-kind { font-size:11px; font-weight:700; color:#fff; background:${T.primary};
      border-radius:5px; padding:2px 8px; flex:none; }
    .ep-design-card-snippet { font-size:12px; color:${T.sub}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ep-design-row { display:flex; align-items:center; gap:10px; margin-top:8px; }
    .ep-design-label { font-size:12px; color:${T.text}; width:52px; flex:none; }
    .ep-design-input { flex:1; padding:7px 10px; border:1px solid #ddd; border-radius:6px; font-size:13px;
      font-family:${T.font}; box-sizing:border-box; }
    .ep-design-input:focus { outline:none; border-color:${T.primary}; }
    .ep-design-color { width:40px; height:28px; border:1px solid #ddd; border-radius:6px; padding:0;
      background:none; cursor:pointer; flex:none; }
    .ep-design-hex { font-size:12px; color:${T.sub}; font-variant-numeric:tabular-nums; }
  `
  document.head.append(s)
}
export function injectPositionGridCss(): void {
  if (document.getElementById('ep-pos-grid-css') !== null) return
  const s = document.createElement('style')
  s.id = 'ep-pos-grid-css'
  s.textContent = `
    .ep-pos-layout { display:flex; gap:16px; align-items:stretch; flex-wrap:wrap; }
    .ep-pos-grid { display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr);
      gap:1px; background:#1f2430; border-radius:10px; padding:1px; width:220px; height:200px; flex:none; }
    .ep-pos-cell { display:flex; align-items:center; justify-content:center; font-size:20px; color:#c7ccd6;
      background:#2a303c; border:none; cursor:pointer; transition:background .12s,color .12s; }
    .ep-pos-cell:first-child { border-top-left-radius:9px; } .ep-pos-cell:nth-child(3){ border-top-right-radius:9px; }
    .ep-pos-cell:nth-child(7){ border-bottom-left-radius:9px; } .ep-pos-cell:last-child{ border-bottom-right-radius:9px; }
    .ep-pos-cell:hover { background:#39414f; color:#fff; }
    .ep-pos-cell.active { background:${T.primary}; color:#fff; }
    .ep-pos-preview { position:relative; flex:1; min-width:220px; height:200px; border:1px solid #e5e5ea;
      border-radius:10px; background:#f7f8fa; overflow:hidden; }
    .ep-pos-preview-bar { position:absolute; width:64px; height:22px; border-radius:6px; background:${T.primary};
      box-shadow:0 2px 6px rgba(0,0,0,.15); }
  `
  document.head.append(s)
}
