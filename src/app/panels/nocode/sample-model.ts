/**
 * 「部品を積んで作る」の見本の部品：見本の中身の見分け方（2026-09-22・本人の依頼）。
 *
 * 本人の依頼「用意されている見本から作った時にも、部品を積んで作るみたいな視覚的にわかりやすい要素や、
 * ページの切り替わりを入れて欲しい」（決定: 見本を部品として積む・切り替わりは両方）。
 *  - sampleSlots: 見本の中身（文字・画像・動画・ボタン・囲み）を上から順に一覧にする。入力欄で直すのに使う
 *  - findStepGroup: 見本にもともとある設問①②…（同じ形の箱が並び、見えているのは1つだけ）を見つける
 *  - nodeAt: 一覧の番号から同じ場所をもう一度見つける（文字を直しても形は変わらないので番号も変わらない）
 * DOMそのものではなく小さな形だけを見る（テストは tests/nocode-sample-model.test.ts）。
 */
import { repeatSignature, type NodeShape } from './repeat-logic.ts'
import { SCREEN_ID } from './templates/builder-blocks.ts'

/** 判定に使う最小の形（DOMの Node はこれを満たす） */
export interface SlotNode {
  readonly nodeType: number
  readonly nodeName: string
  readonly textContent: string | null
  readonly childNodes: ArrayLike<SlotNode>
  getAttribute?: (name: string) => string | null
}

/**
 * 押したら移る先を付けられる要素に共通のこと（本人の決定 2026-09-22: 画像・動画・ボタン・囲み。文字だけの行は押せない）。
 * go は押したら移る画面（data-nc-go）。internal は、画面①②…に作り変えた見本の中の画面にある
 * （押したときは見本自身の切り替えになる。外の画面へは移せない）。
 */
interface Pressable {
  readonly id: string
  readonly step: number | null
  readonly go: string | null
  readonly internal: boolean
}

export type Slot =
  | { readonly kind: 'text'; readonly id: string; readonly text: string; readonly step: number | null }
  /** inControl: ボタンの中の画像（画像のボタン）。押したときはボタンの方で決める */
  | (Pressable & { readonly kind: 'image'; readonly src: string; readonly alt: string; readonly inControl: boolean })
  | (Pressable & { readonly kind: 'video'; readonly src: string; readonly inControl: boolean })
  | (Pressable & { readonly kind: 'control'; readonly tag: 'A' | 'BUTTON' | 'LABEL'; readonly label: string; readonly href: string | null })
  /** 囲み（同じ形が並んだ商品カードなど）。label は中の最初の文字（無ければ画像の説明） */
  | (Pressable & { readonly kind: 'box'; readonly label: string })

/** 中を見ない要素（見た目の文字ではない） */
const SKIP_TAGS: ReadonlySet<string> = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'SVG', 'IFRAME'])
const CONTROL_TAGS: ReadonlySet<string> = new Set(['A', 'BUTTON', 'LABEL'])
/** 囲みになる要素（商品カード・口コミの1件など）。文の1行（p など）は入れない */
const BOX_TAGS: ReadonlySet<string> = new Set(['DIV', 'LI', 'SECTION', 'ARTICLE', 'FIGURE', 'ASIDE', 'BLOCKQUOTE'])
/** 文の中の飾り（これだけが中にある箱は、文字の1行とみなす＝囲みにしない） */
const INLINE_TAGS: ReadonlySet<string> = new Set([
  'SPAN', 'B', 'STRONG', 'I', 'EM', 'A', 'BR', 'WBR', 'SMALL', 'U', 'S', 'MARK', 'SUP', 'SUB', 'FONT', 'CODE',
])

const isElement = (node: SlotNode): boolean => node.nodeType === 1
const tagOf = (node: SlotNode): string => node.nodeName.toUpperCase()
const tidy = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** root の中の要素（root 自身は含めない）を上から順に */
export function elementsInOrder(root: SlotNode): SlotNode[] {
  const out: SlotNode[] = []
  const walk = (node: SlotNode): void => {
    for (const child of Array.from(node.childNodes)) {
      if (!isElement(child)) continue
      out.push(child)
      walk(child)
    }
  }
  walk(root)
  return out
}

