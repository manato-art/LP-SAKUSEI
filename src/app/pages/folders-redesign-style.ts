/**
 * ページ一覧の見た目（2026-10-27 本人「こんな感じにリデザインしたい」＋見本の画像）。
 * 見本: 淡い灰色の地に白い角丸の面（フォルダ一覧・ページの表・右の詳細）／選んでいるフォルダと行は淡い青／
 * フォルダ名は青い四角のフォルダのしるし＋大きな太字＋「Nページ」／表の見出しは淡い灰色の帯／
 * 行の左にページの画像・状態は丸い札（●準備中）・数字の下に直近7日の小さい棒グラフ（列ごとの色）／
 * 右の詳細は見出しが淡い灰色の帯・青い枠のボタン。
 *
 * 採取した見た目の上から当てるので、頭に html body と印（data-pl-v2）を付けて強くする。
 * 印は `data-lp…` で始めない（暗い表示の仕組みが LP の中身と見て飛ばす・KB-2026-10-27-010）。文字の黒・灰色は青みを付けない（同じ理由）。
 * 青と淡い青はアプリのテーマの色（--sb-accent・--sb-accent-tint）。
 */
const STYLE_ID = 'page-list-v2-style'

/** ページ一覧の印（folders-page-list.ts が一覧の本体に付ける） */
export const PAGE_LIST_ATTR = 'data-pl-v2'

const R = `html body [${PAGE_LIST_ATTR}]`
const CANVAS = '#F4F6F9'
const LINE = '#E6E9EE'
const INK = '#1A1A1A'
const SUB = '#555555'
const MUTED = '#8A8A8A'
const BLUE = 'var(--sb-accent, #1178F3)'
const TINT = 'var(--sb-accent-tint, #EAF3FE)'
/** 白い面 */
const CARD = `background:#FFFFFF !important;border:1px solid ${LINE};border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.04)`
/** KPI の列の幅（見出し・合計・行で同じにする）。配信ステータスの列は札が入るので広く */
const col = (px: number): string => `width:${px}px !important;min-width:${px}px !important;max-width:${px}px !important;flex:none !important`
/** 名前の列の幅（採取物は 340px。見本のように数字の列を多く見せるため細くする） */
const NAME_W = 232
/**
 * 行の数字の列が始まる位置（表の左から）。行の外側の余白 8px＋行の内側 16px＋名前の列＋間 8px
 * （ここから KPI の容器・その中の左の余白 8px のあと列が並ぶ）。見出し・合計もこの位置にそろえる
 */
const KPI_LEFT = 8 + 16 + NAME_W + 8

/**
 * 棒グラフの色（列＝指標ごと）。見本のとおり、関係の近い指標は同じ色。
 * dataviz の検証ツールで隣どうしの見分け・色覚の見分けを確かめた7色（数字は棒の上に文字で出すので、薄い色も読める）
 */
const SPARK_COLORS: Readonly<Record<string, string>> = {
  ad_cost: '#2a78d6',
  pv: '#2a78d6',
  click: '#eb6834',
  ctr: '#eb6834',
  cv: '#1baf7a',
  cvr: '#1baf7a',
  ctvr: '#6250d6',
  cpa: '#e87ba4',
  mcpa: '#e87ba4',
  media_click: '#eda100',
  media_ctr: '#eda100',
  roas: '#008300',
}

const sparkColorRules = Object.entries(SPARK_COLORS)
  .map(([metric, color]) => `${R} .pl-spark[data-metric="${metric}"] .pl-spark__bar{background:${color}}`)
  .join('\n')

