/**
 * スマホ対応（2026-09-13・本人指示「ただ小さくするのでなくスマホ用に合わせる」）。
 *
 * 過去に決めた方針（[[feedback_mobile_native_not_shrink]] / [[feedback_mobile_card_menu_ui]] /
 * [[feedback_no_side_padding]]）に沿っているかを機械で押さえる:
 *   - PCの見た目を変えない（変更はすべて @media の中）
 *   - 左右の余白を作らない・タップ44px・入力16px
 *   - 縦に長く並べない（フォルダは2列、指標はカードに3つだけ）
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MOBILE_MAX_WIDTH, isMobileWidth } from '../src/app/mobile/viewport.ts'
import { mobileCss } from '../src/app/mobile/mobile-css.ts'
import { BOTTOM_NAV_ITEMS, MORE_ITEMS, isActiveTab, showsBottomNav } from '../src/app/mobile/bottom-nav.ts'
import { cardDetailMetrics, cardMetrics } from '../src/app/mobile/page-card.ts'
import type { ReportKpi } from '../src/app/api.ts'

describe('どこからスマホ扱いにするか', () => {
  it('768px以下がスマホ（CSSのブレークポイントと同じ）', () => {
    expect(isMobileWidth(375)).toBe(true)
    expect(isMobileWidth(MOBILE_MAX_WIDTH)).toBe(true)
    expect(isMobileWidth(MOBILE_MAX_WIDTH + 1)).toBe(false)
    expect(isMobileWidth(1280)).toBe(false)
  })

  it('CSSとTypeScriptで同じ幅を使う（ずれると見た目と中身が噛み合わない）', () => {
    expect(mobileCss()).toContain(`@media (max-width:${MOBILE_MAX_WIDTH}px)`)
  })
})

describe('PCの見た目を変えない', () => {
  it('スマホ用のCSSはすべて @media の中にある', () => {
    const css = mobileCss()
    const open = css.indexOf('{')
    expect(css.startsWith('@media')).toBe(true)
    // @media の外に規則を書いていない（閉じ括弧は最後の1つだけ）
    expect(css.slice(open).lastIndexOf('}')).toBe(css.slice(open).length - 1)
  })
})

describe('スマホの決まりごと', () => {
  const css = mobileCss()

  it('PC用の細いレールは出さない（下部タブバーに置き換える）', () => {
    expect(css).toContain('.sb-rail{display:none')
  })

  it('左右の余白を作らない', () => {
    expect(css).toContain('padding-left:0')
    expect(css).toContain('padding-right:0')
  })

  it('タップは44px、入力の文字は16px', () => {
    expect(css).toContain('min-height:44px')
    expect(css).toContain('font-size:16px')
  })

  it('ホームバーのぶんの余白を空ける', () => {
    expect(css).toContain('env(safe-area-inset-bottom')
  })

  it('表は1行＝1カードにして、列名をセルの中に出す', () => {
    expect(css).toContain('.sb-data-head{display:none')
    expect(css).toContain('.sb-data-row{display:block')
    expect(css).toContain('content:attr(data-label)')
  })

  it('数値タイルは2列（1列だと延々と縦に伸びる）', () => {
    expect(css).toContain('.sb-kpi-grid{grid-template-columns:1fr 1fr')
  })

  it('画面の枠は左右の余白と角丸を外す', () => {
    expect(css).toContain('.sb-page-card{border-radius:0')
  })
})

describe('LPエディタのスマホ版', () => {
  const css = mobileCss()

  it('Version一覧とプロパティはしまい、合図が付いたときだけ下から出す', () => {
    expect(css).toContain('[class*="_abTestArticlesWrapper_"],html body .sb-props-panel{display:none')
    expect(css).toContain('sb-m-versions-open')
    expect(css).toContain('sb-m-props-open')
  })

  it('編集ツールは画面の下に横並びで固定する', () => {
    expect(css).toContain('[class*="_sideToolbarWrapper_"]{position:fixed')
    expect(css).toContain('flex-direction:row')
  })

  it('採取CSSの負のマージンを消す（消さないと下へずれてラベルが画面の外で切れる）', () => {
    expect(css).toContain('margin:0 !important')
    expect(css).toContain('bottom:0 !important')
  })

  it('編集ツールは8項目が横スクロールなしで収まる幅（狭い端末360pxでも）', () => {
    const m = /_sideToolbarIcon_"\]\{width:(\d+)px/.exec(css)
    expect(m).not.toBeNull()
    const width = Number(m?.[1])
    expect(width * 8 + 8).toBeLessThanOrEqual(360)
    // 指が当たる大きさ（44px）は下回らない
    expect(width).toBeGreaterThanOrEqual(44)
  })

  it('エディタのCSSは後から注入されるので、詳細度を上げて勝たせる', () => {
    for (const rule of ['_abTestArticlesWrapper_', '_sideToolbarWrapper_', '_editorWrapper_']) {
      expect(css, rule).toContain(`html body [class*="${rule}"]`)
    }
  })

  it('モーダルは画面いっぱいにする（PC幅前提の1200pxで左右が画面の外へ出ていた）', () => {
    expect(css).toContain('.MuiDialog-container>.MuiPaper-root{width:100% !important')
    expect(css).toContain('.MuiDialogContent-root{width:auto !important')
    // flexの子は min-width:auto のままだと中身より小さくならない
    expect(css).toContain('min-width:0 !important')
  })

  it('Widgetのカード一覧は1列にする（3列だと画面に入らない）', () => {
    expect(css).toContain('.css-ojejk4>.MuiCard-root{flex:0 0 100% !important')
  })

  it('Widgetライブラリのカテゴリーは左から出す引き出しにする', () => {
    // 2026-09-14 本人指示「カテゴリーはプルダウン式に。左側からメニューが出てくる感じ」
    expect(css).toContain('.MuiDialogContent-root>.MuiBox-root>*:first-child{position:fixed !important')
    expect(css).toContain('transform:translateX(-100%)')
    expect(css).toContain('sb-m-widget-cat-open')
    const src = readFileSync('src/app/mobile/widget-library-mobile.ts', 'utf8')
    expect(src).toContain('sb-m-widget-cat')
    expect(src).toContain('カテゴリー')
    // 暗幕を押す・カテゴリーを選ぶで閉じる
    expect(src).toContain('backdrop.addEventListener')
    expect(src).toContain("category.addEventListener('click'")
  })

  it('暗幕はモーダルの中に入れる（bodyだと引き出しの上に乗って触れなくなる）', () => {
    const src = readFileSync('src/app/mobile/widget-library-mobile.ts', 'utf8')
    // 2026-09-14 実機で発覚: body に付けると MUI の重なり順の外側に出て、
    // 引き出しの手前に暗幕が来るため押せない
    expect(src).toContain('root.append(backdrop)')
    expect(src).not.toContain('document.body.append(backdrop)')
  })

  it('ライブラリを閉じたら、足した部品と合図を残さない', () => {
    const lib = readFileSync('src/app/panels/widget-library.ts', 'utf8')
    expect(lib).toContain('teardownMobileWidgetLibrary()')
  })

  it('レポートの帯（レポート／広告データ取得日時／ヒートマップ）は縮めず横スクロールにする', () => {
    // 縮めると枠から文字がはみ出して重なる（2026-09-14 実機で発覚）
    expect(css).toContain('[class*="_navContainer_"]{overflow-x:auto')
    expect(css).toContain('[class*="_navContainer_"]>*{flex:0 0 auto')
  })

  it('「広告データ取得日時」と歯車は絶対配置をやめて帯の下へ落とす（文字に重なっていた）', () => {
    expect(css).toContain('[class*="_mediaSummary_"]{position:static !important')
    expect(css).toContain('[class*="_parameterScope_"]{position:static !important')
  })

  it('絞り込みは折り返さない（折り返すと列の幅が中身基準になり枠からはみ出す）', () => {
    expect(css).toContain('flex-wrap:nowrap !important')
  })

  it('レポートの外枠はスマホで余白を詰める（PC用に30px+16px入っている）', () => {
    expect(css).toContain('[class*="_abTestReportWrapper_"]{padding:0 !important')
    expect(css).toContain('.rv2{padding:10px !important')
  })

  it('レポートの絞り込みは縦に積む（横並びだと項目が潰れて右に空箱ができる）', () => {
    expect(css).toContain('.rv2-filters,html body .rv2-filter-fields{flex-direction:column')
    expect(css).toContain('.rv2-apply{align-self:stretch')
  })

  it('「設置済みWidget」の列は出さない（画面の半分を取ってキャンバスが潰れる）', () => {
    expect(css).toContain('[data-widget-nav]{display:none')
  })

  it('上のタブ・パンくず・書式ツールバーは切り捨てず横スクロールにする', () => {
    expect(css).toContain('.topnav,html body .header-row{overflow-x:auto')
    expect(css).toContain('.sb-ct{overflow-x:auto')
  })

  it('URLバーは幅を戻して縦に積む（配信側のコピーボタンが画面の外に出ていた）', () => {
    expect(css).toContain('.sb-url-bar{width:100% !important;margin-right:0 !important')
    expect(css).toContain('flex-direction:column !important')
    // 触れないまま切り捨てる overflow:hidden を解除する
    expect(css).toContain('overflow:visible !important')
  })

  it('ヘッダー画像の枠も右へのはみ出しを戻す（右が切れて中央がずれていた）', () => {
    expect(css).toContain('[class*="_articleHeaderPhoto_"]{margin-right:0 !important')
  })

  it('文字サイズ・色などの部品を指で押せる大きさにする', () => {
    expect(css).toContain('.sb-pr-input')
    expect(css).toContain('min-height:38px')
    expect(css).toContain('.sb-fmt-btns>*')
    expect(css).toContain('min-width:44px')
  })

  it('キャンバスは画面幅いっぱいで、下のツールバーに隠れない余白を持つ', () => {
    expect(css).toContain('.ql-editor{max-width:100% !important')
    expect(css).toMatch(/padding:16px 14px 96px/)
  })
})

describe('下部タブバー', () => {
  it('5つだけ並べ、残りは「その他」に入れる', () => {
    expect(BOTTOM_NAV_ITEMS).toHaveLength(5)
    expect(BOTTOM_NAV_ITEMS.at(-1)?.label).toBe('その他')
    expect(MORE_ITEMS.length).toBeGreaterThan(3)
  })

  it('いちばん使う「ページ」が先頭', () => {
    expect(BOTTOM_NAV_ITEMS[0]?.label).toBe('ページ')
  })

  it('アイコンは絵文字でなくSVG', () => {
    for (const item of BOTTOM_NAV_ITEMS) expect(item.icon.startsWith('<svg')).toBe(true)
  })

  it('今いる画面のタブが光る（ページはLPエディタにいるときも）', () => {
    expect(isActiveTab('#/folders', '#/folders')).toBe(true)
    expect(isActiveTab('#/folders?uid=FOLDER_0001', '#/folders')).toBe(true)
    expect(isActiveTab('#/ab_tests/abc/articles', '#/folders')).toBe(true)
    expect(isActiveTab('#/dashboard', '#/folders')).toBe(false)
    expect(isActiveTab('#/dashboard', '#/dashboard')).toBe(true)
    // ツールの各画面（実在するパス）で「ツール」が今いる場所になる
    expect(isActiveTab('#/teams/product_search_forms', '#/teams/tags')).toBe(true)
  })

  it('LPエディタでは出さない（自前の操作列に重なって押せなくなる）', () => {
    expect(showsBottomNav('#/ab_tests/abc/articles')).toBe(false)
    expect(showsBottomNav('#/ab_tests/abc/articles/exit_popups')).toBe(false)
    expect(showsBottomNav('#/ab_tests/abc/reports')).toBe(true)
    expect(showsBottomNav('#/folders')).toBe(true)
  })

  it('今いるタブを見える位置へ寄せる（横に長くて画面の外に出る）', () => {
    const src = readFileSync('src/app/mobile/bottom-nav.ts', 'utf8')
    expect(src).toContain('scrollActiveTabIntoView')
    expect(readFileSync('src/app/shell.ts', 'utf8')).toContain('scrollActiveTabIntoView')
  })

  it('「その他」はタブでなくシートを開く（行き先を持たない）', () => {
    expect(BOTTOM_NAV_ITEMS.at(-1)?.href).toBe('')
    expect(isActiveTab('#/folders', '')).toBe(false)
  })
})

describe('ページのカードに出す指標', () => {
  const totals: ReportKpi = {
    pv: 1031, click: 141, cv: 12, ad_cost: 5000, imp: 0, media_click: 0, media_cv: 0,
    sales: 24000, gross_profit: 0, roas: 4.8, roi: null, cvr: 0.0851, cpa: 416, ctr: 0.1367,
    ctvr: 0.0116,
  } as ReportKpi

  it('カードには3つだけ出す（13列は読めない）', () => {
    const shown = cardMetrics(totals)
    expect(shown).toHaveLength(3)
    expect(shown.map((m) => m.label)).toEqual(['PV', 'CV', 'CVR'])
    expect(shown[0]?.value).toBe('1,031')
    expect(shown[2]?.value).toBe('8.51%')
  })

  it('残りは開いたときに出す', () => {
    expect(cardDetailMetrics(totals).map((m) => m.label)).toContain('CTR')
    expect(cardDetailMetrics(totals).map((m) => m.label)).toContain('ROAS')
  })

  it('数字が無いときは「-」（0と区別する）', () => {
    expect(cardMetrics(null).every((m) => m.value === '-')).toBe(true)
    expect(cardDetailMetrics(null).every((m) => m.value === '-')).toBe(true)
  })
})

describe('スマホのページ画面', () => {
  const src = readFileSync('src/app/mobile/pages-mobile.ts', 'utf8')

  it('フォルダは2列のカード（縦1列に並べない）', () => {
    expect(src).toContain('grid-template-columns:1fr 1fr')
  })

  it('1画面ずつで、戻る導線がある', () => {
    expect(src).toContain('backBar')
  })

  it('スマホでも編集へ行ける（PCでどうぞ、で止めない）', () => {
    expect(src).toContain("/articles")
    expect(src).not.toContain('PCで')
  })
})

/**
 * スマホのLPエディタ（2026-09-13 / 14・本人の実機での指摘を受けた形）。
 *
 * 画面の組み替えはCSSが持つので、ここは「どう操作して開くか」を配線側のコードで押さえる。
 */
