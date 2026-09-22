/**
 * 「部品を積んで作る」の画面の足し方（2026-09-22・本人の依頼。ノーコードでWidgetを作る④）。
 *
 * 画面を足すと「画面③」のように空いている番号の名前が付く（本人指定「画面①・画面②（名前は変えられる）」）。
 * 画面のidは s1, s2… で、消したり並べ替えたりしても、ほかの画面と重ならない。
 * どの部品からも移ってこない画面は、見ている人がたどり着けないので、画面に知らせを出す。
 */
import { describe, expect, it } from 'vitest'
import {
  addSampleParts,
  addScreenFor,
  cssPathFrom,
  editorScreenCss,
  editorStepCss,
  goChoices,
  incomingCount,
  moveBlockToNewScreen,
  moveBlockToScreen,
  nextScreenId,
  nextScreenName,
  pressOf,
  withPress,
} from '../src/app/panels/nocode/screens-state.ts'
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

  it('見本の部品の中のボタン・画像が移ってくる画面も数える', () => {
    const withSample: TemplateData = {
      screens: [
        { id: 's1', name: '画面①', blocks: [{ type: 'sample', title: 'x', html: '<a href="ooooo" data-nc-go="s3">はい</a><img src="a.png" data-nc-go="s3">' }] },
        { id: 's3', name: '画面③', blocks: [] },
      ],
    }
    expect(incomingCount(withSample, 's3')).toBe(2)
  })
})

/**
 * 本人の依頼（2026-09-22）「画像や動画・ボタンなどの要素を、画面2・3・4・5…として簡単に設定したい」。
 * 決定: 両方（押したら画面②③…へ移る／その部品を画面②③…に置く）・部品の一覧で画面のボタンを押すだけ。
 */
describe('部品を別の画面へ移す（出す画面）', () => {
  const data = (): TemplateData => ({
    screens: [
      { id: 's1', name: '画面①', blocks: [{ type: 'heading', text: 'A' }, { type: 'image', image: 'x' }] },
      { id: 's2', name: '画面②', blocks: [{ type: 'text', text: 'B' }] },
    ],
  })

  it('選んだ画面のいちばん下へ移す（元の画面からは消える）', () => {
    const moved = moveBlockToScreen(data(), 'screens', 0, 1, 1, 30)
    expect(moved.screens).toEqual([
      { id: 's1', name: '画面①', blocks: [{ type: 'heading', text: 'A' }] },
      { id: 's2', name: '画面②', blocks: [{ type: 'text', text: 'B' }, { type: 'image', image: 'x' }] },
    ])
  })

  it('同じ画面・無い画面・部品がいっぱいの画面へは移さない（元のまま）', () => {
    const original = data()
    expect(moveBlockToScreen(original, 'screens', 0, 1, 0, 30)).toBe(original)
    expect(moveBlockToScreen(original, 'screens', 0, 1, 5, 30)).toBe(original)
    expect(moveBlockToScreen(original, 'screens', 0, 9, 1, 30)).toBe(original)
    expect(moveBlockToScreen(original, 'screens', 0, 1, 1, 1)).toBe(original)
  })
})

describe('押したとき（画面のボタンを押すだけ）', () => {
  const data: TemplateData = {
    screens: [
      { id: 's1', name: '画面①', blocks: [{ type: 'button', label: 'はい', action: 'none', target: '' }] },
      { id: 's2', name: 'はいの人', blocks: [] },
      { id: 's4', name: '', blocks: [] },
    ],
  }

  it('移る先の候補は、その部品がある画面以外の画面（名前が無ければ番号の名前）', () => {
    expect(goChoices(data, 'screens', 0)).toEqual([
      { id: 's2', label: 'はいの人' },
      { id: 's4', label: '画面③' },
    ])
    expect(goChoices(data, 'screens', 1).map((c) => c.id)).toEqual(['s1', 's4'])
  })

  it('「＋新しい画面」: 画面を足して、その部品の移る先にする', () => {
    const out = addScreenFor(data, 'screens', ['screens', 0, 'blocks', 0], 20)
    expect(out?.id).toBe('s5')
    const screens = out?.data['screens'] as readonly Record<string, unknown>[]
    expect(screens[3]).toEqual({ id: 's5', name: '画面②', blocks: [] })
    expect((screens[0]?.['blocks'] as readonly Record<string, unknown>[])[0]).toMatchObject({ action: 'screen', target: 's5' })
  })

  it('画面がいっぱいなら足さない', () => {
    expect(addScreenFor(data, 'screens', ['screens', 0, 'blocks', 0], 3)).toBeNull()
  })

  it('その部品がある画面へ移る指定になっていたら（出す画面で移した等）、その画面も「（この画面）」として候補に出す', () => {
    expect(goChoices(data, 'screens', 1, 's2')).toEqual([
      { id: 's1', label: '画面①' },
      { id: 's4', label: '画面③' },
      { id: 's2', label: 'はいの人（この画面）' },
    ])
    expect(goChoices(data, 'screens', 1, 's4').map((c) => c.id)).toEqual(['s1', 's4'])
  })

  it('押したときの今の選び（なし・リンク・画面のid）を読み、選び直した中身を作る', () => {
    expect(pressOf({ action: 'none', target: 's2' })).toBe('none')
    expect(pressOf({ action: 'link', target: '' })).toBe('link')
    expect(pressOf({ action: 'screen', target: 's2' })).toBe('s2')
    expect(pressOf({ action: 'screen', target: '' })).toBe('none')
    expect(pressOf({})).toBe('none')
    const path = ['screens', 0, 'blocks', 0] as const
    const block = (d: TemplateData): unknown => (((d['screens'] as readonly Record<string, unknown>[])[0]?.['blocks']) as readonly unknown[])[0]
    expect(block(withPress(data, path, 's4'))).toMatchObject({ action: 'screen', target: 's4' })
    expect(block(withPress(data, path, 'link'))).toMatchObject({ action: 'link' })
    expect(block(withPress(withPress(data, path, 's4'), path, 'none'))).toMatchObject({ action: 'none' })
  })
})

