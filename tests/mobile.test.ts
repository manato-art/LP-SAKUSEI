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

  it('レポートの帯（レポート／広告データ取得日時／ヒートマップ）は縮めず横スクロールにする', () => {
    // 縮めると枠から文字がはみ出して重なる（2026-09-14 実機で発覚）
    expect(css).toContain('[class*="_navContainer_"]{overflow-x:auto')
    expect(css).toContain('[class*="_navContainer_"]>*{flex:0 0 auto')
  })

  it('「広告データ取得日時」は絶対配置をやめて帯の下へ落とす（タブに重なっていた）', () => {
    expect(css).toContain('[class*="_mediaSummary_"]{position:static !important')
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
    expect(isActiveTab('#/teams/media', '#/teams/tags')).toBe(true)
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

  it('選択していなくても、丸ボタンからプロパティを開ける', () => {
    // スマホはタップするとカーソルが立つだけで「選択」にならない
    expect(src).toContain('sb-m-props-btn')
    expect(css).toContain('#sb-m-props-btn')
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