describe('スマホのLPエディタ', () => {
  const src = readFileSync('src/app/mobile/editor-mobile.ts', 'utf8')
  const css = mobileCss()

  it('上にVersion・プロパティの2ボタンを置かない（タブと重複していた）', () => {
    expect(src).not.toContain("text: 'プロパティ'")
    expect(src).not.toContain("text: 'Version'")
  })

  it('文字を選ぶとプロパティが自動で開く', () => {
    expect(src).toContain('selectionchange')
    expect(src).toContain('PROPS_OPEN_CLASS')
  })

  it('カーソルだけに戻しても勝手に閉じない（書式を変える前に消えてしまう）', () => {
    expect(src).not.toContain('else if (document.body.classList.contains(PROPS_OPEN_CLASS)) openOnly(null)')
  })

  it('キャンバスに浮かぶ丸ボタンは出さない（2026-09-14 本人指示「丸いツールマークいらない」）', () => {
    // プロパティは文章を選ぶと自動で開く（selection-change）。丸ボタンは置かない
    expect(src).not.toContain('sb-m-props-btn')
    expect(css).not.toContain('sb-m-props-btn')
    expect(src).toContain('openOnly(PROPS_OPEN_CLASS)')
  })

  it('ボタンを押しても本文の選択を外さない', () => {
    expect(src).toContain('keepSelectionOnPress')
    expect(src).toContain("addEventListener('mousedown', (event) => event.preventDefault())")
  })

  it('touchstart / pointerdown は止めない（止めるとスマホでボタンが無反応になる）', () => {
    // 2026-09-14 実機で発覚: touchstart を preventDefault すると click が発火しない
    expect(src).not.toContain("'touchstart'")
    expect(src.includes("addEventListener('pointerdown'")).toBe(false)
  })

  it('選択が外れてもいいよう、最後に選んでいた範囲を覚えておく', () => {
    expect(src).toContain('lastRange')
    expect(src).toContain('quill.getSelection() ?? lastRange')
  })

  it('Version一覧は、今いる「Version」タブをもう一度押すと開く', () => {
    expect(src).toContain("'.topnav-tab'")
    expect(src).toContain('VERSIONS_OPEN_CLASS')
  })

  it('開いているシートを閉じる「×」がある', () => {
    expect(src).toContain('sb-m-sheet-close')
    expect(css).toContain('#sb-m-sheet-close')
  })

  it('単語だけしか選べないときのために、段落／全部へ広げられる', () => {
    // ダブルタップは単語だけを選ぶ。端末によっては文章全体へ伸ばせない
    expect(src).toContain('この段落を選ぶ')
    expect(src).toContain('全部を選ぶ')
    expect(src).toContain('getLine')
    expect(src).toContain('setSelection')
    expect(css).toContain('#sb-m-range-bar')
  })

  it('段落を選ぶときは行末の改行を含めない（書式が次の行へにじむ）', () => {
    expect(src).toContain('line.length() > 1 ? line.length() - 1 : line.length()')
  })

  it('シートの合図はCSSと配線で同じものを使う（ずれると開かない）', () => {
    const shared = readFileSync('src/app/mobile/sheet-classes.ts', 'utf8')
    expect(shared).toContain('sb-m-versions-open')
    expect(shared).toContain('sb-m-props-open')
    for (const file of ['src/app/mobile/editor-mobile.ts', 'src/app/mobile/mobile-css.ts']) {
      expect(readFileSync(file, 'utf8'), file).toContain("from './sheet-classes.ts'")
    }
  })
})

