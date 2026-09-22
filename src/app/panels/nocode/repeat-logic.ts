/**
 * 並んでいる部品の見つけ方（2026-09-22・本人の依頼。ノーコードでWidgetを作る②）。
 *
 * よくある質問・口コミ・特徴リスト・料金表の行のように、同じ形が並んでいるところを見つける。
 * 「同じ形」は、タグ名とクラスがそろっている兄弟が2つ以上あること。
 *
 * DOMそのものではなく小さな形（tagName・className・親・子）だけを見るので、
 * テストはDOM無しで確かめられる（tests/nocode-repeat.test.ts）。
 */

/** 判定に使う最小の形（HTMLElement はこれを満たす） */
export interface NodeShape {
  readonly tagName: string
  readonly className: string | { baseVal?: string }
  readonly parentElement: NodeShape | null
  readonly children: ArrayLike<NodeShape>
  /** 文字の子（文の途中にあるリンクかどうかを見るのに使う。無ければ文字なしとみなす） */
  readonly childNodes?: ArrayLike<{ readonly nodeType: number; readonly textContent: string | null }>
}

/**
 * 部品として扱うタグ（かたまりになる要素）。
 * 文の途中の span・b などの飾りは入れない（1文字ずつ消せてしまうと壊れる）。
 * a・button・label は下の CONTROL_TAGS で、並んでいるときだけ部品にする。
 */
const ITEM_TAGS: ReadonlySet<string> = new Set([
  'DIV',
  'LI',
  'SECTION',
  'ARTICLE',
  'TR',
  'FIGURE',
  'DETAILS',
  'P',
  'DL',
  'ASIDE',
  'BLOCKQUOTE',
])

/**
 * 選択肢のボタン（アンケートの3択→4択）。並んでいれば1つずつ部品にする。
 * ただし文の途中のリンク（「詳しくはこちら」）は部品にしない＝親に文字が直接あるときは外す。
 * 設問ごとの箱が並んでいても、ボタンの方を選ぶ（増やしたいのは選択肢）。
 */
const CONTROL_TAGS: ReadonlySet<string> = new Set(['A', 'BUTTON', 'LABEL'])

/** 見た目の状態を表すクラス（1つだけ開いている・選ばれている、でも同じ形とみなす） */
const STATE_CLASS = /^(is-|has-)|^(active|open|opened|show|shown|selected|current|visible|hidden|on|off)$/i
/** 「部品を積んで作る」の部品ごとのクラス（色などを部品ごとに書く目印）。形の見分けには使わない */
const INSTANCE_CLASS = /^nc-b-\d+$/

function classesOf(el: NodeShape): string[] {
  const raw = typeof el.className === 'string' ? el.className : (el.className.baseVal ?? '')
  return raw
    .split(/\s+/)
    .filter((c) => c !== '' && !STATE_CLASS.test(c) && !INSTANCE_CLASS.test(c))
    .sort()
}

/** 同じ形かどうかの目印（タグ名＋状態を除いたクラス。順番は問わない） */
export function repeatSignature(el: NodeShape): string {
  return `${el.tagName.toUpperCase()}.${classesOf(el).join('.')}`
}

/** 同じ形がそろっている仲間（並び順）。自分を含む */
export function repeatGroupOf(item: NodeShape): NodeShape[] {
  const parent = item.parentElement
  if (parent === null) return [item]
  const sig = repeatSignature(item)
  return Array.from(parent.children).filter((c) => repeatSignature(c) === sig)
}

/** 文の中の飾り（これだけが中にある部品は「文章の1段落」とみなす） */
const INLINE_TAGS: ReadonlySet<string> = new Set([
  'SPAN', 'B', 'STRONG', 'I', 'EM', 'A', 'BR', 'WBR', 'SMALL', 'U', 'S', 'MARK', 'SUP', 'SUB', 'FONT', 'CODE',
])

/** 中に段落や画像などのかたまりを持つ（＝1問・1件のようなまとまり） */
function isCompound(el: NodeShape): boolean {
  return Array.from(el.children).some((child) => !INLINE_TAGS.has(child.tagName.toUpperCase()))
}

/**
 * ボタンだけが入った入れ物（選択肢1つ）。文の中のリンク（親に文字がある）は含めない。
 * 設問の箱や画面が並んでいても、選択肢の方を選ぶ（増やしたいのは選択肢）。
 */
function isControlLike(el: NodeShape): boolean {
  return !hasOwnText(el) && Array.from(el.children).some((child) => CONTROL_TAGS.has(child.tagName.toUpperCase()))
}

/** 「部品を積んで作る」の画面（画面の複製・並べ替えは入力の画面で行う。見たまま編集では部品にしない） */
function isScreen(el: NodeShape): boolean {
  return classesOf(el).includes('nc-screen')
}

/**
 * 一度「並んでいる」と分かった形を覚えておく（親ごと）。
 * 消して残り1つになっても部品として扱い続けないと、もう増やせなくなる。
 */
export interface KnownGroups {
  remember(item: NodeShape): void
  has(item: NodeShape): boolean
}

export function createKnownGroups(): KnownGroups {
  const byParent = new WeakMap<NodeShape, Set<string>>()
  return {
    remember(item) {
      const parent = item.parentElement
      if (parent === null) return
      const set = byParent.get(parent) ?? new Set<string>()
      set.add(repeatSignature(item))
      byParent.set(parent, set)
    },
    has(item) {
      const parent = item.parentElement
      return parent !== null && (byParent.get(parent)?.has(repeatSignature(item)) ?? false)
    },
  }
}

/**
 * 指している場所から上へたどり、いちばん近い「並んでいる部品」を返す。
 * 中に段落が並んでいる「1問・1件」は、段落ではなくまとまりの方を選ぶ（増やしたいのは1問ごと）。
 * まとまりが無ければ、いちばん近い部品（文章の段落など）。
 * Widget の外（root より上）までは探さない。見つからなければ null。
 */
export function findRepeatItem(target: NodeShape, root: NodeShape, known?: KnownGroups): NodeShape | null {
  let nearest: NodeShape | null = null
  let el: NodeShape | null = target
  while (el !== null && el !== root) {
    const tag = el.tagName.toUpperCase()
    const isControl = CONTROL_TAGS.has(tag) && !hasOwnText(el.parentElement)
    if ((ITEM_TAGS.has(tag) || isControl) && !isScreen(el)) {
      const isRepeated = repeatGroupOf(el).length >= 2
      if (isRepeated) known?.remember(el)
      if (isRepeated || (known?.has(el) ?? false)) {
        if (isControl || isControlLike(el) || isCompound(el)) return el
        nearest ??= el
      }
    }
    el = el.parentElement
  }
  return nearest
}

/** 親に文字が直接ある（＝文の途中）か */
function hasOwnText(parent: NodeShape | null): boolean {
  const nodes = parent?.childNodes
  if (nodes === undefined) return false
  return Array.from(nodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '')
}

/** 同じ仲間の中で1つ前（-1）・1つ後ろ（1）。端なら null */
export function neighborOf<T>(group: readonly T[], item: T, direction: -1 | 1): T | null {
  const index = group.indexOf(item)
  if (index === -1) return null
  return group[index + direction] ?? null
}
