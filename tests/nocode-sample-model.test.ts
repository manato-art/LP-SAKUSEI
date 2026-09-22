/**
 * 「部品を積んで作る」の見本の部品（2026-09-22・本人の依頼）。
 *
 * 本人の依頼「用意されている見本から作った時にも、部品を積んで作るみたいな視覚的にわかりやすい要素や、
 * ページの切り替わりを入れて欲しい」（決定: 見本を部品として積む・切り替わりは両方）。
 *  - 見本の中身（文字・画像・ボタン）を一覧にして、入力欄で直せるようにする
 *  - 見本にもともとある設問①②…（同じ形の箱が並び、見えているのは1つだけ）を見つける
 *  - ボタンには「押したとき→画面②へ」を付けられる（data-nc-go）
 * ここはDOMを使わない形（テストは小さな木で確かめる）。
 */
import { describe, expect, it } from 'vitest'
import { findStepGroup, goTargetsIn, nestedScreens, nodeAt, sampleSlots, type SlotNode } from '../src/app/panels/nocode/sample-model.ts'

/** テスト用の小さな木（要素） */
function el(tag: string, attrs: Record<string, string> = {}, children: SlotNode[] = []): SlotNode & { attrs: Record<string, string> } {
  const self = {
    nodeType: 1,
    nodeName: tag,
    tagName: tag,
    className: attrs['class'] ?? '',
    attrs,
    textContent: '',
    childNodes: children,
    children: children.filter((c) => c.nodeType === 1),
    parentElement: null as SlotNode | null,
    getAttribute: (name: string) => attrs[name] ?? null,
  }
  for (const child of children) (child as unknown as { parentElement: SlotNode | null }).parentElement = self as unknown as SlotNode
  self.textContent = children.map((c) => c.textContent ?? '').join('')
  return self as unknown as SlotNode & { attrs: Record<string, string> }
}

function text(value: string): SlotNode {
  return { nodeType: 3, nodeName: '#text', textContent: value, childNodes: [], parentElement: null } as unknown as SlotNode
}

/** 2問のアンケート（1問目だけ見えている） */
function survey(): { root: SlotNode; q1: SlotNode; q2: SlotNode } {
  const q1 = el('SECTION', { class: 'question' }, [
    el('P', { class: 'q' }, [text('Q1.好きな色は？')]),
    el('A', { class: 'choice', href: 'https://example.test/red' }, [text('赤')]),
    el('BUTTON', { class: 'choice' }, [el('SPAN', {}, [text('青')])]),
  ])
  const q2 = el('SECTION', { class: 'question' }, [
    el('P', { class: 'q' }, [text('Q2.好きな形は？')]),
    el('IMG', { src: 'data:image/png;base64,AAAA', alt: '丸' }),
  ])
  const root = el('DIV', {}, [
    el('STYLE', {}, [text('.q{color:red}')]),
    el('H2', {}, [text('\n  アンケート  \n')]),
    q1,
    q2,
    el('SCRIPT', {}, [text('var x = 1')]),
  ])
  return { root, q1, q2 }
}

describe('見本にもともとある設問①②…', () => {
  it('同じ形の箱が並び、見えているのが1つだけなら設問として見つける（上から順）', () => {
    const { root, q1, q2 } = survey()
    const visible = new Set([q1])
    expect(findStepGroup(root, (n) => visible.has(n) || !['SECTION'].includes((n as unknown as { tagName: string }).tagName))).toEqual([q1, q2])
  })

  it('全部見えている並び（よくある質問など）は設問ではない', () => {
    const { root } = survey()
    expect(findStepGroup(root, () => true)).toEqual([])
  })

  it('「部品を積んで作る」の画面（nc-screen）は設問として扱わない（画面は画面のタブで切り替える）', () => {
    const s1 = el('DIV', { class: 'nc-screen' }, [el('P', {}, [text('a')])])
    const s2 = el('DIV', { class: 'nc-screen' }, [el('P', {}, [text('b')])])
    const root = el('DIV', {}, [s1, s2])
    expect(findStepGroup(root, (n) => n !== s2)).toEqual([])
  })
})