/**
 * 2026-09-14。本人指示「いろんなページをしっかり見て、他にもそういった箇所がないか
 * 確かめてください。何か画角的におかしいところとか」を受けて、390×844 で全16画面を
 * 実測（画面の外に出た文字／重なった文字を数える）して見つかったもの。
 */
describe('全画面を実測して見つかったはみ出し・重なり', () => {
  const css = mobileCss()

  it('設定のタブは横スクロールできる（「アクセス管理」が画面の外に出ていた）', () => {
    // 4つのタブで493pxあり、390pxの画面に収まらない。縮めると文字が潰れるので流す
    expect(readFileSync('src/app/pages/account-settings.ts', 'utf8')).toContain("class: 'sb-tabbar'")
    expect(css).toContain('.sb-tabbar{overflow-x:auto !important')
    expect(css).toContain('.sb-tabbar>*{flex:0 0 auto}')
  })

  it('レポート除外の絞り込みは縦に積む（横並びだと枠から出る）', () => {
    expect(css).toContain('.rx-form{flex-direction:column !important')
    // 枠(304px)より広い362pxのままだったのは、幅指定と min-width の両方が要るため
    expect(css).toContain('.rx-field{width:auto !important;min-width:0 !important}')
    expect(css).toContain('html body .rx-field input{width:100% !important;min-width:0 !important}')
  })

  it('広告媒体連携の媒体名は行の高さを普通に戻す（PC用の100px行が「連携数」と重なる）', () => {
    // 採取CSSの line-height:100px は「100pxの行の真ん中に名前を置く」PCの作り
    expect(css).toContain('[class*="_mediaName_"]')
    expect(css).toContain('[class*="_connectionCount_"]{line-height:1.5 !important')
  })

  it('中間ページの「左に一覧・右に設定」は縦に積む（右が画面の外にあった）', () => {
    expect(css).toContain('[class*="_redirectPagesWrapper_"]{flex-direction:column !important}')
    expect(css).toContain('[class*="_redirectPagesWrapper_"]>*{width:auto !important;max-width:100% !important;')
  })

  it('横並びを縦に積むときは min-width:0 を必ず添える（flexの子は既定で縮まない）', () => {
    // min-width の既定は auto = 中身より小さくならない。width:100% だけでは画面を突き破る
    for (const selector of ['.rx-field', '[class*="_redirectPagesWrapper_"]>*']) {
      const rule = css.slice(css.indexOf(selector))
      expect(rule.slice(0, rule.indexOf('}')), selector).toContain('min-width:0')
    }
  })
})

