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
    `html body .sb-url-bar .sb-url-field{height:34px !important}`,
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
    // ダイアログの見出しは［左ボタン］［タイトル］［右ボタン］の3列。Widgetライブラリは
    // 右が空なので、タイトルが右へずれて見える（2026-09-14 本人指摘「縦の真ん中がずれてる」）。
    // 両端を同じ幅にして、タイトルを画面の真ん中に置く
    // 右の枠は中身が無いと display:none にされるので、空のまま見せて場所だけ取らせる
    `html body [class*="css-155j396"]>*:first-child,`,
    `html body [class*="css-155j396"]>*:last-child{flex:1 1 0 !important;display:block !important}`,
    `html body [class*="css-155j396"]>*:nth-child(2){flex:0 1 auto !important}`,
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
    // 媒体カードは428px固定で、右端の「アカウント連携」が画面の外（x=398〜408）にいた。
    // 横スクロールできる親の中なので気づきにくいが、押すのに横へずらす必要があった
    // 採取CSSが flex:0 1 50% を持つので、width だけでは勝てない（2列のまま媒体名が潰れる）
    `html body [class*="_media_ifzcq_"]{flex:0 0 100% !important;width:100% !important;`,
    `max-width:100% !important;min-width:0 !important}`,
    `html body [class*="_mediaContainer_ifzcq_"]{width:auto !important;min-width:0 !important}`,
    // 媒体名は200px固定。アイコン36＋名前200＋ボタン102で枠(300px)を超え、
    // ボタンが画面の外（x=408）へ出ていた。名前を縮むようにする
    `html body [class*="_mediaName_ifzcq_"]{width:auto !important;min-width:0 !important;`,
    `flex:1 1 auto !important}`,
    // 名前を縮むようにすると、隣のアイコン(36px)まで一緒に潰れて22pxになる
    `html body [class*="_icon_ifzcq_"]{flex:0 0 auto !important}`,
    `html body [class*="_mediaName_"],html body [class*="_mediaName_"] *,`,
    `html body [class*="_connectionCount_"]{line-height:1.5 !important;height:auto !important;`,
    `min-height:0 !important}`,
    // デバイス別の見出し3つ（スマートフォン／タブレット／デスクトップ）は1つ64pxしか無く、
    // 12pxの6文字が入らずに「デスクトッ／プ」と1文字だけ落ちていた。表は横へ流せるので折り返さない
    `html body [class*="css-1gb3ku2"]>*{width:auto !important;min-width:0 !important;`,
    `white-space:nowrap !important}`,
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
    `html body:has([data-widget-editor]) [class*="_sideToolbarWrapper_"]{display:none !important}`,
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

    // ── Version出し分け設定（「切り替え」タブ・2026-09-14 本人指摘）──
    // 採取した土台は「表(444px)＋右に条件メニュー(78px)」の横並び。390pxでは枠(350px)に
    // 収まらず、メニューが画面の外（x=464〜542）へ出て**条件を選べなかった**。
    // 採取物なので直せるのはCSSだけ。縦に積み、条件の選択を一番上へ出す。
    `html body [class*="css-5ai0ia"]{flex-direction:column !important;width:auto !important;`,
    `margin:0 !important}`,
    `html body [class*="css-5ai0ia"]>*{width:auto !important;min-width:0 !important}`,
    // 条件（デバイス別／パラメーター別／時間別…）は一番上へ。縦7行だと表が下へ追いやられるので横に流す
    `html body [class*="css-m7q6f4"]{order:-1;border-bottom:1px solid var(--sb-line)}`,
    `html body [class*="css-19sre7e"]{position:static !important}`,
    `html body [class*="css-m7q6f4"] [class*="css-19sre7e"]>div{display:flex !important;`,
    `flex-direction:row !important;align-items:center;gap:12px;overflow-x:auto;`,
    `scrollbar-width:none;padding:6px 12px}`,
    `html body [class*="css-m7q6f4"] [class*="css-19sre7e"]>div::-webkit-scrollbar{display:none}`,
    `html body [class*="css-m7q6f4"] [class*="css-19sre7e"]>div>*{flex:0 0 auto;`,
    `white-space:nowrap;margin:0 !important}`,
    // 表は縮めずに横へ流す（縮めるとVersion名と配信割合が潰れる）
    `html body [class*="css-1rr4qq7"]{overflow-x:auto;width:auto !important;min-width:0 !important}`,
    // 「流入元別」の行は高さ46px固定＋align-items:center。入力3つが折り返すと行の上下へ
    // はみ出し、上の説明文に重なっていた（390pxで実測）。行を伸ばし、入力は縦に積む
    `html body [class*="css-1rr4qq7"] [class*="css-1ygvyop"]{height:auto !important;`,
    `align-items:flex-start !important}`,
    `html body [class*="css-1rr4qq7"] [class*="css-1qivsvc"]{height:auto !important}`,
    `html body [data-clone-param-editor]>div{flex-direction:column !important;`,
    `align-items:stretch !important}`,
    `html body [data-clone-param-editor] input,`,
    `html body [data-clone-param-editor] select{width:100% !important;min-width:0 !important}`,

    // ── ヒートマップ比較（レポート→ヒートマップ・2026-09-14 本人指摘）──
    // 採取した土台は「左=Version一覧(250px固定) / 右=ヒートマップの列」の横並び。
    // 390pxでは右に40pxしか残らず、中の列(377px)が画面の外(x=300〜683)へ出てカードが重なっていた。
    `html body [class*="_container_1juw6_"]{flex-direction:column !important;width:auto !important}`,
    `html body [class*="_left_1juw6_"],html body [class*="_right_1juw6_"]{width:auto !important;`,
    `min-width:0 !important}`,
    `html body [class*="_heatmapList_14ri6_"]{width:auto !important;min-width:0 !important}`,
    // 列そのもの（自前・377px）は横スクロールで見せる。縮めるとLPの写しが読めなくなる
    `html body .hm-cols{width:auto !important;min-width:0 !important}`,
    // 左右の余白（外30px＋ペイン20px）で使える幅が290pxしか残らず、列(379px)が右へはみ出す。
    // このプロジェクトの決まりどおり、スマホでは左右の余白を作らない
    `html body [class*="_wrapper_1juw6_"],html body [class*="_left_1juw6_"],`,
    `html body [class*="_right_1juw6_"]{padding-left:0 !important;padding-right:0 !important}`,

    // ── 履歴（バージョン復元）／リンク置換のパネル（2026-09-14 本人指摘）──
    // 入れ物を `position:fixed;top:120px;right:90px`（PCの右レール前提）で置いているので、
    // 390pxでは280pxのパネルが x=-18〜270 に出て左が画面の外で切れていた。
    // スマホでは幅いっぱいにして、下のツール列の上へ出す。
    // レポート／ヒートマップの小さな面（広告データ取得日時・パラメーター設定）は
    // 押した場所の右下に出る作りで、390pxでは画面の外（x=358〜508）へ出る。下から出す形にそろえる
    `html body [data-clone-dropdown="true"] [class*="_bodyWrapper_x4j8w"]{position:fixed !important;`,
    `left:8px !important;right:8px !important;top:auto !important;`,
    `bottom:calc(56px + env(safe-area-inset-bottom,0px)) !important;width:auto !important;`,
    `max-width:none !important;max-height:60vh;overflow:auto;z-index:9500}`,
    // 吹き出しの矢印はトリガーを指すためのもの。離した位置に出すので消す
    `html body [data-clone-dropdown="true"] [class*="_arrow_x4j8w"]{display:none !important}`,

    `html body [data-clone-panel-host]{position:fixed !important;left:8px !important;`,
    `right:8px !important;top:auto !important;width:auto !important;`,
    `bottom:calc(56px + env(safe-area-inset-bottom,0px)) !important}`,
    `html body [data-clone-panel-host] [class*="_bodyWrapper_x4j8w"]{position:static !important;`,
    `left:auto !important;right:auto !important;top:auto !important;width:auto !important;`,
    `max-height:60vh;overflow:auto}`,
    `html body [data-clone-panel-host] [class*="_body_x4j8w"]{width:auto !important}`,

    // URLバーの見出しは「プレビュー」51px /「配信」20px で幅が違い、枠の始まりと大きさが
    // 揃っていなかった（2026-09-14 本人指摘）。広いほう（プレビュー）に合わせる
    `html body .sb-url-label{min-width:52px !important;display:inline-block}`,

    // ── 「比較する」パネル（2026-09-14 本人指摘「押しても何も表示されません」）──
    // openComparePanel は右レールの左端を基準に right を決めるが、スマホのレールは
    // 画面下いっぱい（left:0）なので right が画面幅を超え、パネルが画面の外に置かれていた。
    // インラインの top/right/width/height を打ち消して全画面にする（下のツール列より手前）。
    `html body .sb-cmp-panel{top:0 !important;right:0 !important;left:0 !important;`,
    `bottom:0 !important;width:auto !important;height:100dvh !important;max-width:none !important;`,
    `border-radius:0 !important;z-index:9500 !important}`,
    // 角をつまんで大きさを変える操作は指では使えない
    `html body .sb-cmp-resize{display:none !important}`,

    // ── 横スクロールできる場所の合図（2026-09-14 本人指摘）──
    // 端に「続きがある」影を出す。地の色と同じ覆いを local に、影を scroll に置くと、
    // 端まで動かしたときだけ影が消える（＝続きがある間だけ出る）
    `html body .sb-m-scrollable,`,
    `html body .sb-tabbar,`,
    `html body [class*="_navContainer_"],`,
    `html body [data-widget-toolbar],`,
    `html body .hm-cols,`,
    `html body [class*="css-1rr4qq7"],`,
    `html body [class*="css-m7q6f4"] [class*="css-19sre7e"]>div{`,
    `background-image:linear-gradient(to right,var(--sb-surface),transparent),`,
    `linear-gradient(to left,var(--sb-surface),transparent),`,
    `linear-gradient(to right,rgba(0,0,0,.24),transparent),`,
    `linear-gradient(to left,rgba(0,0,0,.24),transparent);`,
    `background-position:left center,right center,left center,right center;`,
    `background-repeat:no-repeat;`,
    `background-size:28px 100%,28px 100%,16px 100%,16px 100%;`,
    `background-attachment:local,local,scroll,scroll}`,

    // ── LP設定（記事設定）モーダル（2026-09-14 本人指摘「文字が入りきってない」）──
    // 実物は1行に3つ（width:30%）・余白は4つ（22%）並べる作り。390pxでは枠が100px/73pxしか
    // 残らず、(1)右から30pxに絶対配置された単位「px」が入力値と重なり、
    // (2)「文字色」の見出しが1文字ずつ縦に割れていた。1行2つにして、見出しは折り返さない。
    // width:50% だけでは1行1つのまま。box-sizing が content-box で左右に10pxの余白が
    // 足されるため、50%(167px)+20px が2つで374px となり枠(334px)に収まらない（実測）
    `html body [class*="_formGroup_qyxur_"],`,
    `html body [class*="_paddingFormGroup_qyxur_"]{width:50% !important;`,
    `box-sizing:border-box !important}`,
    `html body [class*="_masterCssFormWrapper_qyxur_"] label,`,
    `html body [class*="_formGroup_qyxur_"]>label{white-space:nowrap !important}`,
    // 単位は枠の端へ寄せ、入力値はその手前で止める
    `html body [class*="_formGroup_qyxur_"]::before,`,
    `html body [class*="_paddingFormGroup_qyxur_"]::before{right:8px !important}`,
    // 右の余白は「px」が付く欄だけ（_pixcelForm_）。全部に掛けると、幅65pxしかない
    // 文字色の16進欄で値が右へ押し出されて見えなくなる（実測で発覚）
    `html body [class*="_pixcelForm_qyxur_"] input{padding-right:28px !important}`,
    // 入りきらない値（フォント名など）は途中で断ち切らず「…」で示す
    `html body [class*="_formGroup_qyxur_"] input{text-overflow:ellipsis}`,
    // 文字色は「見出し＋#＋16進6桁＋色見本」を1つの行に入れるので、半分の幅(167px)では
    // 見出しが2行に割れ、16進の値も切れる。この行だけ幅いっぱいにする
    `html body [class*="_fontColorForm_qyxur_"]{width:100% !important}`,
    `html body [class*="_fontColorForm_qyxur_"] input[type="text"]{flex:1 1 auto !important;`,
    `min-width:0 !important;padding-right:12px !important}`,
    // 色見本（input type=color）は28pxで、押せるものだと分かりにくく指でも狙いにくい
    `html body [class*="_formGroup_qyxur_"] input[type="color"]{width:48px !important;`,
    `height:38px !important;margin-left:8px !important;padding:0 !important;`,
    `border:1px solid var(--sb-line) !important;border-radius:6px !important;`,
    `box-shadow:0 1px 2px rgba(0,0,0,.12)}`,

    // ── ツール画面（2026-09-14・全画面の実測で見つけた「文字が入りきらない」箇所）──
    // マジック置換: 操作列は5つ横並び（合計745px）で折り返さないため、タブと2つ目の検索欄と
    // 「リセット」が画面の外（x=363〜744）にいて、タブは36pxに潰れて縦に割れていた
    `html body .br-bar{flex-wrap:wrap !important}`,
    `html body .br-bar>*{min-width:0 !important}`,
    `html body .br-search{width:auto !important;flex:1 1 150px !important;min-width:0 !important}`,
    `html body .br-tab{white-space:nowrap !important}`,
    `html body .br-reset{margin-left:0 !important;white-space:nowrap !important}`,
    // メディア: 2段組み（grid）で右の欄が26pxになり、説明文が1文字ずつ縦に割れていた
    `html body .md-body{grid-template-columns:1fr !important}`,
    `html body .md-left,html body .md-right{width:auto !important;min-width:0 !important}`,
    // 審査: 絞り込みチップ5つが横1列で1つ63pxに潰れ、「すべて 0」が2行に割れていた
    `html body .ins-chips{flex-wrap:wrap !important}`,
    `html body .ins-chip{white-space:nowrap !important}`,

    // 2段・3段組みの画面は縦に積む（横並びのままだと片側が数十pxに潰れ、
    // 文字が1文字ずつ縦に割れたり、ペインごと画面の外へ出る）
    `html body .br-panes{grid-template-columns:1fr !important;padding:0 0 14px !important}`,
    `html body .cvt-body{grid-template-columns:1fr !important}`,
    `html body .cvt-detail-col{padding:24px 12px !important}`,
    // 審査の行: 操作ボタン3つ＋バッジで330pxを使い切り、ページ名の欄が幅0になって消えていた
    `html body .ins-entry{flex-wrap:wrap !important}`,
    `html body .ins-entry-main{flex:1 0 100% !important;min-width:0 !important}`,
    // 離脱防止ポップの編集タブ6つ（基本/デザイン/表示/位置/出し分け/HTML）は横に流す
    // 上のボタン列（プレビュー/下書きを確認/下書き反映/本番反映）は4つで幅が足りず、
    // 「下書き反/映」と1文字だけ落ちていた。折り返しは列ごとにして、文字は割らない
    `html body .ep-editor-btn-bar{flex-wrap:wrap !important;gap:8px;padding:10px 12px !important}`,
    `html body .ep-editor-btn-bar button{white-space:nowrap !important}`,
    `html body .ep-editor-tabs{overflow-x:auto;scrollbar-width:none}`,
    `html body .ep-editor-tabs::-webkit-scrollbar{display:none}`,
    `html body .ep-editor-tabs>*{flex:0 0 auto;white-space:nowrap;padding:10px 12px !important}`,
    // 一括タグの設置範囲: 右のチェック欄に180px固定で、左の説明が70pxになっていた
    `html body .bt-scope-row{flex-direction:column !important}`,
    `html body .bt-scope-left{max-width:none !important}`,
    `html body .bt-multi{min-width:0 !important}`,
    // 除外条件の表は6列nowrap。枠の中で横に流す（ページごと横へずれるのを防ぐ）
    `html body .rx-card{overflow-x:auto;margin-left:0 !important;margin-right:0 !important}`,
    // 左右の余白（24〜28px）で使える幅が4分の3になる。スマホは詰める
    `html body .bt-page{padding:12px 0 !important}`,
    `html body .bt-form-inner{padding:14px 12px !important}`,
    `html body .rx{padding:14px 0 !important}`,
    `html body .tc{padding:14px 0 !important}`,
    `html body .bi-page{padding:14px 0 !important}`,

    // ── 浮いている部品（2026-09-14・パネルの総点検）──
    // Versionの「…」メニューは採取物がPCの座標（left:288px）をインラインで持っているため、
    // 390pxでは右へはみ出して読めない・押せない。画面の下に幅いっぱいで出す
    `html body .MuiPopover-root .MuiPopover-paper{left:8px !important;right:8px !important;`,
    `top:auto !important;bottom:calc(12px + env(safe-area-inset-bottom,0px)) !important;`,
    `width:auto !important;max-width:none !important}`,
    // コード欄: スマホは入力欄を16pxにするので、行番号と色付き表示も同じ大きさに揃える
    // （揃えないとカーソルが文字とずれ、行番号も合わなくなる）
    `html body [data-code-font]{font-size:16px !important}`,
    // Widget作成画面: 右の列が280px固定で、左の入力欄が60pxに潰れていた
    `html body [data-widget-creator-editor]{flex-direction:column !important;padding:0 12px 16px !important}`,
    `html body [data-widget-creator-editor]>*{width:auto !important;min-width:0 !important}`,
    `html body [data-widget-creator-meta]{flex-wrap:wrap !important;padding:14px 12px !important}`,
    `html body [data-widget-creator-meta]>*{min-width:0 !important}`,
    // 画像の「リンク／計測URL」ポップオーバーは min-width:340px＋余白で374px。幅いっぱいに置く
    `html body .sb-img-link-popover{min-width:0 !important;left:8px !important;right:8px !important;`,
    `width:auto !important;max-width:none !important}`,
    // キャンバスの自前スクロールバー（14px）は指では掴めず、LP右端のタップを奪うだけ
    `html body [data-clone-scrollbar]{display:none !important}`,

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

    // ── レポートの表: 1行＝1カードにする ──
    // 15列を375pxに詰めると4列しか見えず、残りは横スクロールの向こう側で読めない。
    // 列見出しは消して、セルが持つ列名（data-label）と値を左右に並べる。
    `html body .rv2-card .rv2-scroll{overflow-x:visible !important}`,
    `html body .rv2-card .rv2-table{display:block !important;width:100% !important}`,
    `html body .rv2-card .rv2-table thead{display:none !important}`,
    `html body .rv2-card .rv2-table tbody{display:block !important}`,
    `html body .rv2-card .rv2-table tbody tr{display:block !important;padding:8px 12px;`,
    `border-bottom:1px solid var(--sb-line) !important}`,
    `html body .rv2-card .rv2-table tbody td{display:flex !important;align-items:baseline;`,
    `justify-content:space-between;gap:12px;width:auto !important;`,
    `padding:4px 0 !important;border:0 !important;text-align:left !important;white-space:normal !important}`,
    `html body .rv2-card .rv2-table tbody td::before{content:attr(data-label);color:var(--sb-sub);`,
    `font-size:11px;flex-shrink:0}`,
    // 1列目（名前・日付）はカードの見出しにする。列名は出さない
    `html body .rv2-card .rv2-table tbody td:first-child{display:block !important;font-weight:700;`,
    `padding:2px 0 8px !important;overflow-wrap:anywhere}`,
    `html body .rv2-card .rv2-table tbody td:first-child::before{content:none}`,
    // 中身が無いセル（操作ボタン用の空き列・パラメータ行の配信割合）は行を作らない
    `html body .rv2-card .rv2-table tbody td:empty{display:none !important}`,
    // 既定は主要な指標だけ（15列ぜんぶ縦に並べるとカード1枚が14行になる）。
    // 「すべての指標」で残りも出す
    `html body .rv2-metrics-toggle{display:inline-flex !important;align-items:center;min-height:38px}`,
    `html body .rv2-card .rv2-table tbody td[data-more]{display:none !important}`,
    `html body .rv2-card .rv2-table.show-all tbody td[data-more]{display:flex !important}`,
    // 合計の行はカードごと目立たせる
    `html body .rv2-card .rv2-table tbody tr.rv2-total{background:#f7f9fc}`,
    // Version の下にぶら下がる広告の行は、字下げでなく左の線で親との関係を示す
    // （字下げだと名前が長い広告パラメータで折り返して読みにくい）
    `html body .rv2-card .rv2-table tbody tr.rv2-sub{border-left:3px solid var(--sb-accent);`,
    `padding-left:12px;background:#fcfdff}`,
    `html body .rv2-card .rv2-table tbody tr.rv2-sub td:first-child{padding-left:0 !important;`,
    `font-weight:600;font-size:12px}`,
    // 見出しの並び（タイトル・注記・ボタン）は縦積みにして、ボタンを押しやすくする
    `html body .rv2-card .rv2-head{flex-wrap:wrap !important;gap:8px !important}`,
    `html body .rv2-card .rv2-head-right{margin-left:auto;flex-wrap:wrap !important;gap:8px !important}`,
    // ボタンの文字は折り返さない（「すべての指標」が「すべての指／標」に割れていた）。
    // 折り返すのはボタンとボタンの間だけにする
    `html body .rv2-card .rv2-btn{min-height:38px;white-space:nowrap !important}`,
    // Branch Operation の絞り込みは1列に積む（横並びだと入力が潰れる）
    `html body .rv2-branch-filter{flex-direction:column !important}`,
    `html body .rv2-branch-field{width:100%}`,
    `html body .rv2-branch-field select,html body .rv2-branch-field input{width:100% !important;`,
    `min-width:0 !important;min-height:38px}`,
    // クリエイティブの広告パラメータ行: 長い名前で値が押し出されないようにする
    `html body .rv2-creative-param-name{min-width:0;flex:1 1 auto}`,
    // 右の「比較枠」は中身が無いときに画面1枚ぶん取ってしまう。スマホでは薄くする
    `html body .rv2-chart-row{flex-direction:column !important}`,
    `html body .rv2-chart-row .rv2-empty{padding:18px 12px !important}`,
    // ヒートマップの見出し（期間・スクロール表示/全ページ表示・ソート）は横1列だと
    // 期間の枠が101pxまで潰れて「2026/09/15 ~」が途中で折り返す。折り返して1行ずつにする
    `html body [class*="_header_187ph_"]{flex-wrap:wrap !important;gap:8px;padding:8px 12px !important}`,
    `html body [class*="_header_187ph_"] [class*="_left_187ph_"]{flex:1 1 100% !important}`,
    `html body [class*="_datesWrapper_187ph_"]{white-space:nowrap}`,

    // ファネル: 段ごとにまとめる（3列のままだと棒が細くなり、列ごとに積むと
    // 経路が3つ続いたあとに数値が3つ続く、という読めない並びになる）
    `html body .rv2-funnel-body{display:block !important}`,
    `html body .rv2-funnel-headgroup{display:none !important}`,
    `html body .rv2-funnel-scales{display:none !important}`,
    `html body .rv2-funnel-row{display:block !important;padding:8px 0;`,
    `border-bottom:1px solid var(--sb-line)}`,
    `html body .rv2-funnel-row .rv2-funnel-cell{height:auto !important}`,
    `html body .rv2-funnel-name{font-weight:700}`,
    `html body .rv2-funnel-count{color:var(--sb-sub);padding-bottom:4px}`,
    `html body .rv2-funnel-bars{padding:2px 0 0 !important}`,
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

    // ── レポート設定「表示するパラメータ」: 表を1行＝1カードにする ──
    // 4列を375pxに詰めると、見出しも行の名前も1文字ずつ縦に割れて読めなくなる。
    // どの列かはセルの data-label（採取した thead から取っている）で出す。
    `html body [class*="_scopeTable_"]{display:block !important;width:100% !important}`,
    `html body [class*="_scopeTable_"] thead{display:none !important}`,
    `html body [class*="_scopeTable_"] tbody{display:block !important}`,
    `html body [class*="_scopeTable_"] tbody tr{display:block !important;`,
    `border:1px solid var(--sb-line) !important;border-radius:10px;margin:0 0 10px !important;`,
    `padding:8px 12px !important;background:var(--sb-surface) !important}`,
    // 採取CSSはセルに幅180px・高さ76pxを置いている（PCの表のため）。
    // カードにするときはどちらも外さないと、名前の右に灰色の空きが残って行も間延びする。
    `html body [class*="_scopeTable_"] tbody td{display:flex !important;align-items:center;`,
    `justify-content:space-between;gap:12px;width:100% !important;max-width:none !important;`,
    `min-width:0;height:auto !important;box-sizing:border-box;`,
    `padding:7px 0 !important;border:0 !important;text-align:left !important;`,
    `background:transparent !important}`,
    `html body [class*="_scopeTable_"] tbody td::before{content:attr(data-label);`,
    `color:var(--sb-sub);font-size:12px;flex-shrink:0}`,
    // 行の名前（utm_source など）はカードの見出しにする
    // 採取CSSの max-width:180px も外す（外さないと名前の右に灰色の空きが残る）
    `html body [class*="_scopeTable_"] tbody td[class*="_nameCell_"]{display:block !important;`,
    `width:100% !important;max-width:none !important;height:auto !important;`,
    `font-weight:700;padding:4px 0 8px !important;border-bottom:1px solid var(--sb-line) !important;`,
    `margin-bottom:4px}`,
    `html body [class*="_scopeTable_"] tbody td[class*="_nameCell_"]::before{content:none}`,
    // メモは幅いっぱいの入力にする（横に並べると1行も入らない）
    `html body [class*="_scopeTable_"] tbody td[class*="_memoCell_"]{display:block !important;`,
    `width:100% !important;height:auto !important;padding:4px 0 8px !important}`,
    `html body [class*="_scopeTable_"] tbody td[class*="_memoCell_"]::before{display:block;padding-bottom:4px}`,
    `html body [class*="_scopeTable_"] tbody td[class*="_memoCell_"] textarea{width:100% !important}`,
    // トグルは右端に寄せる（中央寄せのままだと列名と重なって見える）
    `html body [class*="_scopeTable_"] tbody td [class*="_toggleSwitchWrapper_"]>*{margin:0 !important}`,
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
