/**
 * LPエディタ画面に流し込むCSS（editor.ts から分離）。
 *
 * どれも「1回だけ <style> を差し込む」だけの関数で、状態も引数も持たない。
 * editor.ts に置いておくと本体の処理がCSS文字列に埋もれるのでここへ移した。
 *
 * `lps-mockup-master` が既にある場合に降りるものがあるのは、
 * モックアップ用のマスタースタイルが入っているときは
 * そちらを勝ちにするため（採取物のCSSと二重に当てない）。
 */

/** .ql-editor のスクロールを無効化し、host (.ql-container) に一本化する CSS を1回だけ注入 */
export function injectQuillScrollFix(): void {
  if (document.getElementById('sb-quill-scroll-fix') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-quill-scroll-fix'
  style.textContent = [
    '.ql-editor { height: auto !important; overflow-y: visible !important; }',
    /* スクロールバーを常時表示（macOS のオーバーレイ自動非表示を上書き） */
    '.quillEditorContentWrapper .ql-container { overflow-y: scroll !important; }',
    '.quillEditorContentWrapper .ql-container::-webkit-scrollbar { width: 8px; }',
    '.quillEditorContentWrapper .ql-container::-webkit-scrollbar-track { background: #f5f6f8; }',
    '.quillEditorContentWrapper .ql-container::-webkit-scrollbar-thumb { background: #c0c0c0; border-radius: 4px; }',
    '.quillEditorContentWrapper .ql-container::-webkit-scrollbar-thumb:hover { background: #999; }',
  ].join('\n')
  document.head.append(style)
}
/**
 * エディタ領域のカードを隙間なくつなげるCSS。
 * navWrapper / editorWrapper / versionPanel / contentWrapper を白背景で一体化。
 */
export function injectCardSeamStyles(): void {
  if (document.getElementById('lps-mockup-master') !== null) return
  if (document.getElementById('sb-card-seam-css') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-card-seam-css'
  style.textContent = `
    /* ── カード接続: 隙間を白で埋める ── */
    /* contentWrapper: モック準拠でグレー背景 + 角丸外す */
    .quillEditorContentWrapper {
      border-radius: 0 !important;
      background: #f5f6f8 !important;
      position: relative !important;
      display: flex !important;
      flex-direction: column !important;
    }
    /* Quillコンテナ: グレー背景内の白カード（モック .canvas-inner） */
    .quillEditorContentWrapper .ql-container {
      flex: 1 !important;
      overflow: auto !important;
      padding: 20px !important;
      display: flex !important;
      justify-content: center !important;
      background: transparent !important;
    }
    .quillEditorContentWrapper .ql-editor {
      width: 100% !important;
      max-width: 640px !important;
      background: #fff !important;
      border: 1px solid #e5e5ea !important;
      border-radius: 4px !important;
      min-height: 400px !important;
      padding: 24px !important;
      box-shadow: 0 1px 4px rgba(0,0,0,.04) !important;
    }
    /* ヘッダ画像の角丸も上部を外す */
    [class*="_articleHeaderPhoto_"] {
      border-radius: 0 !important;
    }
    /* ヘッダー画像が入った時の青い点線枠(内側のsample_token)を消す */
    [class*="_articleHeaderPhoto_"]:has(img[data-clone-header]) {
      border: none !important;
      padding: 0 !important;
      outline: none !important;
    }
    [class*="_articleHeaderPhoto_"]:has(img[data-clone-header]) [class*="sample_token"] {
      display: none !important;
    }
    /* Versionパネルの角丸を外す + 右に区切り線 + 幅260px（モック準拠） */
    [class*="_abTestArticlesWrapper_"] {
      border-radius: 0 !important;
      border-right: 1px solid #e5e5ea;
      width: 260px !important;
      min-width: 260px !important;
      flex-shrink: 0 !important;
    }
    /* sideToolbarWrapper: 上揃え横中央 — 採取CSSの margin-top:-20px / justify-content:center を打ち消す */
    [class*="_sideToolbarWrapper_"] {
      background: #fafbfc !important;
      border-left: 1px solid #e5e5ea !important;
      align-self: stretch !important;
      height: 100% !important;
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      padding: 8px 0 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: flex-start !important;
      box-sizing: border-box !important;
    }
    /* editorWrapper: 高さをフルに伸ばす + 幅を親に合わせる（基板のmax-width:1100pxを解除） */
    [class*="_editorWrapper_"] {
      flex: 1 !important;
      min-height: 0 !important;
      overflow: hidden !important;
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      align-self: stretch !important;
    }
    /* 基板の浮遊ドロップダウンを非表示（パネルで使われるものは除く） */
    [class*="_editorWrapper_"] > [class*="_dropdown_"]:not([data-clone-panel-host]) {
      display: none !important;
    }
    /* 指示109: 全パネルを白基調に（_darkTheme_ を上書き） */
    [class*="_darkTheme_x4j8w_"] ._bodyWrapper_x4j8w_8 ._body_x4j8w_8,
    ._darkTheme_x4j8w_116 ._bodyWrapper_x4j8w_8 ._body_x4j8w_8 {
      background-color: #fff !important;
      color: #1a1a1a !important;
      box-shadow: 0 4px 24px rgba(0,0,0,.12) !important;
      border: 1px solid #e5e5ea !important;
      border-radius: 8px !important;
    }
    [class*="_darkTheme_x4j8w_"] ._bodyWrapper_x4j8w_8 [class*="_arrow_x4j8w_"],
    ._darkTheme_x4j8w_116 ._bodyWrapper_x4j8w_8 [class*="_arrow_x4j8w_"] {
      border-color: #fff transparent transparent !important;
    }
    /* 指示109: モーダル系パネル（タグ設定等）も白基調に */
    ._modal_11n4w_1._darkTheme_11n4w_23 {
      background-color: #fff !important;
      color: #1a1a1a !important;
    }
    ._modal_11n4w_1._darkTheme_11n4w_23 select,
    ._modal_11n4w_1._darkTheme_11n4w_23 textarea,
    ._modal_11n4w_1._darkTheme_11n4w_23 input {
      background-color: #fff !important;
      color: #1a1a1a !important;
      border: 1px solid #e5e5ea !important;
    }
    ._modal_11n4w_1._darkTheme_11n4w_23 label {
      color: #1a1a1a !important;
    }
    ._modal_11n4w_1._darkTheme_11n4w_23 [class*="_modalHeader_"] {
      background-color: #fff !important;
      color: #1a1a1a !important;
      border-bottom: 1px solid #e5e5ea !important;
    }
    /* ── 基板DOMの漏れ要素を確実に隠す ── */
    /* 基板の作成中/アーカイブ済みフィルタ（新規DOMで置換済み） */
    [class*="_navArticleItems_"],
    [class*="_actionItems_"] {
      display: none !important;
    }
    /* 基板のLP情報行（パンくずで置換済み） */
    [class*="_currentAbTest_"] {
      display: none !important;
    }
    /* navArticleWrapper の余白を詰める */
    [class*="_navArticleWrapper_"] {
      padding-top: 0 !important;
      border-bottom: none !important;
    }
    /* ボトムバー（funnelStepWrapper）: モック準拠で白背景 + 上ボーダー + 34px高 */
    [class*="_funnelStepWrapper_"] {
      height: 34px !important;
      background: #fff !important;
      border-top: 1px solid #e5e5ea !important;
      overflow: hidden !important;
    }
    /* funnelStepWrapper内の溢れドロップダウンを非表示 */
    [class*="_funnelStepWrapper_"] > [class*="_lightTheme_"] {
      display: none !important;
    }
  `
  document.head.append(style)
}
/**
 * 右レール（_sideToolbarWrapper_）のスタイル。
 * 丸い背景は削除し、各アイコンの下にテキストラベルを表示する（指示78）。
 */
export function injectSideToolbarStyles(): void {
  if (document.getElementById('lps-mockup-master') !== null) return
  if (document.getElementById('sb-side-toolbar-fix') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-side-toolbar-fix'
  style.textContent = `
    /* 指示78: 丸い背景を完全に削除 */
    [class*="_sideToolbarIcon_"]::before,
    [class*="_sideToolbarIcon_"]::after {
      display: none !important;
    }
    [class*="_sideToolbarIcon_"] {
      background: none !important;
      background-color: transparent !important;
      border-radius: 0 !important;
    }
    /* アイコン画像サイズを揃える */
    [class*="_sideToolbarIcon_"] img[class*="_icon_"] {
      width: 22px !important;
      height: 22px !important;
    }
    /* アイコン間の縦余白 + 上揃え・横中央 */
    [class*="_sideToolbarTop_"] {
      gap: 4px !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: flex-start !important;
      padding-top: 0 !important;
      width: 100% !important;
    }
    /* 採取CSSの _sideToolbarIcon_ height:50px / justify-content:center を完全に打ち消す */
    [class*="_sideToolbarWrapper_"] [class*="_sideToolbarTop_"] [class*="_sideToolbarIcon_"] {
      height: auto !important;
      justify-content: center !important;
      position: static !important;
    }
    /* アイコン + テキストラベルを縦に並べる */
    [class*="_sideToolbarIcon_"] {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 2px !important;
      height: auto !important;
      padding: 4px 0 !important;
    }
    /* 指示87: Widget管理のMUIボタンが50px固定でラベルを押し出すのを修正 */
    [class*="_sideToolbarIcon_"] [aria-label="Widget管理"] {
      height: auto !important;
      padding: 4px !important;
    }
    /* テキストラベル */
    .sb-side-label {
      font-size: 9px;
      color: #666;
      line-height: 1.1;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 48px;
    }
  `
  document.head.append(style)
}
export function injectHeaderExtrasCss(): void {
  if (document.getElementById('lps-mockup-master') !== null) return
  if (document.getElementById('sb-header-extras-css') !== null) return
  const s = document.createElement('style')
  s.id = 'sb-header-extras-css'
  s.textContent = `
    .sb-header-page-name {
      display:flex; align-items:center; gap:4px;
      font-size:13px; font-weight:600; color:#1a1a1a;
      flex-shrink:0; margin-left:8px;
    }
    .sb-header-save-status {
      display:flex; align-items:center; gap:5px;
      font-size:12px; color:#666; flex-shrink:0;
    }
    .sb-header-sep {
      width:1px; height:20px; background:#e5e5ea; flex-shrink:0;
    }
    .sb-header-btn-preview {
      display:flex; align-items:center; gap:4px;
      padding:5px 12px; border:1px solid #e5e5ea; border-radius:6px;
      background:#fff; font-size:12px; color:#1a1a1a; cursor:pointer;
      font-weight:500; font-family:inherit; flex-shrink:0;
      transition:background .12s;
    }
    .sb-header-btn-preview:hover { background:#f0f0f2; }
    .sb-header-btn-publish {
      display:flex; align-items:center; gap:4px;
      padding:5px 14px; border:none; border-radius:6px;
      background:#00b341; font-size:12px; color:#fff; cursor:pointer;
      font-weight:600; font-family:inherit; flex-shrink:0;
      transition:background .12s;
    }
    .sb-header-btn-publish:hover { background:#009936; }
    .sb-header-btn-icon {
      width:30px; height:30px; border:none; background:none; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      border-radius:6px; color:#666; flex-shrink:0;
      transition:background .12s;
    }
    .sb-header-btn-icon:hover { background:#f0f0f2; }
    .sb-header-right-icons {
      display:flex; align-items:center; gap:2px; flex-shrink:0;
    }
  `
  document.head.append(s)
}
/** アクティブ表示に使う実CSSクラス（採取物のクラス。書き換えていない） */
export const ACTIVE_CARD_CLASS = '_active_1xibh_202'

/** バージョンカードのCSS（スクリーンショット準拠）を注入する */
export function injectVersionCardCss(): void {
  if (document.getElementById('sb-version-card-css') !== null) return
  const s = document.createElement('style')
  s.id = 'sb-version-card-css'
  s.textContent = `
    /* ── カード外枠 ── */
    ._currentVersion_vc {
      border:2px solid #e5e5ea;
      border-radius:12px;
      padding:14px;
      margin-bottom:10px;
      transition:border-color .15s,box-shadow .15s;
      position:relative;
      background:#fff;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,
        "Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;
    }
    ._currentVersion_vc:hover {
      border-color:var(--sb-accent, #0091FF);
    }
    ._currentVersion_vc.${ACTIVE_CARD_CLASS} {
      border-color:var(--sb-accent, #0091FF);
      box-shadow:0 0 0 3px rgba(0,145,255,.15);
    }
    /* ── Version名行 ── */
    .sb-vc-name-row {
      display:flex;align-items:center;gap:8px;margin-bottom:10px;
    }
    .sb-vc-name {
      flex:1;min-width:0;font-size:16px;font-weight:700;color:#1a1a1a;
      border:1px solid transparent;border-radius:4px;padding:2px 4px;
      background:transparent;outline:none;font-family:inherit;
      transition:border-color .12s;
    }
    .sb-vc-name:hover { border-color:#e5e5ea; }
    .sb-vc-name:focus { border-color:var(--sb-accent, #0091FF);background:#fff; }
    /* ── バッジ ── */
    .sb-vc-badge {
      font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;
      white-space:nowrap;flex-shrink:0;
    }
    .sb-vc-badge--editing { background:rgba(255,140,0,.15);color:#ff8c00; }
    .sb-vc-badge--saved   { background:rgba(0,145,255,.1);color:var(--sb-accent, #0091FF); }
    /* ── 配信割合（SB実物準拠: アイコン+説明 / −数値%+ / セレクト+保存） ── */
    .sb-vc-ratio-row {
      display:flex;flex-direction:column;gap:10px;margin-bottom:10px;
    }
    /* Row1: アイコン + タイトル + 説明 */
    .sb-vc-ratio-header { display:flex;align-items:flex-start;gap:8px; }
    .sb-vc-ratio-icon {
      width:24px;height:24px;border-radius:50%;background:var(--sb-accent, #0091FF);
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
    }
    .sb-vc-ratio-headtext { min-width:0; }
    .sb-vc-ratio-title { font-size:14px;font-weight:700;color:#1a1a1a;line-height:1.3; }
    .sb-vc-ratio-desc { font-size:11px;color:#9e9e9e;line-height:1.4;margin-top:2px; }
    /* Row2: − 数値 % + プルダウン 保存（1行） */
    .sb-vc-ratio-control {
      display:flex;align-items:center;gap:6px;flex-wrap:nowrap;
      background:#f5f6f8;border-radius:24px;padding:6px 10px;
    }
    .sb-vc-ratio-input { display:none; }
    .sb-vc-ratio-btn {
      width:26px;height:26px;border-radius:50%;border:1px solid #e5e5ea;
      background:#fff;color:#1a1a1a;font-size:15px;font-weight:600;line-height:1;
      cursor:pointer;display:flex;align-items:center;justify-content:center;
      padding:0;flex-shrink:0;font-family:inherit;transition:background .12s;
    }
    .sb-vc-ratio-btn:hover { background:#f0f0f2; }
    .sb-vc-ratio-btn--plus { border-color:var(--sb-accent, #0091FF);background:var(--sb-accent, #0091FF);color:#fff; }
    .sb-vc-ratio-btn--plus:hover { opacity:.88; }
    .sb-vc-ratio-display {
      font-size:18px;font-weight:700;color:#1a1a1a;min-width:1.6em;
      text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap;
    }
    .sb-vc-ratio-pct { font-size:13px;color:#666; }
    .sb-vc-ratio-select {
      border:1px solid #e5e5ea;border-radius:6px;padding:3px 6px;
      font-size:12px;color:#1a1a1a;background:#fff;font-family:inherit;
      cursor:pointer;outline:none;margin-left:auto;
    }
    .sb-vc-ratio-select:focus { border-color:var(--sb-accent, #0091FF); }
    /* 保存状態は下部タイムスタンプで表示 */
    /* ── サムネイル ── */
    .sb-vc-thumb {
      width:100%;height:80px;background:#f5f6f8;border-radius:6px;
      overflow:hidden;position:relative;border:1px solid #f0f0f2;
      margin-bottom:8px;
    }
    .sb-vc-thumb-placeholder {
      width:100%;height:100%;display:flex;align-items:center;
      justify-content:center;color:#b0b0b0;font-size:10px;
    }
    /* ── タイムスタンプ ── */
    .sb-vc-meta {
      display:flex;align-items:center;gap:4px;
      font-size:10px;color:#b0b0b0;
    }
    /* ── ⋮ メニュー（name行内・ホバー時のみ表示） ── */
    .sb-vc-dots-area {
      position:static !important;
      padding:0 !important;flex-shrink:0;
      opacity:0;transition:opacity .12s;
    }
    ._currentVersion_vc:hover .sb-vc-dots-area { opacity:1; }
    .sb-vc-dots-area button.css-3tls8 {
      position:static !important;
      width:22px !important;height:22px !important;
      border:none !important;background:transparent !important;
      border-radius:4px !important;cursor:pointer !important;
      color:#b0b0b0 !important;transition:background .12s !important;
    }
    .sb-vc-dots-area button.css-3tls8:hover {
      background:#f0f0f2 !important;color:#666 !important;
    }
    /* ── Version追加ボタン（削除済み・採取CSSの残留を打ち消す） ── */
    [data-test="Article-BtnCreateNewArticle"] {
      display:none !important;
    }
    /* ── 「さらに読み込む」カード（カード一覧末尾） ── */
    .sb-vc-load-more {
      border:2px dashed #d0d0d5 !important;border-radius:12px !important;
      background:#fff !important;padding:14px !important;
      display:flex !important;align-items:center !important;justify-content:center !important;
      gap:6px !important;cursor:pointer !important;
      margin:8px 8px 12px !important;
      transition:border-color .15s,background .12s !important;
    }
    .sb-vc-load-more:hover {
      background:#fafafa !important;border-color:#b0b0b5 !important;
    }
    /* ── Versionパネル全体 ── */
    [class*="_abTestArticlesWrapper_"] { background:#fff !important; }
    /* ── ボタン削除後の空白を消す: 採取CSSの height:calc(100%-60px) → 100% ── */
    .sample_token_65304e81 {
      height:100% !important;
    }
    [class*="_abTestArticlesLists_"] {
      height:100% !important;
      overflow:visible !important;
    }
  `
  document.head.append(s)
}
/** CSS を1回だけ注入（Versionフィルタ用） */
export function injectVersionFilterCss(): void {
  if (document.getElementById('lps-mockup-master') !== null) return
  if (document.getElementById('sb-version-filter-css') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-version-filter-css'
  style.textContent = `
    .sb-version-filter-wrap {
      display: flex;
      gap: 0;
      flex-shrink: 0;
    }
    .sb-version-filter {
      display: inline-block;
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 500;
      color: #666;
      border: 1px solid #e5e5ea;
      background: #fff;
      cursor: pointer;
      line-height: 1.4;
      transition: color 0.15s, background 0.15s, border-color 0.15s;
      white-space: nowrap;
      font-family: inherit;
    }
    .sb-version-filter:first-child {
      border-radius: 4px 0 0 4px;
    }
    .sb-version-filter:last-child {
      border-radius: 0 4px 4px 0;
      border-left: none;
    }
    .sb-version-filter:hover {
      color: #333;
      background: #f0f0f2;
    }
    .sb-version-filter.sb-filter-active {
      background: var(--sb-accent, #0091FF);
      color: #fff;
      border-color: var(--sb-accent, #0091FF);
      font-weight: 500;
    }
  `
  document.head.append(style)
}
