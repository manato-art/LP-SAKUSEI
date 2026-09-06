/**
 * 指示116: モーダル・パネルの白基調化オーバーライド。
 *
 * ページ（レポート/ヒートマップ/切り替え/中間ページ）は report-theme.ts の
 * dark⇄light クラス入替で対応する（applyLightTheme）。
 * モーダル/パネルは入替先のライトクラスが採取CSSに無い場合があるため、
 * CSS オーバーライドで白基調を強制する。
 */

const STYLE_ID = 'sb-clone-white-base-116'

/** 白基調CSSを `<head>` に注入する（重複防止付き・初回呼び出しで1回だけ） */
export function ensureWhiteBase(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = OVERRIDES
  document.head.append(style)
}

/** 要素ツリーから _darkTheme_*_* クラスを全て除去する */
export function stripDarkThemeClasses(root: HTMLElement): void {
  for (const el of root.querySelectorAll<HTMLElement>('[class*="_darkTheme_"]')) {
    const current = el.getAttribute('class') ?? ''
    el.setAttribute('class', current.replace(/_darkTheme_\w+_\d+/g, '').replace(/\s{2,}/g, ' ').trim())
  }
}

const OVERRIDES = /* css */ `
/* ================================================
 * 指示116: 白基調オーバーライド
 * ================================================ */

/* ---- ReactModal 共通 (記事設定 / タグ設定) ---- */
.ReactModal__Content._modal_11n4w_1 {
  background: #fff !important;
  color: #333 !important;
}
.ReactModal__Content._modal_11n4w_1 ._modalHeader_11n4w_20 {
  border-bottom: 1px solid #e5e5e5;
}
.ReactModal__Content._modal_11n4w_1 ._title_11n4w_70 {
  color: #333 !important;
}
.ReactModal__Content._modal_11n4w_1 ._btnCnacel_1bcs1_140 {
  filter: invert(0.5);
}
.ReactModal__Content._modal_11n4w_1 input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]),
.ReactModal__Content._modal_11n4w_1 select {
  background: #f5f5f5 !important;
  color: #333 !important;
  border: 1px solid #d0d0d0 !important;
}
.ReactModal__Content._modal_11n4w_1 ._headingTitle_3cs34_7,
.ReactModal__Content._modal_11n4w_1 ._headingNotes_3cs34_11 {
  color: #555 !important;
}
.ReactModal__Content._modal_11n4w_1 ._description_5e523_17 {
  color: #888 !important;
}
.ReactModal__Content._modal_11n4w_1 ._btnDarkThemePrimary_1bcs1_78 {
  background: #f0960a !important;
  color: #fff !important;
  border: none !important;
}

/* ---- タグ設定 CodeMirror ---- */
.ReactModal__Content._modal_11n4w_1 .CodeMirror.cm-s-ayu-dark {
  background: #f5f5f5 !important;
  color: #333 !important;
  border: 1px solid #e0e0e0 !important;
}
.ReactModal__Content._modal_11n4w_1 .CodeMirror-gutters {
  background: #eee !important;
  border-right: 1px solid #ddd !important;
}
.ReactModal__Content._modal_11n4w_1 .CodeMirror-linenumber {
  color: #999 !important;
}
.ReactModal__Content._modal_11n4w_1 textarea[data-role="code"] {
  color: #333 !important;
}
.ReactModal__Content._modal_11n4w_1 ._scriptModalFormTitle_obetg_29 {
  color: #333 !important;
}
.ReactModal__Content._modal_11n4w_1 ._header_3cs34_72 {
  background: #f0960a !important;
  color: #fff !important;
}
.ReactModal__Content._modal_11n4w_1 ._contents_obetg_6 {
  color: #333 !important;
}
.ReactModal__Content._modal_11n4w_1 ._settings_5e523_1 {
  color: #333 !important;
}

/* ---- Widget ライブラリ (MUI Dialog) ---- */
.MuiDialog-root .MuiPaper-root {
  background: #fff !important;
  color: #333 !important;
}
.MuiDialog-root .css-xnrh4c {
  background: #f9f9f9 !important;
  color: #333 !important;
}
.MuiDialog-root .css-5v5pzb {
  background: #fff !important;
}
.MuiDialog-root .css-kzzyvh {
  color: #333 !important;
}
.MuiDialog-root .MuiCard-root {
  background: #f7f7f7 !important;
  color: #333 !important;
  border: 1px solid #e8e8e8 !important;
}
.MuiDialog-root .MuiCardHeader-title p,
.MuiDialog-root .MuiCardContent-root {
  color: #333 !important;
}
.MuiDialog-root .MuiButton-fullWidth {
  color: #f0960a !important;
}
.MuiDialog-root .MuiOutlinedInput-root {
  background: #f5f5f5 !important;
}
.MuiDialog-root .MuiOutlinedInput-root input {
  color: #333 !important;
}
.MuiDialog-root .MuiOutlinedInput-notchedOutline {
  border-color: #d0d0d0 !important;
}
.MuiDialog-root button.MuiButton-outlined {
  color: #555 !important;
  border-color: #ccc !important;
}

/* ---- リンク置換パネル ---- */
[data-clone-panel-host="link-replace"] ._bodyWrapper_x4j8w_8 {
  background: #fff !important;
  color: #333 !important;
  border: 1px solid #e0e0e0 !important;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,.12) !important;
}
[data-clone-panel-host="link-replace"] ._body_x4j8w_8 {
  background: #fff !important;
}
[data-clone-panel-host="link-replace"] ._headerTitle_id5w4_24 {
  color: #333 !important;
}
[data-clone-panel-host="link-replace"] ._tab_id5w4_28 {
  color: #999 !important;
}
[data-clone-panel-host="link-replace"] ._tab_id5w4_28._active_id5w4_48 {
  color: #f0960a !important;
  border-bottom: 2px solid #f0960a;
}
[data-clone-panel-host="link-replace"] ._sortTab_id5w4_93 {
  color: #666 !important;
  background: transparent !important;
}
[data-clone-panel-host="link-replace"] ._sortTab_id5w4_93._active_id5w4_48 {
  background: #f0960a !important;
  color: #fff !important;
}
[data-clone-panel-host="link-replace"] ._btn_id5w4_117 {
  color: #555 !important;
  background: #f0f0f0 !important;
  border: 1px solid #d0d0d0 !important;
  border-radius: 4px;
}
[data-clone-panel-host="link-replace"] input,
[data-clone-panel-host="link-replace"] select {
  background: #f5f5f5 !important;
  color: #333 !important;
  border: 1px solid #d0d0d0 !important;
}
[data-clone-panel-host="link-replace"] ._checkbox_1dpzf_16 {
  border-color: #ccc !important;
}
[data-clone-panel-host="link-replace"] ._checkboxLabel_id5w4_268 {
  color: #333 !important;
}
[data-clone-panel-host="link-replace"] ._description_1uihv_17 {
  background: #fff !important;
  color: #333 !important;
  border: 1px solid #e0e0e0 !important;
  border-radius: 6px !important;
  box-shadow: 0 2px 8px rgba(0,0,0,.1) !important;
}
[data-clone-panel-host="link-replace"] ._arrow_x4j8w_25 {
  display: none !important;
}
[data-clone-panel-host="link-replace"] ._btnReplace_id5w4_297 {
  background: #f0960a !important;
  color: #fff !important;
}
[data-clone-panel-host="link-replace"] ._btnReplace_id5w4_297._disable_1bcs1_22 {
  opacity: .4 !important;
}
[data-clone-panel-host="link-replace"] ._noLinksDescription_id5w4_411 {
  color: #999 !important;
}
[data-clone-panel-host="link-replace"] svg._light_v5c05_1 {
  fill: #888 !important;
}
/* 戻るボタン */
[data-clone-panel-host="link-replace"] .sb-clone-back-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  font: 600 13px/1 "Hiragino Sans",sans-serif;
  color: #999;
  transition: color .15s;
}
[data-clone-panel-host="link-replace"] .sb-clone-back-btn:hover {
  color: #333;
}
`
