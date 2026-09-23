/**
 * 見たまま画面で打ち直した文字を、部品の設定データへ戻す（2026-09-23・Widget編集に統合）。
 * DOM の代わりに linkedom（tests/nocode-sample-split.test.ts と同じ）で要素を作って確かめる。
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { blockElementAt, isTextEditableBlock, outermostBlock, plainTextOf, readBlockFromCanvas, syncCanvasBlock } from '../src/app/panels/nocode/canvas-sync.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

function dom(html: string): { root: HTMLElement; win: Window } {
  const { document, window } = parseHTML(`<!doctype html><html><body><div id="root">${html}</div></body></html>`)
  const root = document.getElementById('root') as unknown as HTMLElement
  // canvas-sync は Node.TEXT_NODE などの定数と instanceof を使う（ブラウザと同じ名前で用意する）
  const g = globalThis as unknown as Record<string, unknown>
  g['Node'] = window.Node
  g['HTMLElement'] = window.HTMLElement
  return { root, win: window as unknown as Window }
}

describe('要素の中の文字', () => {
  it('<br> と塊の切れ目は改行、字下げの改行は空白にそろえる', () => {
    const { root } = dom('<p>一行目<br>二行目\n  つづき</p>')
    expect(plainTextOf(root.firstElementChild as Element)).toBe('一行目\n二行目 つづき')
  })

  it('打ち直しで増えた <div> も行として読む。script は読まない', () => {
    const { root } = dom('<div>a<div>b</div><div>c</div><script>x()</script></div>')
    expect(plainTextOf(root.firstElementChild as Element)).toBe('a\nb\nc')
  })
})

describe('部品の要素から文字を読み戻す', () => {
  it('見出し・文章・ボタン・図形・箇条書き・画像と文章', () => {
    const { root } = dom(
      '<h2 class="nc-b nc-b-heading nc-b-1">見出し<br>2行目</h2>' +
        '<p class="nc-b nc-b-text nc-b-2">本文<br>次の行</p>' +
        '<div class="nc-b nc-b-button nc-b-3"><a class="nc-b-button__a"><span class="nc-b-button__label">申し込む</span><svg></svg></a></div>' +
        '<div class="nc-b nc-b-shape nc-b-4"><span class="nc-b-shape__text">はい</span></div>' +
        '<ul class="nc-b nc-b-list nc-b-5"><li><span class="nc-b-list__mark">✓</span><span class="nc-b-list__text">送料無料</span></li>' +
        '<li><span class="nc-b-list__mark">✓</span><span class="nc-b-list__text">返品可</span></li></ul>' +
        '<div class="nc-b nc-b-imageText nc-b-6"><div class="nc-b-imageText__img"></div><div class="nc-b-imageText__body">' +
        '<h3 class="nc-b-imageText__heading">見出し</h3><p class="nc-b-imageText__text">説明<br>2行</p></div></div>',
    )
    const el = (n: number): HTMLElement => root.children[n - 1] as HTMLElement
    expect(readBlockFromCanvas(el(1), { type: 'heading', text: 'x' })).toEqual({ type: 'heading', text: '見出し 2行目' })
    expect(readBlockFromCanvas(el(2), { type: 'text', text: 'x' })).toEqual({ type: 'text', text: '本文\n次の行' })
    expect(readBlockFromCanvas(el(3), { type: 'button', label: 'x', color: '#E5573F' })).toEqual({ type: 'button', label: '申し込む', color: '#E5573F' })
    expect(readBlockFromCanvas(el(4), { type: 'shape', text: 'x' })).toEqual({ type: 'shape', text: 'はい' })
    expect(readBlockFromCanvas(el(5), { type: 'list', text: 'x' })).toEqual({ type: 'list', text: '送料無料\n返品可' })
    expect(readBlockFromCanvas(el(6), { type: 'imageText', heading: 'x', text: 'y' })).toEqual({ type: 'imageText', heading: '見出し', text: '説明\n2行' })
  })

  it('見本の部品は中身のHTMLごと（元の <style>・<script> を付け直す）', () => {
    const { root } = dom('<div class="nc-b nc-b-sample nc-b-1"><div class="nc nc-sample nc-abcdefgh"><p>直した</p></div></div>')
    const block: ItemData = { type: 'sample', title: 't', html: '<style>.s{}</style><div class="nc nc-sample nc-abcdefgh"><p>元</p></div><script>go()</script>' }
    expect(readBlockFromCanvas(root.firstElementChild as HTMLElement, block)).toEqual({
      ...block,
      html: '<style>.s{}</style><div class="nc nc-sample nc-abcdefgh"><p>直した</p></div><script>go()</script>',
    })
  })

  it('画像・余白・型の部品は読み戻さない（右の入力欄で直す）', () => {
    const { root } = dom('<figure class="nc-b nc-b-image nc-b-1"></figure>')
    expect(readBlockFromCanvas(root.firstElementChild as HTMLElement, { type: 'image', image: '' })).toBeNull()
    expect(readBlockFromCanvas(root.firstElementChild as HTMLElement, { type: 'tpl-faq' })).toBeNull()
    expect(isTextEditableBlock({ type: 'image' })).toBe(false)
    expect(isTextEditableBlock({ type: 'heading' })).toBe(true)
    expect(isTextEditableBlock({ type: 'sample' })).toBe(true)
  })
})

describe('打ち直した要素から部品の場所を見つけて戻す', () => {
  const data: TemplateData = {
    screens: [
      { id: 's1', name: '画面①', blocks: [{ type: 'heading', text: 'A', size: 'm', align: 'left', color: '#1F2A37' }] },
      { id: 's2', name: '画面②', blocks: [{ type: 'spacer', size: 'm' }, { type: 'text', text: 'B', size: 'm', align: 'left' }] },
    ],
  }
  const html =
    '<div class="nc nc-builder nc-abcdefgh"><div class="nc-screen"><h2 class="nc-b nc-b-heading nc-b-1">A直した</h2></div>' +
    '<div class="nc-screen" hidden><div class="nc-b nc-b-spacer nc-b-2"></div><p class="nc-b nc-b-text nc-b-3">B<br>直した</p></div></div>'

  it('通し番号（画面をまたぐ）で場所を見つけ、その部品だけを新しくする', () => {
    const { root } = dom(html)
    const p = root.querySelector('.nc-b-3') as HTMLElement
    const result = syncCanvasBlock(data, p.firstChild, root)
    expect(result?.path).toEqual(['screens', 1, 'blocks', 1])
    expect(result?.block).toEqual({ type: 'text', text: 'B\n直した', size: 'm', align: 'left' })
    expect((result?.data['screens'] as readonly ItemData[])[0]).toBe((data['screens'] as readonly ItemData[])[0])
  })

  it('部品の外・読み戻せない部品では null', () => {
    const { root } = dom(html)
    expect(syncCanvasBlock(data, root, root)).toBeNull()
    expect(syncCanvasBlock(data, root.querySelector('.nc-b-2'), root)).toBeNull()
  })

  it('見本の中に別の部品があっても、いちばん外の部品を取る', () => {
    const { root } = dom(
      '<div class="nc-b nc-b-sample nc-b-1"><div class="nc nc-builder nc-inner001"><h2 class="nc-b nc-b-heading nc-b-1">内</h2></div></div>',
    )
    const inner = root.querySelector('h2') as HTMLElement
    expect(outermostBlock(inner, root)).toBe(root.firstElementChild)
  })

  it('場所（画面・何番目）から見たまま画面の要素', () => {
    const { root } = dom(html)
    expect(blockElementAt(data, root, 1, 1)?.className).toBe('nc-b nc-b-text nc-b-3')
    expect(blockElementAt(data, root, 0, 0)?.className).toBe('nc-b nc-b-heading nc-b-1')
    expect(blockElementAt(data, root, 2, 0)).toBeNull()
  })
})
