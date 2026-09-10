/**
 * Widget編集で CSS の色を要素ごとに変えられることの機械証明（指示182の続き）。
 *
 * 本人の矢印Widgetは、色を `--arrow-color` というCSS変数で持ち、`::before` / `::after` を
 * その色で塗っている。文字が無いので、ツールバーの「文字色」では何も変わらなかった。
 *
 * 画面は離脱防止ポップアップと同じ「要素ごとのカード」。ここでは純粋関数側の約束を固定する:
 *   - 本人のCSSそのままで、`.downArrow` に「色 #d096bb」の宣言が拾える
 *   - 地の色（body など）に直接書かれた色は拾わない
 *   - 差し替えは指定した宣言の色の値だけ。同じ色の別の宣言・コメント・字下げは1文字も変わらない
 *   - 何度続けて差し替えても、同じ key で同じ宣言を指せる（ピッカーのドラッグ中の連続変更）
 */
import { describe, expect, it } from 'vitest'
import { colorToHex, replaceColor, scanColorDecls } from '../src/app/panels/widget-colors.ts'

/** 本人から送られてきたCSSの要所（前後の実SB用CSSも一部そのまま残す） */
const USER_CSS = `#articlePartPreview {
            font-size: 17px !important;
            font-family: Hiragino Sans, Arial, sans-serif !important;
            color: #000000 !important;
            letter-spacing: nullpx !important;
          }
html{height:100vh}body{margin:0 auto;height:100vh;background-color:#ececec;font-family:Hiragino Sans,sans-serif}
.CodeMirror-lint-mark-error{background-image:url(data:image/png;base64,abc#def)}

.downArrow{
  --arrow-color: #d096bb;  /* 色 */
  --arrow-w:     100px;    /* 1本の幅（padding込み） */
  display: flex;
}

.downArrow > span::before{
  content: "";
  background: var(--arrow-color);
}

.downArrow > span::after{
  background:
    linear-gradient(to top right, transparent 49%, var(--arrow-color) 50%) top left  / 50% 100% no-repeat;
}

@keyframes btnAnime02{
  0%   { transform: translate(0, 0) }
}`

describe('本人の矢印Widget', () => {
  it('.downArrow の「色 #d096bb」が拾える（変数・いつもの見た目）', () => {
    const arrow = scanColorDecls(USER_CSS).filter((d) => d.targets.some((t) => t.selector === '.downArrow'))
    expect(arrow.map((d) => [d.label, d.value, d.isVariable, d.targets])).toEqual([
      ['色', '#d096bb', true, [{ selector: '.downArrow', state: '' }]],
    ])
  })

  it('var() で塗っている ::before / ::after には色の宣言が無い（変える場所は変数1か所だけ）', () => {
    const spans = scanColorDecls(USER_CSS).filter((d) => d.targets.some((t) => t.selector === '.downArrow > span'))
    expect(spans).toEqual([])
  })

  it('body の地の色と url() の中は拾わない', () => {
    const values = scanColorDecls(USER_CSS).map((d) => d.value)
    expect(values).not.toContain('#ececec')
    expect(values).not.toContain('#def')
  })

  it('色を変えると --arrow-color の値だけが変わり、コメントも字下げもそのまま', () => {
    const arrow = scanColorDecls(USER_CSS).find((d) => d.property === '--arrow-color')
    const next = replaceColor(USER_CSS, arrow?.key ?? '', '#1e88e5')
    expect(next).toContain('--arrow-color: #1e88e5;  /* 色 */')
    expect(next.replace('#1e88e5', '#d096bb')).toBe(USER_CSS)
  })
})

describe('直接書かれた色（ライブラリの大半）', () => {
  const css = `.btn{background:#FF0000;color:#fff;border:1px solid #ff0000}
.btn:hover{background:#f00}
.title::after{border-bottom:2px solid rgb(0, 128, 0)}
@media (max-width: 600px){ .btn{ color: #FFF } }`

  it('宣言ごとに、名前と「どの状態の色か」が付く', () => {
    expect(scanColorDecls(css).map((d) => [d.targets[0]?.selector, d.targets[0]?.state, d.label, d.value])).toEqual([
      ['.btn', '', '背景色', '#FF0000'],
      ['.btn', '', '文字色', '#fff'],
      ['.btn', '', '枠線の色', '#ff0000'],
      ['.btn', 'ホバー時', '背景色', '#f00'],
      ['.title', '後ろの飾り', '枠線の色', 'rgb(0, 128, 0)'],
      ['.btn', '', '文字色', '#FFF'],
    ])
  })

  it('同じ色でも、指定した宣言だけを差し替える（背景を変えても枠線は変わらない）', () => {
    const bg = scanColorDecls(css)[0]
    const next = replaceColor(css, bg?.key ?? '', '#0000ff')
    expect(next.startsWith('.btn{background:#0000ff;color:#fff;border:1px solid #ff0000}')).toBe(true)
  })

  it('続けて差し替えても key は同じ宣言を指し続ける（長さが変わってもずれない）', () => {
    const keys = scanColorDecls(css).map((d) => d.key)
    let current = css
    for (const key of keys) current = replaceColor(current, key, '#00000080')
    expect(scanColorDecls(current).map((d) => d.key)).toEqual(keys)
    expect(scanColorDecls(current).every((d) => d.value === '#00000080')).toBe(true)
  })
})

describe('色ではないもの・効かないものを拾わない', () => {
  it('使われていない変数、#12345 のような桁数違いは出さない', () => {
    const css = `.a{--unused:#111111;--used:#222222;color:var(--used);border-color:#12345}`
    expect(scanColorDecls(css).map((d) => d.value)).toEqual(['#222222'])
  })

  it('@keyframes とコメントの中の色は出さない', () => {
    const css = `/* .a{color:#999999} */.a{color:#333}@keyframes k{from{color:#444444}}`
    expect(scanColorDecls(css).map((d) => d.value)).toEqual(['#333'])
  })

  it(':root の変数は Widget 全体の色として拾い、コメントが無ければ変数名を名前にする', () => {
    const decls = scanColorDecls(`:root{--main-color:#abcdef}.a{color:var(--main-color)}`)
    expect(decls.map((d) => [d.label, d.isGlobal])).toEqual([['main-color', true]])
  })

  it('知らない key では何も変えない', () => {
    expect(replaceColor('.a{color:#333}', '9:9:9', '#fff')).toBe('.a{color:#333}')
  })
})

describe('見本とピッカーに使う #rrggbb', () => {
  it.each([
    ['#d096bb', '#d096bb'],
    ['#FFF', '#ffffff'],
    ['#0000ffcc', '#0000ff'],
    ['rgb(0, 128, 0)', '#008000'],
    ['rgba(255,0,0,.5)', '#ff0000'],
    ['hsl(0, 100%, 50%)', null],
  ])('%s → %s', (input, expected) => {
    expect(colorToHex(input)).toBe(expected)
  })
})