describe('見本の中身の一覧', () => {
  it('文字・画像・ボタンを上から順に並べる（style・script の中は出さない。ボタンの中の文字はボタンの方で直す）', () => {
    const { root } = survey()
    const slots = sampleSlots(root, [])
    expect(slots.map((s) => [s.kind, s.kind === 'text' ? s.text : s.kind === 'image' ? s.alt : s.label])).toEqual([
      ['text', 'アンケート'],
      ['text', 'Q1.好きな色は？'],
      ['control', '赤'],
      ['control', '青'],
      ['text', 'Q2.好きな形は？'],
      ['image', '丸'],
    ])
  })

  it('ボタンはリンク先と、押したら移る先（data-nc-go）も持つ', () => {
    const { root } = survey()
    const [red, blue] = sampleSlots(root, []).filter((s) => s.kind === 'control')
    expect(red).toMatchObject({ tag: 'A', href: 'https://example.test/red', go: null })
    expect(blue).toMatchObject({ tag: 'BUTTON', href: null })
  })

  it('どの設問の中にあるかを持つ（設問の外は null）', () => {
    const { root, q1, q2 } = survey()
    const slots = sampleSlots(root, [q1, q2])
    expect(slots.map((s) => s.step)).toEqual([null, 0, 0, 0, 1, 1])
  })

  it('一覧の番号から、同じ場所をもう一度見つけられる（直したあとも番号は変わらない）', () => {
    const { root } = survey()
    const slot = sampleSlots(root, []).find((s) => s.kind === 'text' && s.text === 'Q2.好きな形は？')
    expect(slot).toBeDefined()
    expect(nodeAt(root, slot?.id ?? '')?.textContent).toBe('Q2.好きな形は？')
  })
})

describe('押したら移る先', () => {
  it('HTMLの中の data-nc-go の画面を全部拾う（入れる前に、消した画面を指していないか確かめる）', () => {
    expect(goTargetsIn('<a data-nc-go="s2">a</a><button data-nc-go="s12">b</button><i data-nc-go="x">c</i>')).toEqual(['s2', 's12'])
  })

  it('画面①②…に作り変えた見本の中の「次の設問へ」（見本自身の画面）は拾わない。スクリプトの中の文字も拾わない', () => {
    const converted =
      '<div class="nc nc-sample nc-aaaaaaaa" data-nocode="sample" data-nc-screens="">' +
      '<div class="nc-screen" data-nc-screen="s1"><a href="ooooo" data-nc-go="s2">はい</a><img src="x"></div>' +
      '<div class="nc-screen" data-nc-screen="s2" hidden><p><a href="ooooo" data-nc-go="s3">はい</a></p></div>' +
      '</div><script>var t = \'<a data-nc-go="s9">\'</script>'
    expect(goTargetsIn(`<a data-nc-go="s4">外</a>${converted}<button data-nc-go="s5">外2</button>`)).toEqual(['s4', 's5'])
  })
})

describe('画面①②…に作り変えた見本の中の画面', () => {
  function converted(): { root: SlotNode; s1: SlotNode; s2: SlotNode; inner: SlotNode; outer: SlotNode } {
    const inner = el('A', { href: 'ooooo', 'data-nc-go': 's2' }, [text('はい')])
    const s1 = el('DIV', { class: 'nc-screen', 'data-nc-screen': 's1' }, [el('P', {}, [text('Q1')]), inner])
    const s2 = el('DIV', { class: 'nc-screen', 'data-nc-screen': 's2', hidden: '' }, [el('P', {}, [text('Q2')])])
    const outer = el('A', { href: 'https://example.test/' }, [text('外のリンク')])
    const root = el('DIV', {}, [el('DIV', { class: 'MuiBox-root' }, [el('DIV', { class: 'nc nc-sample nc-aaaaaaaa', 'data-nc-screens': '' }, [s1, s2])]), outer])
    return { root, s1, s2, inner, outer }
  }

  it('見本の中の画面を、そのまま設問①②…として返す（見え方で探さない）', () => {
    const { root, s1, s2 } = converted()
    expect(nestedScreens(root)).toEqual([s1, s2])
    expect(nestedScreens(survey().root)).toEqual([])
  })

  it('見本の中の画面にあるボタンは「見本自身の切り替え」（部品を積んで作るの画面へは移せない）', () => {
    const { root, s1, s2 } = converted()
    const controls = sampleSlots(root, [s1, s2]).filter((slot) => slot.kind === 'control')
    expect(controls.map((c) => (c.kind === 'control' ? [c.label, c.internal] : null))).toEqual([
      ['はい', true],
      ['外のリンク', false],
    ])
  })
})