/**
 * 2026-09-14。本人指摘「ウィジェットの編集画面おかしい（スマホ版）」。
 * 実測（390×844）: パネルは `left:calc(50% + 60px)`（PCレール分のずらし）で右へ48pxはみ出し、
 * 中の2ペインは横並びのまま左が660px固定 → 右の「要素ごとのカード」が幅0＝触れなかった。
 */
describe('スマホのWidget編集画面', () => {
  const css = mobileCss()
  // 画面そのものは widget-studio.ts（2026-09-23 「ノーコードで作る」と1つにした）
  const editorSrc = readFileSync('src/app/panels/widget-studio.ts', 'utf8')
  const visualSrc = readFileSync('src/app/panels/widget-visual-editor.ts', 'utf8')

  it('全画面にする（PC前提の「中央から右へ60px」を打ち消す）', () => {
    expect(css).toContain('[data-widget-editor]{left:0 !important;top:0 !important;transform:none !important;')
    expect(css).toContain('width:100vw !important')
    expect(css).toContain('height:100dvh !important')
  })

  it('開いている間は、下のツール列を隠す（パネルより手前に出て操作を奪う）', () => {
    expect(css).toContain(':has([data-widget-editor]) [class*="_sideToolbarWrapper_"]{display:none !important}')
  })

  it('パネルは下のツール列より手前に出す（z-index）', () => {
    const railZ = Number(/_sideToolbarWrapper_[^}]*z-index:(\d+)/.exec(css)?.[1] ?? '0')
    const panelZ = Number(/\[data-widget-editor\]\{[^}]*z-index:(\d+)/.exec(css)?.[1] ?? '0')
    expect(railZ).toBeGreaterThan(0)
    expect(panelZ).toBeGreaterThan(railZ)
  })

  it('2ペインは上下に積む（横並びだと片方が幅0になる）', () => {
    expect(css).toContain('[data-widget-panes]{flex-direction:column !important}')
    expect(css).toContain('[data-widget-pane="visual"]')
    expect(css).toContain('[data-widget-pane="code"]')
    // 左ペインは flex:0 0 660px の固定幅。幅もmin-widthも外さないと画面を突き破る
    for (const pane of ['[data-widget-pane="visual"]', '[data-widget-pane="code"]']) {
      const rule = css.slice(css.indexOf(pane))
      expect(rule.slice(0, rule.indexOf('}')), pane).toContain('min-width:0')
    }
    // 仕切り（col-resize）は指では掴めないので出さない
    expect(css).toContain('[data-widget-divider]{display:none !important}')
  })

  it('3列（左＝部品・まん中＝見たまま画面・右＝設定）は、見たまま画面→部品→設定の順に積む（2026-09-24 画面の作り直し）', () => {
    const order = (pane: string): number => Number(new RegExp(`\\[data-widget-pane="${pane}"\\]\\{[^}]*order:(\\d)`).exec(css)?.[1] ?? '0')
    expect(order('visual')).toBe(1)
    expect(order('parts')).toBe(2)
    expect(order('code')).toBe(3)
    const parts = css.slice(css.indexOf('[data-widget-pane="parts"]'))
    expect(parts.slice(0, parts.indexOf('}'))).toContain('width:auto !important')
    expect(editorSrc).toContain("dataset['widgetPane'] = 'parts'")
  })

  it('ヘッダーの戻るは矢印だけ・小さな説明とPC／スマホの切り替えは出さない（1行に収める）', () => {
    expect(css).toContain('[data-widget-back-label],html body [data-widget-subtitle]{display:none !important}')
    expect(css).toContain('[data-widget-device]{display:none !important}')
  })

  it('ヘッダーは折り返さない（「閉じる」「Widget編集」が2行に割れていた）', () => {
    expect(css).toContain('[data-widget-header]{flex-wrap:nowrap !important')
    expect(css).toContain('[data-widget-header]>*{white-space:nowrap !important')
  })

  it('書式ツールバーは1行で横に流す（折り返すと64pxの枠で下の段が切れる）', () => {
    expect(css).toContain('[data-widget-toolbar]{flex-wrap:nowrap !important;overflow-x:auto')
  })

  it('目印はTSとCSSで同じものを使う（ずれると何も当たらない）', () => {
    for (const mark of ['widgetPanes', 'widgetHeader']) {
      expect(editorSrc, mark).toContain(mark)
    }
    expect(editorSrc).toContain("dataset['widgetPane'] = 'visual'")
    expect(editorSrc).toContain("dataset['widgetPane'] = 'code'")
    expect(editorSrc).toContain('widgetDivider')
    expect(visualSrc).toContain('widgetToolbar')
  })
})

describe('スマホのWidget編集画面（プレビューまわり）', () => {
  const css = mobileCss()
  const visualSrc = readFileSync('src/app/panels/widget-visual-editor.ts', 'utf8')

  it('プレビューは左端から始める（中央寄せだと左へはみ出した分に届かない）', () => {
    // 幅620px（配信と同じ）は変えない。margin:0 auto のままだと横スクロールしても左半分が出せない
    expect(visualSrc).toContain("dataset['widgetPreview'] = 'true'")
    expect(css).toContain('[data-widget-preview]{margin:0 !important}')
  })

  it('「Ctrl＋クリック」の注意書きはスマホでは出さない（指では押せず、枠から切れる）', () => {
    expect(visualSrc).toContain("dataset['widgetNote'] = 'true'")
    expect(css).toContain('[data-widget-note]{display:none !important}')
  })
})

/**
 * 2026-09-14。本人指摘「新規で作成できない」（スマホのページ画面・フォルダ0件）。
 * フォルダ一覧には作る導線が無く、フォルダの中の「＋ 新規ページを作成」は
 * `#/folders?uid=…&new=1` を書くだけ＝`new` を読む場所がどこにも無く、何も起きなかった。
 */
