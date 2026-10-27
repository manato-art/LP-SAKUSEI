/**
 * リンク置換パネルの見た目（2026-10-27 指示㉒ 本人「こんな感じにリンク置換をリデザインして」・見本の画像「モダンなリンク管理ダッシュボード」）。
 * 見本: 白い見出し（戻る・題名・タブ）／淡い灰色の地に、丸いピルの絞り込み・アイコン付きのボタン・＋の付いた「新しいリンク」・
 * 白いカードの行（チェック・題名・リンクのアイコン付きのURL・右に計測の札）／白い下の段（リンクのアイコン付きの入力欄・オレンジの置換）。
 * 本人「計測の右の：はいらない」＝行の「⋮」は付けない。
 *
 * 採取した見た目（white-base.ts のリンク置換の段）の上から当てるので、頭に html を付けて強くする。
 */
const STYLE_ID = 'link-replace-style'

// 白基調の段（white-base.ts）には :not() を3つ重ねた強い指定があるので、こちらはさらに強くする
const S = 'html body [data-clone-panel-host="link-replace"][data-clone-panel-host]'
const FIELD = ':not([type="checkbox"]):not([type="radio"]):not([type="hidden"])'
const ORANGE = '#F08A00'
const LINK_ICON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/%3E%3C/svg%3E\")"
const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23374151' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")"

