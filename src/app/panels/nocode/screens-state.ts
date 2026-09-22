/**
 * 「部品を積んで作る」の画面の足し方（2026-09-22・本人の依頼。ノーコードでWidgetを作る④）。
 *
 * - 画面の名前は「画面①」から。空いているいちばん小さい丸数字を使う（本人指定。あとで変えられる）
 * - 画面のidは s1, s2…。今ある中でいちばん大きい番号の次（消した番号は使い回さない＝古い移る先と取り違えない）
 * - どの部品からも移ってこない画面は、見ている人がたどり着けない（画面に知らせを出すのに使う）
 * テストは tests/nocode-screens-state.test.ts。
 */
import { addAt, getAt, removeAt, setAt, type Path } from './form-state.ts'
import { goTargetsIn } from './sample-model.ts'
import { SCREEN_ID } from './templates/builder-blocks.ts'
import { items, str, type ItemData, type TemplateData } from './templates/types.ts'

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

/** その画面へ「画面へ移る」でつながっている部品の数（見本の部品の中のボタン・画像なども数える） */
export function incomingCount(data: TemplateData, screenId: string): number {
  return items(data, 'screens')
    .flatMap((screen) => items(screen, 'blocks'))
    .reduce((count, block) => {
      if (str(block, 'action') === 'screen' && str(block, 'target') === screenId) return count + 1
      return count + goTargetsIn(str(block, 'html')).filter((target) => target === screenId).length
    }, 0)
}

/** 画面の名前（無ければ「画面③」のような番号の名前） */
function nameOf(screen: ItemData, index: number): string {
  const name = str(screen, 'name').trim()
  return name === '' ? screenLabel(index + 1) : name
}

/**
 * 「押したとき」の移る先の候補（本人の依頼「画面2・3・4・5…として簡単に設定」）。
 * その部品がある画面は候補にしない（同じ画面へ移っても何も変わらない）。
 * ただし今の移る先がその画面なら（出す画面で移した等）、選んでいるものが見えるよう「（この画面）」として最後に出す。
 */
export function goChoices(
  data: TemplateData,
  screensKey: string,
  currentScreen: number,
  selected: string | null = null,
): readonly { id: string; label: string }[] {
  const screens = items(data, screensKey).map((screen, index) => ({ id: str(screen, 'id'), label: nameOf(screen, index), index }))
  const others = screens
    .filter((choice) => choice.index !== currentScreen && SCREEN_ID.test(choice.id))
    .map(({ id, label }) => ({ id, label }))
  const own = screens[currentScreen]
  return own !== undefined && selected !== null && own.id === selected ? [...others, { id: own.id, label: `${own.label}（この画面）` }] : others
}

/** 部品の「押したとき」の今の選び: なし・リンク・移る先の画面のid */
export function pressOf(item: ItemData): string {
  const action = str(item, 'action')
  if (action === 'link') return 'link'
  const target = str(item, 'target')
  return action === 'screen' && SCREEN_ID.test(target) ? target : 'none'
}

/** 部品の「押したとき」を選び直した中身（value は なし・リンク・画面のid） */
export function withPress(data: TemplateData, itemPath: Path, value: string): TemplateData {
  if (SCREEN_ID.test(value)) return setAt(setAt(data, [...itemPath, 'action'], 'screen'), [...itemPath, 'target'], value)
  return setAt(data, [...itemPath, 'action'], value === 'link' ? 'link' : 'none')
}

/** いちばん右に足す空の画面（足せなければ null） */
function withNewScreen(data: TemplateData, screensKey: string, max: number): { data: TemplateData; id: string; index: number } | null {
  const screens = items(data, screensKey)
  if (screens.length >= max) return null
  const id = nextScreenId(screens.map((screen) => str(screen, 'id')))
  const added = addAt(data, [screensKey], { id, name: nextScreenName(screens.map((screen) => str(screen, 'name'))), blocks: [] }, max)
  return { data: added, id, index: screens.length }
}

/**
 * 「＋新しい画面」: いちばん右に画面を足し、itemPath の部品の移る先にする。足せなければ null。
 * （見本の部品の中の要素に使うときは、setGo を渡して移る先の書き方を変える）
 */
export function addScreenFor(
  data: TemplateData,
  screensKey: string,
  itemPath: Path,
  max: number,
  setGo: (data: TemplateData, id: string) => TemplateData = (d, id) => withPress(d, itemPath, id),
): { data: TemplateData; id: string } | null {
  const added = withNewScreen(data, screensKey, max)
  return added === null ? null : { data: setGo(added.data, added.id), id: added.id }
}

/**
 * 部品を別の画面へ移す（本人の依頼「その部品を画面②③…に置く」）。移す先の画面のいちばん下に入る。
 * 同じ画面・無い画面・部品がいっぱいの画面へは移さない（元の中身をそのまま返す）。
 */
export function moveBlockToScreen(
  data: TemplateData,
  screensKey: string,
  fromScreen: number,
  blockIndex: number,
  toScreen: number,
  blockMax: number,
): TemplateData {
  if (fromScreen === toScreen) return data
  const block = getAt(data, [screensKey, fromScreen, 'blocks', blockIndex]) as ItemData | undefined
  const target = getAt(data, [screensKey, toScreen]) as ItemData | undefined
  if (block === undefined || target === undefined || items(target, 'blocks').length >= blockMax) return data
  const removed = removeAt(data, [screensKey, fromScreen, 'blocks'], blockIndex, 0)
  return addAt(removed, [screensKey, toScreen, 'blocks'], block, blockMax)
}

/** 出す画面の「＋新しい画面」: いちばん右に画面を足し、その部品を移す。画面がいっぱい・部品が無いときは null */
export function moveBlockToNewScreen(
  data: TemplateData,
  screensKey: string,
  fromScreen: number,
  blockIndex: number,
  max: number,
  blockMax: number,
): { data: TemplateData; index: number } | null {
  if (getAt(data, [screensKey, fromScreen, 'blocks', blockIndex]) === undefined) return null
  const added = withNewScreen(data, screensKey, max)
  if (added === null) return null
  return { data: moveBlockToScreen(added.data, screensKey, fromScreen, blockIndex, added.index, blockMax), index: added.index }
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