describe('スマホからページを作る導線', () => {
  const src = readFileSync('src/app/mobile/pages-mobile.ts', 'utf8')

  it('フォルダ一覧から新しいフォルダを作れる', () => {
    expect(src).toContain('＋ 新規フォルダを作成')
    expect(src).toContain('openCreateFolder')
  })

  it('フォルダが1つも無いときも作成ボタンを出す（空の画面で行き止まりにしない）', () => {
    const btn = src.indexOf('＋ 新規フォルダを作成')
    const empty = src.indexOf("emptyState('フォルダがありません。')")
    expect(btn).toBeGreaterThan(0)
    expect(empty).toBeGreaterThan(0)
    expect(btn).toBeLessThan(empty)
  })

  it('「新規ページを作成」は作成ダイアログを開く（誰も読まないURLを書いていた）', () => {
    expect(src).toContain('openCreatePage')
    // 誰も読まないハッシュを書くだけの配線に戻さない（コメントでの言及は許す）
    expect(src).not.toContain('location.hash = `/folders?uid=${folderUid}&new=1`')
  })
})

/**
 * 2026-09-14。本人指摘「切り替えのページ」（Version出し分け設定）。
 * 実測(390×844): 表(444px)と右の条件メニュー(78px)を350pxの枠に横並びで入れる作りで、
 * メニューが画面の外（x=464〜542）＝**条件（デバイス別／時間別…）を選べなかった**。
 * 採取した土台なので、直せるのはCSSだけ（クラス名は6タブ共通で採取物に入っている）。
 */
describe('スマホのVersion出し分け設定（切り替え）', () => {
  const css = mobileCss()

  it('表と条件メニューを縦に積む（メニューが画面の外にいた）', () => {
    expect(css).toContain('[class*="css-5ai0ia"]{flex-direction:column !important')
    const rule = css.slice(css.indexOf('[class*="css-5ai0ia"]>*'))
    expect(rule.slice(0, rule.indexOf('}'))).toContain('min-width:0')
  })

  it('条件の選択は一番上に出し、横に流す（縦7行だと表が画面の下へ追いやられる）', () => {
    expect(css).toContain('[class*="css-m7q6f4"]{order:-1')
    // PCでは画面に貼り付く作り。縦に積んだら普通に流す
    expect(css).toContain('[class*="css-19sre7e"]{position:static !important}')
    expect(css).toContain('overflow-x:auto')
  })

  it('表は縮めずに横へ流す（縮めるとVersion名と割合が潰れる）', () => {
    expect(css).toContain('[class*="css-1rr4qq7"]{overflow-x:auto')
  })

  it('「流入元別」の入力3つは縦に積み、行の高さを伸ばす', () => {
    // 行は46px固定＋align-items:center。入力が折り返すと上下へはみ出し、上の説明文に重なっていた
    expect(css).toContain('[class*="css-1ygvyop"]{height:auto !important')
    expect(css).toContain('align-items:flex-start !important')
    expect(css).toContain('[data-clone-param-editor]>div{flex-direction:column !important')
  })

  it('土台の目印は採取物に実在する（emotionのハッシュ名は推測で書かない）', () => {
    const fragment = readFileSync(
      'src/app/fragments/ab_tests__UID__articles__split_test_settings__devices.html',
      'utf8',
    )
    for (const cls of ['css-5ai0ia', 'css-m7q6f4', 'css-19sre7e', 'css-1rr4qq7']) {
      expect(fragment, cls).toContain(cls)
    }
  })
})

/**
 * 2026-09-14。本人指摘「レポート→ヒートマップ」。
 * 実測(390×844): 採取した土台が「左=Version一覧(250px固定) / 右=ヒートマップの列」の横並びで、
 * 右ペインの幅が40pxしか残らず、中の列(377px)が画面の外（x=300〜683）へ出てカードが重なっていた。
 */
describe('スマホのヒートマップ比較', () => {
  const css = mobileCss()

  it('左のVersion一覧と右のヒートマップを縦に積む', () => {
    expect(css).toContain('[class*="_container_1juw6_"]{flex-direction:column !important')
    for (const pane of ['[class*="_left_1juw6_"]', '[class*="_right_1juw6_"]']) {
      const rule = css.slice(css.indexOf(pane))
      expect(rule.slice(0, rule.indexOf('}')), pane).toContain('min-width:0')
    }
  })

  it('左右の余白を作らない（外30px＋ペイン20pxで使える幅が290pxしか残らない）', () => {
    // 列は375pxのスマホ枠＋枠線＝379px。余白があると必ず右へはみ出す
    expect(css).toContain('[class*="_wrapper_1juw6_"]')
    expect(css).toContain('padding-left:0 !important;padding-right:0 !important}')
  })

  it('土台の目印は採取物に実在する', () => {
    const fragment = readFileSync(
      'src/app/fragments/ab_tests__UID__articles__htmls__heatmaps__comparisons__default.html',
      'utf8',
    )
    for (const cls of ['_container_1juw6_', '_left_1juw6_', '_right_1juw6_', '_heatmapList_14ri6_']) {
      expect(fragment, cls).toContain(cls)
    }
  })
})

/**
 * 2026-09-14。本人指摘「履歴」（バージョン復元パネル）。
 * 実測(390×844): パネルの入れ物を `position:fixed;top:120px;right:90px`（PCの右レール前提）で
 * 置いていたため、280pxのパネルが x=-18〜270 に出て左が画面の外へ切れていた。
 */
describe('スマホの履歴・リンク置換パネル', () => {
  const css = mobileCss()

  it('画面の幅いっぱいに、下のツール列の上へ出す', () => {
    expect(css).toContain('[data-clone-panel-host]{position:fixed !important;left:8px !important;')
    expect(css).toContain('right:8px !important')
    // PC前提の top:120px を打ち消して、下のツール列の上に置く
    expect(css).toContain('bottom:calc(56px + env(safe-area-inset-bottom,0px)) !important')
  })

  it('中身はPCの位置指定（left/right/top）を捨てて、入れ物に合わせる', () => {
    expect(css).toContain('[data-clone-panel-host] [class*="_bodyWrapper_x4j8w"]{position:static !important')
    const rule = css.slice(css.indexOf('[data-clone-panel-host] [class*="_bodyWrapper_x4j8w"]'))
    const body = rule.slice(0, rule.indexOf('}'))
    for (const prop of ['left:auto', 'right:auto', 'top:auto', 'width:auto']) {
      expect(body, prop).toContain(prop)
    }
  })
})

/**
 * 2026-09-14。本人指摘3件。
 *  - 一括タグ設定 / LP設定 を下へスクロールすると、中身が見出し（×・保存）に重なる
 *  - Widgetライブラリの見出し「Widget」が真ん中に無い
 *  - 「カテゴリー」が押して開けるものだと分からない
 */