/**
 * 見本の中身の一覧（上から順）。
 * 文字は文字の入力、画像・動画は差し替え、ボタン（a・button・label）は文字・リンク先・押したときで直す。
 * 画像・動画・囲みにも押したとき（画面②へ移る）を付けられる。
 * ボタンの中の文字はボタンの方で直す（二重に出さない）。style・script などの中は出さない。
 * steps は設問①②…の箱（findStepGroup）。どの設問の中にあるかを step に持つ。
 */
export function sampleSlots(root: SlotNode, steps: readonly SlotNode[]): Slot[] {
  const index = new Map(elementsInOrder(root).map((node, i) => [node, i]))
  const slots: Slot[] = []
  const walk = (node: SlotNode, parentIndex: number, inControl: boolean, step: number | null, inScreens: boolean, inBox: boolean): void => {
    const boxes = inControl || inBox ? new Set<SlotNode>() : boxesAmong(node, steps)
    Array.from(node.childNodes).forEach((child, ordinal) => {
      if (!isElement(child)) {
        const text = tidy(child.textContent ?? '')
        if (child.nodeType === 3 && text !== '' && !inControl) slots.push({ kind: 'text', id: `t${parentIndex}.${ordinal}`, text, step })
        return
      }
      const tag = tagOf(child)
      if (SKIP_TAGS.has(tag)) return
      const i = index.get(child) ?? -1
      const at = steps.indexOf(child)
      const childStep = at >= 0 ? at : step
      const attr = (name: string): string | null => child.getAttribute?.(name) ?? null
      const pressable = { id: `e${i}`, step: childStep, go: attr('data-nc-go'), internal: inScreens }
      const isBox = boxes.has(child)
      if (isBox) slots.push({ kind: 'box', ...pressable, label: boxLabel(child) })
      if (tag === 'IMG' && (attr('src') ?? '') !== '') {
        slots.push({ kind: 'image', ...pressable, src: attr('src') ?? '', alt: attr('alt') ?? '', inControl })
      }
      if (tag === 'VIDEO') slots.push({ kind: 'video', ...pressable, src: videoSrc(child), inControl })
      const isControl = CONTROL_TAGS.has(tag) && !inControl
      if (isControl) {
        slots.push({
          kind: 'control',
          ...pressable,
          tag: tag as 'A' | 'BUTTON' | 'LABEL',
          label: tidy(child.textContent ?? ''),
          href: tag === 'A' ? attr('href') : null,
        })
      }
      walk(child, i, inControl || isControl, childStep, inScreens || isScreensRoot(child), inBox || isBox)
    })
  }
  walk(root, -1, false, null, false, false)
  return slots
}

/**
 * node の子のうち、囲み（押したら移る先を付けられる1件）になるもの。
 * 同じ形が2つ以上並び、中に段落や画像などのかたまりを持つ箱（商品カード・口コミの1件など）。
 * 並びのどれかにボタンがあるとき（設問の箱など）は囲みにしない（ボタンの方で移る先を決める）。
 * 設問①②…の箱と、画面①②…の画面も囲みにしない（タブで切り替えて直す）。
 */
function boxesAmong(node: SlotNode, steps: readonly SlotNode[]): Set<SlotNode> {
  const groups = new Map<string, SlotNode[]>()
  for (const child of Array.from(node.childNodes)) {
    if (!isElement(child) || !BOX_TAGS.has(tagOf(child)) || steps.includes(child) || isScreen(child)) continue
    const signature = repeatSignature(child as unknown as NodeShape)
    groups.set(signature, [...(groups.get(signature) ?? []), child])
  }
  const out = new Set<SlotNode>()
  for (const members of groups.values()) {
    if (members.length < 2 || members.some(hasControl) || !members.every(isCompound)) continue
    for (const member of members) out.add(member)
  }
  return out
}

/** 中に段落や画像などのかたまりを持つ（文字だけの1行ではない） */
function isCompound(node: SlotNode): boolean {
  return Array.from(node.childNodes).some((child) => isElement(child) && !INLINE_TAGS.has(tagOf(child)) && !SKIP_TAGS.has(tagOf(child)))
}

