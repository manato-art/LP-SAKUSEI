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
import { BUILDER_TEMPLATE, SCREENS_SCRIPT } from '../src/app/panels/nocode/templates/builder.ts'
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
    expect(html).toContain('<h2 class="nc-b nc-b-heading nc-b-heading--l nc-b--center nc-b-1">A</h2>')
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
    expect(html).toMatch(/<div class="nc-b nc-b-shape nc-b-shape--circle nc-b-shape--w40 nc-b-1" data-nc-go="s2" role="button" tabindex="0">/)
    expect(html).toMatch(/\.nc-b-1\{[^}]*background:#1F7AE0/)
    expect(html).toContain('はい')
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
})