describe('スマホの見出しとカテゴリー', () => {
  const css = mobileCss()

  it('モーダルの見出しは不透明にする（sticky なのに背景が無く、中身が透けて重なっていた）', () => {
    // 採取CSSの背景色は `_lightTheme_11n4w_16` 付きのときだけ効く。クローンの外枠には付いていない
    const base = readFileSync('src/app/white-base.ts', 'utf8')
    const rule = base.slice(base.indexOf('._modalHeader_11n4w_20 {'))
    expect(rule.slice(0, rule.indexOf('}'))).toContain('background')
  })

  it('Widgetライブラリの見出しは画面の真ん中に置く', () => {
    // 見出しの列は［閉じる］［タイトル］［空］の3つ。両端を同じ幅にしないと中央がずれる
    expect(css).toContain('[class*="css-155j396"]>*:first-child')
    // 右の枠は中身が無いと display:none になるので、空のまま見せて場所を取らせる
    expect(css).toContain('[class*="css-155j396"]>*:last-child{flex:1 1 0 !important;display:block !important}')
  })

  it('カテゴリーは押して開けると分かる形にする', () => {
    const src = readFileSync('src/app/mobile/widget-library-mobile.ts', 'utf8')
    expect(src).toContain('カテゴリーを選ぶ')
    // 絵文字でなくSVG（プロジェクト共通の決まり）
    expect(src).toContain('<svg')
    expect(src).not.toContain("text: 'カテゴリー'")
  })
})

/**
 * 2026-09-14。本人指摘3件。
 *  - URLバーの「プレビュー」と「配信」で枠の位置と大きさが違う
 *  - 「比較する」を押しても何も出ない
 *  - 横スクロールできる場所がそうと分からない
 */
describe('スマホのURLバー・比較・横スクロールの合図', () => {
  const css = mobileCss()

  it('プレビューと配信のURL枠を同じ位置・同じ大きさに揃える', () => {
    // 見出しの幅が「プレビュー」51px / 「配信」20px で、枠の始まりがずれていた（実測）
    expect(css).toContain('.sb-url-label{min-width:52px !important')
  })

  it('「比較する」は画面いっぱいに出す（PCの右レール基準だと画面の外に置かれる）', () => {
    // openComparePanel は右レールの左端を基準に right を決める。スマホのレールは
    // 画面下いっぱい＝left:0 なので right が画面幅を超え、パネルが見えなかった
    expect(css).toContain('.sb-cmp-panel{top:0 !important;right:0 !important;left:0 !important')
    expect(css).toContain('height:100dvh !important')
    expect(css).toContain('.sb-cmp-resize{display:none !important}')
    // 下のツール列(9400)より手前に出す
    const rule = css.slice(css.indexOf('.sb-cmp-panel{'))
    const z = /z-index:(\d+)/.exec(rule.slice(0, rule.indexOf('}')))
    expect(Number(z?.[1] ?? 0)).toBeGreaterThan(9400)
  })

  it('横スクロールできる場所には、端に影を出して続きがあると分かるようにする', () => {
    expect(css).toContain('.sb-m-scrollable')
    expect(css).toContain('background-attachment:local,local,scroll,scroll')
  })

  it('横スクロールの合図は、横に流している場所すべてに付ける', () => {
    // 個別に書き忘れないよう、横スクロールさせる規則と同じ場所へまとめて当てる
    for (const sel of ['.sb-tabbar', '[class*="_navContainer_"]', '[data-widget-toolbar]']) {
      expect(css, sel).toContain(sel)
    }
    expect(css).toContain('html body .sb-m-scrollable,')
  })
})

/**
 * 2026-09-14。本人指摘「文字が入りきってないです」（LP設定＝記事設定）。
 * 実測(390×844): 項目が1行3つ（width:30%）/ 4つ（22%）で、枠が100px・73pxしか無く
 *  - 単位の「px」は枠の右から30pxに絶対配置 → 入力値と重なる（15px が「1|5px」に見える）
 *  - 「文字色」の見出しが1文字ずつ縦に割れる（12px幅・54px高）
 */
describe('スマホのLP設定（記事設定）', () => {
  const css = mobileCss()

  it('項目は1行2つにする（3つ・4つだと枠が100px以下になる）', () => {
    expect(css).toContain('[class*="_paddingFormGroup_qyxur_"]{width:50% !important;')
    expect(css).toContain('[class*="_formGroup_qyxur_"],')
  })

  it('単位の「px」と入力値を重ねない', () => {
    expect(css).toContain('[class*="_formGroup_qyxur_"]::before')
    expect(css).toContain('right:8px !important')
    // 入力値が「px」の下へ潜らないよう、右の余白を空ける
    // 「px」が付く欄だけに掛ける（全部に掛けると文字色の16進欄で値が見えなくなる）
    expect(css).toContain('[class*="_pixcelForm_qyxur_"] input{padding-right:28px !important}')
  })

  it('見出しは1文字ずつ縦に割らない', () => {
    expect(css).toContain('white-space:nowrap !important')
  })
})

describe('スマホで「1文字だけ次の行に落ちる」のを防ぐ', () => {
  const css = mobileCss()

  it('デバイスの見出し（スマートフォン／タブレット／デスクトップ）は折り返さない', () => {
    // 64pxの枠に12pxの6文字は入らず「デスクトッ／プ」と割れていた（390pxで実測）。
    // 表は横スクロールできるので、折り返さず自然な幅にする
    expect(css).toContain('[class*="css-1gb3ku2"]')
    const rule = css.slice(css.indexOf('[class*="css-1gb3ku2"]'))
    expect(rule.slice(0, rule.indexOf('}'))).toContain('white-space:nowrap')
  })
})

/**
 * 2026-09-14。本人指示「LP設定以外にもこういう箇所がないかをスマホ版の時見てください」。
 * 390×844で全画面に「文字が入りきらない」検査（切れ／1文字落ち／縦割れ）を回して見つけたもの。
 */
describe('スマホのツール画面（文字が入りきらない箇所）', () => {
  const css = mobileCss()

  it('マジック置換の操作列は折り返す（5つ横並びで745px必要・タブが画面の外にいた）', () => {
    expect(css).toContain('.br-bar{flex-wrap:wrap !important}')
    expect(css).toContain('.br-search{width:auto !important')
    expect(css).toContain('.br-tab{white-space:nowrap !important}')
  })

  it('メディアの2段組みは縦に積む（右の欄が26pxになり説明文が1文字ずつ縦に割れていた）', () => {
    expect(css).toContain('.md-body{grid-template-columns:1fr !important}')
  })

  it('審査の絞り込みチップは折り返す（5つで1つ63pxになり「すべて 0」が割れていた）', () => {
    expect(css).toContain('.ins-chips{flex-wrap:wrap !important}')
  })
})

/**
 * 2026-09-14。全画面の総点検（サブエージェントのコード監査＋390pxでの実測）で見つかった、
 * 「中身が画面の外に出る／文字が1文字ずつ縦に割れる」箇所。
 */
