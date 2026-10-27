/**
 * LP設定（記事設定）の見た目（2026-10-27 本人「LP設定なんだけど、デザインの修正をしたい」＋見本の画像「この画像の見た目にしてほしい」）。
 * 見本: 灰色の丸の×・太い題名・青い保存／薄い青の帯の見出し（横に小さく注意書き）／白地＋細い枠の入力欄（px は欄の中の右）／
 * 3つ・4つずつそろえた並び／テキスト揃えは選んだ物だけ青い枠／LP内背景と外枠背景は横に並べて、それぞれ枠で囲む／青いラジオ。
 * 見出しの青い縦線は付けない（本人「縦線なし・帯の色だけ」＝角丸の箱＋色付きの左線は使わない決まり）。
 *
 * 白基調の段（white-base.ts の `.ReactModal__Content._modal_11n4w_1 input:not()…` 等）の上から当てるので、頭に html と印を付けて強くする。
 * 色は見本の画像から測った値。文字の黒・灰色は青みを付けない（暗い表示の仕組みは、青みのある暗い文字を「色付きの文字」と見て明るくしない＝shared/dark-color.ts）。青と淡い青は、アプリのテーマの色（--sb-accent・--sb-accent-tint）に合わせて変わる（見本の青は無いときの値）。
 */
const STYLE_ID = 'lp-settings-style'

/**
 * LP設定の画面に付ける印（version-settings.ts がポータルに付ける）。
 * `data-lp…` で始めない: 暗い表示の仕組みは `[data-lp` を「LPの中身＝暗くしない」と見て飛ばす（shared/dark-css.ts の SKIP_SELECTOR）
 */
export const LP_SETTINGS_ATTR = 'data-clone-lp-settings'

const M = `html body .ReactModalPortal[${LP_SETTINGS_ATTR}] .ReactModal__Content._modal_11n4w_1`
const FIELD = ':not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="color"]):not([type="file"])'
const BLUE = 'var(--sb-accent, #1178F3)'
const BLUE_DARK = 'var(--sb-accent-dark, #0B66D6)'
const TINT = 'var(--sb-accent-tint, #EBF5FD)'
const LINE = '#D7D9DD'
const INK = '#1A1A1A'
const LABEL = '#383838'
const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%233C3C3C' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")"

