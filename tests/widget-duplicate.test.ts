/**
 * 一度作ったWidgetを複製する（2026-10-24 本人「一度作ったウィジェットを複製する機能が欲しい」・本人の選択「両方」）。
 * - LPに置いたWidget … 左の「設置済みWidget」の「複製」で、そのすぐ下にもう1つ置く
 * - 「作成したWidget」… ライブラリの「複製」でコピーを作る（全員の一覧に入る）
 *
 * LPに置いたWidgetの複製は、中の名前（CSSのクラス）を付け直す。同じ名前のままだと、片方の色を変えたときに
 * もう片方も変わる（2026-10-18 の「両方青くなった」と同じ仕組み）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { copyName, duplicatePlacedWidget } from '../src/app/panels/widget-duplicate.ts'

const BUILT =
  '<style>.nc-aaaa1111{padding:0}.nc-aaaa1111 .nc-b-1{color:#E5573F}</style>' +
  '<div class="nc nc-builder nc-aaaa1111" data-nocode="builder"><p class="nc-b nc-b-1">赤</p></div>'

function fakeQuill(widget: object | null): {
  quill: never
  insertEmbed: ReturnType<typeof vi.fn>
} {
  const insertEmbed = vi.fn()
  const quill = {
    scroll: { find: (node: unknown) => (node === widget ? { blot: true } : null) },
    getIndex: () => 7,
    insertEmbed,
  }
  return { quill: quill as never, insertEmbed }
}

describe('LPに置いたWidgetを、そのすぐ下に複製する', () => {
  it('すぐ下（次の位置）に入れ、中の名前を付け直す（CSSも一緒に）', () => {
    const node = { innerHTML: BUILT }
    const { quill, insertEmbed } = fakeQuill(node)
    expect(duplicatePlacedWidget(quill, node as unknown as HTMLElement, () => 'nc-bbbb2222')).toBe(true)
    const [index, format, html] = insertEmbed.mock.calls[0] ?? []
    expect(index).toBe(8)
    expect(format).toBe('sbwidget')
    expect(html).toContain('class="nc nc-builder nc-bbbb2222"')
    expect(html).toContain('.nc-bbbb2222 .nc-b-1{color:#E5573F}')
    expect(html).not.toContain('nc-aaaa1111')
  })

  it('手で書いたHTMLのWidget（中の名前が無い）は、そのまま複製する', () => {
    const node = { innerHTML: '<div class="x">手書き</div>' }
    const { quill, insertEmbed } = fakeQuill(node)
    duplicatePlacedWidget(quill, node as unknown as HTMLElement, () => 'nc-bbbb2222')
    expect(insertEmbed.mock.calls[0]?.[2]).toBe('<div class="x">手書き</div>')
  })

  it('LPの部品として見つからないものは複製しない', () => {
    const { quill, insertEmbed } = fakeQuill({ other: true })
    expect(duplicatePlacedWidget(quill, { innerHTML: BUILT } as unknown as HTMLElement)).toBe(false)
    expect(insertEmbed).not.toHaveBeenCalled()
  })
})

describe('「作成したWidget」のコピーの名前', () => {
  it('名前に「（コピー）」を付ける（長い名前は保存できる長さに収める）', () => {
    expect(copyName('申込ボタン')).toBe('申込ボタン（コピー）')
    expect(copyName('あ'.repeat(80))).toHaveLength(80)
    expect(copyName('あ'.repeat(80)).endsWith('（コピー）')).toBe(true)
  })
})

describe('画面への組み込み', () => {
  it('左の「設置済みWidget」のカードに「複製」（押しても編集は開かない）', () => {
    const nav = readFileSync('src/app/panels/widget-nav.ts', 'utf8')
    expect(nav).toMatch(/duplicatePlacedWidget\(quill, widgetNode\)/)
    expect(nav).toMatch(/event\.stopPropagation\(\)[\s\S]{0,120}duplicatePlacedWidget/)
  })

  it('ライブラリの「作成したWidget」に「複製」（元の入力・カテゴリー・説明文もそのまま）', () => {
    const library = readFileSync('src/app/panels/widget-library.ts', 'utf8')
    expect(library).toMatch(
      /saveCreatedWidget\(copyName\(w\.name\), w\.html, w\.source, \{ category: w\.category, description: w\.description \}\)/,
    )
  })
})
