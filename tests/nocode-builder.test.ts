/**
 * 「部品を積んで作る」（2026-09-22・本人の依頼。ノーコードでWidgetを作る④）。
 *
 * 見出し・文章・画像・ボタン・図形・動画・箇条書き・画像と文章・余白・区切り線 を上から順に積んで作る。
 * 画面①・画面②…を作れて、ボタン・画像・図形・動画・画像と文章は「押したとき」に
 *   何もしない ／ 画面へ移る（瞬時に切り替わる）／ リンクを開く
 * を選べる（本人の依頼「ボタンを押したら transfer①→② のように瞬時に移行」「図形や画像、動画をタップしたら移行」）。
 * 書き出しの安全さは「型から作る」と同じ（kit.ts）。
 */
import { describe, expect, it } from 'vitest'
import { ALL_BLOCK_TYPES, BUILDER_TEMPLATE, SCREENS_SCRIPT, blankBuilderData } from '../src/app/panels/nocode/templates/builder.ts'
import { TEMPLATES } from '../src/app/panels/nocode/templates/list.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const NOW = new Date(Date.UTC(2026, 8, 22, 3, 0))
const UID = 'nc-test0002'
const PNG = 'data:image/png;base64,iVBORw0KGgo='
const MP4 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29t'
const XSS = '<img src=x onerror=alert(1)>'

function screen(id: string, name: string, blocks: readonly ItemData[]): ItemData {
  return { id, name, blocks }
}

function render(screens: readonly ItemData[], extra: Record<string, unknown> = {}, view?: { screen?: string }): string {
  const data = { ...BUILDER_TEMPLATE.defaults(NOW), screens, ...extra } as TemplateData
  return BUILDER_TEMPLATE.render(data, UID, view)
}

function validate(screens: readonly ItemData[]): string | null {
  return BUILDER_TEMPLATE.validate({ ...BUILDER_TEMPLATE.defaults(NOW), screens } as TemplateData, NOW)
}