const CSS = `
${S} [data-clone-panel="link-replace"]{border-radius:16px !important;border:1px solid #E5E7EB !important;box-shadow:0 12px 32px rgba(17,24,39,.14) !important;width:480px !important;max-width:calc(100vw - 32px);max-height:calc(100vh - 140px);overflow:hidden !important;display:flex !important;flex-direction:column}
/* 送るのは一覧だけ（2026-10-27 本人「全体をスクロールするのではなく、2枚目のところのみをスクロール」）:
   パネルを画面の高さに収め、見出し・絞り込み・下の段はそのまま、一覧が残りの高さを使って中で送る */
${S} ._body_x4j8w_8{padding:0 !important;flex:1 1 auto;min-height:0;display:flex !important;flex-direction:column}
/* 中身の幅を採取物の 430px 固定からパネルいっぱいに（右に白い余白が出ていた・本人の指摘） */
${S} .sample_token_ce149280{width:100% !important;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
/* 見出し: 戻る・題名・タブ */
${S} .sample_token_2431ba36{flex:none;display:flex !important;align-items:center;gap:12px;padding:12px 16px 0 !important;background:#FFFFFF;border-bottom:1px solid #EEF0F3}
${S} .sb-clone-back-btn{width:36px;height:36px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid #E5E7EB;background:#F3F4F6;color:#374151;cursor:pointer;margin-bottom:10px}
${S} ._headerTitle_id5w4_24{font-size:15px !important;font-weight:700 !important;color:#1F2937 !important;white-space:nowrap;margin-bottom:10px}
${S} ._tabWrapper_id5w4_28{display:flex !important;align-self:flex-end;gap:2px;margin-left:4px}
${S} ._tab_id5w4_28{padding:10px 10px !important;font-size:13px !important;font-weight:600;white-space:nowrap;color:#6B7280 !important;background:transparent !important;border-bottom:2px solid transparent !important;border-radius:8px 8px 0 0}
${S} ._tab_id5w4_28._active_id5w4_48{color:${ORANGE} !important;background:#FFF7ED !important;border-bottom:2px solid ${ORANGE} !important}
/* 淡い灰色の地 */
${S} ._replaceLinkContent_id5w4_76{background:#F6F7F9 !important;padding:14px 16px 0 !important;margin:0 !important;flex:1 1 auto;min-height:0;display:flex !important;flex-direction:column}
${S} ._contentHeader_id5w4_87{flex:none;display:flex !important;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px !important}
/* 絞り込み（丸いピル） */
${S} ._sortTabWrapper_id5w4_93{display:inline-flex !important;align-items:center;padding:3px;border-radius:999px;background:#ECEEF1}
${S} ._sortTab_id5w4_93{padding:5px 12px !important;border-radius:999px;font-size:12px !important;font-weight:600;color:#4B5563 !important;background:transparent !important;cursor:pointer}
${S} ._sortTab_id5w4_93._active_id5w4_48{background:${ORANGE} !important;color:#FFFFFF !important;box-shadow:0 1px 3px rgba(240,138,0,.35)}
/* 全て選択・選択解除（アイコン付き） */
${S} ._selectTypeBtnWrapper_id5w4_112{display:flex !important;gap:6px}
${S} ._btn_id5w4_117{display:inline-flex !important;align-items:center;gap:5px;padding:6px 10px !important;border-radius:8px !important;border:1px solid #E5E7EB !important;background:#FFFFFF !important;color:#374151 !important;font-size:12px !important;font-weight:600;cursor:pointer}
${S} ._btn_id5w4_117 svg{width:14px;height:14px;flex-shrink:0}
/* 新しいリンク（＋のしるし・下向きの矢印） */
${S} .sample_token_04cc4929{flex:none;position:relative;margin-bottom:12px !important}
${S} .sample_token_04cc4929 > select{appearance:none;-webkit-appearance:none;width:100%;height:46px !important;padding:0 40px 0 48px !important;border-radius:12px !important;border:1px solid #E5E7EB !important;font-size:15px !important;font-weight:700 !important;color:#1F2937 !important;background:${CHEVRON} right 14px center / 18px no-repeat #FFFFFF !important;cursor:pointer}
${S} .lr-select-icon{position:absolute;left:14px;top:23px;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;background:${ORANGE};color:#FFFFFF;display:flex;align-items:center;justify-content:center;pointer-events:none}
${S} .lr-select-icon svg{width:14px;height:14px}
/* 一覧: 白いカードの行 */
${S} ._targetLinkLists_id5w4_134{flex:1 1 auto;min-height:0;display:flex !important;flex-direction:column;gap:8px;max-height:none !important;overflow-x:hidden !important;overflow-y:auto !important;margin-bottom:12px !important;padding:0 2px 2px 0}
/* 一覧の下に灰色の間をとる（送っている途中の行が、下の段にかぶさって見えないように） */
${S} ._targetLinkLists_id5w4_134 > .lr-row{flex:none}
${S} .lr-row{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #E8EAED;border-radius:12px;background:#FFFFFF;cursor:pointer}
${S} .lr-row:hover{border-color:#D1D5DB}
${S} .lr-row__check{width:18px;height:18px;flex-shrink:0;margin:0;cursor:pointer;accent-color:${ORANGE}}
${S} .lr-row__body{flex:1;min-width:0}
${S} .lr-thumb{width:44px;height:44px;flex-shrink:0;border-radius:8px;border:1px solid #E8EAED;background:#F1F2F4}
${S} .lr-row__title{font-size:14px;font-weight:700;line-height:1.5;color:#1F2937;overflow-wrap:anywhere}
${S} .lr-row__url{display:flex;align-items:flex-start;gap:5px;margin-top:2px;font-size:12px;line-height:1.5;color:#6B7280;overflow-wrap:anywhere}
${S} .lr-row__url svg{width:13px;height:13px;flex-shrink:0;margin-top:2px;color:#9CA3AF}
${S} .lr-tag{display:inline-block;margin-right:6px;padding:1px 8px;border-radius:999px;background:#EEF0F3;color:#4B5563;font-size:11px;font-weight:600;line-height:1.6;vertical-align:1px}
${S} .lr-pill{flex-shrink:0;padding:4px 10px;border-radius:999px;border:none;font:inherit;font-size:12px;font-weight:600;line-height:1.5;white-space:nowrap}
${S} button.lr-pill{cursor:pointer}
${S} .lr-pill--on{background:#E6F4FF;color:#0B84E5}
${S} .lr-pill--off{background:#F1F2F4;color:#4B5563}
${S} button.lr-pill--on:hover{background:#D6ECFF}
${S} button.lr-pill--off:hover{background:#E5E7EB}
${S} ._noLinksDescription_id5w4_411{padding:24px 0 !important;text-align:center}
/* 下の段（白）: リンクのアイコン付きの入力欄・オレンジの置換 */
${S} ._formWrapper_id5w4_228{flex:none;margin:0 -16px !important;padding:14px 16px 16px !important;background:#FFFFFF;border-top:1px solid #EEF0F3}
${S} ._linkInputWrapper_id5w4_237{display:flex !important;align-items:stretch;gap:10px}
${S} ._replaceLinkInput_id5w4_246{flex:1;min-width:0}
${S} ._replaceLinkInput_id5w4_246 input${FIELD}{width:100%;height:46px !important;padding:0 12px 0 42px !important;border-radius:12px !important;border:1px solid #E5E7EB !important;font-size:14px !important;background:${LINK_ICON} left 14px center / 18px no-repeat #FFFFFF !important}
${S} ._btnReplace_id5w4_297{display:flex !important;flex:none;box-sizing:border-box;align-items:center;justify-content:center;min-width:128px;height:46px;padding:0 20px 0 44px !important;border-radius:12px !important;font-size:15px !important;font-weight:700;color:#FFFFFF !important;background:linear-gradient(180deg,#FFA53A,${ORANGE}) !important;box-shadow:0 3px 8px rgba(240,138,0,.35);cursor:pointer}
${S} ._btnReplace_id5w4_297::before{left:16px !important;top:50% !important;transform:translateY(-50%);width:20px !important;height:20px !important;background-size:11px !important;background-position:center !important}
${S} ._btnReplace_id5w4_297._disable_1bcs1_22{opacity:.45 !important;box-shadow:none;cursor:default}
${S} .sample_token_93c0b7f0{margin-top:12px;display:flex;flex-direction:column;gap:8px}
${S} ._checkboxLabel_id5w4_268{font-size:13px !important;color:#374151 !important}
`

/** リンク置換の見た目を1回だけ入れる */
export function ensureLinkReplaceStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.append(style)
}

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

/** 見本のアイコン（チェック・ゴミ箱・＋・リンク） */
export const LR_ICONS = {
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  trash: svg('<path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7l1 12.5h9l1-12.5"/>'),
  plus: svg('<path d="M12 6v12"/><path d="M6 12h12"/>'),
  link: svg(
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  ),
} as const