describe('スマホの2段組み・3段組み画面', () => {
  const css = mobileCss()

  it('マジック置換の3ペインは縦に積む（200+20+340pxで右のペインが画面の外）', () => {
    expect(css).toContain('.br-panes{grid-template-columns:1fr !important')
  })

  it('CV計測連携の2段組みは縦に積む（右が110pxになり見出しが縦に割れる）', () => {
    expect(css).toContain('.cvt-body{grid-template-columns:1fr !important}')
  })

  it('審査の行は折り返す（操作ボタン3つが場所を取り、ページ名が幅0で消える）', () => {
    expect(css).toContain('.ins-entry{flex-wrap:wrap !important}')
    expect(css).toContain('.ins-entry-main{flex:1 0 100% !important')
  })

  it('離脱防止ポップの編集タブ6つは横に流す（1つ55pxで文字が縦に割れる）', () => {
    expect(css).toContain('.ep-editor-tabs{overflow-x:auto')
    expect(css).toContain('.ep-editor-tabs>*{flex:0 0 auto')
  })

  it('ポップアップ編集の上のボタン列は文字を割らない（「下書き反/映」になっていた）', () => {
    expect(css).toContain('.ep-editor-btn-bar{flex-wrap:wrap !important')
    expect(css).toContain('.ep-editor-btn-bar button{white-space:nowrap !important}')
  })

  it('一括タグの設置範囲は縦に積む（右に180px固定で左が70pxになる）', () => {
    expect(css).toContain('.bt-scope-row{flex-direction:column !important}')
  })

  it('レポート除外の表は横に流す（6列nowrapでページごと横にずれる）', () => {
    expect(css).toContain('.rx-card{overflow-x:auto')
  })

  it('左右の余白は詰める（24〜28pxの余白で使える幅が4分の3になる）', () => {
    for (const sel of ['.bt-page', '.rx{', '.tc{', '.bi-page']) {
      expect(css, sel).toContain(sel)
    }
  })
})

describe('スマホの設定画面（チームメンバー）', () => {
  const src = readFileSync('src/app/pages/account-settings.ts', 'utf8')

  it('チームメンバーは共通の表の目印を使う（手組みgridだと1列77pxでメールが3行に割れる）', () => {
    // 権限の選択や削除ボタンを行に置くため、表は team-members.ts で組む。
    // スマホで「1行＝1カード（列名 値）」に組み替わる共通の目印と、セルごとの列名は必ず付ける
    const members = readFileSync('src/app/pages/team-members.ts', 'utf8')
    expect(src).toContain("from './team-members.ts'")
    expect(members).toContain('class: DATA_TABLE_CLASS')
    expect(members).toContain('class: DATA_ROW_CLASS')
    expect(members).toContain("dataset['label']")
    // 手組みの3列gridに戻さない
    expect(members).not.toContain('grid-template-columns:1fr 1fr 100px')
  })

  it('画面の枠はスマホ用の目印を持つ（左右24〜28pxの余白を外すため）', () => {
    expect(src).toContain("class: 'sb-page-shell'")
    expect(src).toContain("class: 'sb-page-card'")
  })
})

/**
 * 2026-09-14。パネル側の総点検で見つかったもの（オーバーレイ／浮いている部品）。
 */
describe('スマホのパネル・オーバーレイ', () => {
  const css = mobileCss()

  it('Versionの「…」メニューは画面内に出す（採取物がPCの座標 left:288px を持っている）', () => {
    expect(css).toContain('.MuiPopover-paper{left:8px !important;right:8px !important')
  })

  it('コード欄は行番号・色付き表示も入力欄と同じ文字サイズにする（カーソルがずれる）', () => {
    // スマホは入力欄を16pxに拡大する。透明な入力欄だけ大きいと、下の色付き文字とずれる
    expect(css).toContain('[data-code-font]{font-size:16px !important}')
    const src = readFileSync('src/app/panels/widget-code-panel.ts', 'utf8')
    expect(src).toContain("dataset['codeFont'] = 'true'")
  })

  it('Widget作成画面は縦に積む（右の列が280px固定で左が60pxになる）', () => {
    expect(css).toContain('[data-widget-creator-editor]{flex-direction:column !important')
    expect(css).toContain('[data-widget-creator-meta]{flex-wrap:wrap !important')
  })

  it('トーストは画面幅いっぱいまで使う（left:50%起点で195pxしか使えていなかった）', () => {
    const src = readFileSync('src/app/ui.ts', 'utf8')
    expect(src).toContain('width:max-content;max-width:calc(100vw - 24px)')
  })

  it('URLバー用のCSSを画像のソース欄へ漏らさない', () => {
    // .sb-url-field はプロパティの「ソース」欄でも使われており、高さだけ伸びて文字が上に寄る
    expect(css).toContain('.sb-url-bar .sb-url-field{height:34px !important}')
  })

  it('キャンバスの自前スクロールバーはスマホでは出さない（指で掴めず右端のタップを奪う）', () => {
    expect(css).toContain('[data-clone-scrollbar]{display:none !important}')
  })
})

describe('スマホの広告媒体連携（Metaの広告アカウント一覧）', () => {
  const src = readFileSync('src/app/pages/external-integration.ts', 'utf8')

  it('一覧は共通の表の目印を持つ（630pxの表がoverflow:hiddenのカードで黙って切れていた）', () => {
    expect(src).toContain('DATA_HEAD_CLASS')
    expect(src).toContain('DATA_ROW_CLASS')
  })

  it('セルは列名を持つ（スマホでは列見出しが消えるので「列名 値」で出す）', () => {
    expect(src).toContain("dataset['label']")
  })
})

describe('スマホの広告媒体連携（媒体カード）', () => {
  const css = mobileCss()

  it('媒体カードは画面幅に収める（428px固定で「アカウント連携」が右で切れていた）', () => {
    // width:auto にすると2列に折り返して媒体名がアイコンと重なる。1列で幅いっぱいにする
    // 採取CSSの flex:0 1 50% に勝たないと2列のままになる
    expect(css).toContain('[class*="_media_ifzcq_"]{flex:0 0 100% !important')
    const rule = css.slice(css.indexOf('[class*="_media_ifzcq_"]'))
    expect(rule.slice(0, rule.indexOf('}'))).toContain('max-width:100%')
  })

  it('媒体名は縮むようにする（200px固定でボタンが画面の外へ出ていた）', () => {
    expect(css).toContain('[class*="_mediaName_ifzcq_"]{width:auto !important')
  })

  it('媒体のアイコンは潰さない（名前を縮めると隣のアイコンまで22pxになる）', () => {
    expect(css).toContain('[class*="_icon_ifzcq_"]{flex:0 0 auto !important}')
  })

  it('土台の目印は採取物に実在する', () => {
    const fragment = readFileSync('src/app/fragments/teams__ad_accounts__default.html', 'utf8')
    expect(fragment).toContain('_media_ifzcq_')
    expect(fragment).toContain('_mediaContainer_ifzcq_')
  })
})