describe('部品を積む', () => {
  it('見本の中身のままでも入れられる', () => {
    const data = BUILDER_TEMPLATE.defaults(NOW)
    expect(BUILDER_TEMPLATE.validate(data, NOW)).toBeNull()
    expect(BUILDER_TEMPLATE.render(data, UID)).toContain(`class="nc nc-builder ${UID}"`)
  })

  it('積んだ順に出す', () => {
    const html = render([
      screen('s1', '画面①', [
        { type: 'heading', text: 'はじめての方へ', size: 'l', align: 'center', color: '#1F2A37' },
        { type: 'text', text: '1行目\n2行目', align: 'left' },
        { type: 'divider', style: 'solid' },
        { type: 'spacer', size: 'm' },
      ]),
    ])
    const order = ['nc-b-heading', 'nc-b-text', 'nc-b-divider', 'nc-b-spacer'].map((c) => html.indexOf(`nc-b ${c}`))
    expect(order.every((at) => at > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(html).toContain('1行目<br>2行目')
  })

  it('見出しの大きさ・寄せ・色は部品ごと（ほかの見出しに移らない）', () => {
    const html = render([
      screen('s1', '画面①', [
        { type: 'heading', text: 'A', size: 'l', align: 'center', color: '#E5573F' },
        { type: 'heading', text: 'B', size: 's', align: 'left', color: '#1F7AE0' },
      ]),
    ])
    expect(html).toMatch(/\.nc-b-1\{[^}]*color:#E5573F/)
    expect(html).toMatch(/\.nc-b-2\{[^}]*color:#1F7AE0/)
    expect(html).toContain('<h2 class="nc-b nc-b-heading nc-b--center nc-b-1">A</h2>')
    // 大きさは数（px）。以前の 大/小 は 26/17px として読む
    expect(html).toMatch(/\.nc-b-1\{[^}]*font-size:26px/)
    expect(html).toMatch(/\.nc-b-2\{[^}]*font-size:17px/)
  })

  it('見出し・文章・余白・上下の余白は数（px）で持ち、以前の選びも読める（Canva風にドラッグできる土台）', () => {
    const html = render(
      [
        screen('s1', '画面①', [
          { type: 'heading', text: 'A', size: 30, align: 'left', color: '#1F2A37' },
          { type: 'text', text: 'x', size: 12, align: 'left' },
          { type: 'text', text: 'y', size: 's', align: 'left' },
          { type: 'spacer', size: 'l' },
          { type: 'spacer', size: 12.4 },
        ]),
      ],
      { padding: 8 },
    )
    expect(html).toMatch(/\.nc-b-1\{[^}]*font-size:30px/)
    // 14px未満の文章は注意書きの見た目
    expect(html).toContain('<p class="nc-b nc-b-text nc-b-text--s nc-b--left nc-b-2">x</p>')
    expect(html).toMatch(/\.nc-b-2\{font-size:12px\}/)
    expect(html).toMatch(/\.nc-b-3\{font-size:12.5px\}/)
    expect(html).toMatch(/\.nc-b-4\{height:56px\}/)
    expect(html).toMatch(/\.nc-b-5\{height:12.5px\}/)
    expect(html).toMatch(new RegExp(`\\.${UID}\\{[^}]*padding:8px 16px`))
    expect(html).not.toContain('nc-b-heading--')
    expect(html).not.toContain('nc-b-spacer--')
    // 範囲の外・読めない値は端か既定
    const odd = render([screen('s1', '画面①', [{ type: 'heading', text: 'A', size: 999, align: 'left', color: '#1F2A37' }, { type: 'spacer', size: 'huge' }])])
    expect(odd).toMatch(/\.nc-b-1\{[^}]*font-size:48px/)
    expect(odd).toMatch(/\.nc-b-2\{height:32px\}/)
  })

  it('ボタンのリンクは「ボタン」の型と同じ見た目で、計測の目印も付けられる', () => {
    const html = render([
      screen('s1', '画面①', [
        { type: 'button', label: '申し込む', action: 'link', url: 'https://shop.example.test/', track: true, color: '#06C755', look: 'cta' },
      ]),
    ])
    expect(html).toContain('href="https://shop.example.test/?sb_tracking=true"')
    expect(html).toMatch(/background:#06C755/)
  })

  it('箇条書きは1行が1つ。空の行は数えない', () => {
    const html = render([screen('s1', '画面①', [{ type: 'list', text: '送料無料\n\n30日間返品OK\n', marker: 'check' }])])
    expect(html.match(/<li class="nc-b-list__item"/g)?.length).toBe(2)
  })

  it('画像と文章は、画像を左か右に置ける（狭い画面では縦に並ぶ）', () => {
    const html = render([screen('s1', '画面①', [{ type: 'imageText', image: PNG, heading: '使い方', text: '説明', side: 'right' }])])
    expect(html).toContain('nc-b-imageText--right')
    expect(html).toContain(`src="${PNG}"`)
    expect(html).toMatch(/@media \(max-width:480px\)/)
  })

  it('背景の色と上下の余白は Widget 全体に効く', () => {
    const html = render([screen('s1', '画面①', [{ type: 'text', text: 'x', align: 'left' }])], { background: '#FFF8E7', padding: 'l' })
    expect(html).toMatch(new RegExp(`\\.${UID}\\{[^}]*background:#FFF8E7`))
    expect(html).toMatch(new RegExp(`\\.${UID}\\{[^}]*padding:56px 16px`))
  })
})

describe('画面を切り替える（画面①→画面②）', () => {
  const twoScreens = [
    screen('s1', '画面①', [
      { type: 'heading', text: '好きな色は？', size: 'm', align: 'center', color: '#1F2A37' },
      { type: 'button', label: '赤', action: 'screen', target: 's2', color: '#E5573F', look: 'choice' },
      { type: 'image', image: PNG, alt: '青', action: 'screen', target: 's2', width: '100' },
    ]),
    screen('s2', '結果', [{ type: 'text', text: 'ありがとう', align: 'center' }]),
  ]

  it('最初の画面だけ見せ、ほかの画面は隠しておく（スクリプトが無くても最初の画面が出る）', () => {
    const html = render(twoScreens)
    expect(html).toContain('<div class="nc-screen" data-nc-screen="s1" data-nc-name="画面①">')
    expect(html).toContain('<div class="nc-screen" data-nc-screen="s2" data-nc-name="結果" hidden>')
    expect(html).toContain('data-nc-screens="true"')
  })

  it('押したら移る部品には、移る先の画面を data-nc-go で書く（ボタン以外は押せる印も付ける）', () => {
    const html = render(twoScreens)
    expect(html).toMatch(/<a class="nc-b-button__a nc-b-button__a--choice" href="#" data-nc-go="s2">/)
    expect(html).toMatch(/<figure class="[^"]*nc-b-image[^"]*" data-nc-go="s2" role="button" tabindex="0">/)
  })

  it('画面が2つ以上なら、切り替えの固定のスクリプトを入れる。1つなら入れない', () => {
    expect(render(twoScreens)).toContain(SCREENS_SCRIPT)
    expect(render([twoScreens[0] as ItemData].map((s) => ({ ...s, blocks: [{ type: 'text', text: 'x', align: 'left' }] })))).not.toContain('<script>')
  })

  it('見え方（プレビュー）では、編集している画面から見せられる', () => {
    expect(render(twoScreens, {}, { screen: 's2' })).toContain('data-nc-start="s2"')
    // スクリプトの中にも data-nc-start という文字はあるので、属性の形で確かめる
    expect(render(twoScreens)).not.toContain('data-nc-start="')
  })

  it('切り替わり方（瞬時・ふわっと・横から）を data 属性で渡す', () => {
    expect(render(twoScreens, { transition: 'fade' })).toContain('data-nc-transition="fade"')
    expect(render(twoScreens)).toContain('data-nc-transition="none"')
  })

  it('スクリプトはJavaScriptとして読め、編集中の本文（.ql-editor）では動かさず、動かした目印を属性に書かない', () => {
    expect(() => new Function(SCREENS_SCRIPT)).not.toThrow()
    expect(SCREENS_SCRIPT).toContain('.ql-editor')
    expect(SCREENS_SCRIPT).not.toMatch(/setAttribute\(\s*['"]data-nc-/)
  })
})

describe('図形・動画・選択肢のボタン', () => {
  it('図形は、形・色・中の文字を選べ、押したら移れる', () => {
    const html = render([
      screen('s1', '画面①', [{ type: 'shape', shape: 'circle', size: '40', color: '#1F7AE0', text: 'はい', action: 'screen', target: 's2' }]),
      screen('s2', '画面②', [{ type: 'text', text: 'x', align: 'left' }]),
    ])
    expect(html).toMatch(/<div class="nc-b nc-b-shape nc-b-shape--circle nc-b-1" data-nc-go="s2" role="button" tabindex="0">/)
    expect(html).toMatch(/\.nc-b-1\{[^}]*background:#1F7AE0/)
    // 幅は数で持つ（以前の '40' のような文字も 40% として読む）
    expect(html).toMatch(/\.nc-b-1\{[^}]*width:40%/)
    expect(html).toContain('はい')
  })

  it('画像・図形の幅は 10〜100% の数（範囲の外・読めない値は既定の 100%）', () => {
    const wide = render([screen('s1', '画面①', [{ type: 'image', image: PNG, alt: '', action: 'none', width: 75 }])])
    expect(wide).toMatch(/\.nc-b-1 img\{width:75%;/)
    expect(wide).not.toContain('nc-b-image--w')
    const legacy = render([screen('s1', '画面①', [{ type: 'image', image: PNG, alt: '', action: 'none', width: '60' }])])
    expect(legacy).toMatch(/\.nc-b-1 img\{width:60%;/)
    const broken = render([screen('s1', '画面①', [{ type: 'shape', shape: 'rect', size: 'huge', color: '#E5573F', text: '', action: 'none' }])])
    expect(broken).toMatch(/\.nc-b-1\{[^}]*width:100%/)
    const tiny = render([screen('s1', '画面①', [{ type: 'shape', shape: 'rect', size: 3, color: '#E5573F', text: '', action: 'none' }])])
    expect(tiny).toMatch(/\.nc-b-1\{[^}]*width:10%/)
  })

  it('動画は、押したら移るなら操作ボタンを出さない（押すと再生ではなく移る）。自動再生は音なし・くり返し', () => {
    const go = render([
      screen('s1', '画面①', [{ type: 'video', video: MP4, autoplay: true, action: 'screen', target: 's2' }]),
      screen('s2', '画面②', [{ type: 'text', text: 'x', align: 'left' }]),
    ])
    expect(go).toMatch(/<video class="nc-b-video__v" src="data:video\/mp4;base64,[^"]+" playsinline preload="metadata" autoplay muted loop><\/video>/)
    const plain = render([screen('s1', '画面①', [{ type: 'video', video: MP4, autoplay: false, action: 'none' }])])
    expect(plain).toContain(' controls')
  })

  it('ボタンの見た目は「目立つボタン」と「選択肢（白地に枠）」から選べる', () => {
    const html = render([screen('s1', '画面①', [{ type: 'button', label: 'はい', action: 'none', color: '#E5573F', look: 'choice' }])])
    expect(html).toContain('nc-b-button__a--choice')
    expect(html).toMatch(/border:2px solid #E5573F/)
  })
})

describe('安全さ', () => {
  it('部品の文字・画面の名前に <script> や onerror を書かれても文字として出るだけ。移る先のidは決まった形だけ', () => {
    const html = render([
      screen('s1', XSS, [
        { type: 'heading', text: XSS, size: 'm', align: 'left', color: '#1F2A37' },
        { type: 'text', text: XSS, align: 'left' },
        { type: 'list', text: XSS, marker: 'dot' },
        { type: 'button', label: XSS, action: 'link', url: 'javascript:alert(1)', track: false, color: '#E5573F' },
        { type: 'image', image: PNG, alt: XSS, action: 'link', url: 'javascript:alert(2)', width: '100' },
        { type: 'shape', shape: 'rect', size: '100', color: '#E5573F', text: XSS, action: 'screen', target: '"><script>alert(3)</script>' },
        { type: 'imageText', image: PNG, heading: XSS, text: XSS, side: 'left' },
      ]),
    ])
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('data-nc-go="&quot;')
  })
})

describe('入れる前の確かめ', () => {
  it('部品が1つも無い画面・文字の無いボタン・画像や動画を選んでいない部品は入れられない', () => {
    expect(validate([screen('s1', '画面①', [])])).toContain('部品')
    expect(validate([screen('s1', '画面①', [{ type: 'button', label: ' ', action: 'none', color: '#E5573F' }])])).toContain('ボタンの文字')
    expect(validate([screen('s1', '画面①', [{ type: 'image', image: '', alt: '', action: 'none', width: '100' }])])).toContain('画像')
    expect(validate([screen('s1', '画面①', [{ type: 'video', video: '', autoplay: false, action: 'none' }])])).toContain('動画')
  })

  it('移る先の画面が無い（消した・選んでいない）部品は入れられない', () => {
    expect(
      validate([screen('s1', '画面①', [{ type: 'button', label: 'はい', action: 'screen', target: 's9', color: '#E5573F' }])]),
    ).toContain('移る先')
  })
})

describe('見本の部品（ライブラリの見本を部品として積む）', () => {
  const SAMPLE = '<style>.q{color:red}</style><div class="q"><a class="yes" href="#" data-nc-go="s2">はい</a></div><script>var a=1</script>'

  it('見本のHTMLはそのまま、部品の箱に入れる（見本のstyle・scriptも残す）', () => {
    const html = render([
      screen('s1', '画面①', [{ type: 'sample', title: 'アンケート', html: SAMPLE }]),
      screen('s2', '画面②', [{ type: 'text', text: 'ありがとう', align: 'center' }]),
    ])
    expect(html).toContain(`<div class="nc-b nc-b-sample nc-b-1">${SAMPLE}</div>`)
  })

  it('「部品を積んで作る」の土台の見た目（画像の出し方・余白など）は、見本の中には効かせない', () => {
    const css = /<style>([\s\S]*?)<\/style>/.exec(render([screen('s1', '画面①', [{ type: 'sample', title: 'x', html: '<p>x</p>' }])]))?.[1] ?? ''
    expect(css).toContain(`.${UID} img:not(.nc-b-sample *)`)
    expect(css).toContain(`.${UID} *:not(.nc-b-sample *)`)
    expect(css).toMatch(/\.nc-b-sample\{[^}]*line-height:1\.5/)
  })

  it('見本を選んでいない・見本のボタンが消した画面へ移る、は入れられない', () => {
    expect(validate([screen('s1', '画面①', [{ type: 'sample', title: '', html: '' }])])).toContain('見本')
    expect(validate([screen('s1', '画面①', [{ type: 'sample', title: 'x', html: '<a data-nc-go="s9">a</a>' }])])).toContain('移る先')
  })

  it('押したときの切り替えは、見本自身のスクリプト（次の設問へ・ページ移動）より先に受け取って止める', () => {
    expect(SCREENS_SCRIPT).toMatch(/addEventListener\('click',function\(e\)\{[\s\S]*?stopPropagation\(\)[\s\S]*?\},true\)/)
  })

  it('中に別の「部品を積んで作る」が入っていても、その中の切り替えはその持ち主に任せる', () => {
    expect(SCREENS_SCRIPT).toContain("closest('[data-nc-screens]')!==root")
  })

  it('押せない状態のボタン（選ぶまで押せない「次へ」など）では移らない（ページ移動も止めたまま）', () => {
    // 見本の「次へ」は、選択肢を選ぶまで is-disabled になる（見本自身のスクリプトが付け外しする）
    const click = /addEventListener\('click',function\(e\)\{([\s\S]*?)\},true\)/.exec(SCREENS_SCRIPT)?.[1] ?? ''
    expect(click.indexOf('stopPropagation()')).toBeGreaterThan(-1)
    expect(click.indexOf('off(t)')).toBeGreaterThan(click.indexOf('stopPropagation()'))
    expect(click.indexOf('off(t)')).toBeLessThan(click.indexOf('show('))
    expect(SCREENS_SCRIPT).toContain("hasAttribute('disabled')")
    expect(SCREENS_SCRIPT).toContain("getAttribute('aria-disabled')==='true'")
    // 見本によって is-disabled / disabled のどちらかを付け外しする
    expect(SCREENS_SCRIPT).toContain('(is-)?disabled')
    expect(() => new Function(SCREENS_SCRIPT)).not.toThrow()
  })
})

/**
 * 本人の決定（2026-09-23）「見本の設問①②③は画面①②③としてタブに並べる」。
 * 分けた部品にはどれにも見本のCSS・スクリプトが入っているので、そのまま出すと
 * 見本のスクリプトが画面の数だけ動く（押すと二重に進む）。同じ中身は最初の1つだけ出す。
 */
describe('分けた見本の部品', () => {
  const SAMPLE = '<style>.q{color:red}</style><script>window.q=(window.q||0)+1</script><div class="q">問い</div>'

  it('同じCSS・同じスクリプトは1回だけ出す（中身の違う部品はそのまま）', () => {
    const html = render([
      screen('s1', '画面①', [{ type: 'sample', title: 'アンケート', html: SAMPLE }]),
      screen('s2', '画面②', [{ type: 'sample', title: 'アンケート', html: SAMPLE.replace('問い', '問い2') }]),
      screen('s3', '画面③', [{ type: 'sample', title: 'ほかの見本', html: '<style>.r{color:blue}</style><p>別</p>' }]),
    ])
    expect(html.split('<style>.q{color:red}</style>')).toHaveLength(2)
    expect(html.split('window.q=(window.q||0)+1')).toHaveLength(2)
    expect(html).toContain('問い2')
    expect(html).toContain('.r{color:blue}')
  })
})

/**
 * 本人の決定（2026-09-23）「同じ画面と部品に型が入る」。
 * 「型から作る」の型8種を、画面の中の部品として置ける（入力欄は型のものをそのまま使う）。
 */
describe('型の部品', () => {
  it('型8種がそのまま部品として選べる（名前・アイコン・入力欄は型のもの）', () => {
    for (const template of TEMPLATES) {
      const block = ALL_BLOCK_TYPES.find((t) => t.type === `tpl-${template.id}`)
      expect(block?.label).toBe(template.name)
      expect(block?.icon).toBe(template.icon)
      expect(block?.newItem()['uid']).toMatch(/^nc-[a-z0-9]{8}$/)
      // 「押したとき」を足すのは押す所が1つの型だけ（ボタン）
      const hasPress = (block?.fields ?? []).some((f) => f.kind === 'goto')
      expect(hasPress).toBe(template.id === 'cta')
    }
  })

  it('型の部品は型のHTMLをそのまま書き出す（この部品だけのWidgetの名前で、ほかの型とまざらない）', () => {
    const faq = ALL_BLOCK_TYPES.find((t) => t.type === 'tpl-faq')?.newItem() ?? {}
    const html = render([screen('s1', '画面①', [{ ...faq, uid: 'nc-abcd1234' }])])
    expect(html).toContain('class="nc-b nc-b-tpl')
    expect(html).toContain('class="nc nc-faq nc-abcd1234"')
    expect(html).toContain('よくある質問')
    // 型のCSSはその型の名前の中だけ（外の部品に効かない）
    expect(html).toContain('.nc-abcd1234')
  })

  it('型の部品の中身がそろっていなければ、どの画面のどの部品かを添えて知らせる', () => {
    const faq = ALL_BLOCK_TYPES.find((t) => t.type === 'tpl-faq')?.newItem() ?? {}
    const problem = validate([screen('s1', '画面①', [{ ...faq, items: [{ q: '', a: '' }] }])])
    expect(problem).toContain('「画面①」のよくある質問')
    expect(problem).toContain('空の質問')
  })

  it('ボタンの型の部品は「押したとき」で画面へ移せる（型の中の最初のリンクに効く）', () => {
    const cta = ALL_BLOCK_TYPES.find((t) => t.type === 'tpl-cta')?.newItem() ?? {}
    const html = render([
      screen('s1', '画面①', [{ ...cta, label: '申し込む', url: 'https://example.com/', action: 'screen', target: 's2' }]),
      screen('s2', '画面②', [{ type: 'text', text: 'ありがとうございます', align: 'left' }]),
    ])
    expect(html).toContain('data-nc-go="s2"')
    expect(html.indexOf('data-nc-go="s2"')).toBeLessThan(html.indexOf('申し込む'))
  })
})

describe('部品の文字の飾り（第3弾・ツールバーで付けた太字や色を持つ）', () => {
  it('飾りは残り、危ないものは外れ、以前の素の文字もそのまま', () => {
    const html = render([
      screen('s1', '画面①', [
        { type: 'heading', text: '請求も<span style="color:#e5573f">ひとつ</span>で<b>まとめて</b><img src=x onerror=alert(1)>', size: 21, align: 'left', color: '#1F2A37' },
        { type: 'text', text: 'A & B\n2行目<script>x()</script>', size: 15, align: 'left' },
        { type: 'button', label: '<u>申し込む</u>', look: 'cta', color: '#E5573F', action: 'none' },
        { type: 'list', text: '<b>送料無料</b>\n返品可', marker: 'check' },
      ]),
    ])
    expect(html).toContain('請求も<span style="color:#e5573f">ひとつ</span>で<b>まとめて</b></h2>')
    expect(html).not.toContain('onerror')
    expect(html).toContain('A &amp; B<br>2行目</p>')
    expect(html).not.toContain('x()')
    expect(html).toContain('<span class="nc-b-button__label"><u>申し込む</u></span>')
    expect(html).toContain('<span class="nc-b-list__text"><b>送料無料</b></span>')
  })

  it('飾りだけで文字が無いものは空として確かめる', () => {
    expect(validate([screen('s1', '画面①', [{ type: 'heading', text: '<b></b><br>', size: 21, align: 'left', color: '#1F2A37' }])])).toContain('文字が空')
  })

  it('背景「なし」はLPの地のまま（背景の指定を書かない）', () => {
    const html = render([screen('s1', '画面①', [{ type: 'text', text: 'x', align: 'left' }])], { background: 'none', padding: 0 })
    expect(html).toMatch(new RegExp(`\\.${UID}\\{padding:0px 16px;\\}`))
  })
})

describe('白紙から始める（2026-09-24・「ノーコードで作る」で前の例が引き継がれて消せなかった）', () => {
  it('画面①だけ・部品なし。Widget全体の設定は既定のまま', () => {
    const blank = blankBuilderData(NOW)
    expect(blank['screens']).toEqual([{ id: 's1', name: '画面①', blocks: [] }])
    expect(blank['padding']).toBe(BUILDER_TEMPLATE.defaults(NOW)['padding'])
  })

  it('白紙のままでは入れられない（部品を足すように知らせる）が、書き出しは壊れない', () => {
    const blank = blankBuilderData(NOW)
    expect(BUILDER_TEMPLATE.validate(blank, NOW)).toContain('部品がありません')
    expect(BUILDER_TEMPLATE.render(blank, UID)).toContain(`class="nc nc-builder ${UID}"`)
  })
})

describe('選ぶ入力は絵のタイル・図形は11種（2026-09-24・本人「文字ではなく形で。言葉が違う人でも分かるように」）', () => {
  const selectsIn = (fields: readonly unknown[]): { key: string; options: readonly { icon?: string }[] }[] =>
    (fields as { kind: string; key: string; options?: readonly { icon?: string }[]; fields?: readonly unknown[] }[]).flatMap((f) => [
      ...(f.kind === 'select' ? [{ key: f.key, options: f.options ?? [] }] : []),
      ...(f.kind === 'list' ? selectsIn(f.fields ?? []) : []),
    ])

  it('部品・型・Widget全体の選ぶ入力は、どの選択肢にも絵がある（プルダウンが残らない）', () => {
    const all = [
      ...selectsIn(BUILDER_TEMPLATE.fields),
      ...ALL_BLOCK_TYPES.flatMap((t) => selectsIn(t.fields)),
      ...TEMPLATES.flatMap((t) => selectsIn(t.fields)),
    ]
    expect(all.length).toBeGreaterThan(10)
    for (const select of all) {
      for (const option of select.options) expect(option.icon, select.key).toMatch(/^<svg /)
    }
  })

  it('図形は11種。どれもその形のクラスで書き出し、形ごとのCSSがある。知らない形は角の丸い四角', () => {
    const shapeType = ALL_BLOCK_TYPES.find((t) => t.type === 'shape')
    const shapeField = shapeType?.fields.find((f) => f.key === 'shape') as { options: readonly { value: string }[] } | undefined
    const kinds = shapeField?.options.map((o) => o.value) ?? []
    expect(kinds).toEqual(['round', 'rect', 'circle', 'pill', 'ellipse', 'diamond', 'hexagon', 'bubble', 'arrow', 'down', 'ribbon'])
    const html = render([
      screen(
        's1',
        '画面①',
        [...kinds, 'zzbad"><script>'].map((shape) => ({ type: 'shape', shape, size: 60, color: '#1F7AE0', text: 'x', action: 'none' })),
      ),
    ])
    for (const kind of kinds) {
      expect(html).toContain(`nc-b-shape--${kind} `)
      expect(html).toMatch(new RegExp(`\\.nc-b-shape--${kind}\\{`))
    }
    expect(html).not.toContain('zzbad')
    expect(html.match(/nc-b-shape--round /g)?.length).toBe(2)
  })
})

describe('どの部品も幅と置く位置を持つ（2026-09-24・本人「部品ごとに中央揃えや左右へ。サイズも変えられるように」）', () => {
  it('余白以外の部品は、いちばん上に「幅」と「置く位置」の入力がある（型の部品も）', () => {
    for (const type of ALL_BLOCK_TYPES) {
      const keys = type.fields.slice(0, 2).map((f) => [f.kind, f.key])
      if (type.type === 'spacer') {
        expect(keys.some(([, key]) => key === 'place'), type.type).toBe(false)
        continue
      }
      expect(keys[1], type.type).toEqual(['select', 'place'])
      expect(keys[0]?.[0], type.type).toBe('number')
    }
  })

  it('値が無い部品（見本の部品・以前の中身）は、欄にも書き出しの既定（幅100%・中央）を見せる', () => {
    for (const type of ALL_BLOCK_TYPES) {
      if (type.type === 'spacer') continue
      const [width, place] = type.fields
      expect(width?.kind === 'number' ? width.fallback : null, type.type).toBe(100)
      expect(place?.kind === 'select' ? place.fallback : null, type.type).toBe('center')
    }
  })

  it('画像・動画は中の絵、図形はそれ自体、ほかは外枠に幅と位置を書く（100%の外枠は何も書かない）', () => {
    const html = render([
      screen('s1', '画面①', [
        { type: 'image', image: PNG, alt: '', action: 'none', width: 50, place: 'left' },
        { type: 'video', video: MP4, autoplay: false, action: 'none', width: 70, place: 'right' },
        { type: 'shape', shape: 'round', size: 40, color: '#1F7AE0', text: '', action: 'none' },
        { type: 'heading', text: 'A', size: 21, align: 'right', color: '#1F2A37', boxWidth: 60, place: 'right' },
        { type: 'text', text: 'B', size: 15, align: 'left' },
        { type: 'button', label: 'C', look: 'cta', color: '#E5573F', action: 'none', boxWidth: 80, place: 'weird' },
      ]),
    ])
    expect(html).toContain('.nc-b-1 img{width:50%;margin-left:0;margin-right:auto}')
    expect(html).toContain('.nc-b-2 .nc-b-video__v{width:70%;margin-left:auto;margin-right:0}')
    expect(html).toContain('.nc-b-3{width:40%;margin-left:auto;margin-right:auto}')
    expect(html).toContain('.nc-b-4{width:60%;margin-left:auto;margin-right:0}')
    expect(html).toContain('nc-b--right')
    expect(html).not.toMatch(/\.nc-b-5\{width/)
    // 知らない置き方は中央
    expect(html).toContain('.nc-b-6{width:80%;margin-left:auto;margin-right:auto}')
  })
})
