/**
 * Widget編集の右の「デフォルト時のコードを表示」で、コードを直せるようにする（2026-10-18 本人「コード上でも修正・変更できるようにして」）。
 * 本人の選択「全体のコードを直す」: 直すと、部品で組み立てたWidgetは全体が「コードの部品」（見本の部品）1つになる。
 * 部品ごとの入力欄では直せなくなるので、入れる前に確かめる。「戻す」で戻せる。
 * もう「コードの部品」1つだけのWidgetは、その部品のコードを出して直す（入れ子にしない）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import { dataWithEditedCode, editableCodeOf } from '../src/app/panels/nocode/whole-code.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const UID = 'nc-whole001'

const widget = (blocks: readonly ItemData[], extra: Record<string, unknown> = {}): TemplateData => ({
  ...BUILDER_TEMPLATE.defaults(new Date()),
  ...extra,
  screens: [{ id: 's1', name: '画面①', blocks }],
})

const SHAPE: ItemData = { type: 'shape', shape: 'down', size: 100, color: '#1F7AE0', text: '理由は？', action: 'none' }
const SAMPLE_HTML = '<style>.downArrow{--arrow-color:#ff0000}</style><div class="downArrow"><span></span></div><script>var a=1</script>'

describe('コード欄に出すコード', () => {
  it('部品で組み立てたWidgetは全体のコード。設定データ（長いJSON）は出さない', () => {
    const code = editableCodeOf(widget([SHAPE]), UID)
    expect(code.mode).toBe('parts')
    expect(code.html).toContain(`class="nc nc-builder ${UID}"`)
    expect(code.html).toContain('理由は？')
    expect(code.html).not.toContain('data-nc-data')
    expect(code.html).not.toContain('<style')
    expect(code.css).toContain(`.${UID} .nc-b-1{background:#1F7AE0`)
  })

  it('「コードの部品」1つだけのWidgetは、その部品のコード（範囲を付ける前の、書いたままのCSS）', () => {
    const code = editableCodeOf(widget([{ type: 'sample', title: '矢印', html: SAMPLE_HTML }], { padding: 0, background: 'none' }), UID)
    expect(code).toEqual({
      mode: 'sample',
      html: '<div class="downArrow"><span></span></div><script>var a=1</script>',
      css: '.downArrow{--arrow-color:#ff0000}',
    })
  })
})

describe('直したコードを入れる', () => {
  it('「コードの部品」1つだけなら、その部品のコードを差し替える（ほかの設定はそのまま）', () => {
    const data = widget([{ type: 'sample', title: '矢印', html: SAMPLE_HTML }], { padding: 0, background: 'none' })
    const next = dataWithEditedCode(data, UID, { html: '<div class="downArrow">青</div>', css: '.downArrow{--arrow-color:#4000ff}' }, '名前')
    expect(next['padding']).toBe(0)
    expect(next['screens']).toEqual([
      { id: 's1', name: '画面①', blocks: [{ type: 'sample', title: '矢印', html: '<style>.downArrow{--arrow-color:#4000ff}</style><div class="downArrow">青</div>' }] },
    ])
  })

  it('部品で組み立てたWidgetは、全体が「コードの部品」1つになり、直した中身で出る', () => {
    // 画面の入れ物（data-nc-screens）のあるコードは、ブラウザの DOMParser で読んで画面ごとに分ける
    const { window } = parseHTML('<!doctype html><html><body></body></html>')
    ;(globalThis as unknown as Record<string, unknown>)['DOMParser'] = window.DOMParser
    const data = widget([SHAPE])
    const code = editableCodeOf(data, UID)
    const edited = { html: code.html.replace('理由は？', '理由はこれ！'), css: `${code.css}\n.${UID} .nc-b-1{font-size:30px}` }
    const next = dataWithEditedCode(data, UID, edited, '組み立てたWidget')
    expect(next['padding']).toBe(0)
    expect(next['background']).toBe('none')
    const blocks = ((next['screens'] as ItemData[])[0]?.['blocks'] ?? []) as ItemData[]
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.['type']).toBe('sample')
    // 新しい名前（uid）で書き出しても、直した文字と直したCSSが入っている
    const out = BUILDER_TEMPLATE.render(next, 'nc-new00001')
    expect(out).toContain('理由はこれ！')
    expect(out).toContain('font-size:30px')
  })

  it('CSSが空なら <style> を付けない', () => {
    const data = widget([{ type: 'sample', title: 'x', html: '<p>x</p>' }])
    const next = dataWithEditedCode(data, UID, { html: '<p>y</p>', css: '  ' }, 'x')
    const blocks = ((next['screens'] as ItemData[])[0]?.['blocks'] ?? []) as ItemData[]
    expect(blocks[0]?.['html']).toBe('<p>y</p>')
  })
})

describe('コード欄（直して「このコードで直す」）', () => {
  it('HTML・CSSの欄を直せる。ボタンを押すと、今の2つの欄の中身を渡す', async () => {
    const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>')
    const g = globalThis as unknown as Record<string, unknown>
    g['document'] = window.document
    g['Event'] = window.Event
    const { buildCodePanels } = await import('../src/app/panels/widget-code-panel.ts')
    const applied: Array<[string, string]> = []
    const panel = buildCodePanels(
      { name: 'w', html: '<p>a</p>', css: '.a{}' } as never,
      { apply: { note: '説明', label: 'このコードで直す', onApply: (html, css) => applied.push([html, css]) } },
    )
    const html = panel.pane.querySelector<HTMLTextAreaElement>('[data-code-html]')
    const css = panel.pane.querySelector<HTMLTextAreaElement>('[data-code-css]')
    expect(html?.readOnly).toBe(false)
    expect(css?.readOnly).toBe(false)
    if (html === null || css === null) throw new Error('コード欄がありません')
    html.value = '<p>b</p>'
    css.value = '.b{}'
    const button = [...panel.pane.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'このコードで直す')
    button?.click()
    expect(applied).toEqual([['<p>b</p>', '.b{}']])
  })
})

describe('Widget編集への組み込み', () => {
  const studio = readFileSync('src/app/panels/widget-studio.ts', 'utf8')

  it('「見るだけ」をやめ、「このコードで直す」でコードを入れる', () => {
    expect(studio).not.toContain('（見るだけ）')
    expect(studio).toContain("label: 'このコードで直す'")
    expect(studio).toContain('current.applyCode(')
    expect(studio).toContain('current.editableCode()')
  })

  it('戻す・やり直すのあと、開いているコード欄を今の中身に読み直す（古いコードを直して入れないように）', () => {
    expect(studio).toMatch(/onRestore: \(\) => \{\s*if \(codePanel\.isCodeVisible\(\)\) showCode\(\)/)
    const builder = readFileSync('src/app/panels/widget-studio-builder.ts', 'utf8')
    expect(builder).toMatch(/paint\(\)\s*deps\.onRestore\?\.\(\)/)
  })

  it('部品で組み立てたWidgetは、入れる前に「部品の入力欄では直せなくなる」と確かめる', () => {
    expect(studio).toMatch(/mode === 'parts'[\s\S]{0,200}confirmCard\(/)
    expect(studio).toContain('部品ごとの入力欄では直せなくなります')
  })
})