/** 中にボタン（a・button・label）か、画面①②…の入れ物がある */
function hasControl(node: SlotNode): boolean {
  return elementsInOrder(node).some((el) => CONTROL_TAGS.has(tagOf(el)) || isScreensRoot(el))
}

/** 囲みの名前に使う長さ（長い囲みは頭だけ。どの囲みか分かればよい） */
const BOX_LABEL_MAX = 24

/** 囲みの名前: 中の文字の頭のほう。文字が無ければ最初の画像の説明 */
function boxLabel(node: SlotNode): string {
  const parts: string[] = []
  const walk = (current: SlotNode): void => {
    for (const child of Array.from(current.childNodes)) {
      if (parts.join(' ').length > BOX_LABEL_MAX) return
      if (child.nodeType === 3) {
        const text = tidy(child.textContent ?? '')
        if (text !== '') parts.push(text)
        continue
      }
      if (!isElement(child) || SKIP_TAGS.has(tagOf(child))) continue
      walk(child)
    }
  }
  walk(node)
  const text = parts.join(' ')
  if (text === '') {
    const image = elementsInOrder(node).find((el) => tagOf(el) === 'IMG')
    return tidy(image?.getAttribute?.('alt') ?? '')
  }
  return text.length > BOX_LABEL_MAX ? `${text.slice(0, BOX_LABEL_MAX)}…` : text
}

/** 動画の場所（video の src。無ければ中の最初の source） */
function videoSrc(video: SlotNode): string {
  const own = video.getAttribute?.('src') ?? ''
  if (own !== '') return own
  const source = Array.from(video.childNodes).find((child) => isElement(child) && tagOf(child) === 'SOURCE')
  return source?.getAttribute?.('src') ?? ''
}

/** 画面①②…の入れ物（「部品を積んで作る」・画面に作り変えた見本） */
function isScreensRoot(node: SlotNode): boolean {
  return isElement(node) && node.getAttribute?.('data-nc-screens') !== null && node.getAttribute?.('data-nc-screens') !== undefined
}

/**
 * 画面①②…に作り変えた見本（中に data-nc-screens の入れ物がある）なら、その画面を上から順に。無ければ空。
 * 見本の部品で、設問①②…として切り替えて直すのに使う（見え方で探すより確か）。
 */
export function nestedScreens(root: SlotNode): SlotNode[] {
  const holder = elementsInOrder(root).find(isScreensRoot)
  if (holder === undefined) return []
  return Array.from(holder.childNodes).filter((child) => isElement(child) && (child.getAttribute?.('data-nc-screen') ?? null) !== null)
}

/** 一覧の番号（e12 / t12.3）から、その要素・文字を見つける。見つからなければ null */
export function nodeAt(root: SlotNode, id: string): SlotNode | null {
  const elements = elementsInOrder(root)
  const element = /^e(\d+)$/.exec(id)
  if (element !== null) return elements[Number(element[1])] ?? null
  const textId = /^t(-?\d+)\.(\d+)$/.exec(id)
  if (textId === null) return null
  const parent = Number(textId[1]) === -1 ? root : elements[Number(textId[1])]
  const child = parent === undefined ? undefined : Array.from(parent.childNodes)[Number(textId[2])]
  return child !== undefined && child.nodeType === 3 ? child : null
}

/** 「部品を積んで作る」の画面（画面は画面のタブで切り替える。設問としては扱わない） */
function isScreen(node: SlotNode): boolean {
  return repeatSignature(node as unknown as NodeShape).split('.').includes('nc-screen')
}

/**
 * 見本にもともとある設問①②…を見つける（上から見て最初の並び）。
 * 同じ形の箱が2つ以上並び、1つ以上が隠れていて、見えているのは多くても1つ。
 * 全部見えている並び（よくある質問・口コミなど）は設問ではない。
 * isVisible はその要素自身の見え方（display:none でない等）。
 */