const CSS = `
${M}{border-radius:14px !important;box-shadow:0 20px 48px rgba(17,24,39,.18)}
/* 見出し: 灰色の丸の×・真ん中の太い題名・右の青い保存 */
${M} ._modalWrapper_11n4w_20 ._modalHeader_11n4w_20{align-items:center;padding:14px 24px !important;border-bottom:1px solid #E9EEF6 !important;border-radius:14px 14px 0 0}
${M} ._modalWrapper_11n4w_20 ._modalHeader_11n4w_20 > div{display:flex;align-items:center;height:auto !important;line-height:normal !important}
${M} ._modalWrapper_11n4w_20 ._modalHeader_11n4w_20 ._center_11n4w_56{flex-direction:column;justify-content:center}
/* 題名の下に、どの Version の設定か（LP設定は Version ごと・2026-10-27） */
${M} .lp-settings-version{margin-top:2px;font-size:12px;font-weight:500;color:#555555}
${M} ._modalWrapper_11n4w_20 ._modalHeader_11n4w_20 ._right_11n4w_57{justify-content:flex-end}
${M} ._modalWrapper_11n4w_20 ._modalHeader_11n4w_20 ._center_11n4w_56 ._title_11n4w_70{font-size:22px !important;font-weight:700;letter-spacing:.04em;color:${INK} !important}
${M} ._btnCnacel_1bcs1_140{width:40px !important;height:40px !important;border-radius:50% !important;border:none !important;background:#F2F4F5 !important;color:#222222;filter:none !important}
${M} ._btnCnacel_1bcs1_140:hover{background:#E5E8EB !important}
${M} ._btnCnacel_1bcs1_140::before,${M} ._btnCnacel_1bcs1_140::after{width:16px;height:2px}
${M} ._btnDarkThemePrimary_1bcs1_78{width:auto !important;min-width:140px;padding:0 28px !important;line-height:42px !important;border-radius:8px !important;background:${BLUE} !important;color:var(--sb-accent-ink, #FFFFFF) !important;font-size:17px !important;font-weight:700;letter-spacing:.1em;box-shadow:0 2px 6px rgba(17,24,39,.18)}
${M} ._btnDarkThemePrimary_1bcs1_78:hover{background:${BLUE_DARK} !important}
/* 中身 */
${M} ._modalWrapper_11n4w_20 ._modalContent_11n4w_79{padding:20px 24px 24px !important}
/* 見出しの帯（薄い青・太い字・横に小さく注意書き） */
${M} ._title_qyxur_126{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 14px;box-sizing:border-box;margin:0 0 14px !important;padding:9px 16px;border-radius:8px;background:${TINT};font-size:17px !important;font-weight:700;color:${INK} !important}
${M} ._title_qyxur_126 span{font-size:12px !important;font-weight:400;color:#555555}
/* 並び: 12 の目に、3つずつ（4目）・4つずつ（3目）そろえる */
${M} ._masterCssFormWrapper_qyxur_22{display:grid !important;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px 24px}
${M} ._masterCssFormWrapper_qyxur_22 > *{grid-column:span 4;min-width:0}
${M} ._masterCssFormWrapper_qyxur_22 > ._paddingFormGroup_qyxur_26{grid-column:span 3}
${M} ._masterCssFormWrapper_qyxur_22 > ._title_qyxur_126,${M} ._masterCssFormWrapper_qyxur_22 > [data-clone-text-align-row],${M} ._masterCssFormWrapper_qyxur_22 > ._flexFormWrapper_1n7ll_69,${M} ._masterCssFormWrapper_qyxur_22 > ._borderFormWrapper_qyxur_58{grid-column:1 / -1}
${M} ._masterCssFormWrapper_qyxur_22 > ._title_qyxur_126,${M} ._borderFormWrapper_qyxur_58 > ._title_qyxur_126{grid-column:1 / -1;margin:10px 0 0 !important}
${M} ._flexFormWrapper_1n7ll_69{display:grid !important;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 24px}
${M} ._borderFormWrapper_qyxur_58{display:grid !important;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 24px}
${M} ._formGroup_1n7ll_1{width:auto !important;min-width:0;margin:0 !important;padding:0 !important;position:relative}
${M} ._formGroup_1n7ll_1 label{font-size:13px !important;font-weight:500;color:${LABEL} !important;margin:0 0 6px !important}
/* 入力欄: 白地＋細い枠・角を少し丸く */
${M} input${FIELD},${M} select,${M} button.lp-palette-field{box-sizing:border-box;height:40px !important;padding:0 12px !important;border:1px solid ${LINE} !important;border-radius:6px !important;background-color:#FFFFFF !important;color:${INK} !important;font-size:15px !important;box-shadow:none;transition:border-color .15s,box-shadow .15s}
${M} input${FIELD}:focus,${M} select:focus,${M} button.lp-palette-field:focus-visible{border-color:${BLUE} !important;box-shadow:0 0 0 3px ${TINT};outline:none}
${M} select,${M} button.lp-palette-field{appearance:none;-webkit-appearance:none;padding-right:38px !important;background-image:${CHEVRON} !important;background-repeat:no-repeat !important;background-position:right 12px center !important;background-size:16px !important;cursor:pointer}
${M} button.lp-palette-field{gap:12px;padding-left:8px !important}
${M} .lp-palette-swatch{width:26px;height:26px;border-radius:4px}
/* 単位の px は欄の中の右（数字の上下の矢印のすぐ左） */
${M} ._pixcelForm_qyxur_30 input${FIELD}{padding-right:62px !important}
${M} ._pixcelForm_qyxur_30::before{top:auto !important;bottom:0;right:34px !important;width:auto !important;height:40px !important;line-height:40px;font-size:15px;color:#555555;pointer-events:none;z-index:1}
/* テキスト揃え: 選んだ物だけ青い枠・淡い青 */
${M} .lp-align-row{display:flex;align-items:center;gap:16px}
${M} .lp-align-label{font-size:13px;font-weight:500;color:${LABEL}}
${M} .lp-align-group{display:flex;gap:8px}
${M} .lp-align-btn{width:48px;height:36px;display:flex;align-items:center;justify-content:center;padding:0;border:1px solid #E1E4E8;border-radius:8px;background:#EFF1F5;color:#3C3C3C;cursor:pointer}
${M} .lp-align-btn:hover{background:#E4E7EC}
${M} .lp-align-btn[aria-pressed="true"]{border-color:${BLUE};background:${TINT};color:${BLUE}}
/* LP内背景・外枠背景: 横に並べて、それぞれ枠で囲む */
${M} .lp-bg-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin-top:22px}
${M} .lp-bg-box{min-width:0;padding:14px 18px 16px;border:1px solid #E5E8EE;border-radius:10px;background:#FFFFFF}
${M} .lp-bg-box > ._title_qyxur_126{margin:0 0 12px !important;padding:0;background:none;font-size:16px !important}
${M} .lp-bg-box ._backgroundFormWrapper_qyxur_64{margin:0 !important;padding:0 !important}
${M} .lp-bg-box ._backgroundFormWrapper_qyxur_64 .sample_token_2495e546{gap:22px;margin:0}
${M} .lp-bg-box [data-clone-bg-extra] > *{margin-top:12px !important}
/* 画像・動画を選ぶ所（採取物は黒い点線・上下 80px の余白） */
${M} ._imageDropUploadForm_qyxur_91{box-sizing:border-box;padding:28px 16px !important;border:1.5px dashed #C5CBD3 !important;border-radius:8px;background:#F8FAFC;color:#555555;font-size:13px !important;line-height:1.6;text-align:center;cursor:pointer}
${M} ._imageDropUploadForm_qyxur_91:hover{border-color:${BLUE} !important;background:${TINT}}
/* いちばん下の「他のバージョンにも適用する」（チェックを入れて保存すると、ほかの Version にも入れる・2026-10-27） */
${M} .lp-apply-others{display:flex;align-items:flex-start;gap:12px;margin-top:20px;padding:14px 18px;border-radius:10px;background:${TINT};cursor:pointer}
${M} .lp-apply-others input[type="checkbox"]{width:20px;height:20px;margin:1px 0 0;flex:none;accent-color:${BLUE};cursor:pointer}
${M} .lp-apply-others__text{display:flex;flex-direction:column;gap:2px}
${M} .lp-apply-others__label{font-size:15px;font-weight:700;color:#1A1A1A}
${M} .lp-apply-others__note{font-size:12px;line-height:1.6;color:#555555}
/* ラジオ: 青 */
${M} ._radioControl_10frc_1 input + label{margin-left:28px !important;font-size:14px;color:#222222;cursor:pointer}
${M} ._radioControl_10frc_1 input + label::before{left:0 !important;width:20px !important;height:20px !important;box-sizing:border-box;border:1.5px solid #B8BEC8 !important;background:#FFFFFF !important}
${M} ._radioControl_10frc_1 input:checked + label::before{border-color:${BLUE} !important}
${M} ._radioControl_10frc_1 input:checked + label::after{left:10px !important;width:10px !important;height:10px !important;background:${BLUE} !important}
/* 狭い画面では2つずつ・1つずつに */
@media (max-width: 760px){
  ${M} ._masterCssFormWrapper_qyxur_22 > *,${M} ._masterCssFormWrapper_qyxur_22 > ._paddingFormGroup_qyxur_26{grid-column:span 6}
  ${M} ._flexFormWrapper_1n7ll_69{grid-template-columns:repeat(2,minmax(0,1fr))}
  ${M} ._borderFormWrapper_qyxur_58,${M} .lp-bg-row{grid-template-columns:minmax(0,1fr)}
}
`

/** LP設定の見た目を1回だけ入れる */
export function ensureVersionSettingsStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.append(style)
}
