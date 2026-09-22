/**
 * Widget の外枠に編集画面が付ける属性を、画面の外に出すHTMLから外すことの機械証明（2026-09-22）。
 *
 * 実測（2026-09-22）: 公開LPの Widget の外枠が、編集画面で付けた属性のまま出ていた。
 *   <section class="sb-widget-block" data-widget-block="true" contenteditable="false" style="margin: 8px 0px;" data-widget-name="MuiBox-root">
 * data-widget-name はホバー時の名前（widget-editor.ts の labelAllWidgets）、contenteditable は
 * Quill の中で Widget を「文字を打てない1かたまり」にするもの（media-blots.ts の SbWidgetBlot）で、見る人には意味が無い。
 * 保存データは書き換えず、配信・プレビュー・ダウンロードのときに外す（本人指定）。
 */
import { describe, expect, it } from 'vitest'
import { stripEditorWidgetAttributes } from '../src/shared/widget-editor-attrs.ts'
import { neutralizeWidgetStyles } from '../src/shared/sb-preview-css.ts'

/** 保存されている外枠（2026-09-22 実測の形） */
const SAVED_WRAPPER =
  '<section class="sb-widget-block" data-widget-block="true" contenteditable="false" style="margin: 8px 0px;" data-widget-name="MuiBox-root">'
/** 画面の外に出す外枠（配信のCSSが使う class と、data-widget-block・余白は残す） */
const PAGE_WRAPPER = '<section class="sb-widget-block" data-widget-block="true" style="margin: 8px 0px;">'

describe('Widget の外枠から、編集画面だけの属性を外す', () => {
  it('保存されている形から data-widget-name と contenteditable を外し、ほかは1文字も変えない', () => {
    const html = `<p>前</p>${SAVED_WRAPPER}<div class="a">中身</div></section><p>後</p>`
    expect(stripEditorWidgetAttributes(html)).toBe(`<p>前</p>${PAGE_WRAPPER}<div class="a">中身</div></section><p>後</p>`)
  })

  it('選択中の目印（data-widget-selected）も外す', () => {
    const html = '<section class="sb-widget-block" data-widget-selected="true" data-widget-block="true">x</section>'
    expect(stripEditorWidgetAttributes(html)).toBe('<section class="sb-widget-block" data-widget-block="true">x</section>')
  })

  it('Widget の中身には触らない（中の要素に同じ名前の属性があっても、スクリプトやCSSの文字も残す）', () => {
    const inner =
      '<div contenteditable="true" data-widget-name="自作のメモ欄">メモ</div>' +
      '<style>.a[data-widget-selected]{color:red}</style>' +
      '<script>var s = document.querySelector("[contenteditable]");</script>'
    const html = `${SAVED_WRAPPER}${inner}</section>`
    expect(stripEditorWidgetAttributes(html)).toBe(`${PAGE_WRAPPER}${inner}</section>`)
  })

  it('Widget ではない section はそのまま（class が似ているだけのものも）', () => {
    const html =
      '<section class="hero" contenteditable="false" data-widget-name="x">a</section>' +
      '<section class="sb-widget-block-like" data-widget-name="y">b</section>' +
      '<sections data-widget-name="z">c</sections>'
    expect(stripEditorWidgetAttributes(html)).toBe(html)
  })

  it('名前の値に > ・改行・引用符が入っていても、タグの終わりを取り違えない', () => {
    // 名前は Widget の先頭の文字（CSSの文字を含む）から作られるので、値に何でも入りうる
    const wrapper =
      '<section class="sb-widget-block" data-widget-block="true" contenteditable="false" style="margin: 8px 0px;" ' +
      'data-widget-name=".a > b{content:&quot;x&quot;}\n.c{}">'
    const html = `${wrapper}<p>中身</p></section>`
    expect(stripEditorWidgetAttributes(html)).toBe(`${PAGE_WRAPPER}<p>中身</p></section>`)
  })

  it('大文字・シングルクォート・引用符なし・値なしの書き方でも外す', () => {
    const html =
      `<SECTION CLASS='x sb-widget-block' CONTENTEDITABLE=false Data-Widget-Name='a"b' data-widget-selected>中身</SECTION>`
    expect(stripEditorWidgetAttributes(html)).toBe(`<SECTION CLASS='x sb-widget-block'>中身</SECTION>`)
  })

  it('属性の間に空白が無くても、残る属性どうし・タグ名とくっつけない', () => {
    expect(stripEditorWidgetAttributes('<section contenteditable="false"class="sb-widget-block">x</section>')).toBe(
      '<section class="sb-widget-block">x</section>',
    )
    expect(
      stripEditorWidgetAttributes('<section class="sb-widget-block"data-widget-name="a"style="margin:0">x</section>'),
    ).toBe('<section class="sb-widget-block" style="margin:0">x</section>')
  })

  it('引用符なしの値のあとで外しても、タグの終わりの / を値にくっつけない', () => {
    // ブラウザで確かめて見つけた形（2026-09-22）: 空白ごと外すと class の値が「sb-widget-block/」になっていた
    expect(stripEditorWidgetAttributes('<section class=sb-widget-block contenteditable="false"/>x</section>')).toBe(
      '<section class=sb-widget-block>x</section>',
    )
    expect(
      stripEditorWidgetAttributes('<section class="sb-widget-block" data-widget-block=true data-widget-name="a"/>x</section>'),
    ).toBe('<section class="sb-widget-block" data-widget-block=true>x</section>')
  })

  it('属性の値の中に書かれた <section はタグとして扱わない', () => {
    const html = `<section title="<section class='sb-widget-block' data-widget-name='x'>" class="hero">a</section>`
    expect(stripEditorWidgetAttributes(html)).toBe(html)
  })

  it('Widget がいくつあっても、入れ子になっていても、全部の外枠から外す', () => {
    const html = `${SAVED_WRAPPER}<p>1</p></section><p>本文</p>${SAVED_WRAPPER}${SAVED_WRAPPER}<p>2</p></section></section>`
    expect(stripEditorWidgetAttributes(html)).toBe(
      `${PAGE_WRAPPER}<p>1</p></section><p>本文</p>${PAGE_WRAPPER}${PAGE_WRAPPER}<p>2</p></section></section>`,
    )
  })

  it('何度通しても同じ。外すものが無ければ元のまま', () => {
    const once = stripEditorWidgetAttributes(`${SAVED_WRAPPER}x</section>`)
    expect(stripEditorWidgetAttributes(once)).toBe(once)
    expect(stripEditorWidgetAttributes('<p>本文だけ</p>')).toBe('<p>本文だけ</p>')
    expect(stripEditorWidgetAttributes('')).toBe('')
  })

  it('閉じていない開始タグ（途中で切れたHTML）は触らない', () => {
    const html = '<p>a</p><section class="sb-widget-block" data-widget-name="途中'
    expect(stripEditorWidgetAttributes(html)).toBe(html)
  })
})

describe('配信・プレビュー・ダウンロードが共通で通す整え（neutralizeWidgetStyles）でも外す', () => {
  it('Widget のCSSの整えと一緒に、外枠の編集画面だけの属性も外す', () => {
    const out = neutralizeWidgetStyles(`${SAVED_WRAPPER}<style>.a{color:red}</style><div class="a">x</div></section>`)
    expect(out.hasWidget).toBe(true)
    expect(out.html).toBe(`${PAGE_WRAPPER}<style>.a{color:red}</style><div class="a">x</div></section>`)
  })
})
