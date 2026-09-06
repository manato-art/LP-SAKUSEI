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

/**
 * applyLightTheme() でクラス名入替後に呼ぶ。
 * Emotion/MUI の css-* クラスに焼きついたダーク背景を CSS override で白基調にする。
 * (旧実装は DOM 全走査 + getComputedStyle で重かった → CSS のみに切替)
 */
export function overrideDarkBackgrounds(_root: HTMLElement): void {
  // CSS override は ensureWhiteBase() の OVERRIDES に統合済み。
  // ここでは ensureWhiteBase() を呼ぶだけ（冪等・二重注入なし）。
  ensureWhiteBase()
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

/* ---- ページ共通: Emotion/MUI ダーク背景 (レポート/ヒートマップ/切り替え/中間ページ) ---- */
/* applyLightTheme() が data-clone-theme="light" を付けた後に効く */

/* MuiPaper コンテナ (黒背景) */
[data-clone-theme="light"] .css-hqu13o,
[data-clone-theme="light"] .css-86xkah {
  background-color: #fff !important;
  color: #333 !important;
}

/* MuiTableCell ヘッダ (黒背景) */
[data-clone-theme="light"] .css-viecwa,
[data-clone-theme="light"] .css-ojov2j,
[data-clone-theme="light"] .css-19s6q8y {
  background-color: #f5f5f5 !important;
  color: #333 !important;
  border-bottom-color: #e0e0e0 !important;
}
[data-clone-theme="light"] .css-19s6q8y:first-of-type,
[data-clone-theme="light"] .css-19s6q8y:last-of-type {
  background-color: #f5f5f5 !important;
}

/* MuiTableCell ボディ (黒 sticky 列) */
[data-clone-theme="light"] .css-69p2cm {
  color: #333 !important;
  border-bottom-color: #e0e0e0 !important;
}
[data-clone-theme="light"] .css-69p2cm:first-of-type,
[data-clone-theme="light"] .css-69p2cm:last-of-type {
  background-color: #fff !important;
}

/* 切り替えページ: タブバー (黒背景) */
[data-clone-theme="light"] .css-13u3ynm,
[data-clone-theme="light"] .css-1ygvyop {
  background-color: #f5f5f5 !important;
  color: #333 !important;
}

/* コンテンツパネル (暗灰 rgb(69,70,71)) */
[data-clone-theme="light"] .css-137m1kt,
[data-clone-theme="light"] .css-160345m,
[data-clone-theme="light"] .css-1q0mywx,
[data-clone-theme="light"] .css-1qivsvc,
[data-clone-theme="light"] .css-5d8qdd,
[data-clone-theme="light"] .css-gofv8i,
[data-clone-theme="light"] .css-jrygb4 {
  background-color: #fff !important;
  color: #333 !important;
}

/* 設定パネル (暗灰 rgb(55,56,56)) */
[data-clone-theme="light"] .css-14jh6n,
[data-clone-theme="light"] .css-gsltfn {
  background-color: #f5f5f5 !important;
  color: #333 !important;
}

/* MUI構造クラス (安全網: 未知のcss-*クラスもカバー) */
[data-clone-theme="light"] .MuiPaper-root {
  background-color: #fff !important;
  color: #333 !important;
}
[data-clone-theme="light"] .MuiTableCell-head {
  background-color: #f5f5f5 !important;
  color: #333 !important;
  border-bottom-color: #e0e0e0 !important;
}
[data-clone-theme="light"] .MuiTableCell-body {
  color: #333 !important;
  border-bottom-color: #e0e0e0 !important;
}
[data-clone-theme="light"] .MuiTableContainer-root {
  background-color: #fff !important;
}
[data-clone-theme="light"] .MuiTab-root {
  color: #666 !important;
}
[data-clone-theme="light"] .MuiTab-root.Mui-selected {
  color: #0091ff !important;
}
[data-clone-theme="light"] .MuiOutlinedInput-root {
  background-color: #f5f5f5 !important;
}
[data-clone-theme="light"] .MuiOutlinedInput-root input,
[data-clone-theme="light"] .MuiOutlinedInput-root select {
  color: #333 !important;
}
[data-clone-theme="light"] .MuiOutlinedInput-notchedOutline {
  border-color: #d0d0d0 !important;
}
[data-clone-theme="light"] .MuiInputLabel-root {
  color: #666 !important;
}
[data-clone-theme="light"] .MuiTypography-root {
  color: #333 !important;
}
[data-clone-theme="light"] .MuiLink-root {
  color: #0091ff !important;
}
[data-clone-theme="light"] .MuiAlert-root {
  color: #333 !important;
}
[data-clone-theme="light"] .MuiButton-outlined {
  color: #555 !important;
  border-color: #ccc !important;
}
[data-clone-theme="light"] .MuiButton-contained {
  background-color: #0091ff !important;
  color: #fff !important;
}
[data-clone-theme="light"] .MuiSelect-icon {
  color: #666 !important;
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
/* コンテンツ領域本体（rgb(55,56,56)の灰背景を白に） */
[data-clone-panel-host="link-replace"] ._replaceLinkContent_id5w4_76 {
  background-color: #f7f7f7 !important;
  color: #333 !important;
}
[data-clone-panel-host="link-replace"] ._headerTitle_id5w4_24 {
  color: #333 !important;
}
/* タブ */
[data-clone-panel-host="link-replace"] ._tab_id5w4_28 {
  color: #999 !important;
  background-color: transparent !important;
}
[data-clone-panel-host="link-replace"] ._tab_id5w4_28._active_id5w4_48 {
  color: #f0960a !important;
  background-color: #f7f7f7 !important;
  border-bottom: 2px solid #f0960a;
}
[data-clone-panel-host="link-replace"] ._tab_id5w4_28._active_id5w4_48::before,
[data-clone-panel-host="link-replace"] ._tab_id5w4_28._active_id5w4_48::after {
  display: none !important;
}
/* ソートタブ */
[data-clone-panel-host="link-replace"] ._sortTab_id5w4_93 {
  color: #666 !important;
  background: #e8e8e8 !important;
}
[data-clone-panel-host="link-replace"] ._sortTab_id5w4_93._active_id5w4_48 {
  background: #f0960a !important;
  color: #fff !important;
}
/* 全て選択/選択解除 */
[data-clone-panel-host="link-replace"] ._btn_id5w4_117 {
  color: #555 !important;
  background: #f0f0f0 !important;
  border: 1px solid #d0d0d0 !important;
  border-radius: 4px;
}
/* 入力欄・セレクト (background shorthand で image も上書き) */
[data-clone-panel-host="link-replace"] input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]),
[data-clone-panel-host="link-replace"] select {
  background: #fff !important;
  color: #333 !important;
  border: 1px solid #d0d0d0 !important;
}
/* リンク入力のアイコン背景は維持しつつ白基調に */
[data-clone-panel-host="link-replace"] ._replaceLinkInput_id5w4_246 input {
  background: url("/assets/link_gray-c566ade7.svg") left 7px center / 17px no-repeat #fff !important;
}
/* チェックボックス */
[data-clone-panel-host="link-replace"] ._checkbox_1dpzf_16 {
  border: 1px solid #ccc !important;
}
[data-clone-panel-host="link-replace"] ._checkboxLabel_id5w4_268 {
  color: #333 !important;
}
/* ツールチップ／説明文 */
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
/* 置換ボタン */
[data-clone-panel-host="link-replace"] ._btnReplace_id5w4_297 {
  background: #f0960a !important;
  color: #fff !important;
}
[data-clone-panel-host="link-replace"] ._btnReplace_id5w4_297._disable_1bcs1_22 {
  opacity: .4 !important;
}
/* 空状態テキスト */
[data-clone-panel-host="link-replace"] ._noLinksDescription_id5w4_411 {
  color: #999 !important;
}
/* リンク行 (採取できた場合の安全網) */
[data-clone-panel-host="link-replace"] ._targetLinkList_id5w4_134 {
  background-color: #fff !important;
  color: #333 !important;
}
/* infoアイコン */
[data-clone-panel-host="link-replace"] svg._light_v5c05_1 {
  fill: #888 !important;
}
/* 戻るボタン */
[data-clone-panel-host="link-replace"] .sb-clone-back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #f0f0f0;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  cursor: pointer;
  color: #666;
  transition: background .15s, color .15s;
  flex-shrink: 0;
}
[data-clone-panel-host="link-replace"] .sb-clone-back-btn:hover {
  background: #e0e0e0;
  color: #333;
}
`
