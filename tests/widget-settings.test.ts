/**
 * Widget編集「要素ごとに編集」で、色・大きさ・余白・動きを全部変えられることの機械証明。
 *
 * 本人から「このCSSなら（変数6つ）全部だし、物によっては色・大きさ・他の要素もある。全部確認して」。
 * そこで2段で確かめる:
 *   1. 本人の矢印Widget … 変数6つ（色・1本の幅・1本の高さ・間隔・動きの速さ・浮き上がる量）が
 *      コメントどおりの名前・正しい種類で全部出て、書き換えられる
 *   2. 採取した Widget ライブラリ25件すべて … 落ちない／拾った全設定が位置ぴったり（差し替えて元に戻る）／
 *      全部の数値を変えても key がずれない
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  colorToHex,
  numberStep,
  numberToken,
  replaceSetting,
  sanitizeValue,
  scanSettings,
  type Setting,
} from '../src/app/panels/widget-settings.ts'

/** 本人から送られてきた矢印WidgetのCSS（今の値 #ff0000 のまま） */
const ARROW_CSS = `#articlePartPreview {
            font-size: 17px !important;
            color: #000000 !important;
          }
html{height:100vh}body{margin:0 auto;height:100vh;background-color:#ececec}

.downArrow{
  --arrow-color: #ff0000;  /* 色 */
  --arrow-w:     100px;    /* 1本の幅（padding込み） */
  --arrow-h:     65px;     /* 1本の高さ */
  --arrow-gap:   10px;     /* 矢印同士の間隔 */
  --arrow-speed: 1.5s;     /* 動きの速さ */
  --arrow-lift:  8px;      /* 浮き上がる量 */

  display: flex;
  justify-content: center;
  align-items: flex-start;
  box-sizing: border-box;
}

.downArrow > span{
  width:  var(--arrow-w);
  height: var(--arrow-h);
  padding: 0 var(--arrow-gap);
  box-sizing: border-box;
}

/* 軸（棒の部分） */
.downArrow > span::before{
  content: "";
  display: block;
  margin: 0 auto;
  width: 50%;
  height: 40%;
  background: var(--arrow-color);
}

/* 先端（三角の部分） */
.downArrow > span::after{
  content: "";
  display: block;
  width: 100%;
  height: 60%;
  background:
    linear-gradient(to top right, transparent 49%, var(--arrow-color) 50%) top left  / 50% 100% no-repeat,
    linear-gradient(to top left,  transparent 49%, var(--arrow-color) 50%) top right / 50% 100% no-repeat;
}

/* アニメーション */
.movebtn{
  animation: btnAnime02 var(--arrow-speed) ease infinite;
}
@keyframes btnAnime02{
  0%   { transform: translate(0, 0) }
  50%  { transform: translate(0, calc(var(--arrow-lift) * -1)) }
  100% { transform: translate(0, 0) }
}
@media (prefers-reduced-motion: reduce){
  .movebtn{ animation: none }
}`

const on = (settings: readonly Setting[], selector: string): Setting[] =>
  settings.filter((s) => s.targets.some((t) => t.selector === selector))

/** 位置ぴったりかの確認に使う、今の値をそのまま書いた文字列 */
const currentText = (s: Setting): string => (s.kind === 'number' ? `${s.value}${s.unit}` : s.value)