/**
 * 2026-09-14。本人指摘「ここ3行にできる、はず」「カラーパッドがわかりずらい」（LP設定）。
 */
describe('スマホのLP設定（詰め方と色の選び方）', () => {
  const css = mobileCss()

  it('項目を1行2つにするには box-sizing も直す（content-box＋左右10pxの余白で50%に収まらない）', () => {
    // 実測: 50%＝167px に padding 20px が足されて187px。2つで374px＞334pxとなり1つずつ縦に並んでいた
    expect(css).toContain('[class*="_formGroup_qyxur_"],')
    expect(css).toContain('box-sizing:border-box !important')
  })

  it('入りきらない値は「…」で示す（フォント名が途中で断ち切られていた）', () => {
    expect(css).toContain('[class*="_formGroup_qyxur_"] input{text-overflow:ellipsis}')
  })

  it('文字色の行は幅いっぱいにする（半分だと見出しが2行に割れ、16進の値も切れる）', () => {
    expect(css).toContain('[class*="_fontColorForm_qyxur_"]{width:100% !important}')
  })

  it('色見本は指で押せる大きさにして、押せると分かる形にする', () => {
    expect(css).toContain('input[type="color"]')
    const rule = css.slice(css.indexOf('input[type="color"]'))
    const body = rule.slice(0, rule.indexOf('}'))
    expect(body).toContain('height:38px')
    expect(body).toContain('border-radius')
  })
})

describe('スマホのレポートの小さな面（広告データ取得日時・パラメーター設定）', () => {
  const css = mobileCss()

  it('画面の中に出す（押した場所の右下だと x=358〜508 で画面の外）', () => {
    expect(css).toContain('[data-clone-dropdown="true"] [class*="_bodyWrapper_x4j8w"]{position:fixed !important;')
    expect(css).toContain('left:8px !important;right:8px !important')
  })

  it('離した位置に出すので吹き出しの矢印は消す', () => {
    expect(css).toContain('[data-clone-dropdown="true"] [class*="_arrow_x4j8w"]{display:none !important}')
  })
})

/**
 * レポート設定（歯車→「表示するパラメータ」）のスマホ版。
 * 4列の表を375pxに詰めると、見出しも行の名前も1文字ずつ縦に割れて読めなかった。
 * 1行＝1カードに組み替える。採取CSSが置いている幅180px・高さ76pxを外さないと、
 * 名前の右に灰色の空きが残って行も間延びする（実機で踏んだ）。
 */
describe('スマホのレポート設定（表示するパラメータ）', () => {
  const css = mobileCss()

  it('表を1行＝1カードにする', () => {
    expect(css).toContain('html body [class*="_scopeTable_"] thead{display:none !important}')
    expect(css).toContain('html body [class*="_scopeTable_"] tbody tr{display:block !important;')
  })

  it('どの列かはセルの data-label で出す', () => {
    expect(css).toContain('tbody td::before{content:attr(data-label)')
    const panel = readFileSync('src/app/panels/report-settings-modal.ts', 'utf8')
    // 文言は採取した thead から取る（手で持たない）
    expect(panel).toContain("root.querySelectorAll<HTMLElement>('thead th')")
    expect(panel).toContain("cell.setAttribute('data-label', label)")
  })

  it('採取CSSの固定幅・固定高さを外す', () => {
    expect(css).toContain('max-width:none !important')
    expect(css).toContain('height:auto !important')
  })

  it('PCには掛からない（@media の中にある）', () => {
    const at = css.indexOf('_scopeTable_')
    expect(at).toBeGreaterThan(css.indexOf('@media'))
    expect(css.slice(at).includes('}')).toBe(true)
  })
})

/**
 * スマホのレポート画面（2026-09-15・本人指示「スマホ版でも見やすくしてください」）。
 * 15列の表を横スクロールに任せると4列しか見えず、残りは読めなかった。
 */
describe('スマホのレポートの表', () => {
  const css = mobileCss()

  it('1行＝1カードにする（列見出しは消し、セルが列名を持つ）', () => {
    expect(css).toContain('html body .rv2-card .rv2-table thead{display:none !important}')
    expect(css).toContain('tbody td::before{content:attr(data-label)')
  })

  it('1列目（名前・日付）はカードの見出しにする', () => {
    expect(css).toContain('tbody td:first-child{display:block !important;font-weight:700')
  })

  it('既定は主要な指標だけ。切替で残りも出す', () => {
    expect(css).toContain('tbody td[data-more]{display:none !important}')
    expect(css).toContain('.rv2-table.show-all tbody td[data-more]{display:flex !important}')
    expect(css).toContain('html body .rv2-metrics-toggle{display:inline-flex !important')
  })

  it('広告の行は左の線で親のVersionとの関係を示す（字下げは折り返しで読みにくい）', () => {
    expect(css).toContain('tbody tr.rv2-sub{border-left:3px solid var(--sb-accent)')
  })

  it('ボタンの文字は折り返さない', () => {
    expect(css).toContain('white-space:nowrap !important')
  })

  it('ファネルは段ごとにまとめる', () => {
    expect(css).toContain('html body .rv2-funnel-body{display:block !important}')
    expect(css).toContain('html body .rv2-funnel-row{display:block !important')
  })

  it('PCでは切替ボタンを出さない（全列そのまま）', () => {
    const style = readFileSync('src/app/pages/report-v2-style.ts', 'utf8')
    expect(style).toContain('.rv2-metrics-toggle { display:none; }')
  })
})

/**
 * レポート／ヒートマップの帯（2026-09-15・本人指摘「スマホ版は？」）。
 * 「広告データ取得日時」と歯車を1つずつ別の行に落としていたので、
 * 中身が始まるまでに帯だけで131px使っていた。同じ行に並べて99pxにした。
 */
describe('スマホのレポートの帯', () => {
  const css = mobileCss()

  it('「広告データ取得日時」と歯車を同じ行に並べる', () => {
    expect(css).toContain('html body [class*="_navWrapper_8ygjt_"]{display:flex !important;')
    expect(css).toContain('flex-wrap:wrap !important;')
    // 2つとも「行を専有しない」置き方にする
    expect(css).toContain('html body [class*="_mediaSummary_"]{position:static !important;')
    expect(css).toContain('html body [class*="_parameterScope_"]{position:static !important;')
    expect(css.includes('display:inline-flex !important;align-items:center;')).toBe(true)
  })

  it('タブの列は1行を丸ごと使う（小さい2つと同じ行に詰めない）', () => {
    expect(css).toContain('>[class*="_navContainer_"]{flex:1 1 100% !important}')
  })
})
