/**
 * 見本の設問①②③を「部品を積んで作る」の画面①②③に分ける（2026-09-23・本人の決定）。
 *
 * 本人の依頼「見本からでも型からでも、部品を積んで作るときと同じ『画面と部品』が欲しい」。
 * 決定（AskUserQuestion）: 「画面①②③としてタブに並べる」。
 * 画面①②…に作り変えてある見本（data-nc-screens）は、設問1つ＝画面1つの部品に分ける。
 * 分けられない見本（ふつうの見本・動きで設問を出し分ける見本）は、そのまま1つの部品にする。
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { applyScreenIds, sampleScreens, splitSampleScreens } from '../src/app/panels/nocode/sample-to-screens.ts'

/** linkedom で「見本を入れた箱」を作る（ブラウザの DOMParser と同じ役目） */
function parse(html: string): Element {
  const { document } = parseHTML(`<!doctype html><html><body><div id="r">${html}</div></body></html>`)
  const root = document.getElementById('r')
  if (root === null) throw new Error('parse failed')
  return root as unknown as Element
}

const split = (html: string): readonly string[] => splitSampleScreens(html, parse)

/** 画面①②…に作り変えた見本（tools/widget-library-fix と同じ形） */
const converted =
  '<style>.q{color:red}</style>' +
  '<div class="MuiBox-root">' +
  '<div class="nc nc-sample nc-aaaaaaaa" data-nocode="sample" data-nc-screens="">' +
  '<div class="nc-screen" data-nc-screen="s1" data-nc-name="設問①"><p>Q1</p><a href="ooooo" data-nc-go="s2">はい</a></div>' +
  '<div class="nc-screen" data-nc-screen="s2" data-nc-name="設問②" hidden=""><p>Q2</p><a href="ooooo" data-nc-go="s3">はい</a>' +
  '<a href="ooooo" data-nc-go="s1">もどる</a></div>' +
  '<div class="nc-screen" data-nc-screen="s3" data-nc-name="設問③" hidden=""><p>Q3</p><a href="https://example.com/">申し込む</a></div>' +
  '</div><script>var x=document.querySelectorAll("[data-nc-screens]")</script>' +
  '</div>'

describe('見本を画面①②③に分ける', () => {
  it('設問1つが部品1つになる（入れ物と画面の枠・切り替えのスクリプトは外す。見本のCSSはそのまま）', () => {
    const parts = split(converted)
    expect(parts).toHaveLength(3)
    expect(parts[0]).toContain('<p>Q1</p>')
    expect(parts[0]).not.toContain('Q2')
    expect(parts[0]).not.toContain('data-nc-screens')
    expect(parts[0]).not.toContain('nc-screen')
    expect(parts[0]).not.toContain('querySelectorAll')
    expect(parts[0]).toContain('<style>.q{color:red}</style>')
    // 2つ目からは隠れていた印を外す（その画面では見える）
    expect(parts[1]).toContain('<p>Q2</p>')
    expect(parts[1]).not.toContain('hidden')
  })

  it('押したら移る先は、分けたあとの何番目の画面かで持つ（本当のidはあとで入れる）', () => {
    const parts = split(converted)
    expect(parts[0]).toContain('data-nc-go="@1"')
    expect(parts[1]).toContain('data-nc-go="@2"')
    expect(parts[1]).toContain('data-nc-go="@0"')
    expect(applyScreenIds(parts[1] ?? '', ['s4', 's5', 's6'])).toContain('data-nc-go="s6"')
    expect(applyScreenIds(parts[1] ?? '', ['s4', 's5', 's6'])).toContain('data-nc-go="s4"')
  })

  it('無い画面を指している移る先は外す（分けたあと行き先が無いボタンを残さない）', () => {
    const parts = split(converted.replace('data-nc-go="s3"', 'data-nc-go="s9"'))
    expect(parts[1]).not.toContain('s9')
    // 同じ画面の「もどる」は残る（@0＝1つ目の画面）
    expect(parts[1]).toContain('data-nc-go="@0"')
  })

  it('画面が無い見本・画面が1つだけの見本は、そのまま1つの部品', () => {
    expect(split('<div class="box"><p>ふつうの見本</p></div>')).toEqual(['<div class="box"><p>ふつうの見本</p></div>'])
    const one = converted.replace(/<div class="nc-screen" data-nc-screen="s[23]"[\s\S]*?<\/div><\/div>/, '</div>')
    expect(split(one)).toHaveLength(1)
  })

  it('足りない画面の番号は、そのボタンの移る先を空にする（変な文字をHTMLに入れない）', () => {
    expect(applyScreenIds('<a data-nc-go="@5">x</a>', ['s1'])).toBe('<a >x</a>')
  })
})

describe('見本カードの「画面を作って使う」（Widget編集の部品モードで開く中身）', () => {
  it('設問①②③は画面①②③に1つずつ入り、移る先は本当の画面のidになる', () => {
    const screens = sampleScreens({ title: 'アンケート', html: converted }, parse)
    expect(screens.map((s) => [s.id, s.name])).toEqual([
      ['s1', '画面①'],
      ['s2', '画面②'],
      ['s3', '画面③'],
    ])
    expect(screens[0]?.blocks).toHaveLength(1)
    expect(screens[0]?.blocks[0]?.type).toBe('sample')
    expect(screens[0]?.blocks[0]?.title).toBe('アンケート')
    expect(screens[0]?.blocks[0]?.html).toContain('data-nc-go="s2"')
    expect(screens[1]?.blocks[0]?.html).toContain('data-nc-go="s3"')
    expect(screens[1]?.blocks[0]?.html).toContain('data-nc-go="s1"')
  })

  it('分けられない見本は画面①に1つ（中身はそのまま）', () => {
    const html = '<style>.a{}</style><div class="nc nc-sample nc-bbbbbbbb" data-nocode="sample"><p>x</p></div>'
    const screens = sampleScreens({ title: '見出し', html }, parse)
    expect(screens).toHaveLength(1)
    expect(screens[0]?.id).toBe('s1')
    expect(screens[0]?.blocks[0]?.html).toBe(html)
  })
})