export function findStepGroup(root: SlotNode, isVisible: (node: SlotNode) => boolean): SlotNode[] {
  const search = (node: SlotNode): SlotNode[] | null => {
    const children = Array.from(node.childNodes).filter((c) => isElement(c) && !SKIP_TAGS.has(tagOf(c)))
    const groups = new Map<string, SlotNode[]>()
    for (const child of children) {
      if (Array.from(child.childNodes).every((c) => !isElement(c))) continue // 中に箱を持たない（1行の文字など）は設問ではない
      const signature = repeatSignature(child as unknown as NodeShape)
      groups.set(signature, [...(groups.get(signature) ?? []), child])
    }
    for (const members of groups.values()) {
      if (members.length < 2 || members.some(isScreen)) continue
      const visible = members.filter(isVisible).length
      if (visible <= 1 && visible < members.length) return members
    }
    for (const child of children) {
      const found = search(child)
      if (found !== null) return found
    }
    return null
  }
  return search(root) ?? []
}

/** 付け外しに使う最小の形（DOMの Element はこれを満たす） */
export interface PressElement {
  readonly tagName: string
  getAttribute(name: string): string | null
  hasAttribute(name: string): boolean
  setAttribute(name: string, value: string): void
  removeAttribute(name: string): void
}

/** 押せる印（role・tabindex）をこちらで付けた目印。外すときに、付けたものだけ外す */
const PRESS_MARK = 'data-nc-press'
/** 動画の操作ボタンをこちらで外した目印。移る先を外したら戻す */
const CONTROLS_MARK = 'data-nc-controls'

/**
 * 押したら移る先（data-nc-go）を付ける・外す（go が null か画面のidの形でなければ外す）。
 * ボタン・リンク・選択肢はもともと押せるので移る先だけ。画像・動画・囲みには、押せる印（role="button"）と
 * キーボードで選べる印（tabindex）も付ける（部品を積んで作るの画像・図形と同じ）。見本がもとから持っている印は触らない。
 * 動画は、押したら移るあいだは操作ボタンを出さない（押すと再生ではなく移る。部品の動画と同じ）。
 */
export function setGoOn(el: PressElement, go: string | null): void {
  const tag = el.tagName.toUpperCase()
  if (go === null || !SCREEN_ID.test(go)) {
    el.removeAttribute('data-nc-go')
    if (el.hasAttribute(PRESS_MARK)) {
      for (const name of ['role', 'tabindex', PRESS_MARK]) el.removeAttribute(name)
    }
    if (el.hasAttribute(CONTROLS_MARK)) {
      el.removeAttribute(CONTROLS_MARK)
      el.setAttribute('controls', '')
    }
    return
  }
  el.setAttribute('data-nc-go', go)
  if (!CONTROL_TAGS.has(tag) && !el.hasAttribute('role') && !el.hasAttribute('tabindex')) {
    el.setAttribute('role', 'button')
    el.setAttribute('tabindex', '0')
    el.setAttribute(PRESS_MARK, '')
  }
  if (tag === 'VIDEO' && el.hasAttribute('controls')) {
    el.removeAttribute('controls')
    el.setAttribute(CONTROLS_MARK, '')
  }
}

/** 中身を持たない要素（閉じタグが無い） */
const VOID_TAGS: ReadonlySet<string> = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
/** コメント・中を読まない要素（スクリプト等）・開きタグ・閉じタグ */
const TAG_RE = /<!--[\s\S]*?-->|<(script|style|template|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi

/**
 * HTMLの中の「押したら移る先」（data-nc-go）の画面を全部。入れる前に、消した画面を指していないか確かめる。
 * 画面①②…に作り変えた見本の中（data-nc-screens の入れ物の中）は、見本自身の画面なので拾わない。
 * スクリプトの中の文字も拾わない。
 */
export function goTargetsIn(html: string): string[] {
  const out: string[] = []
  const open: boolean[] = []
  let insideScreens = 0
  for (const match of html.matchAll(TAG_RE)) {
    const tag = (match[3] ?? '').toLowerCase()
    if (tag === '') continue
    if (match[2] === '/') {
      if (open.pop() === true) insideScreens -= 1
      continue
    }
    const attrs = match[4] ?? ''
    const go = /\sdata-nc-go="(s\d{1,4})"/.exec(attrs)?.[1]
    if (go !== undefined && insideScreens === 0) out.push(go)
    if (VOID_TAGS.has(tag) || attrs.trimEnd().endsWith('/')) continue
    const screens = /\sdata-nc-screens(?:[\s=]|$)/.test(attrs)
    open.push(screens)
    if (screens) insideScreens += 1
  }
  return out
}
