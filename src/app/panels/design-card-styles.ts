/**
 * 「要素ごとに編集」カードの見た目（離脱防止ポップアップのデザインタブと Widget編集で共通）。
 *
 * 2つの編集画面を同じ見た目にするため、ルールはここ1か所に置く（本人指定「離脱防止ポップみたいに」）。
 * どちらの画面も、自分の <style> の中にこの文字列を差し込んで使う。
 */
import { T } from '../ui.ts'

export function designCardCss(): string {
  return `
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
}
