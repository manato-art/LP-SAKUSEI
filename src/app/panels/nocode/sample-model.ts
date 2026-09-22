/**
 * 「部品を積んで作る」の見本の部品：見本の中身の見分け方（2026-09-22・本人の依頼）。
 *
 * 本人の依頼「用意されている見本から作った時にも、部品を積んで作るみたいな視覚的にわかりやすい要素や、
 * ページの切り替わりを入れて欲しい」（決定: 見本を部品として積む・切り替わりは両方）。
 *  - sampleSlots: 見本の中身（文字・画像・ボタン）を上から順に一覧にする。入力欄で直すのに使う
 *  - findStepGroup: 見本にもともとある設問①②…（同じ形の箱が並び、見えているのは1つだけ）を見つける
 *  - nodeAt: 一覧の番号から同じ場所をもう一度見つける（文字を直しても形は変わらないので番号も変わらない）
 * DOMそのものではなく小さな形だけを見る（テストは tests/nocode-sample-model.test.ts）。
 */
import { repeatSignature, type NodeShape } from './repeat-logic.ts'

/** 判定に使う最小の形（DOMの Node はこれを満たす） */
export interface SlotNode {
  readonly nodeType: number
  readonly nodeName: string
  readonly textContent: string | null
  readonly childNodes: ArrayLike<SlotNode>
  getAttribute?: (name: string) => string | null
}

export type Slot =
  | { readonly kind: 'text'; readonly id: string; readonly text: string; readonly step: number | null }
  | { readonly kind: 'image'; readonly id: string; readonly src: string; readonly alt: string; readonly step: number | null }
  | {
      readonly kind: 'control'
      readonly id: string
      readonly tag: 'A' | 'BUTTON' | 'LABEL'
      readonly label: string
      readonly href: string | null
      readonly go: string | null
      readonly step: number | null
    }

/** 中を見ない要素（見た目の文字ではない） */
const SKIP_TAGS: ReadonlySet<string> = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'SVG', 'IFRAME'])
const CONTROL_TAGS: ReadonlySet<string> = new Set(['A', 'BUTTON', 'LABEL'])

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
 * 文字は文字の入力、画像は差し替え、ボタン（a・button・label）は文字・リンク先・押したときで直す。
 * ボタンの中の文字はボタンの方で直す（二重に出さない）。style・script などの中は出さない。
 * steps は設問①②…の箱（findStepGroup）。どの設問の中にあるかを step に持つ。
 */
export function sampleSlots(root: SlotNode, steps: readonly SlotNode[]): Slot[] {
  const index = new Map(elementsInOrder(root).map((node, i) => [node, i]))
  const slots: Slot[] = []
  const walk = (node: SlotNode, parentIndex: number, inControl: boolean, step: number | null): void => {
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
      if (tag === 'IMG' && (attr('src') ?? '') !== '') {
        slots.push({ kind: 'image', id: `e${i}`, src: attr('src') ?? '', alt: attr('alt') ?? '', step: childStep })
      }
      const isControl = CONTROL_TAGS.has(tag) && !inControl
      if (isControl) {
        slots.push({
          kind: 'control',
          id: `e${i}`,
          tag: tag as 'A' | 'BUTTON' | 'LABEL',
          label: tidy(child.textContent ?? ''),
          href: tag === 'A' ? attr('href') : null,
          go: attr('data-nc-go'),
          step: childStep,
        })
      }
      walk(child, i, inControl || isControl, childStep)
    })
  }
  walk(root, -1, false, null)
  return slots
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

/** HTMLの中の「押したら移る先」（data-nc-go）の画面を全部。入れる前に、消した画面を指していないか確かめる */
export function goTargetsIn(html: string): string[] {
  return [...html.matchAll(/data-nc-go="(s\d{1,4})"/g)].map((m) => m[1] ?? '')
}