describe('本人の矢印Widget（変数6つ）', () => {
  const settings = scanSettings(ARROW_CSS)

  it('.downArrow に6つ全部が、コメントどおりの名前・種類・単位で出る', () => {
    expect(on(settings, '.downArrow').map((s) => [s.label, s.kind, s.group, s.value, s.unit])).toEqual([
      ['色', 'color', 'color', '#ff0000', ''],
      ['1本の幅（padding込み）', 'number', 'size', '100', 'px'],
      ['1本の高さ', 'number', 'size', '65', 'px'],
      ['矢印同士の間隔', 'number', 'size', '10', 'px'],
      ['動きの速さ', 'number', 'motion', '1.5', 's'],
      ['浮き上がる量', 'number', 'size', '8', 'px'],
    ])
  })

  it('棒と三角（::before / ::after）の大きさも出る。変数で持つ値は二重に出さない', () => {
    expect(on(settings, '.downArrow > span').map((s) => [s.label, s.targets[0]?.state, s.value, s.unit])).toEqual([
      ['外側の余白・上下', '前の飾り', '0', ''],
      ['幅', '前の飾り', '50', '%'],
      ['高さ', '前の飾り', '40', '%'],
      ['幅', '後ろの飾り', '100', '%'],
      ['高さ', '後ろの飾り', '60', '%'],
    ])
  })

  it('地の色（body 等）や @keyframes の中は出さない', () => {
    expect(settings.some((s) => s.value === '#ececec')).toBe(false)
    expect(settings.some((s) => s.targets.some((t) => /^\d+%$/.test(t.selector)))).toBe(false)
  })

  it('1本の幅を 140px にすると、その値だけが変わる（コメント・字下げはそのまま）', () => {
    const width = settings.find((s) => s.property === '--arrow-w')
    const next = replaceSetting(ARROW_CSS, width?.key ?? '', numberToken(width as Setting, 140).token)
    expect(next).toContain('--arrow-w:     140px;    /* 1本の幅（padding込み） */')
    expect(next.replace('140px', '100px')).toBe(ARROW_CSS)
  })

  it('動きの速さは秒のまま、刻みは0.1', () => {
    const speed = settings.find((s) => s.property === '--arrow-speed') as Setting
    expect(numberToken(speed, 0.8).token).toBe('0.8s')
    expect(numberStep(speed)).toBe(0.1)
  })
})

describe('直接書かれた設定（ライブラリの大半）', () => {
  it('要素名だけの規則（実SBの normalize 等）は出さない。クラスで書かれた規則は出す', () => {
    const css = 'h1{font-size:2em;margin:.67em 0}img{border:0}body a{color:#000}button,input{margin:0}.card h2{font-size:20px}'
    expect(scanSettings(css).map((s) => [s.targets[0]?.selector, s.label, s.value])).toEqual([
      ['.card h2', '文字の大きさ', '20'],
    ])
  })

  it('@media の中の設定には効く条件が付く（スマホとPCで値が違う行を見分ける）', () => {
    const css =
      '.a{margin-top:4.8%}@media (min-width: 768px){.a{margin-top:18px}}' +
      '@media screen and (max-width: 767px){.a{width:85vw}}' +
      '@media (prefers-reduced-motion: reduce){.a{transition:none .2s}}'
    expect(scanSettings(css).map((s) => [s.label, s.value, s.context, s.media])).toEqual([
      ['外側の余白・上', '4.8', '', []],
      ['外側の余白・上', '18', '画面幅768px以上', ['(min-width: 768px)']],
      ['幅', '85', '画面幅767px以下', ['screen and (max-width: 767px)']],
      ['変化にかける時間', '.2', '動きを減らす設定のとき', ['(prefers-reduced-motion: reduce)']],
    ])
  })

  it('余白の並びは位置で名前が付く', () => {
    const s = scanSettings('.a{padding:10px 20px 30px 40px;border-radius:8px 4px}')
    expect(s.map((x) => [x.label, x.value, x.unit])).toEqual([
      ['内側の余白・上', '10', 'px'],
      ['内側の余白・右', '20', 'px'],
      ['内側の余白・下', '30', 'px'],
      ['内側の余白・左', '40', 'px'],
      ['角の丸み・左上と右下', '8', 'px'],
      ['角の丸み・右上と左下', '4', 'px'],
    ])
  })

  it('枠線は太さ（数値）と色（見本）の2行になる', () => {
    const s = scanSettings('.a{border:1px solid #ccc}')
    expect(s.map((x) => [x.label, x.kind])).toEqual([
      ['枠線の色', 'color'],
      ['枠線の太さ', 'number'],
    ])
  })

  it('transition / animation は時間と待ちに分かれる（複数あれば何番目か付く）', () => {
    const s = scanSettings('.a{transition:color .3s ease .1s, background .5s;animation:pulse 2s ease-in-out 0.5s infinite}')
    expect(s.map((x) => [x.label, x.value, x.unit])).toEqual([
      ['変化にかける時間（1つ目）', '.3', 's'],
      ['変化が始まるまでの待ち（1つ目）', '.1', 's'],
      ['変化にかける時間（2つ目）', '.5', 's'],
      ['動き1回の時間', '2', 's'],
      ['動きが始まるまでの待ち', '0.5', 's'],
    ])
  })

  it('数字が組み合わさった値は、値まるごと1行（影の色は見本でも変えられる）', () => {
    const s = scanSettings('.a{transform:translate(-50%, -50%) rotate(45deg);width:calc(100% - 20px);box-shadow:0 2px 4px rgba(0,0,0,.2)}')
    expect(s.map((x) => [x.label, x.kind, x.value])).toEqual([
      ['変形（位置・回転・拡大）', 'text', 'translate(-50%, -50%) rotate(45deg)'],
      ['幅', 'text', 'calc(100% - 20px)'],
      ['影の色', 'color', 'rgba(0,0,0,.2)'],
      ['影', 'text', '0 2px 4px rgba(0,0,0,.2)'],
    ])
  })

  it('!important は残したまま数値だけ変わる', () => {
    const css = '.a{font-size:18px !important}'
    const [size] = scanSettings(css)
    expect(replaceSetting(css, size?.key ?? '', '22px')).toBe('.a{font-size:22px !important}')
  })

  it('単位の無い 0 を変えるときは px を付ける（行の高さ・太さ・不透明度は付けない）', () => {
    const [margin] = scanSettings('.a{margin:0 auto}')
    expect(numberToken(margin as Setting, 12).token).toBe('12px')
    const [lineHeight] = scanSettings('.a{line-height:1.8}')
    expect(numberToken(lineHeight as Setting, 1.6).token).toBe('1.6')
    expect(numberToken(lineHeight as Setting, 0.1 + 0.2).token).toBe('0.3')
  })

  it('値まるごとの行は、いったん空にしても同じ宣言を指し続ける', () => {
    const css = '.a{transform:scale(1.1)}'
    const [t] = scanSettings(css)
    const empty = replaceSetting(css, t?.key ?? '', '')
    expect(empty).toBe('.a{transform:}')
    expect(replaceSetting(empty, t?.key ?? '', 'scale(2)')).toBe('.a{transform:scale(2)}')
  })

  it('自由入力から ; { } を取り除く（宣言が壊れないように）', () => {
    expect(sanitizeValue('scale(2); color:red}')).toBe('scale(2) color:red')
  })

  it('使われていない変数・#12345 のような桁数違い・コメントの中は出さない', () => {
    const css = '/* .a{width:9px} */.a{--unused:#111111;--used:#222222;color:var(--used);border-color:#12345}'
    expect(scanSettings(css).map((s) => s.value)).toEqual(['#222222'])
  })
})

