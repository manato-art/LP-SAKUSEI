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
import { findStepGroup, goTargetsIn, nestedScreens, nodeAt, sampleSlots, setGoOn, type PressElement, type SlotNode } from '../src/app/panels/nocode/sample-model.ts'

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
    expect(slots.map((s) => [s.kind, s.kind === 'text' ? s.text : s.kind === 'image' ? s.alt : s.kind === 'video' ? s.src : s.label])).toEqual([
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

/**
 * 本人の決定（2026-09-22）: 見本・型の中で「押したとき」を付けられるのは、画像・動画・ボタン（選択肢を含む）・囲み（商品カードなど）。
 * 文字だけの行は押せない（誤って押しやすいため）。
 */
describe('押したら画面へ移せる要素（画像・動画・ボタン・囲み）', () => {
  it('画像は、押したら移る先（data-nc-go）を持つ', () => {
    const root = el('DIV', {}, [el('IMG', { src: 'a.png', alt: '丸', 'data-nc-go': 's3' })])
    expect(sampleSlots(root, [])).toEqual([{ kind: 'image', id: 'e0', src: 'a.png', alt: '丸', step: null, go: 's3', internal: false, inControl: false }])
  })

  it('ボタンの中の画像（画像のボタン）は、ボタンの方で押したときを決める（画像の方には出さない）', () => {
    const root = el('DIV', {}, [el('A', { href: 'https://example.test/' }, [el('IMG', { src: 'a.png', alt: '申し込む' })])])
    const slots = sampleSlots(root, [])
    expect(slots.map((s) => s.kind)).toEqual(['control', 'image'])
    expect(slots[1]).toMatchObject({ kind: 'image', inControl: true })
  })

  it('動画も一覧に出す（押したら移る先を持つ）', () => {
    const root = el('DIV', {}, [el('VIDEO', { src: 'a.mp4', 'data-nc-go': 's2' })])
    expect(sampleSlots(root, [])).toEqual([{ kind: 'video', id: 'e0', src: 'a.mp4', step: null, go: 's2', internal: false, inControl: false }])
    const withSource = el('DIV', {}, [el('VIDEO', {}, [el('SOURCE', { src: 'b.mp4' })])])
    expect(sampleSlots(withSource, [])[0]).toMatchObject({ kind: 'video', src: 'b.mp4', go: null })
  })

  it('同じ形の囲み（商品カードなど）が並んでいたら、1枚ずつ押せる囲みとして出す（名前は中の最初の文字）', () => {
    const card = (name: string): SlotNode => el('DIV', { class: 'card' }, [el('IMG', { src: `${name}.png` }), el('P', {}, [text(`${name}の説明`)])])
    const root = el('DIV', {}, [card('商品A'), card('商品B')])
    const boxes = sampleSlots(root, []).filter((s) => s.kind === 'box')
    expect(boxes).toEqual([
      { kind: 'box', id: 'e0', label: '商品Aの説明', step: null, go: null, internal: false },
      { kind: 'box', id: 'e3', label: '商品Bの説明', step: null, go: null, internal: false },
    ])
  })

  it('中にボタンがある並び（設問の箱など）は囲みにしない（ボタンの方で移る先を決める）', () => {
    const { root } = survey()
    expect(sampleSlots(root, []).filter((s) => s.kind === 'box')).toEqual([])
  })

  it('囲みの中の並び（星の印など）は囲みにしない（いちばん外の囲みだけ）', () => {
    const star = (): SlotNode => el('SPAN', { class: 'star' }, [el('I', {})])
    const card = (name: string): SlotNode => el('LI', { class: 'item' }, [el('DIV', { class: 'stars' }, [star(), star()]), el('P', {}, [text(name)])])
    const root = el('UL', {}, [card('A'), card('B')])
    expect(sampleSlots(root, []).filter((s) => s.kind === 'box').map((s) => (s.kind === 'box' ? s.label : ''))).toEqual(['A', 'B'])
  })
})

/** テスト用の、属性だけを持つ要素 */
function pressEl(tag: string, attrs: Record<string, string> = {}): PressElement & { attrs: Record<string, string> } {
  const state = { ...attrs }
  return {
    tagName: tag,
    attrs: state,
    getAttribute: (name) => state[name] ?? null,
    hasAttribute: (name) => name in state,
    setAttribute: (name, value) => {
      state[name] = value
    },
    removeAttribute: (name) => {
      delete state[name]
    },
  }
}

describe('押したら移る先を付ける・外す', () => {
  it('ボタン・リンク・選択肢には移る先だけを付ける（もともと押せる）', () => {
    for (const tag of ['A', 'BUTTON', 'LABEL']) {
      const el = pressEl(tag, { href: 'ooooo' })
      setGoOn(el, 's2')
      expect(el.attrs).toEqual({ href: 'ooooo', 'data-nc-go': 's2' })
      setGoOn(el, null)
      expect(el.attrs).toEqual({ href: 'ooooo' })
    }
  })

  it('画像・囲みには、押せる印とキーボードで選べる印も付ける。外すときは付けたものだけ外す', () => {
    const img = pressEl('IMG', { src: 'a.png' })
    setGoOn(img, 's3')
    expect(img.attrs).toEqual({ src: 'a.png', 'data-nc-go': 's3', role: 'button', tabindex: '0', 'data-nc-press': '' })
    setGoOn(img, 's4')
    expect(img.attrs).toEqual({ src: 'a.png', 'data-nc-go': 's4', role: 'button', tabindex: '0', 'data-nc-press': '' })
    setGoOn(img, null)
    expect(img.attrs).toEqual({ src: 'a.png' })

    // 見本が自分で押せるようにしてある囲み（role・tabindex がもとからある）は、そのまま残す
    const card = pressEl('DIV', { class: 'card', role: 'link', tabindex: '0' })
    setGoOn(card, 's2')
    setGoOn(card, null)
    expect(card.attrs).toEqual({ class: 'card', role: 'link', tabindex: '0' })
  })

  it('動画は、押したら移るあいだは操作ボタンを出さない（押すと再生ではなく移る）。外したら戻す', () => {
    const video = pressEl('VIDEO', { src: 'a.mp4', controls: '' })
    setGoOn(video, 's2')
    expect(video.attrs).toEqual({ src: 'a.mp4', 'data-nc-go': 's2', role: 'button', tabindex: '0', 'data-nc-press': '', 'data-nc-controls': '' })
    setGoOn(video, null)
    expect(video.attrs).toEqual({ src: 'a.mp4', controls: '' })
  })

  it('画面のidの形でない移る先は付けない（外す）', () => {
    const img = pressEl('IMG', { src: 'a.png', 'data-nc-go': 's2' })
    setGoOn(img, '"><script>')
    expect(img.attrs).toEqual({ src: 'a.png' })
  })
})
