/**
 * 「部品を積んで作る」の画面の足し方（2026-09-22・本人の依頼。ノーコードでWidgetを作る④）。
 *
 * 画面を足すと「画面③」のように空いている番号の名前が付く（本人指定「画面①・画面②（名前は変えられる）」）。
 * 画面のidは s1, s2… で、消したり並べ替えたりしても、ほかの画面と重ならない。
 * どの部品からも移ってこない画面は、見ている人がたどり着けないので、画面に知らせを出す。
 */
import { describe, expect, it } from 'vitest'
import { editorScreenCss, incomingCount, nextScreenId, nextScreenName } from '../src/app/panels/nocode/screens-state.ts'
import type { TemplateData } from '../src/app/panels/nocode/templates/types.ts'

describe('画面のidと名前', () => {
  it('idは今ある中でいちばん大きい番号の次（消した番号は使い回さない）', () => {
    expect(nextScreenId(['s1', 's2'])).toBe('s3')
    expect(nextScreenId(['s1', 's5'])).toBe('s6')
    expect(nextScreenId([])).toBe('s1')
  })

  it('名前は空いているいちばん小さい丸数字（名前を変えた画面は数えない）', () => {
    expect(nextScreenName(['画面①', '画面②'])).toBe('画面③')
    expect(nextScreenName(['画面①', '質問2', '画面③'])).toBe('画面②')
    expect(nextScreenName(Array.from({ length: 20 }, (_, i) => `画面${'①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'[i]}`))).toBe('画面21')
  })
})

describe('その画面へ移ってくる部品の数', () => {
  const data: TemplateData = {
    screens: [
      { id: 's1', name: '画面①', blocks: [{ type: 'button', action: 'screen', target: 's2' }, { type: 'image', action: 'screen', target: 's2' }] },
      { id: 's2', name: '画面②', blocks: [{ type: 'button', action: 'link', target: 's3' }] },
      { id: 's3', name: '画面③', blocks: [] },
    ],
  }

  it('「画面へ移る」でその画面を選んでいる部品だけ数える', () => {
    expect(incomingCount(data, 's2')).toBe(2)
    expect(incomingCount(data, 's3')).toBe(0)
  })
})

describe('Widget編集で画面を切り替える（入れたあとも、移る先の画面を直せる）', () => {
  it('選んだ画面だけ見せるCSS（Widget編集の見たまま画面の中だけ。Widgetの中身には書かない）', () => {
    const css = editorScreenCss('nc-abcd1234', 's2')
    expect(css).toContain('[data-widget-preview] .nc-abcd1234.nc-abcd1234>[data-nc-screen]{display:none !important}')
    expect(css).toContain('[data-widget-preview] .nc-abcd1234.nc-abcd1234>[data-nc-screen="s2"]{display:block !important}')
  })

  it('形の違う名前・画面のidなら何も出さない（CSSに変な文字を入れない）', () => {
    expect(editorScreenCss('nc-abcd1234"]{x}', 's2')).toBe('')
    expect(editorScreenCss('nc-abcd1234', 's2"]{}')).toBe('')
  })
})
