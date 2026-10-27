/**
 * 履歴（変更・復元履歴）のパネルの見た目（2026-10-27 指示㉛ 本人「履歴の項目をリデザインして」・見本の画像「バージョン復元モーダルUI」）。
 * 見本: 大きな太字の題名「バージョン復元」・オレンジの復元と灰色の戻る／行は細い枠で囲んだ箱（ラジオ・日時・何をしたか）／
 * 選んだ行は淡いオレンジの地とオレンジの枠・オレンジのラジオ／「現行版」は小さなオレンジの札。色は見本の画像から測った値。
 *
 * 開け閉めは採取物の class（_open_x4j8w_84）に任せる＝パネルに display を当てない（KB-2026-10-27-009）。
 * 白基調の段（white-base.ts）の上から当てるので、頭に html body とパネルの印を付けて強くする。文字の黒・灰色は青みなし（暗い表示で明るくなる）。
 */
const STYLE_ID = 'history-panel-style'

const S = 'html body [data-clone-panel-host="history"][data-clone-panel-host]'
const ORANGE = '#FF8D02'
const INK = '#1A1A1A'
const MUTED = '#8C8C8C'
const LINE = '#E7E8EC'

const CSS = `
${S} ._bodyWrapper_x4j8w_8{width:320px !important;border-radius:16px !important;border:1px solid ${LINE} !important;background:#FFFFFF !important;box-shadow:0 12px 32px rgba(0,0,0,.14) !important;overflow:hidden !important}
${S} ._body_x4j8w_8{padding:0 !important;background:#FFFFFF !important}
/* 見出し: 大きな太字の題名・オレンジの復元・灰色の戻る */
${S} ._articleHistoryHeader_qvqhx_1{display:flex !important;align-items:center;gap:8px;padding:14px 16px !important;border-bottom:1px solid #EEF0F3;font-size:18px !important;font-weight:800 !important;color:${INK} !important;background:#FFFFFF !important}
${S} ._articleHistoryHeader_qvqhx_1 > ._btn_1bcs1_2{box-sizing:border-box;width:auto !important;min-width:64px;height:36px;padding:0 16px !important;border-radius:8px !important;border:none !important;font-size:14px !important;font-weight:700 !important;line-height:36px !important;text-align:center}
${S} ._articleHistoryHeader_qvqhx_1 > ._btn_1bcs1_2:first-of-type{margin-left:auto}
${S} ._btnRestore_qvqhx_8{background:${ORANGE} !important;color:#FFFFFF !important}
${S} ._btnCancel_qvqhx_12{background:#F1F2F4 !important;color:#333333 !important}
/* 選んでいるのが現行版のときは、戻す先が無いので押せない形（見本どおり見えてはいる） */
${S} [data-clone-role="restore"][hidden]{opacity:.45;pointer-events:none}
/* 行: 細い枠で囲んだ箱 */
${S} .sample_token_caea644f{display:flex;flex-direction:column;gap:8px;padding:12px !important;max-height:calc(100vh - 220px);overflow-y:auto}
${S} ._articleHistoryList_qvqhx_22{box-sizing:border-box;width:auto !important;margin:0 !important;padding:10px 14px !important;border:1px solid ${LINE} !important;border-radius:10px !important;background:#FFFFFF !important;cursor:pointer}
${S} ._articleHistoryList_qvqhx_22:hover{border-color:#D5D7DC !important}
${S} ._articleHistoryList_qvqhx_22._active_qvqhx_31{background:#FFF6E9 !important;border-color:#FDC98A !important}
/* ラジオ（オレンジ） */
${S} ._radioControl_10frc_1 input + label{margin-left:32px !important;cursor:pointer}
${S} ._radioControl_10frc_1 input + label::before{left:0 !important;width:20px !important;height:20px !important;box-sizing:border-box;border:1.5px solid #BBBEC2 !important;background:#FFFFFF !important}
${S} ._radioControl_10frc_1 input:checked + label::before{border-color:${ORANGE} !important}
${S} ._radioControl_10frc_1 input:checked + label::after{left:10px !important;width:10px !important;height:10px !important;background:${ORANGE} !important}
/* 日時・何をしたか（白基調の段の「選んだ行はオレンジの字」より強く＝行の class を挟む） */
${S} ._articleHistoryInfo_qvqhx_35{width:auto !important}
${S} ._articleHistoryList_qvqhx_22 .sample_token_7efbabf9{font-size:15px !important;font-weight:700 !important;color:${INK} !important;font-variant-numeric:tabular-nums}
${S} ._articleHistoryList_qvqhx_22 .sample_token_466796a9{margin-top:2px;font-size:12px !important;color:${MUTED} !important}
${S} ._articleHistoryList_qvqhx_22 .sample_token_466796a9.hx-current-tag{display:inline-block;margin-top:4px;padding:1px 8px;border-radius:4px;background:#FFEAC5 !important;color:#E07B00 !important;font-size:11px !important;font-weight:700}
`

/** 履歴のパネルの見た目を1回だけ入れる */
export function ensureHistoryStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.append(style)
}
