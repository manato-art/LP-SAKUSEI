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
.ncf-goto{display:block;margin:-6px 0 14px;border:0;background:transparent;color:var(--sb-accent,#0091FF);font-size:12.5px;font-weight:700;cursor:pointer;padding:4px 0;text-align:left}
`

export function ensureNocodeFormCss(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.append(style)
}
