/**
 * スマホ用の土台CSS（2026-09-13）。
 *
 * すべて `@media (max-width: 768px)` の中だけに書く＝**PCの見た目は一切変えない**。
 * 方針（過去の指示）:
 *   - PCの縮小版にしない。縦スクロールの回数を減らす
 *   - 左右の余白を作らない（画面幅をいっぱいに使う）
 *   - タップは44px、入力の文字は16px（iOSが勝手に拡大するのを防ぐ）
 *   - ホームバーのぶんの余白（safe-area）を空ける
 */
import { PROPS_OPEN_CLASS, VERSIONS_OPEN_CLASS } from './editor-mobile.ts'
import { MOBILE_MAX_WIDTH } from './viewport.ts'

const STYLE_ID = 'sb-mobile-css'

/** 下部タブバーの高さ（本文の下余白と合わせる） */
export const BOTTOM_NAV_HEIGHT = 56

export function mobileCss(): string {
  return [
    `@media (max-width:${MOBILE_MAX_WIDTH}px){`,
    // PC用の細いレールは出さない（切れたラベルが並ぶだけで使えない）。代わりに下部タブバー。
    `.sb-rail{display:none !important}`,
    // 本文は画面幅いっぱい。下部タブバーのぶんだけ下に余白を空ける
    `.sb-shell-content{padding-bottom:calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom,0px)) !important}`,
    // 採取CSSがPC幅を前提に置いている左右余白・最大幅を外す
    `.sb-mobile-page{padding-left:0 !important;padding-right:0 !important;max-width:100% !important}`,
    // タップしやすい大きさ（Appleの目安44px）
    `.sb-mobile-tap{min-height:44px}`,
    // iOSは16px未満の入力にズームするので、拡大されないようにする
    `input,select,textarea{font-size:16px !important}`,

    // ── 画面の枠（pageShell）: 左右の余白と角丸を外して画面幅いっぱいに ──
    `.sb-page-shell{padding:14px 0 !important}`,
    `.sb-page-title,.sb-page-note{padding:0 12px}`,
    `.sb-page-card{border-radius:0 !important;padding:14px 12px !important;box-shadow:none !important}`,

    // ── 表: 1行＝1カードにする（列を横に並べても読めない）──
    // 列名は消して、セルごとに「列名 値」で出す（data-label はセルが持っている）
    `.sb-data-table{overflow-x:visible !important}`,
    `.sb-data-head{display:none !important}`,
    `.sb-data-row{display:block !important;border:1px solid var(--sb-line) !important;border-radius:10px;`,
    `background:var(--sb-surface);padding:10px 12px !important;margin-bottom:10px}`,
    `.sb-data-row>*{display:flex !important;justify-content:space-between;align-items:baseline;gap:12px;`,
    `padding:5px 0;text-align:left !important;min-width:0}`,
    `.sb-data-row>*::before{content:attr(data-label);color:var(--sb-sub);font-size:12px;flex-shrink:0}`,
    // 中身が無いセル（操作ボタン用の空き列など）は行を作らない
    `.sb-data-row>*:empty{display:none !important}`,

    // ── 数値タイルは2列（1列だと延々と縦に伸びる）──
    `.sb-kpi-grid{grid-template-columns:1fr 1fr !important}`,
    `.sb-kpi-grid>*{padding:12px !important}`,

    // ── LPエディタ: キャンバスを主役にする ──
    // PCは3つ横並びだが、375pxだとキャンバスが50pxまで潰れて編集できない。
    // Version一覧とプロパティはしまい、ボタン（editor-mobile.ts）で下から出す。
    // エディタは画面を開いたあとにCSSを注入する。あとから入った同じ強さの指定に負けるので、
    // `html body` を付けて詳細度を上げ、順番に関係なくこちらを勝たせる。
    `html body [class*="_abTestArticlesWrapper_"],html body .sb-props-panel{display:none !important}`,
    `html body.${VERSIONS_OPEN_CLASS} [class*="_abTestArticlesWrapper_"],`,
    `html body.${PROPS_OPEN_CLASS} .sb-props-panel{`,
    `display:block !important;position:fixed !important;left:0;right:0;bottom:0;top:auto !important;`,
    `width:auto !important;max-width:none !important;height:60vh !important;max-height:60vh !important;`,
    `z-index:9500;background:var(--sb-surface);border-radius:16px 16px 0 0;`,
    `box-shadow:0 -6px 24px rgba(0,0,0,.25);overflow-y:auto;`,
    `padding-bottom:calc(12px + env(safe-area-inset-bottom,0px))}`,
    // 編集ツール（アイコンレール）は画面の下に横並びで固定する
    `html body [class*="_sideToolbarWrapper_"]{position:fixed !important;left:0;right:0;bottom:0;top:auto !important;`,
    `width:auto !important;height:auto !important;display:flex !important;flex-direction:row !important;`,
    `align-items:center;gap:4px;overflow-x:auto;z-index:9400;background:var(--sb-surface);`,
    `border-top:1px solid var(--sb-line);padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px))}`,
    `html body [class*="_sideToolbarWrapper_"]>*{flex:0 0 auto}`,
    `html body [class*="_sideToolbarTop_"]{display:flex !important;flex-direction:row !important;`,
    `align-items:center;gap:2px;width:auto !important;padding:0 !important}`,
    // キャンバスは画面幅いっぱい。下のツールバーに隠れないよう余白を空ける
    `html body [class*="_editorWrapper_"]{padding:0 !important}`,
    `html body .quillEditorContentWrapper .ql-editor{max-width:100% !important;border-radius:0 !important;`,
    `padding:16px 14px 96px !important}`,
    `}`,
  ].join('')
}

/** スマホ用CSSを1回だけ差し込む */
export function ensureMobileCss(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = mobileCss()
  document.head.append(style)
}
