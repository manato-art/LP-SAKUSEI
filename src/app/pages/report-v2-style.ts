/**
 * 指示178 のレポート画面リデザイン用スタイル。
 *
 * この画面だけは採取物ではなく**指定されたデザイン**で組み直している
 * （capture-and-rehydrate の例外。企画書 §11 の土台はナビ・パンくずまで）。
 *
 * 配色は指定画像から起こしたもの:
 *   ページ地  #f4f6f9 / カード #fff / 枠 #e6e9f0
 *   本文 #1f2937 / 補助 #6b7280 / 罫線 #eef1f6
 *   アクセント var(--sb-accent, #2563EB)（青）/ 増 #16a34a / 減 #dc2626
 */

const CSS_ID = 'sb-report-v2-css'

export function injectReportStyles(): void {
  if (document.getElementById(CSS_ID) !== null) return
  const style = document.createElement('style')
  style.id = CSS_ID
  style.textContent = `
    .rv2 {
      --rv2-bg:#f4f6f9; --rv2-card:#fff; --rv2-line:#e6e9f0; --rv2-rule:#eef1f6;
      --rv2-ink:#1f2937; --rv2-sub:#6b7280; --rv2-accent:var(--sb-accent, #2563EB);
      --rv2-up:#16a34a; --rv2-down:#dc2626;
      background:var(--rv2-bg); padding:16px; box-sizing:border-box;
      display:flex; flex-direction:column; gap:16px;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,
        "Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;
      color:var(--rv2-ink); font-size:13px;
    }
    .rv2-card {
      background:var(--rv2-card); border:1px solid var(--rv2-line); border-radius:10px;
      box-shadow:0 1px 2px rgba(16,24,40,.04);
    }

    /* ── フィルター行 ── */
    /* 絞り込みボタンは常に同じ行の右端に置く。項目側だけを折り返させることで、
       項目が増えてもボタンが2行目へ落ちない。 */
    .rv2-filters { display:flex; gap:10px; align-items:center; padding:12px 14px; }
    .rv2-filter-fields { display:flex; gap:10px; align-items:center; flex-wrap:wrap; flex:1 1 auto; min-width:0; }
    .rv2-field {
      display:flex; flex-direction:column; gap:2px; min-width:132px;
      border:1px solid var(--rv2-line); border-radius:8px; padding:6px 10px; background:var(--sb-c-ffffff, #FFFFFF);
    }
    .rv2-field-label { font-size:10px; color:var(--rv2-sub); }
    .rv2-field select, .rv2-field input {
      border:0; outline:0; font:inherit; font-size:12px; color:var(--rv2-ink);
      background:transparent; padding:0; width:100%;
    }
    .rv2-daterange { display:flex; align-items:center; gap:6px; }
    .rv2-daterange input { width:104px; font-variant-numeric:tabular-nums; }
    .rv2-icon { color:var(--rv2-accent); flex-shrink:0; }
    .rv2-apply {
      flex:0 0 auto; align-self:stretch; display:inline-flex; align-items:center; gap:6px;
      border:1px solid #c7d7fb; background:var(--sb-c-ffffff, #FFFFFF); color:var(--rv2-accent);
      border-radius:8px; padding:9px 16px; font:inherit; font-size:12px; font-weight:600;
      cursor:pointer;
    }
    .rv2-apply:hover { background:#f3f7ff; }

    /* ── KPIカード ── */
    .rv2-kpis { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:12px; }
    @media (max-width:1400px) { .rv2-kpis { grid-template-columns:repeat(4,minmax(0,1fr)); } }
    @media (max-width:900px)  { .rv2-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    .rv2-kpi { padding:14px; display:flex; flex-direction:column; gap:8px; }
    .rv2-kpi-top { display:flex; align-items:center; gap:8px; }
    .rv2-kpi-icon {
      width:26px; height:26px; border-radius:50%; background:#eaf1ff; color:var(--rv2-accent);
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
    }
    .rv2-kpi-label { font-size:12px; color:var(--rv2-sub); font-weight:600; }
    .rv2-kpi-value { font-size:21px; font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
    .rv2-kpi-foot { display:flex; align-items:flex-end; justify-content:space-between; gap:8px; }
    .rv2-delta { font-size:11px; font-weight:600; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .rv2-delta.up { color:var(--rv2-up); }
    .rv2-delta.down { color:var(--rv2-down); }
    .rv2-delta.flat { color:var(--rv2-sub); }
    .rv2-spark { flex:0 0 76px; height:26px; }

    /* ── セクション見出し ── */
    .rv2-head {
      display:flex; align-items:center; gap:10px; flex-wrap:wrap;
      padding:12px 14px; border-bottom:1px solid var(--rv2-rule);
    }
    .rv2-title { font-size:14px; font-weight:700; }
    /* 実物の見出しにある小さな添え字（「配信割合について」）。既存の色・文字サイズに合わせる */
    .rv2-subscript { font-size:11px; color:#98a2b3; margin-left:8px; }
    /* クリエイティブ欄の絞り込み（2026-09-15）。既存のカード内に収める見た目にする */
    .rv2-creative-filters {
      display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:10px 0 2px;
    }
    .rv2-chipgroup { display:flex; gap:4px; }
    .rv2-chip {
      border:1px solid var(--rv2-rule); background:var(--sb-c-ffffff, #FFFFFF); color:#5b6577;
      border-radius:14px; padding:4px 12px; font-size:12px; cursor:pointer; font-family:inherit;
    }
    .rv2-chip.on { border-color:var(--sb-accent, #0091FF); color:var(--sb-accent, #0091FF); }
    .rv2-datechips { flex-wrap:wrap; }
    .rv2-columnchoice { position:relative; }
    .rv2-columnchoice form { display:none; }
    .rv2-columnchoice.open form {
      display:flex; flex-direction:column; gap:6px; position:absolute; right:0; top:calc(100% + 6px);
      background:var(--sb-c-ffffff, #FFFFFF); border:1px solid var(--rv2-rule); border-radius:8px;
      padding:12px; z-index:20; box-shadow:0 6px 20px rgba(0,0,0,.12); min-width:170px;
    }
    .rv2-columnchoice form label {
      display:flex; align-items:center; gap:8px; font-size:12px; color:#5b6577; cursor:pointer;
    }
    .rv2-hint {
      width:14px; height:14px; border-radius:50%; border:1px solid #c9ced8; color:#98a2b3;
      font-size:9px; display:inline-flex; align-items:center; justify-content:center; cursor:help;
    }
    .rv2-tabs { display:flex; gap:2px; margin-left:6px; }
    .rv2-tab {
      border:0; background:transparent; font:inherit; font-size:12px; color:var(--rv2-sub);
      padding:6px 12px; cursor:pointer; border-bottom:2px solid transparent;
    }
    .rv2-tab.on { color:var(--rv2-accent); font-weight:700; border-bottom-color:var(--rv2-accent); }
    .rv2-head-right { margin-left:auto; display:flex; align-items:center; gap:8px; }
    .rv2-btn {
      display:inline-flex; align-items:center; gap:6px; border:1px solid var(--rv2-line);
      background:var(--sb-c-ffffff, #FFFFFF); color:var(--rv2-ink); border-radius:8px; padding:7px 12px;
      font:inherit; font-size:12px; cursor:pointer;
    }
    .rv2-btn:hover { background:#f7f9fc; }
    .rv2-btn.primary { background:var(--rv2-accent); border-color:var(--rv2-accent); color:#FFFFFF; }
    .rv2-btn.primary:hover { background:#1d4ed8; }

    /* ── グラフ ── */
    .rv2-chart-row { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,1fr); gap:14px; padding:14px; }
    @media (max-width:1100px) { .rv2-chart-row { grid-template-columns:minmax(0,1fr); } }
    .rv2-legend { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--rv2-sub); margin-bottom:6px; }
    .rv2-legend i { width:7px; height:7px; border-radius:50%; background:var(--rv2-accent); display:inline-block; }
    .rv2-chart { width:100%; height:150px; display:block; }
    .rv2-empty {
      border:1px solid var(--rv2-rule); border-radius:10px; background:#fbfcfe;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:6px; padding:24px; text-align:center; min-height:150px;
    }
    .rv2-empty-title { font-size:13px; font-weight:700; }
    .rv2-empty-body { font-size:11px; color:var(--rv2-sub); line-height:1.8; }

    /* ── 表 ── */
    .rv2-scroll { overflow-x:auto; }
    .rv2-table { width:100%; border-collapse:collapse; font-size:12px; }
    .rv2-table th, .rv2-table td {
      border-bottom:1px solid var(--rv2-rule); border-right:1px solid var(--rv2-rule);
      padding:9px 12px; text-align:left; white-space:nowrap;
    }
    .rv2-table th:last-child, .rv2-table td:last-child { border-right:0; }
    .rv2-table thead th {
      background:#f8fafc; color:var(--sb-c-475467, #475467); font-weight:600; font-size:11px;
      border-top:1px solid var(--rv2-rule);
    }
    .rv2-table thead th.group { text-align:center; }
    .rv2-table td.num, .rv2-table th.num { text-align:right; font-variant-numeric:tabular-nums; }
    .rv2-table tbody tr:hover { background:#f9fbff; }
    /* Version の下にぶら下がる広告パラメータの行（実物の Branch Operation と同じ並び）。
       名前を字下げして、親のVersionの内訳だと分かるようにする。 */
    .rv2-table tbody tr.rv2-sub td:first-child { padding-left:28px; color:var(--rv2-sub); }
    .rv2-table tbody tr.rv2-sub td { background:#fcfdff; }
    /* 列のチップ（配信金額 / CV / CPA / CTR / CVR）と、その中の「並び替え」。
       実物は列そのものがドロップダウンを抱えている（採取物の _column_1fhbq_39）。 */
    .rv2-colchip { position:relative; display:inline-flex; }
    .rv2-sortmenu {
      display:none; position:absolute; top:calc(100% + 6px); left:0; z-index:20; min-width:150px;
      background:#fff; border:1px solid var(--rv2-rule); border-radius:8px; padding:6px;
      box-shadow:0 6px 18px rgba(16,24,40,.12);
    }
    .rv2-colchip.open .rv2-sortmenu { display:block; }
    .rv2-sortmenu-title { font-size:11px; color:var(--rv2-sub); padding:4px 8px 6px; }
    .rv2-sortmenu-item {
      display:block; width:100%; text-align:left; border:0; background:transparent; cursor:pointer;
      font:inherit; font-size:12px; color:var(--rv2-ink); padding:7px 8px; border-radius:6px;
    }
    .rv2-sortmenu-item:hover { background:#f2f6ff; }
    /* 広告パラメータの一覧（チャートの下）と「もっと表示」 */
    .rv2-creative-params { display:flex; flex-direction:column; border-top:1px solid var(--rv2-rule); }
    .rv2-creative-param {
      display:flex; align-items:center; justify-content:space-between; gap:12px;
      padding:9px 14px; font-size:12px; border-bottom:1px solid var(--rv2-rule);
    }
    .rv2-creative-param-name { color:var(--rv2-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .rv2-creative-param-value { color:var(--rv2-ink); font-variant-numeric:tabular-nums; flex-shrink:0; }
    .rv2-readmore {
      border:0; background:transparent; color:var(--rv2-accent); font:inherit; font-size:12px;
      padding:10px; cursor:pointer;
    }
    .rv2-readmore:hover { text-decoration:underline; }
    /* Branch Operation の「フィルター」で開く面（実物と同じ5つ） */
    .rv2-branch-filter {
      display:none; flex-wrap:wrap; gap:12px; padding:12px 14px;
      border-bottom:1px solid var(--rv2-rule); background:#fbfcfe;
    }
    .rv2-branch-filter.open { display:flex; }
    .rv2-branch-field { display:flex; flex-direction:column; gap:4px; font-size:10px; color:var(--rv2-sub); }
    .rv2-branch-field select, .rv2-branch-field input {
      font:inherit; font-size:12px; color:var(--rv2-ink); background:#fff;
      border:1px solid var(--rv2-rule); border-radius:6px; padding:6px 8px; min-width:170px;
    }
    /* ファネル節（採取物 _reportWrapper_1rrna_96 と同じ組み立て） */
    .rv2-funnel { padding:12px 14px 16px; }
    .rv2-funnel-picker { margin-bottom:12px; }
    .rv2-funnel-range { font-size:11px; color:var(--rv2-sub); font-variant-numeric:tabular-nums; }
    .rv2-funnel-body { display:grid; grid-template-columns:auto auto 1fr; gap:0 16px; align-items:start; }
    .rv2-funnel-col { display:flex; flex-direction:column; min-width:0; }
    .rv2-funnel-head { font-size:11px; color:var(--rv2-sub); padding:0 0 8px; }
    .rv2-funnel-cell { height:34px; display:flex; align-items:center; font-size:12px; color:var(--rv2-ink);
      white-space:nowrap; font-variant-numeric:tabular-nums; }
    .rv2-funnel-headrow { display:flex; align-items:center; gap:14px; }
    .rv2-funnel-legends { display:inline-flex; gap:12px; }
    .rv2-funnel-legend { font-size:11px; color:var(--rv2-sub); display:inline-flex; align-items:center; gap:5px; }
    .rv2-funnel-legend::before { content:''; width:9px; height:9px; border-radius:2px; display:inline-block; }
    .rv2-funnel-legend.pv::before { background:var(--rv2-accent); }
    .rv2-funnel-legend.exit::before { background:#f0960a; }
    .rv2-funnel-bars { flex-direction:column; gap:3px; align-items:stretch; height:34px; justify-content:center; }
    .rv2-funnel-track { background:#eef2f7; border-radius:3px; height:9px; overflow:hidden; }
    .rv2-funnel-bar { height:100%; border-radius:3px; }
    .rv2-funnel-bar.pv { background:var(--rv2-accent); }
    .rv2-funnel-bar.exit { background:#f0960a; }
    .rv2-funnel-scales { display:flex; justify-content:space-between; font-size:10px;
      color:var(--rv2-sub); padding-top:6px; }
    .rv2-funnel-summary { display:flex; gap:20px; padding-top:14px; margin-top:12px;
      border-top:1px solid var(--rv2-rule); }
    .rv2-funnel-summary-item { display:flex; align-items:baseline; gap:8px; font-size:11px; color:var(--rv2-sub); }
    .rv2-funnel-summary-item b { font-size:14px; color:var(--rv2-ink); font-variant-numeric:tabular-nums; }
    .rv2-funnel-compare { padding-bottom:18px; }
    .rv2-funnel-compare-name { font-size:12px; font-weight:600; color:var(--rv2-ink); padding-bottom:8px; }
    .rv2-funnel-empty { font-size:12px; color:var(--rv2-sub); padding:16px 0; }
    .rv2-sort { cursor:pointer; user-select:none; }
    .rv2-sort:hover { color:var(--rv2-accent); }
    .rv2-sort span { color:#98a2b3; margin-left:3px; font-size:9px; }
    .rv2-sort.on span { color:var(--rv2-accent); }
    .rv2-foot {
      display:flex; align-items:center; justify-content:space-between; gap:10px;
      padding:10px 14px; font-size:11px; color:var(--rv2-sub);
    }
    .rv2-pager { display:flex; gap:4px; align-items:center; }
    .rv2-page {
      min-width:24px; height:24px; border-radius:6px; border:1px solid transparent;
      background:transparent; color:var(--rv2-sub); font:inherit; font-size:11px; cursor:pointer;
    }
    .rv2-page.on { background:var(--rv2-accent); border-color:var(--rv2-accent); color:#FFFFFF; font-weight:700; }
    .rv2-page:disabled { opacity:.35; cursor:default; }
    .rv2-rowmenu {
      border:0; background:transparent; color:#98a2b3; cursor:pointer; font-size:14px;
      line-height:1; padding:2px 6px;
    }
    .rv2-search {
      display:flex; align-items:center; gap:6px; border:1px solid var(--rv2-line);
      border-radius:8px; padding:7px 10px; background:var(--sb-c-ffffff, #FFFFFF); min-width:190px;
    }
    .rv2-search input { border:0; outline:0; font:inherit; font-size:12px; width:100%; background:transparent; }
    .rv2-note { padding:10px 14px; font-size:11px; color:var(--rv2-sub); line-height:1.8; }
  `
  document.head.append(style)
}