describe('色の見本とピッカーに使う #rrggbb', () => {
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

/* ── 採取した Widget ライブラリ全件 ── */

function unescapeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

const LIBRARY = [
  ...readFileSync('src/app/fragments/ab_tests__UID__articles__widget-library.portals.html', 'utf8').matchAll(
    /aria-label="([^"]*)">[^<]*<\/p>[\s\S]*?<iframe[^>]*srcdoc="([^"]*)"/g,
  ),
].map((m) => {
  const doc = unescapeHtml(m[2] ?? '')
  const styles = [...doc.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((s) => s[1] ?? '')
  const own = styles.filter((s) => !['#articlePartPreview', 'normalize.css', '.CodeMirror'].some((k) => s.slice(0, 4000).includes(k)))
  return { title: m[1] ?? '', css: styles.join('\n'), ownCss: own.join('\n') }
})

describe('Widget ライブラリ全件で確認する', () => {
  it('25件そろって読める', () => {
    expect(LIBRARY).toHaveLength(25)
  })

  it.each(LIBRARY.map((w) => [w.title, w] as const))('%s: 自分のCSSから設定が拾える', (_title, w) => {
    const own = scanSettings(w.ownCss)
    expect(own.length).toBeGreaterThan(0)
    expect(own.some((s) => s.group === 'size')).toBe(true)
  })

  it.each(LIBRARY.map((w) => [w.title, w] as const))('%s: 拾った全設定が位置ぴったり（今の値で差し替えても1文字も変わらない）', (_title, w) => {
    const settings = scanSettings(w.css)
    expect(new Set(settings.map((s) => s.key)).size).toBe(settings.length)
    for (const s of settings) {
      expect(replaceSetting(w.css, s.key, currentText(s)), `${s.property} ${s.key}`).toBe(w.css)
    }
  })

  it.each(LIBRARY.map((w) => [w.title, w] as const))('%s: 数値を全部変えても key がずれない', (_title, w) => {
    const settings = scanSettings(w.css)
    let css = w.css
    for (const s of settings.filter((x) => x.kind === 'number')) {
      css = replaceSetting(css, s.key, numberToken(s, Number(s.value) + 1).token)
    }
    expect(scanSettings(css).map((s) => s.key)).toEqual(settings.map((s) => s.key))
  })
})
