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
import {
  PROPS_OPEN_CLASS,
  VERSIONS_OPEN_CLASS,
  WIDGET_CATEGORY_OPEN_CLASS,
} from './sheet-classes.ts'
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
    // left/right/bottom も !important にする。付けないと採取CSSに負けて `bottom` が効かず、
    // レールが本来の位置のまま画面の下へはみ出し、アイコンの下のラベルが切れる（実機で発覚）
    `html body [class*="_sideToolbarWrapper_"]{position:fixed !important;`,
    `left:0 !important;right:0 !important;bottom:0 !important;top:auto !important;`,
    `width:auto !important;height:auto !important;display:flex !important;flex-direction:row !important;`,
    // 採取CSSが margin:-20px を持っている（PCはコードがインラインで打ち消していた）。
    // 消さないとレールが20px下へずれ、アイコンの下のラベルが画面の外で切れる（実機で発覚）
    `margin:0 !important;`,
    `align-items:center;gap:0;overflow-x:auto;z-index:9400;background:var(--sb-surface);`,
    `border-top:1px solid var(--sb-line);padding:4px 4px calc(4px + env(safe-area-inset-bottom,0px))}`,
    `html body [class*="_sideToolbarWrapper_"]>*{flex:0 0 auto}`,
    `html body [class*="_sideToolbarTop_"]{display:flex !important;flex-direction:row !important;`,
    // 項目の間隔は採取CSSが4px入れてくる。8項目 × 44px ＝ 352px に収めるため消す
    `align-items:center;gap:0 !important;width:auto !important;padding:0 !important}`,
    // プロパティを開く丸ボタン（下のツールバー46px＋余白の上）。シートが開いている間は隠す
    `html body #sb-m-props-btn{bottom:calc(66px + env(safe-area-inset-bottom,0px))}`,
    `html body.${VERSIONS_OPEN_CLASS} #sb-m-props-btn,`,
    `html body.${PROPS_OPEN_CLASS} #sb-m-props-btn{display:none !important}`,
    // 「この段落を選ぶ」「全部を選ぶ」（プロパティを開いている間だけ・シートの上）
    `html body.${PROPS_OPEN_CLASS} #sb-m-range-bar{display:flex !important;bottom:calc(60vh + 8px)}`,
    // 開いているシートを閉じる「×」（シートの少し上に出す）
    `html body.${VERSIONS_OPEN_CLASS} #sb-m-sheet-close,`,
    `html body.${PROPS_OPEN_CLASS} #sb-m-sheet-close{display:flex !important;bottom:calc(60vh + 8px)}`,
    // URLバー: PCは右のレール分(68px)はみ出させているが、スマホにレールは無い。
    // そのままだと「配信」側のコピーボタンが画面の外に出て、overflow:hidden で触れない。
    // 幅を戻し、プレビューと配信を縦に積んで両方のコピーボタンを出す
    `html body .sb-url-bar{width:100% !important;margin-right:0 !important;height:auto !important;`,
    `flex-direction:column !important;align-items:stretch !important;gap:6px;padding:6px 8px !important;`,
    `overflow:visible !important}`,
    `html body .sb-url-sep{display:none !important}`,
    `html body .sb-url-field{height:34px !important}`,
    `html body .sb-url-copy-btn{width:34px !important;height:34px !important}`,
    // ヘッダー画像の枠も同じ68pxのはみ出しで右が切れていた
    `html body [class*="_articleHeaderPhoto_"]{margin-right:0 !important;width:auto !important;`,
    `max-width:100% !important;box-sizing:border-box !important}`,
    // ── モーダル（Widgetライブラリ・記事設定・タグ設定など）──
    // 実物はPC幅前提で最大1200pxの紙を中央に置くため、390pxでは左右が画面の外へ出る。
    // スマホでは画面いっぱいの1枚にする
    // min-width:0 が要る。flexの子は既定（auto）だと中身より小さくならず、
    // 幅100%を指定しても中身（PC幅の一覧）に引っ張られて1200pxのままになる
    `html body .MuiDialog-container>.MuiPaper-root{width:100% !important;max-width:100% !important;`,
    `min-width:0 !important;height:100% !important;max-height:100% !important;margin:0 !important;`,
    `border-radius:0 !important}`,
    `html body .MuiDialogContent-root{width:auto !important;max-width:100% !important;`,
    `min-width:0 !important;overflow-x:auto !important;padding:12px !important}`,
    // Widgetライブラリは「左にカテゴリー／右にカード」の横並び。390pxだとカテゴリーが
    // 250px取ってカード欄が100px程度しか残らない。カテゴリーは普段しまい、
    // 「カテゴリー」ボタンで左から重ねて出す（2026-09-14 本人指示）
    `html body .MuiDialogContent-root>.MuiBox-root{flex-direction:column !important;gap:10px}`,
    `html body .MuiDialogContent-root>.MuiBox-root>*:first-child{position:fixed !important;`,
    `left:0;top:0;bottom:0;width:78% !important;max-width:300px !important;min-width:0 !important;`,
    `max-height:none !important;background:var(--sb-surface);z-index:9800;overflow-y:auto;`,
    `box-shadow:2px 0 16px rgba(0,0,0,.25);padding:14px !important;`,
    `transform:translateX(-100%);transition:transform .2s ease}`,
    `html body.${WIDGET_CATEGORY_OPEN_CLASS} .MuiDialogContent-root>.MuiBox-root>*:first-child{`,
    `transform:translateX(0)}`,
    `html body.${WIDGET_CATEGORY_OPEN_CLASS} #sb-m-widget-cat-backdrop{display:block !important}`,
    // カード一覧は3列→1列（286pxのカードが3枚並ぶと画面に入らない）
    `html body .css-ojejk4{width:100% !important;min-width:0 !important}`,
    `html body .css-ojejk4>.MuiCard-root{flex:0 0 100% !important;max-width:100% !important}`,

    // ── 画面ごとの作り直し（全画面を実測して見つけたもの・2026-09-14）──
    // 設定のタブ（アカウント/通知設定/チームメンバー/アクセス管理）は横に長く、
    // 「アクセス管理」が画面の外（370〜493px）に出ていた
    `html body .sb-tabbar{overflow-x:auto !important;scrollbar-width:none}`,
    `html body .sb-tabbar::-webkit-scrollbar{display:none}`,
    `html body .sb-tabbar>*{flex:0 0 auto}`,
    // レポート除外の絞り込みは、項目が枠（304px）より広い362pxで画面外へ出ていた
    `html body .rx-form{flex-direction:column !important;align-items:stretch !important}`,
    `html body .rx-field{width:auto !important;min-width:0 !important}`,
    `html body .rx-field select,html body .rx-field input{width:100% !important;min-width:0 !important}`,
    `html body .rx-btn{width:100%}`,
    // 広告媒体連携は、媒体名に line-height:100px（PCの100px行の中央に置く作り）が
    // 効いていて、名前の枠が100pxに広がり「連携数」と重なっていた
    `html body [class*="_mediaName_"],html body [class*="_mediaName_"] *,`,
    `html body [class*="_connectionCount_"]{line-height:1.5 !important;height:auto !important;`,
    `min-height:0 !important}`,
    // 中間ページは「左に一覧／右に設定」の横並び。右が画面の外（190〜679px）だった
    `html body [class*="_redirectPagesWrapper_"]{flex-direction:column !important}`,
    `html body [class*="_redirectPagesWrapper_"]>*{width:auto !important;max-width:100% !important;`,
    `min-width:0 !important}`,

    // ── Widget編集画面（LPエディタの中のモーダル・2026-09-14 本人指摘）──
    // PC前提の作り: 画面中央から右へ60px（PCレール分）ずらし、中身は左右2ペイン。
    // 390pxでは右へ48pxはみ出し、左ペインが660px固定のせいで右の「要素ごとのカード」が
    // 幅0＝見えず触れなかった。スマホでは全画面＋上下2段にする。
    // インラインstyleで書かれているが !important なしなので、こちらの !important が勝つ。
    `html body [data-widget-editor]{left:0 !important;top:0 !important;transform:none !important;`,
    `width:100vw !important;height:100dvh !important;max-width:none !important;`,
    `box-sizing:border-box !important;padding-bottom:env(safe-area-inset-bottom,0px);`,
    `border-radius:0 !important;z-index:9500 !important}`,
    `html body [data-widget-backdrop]{z-index:9490 !important}`,
    // 開いている間は、下のツール列（z-index:9400）と丸ボタン（9300）を隠す。
    // どちらもパネルより手前に出て、パネルの操作を奪っていた
    `html body:has([data-widget-editor]) [class*="_sideToolbarWrapper_"],`,
    `html body:has([data-widget-editor]) #sb-m-props-btn{display:none !important}`,
    // ヘッダーは折り返させない（幅が足りず「閉じる」「Widget編集」が2行に割れていた）
    `html body [data-widget-header]{flex-wrap:nowrap !important;padding:10px 4px !important;gap:2px}`,
    `html body [data-widget-header]>*{white-space:nowrap !important;flex-shrink:0 !important}`,
    `html body [data-widget-header]>*:nth-child(2){font-size:13px !important}`,
    // 2ペインは上下に積む。左は flex:0 0 660px の固定幅なので幅もmin-widthも外す
    `html body [data-widget-panes]{flex-direction:column !important}`,
    `html body [data-widget-pane="visual"]{flex:0 0 46% !important;width:auto !important;`,
    `min-width:0 !important;min-height:0 !important}`,
    `html body [data-widget-pane="code"]{flex:1 1 auto !important;width:auto !important;`,
    `min-width:0 !important;min-height:0 !important}`,
    // 仕切り（col-resize）は指では掴めない
    `html body [data-widget-divider]{display:none !important}`,
    // 書式ツールバーは1行で横に流す（折り返すと枠(64px)の外で下の段が切れる）
    `html body [data-widget-toolbar]{flex-wrap:nowrap !important;overflow-x:auto;scrollbar-width:none}`,
    `html body [data-widget-toolbar]::-webkit-scrollbar{display:none}`,
    `html body [data-widget-toolbar]>*{flex:0 0 auto}`,
    // プレビューは配信と同じ620px。中央寄せ(margin:0 auto)のままだと、狭い画面で左へはみ出した分に
    // 横スクロールで届かない（左側の余白は掴めない）ので、左端から始めて右へ流す
    `html body [data-widget-preview]{margin:0 !important}`,
    // 「Ctrl（Windows）/⌘（Mac）＋クリック」の注意書きは指では実行できず、枠から切れるだけ
    `html body [data-widget-note]{display:none !important}`,

    // ── レポート画面 ──
    // 「レポート / 広告データ取得日時 / ヒートマップ」の帯は横1列に収まりきらず、
    // 縮められた枠から文字がはみ出して重なっていた。縮めずに横スクロールさせる
    `html body [class*="_navContainer_"]{overflow-x:auto !important;flex-wrap:nowrap !important;`,
    `scrollbar-width:none}`,
    `html body [class*="_navContainer_"]::-webkit-scrollbar{display:none}`,
    `html body [class*="_navContainer_"]>*{flex:0 0 auto !important}`,
    // 「広告データ取得日時」は絶対配置で、PCではタブの右の空きに置かれている。
    // 390pxではタブの上に重なるので、流し込みに戻して帯の下へ落とす
    `html body [class*="_mediaSummary_"]{position:static !important;left:auto !important;`,
    `right:auto !important;top:auto !important;display:flex !important;justify-content:flex-end;`,
    `padding:6px 12px;width:auto !important}`,
    // 歯車（パラメータ）も同じく絶対配置で、ヒートマップの文字に重なっていた
    `html body [class*="_parameterScope_"]{position:static !important;left:auto !important;`,
    `right:auto !important;top:auto !important;display:flex !important;justify-content:flex-end;`,
    `gap:8px;padding:4px 12px;width:auto !important}`,
    // レポートの外枠はPC用に30px+16pxの余白を持つ。スマホは画面幅を使う
    `html body [class*="_abTestReportWrapper_"]{padding:0 !important}`,
    `html body .rv2{padding:10px !important}`,
    // 絞り込みは縦に積む（横並びだと項目が潰れ、右に空箱ができる）。
    // **flex-wrap:wrap のままだと縦並びの「列」の幅が中身基準になり、枠より広くなる**
    `html body .rv2-filters,html body .rv2-filter-fields{flex-direction:column !important;`,
    `align-items:stretch !important;flex-wrap:nowrap !important}`,
    `html body .rv2-field{min-width:0 !important;width:auto !important}`,
    `html body .rv2-daterange input{width:auto !important;flex:1 1 auto;min-width:0}`,
    `html body .rv2-apply{align-self:stretch !important;justify-content:center;min-height:44px}`,
    // 「設置済みWidget」の列はスマホでは出さない（画面の半分を取ってキャンバスが潰れる）。
    // Widget自体は下のツールバーの「Widget」から開ける
    `html body [data-widget-nav]{display:none !important}`,
    // 上のタブ・パンくずは横に長い。切り捨てずに横スクロールで全部触れるようにする
    `html body .topnav,html body .header-row{overflow-x:auto !important;overflow-y:hidden}`,
    // 書式ツールバー（文字サイズ・色など）: はみ出した分が切り捨てられていたので横スクロールに。
    // 指が当たる大きさへ広げる
    `html body .sb-ct{overflow-x:auto !important;overflow-y:hidden !important;flex-wrap:nowrap;`,
    `min-height:48px;padding:6px 8px;position:sticky;top:0;z-index:50;`,
    `-webkit-overflow-scrolling:touch;scrollbar-width:none}`,
    `html body .sb-ct::-webkit-scrollbar{display:none}`,
    `html body .sb-ct-btn{width:40px !important;height:40px !important}`,
    `html body .sb-ct-size-btn{width:34px !important;height:38px !important;font-size:17px}`,
    `html body .sb-ct-size-val{height:38px !important;min-width:42px;font-size:15px}`,
    `html body .sb-ct-select{height:38px !important;font-size:14px;max-width:120px}`,
    `html body .sb-ct-sep{margin:0 6px}`,
    // 下のツールバーの項目: 文字が画面の外に切れていたので、幅と高さを決めて収める
    // 8項目 × 44px ＋ 左右の余白8px ＝ 360px。狭いスマホ（360px）でも横スクロールなしで収まる
    `html body [class*="_sideToolbarIcon_"]{width:44px !important;min-width:44px;height:46px !important;`,
    `padding:0 !important;margin:0 !important;display:flex !important;flex-direction:column !important;`,
    `align-items:center !important;justify-content:center !important;gap:1px}`,
    `html body [class*="_sideToolbarWrapper_"] .sb-side-label{font-size:9px !important;line-height:1.1}`,
    // プロパティ（文字サイズ・色・書式）の部品を指で押せる大きさにする
    `html body .sb-props-panel .sb-pr-input,html body .sb-props-panel .sb-pr-select,`,
    `html body .sb-props-panel .sb-pr-color-hex{min-height:38px !important}`,
    `html body .sb-props-panel .sb-pr-stepper-btn{height:19px !important;min-width:26px}`,
    `html body .sb-props-panel .sb-pr-color-swatch{width:38px !important;height:38px !important}`,
    `html body .sb-props-panel .sb-pr-action{min-height:38px !important}`,
    // 書式（B/I/U/S）や配置の小さなボタンも押しやすく
    `html body .sb-props-panel .sb-fmt-btns>*,html body .sb-props-panel .sb-align-btn{`,
    `min-width:44px !important;min-height:38px !important}`,
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