const CSS = `
/* 地 */
${R}, ${R} .e11hwzd01, ${R} .efy50tl22, ${R} [data-testid="side-menu"]{background:${CANVAS} !important}
${R} [data-testid="side-menu"]{border-right:none !important}

/* 左: 検索・フォルダ一覧（白い面） */
${R} [data-testid="side-menu"] .e1krw8ps2{padding:12px 12px 8px !important;border-bottom:none !important}
${R} [data-testid="side-menu"] .e1krw8ps2 > button.ehjzppn1{flex:1;justify-content:flex-start;height:38px !important;padding:0 12px !important;border:1px solid ${LINE} !important;border-radius:10px !important;background:#FFFFFF !important;color:${SUB} !important}
${R} .efy50tl25{margin:0 12px 12px;${CARD};overflow:hidden}
${R} .efy50tl14{padding:0 8px !important;border-bottom:1px solid ${LINE} !important;background:#FFFFFF !important}
${R} .eyrb9320{height:44px !important;padding:0 12px !important;border-radius:0 !important;background:transparent !important;font-size:14px !important;font-weight:600;color:${SUB} !important;border-bottom:2px solid transparent !important}
${R} .eyrb9320.css-7nmmet{color:${BLUE} !important;border-bottom-color:${BLUE} !important}
${R} .efy50tl6{padding:12px 12px 4px !important;border-bottom:none !important}
${R} .efy50tl6 .e1bzrf8x8{height:36px !important;border:1px solid ${LINE} !important;border-radius:10px !important;background:#FFFFFF !important}
${R} [data-folder-uid]{margin:2px 8px;border-radius:10px;cursor:pointer}
${R} [data-folder-uid]:hover{background:#F6F8FA}
${R} [data-folder-uid][data-pl-current]{background:${TINT}}
${R} [data-folder-uid] .ea00ncb3{font-size:14px !important;color:${INK} !important}
/* お気に入り・設定のアイコンは、カーソルを当てたときだけ場所を取る（名前が切れていた） */
${R} [data-folder-uid]:not(:hover) .ea00ncb4{display:none !important}
${R} [data-folder-uid][data-pl-current] .ea00ncb3{font-weight:700}

/* 上の段: フォルダ内検索・新規ページを作成・集計期間・配信ステータス */
${R} .efy50tl22 > .e1ti96lw2{background:transparent !important;padding:12px 12px 8px !important;border-bottom:none !important}
/* 右の詳細が出ているあいだは、上の段をその手前で止める（配信ステータスが詳細の下に隠れていた） */
${R} .efy50tl22:has(> .efy50tl23:not([data-collapsed="true"])) > .e1ti96lw2{padding-right:352px !important}
${R} .efy50tl12 button.ehjzppn1, ${R} .efy50tl12 .ehjzppn1{height:38px !important;border-radius:10px !important;font-weight:600}
${R} .efy50tl0{background:${TINT} !important;color:${BLUE} !important;border:1px solid transparent !important}
${R} .e5a3hxd1, ${R} .e8c3jcp1{height:38px !important;border:1px solid ${LINE} !important;border-radius:10px !important;background:#FFFFFF !important;color:${INK} !important}

/* ページの表（白い面） */
${R} .efy50tl20{padding:0 12px 12px !important;box-sizing:border-box}
${R} .efy50tl19{${CARD};overflow:hidden}
/* フォルダ名の段を表の見出しより上に・フォルダの合計は見出しのすぐ下の「合計」の段に（見本の並び）。
   採取物はフォルダ名と合計が1つの段なので、段を外して（display:contents）2つを別々に並べる */
${R} .en4zj406{display:contents !important}
/* フォルダを選ぶ前は、取り込み物の仮の数字の段を隠す（folders.ts の hidePageListAndDetail が行に display:none を書く・指示141）。それを上書きしない */
${R} .en4zj406[style*="display: none"]{display:none !important}
${R} .en4zj405{order:-1;width:auto !important;max-width:none !important;height:76px !important;flex:none !important;align-items:center !important;gap:10px;padding:0 16px !important;background:#FFFFFF !important;border-bottom:1px solid ${LINE}}
${R} .en4zj403{margin-left:auto}
${R} .en4zj402{flex:none !important;width:auto !important;height:40px !important;padding-left:8px !important;align-items:center;background:#FBFBFC !important;border-bottom:1px solid ${LINE}}
${R} .en4zj402::before{content:"合計";flex:none;box-sizing:border-box;${col(KPI_LEFT)};padding-left:24px;font-size:12px;font-weight:700;color:${SUB}}
${R} .en4zj405 [data-testid="folder-icon"]{box-sizing:content-box;width:20px !important;height:20px !important;padding:10px;border-radius:10px;background:${TINT};color:${BLUE};fill:currentColor}
${R} .en4zj404{font-size:22px !important;font-weight:800 !important;color:${INK} !important;max-width:none !important}
${R} .pl-count{flex:none;font-size:13px;color:${MUTED};white-space:nowrap}
${R} .en4zj403 button{height:34px !important;border:1px solid ${LINE} !important;border-radius:10px !important;background:#FFFFFF !important}
/* フォルダの合計（列の数字の合計） */
${R} .en4zj401{font-size:13px !important;font-weight:700;color:${SUB} !important;text-align:center}
/* 表の見出し */
${R} .efy50tl8, ${R} .efy50tl8 > div, ${R} .el51yfs3{background:#F7F8FA !important}
${R} .efy50tl8{height:40px !important;padding-left:${KPI_LEFT}px !important;border-bottom:1px solid ${LINE} !important;align-items:center}
/* 名前の列の見出し（採取物は影の付いた白い箱だけ）＝「ページ名」 */
${R} .efy50tl8::before{content:"ページ名" !important;${col(KPI_LEFT)};height:40px !important;display:flex;align-items:center;box-sizing:border-box;padding-left:24px;background:#F7F8FA !important;box-shadow:none !important;font-size:12px;font-weight:600;color:${SUB}}
${R} .el51yfs3, ${R} .e14sgd471{padding-left:8px !important}
${R} .el51yfs1, ${R} .el51yfs0{justify-content:center !important;padding-left:0 !important;white-space:nowrap}
/* 横に送れる量を、見出し・合計・行でそろえる（そろえて送る＝folders-list-scroll-sync.ts）。
   見出しの文字の箱（100px）は列（68px）からはみ出さない・列の設定の歯車は上に重ねる・右端の余白は同じだけ */
${R} .el51yfs0{width:100% !important;min-width:0 !important}
${R} .efy50tl7{position:absolute !important;right:0;top:0;height:40px !important;background:#F7F8FA !important;z-index:1}
${R} .e14sgd471{padding-right:48px !important}
${R} .el51yfs3, ${R} .en4zj402{padding-right:56px !important}
${R} .efy50tl8 *{font-size:12px !important;color:${SUB} !important;font-weight:600}
/* KPI の列の幅をそろえる（見出し・合計・行） */
${R} .el51yfs1, ${R} .en4zj400, ${R} .e14sgd470:first-child{${col(92)}}
${R} .ej9gexd0, ${R} .en4zj401, ${R} .e14sgd470:not(:first-child){${col(68)}}
/* ページの行 */
${R} [data-ab-test-uid] > [data-testid="list-menu-item"]{margin:4px 8px;border-radius:12px;width:auto !important;background:#FFFFFF !important}
${R} [data-ab-test-uid] .ehlzdh014{${col(NAME_W)};box-shadow:none !important}
/* 行どうしの仕切り線（指示㉞） */
${R} .efy50tl18 > [data-ab-test-uid]{border-bottom:1px solid ${LINE}}
${R} [data-ab-test-uid]:hover > [data-testid="list-menu-item"]{background:#F7F9FC !important}
${R} [data-ab-test-uid][data-pl-shown] > [data-testid="list-menu-item"]{background:${TINT} !important}
${R} .ehlzdh014{align-items:center !important;gap:12px}
${R} [data-ab-test-uid] .ec7ecxf1{flex:none;display:flex;align-items:center;justify-content:center;width:44px !important;height:56px !important;border-radius:8px;background:#F1F3F6;color:${MUTED};overflow:hidden}
${R} [data-ab-test-uid] .ec7ecxf1 .pl-thumb{width:100%;height:100%;object-fit:cover;display:block}
${R} .ehlzdh09{font-size:15px !important;font-weight:700 !important;color:${INK} !important}
/* 状態は右の列の札で出すので、名前の下の「準備中」は出さない */
${R} .ehlzdh06{display:none !important}
${R} .ehlzdh05{color:${SUB} !important;font-size:12px !important}
${R} .ehlzdh04, ${R} .ehlzdh04 *{font-size:11px !important;color:${MUTED} !important}
/* 状態の札（●準備中）。押しても何も起きない下向きの矢印は出さない */
${R} .e162nxgg1{display:none !important}
${R} .ejtacxq0{display:inline-flex !important;align-items:center;gap:6px;height:26px !important;padding:0 10px !important;border-radius:999px !important;font-size:12px !important;font-weight:700;white-space:nowrap;background:#EEF0F3 !important;color:${SUB} !important;border:none !important}
${R} .ejtacxq0::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
${R} .ejtacxq0[data-ad-status="prepared"]{background:#FFF1D6 !important;color:#9A5B00 !important}
${R} .ejtacxq0[data-ad-status="delivered"]{background:#DDF5E8 !important;color:#0B6B36 !important}
/* 暗い表示の札（色付きの文字は暗い表示の仕組みが明るくしないので、ここで決める。印を2つ重ねて仕組みの写しより強くする） */
html[data-theme="dark"] body [${PAGE_LIST_ATTR}][${PAGE_LIST_ATTR}] .ejtacxq0[data-ad-status="prepared"]{background:rgba(245,158,11,.18) !important;color:#F5B94A !important}
html[data-theme="dark"] body [${PAGE_LIST_ATTR}][${PAGE_LIST_ATTR}] .ejtacxq0[data-ad-status="delivered"]{background:rgba(22,163,74,.2) !important;color:#5BD08A !important}
/* 数字と、その下の直近7日の棒グラフ */
${R} .e14sgd470{display:flex !important;flex-direction:column;align-items:center;justify-content:center;gap:6px}
${R} .pl-value{font-size:14px;font-weight:700;color:${INK};font-variant-numeric:tabular-nums;white-space:nowrap}
${R} .pl-spark{display:flex;align-items:flex-end;gap:2px;width:49px;height:20px}
${R} .pl-spark__bar{flex:1;min-height:2px;border-radius:2px 2px 0 0}
${R} .pl-spark__bar--zero{height:2px;opacity:.35}
${R} .pl-spark__bar--none{height:2px;background:#E1E4E8 !important}
${sparkColorRules}

/* 右の詳細（白い面） */
${R} .efy50tl23{background:${CANVAS} !important;padding:12px 12px 12px 0;box-sizing:border-box}
${R} .efy50tl23:has(.efy50tl16[style*="display: none"]) > .e1ti96lw2{display:none !important}
${R} .efy50tl23 > .e1ti96lw2{background:#FFFFFF !important;border:1px solid ${LINE};border-bottom:none;border-radius:14px 14px 0 0;padding:14px 16px !important}
${R} .efy50tl3{font-size:17px !important;font-weight:800 !important;color:${INK} !important}
${R} .efy50tl16{height:auto !important;background:#FFFFFF !important;border:1px solid ${LINE};border-top:none;border-radius:0 0 14px 14px;padding-bottom:16px}
${R} .ej6u9q11{margin:8px 12px 0 !important;padding:0 12px !important;height:40px;display:flex;align-items:center;border-radius:8px !important;background:#F2F4F7 !important;border:none !important}
${R} .ej6u9q11 .e3e36wb1{display:flex !important;align-items:center;justify-content:space-between;width:100%}
${R} .ej6u9q11 *{font-size:14px !important;font-weight:700;color:${INK} !important}
${R} .e1ugh7py2{font-size:13px !important;padding:3px 0}
${R} .e1ugh7py2 dt{color:${SUB} !important}
${R} .e1ugh7py2 dd{color:${INK} !important}
${R} .efy50tl16 .MuiButton-outlined{height:44px;border:1px solid ${BLUE} !important;border-radius:10px !important;color:${BLUE} !important;font-size:15px !important;font-weight:700 !important}
${R} .efy50tl16 ._trigger_11n4w_113:has(> .MuiButton-root){display:block !important;margin:16px 16px 0 !important}
${R} .efy50tl16 ._trigger_11n4w_113 > .MuiButton-root{width:100% !important}
${R} .efy50tl16 ._trigger_11n4w_113[data-tracking-tag-btn], ${R} .efy50tl16 ._trigger_11n4w_113[data-meta-link-btn]{display:inline-block !important;margin:12px 0 0 16px !important;color:${BLUE};font-size:13px;font-weight:600}
`

/** ページ一覧の見た目を1回だけ入れる */
export function ensurePageListStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.append(style)
}
