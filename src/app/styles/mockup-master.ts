/**
 * モック準拠マスタースタイルシート。
 *
 * editor-mockup.html の CSS をそのまま注入する。
 * 基板 DOM にモックの class 名を付与し、モックの CSS がそのまま適用されるようにする。
 *
 * 個別の inject*Css() 関数はこのマスターが入ると冗長になるため、
 * 各関数の先頭で document.getElementById('lps-mockup-master') の存在を
 * チェックして早期リターンすること。
 */

/* ────────────────────────────────────────────
 * マスター CSS
 * editor-mockup.html lines 2-256 をそのまま転記
 * ──────────────────────────────────────────── */
const MOCKUP_CSS = `
  :root {
    --brand: #0091ff;
    --brand-light: rgba(0,145,255,.08);
    --publish: #00b341;
    --publish-hover: #009936;
    --editing: #ff8c00;
    --saved: #0091ff;
    --ground: #f5f6f8;
    --surface: #ffffff;
    --border: #e5e5ea;
    --border-light: #f0f0f2;
    --text-primary: #1a1a1a;
    --text-secondary: #666666;
    --text-tertiary: #999999;
    --text-muted: #b0b0b0;
    --sidebar-bg: #fafbfc;
    --sidebar-icon: #6b7280;
    --danger: #e5573f;
    --font: "Hiragino Sans","Hiragino Kaku Gothic ProN",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  }

  /* ── Left sidebar (60px) ── */
  .sidebar { width:60px; background:var(--surface); border-right:1px solid var(--border); display:flex; flex-direction:column; align-items:center; padding:12px 0 8px; flex-shrink:0; z-index:10; }
  .sidebar-logo { width:32px; height:32px; border-radius:8px; background:var(--brand); display:flex; align-items:center; justify-content:center; margin-bottom:16px; }
  .sidebar-logo svg { width:18px; height:18px; fill:#fff; }
  .sidebar-item { width:44px; display:flex; flex-direction:column; align-items:center; gap:2px; padding:6px 0; cursor:pointer; border-radius:6px; transition:background .12s; }
  .sidebar-item:hover { background:var(--border-light); }
  .sidebar-item svg { width:20px; height:20px; color:var(--sidebar-icon); }
  .sidebar-item span { font-size:9px; color:var(--text-tertiary); line-height:1.1; text-align:center; white-space:nowrap; }
  .sidebar-item.active { background:var(--brand-light); }
  .sidebar-item.active svg { color:var(--brand); }
  .sidebar-item.active span { color:var(--brand); }
  .sidebar-spacer { flex:1; }

  /* ── Main column ── */
  .main { flex:1; display:flex; flex-direction:column; min-width:0; }

  /* ── Top nav tabs ── */
  .topnav { height:40px; background:var(--brand); display:flex; align-items:center; padding:0 16px; flex-shrink:0; }
  .topnav-tab { padding:8px 16px; color:rgba(255,255,255,.7); font-size:13px; font-weight:500; cursor:pointer; border-radius:6px 6px 0 0; transition:color .12s,background .12s; white-space:nowrap; text-decoration:none; display:inline-block; }
  .topnav-tab:hover { color:#fff; background:rgba(255,255,255,.1); }
  .topnav-tab.active { background:var(--surface); color:var(--text-primary); }

  /* ── Header row ── */
  .header-row { height:48px; background:var(--surface); border-bottom:1px solid var(--border); display:flex; align-items:center; padding:0 12px; flex-shrink:0; gap:8px; }
  .breadcrumb { display:flex; align-items:center; gap:4px; font-size:12px; color:var(--text-secondary); flex-shrink:0; }
  .breadcrumb svg { width:14px; height:14px; color:var(--text-muted); flex-shrink:0; }
  .page-name { font-size:13px; font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:4px; flex-shrink:0; }
  .page-name .edit-icon { width:12px; height:12px; color:var(--text-muted); cursor:pointer; }
  .version-filter { display:flex; gap:0; margin-left:8px; flex-shrink:0; }
  .version-filter-btn { padding:4px 12px; font-size:11px; font-weight:500; border:1px solid var(--border); background:var(--surface); color:var(--text-secondary); cursor:pointer; font-family:var(--font); transition:background .12s,color .12s; line-height:1.4; white-space:nowrap; }
  .version-filter-btn:first-child { border-radius:4px 0 0 4px; }
  .version-filter-btn:last-child { border-radius:0 4px 4px 0; border-left:none; }
  .version-filter-btn.active { background:var(--brand); color:#fff; border-color:var(--brand); }
  .header-spacer { flex:1; }
  .save-status { display:flex; align-items:center; gap:5px; font-size:12px; color:var(--text-secondary); flex-shrink:0; }
  .save-status .check { color:var(--publish); }
  .save-status .time { color:var(--text-muted); }
  .btn-preview { display:flex; align-items:center; gap:4px; padding:5px 12px; border:1px solid var(--border); border-radius:6px; background:var(--surface); font-size:12px; color:var(--text-primary); cursor:pointer; font-weight:500; font-family:var(--font); flex-shrink:0; }
  .btn-preview:hover { background:var(--border-light); }
  .btn-publish { display:flex; align-items:center; gap:4px; padding:5px 14px; border:none; border-radius:6px; background:var(--publish); font-size:12px; color:#fff; cursor:pointer; font-weight:600; font-family:var(--font); flex-shrink:0; }
  .btn-publish:hover { background:var(--publish-hover); }
  .btn-icon { width:30px; height:30px; border:none; background:none; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:6px; color:var(--text-secondary); flex-shrink:0; }
  .btn-icon:hover { background:var(--border-light); }
  .header-sep { width:1px; height:20px; background:var(--border); flex-shrink:0; }
  .header-right-icons { display:flex; align-items:center; gap:2px; flex-shrink:0; }

  /* ── Editor body ── */
  .editor-body { flex:1; display:flex; min-height:0; }

  /* ── Version panel (260px) ── */
  .version-panel { width:260px; background:var(--surface); border-right:1px solid var(--border); display:flex; flex-direction:column; flex-shrink:0; overflow:hidden; }
  .version-header { padding:10px 12px 6px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
  .version-header h3 { font-size:13px; font-weight:600; color:var(--text-primary); }
  .version-list { flex:1; overflow-y:auto; padding:0 8px 8px; }
  .version-card { border:1px solid var(--border); border-radius:8px; padding:8px 10px; margin-bottom:8px; cursor:pointer; transition:border-color .12s,box-shadow .12s; position:relative; }
  .version-card:hover { border-color:var(--brand); box-shadow:0 0 0 1px var(--brand); }
  .version-card.active { border-color:var(--brand); box-shadow:0 0 0 2px rgba(0,145,255,.2); }
  .version-top { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
  .version-name-input { font-size:12px; font-weight:600; color:var(--text-primary); border:1px solid transparent; border-radius:3px; padding:2px 4px; background:transparent; font-family:var(--font); flex:1; min-width:0; transition:border-color .12s; }
  .version-name-input:hover { border-color:var(--border); }
  .version-name-input:focus { border-color:var(--brand); outline:none; background:var(--surface); }
  .badge { font-size:9px; font-weight:600; padding:2px 7px; border-radius:10px; white-space:nowrap; flex-shrink:0; }
  .badge-editing { background:rgba(255,140,0,.12); color:var(--editing); }
  .badge-saved { background:rgba(0,145,255,.1); color:var(--saved); }
  .version-dots { position:absolute; top:6px; right:6px; width:22px; height:22px; border:none; background:transparent; border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-muted); transition:background .12s; }
  .version-dots:hover { background:var(--border-light); color:var(--text-secondary); }
  .dots-menu { position:absolute; top:28px; right:4px; z-index:20; background:var(--surface); border:1px solid var(--border); border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,.12); padding:4px; min-width:180px; font-size:12px; }
  .dots-menu-item { padding:7px 12px; border-radius:4px; cursor:pointer; color:var(--text-primary); display:flex; align-items:center; gap:6px; }
  .dots-menu-item:hover { background:var(--border-light); }
  .dots-menu-item svg { width:14px; height:14px; color:var(--text-secondary); flex-shrink:0; }
  .dots-menu-item.danger { color:var(--danger); }
  .dots-menu-item.danger svg { color:var(--danger); }
  .dots-menu-sep { height:1px; background:var(--border-light); margin:4px 8px; }
  .version-ratio { display:flex; align-items:center; gap:4px; margin-bottom:6px; }
  .version-ratio-label { font-size:10px; color:var(--text-muted); flex-shrink:0; }
  .version-ratio-input { width:44px; height:24px; border:1px solid var(--border); border-radius:3px; font-size:11px; text-align:center; font-family:var(--font); color:var(--text-primary); font-variant-numeric:tabular-nums; }
  .version-ratio-unit { font-size:10px; color:var(--text-muted); }
  .version-thumb { width:100%; height:50px; background:var(--ground); border-radius:4px; overflow:hidden; position:relative; border:1px solid var(--border-light); }
  .version-thumb-placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
  .version-meta { display:flex; align-items:center; gap:4px; margin-top:4px; font-size:10px; color:var(--text-muted); }
  .version-meta svg { width:11px; height:11px; flex-shrink:0; }
  .version-save-btn { font-size:10px; padding:3px 8px; border:none; border-radius:4px; cursor:pointer; font-family:var(--font); font-weight:500; margin-left:auto; flex-shrink:0; }
  .version-save-btn.saved { background:rgba(0,145,255,.1); color:var(--brand); }
  .version-save-btn.unsaved { background:rgba(255,140,0,.15); color:var(--editing); }
  .version-load-more { text-align:center; padding:8px; font-size:11px; color:var(--text-muted); cursor:pointer; border:1px dashed var(--border); border-radius:6px; margin:4px 0; }
  .version-load-more:hover { color:var(--brand); border-color:var(--brand); }
  .version-add { width:100%; padding:10px; border:none; background:var(--brand); color:#fff; font-size:12px; font-weight:600; cursor:pointer; font-family:var(--font); border-radius:0; flex-shrink:0; display:flex; align-items:center; justify-content:center; gap:4px; }
  .version-add:hover { background:#007ae6; }

  /* ── Widget nav (180px, conditional) ── */
  .widget-nav { width:180px; background:var(--surface); border-right:1px solid var(--border); display:flex; flex-direction:column; flex-shrink:0; overflow-y:auto; padding:6px 0; }
  .widget-nav-header { padding:4px 10px; font-size:10px; font-weight:600; color:var(--text-tertiary); letter-spacing:.4px; }
  .widget-card { display:flex; flex-direction:column; gap:3px; padding:4px 10px; cursor:pointer; border-radius:4px; margin:0 4px; transition:background .15s; }
  .widget-card:hover { background:var(--border-light); }
  .widget-card-name { display:flex; align-items:center; gap:4px; font-size:10px; color:var(--brand); }
  .widget-card-name svg { width:12px; height:12px; flex-shrink:0; }
  .widget-card-preview { width:100%; height:40px; background:var(--ground); border:1px solid var(--border-light); border-radius:3px; overflow:hidden; }

  /* ── Canvas area ── */
  .canvas-area { flex:1; display:flex; flex-direction:column; min-width:0; background:var(--ground); position:relative; }

  /* ── URL bar ── */
  .url-bar { height:40px; background:var(--surface); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px; padding:0 12px; flex-shrink:0; overflow:hidden; }
  .url-group { display:flex; align-items:center; gap:6px; flex:1; min-width:0; }
  .url-label { font-size:10px; font-weight:600; white-space:nowrap; flex-shrink:0; letter-spacing:.2px; }
  .url-label-test { color:var(--editing); }
  .url-label-prod { color:var(--publish); }
  .url-field { flex:1; height:28px; border:1px solid var(--border); border-radius:4px; padding:0 8px; font-size:11px; color:var(--text-primary); font-family:var(--font); background:var(--ground); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; }
  .url-copy-btn { width:28px; height:28px; border:1px solid var(--border); border-radius:4px; background:var(--surface); cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-secondary); flex-shrink:0; transition:background .12s,border-color .12s; }
  .url-copy-btn:hover { background:var(--brand-light); border-color:var(--brand); color:var(--brand); }
  .url-sep { width:1px; height:20px; background:var(--border); flex-shrink:0; }

  /* ── Canvas inner ── */
  .canvas-wrap { flex:1; display:flex; min-height:0; position:relative; }
  .canvas { flex:1; overflow:auto; padding:20px; display:flex; justify-content:center; }
  .canvas-inner { width:100%; max-width:640px; background:var(--surface); border:1px solid var(--border); border-radius:4px; min-height:400px; padding:24px; position:relative; box-shadow:0 1px 4px rgba(0,0,0,.04); }

  /* ── Minimap ── */
  .minimap { position:absolute; top:0; right:0; width:36px; height:100%; background:rgba(255,255,255,.85); border-left:1px solid var(--border-light); z-index:5; display:flex; flex-direction:column; }

  /* ── Bottom bar ── */
  .bottom-bar { height:34px; background:var(--surface); border-top:1px solid var(--border); display:flex; align-items:center; padding:0 10px; flex-shrink:0; gap:4px; }
  .funnel-add-btn { padding:3px 10px; font-size:11px; border:1px solid var(--border); border-radius:4px; background:var(--surface); color:var(--text-secondary); cursor:pointer; font-family:var(--font); display:flex; align-items:center; gap:3px; }
  .funnel-add-btn:hover { background:var(--border-light); }
  .funnel-add-btn svg { width:12px; height:12px; }
  .bottom-spacer { flex:1; }
  .zoom-btn { width:20px; height:20px; border:none; background:none; color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:3px; font-size:13px; }
  .zoom-btn:hover { background:var(--border-light); }
  .zoom-label { font-size:11px; color:var(--text-secondary); min-width:34px; text-align:center; font-variant-numeric:tabular-nums; }

  /* ── Right icon rail (50px) ── */
  .icon-rail { width:50px; background:var(--sidebar-bg); border-left:1px solid var(--border); display:flex; flex-direction:column; align-items:center; padding:6px 0; gap:1px; flex-shrink:0; overflow-y:auto; }
  .rail-item { width:40px; display:flex; flex-direction:column; align-items:center; gap:1px; padding:5px 0; cursor:pointer; border-radius:5px; transition:background .12s; }
  .rail-item:hover { background:var(--border-light); }
  .rail-item svg { width:18px; height:18px; color:var(--sidebar-icon); }
  .rail-item span { font-size:7px; color:var(--text-muted); line-height:1.1; text-align:center; white-space:nowrap; }
  .rail-item.active svg { color:var(--brand); }
  .rail-item.active span { color:var(--brand); }
  .rail-spacer { flex:1; }
  .compare-btn { width:36px; height:36px; border-radius:50%; border:1px solid var(--border); background:var(--surface); cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-secondary); box-shadow:0 2px 6px rgba(0,0,0,.08); margin-top:4px; transition:border-color .12s; flex-shrink:0; }
  .compare-btn:hover { border-color:var(--brand); color:var(--brand); }
  .compare-btn svg { width:18px; height:18px; }

  /* ── Properties panel (260px) ── */
  .props-panel { width:260px; background:var(--surface); border-left:1px solid var(--border); display:flex; flex-direction:column; flex-shrink:0; overflow-y:auto; }
  .props-header { padding:10px 12px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
  .props-header h3 { font-size:12px; font-weight:600; color:var(--text-primary); }
  .props-tabs { display:flex; border-bottom:1px solid var(--border); flex-shrink:0; }
  .props-tab { flex:1; padding:9px; text-align:center; font-size:12px; font-weight:500; color:var(--text-secondary); cursor:pointer; border-bottom:2px solid transparent; transition:color .12s,border-color .12s; }
  .props-tab.active { color:var(--brand); border-bottom-color:var(--brand); }
  .props-body { padding:12px; display:flex; flex-direction:column; gap:12px; }
  .prop-group { display:flex; flex-direction:column; gap:5px; }
  .prop-group-title { font-size:10px; font-weight:700; color:var(--text-primary); letter-spacing:.3px; }
  .prop-row { display:flex; align-items:center; gap:6px; }
  .prop-label { font-size:11px; color:var(--text-secondary); width:54px; flex-shrink:0; }
  .prop-input { flex:1; height:28px; border:1px solid var(--border); border-radius:4px; padding:0 6px; font-size:11px; color:var(--text-primary); font-family:var(--font); outline:none; background:var(--surface); }
  .prop-input:focus { border-color:var(--brand); }
  .prop-toggle { width:34px; height:18px; border-radius:9px; border:none; background:var(--border); position:relative; cursor:pointer; transition:background .2s; flex-shrink:0; }
  .prop-toggle.on { background:var(--brand); }
  .prop-toggle::after { content:''; position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:#fff; transition:left .2s; box-shadow:0 1px 2px rgba(0,0,0,.2); }
  .prop-toggle.on::after { left:18px; }

  /* ══════════════════════════════════════════
   * 基板 DOM → モック class マッピング
   * 基板要素のスタイルを上書きして
   * モック準拠にする（!important で基板CSSに勝つ）
   * ══════════════════════════════════════════ */

  /* editorWrapper → editor-body */
  [class*="_editorWrapper_"] {
    flex: 1 !important;
    display: flex !important;
    min-height: 0 !important;
    overflow: hidden !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    align-self: stretch !important;
  }

  /* Version パネル */
  [class*="_abTestArticlesWrapper_"] {
    width: 260px !important;
    min-width: 260px !important;
    flex-shrink: 0 !important;
    background: var(--surface) !important;
    border-right: 1px solid var(--border) !important;
    border-radius: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
  }

  /* Version ヘッダー */
  [class*="_abTestArticlesTop"] {
    padding: 10px 12px 6px !important;
    min-height: 0 !important;
    height: auto !important;
    overflow: visible !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
  }

  /* キャンバスエリア */
  .quillEditorContentWrapper {
    flex: 1 !important;
    display: flex !important;
    flex-direction: column !important;
    min-width: 0 !important;
    background: var(--ground) !important;
    position: relative !important;
    border-radius: 0 !important;
  }
  .quillEditorContentWrapper .ql-container {
    flex: 1 !important;
    overflow: auto !important;
    padding: 20px !important;
    display: block !important;
    background: transparent !important;
  }
  .quillEditorContentWrapper .ql-editor {
    max-width: 640px !important;
    margin: 0 auto !important;
    background: var(--surface) !important;
    border: 1px solid var(--border) !important;
    border-radius: 4px !important;
    min-height: 400px !important;
    padding: 24px !important;
    box-shadow: 0 1px 4px rgba(0,0,0,.04) !important;
  }

  /* アイコンレール */
  [class*="_sideToolbarWrapper_"] {
    width: 50px !important;
    background: var(--sidebar-bg) !important;
    border-left: 1px solid var(--border) !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    padding: 6px 0 !important;
    gap: 1px !important;
    flex-shrink: 0 !important;
    align-self: stretch !important;
    height: auto !important;
    overflow-y: auto !important;
  }
  /* 基板の各アイコン: サイズ・余白を統一 */
  [class*="_sideToolbarIcon_"] {
    width: 40px !important;
    height: auto !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 2px !important;
    padding: 5px 0 !important;
    cursor: pointer !important;
    border-radius: 5px !important;
    background: none !important;
    background-color: transparent !important;
    box-shadow: none !important;
  }
  [class*="_sideToolbarIcon_"]:hover {
    background: var(--border-light) !important;
  }
  /* プレビューアイコンのオレンジ背景を削除 */
  [class*="_preview_"][class*="_sideToolbarIcon_"],
  [class*="_sideToolbarIcon_"][class*="_preview_"] {
    background: none !important;
    background-color: transparent !important;
  }
  /* 基板アイコンの ::before/::after 装飾（丸背景など）を削除 */
  [class*="_sideToolbarIcon_"]::before,
  [class*="_sideToolbarIcon_"]::after {
    display: none !important;
  }
  /* モック差し替えSVGのサイズ統一 */
  [class*="_sideToolbarIcon_"] [data-rail-svg] svg {
    width: 18px !important;
    height: 18px !important;
    color: var(--sidebar-icon) !important;
  }
  /* テキストラベル */
  [class*="_sideToolbarIcon_"] .sb-side-label {
    font-size: 8px !important;
    color: var(--text-muted) !important;
    line-height: 1.1 !important;
    text-align: center !important;
    white-space: nowrap !important;
  }

  /* ボトムバー */
  [class*="_funnelStepWrapper_"] {
    height: 34px !important;
    background: var(--surface) !important;
    border-top: 1px solid var(--border) !important;
    display: flex !important;
    align-items: center !important;
    padding: 0 10px !important;
    flex-shrink: 0 !important;
    gap: 4px !important;
    overflow: hidden !important;
  }

  /* 基板の不要要素を隠す */
  [class*="_editorWrapper_"] > [class*="_dropdown_"],
  [class*="_funnelStepWrapper_"] > [class*="_lightTheme_"],
  [class*="_navArticleItems_"],
  [class*="_actionItems_"],
  [class*="_currentAbTest_"],
  [class*="_editorToolbarWrapper_"],
  [class*="_saveAnimation_"] {
    display: none !important;
  }
  [class*="_navArticleWrapper_"] {
    padding-top: 0 !important;
    border-bottom: none !important;
  }

  /* アイコンレール内のアイコンスタイル */
  [class*="_sideToolbarIcon_"]::before,
  [class*="_sideToolbarIcon_"]::after {
    display: none !important;
  }
  [class*="_sideToolbarIcon_"] {
    background: none !important;
    background-color: transparent !important;
    border-radius: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 2px !important;
    height: auto !important;
    padding: 4px 0 !important;
  }
  [class*="_sideToolbarIcon_"] img[class*="_icon_"] {
    width: 22px !important;
    height: 22px !important;
  }
  [class*="_sideToolbarTop_"] {
    gap: 4px !important;
  }
  [class*="_sideToolbarIcon_"] [aria-label="Widget管理"] {
    height: auto !important;
    padding: 4px !important;
  }
  .sb-side-label {
    font-size: 9px;
    color: var(--text-secondary);
    line-height: 1.1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 48px;
  }

  /* 基板リンクコンテナを隠す（タブバーに新DOM版あり） */
  [class*="_linksContainer_"], [class*="_links_dcd38"] {
    display: none !important;
  }
`

/**
 * モック準拠マスタースタイルシートを注入する。
 * 1回だけ実行。2回目以降は何もしない。
 */
export function injectMockupMasterStyles(): void {
  if (document.getElementById('lps-mockup-master') !== null) return
  const style = document.createElement('style')
  style.id = 'lps-mockup-master'
  style.textContent = MOCKUP_CSS
  document.head.append(style)
}

/**
 * 基板 DOM 要素にモックの class 名を付与する。
 * renderEditor() の中で DOM 構築後に1回呼ぶ。
 */
export function applyMockupClasses(root: HTMLElement): void {
  // Version パネル上部に「Version」ヘッダーを追加
  const articlesTop = root.querySelector<HTMLElement>('[class*="_abTestArticlesTop"]')
  if (articlesTop !== null && articlesTop.querySelector('[data-version-panel-header]') === null) {
    articlesTop.innerHTML = ''
    const vhdr = document.createElement('h3')
    vhdr.setAttribute('data-version-panel-header', 'true')
    vhdr.textContent = 'Version'
    vhdr.style.cssText = 'font-size:13px;font-weight:600;color:var(--text-primary);margin:0'
    articlesTop.append(vhdr)
  }
}