describe('部品を新しい画面へ移す（出す画面の「＋新しい画面」）', () => {
  const data: TemplateData = {
    screens: [{ id: 's1', name: '画面①', blocks: [{ type: 'heading', text: 'A' }, { type: 'image', image: 'x' }] }],
  }

  it('いちばん右に画面を足し、その部品を移す', () => {
    const out = moveBlockToNewScreen(data, 'screens', 0, 1, 20, 30)
    expect(out).toEqual({
      index: 1,
      data: {
        screens: [
          { id: 's1', name: '画面①', blocks: [{ type: 'heading', text: 'A' }] },
          { id: 's2', name: '画面②', blocks: [{ type: 'image', image: 'x' }] },
        ],
      },
    })
  })

  it('画面がいっぱい・部品が無いときは何もしない', () => {
    expect(moveBlockToNewScreen(data, 'screens', 0, 1, 1, 30)).toBeNull()
    expect(moveBlockToNewScreen(data, 'screens', 0, 5, 20, 30)).toBeNull()
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

describe('Widget編集で見本の設問①②…を切り替える（入れたあとも隠れている設問を直せる）', () => {
  /** テスト用の小さな木 */
  function el(children: unknown[] = []): { parentElement: unknown; children: unknown[] } {
    const self = { parentElement: null as unknown, children }
    for (const child of children) (child as { parentElement: unknown }).parentElement = self
    return self
  }

  it('見たまま画面から、その箱までの道のりを「何番目の子か」で書く（Widgetの中身に目印を付けない）', () => {
    const q2 = el()
    const survey = el([el(), el(), q2])
    const root = el([el(), survey])
    expect(cssPathFrom(root as never, q2 as never)).toBe(':nth-child(2)>:nth-child(3)')
    expect(cssPathFrom(root as never, el() as never)).toBeNull()
  })

  it('選んだ設問だけ見せ、ほかの設問は隠すCSS（見たまま画面の中だけ）', () => {
    const css = editorStepCss([':nth-child(1)>:nth-child(1)', ':nth-child(1)>:nth-child(2)'], 1)
    expect(css).toContain('[data-widget-preview]>:nth-child(1)>:nth-child(1){display:none !important}')
    expect(css).toContain('[data-widget-preview]>:nth-child(1)>:nth-child(2){display:block !important}')
  })
})

/**
 * 本人の決定（2026-09-23）「見本の設問①②③は、画面①②③としてタブに並べる」。
 * 分かれた見本は、いまの画面と、右に足した画面へ1つずつ入れる（tests/nocode-sample-split.test.ts で分ける）。
 */
describe('見本を部品として入れる', () => {
  const data: TemplateData = {
    screens: [
      { id: 's1', name: '画面①', blocks: [{ type: 'heading', text: 'A' }] },
      { id: 's2', name: '画面②', blocks: [] },
    ],
  }
  const limits = { max: 20, blockMax: 30 }

  it('分かれていない見本は、いまの画面のいちばん下に入る', () => {
    const out = addSampleParts(data, 'screens', 1, 'ある見本', ['<p>x</p>'], limits)
    const screens = out?.['screens'] as readonly Record<string, unknown>[]
    expect(screens).toHaveLength(2)
    expect(screens[1]?.['blocks']).toEqual([{ type: 'sample', title: 'ある見本', html: '<p>x</p>' }])
  })

  it('分かれた見本は、いまの画面と、右に足した画面へ1つずつ。移る先はその画面のidになる', () => {
    const out = addSampleParts(data, 'screens', 0, 'アンケート', ['<a data-nc-go="@1">はい</a>', '<a data-nc-go="@0">もどる</a>'], limits)
    const screens = out?.['screens'] as readonly Record<string, unknown>[]
    expect(screens).toHaveLength(3)
    expect(screens[2]).toMatchObject({ id: 's3', name: '画面③' })
    expect((screens[0]?.['blocks'] as readonly Record<string, unknown>[])[1]).toEqual({
      type: 'sample',
      title: 'アンケート',
      html: '<a data-nc-go="s3">はい</a>',
    })
    expect((screens[2]?.['blocks'] as readonly Record<string, unknown>[])[0]).toMatchObject({ html: '<a data-nc-go="s1">もどる</a>' })
  })

  it('画面が足りないときは何もしない（呼ぶ側が、分けずに1つの部品として入れる）', () => {
    expect(addSampleParts(data, 'screens', 0, 'アンケート', ['<p>1</p>', '<p>2</p>'], { max: 2, blockMax: 30 })).toBeNull()
    expect(addSampleParts(data, 'screens', 5, 'アンケート', ['<p>1</p>'], limits)).toBeNull()
  })
})
