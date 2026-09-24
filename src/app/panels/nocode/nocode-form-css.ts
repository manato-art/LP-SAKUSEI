/**
 * 「型から作る」の入力画面の見た目（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * 色は画面の色の変数（--sb-*）を通す（ダークモードでも読める）。LPの見え方（プレビュー）は白のまま。
 * 型の一覧や並びの入力は箱を並べず、細い線で区切る（何でも箱にしない）。
 * スマホの形は src/app/mobile/mobile-css.ts の @media の中だけに書く（PCの見た目を変えない決まり）。
 */
const STYLE_ID = 'nc-form-css'

const CSS = `
[data-nc-tab]{color:var(--sb-text,#151515);font-family:"Hiragino Sans",sans-serif}
[data-nc-tab] button{font-family:inherit}
.ncf-intro{margin:0 0 14px;font-size:14px;line-height:1.8}
.ncf-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:28px;border-top:1px solid var(--sb-line,#DDD)}
.ncf-pick{display:grid;grid-template-columns:40px minmax(0,1fr);gap:14px;align-items:center;padding:14px 10px;
  border:0;border-bottom:1px solid var(--sb-line,#DDD);background:transparent;color:inherit;text-align:left;cursor:pointer}
.ncf-pick:hover{background:var(--sb-neutral,#F4F4F4)}
.ncf-pick:focus-visible{outline:2px solid var(--sb-accent,#0091FF);outline-offset:-2px}
.ncf-pick__icon{width:40px;height:40px;border-radius:10px;background:var(--sb-accent-tint,#E6F4FF);color:var(--sb-accent,#0091FF);
  display:flex;align-items:center;justify-content:center}
.ncf-pick__icon svg{width:22px;height:22px}
.ncf-pick__name{display:block;font-size:14.5px;font-weight:700;line-height:1.5}
.ncf-pick__sum{display:block;font-size:12.5px;line-height:1.7;color:var(--sb-sub,#808080)}
.ncf-edit-root{display:flex;flex-direction:column;height:100%;min-height:0}
.ncf-top{display:flex;align-items:center;gap:10px;margin:0 0 14px;flex-shrink:0}
.ncf-top__name{font-size:15px;font-weight:700}
.ncf-seg{display:none}
.ncf-edit{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}
.ncf-form{min-width:0;min-height:0;overflow-y:auto;padding:2px 10px 12px 2px}
.ncf-preview{min-width:0;min-height:0;display:flex;flex-direction:column;gap:8px}
.ncf-preview__label{font-size:12px;color:var(--sb-sub,#808080)}
.ncf-preview__frame{flex:1;min-height:0;border:1px solid var(--sb-line,#DDD);border-radius:10px;overflow:hidden;background:#FFFFFF}
.ncf-preview__frame iframe{display:block;width:100%;height:100%;border:0;background:#FFFFFF}
.ncf-foot{display:flex;align-items:center;gap:10px;flex-shrink:0;margin-top:14px;padding-top:14px;border-top:1px solid var(--sb-line,#DDD)}
.ncf-error{flex:1;min-width:0;font-size:12.5px;line-height:1.6;color:#C0392B}
.ncf-btn{border:1px solid var(--sb-line,#DDD);background:var(--sb-surface,#FFF);color:var(--sb-text,#151515);
  border-radius:6px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
.ncf-btn:hover{background:var(--sb-neutral,#F4F4F4)}
.ncf-btn--primary{border-color:transparent;background:var(--sb-accent,#0091FF);color:var(--sb-accent-ink,#FFF)}
.ncf-btn--primary:hover{background:var(--sb-accent-dark,#0074CC)}
.ncf-btn--quiet{border-color:transparent;background:transparent;color:var(--sb-sub,#808080);padding:6px 8px}
.ncf-btn:focus-visible,.ncf-sym:focus-visible,.ncf-swatch:focus-visible,.ncf-icon-btn:focus-visible,.ncf-add:focus-visible{
  outline:2px solid var(--sb-accent,#0091FF);outline-offset:2px}
.ncf-field{margin:0 0 16px}
.ncf-label{display:block;font-size:12.5px;font-weight:700;margin:0 0 6px}
.ncf-note{display:block;font-size:11.5px;line-height:1.6;color:var(--sb-sub,#808080);margin-top:5px}
.ncf-warn{display:block;font-size:11.5px;line-height:1.6;color:#C0392B;margin-top:5px}
.ncf-input{width:100%;box-sizing:border-box;border:1px solid var(--sb-c-dcdfe5,#DCDFE5);border-radius:6px;padding:9px 11px;
  font:inherit;font-size:14px;line-height:1.6;color:var(--sb-text,#151515);background:var(--sb-surface,#FFF)}
.ncf-input:focus{outline:none;border-color:var(--sb-accent,#0091FF);box-shadow:0 0 0 3px rgba(0,145,255,.15)}
textarea.ncf-input{resize:vertical;min-height:64px}
.ncf-inline{display:flex;align-items:center;gap:8px}
.ncf-inline .ncf-input{flex:1;min-width:0}
.ncf-unit{font-size:13px;color:var(--sb-sub,#808080);flex-shrink:0}
.ncf-toggle{display:flex;align-items:center;gap:10px;font-size:13.5px;cursor:pointer}
.ncf-toggle input{width:18px;height:18px;margin:0;accent-color:var(--sb-accent,#0091FF);flex-shrink:0}
.ncf-swatches{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.ncf-swatch{width:30px;height:30px;border-radius:50%;border:0;padding:0;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
.ncf-swatch[aria-pressed="true"]{box-shadow:0 0 0 2px var(--sb-surface,#FFF),0 0 0 4px var(--sb-text,#151515)}
.ncf-swatch--none{background:linear-gradient(135deg,transparent 45%,#C0392B 45%,#C0392B 55%,transparent 55%) var(--sb-surface,#FFF)}
.ncf-custom{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--sb-sub,#808080);cursor:pointer}
.ncf-custom input{width:30px;height:30px;border:0;padding:0;background:none;cursor:pointer}
.ncf-image{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ncf-image__thumb{width:72px;height:54px;border-radius:6px;object-fit:cover;background:var(--sb-neutral,#F4F4F4);display:block}
.ncf-image__empty{width:72px;height:54px;border-radius:6px;border:1px dashed var(--sb-line,#DDD);display:flex;align-items:center;
  justify-content:center;font-size:11px;color:var(--sb-sub,#808080)}
.ncf-image__size{font-size:11.5px;color:var(--sb-sub,#808080)}
.ncf-syms{display:flex;gap:4px;flex-shrink:0}
.ncf-sym{width:34px;height:36px;border:1px solid var(--sb-c-dcdfe5,#DCDFE5);border-radius:6px;background:var(--sb-surface,#FFF);
  color:var(--sb-text,#151515);font-size:15px;cursor:pointer;padding:0}
.ncf-sym:hover{background:var(--sb-neutral,#F4F4F4)}
.ncf-listhead{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 0 6px}
.ncf-count{font-size:11.5px;color:var(--sb-sub,#808080);font-variant-numeric:tabular-nums}
.ncf-list{border-top:1px solid var(--sb-line,#DDD)}
.ncf-item{padding:12px 0 0;border-bottom:1px solid var(--sb-line,#DDD)}
.ncf-item__head{display:flex;align-items:center;gap:4px;margin:0 0 10px}
.ncf-item__name{flex:1;font-size:12.5px;font-weight:700;color:var(--sb-sub,#808080)}
.ncf-icon-btn{width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:var(--sb-sub,#808080);cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;padding:0}
.ncf-icon-btn:hover:not(:disabled){background:var(--sb-neutral,#F4F4F4);color:var(--sb-text,#151515)}
.ncf-icon-btn:disabled{opacity:.35;cursor:default}
.ncf-icon-btn svg{width:16px;height:16px}
.ncf-item__remove{width:auto;padding:0 8px;font-size:12px;font-weight:600;color:#C0392B}
.ncf-add{display:block;width:100%;margin-top:10px;border:1px dashed var(--sb-line,#DDD);border-radius:6px;background:transparent;
  color:var(--sb-accent,#0091FF);font-size:13px;font-weight:600;padding:10px 14px;cursor:pointer}
.ncf-add:disabled{color:var(--sb-sub,#808080);cursor:default}
.ncf-item__name{display:flex;align-items:center;gap:6px}
.ncf-item__icon{display:inline-flex;width:18px;height:18px;color:var(--sb-accent,#0091FF)}
.ncf-item__icon svg{width:18px;height:18px}
.ncf-adder{margin-top:12px}
.ncf-adder__label{display:block;font-size:12px;color:var(--sb-sub,#808080);margin:0 0 8px}
.ncf-adder__label--tpl{margin-top:12px}
.ncf-adder__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.ncf-adder__btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;border:1px solid var(--sb-line,#DDD);
  border-radius:8px;background:var(--sb-surface,#FFF);color:var(--sb-text,#151515);font-size:12px;font-weight:600;cursor:pointer}
.ncf-adder__btn:hover:not(:disabled){background:var(--sb-neutral,#F4F4F4);border-color:var(--sb-accent,#0091FF)}
.ncf-adder__btn:disabled{opacity:.4;cursor:default}
.ncf-adder__btn:focus-visible{outline:2px solid var(--sb-accent,#0091FF);outline-offset:2px}
.ncf-adder__icon{display:block;width:22px;height:22px;color:var(--sb-accent,#0091FF)}
.ncf-adder__icon svg{width:22px;height:22px;display:block}
.ncf-top__intro{font-size:13px;line-height:1.7;color:var(--sb-sub,#808080)}
.ncf-item__copy{width:auto;padding:0 8px;font-size:12px;font-weight:600}
.ncf-screens{padding-bottom:4px}
.ncf-screen-tabs{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 12px;scrollbar-width:thin}
.ncf-screen-tab,.ncf-screen-add{flex:0 0 auto;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.ncf-screen-tab{border:1px solid var(--sb-line,#DDD);background:var(--sb-surface,#FFF);color:var(--sb-text,#151515)}
.ncf-screen-tab[aria-selected="true"]{background:var(--sb-accent,#0091FF);border-color:var(--sb-accent,#0091FF);color:var(--sb-accent-ink,#FFF)}
.ncf-screen-add{border:1px dashed var(--sb-line,#DDD);background:transparent;color:var(--sb-accent,#0091FF)}
.ncf-screen-add:disabled{color:var(--sb-sub,#808080);cursor:default}
.ncf-screen-tab:focus-visible,.ncf-screen-add:focus-visible,.ncf-goto:focus-visible,.ncf-adder__btn:focus-visible{outline:2px solid var(--sb-accent,#0091FF);outline-offset:2px}
.ncf-screen{padding:12px 0 0;border-top:1px solid var(--sb-line,#DDD)}
.ncf-screen-head{display:grid;grid-template-columns:minmax(0,1fr);gap:4px}
.ncf-screen-head .ncf-field{margin-bottom:6px}
.ncf-screen-actions{display:flex;flex-wrap:wrap;gap:2px;margin:0 0 6px -8px}
.ncf-btn.ncf-danger{color:#C0392B}
.ncf-btn:disabled{opacity:.4;cursor:default}
.ncf-screen-note{margin:0 0 14px;font-size:12px;line-height:1.7;color:var(--sb-sub,#808080)}
.ncf-screen-note--warn{color:#9A5B00}
.ncf-sample__head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px}
.ncf-sample__title{min-width:0;font-size:13.5px;font-weight:700;overflow-wrap:anywhere}
.ncf-sample__group{margin:14px 0 6px;font-size:12px;font-weight:700;color:var(--sb-sub,#808080)}
.ncf-sample__slot{padding:10px 0 0;border-top:1px dashed var(--sb-line,#DDD)}
.ncf-sample__slot .ncf-field{margin-bottom:10px}
.ncf-goto{display:block;margin:-6px 0 14px;border:0;background:transparent;color:var(--sb-accent,#0091FF);font-size:12.5px;font-weight:700;cursor:pointer;padding:4px 0;text-align:left}
.ncf-chips{display:flex;flex-wrap:wrap;gap:6px}
.ncf-chip{max-width:100%;border:1px solid var(--sb-line,#DDD);border-radius:999px;background:var(--sb-surface,#FFF);color:var(--sb-text,#151515);
  padding:6px 12px;font-size:12.5px;font-weight:600;line-height:1.4;cursor:pointer;text-align:left;overflow-wrap:anywhere}
.ncf-chip:hover:not(:disabled){background:var(--sb-neutral,#F4F4F4)}
.ncf-chip[aria-pressed="true"],.ncf-chip[aria-pressed="true"]:hover{background:var(--sb-accent,#0091FF);border-color:var(--sb-accent,#0091FF);color:var(--sb-accent-ink,#FFF)}
.ncf-chip--add{border-style:dashed;background:transparent;color:var(--sb-accent,#0091FF)}
.ncf-chip:disabled{opacity:.4;cursor:default}
.ncf-chip:focus-visible{outline:2px solid var(--sb-accent,#0091FF);outline-offset:2px}
.ncf-sample__box{margin:0 0 8px;font-size:12.5px;font-weight:700;overflow-wrap:anywhere}
/* Widget編集の右側（2026-09-23 統合）: 部品は選んだ1つだけ広げる。頭は押せる */
.ncf-item__head[role="button"]{cursor:pointer;margin:0;padding:10px 6px;border-radius:6px}
.ncf-item__head[role="button"]:hover{background:var(--sb-neutral,#F4F4F4)}
.ncf-item__head[role="button"]:focus-visible{outline:2px solid var(--sb-accent,#0091FF);outline-offset:-2px}
.ncf-item--selected>.ncf-item__head{background:var(--sb-accent-tint,#E6F4FF)}
.ncf-item--selected>.ncf-item__head .ncf-item__name{color:var(--sb-text,#151515)}
.ncf-item__snippet{min-width:0;flex:1;font-weight:400;color:var(--sb-sub,#808080);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ncf-item__body{padding:6px 6px 4px}
.ncf-item{padding:0}
.ncf-item>.ncf-item__head{margin-bottom:0}
.ncf-item--selected{padding-bottom:8px}
.ncf-fold{margin:0 0 14px;border:1px solid var(--sb-line,#DDD);border-radius:8px;padding:0 12px}
.ncf-fold__summary{cursor:pointer;padding:10px 0;font-size:12.5px;font-weight:700;color:var(--sb-sub,#808080);list-style:none;display:flex;align-items:center;gap:8px}
.ncf-fold__summary::-webkit-details-marker{display:none}
.ncf-fold__summary::before{content:"";width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .15s;flex-shrink:0}
.ncf-fold[open]>.ncf-fold__summary{color:var(--sb-text,#151515)}
.ncf-fold[open]>.ncf-fold__summary::before{transform:rotate(45deg)}
.ncf-fold>*:not(summary){margin-top:4px}
.ncf-fold>.ncf-field:last-child,.ncf-fold>.ncf-screen-head:last-child{margin-bottom:12px}
.ncf-fold__body{padding:0 0 12px}
/* 見本の部品の「コードで直す」（色付きのコード欄を2段） */
.ncf-sample__code{display:flex;flex-direction:column;gap:10px;margin-top:8px}
.ncf-sample__code>*{height:220px;border-radius:6px;overflow:hidden}
.ncf-sample .ncf-fold{margin-top:14px}
/* 選ぶ入力の絵のタイル（2026-09-24・プルダウンをやめ、形や絵でパッと選べるように） */
.ncf-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px}
.ncf-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:62px;padding:8px 4px 6px;
  border:1px solid var(--sb-line,#DDD);border-radius:8px;background:var(--sb-surface,#FFF);color:var(--sb-sub,#6B7480);cursor:pointer;
  transition:border-color .12s,background .12s,color .12s}
.ncf-tile:hover{border-color:var(--sb-accent,#0091FF);color:var(--sb-text,#151515)}
.ncf-tile[aria-checked="true"]{border-color:var(--sb-accent,#0091FF);background:var(--sb-accent-tint,#E6F4FF);color:var(--sb-accent,#0091FF);
  box-shadow:inset 0 0 0 1px var(--sb-accent,#0091FF)}
.ncf-tile:focus-visible{outline:2px solid var(--sb-accent,#0091FF);outline-offset:2px}
.ncf-tile__icon{display:block;line-height:0}
.ncf-tile__icon svg{display:block;width:32px;height:24px}
.ncf-tile__label{font-size:11px;font-weight:600;line-height:1.3;text-align:center;overflow-wrap:anywhere}
@media (prefers-reduced-motion:reduce){.ncf-tile{transition:none}}
/* 見本の部品の文字: 「文字」はまとまりに1回。同じ行のかけらは横に並べる（2026-09-24） */
.ncf-sample__texts{display:flex;flex-direction:column;gap:6px;padding:10px 0 12px;border-top:1px dashed var(--sb-line,#DDD)}
.ncf-sample__texts>.ncf-label{margin:0 0 2px}
.ncf-sample__line{display:flex;flex-wrap:wrap;gap:6px}
.ncf-sample__line+.ncf-sample__line{margin-top:2px}
.ncf-input.ncf-sample__piece{flex:1 1 auto;width:auto;min-width:64px;padding:7px 10px;font-size:13.5px}
.ncf-input.ncf-sample__piece--long{flex-basis:100%;min-height:0;resize:vertical}
/* 白紙のときの「何から作りますか？」（以前の「型から作る」の一覧と同じ .ncf-picker） */
.ncf-start{margin:0 0 18px}
.ncf-start__title{margin:4px 0 2px;font-size:15px;font-weight:700}
.ncf-start .ncf-picker{margin-top:10px;column-gap:16px}
/* 右の列は細い（2026-09-24 画面の作り直し）ので、選べる物は1列 */
.ncf-parts-right .ncf-start .ncf-picker,[data-widget-pane="code"] .ncf-start .ncf-picker{grid-template-columns:minmax(0,1fr)}
.ncf-start .ncf-pick{padding:12px 6px}
.ncf-listhead .ncf-reset{margin-left:auto;border:0;background:transparent;color:#C0392B;font-size:12px;font-weight:600;cursor:pointer;padding:2px 4px}
.ncf-listhead .ncf-reset:hover{text-decoration:underline}
.ncf-listhead .ncf-reset:focus-visible{outline:2px solid var(--sb-accent,#0091FF);outline-offset:2px}
/* 数字の欄: 単位を左右にドラッグで増減・下にスライダー（Canva風・第2弾） */
.ncf-number{display:flex;flex-direction:column;gap:4px}
.ncf-number .ncf-input{max-width:120px}
.ncf-scrub{cursor:ew-resize;user-select:none;padding:4px 8px;border-radius:6px;border:1px dashed var(--sb-line,#DDD)}
.ncf-scrub:hover{background:var(--sb-neutral,#F4F4F4);color:var(--sb-text,#151515)}
.ncf-slider{width:100%;max-width:320px;margin:0;height:22px;accent-color:var(--sb-accent,#0091FF);cursor:pointer}
/* 部品の頭をつかんで並べ替え */
.ncf-item__head[draggable="true"]{cursor:grab}
.ncf-item--dragging{opacity:.4}
.ncf-item--drop-before{box-shadow:inset 0 3px 0 var(--sb-accent,#0091FF)}
.ncf-item--drop-after{box-shadow:inset 0 -3px 0 var(--sb-accent,#0091FF)}
/* 左の列（2026-09-24 画面の作り直し・C-1a）: 並び（頭だけ）と「部品を足す」 */
.ncf-parts .ncf-listhead{padding:0 6px;margin:0 0 4px;align-items:center}
.ncf-parts .ncf-listhead .ncf-label{font-size:12px;font-weight:700;color:var(--sb-sub,#5F6673);margin:0}
.ncf-parts .ncf-list{border-top:none;display:flex;flex-direction:column;gap:2px}
.ncf-parts .ncf-item{border-bottom:none;padding:0}
.ncf-parts .ncf-item--selected{padding-bottom:0}
.ncf-parts .ncf-item__head[role="button"]{padding:4px 4px 4px 8px;border-radius:8px;min-height:38px;box-sizing:border-box;gap:2px}
.ncf-parts .ncf-item__name{font-size:12.5px;color:var(--sb-text,#3F4450);min-width:0}
.ncf-parts .ncf-item--selected>.ncf-item__head{background:#E8F3FF}
.ncf-parts .ncf-item--selected>.ncf-item__head .ncf-item__name{color:#0060B8}
.ncf-parts .ncf-item__head .ncf-icon-btn{width:26px;height:26px;flex-shrink:0}
/* 「複製」「消す」は横書き（上の 26px 四方より強い指定にする。弱いと2文字が縦に折れていた・2026-09-24） */
.ncf-parts .ncf-item__head .ncf-item__copy,.ncf-parts .ncf-item__head .ncf-item__remove{width:auto;padding:0 8px;font-size:11.5px;white-space:nowrap}
/* 選んでいない部品の操作ボタンは、乗せたときだけ（細い列に押せないほど並べない） */
.ncf-parts .ncf-item:not(.ncf-item--selected)>.ncf-item__head:not(:hover):not(:focus-within) .ncf-icon-btn{display:none}
.ncf-parts__whole{display:block;width:100%;margin-top:8px;padding:8px 10px;border:1px dashed var(--sb-line,#D5D9DF);border-radius:8px;
  background:transparent;color:var(--sb-sub,#5F6673);font-size:12px;text-align:left;cursor:pointer}
.ncf-parts__whole[aria-pressed="true"]{border-style:solid;border-color:var(--sb-accent,#0091FF);background:#E8F3FF;color:#0060B8;font-weight:700}
.ncf-parts__whole:focus-visible{outline:2px solid var(--sb-accent,#0091FF);outline-offset:2px}
.ncf-palette{display:flex;flex-direction:column;gap:8px}
.ncf-palette__head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:0 4px}
.ncf-palette__title{font-size:12px;font-weight:700;color:var(--sb-text,#1F2430)}
.ncf-palette__title--sub{padding:6px 4px 0}
.ncf-palette__hint{font-size:11.5px;color:var(--sb-sub,#5F6673)}
.ncf-palette__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.ncf-palette__tpl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.ncf-palette__tile,.ncf-palette__chip{border:1px solid #EEF0F2;border-radius:9px;background:#FAFBFC;color:#3F4450;cursor:grab;font:inherit;
  transition:border-color .15s,background-color .15s}
.ncf-palette__tile{height:58px;padding:0 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font-size:11px}
.ncf-palette__chip{min-height:36px;padding:4px 10px;display:flex;align-items:center;gap:8px;font-size:12px;text-align:left}
.ncf-palette__tile:hover:not(:disabled),.ncf-palette__chip:hover:not(:disabled){border-color:var(--sb-accent,#0091FF);background:#F4F9FF}
.ncf-palette__tile:disabled,.ncf-palette__chip:disabled{opacity:.4;cursor:default}
.ncf-palette__tile:focus-visible,.ncf-palette__chip:focus-visible,.ncf-palette__library:focus-visible{outline:2px solid var(--sb-accent,#0091FF);outline-offset:2px}
.ncf-palette__icon{display:inline-flex;width:18px;height:18px;flex-shrink:0;color:var(--sb-accent,#0091FF)}
.ncf-palette__icon svg{width:18px;height:18px}
.ncf-palette__label{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ncf-palette--dragging{opacity:.5}
.ncf-palette__library{min-height:40px;margin-top:4px;padding:0 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;
  border:1.5px solid var(--sb-accent,#0074D9);border-radius:10px;background:#FFF;color:#0060B8;font:700 12.5px/1.3 inherit;cursor:pointer}
.ncf-palette__library::after{content:"";width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(-45deg);flex-shrink:0}
.ncf-palette__library:disabled{opacity:.4;cursor:default}
/* 部品を足す: 11個＋もっと見る（2026-09-24・本人「11個＋もっと見る。押したら同じ左の列でサムネ付きで全部」） */
.ncf-palette__tile--more{border-style:dashed;border-color:#D5D9DF;background:transparent;color:var(--sb-sub,#5F6673);cursor:pointer}
.ncf-palette__tile--more .ncf-palette__icon{color:var(--sb-sub,#5F6673)}
.ncf-palette__tile--more:hover .ncf-palette__icon{color:var(--sb-accent,#0091FF)}
/* もっと見るの間は、左の列を一覧だけにする（本人「上の部分が残って狭い」）。画面のタブと並びは「戻る」で出る。
   タブは表示を style で切り替えている（widget-studio.ts）ので !important */
[data-widget-pane="parts"]:has([data-ncf-catalog])>[data-widget-tabs],
[data-widget-pane="parts"]:has([data-ncf-catalog])>[data-widget-parts-list]{display:none !important}
[data-widget-pane="parts"]:has([data-ncf-catalog])>[data-widget-parts-palette]{border-top:0 !important}
.ncf-cat__head{display:flex;align-items:center;gap:8px;padding:0 2px 2px}
.ncf-cat__back{height:28px;display:inline-flex;align-items:center;gap:2px;padding:0 10px 0 4px;border:1px solid #E3E5E9;border-radius:8px;
  background:transparent;color:#3F4450;font:inherit;font-size:12px;cursor:pointer}
.ncf-cat__back svg{width:16px;height:16px}
.ncf-cat__back:hover{border-color:var(--sb-accent,#0091FF);color:var(--sb-accent,#0091FF)}
.ncf-cat__back:focus-visible,.ncf-cat__card:focus-visible{outline:2px solid var(--sb-accent,#0091FF);outline-offset:2px}
.ncf-cat__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.ncf-cat__card{display:flex;flex-direction:column;min-width:0;padding:0;border:1px solid #E3E6EA;border-radius:10px;background:transparent;
  overflow:hidden;cursor:grab;font:inherit;color:#3F4450;text-align:left}
.ncf-cat__card:hover:not(:disabled){border-color:var(--sb-accent,#0091FF)}
.ncf-cat__card:disabled{opacity:.4;cursor:default}
/* サムネは LP の見た目のまま（白い紙）。中身は shadow root（palette-thumbs.ts） */
.ncf-cat__thumb{height:84px;overflow:hidden;display:flex;align-items:safe center;justify-content:center;background:#FFFFFF;
  border-bottom:1px solid #EEF0F2}
.ncf-cat__name{display:flex;align-items:center;gap:6px;min-width:0;padding:7px 8px;font-size:12px;font-weight:600}
/* 並び: 移行先は、被せた部品（すぐ上）の下に一段下げる */
.ncf-parts .ncf-item--hotspot>.ncf-item__head[role="button"]{position:relative;padding-left:26px}
.ncf-parts .ncf-item--hotspot>.ncf-item__head[role="button"]::before{content:"";position:absolute;left:12px;top:8px;width:8px;height:11px;
  border-left:1.5px solid #C4C9D1;border-bottom:1.5px solid #C4C9D1;border-bottom-left-radius:4px}
/* 右の設定: 選んだ部品の名前と段（レイアウト・中身・押したとき） */
.ncf-inspector__head{display:flex;align-items:center;gap:8px;padding:2px 0 12px;border-bottom:1px solid #EEF0F2}
.ncf-inspector__icon{width:30px;height:30px;flex-shrink:0;border-radius:8px;background:#F1F2F4;display:flex;align-items:center;justify-content:center;color:#3F4450}
.ncf-inspector__icon svg{width:17px;height:17px}
.ncf-inspector__name{font-size:14px;font-weight:700;color:var(--sb-text,#1F2430);flex-shrink:0}
.ncf-inspector__snippet{flex:1;min-width:0;font-size:12px;color:var(--sb-sub,#5F6673);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ncf-fold.ncf-fold--section{margin:0;border:0;border-bottom:1px solid #EEF0F2;border-radius:0;padding:0 0 4px}
.ncf-fold--section>.ncf-fold__summary{padding:12px 0;font-size:13px;color:var(--sb-text,#1F2430)}
/* ダークの赤い文字: #C0392B は暗い地の上で読めない（実行時の上書きは彩度のある文字の色を変えないので、ここで明示する） */
html[data-theme="dark"] :is(.ncf-item__remove,.ncf-btn.ncf-danger,.ncf-error,.ncf-warn,.ncf-listhead .ncf-reset){color:#FF8A7A}
`

export function ensureNocodeFormCss(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.append(style)
}
