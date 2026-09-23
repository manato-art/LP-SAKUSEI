/**
 * 部品で作ったWidgetの設定データをHTMLに持たせる・取り出す（2026-09-23・本人の決定 D2）。
 * LPに入れたあとも「部品」として開き直せるための土台。
 */
import { describe, expect, it } from 'vitest'
import {
  blockNumberOf,
  blockPathAt,
  blockSnippet,
  embedBuilderData,
  extractBuilderData,
  splitStyles,
  stripBuilderData,
  unescapeAttr,
  withSampleAssets,
} from '../src/app/panels/nocode/builder-data.ts'
import { BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import type { TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const NOW = new Date(Date.UTC(2026, 8, 23, 3, 0))
const UID = 'nc-test0001'

const data: TemplateData = {
  ...BUILDER_TEMPLATE.defaults(NOW),
  screens: [
    { id: 's1', name: '画面①', blocks: [{ type: 'heading', text: 'A "quoted" & <b>', size: 'm', align: 'left', color: '#1F2A37' }] },
    { id: 's2', name: '画面②', blocks: [{ type: 'text', text: 'x', size: 'm', align: 'left' }, { type: 'spacer', size: 's' }] },
  ],
}

describe('設定データを持たせる・取り出す', () => {
  it('書き出したHTMLの外側に属性で入り、同じ中身が戻る', () => {
    const html = embedBuilderData(BUILDER_TEMPLATE.render(data, UID), data)
    expect(html).toMatch(/<div class="nc nc-builder nc-test0001" data-nocode="builder" data-nc-data="/)
    const back = extractBuilderData(html)
    expect(back).not.toBeNull()
    expect(back?.uid).toBe(UID)
    expect(back?.data).toEqual(data)
  })

  it('属性の中に生の < > " が入らない（HTMLが壊れない）', () => {
    const html = embedBuilderData(BUILDER_TEMPLATE.render(data, UID), data)
    const attr = / data-nc-data="([^"]*)"/.exec(html)?.[1] ?? ''
    expect(attr).not.toMatch(/[<>"]/)
    expect(attr).toContain('&quot;')
  })

  it('2回持たせても属性は1つ（前のものを置き換える）', () => {
    const once = embedBuilderData(BUILDER_TEMPLATE.render(data, UID), data)
    const twice = embedBuilderData(once, { ...data, background: '#000000' })
    expect(twice.match(/data-nc-data=/g)?.length).toBe(1)
    expect(extractBuilderData(twice)?.data['background']).toBe('#000000')
  })

  it('外す', () => {
    const html = embedBuilderData(BUILDER_TEMPLATE.render(data, UID), data)
    const stripped = stripBuilderData(html)
    expect(stripped).not.toContain('data-nc-data')
    expect(stripped).toBe(BUILDER_TEMPLATE.render(data, UID))
    expect(extractBuilderData(stripped)).toBeNull()
  })

  it('部品で作っていないHTML・壊れたデータは null', () => {
    expect(extractBuilderData('<div class="x">hi</div>')).toBeNull()
    expect(extractBuilderData('<div class="nc nc-sample nc-abcdefgh" data-nocode="sample" data-nc-data="{}">')).toBeNull()
    expect(extractBuilderData('<div class="nc nc-builder nc-abcdefgh" data-nocode="builder" data-nc-data="{not json">')).toBeNull()
    expect(extractBuilderData('<div class="nc nc-builder nc-abcdefgh" data-nocode="builder" data-nc-data="{&quot;a&quot;:1}">')).toBeNull()
  })

  it('見本の中身に同じ属性があっても、外側の分だけを読む', () => {
    const inner = embedBuilderData(BUILDER_TEMPLATE.render(data, 'nc-inner001'), data)
    const outerData: TemplateData = { ...data, screens: [{ id: 's1', name: '画面①', blocks: [{ type: 'sample', title: 'x', html: inner }] }] }
    const html = embedBuilderData(BUILDER_TEMPLATE.render(outerData, UID), outerData)
    const back = extractBuilderData(html)
    expect(back?.uid).toBe(UID)
    expect(back?.data).toEqual(outerData)
  })

  it('ブラウザが書き出した属性（&amp; &quot; &nbsp; 数値）も戻せる', () => {
    expect(unescapeAttr('a&amp;b &quot;c&quot; &#39;d&#x27; e&nbsp;f &lt;g&gt;')).toBe('a&b "c" \'d\' e f <g>')
  })
})

describe('書き出しから <style> を分ける', () => {
  it('見本の部品の <style> も含めて全部取り出し、本文からは外す', () => {
    const { css, body } = splitStyles('<style>.a{}</style><div><style>.b{}</style><p>x</p></div><script>1</script>')
    expect(css).toBe('.a{}\n.b{}')
    expect(body).toBe('<div><p>x</p></div><script>1</script>')
  })
})

describe('通し番号から部品の場所', () => {
  it('画面をまたいで上から順に数える', () => {
    expect(blockPathAt(data, 1)).toEqual(['screens', 0, 'blocks', 0])
    expect(blockPathAt(data, 2)).toEqual(['screens', 1, 'blocks', 0])
    expect(blockPathAt(data, 3)).toEqual(['screens', 1, 'blocks', 1])
    expect(blockPathAt(data, 4)).toBeNull()
    expect(blockPathAt(data, 0)).toBeNull()
  })

  it('クラスから通し番号', () => {
    expect(blockNumberOf('nc-b nc-b-heading nc-b-heading--m nc-b--left nc-b-12')).toBe(12)
    expect(blockNumberOf('nc-b nc-b-sample')).toBeNull()
    expect(blockNumberOf('nc-b-button__a')).toBeNull()
  })
})

describe('見本の部品の資産を付け直す', () => {
  const original = '<style>.s{}</style><div class="nc nc-sample nc-abcdefgh"><p>元</p></div><script>go()</script>'

  it('先頭の <style> と末尾の <script> を、直した本文の前後に戻す', () => {
    expect(withSampleAssets(original, '<div class="nc nc-sample nc-abcdefgh"><p>直した</p></div>')).toBe(
      '<style>.s{}</style><div class="nc nc-sample nc-abcdefgh"><p>直した</p></div><script>go()</script>',
    )
  })

  it('本文に資産が残っていても二重にならない', () => {
    expect(withSampleAssets(original, '<style>.s{}</style><div class="nc nc-sample nc-abcdefgh"><p>直した</p></div><script>go()</script>')).toBe(
      '<style>.s{}</style><div class="nc nc-sample nc-abcdefgh"><p>直した</p></div><script>go()</script>',
    )
  })

  it('資産の無い見本はそのまま', () => {
    expect(withSampleAssets('<div>a</div>', '<div>b</div>')).toBe('<div>b</div>')
  })
})

describe('部品の呼び名に添える文字', () => {
  it('文字・ボタンの文字・見出し・見本の名前の順で、最初の18文字', () => {
    expect(blockSnippet({ type: 'heading', text: '  はじめての\n方へ  ' })).toBe('はじめての 方へ')
    expect(blockSnippet({ type: 'button', label: '申し込む' })).toBe('申し込む')
    expect(blockSnippet({ type: 'imageText', heading: '見出し', text: '本文' })).toBe('本文')
    expect(blockSnippet({ type: 'sample', title: 'よくある質問' })).toBe('よくある質問')
    expect(blockSnippet({ type: 'heading', text: '一二三四五六七八九十一二三四五六七八九十' })).toBe('一二三四五六七八九十一二三四五六七八')
    expect(blockSnippet({ type: 'spacer' })).toBe('')
  })
})
