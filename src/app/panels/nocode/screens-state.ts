/**
 * 「部品を積んで作る」の画面の足し方（2026-09-22・本人の依頼。ノーコードでWidgetを作る④）。
 *
 * - 画面の名前は「画面①」から。空いているいちばん小さい丸数字を使う（本人指定。あとで変えられる）
 * - 画面のidは s1, s2…。今ある中でいちばん大きい番号の次（消した番号は使い回さない＝古い移る先と取り違えない）
 * - どの部品からも移ってこない画面は、見ている人がたどり着けない（画面に知らせを出すのに使う）
 * テストは tests/nocode-screens-state.test.ts。
 */
import { items, str, type TemplateData } from './templates/types.ts'

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'

/** n番目の画面の名前（1〜20は丸数字） */
export function screenLabel(n: number): string {
  const circled = Array.from(CIRCLED)[n - 1]
  return `画面${circled ?? String(n)}`
}

export function nextScreenId(ids: readonly string[]): string {
  const max = ids.reduce((top, id) => {
    const n = /^s(\d+)$/.exec(id)?.[1]
    return n === undefined ? top : Math.max(top, Number(n))
  }, 0)
  return `s${max + 1}`
}

export function nextScreenName(names: readonly string[]): string {
  const used = new Set(names.map((name) => name.trim()))
  let n = 1
  while (used.has(screenLabel(n))) n += 1
  return screenLabel(n)
}

/** その画面へ「画面へ移る」でつながっている部品の数 */
export function incomingCount(data: TemplateData, screenId: string): number {
  return items(data, 'screens')
    .flatMap((screen) => items(screen, 'blocks'))
    .filter((block) => str(block, 'action') === 'screen' && str(block, 'target') === screenId).length
}

/**
 * Widget編集の見たまま画面で、選んだ画面だけを見せるCSS（入れたあとも移る先の画面を直せるように）。
 * 画面の hidden は触らない（触るとコード欄へ書き出されて保存される）。見たまま画面の外に置く style で上書きする。
 * Widget自身の `[hidden]{display:none !important}` より強くするため、クラスを2回重ねる。
 * 名前・idが決まった形でなければ何も出さない。
 */
export function editorScreenCss(uid: string, screenId: string): string {
  if (!/^nc-[a-z0-9]{8}$/.test(uid) || !/^s\d{1,4}$/.test(screenId)) return ''
  const root = `[data-widget-preview] .${uid}.${uid}>`
  return `${root}[data-nc-screen]{display:none !important}${root}[data-nc-screen="${screenId}"]{display:block !important}`
}

/** 道のりを数えるのに使う最小の形（DOMの Element はこれを満たす） */
interface TreeNode {
  readonly parentElement: TreeNode | null
  readonly children: ArrayLike<TreeNode>
}

/**
 * 見たまま画面（root）から node までの道のりを「何番目の子か」で書く（`:nth-child(2)>:nth-child(3)`）。
 * Widgetの中身に目印の属性を付けると保存されてしまうので、場所で指す。root の中に無ければ null。
 */
export function cssPathFrom(root: TreeNode, node: TreeNode): string | null {
  const steps: string[] = []
  let current: TreeNode | null = node
  while (current !== null && current !== root) {
    const parent: TreeNode | null = current.parentElement
    if (parent === null) return null
    steps.unshift(`:nth-child(${Array.from(parent.children).indexOf(current) + 1})`)
    current = parent
  }
  return current === root && steps.length > 0 ? steps.join('>') : null
}

/**
 * Widget編集の見たまま画面で、見本の設問①②…のうち選んだものだけを見せるCSS。
 * 見本のスクリプトが付け外しする「表示中」のクラスより強くするため !important。見たまま画面の外の style に置く
 */
export function editorStepCss(paths: readonly string[], active: number): string {
  return paths
    .map((path, i) => `[data-widget-preview]>${path}{display:${i === active ? 'block' : 'none'} !important}`)
    .join('')
}
