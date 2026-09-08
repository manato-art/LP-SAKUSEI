/**
 * 指示178 のレポート画面リデザイン用スタイル。
 *
 * この画面だけは採取物ではなく**指定されたデザイン**で組み直している
 * （capture-and-rehydrate の例外。企画書 §11 の土台はナビ・パンくずまで）。
 *
 * 配色は指定画像から起こしたもの:
 *   ページ地  #f4f6f9 / カード #fff / 枠 #e6e9f0
 *   本文 #1f2937 / 補助 #6b7280 / 罫線 #eef1f6
 *   アクセント #2563eb（青）/ 増 #16a34a / 減 #dc2626
 */

const CSS_ID = 'sb-report-v2-css'

export function injectReportStyles(): void {
  if (document.getElementById(CSS_ID) !== null) return
  const style = document.createElement('style')
  style.id = CSS_ID
  style.textContent = `
    .rv2 {
      --rv2-bg:#f4f6f9; --rv2-card:#fff; --rv2-line:#e6e9f0; --rv2-rule:#eef1f6;
      --rv2-ink:#1f2937; --rv2-sub:#6b7280; --rv2-accent:#2563eb;
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
      border:1px solid var(--rv2-line); border-radius:8px; padding:6px 10px; background:#fff;
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
      border:1px solid #c7d7fb; background:#fff; color:var(--rv2-accent);
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
      background:#fff; color:var(--rv2-ink); border-radius:8px; padding:7px 12px;
      font:inherit; font-size:12px; cursor:pointer;
    }
    .rv2-btn:hover { background:#f7f9fc; }
    .rv2-btn.primary { background:var(--rv2-accent); border-color:var(--rv2-accent); color:#fff; }
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
      background:#f8fafc; color:#475467; font-weight:600; font-size:11px;
      border-top:1px solid var(--rv2-rule);
    }
    .rv2-table thead th.group { text-align:center; }
    .rv2-table td.num, .rv2-table th.num { text-align:right; font-variant-numeric:tabular-nums; }
    .rv2-table tbody tr:hover { background:#f9fbff; }
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
    .rv2-page.on { background:var(--rv2-accent); border-color:var(--rv2-accent); color:#fff; font-weight:700; }
    .rv2-page:disabled { opacity:.35; cursor:default; }
    .rv2-rowmenu {
      border:0; background:transparent; color:#98a2b3; cursor:pointer; font-size:14px;
      line-height:1; padding:2px 6px;
    }
    .rv2-search {
      display:flex; align-items:center; gap:6px; border:1px solid var(--rv2-line);
      border-radius:8px; padding:7px 10px; background:#fff; min-width:190px;
    }
    .rv2-search input { border:0; outline:0; font:inherit; font-size:12px; width:100%; background:transparent; }
    .rv2-note { padding:10px 14px; font-size:11px; color:var(--rv2-sub); line-height:1.8; }
  `
  document.head.append(style)
}
