/**
 * 画面の中の部品の並び（2026-09-24・template-form.ts から分けた）。
 * 1件ごとに部品の名前と複製・上へ・下へ・消す。頭を押すとその部品だけが広がる（見たまま画面で部品を押したときも同じ）。
 *  - 部品は被せた移行先ごと動かす・複製する・消す（hotspot-model.ts）。移行先は被せた部品の下に一段下げて並べる
 *  - 頭をつかんで別の部品の上半分/下半分に落とすと並べ替え。行で Backspace・Delete を押すと消す
 *  - 左右に分けたときは頭だけ（中身は右の設定）で、いちばん下は「Widget全体の設定」。分けないときは
 *    選んだ部品の中身をその場で広げ、いちばん下に種類ごとの「足す」（block-adder.ts）
 */
import { confirmCard } from '../../dialog.ts'
import { blockSnippet } from './builder-data.ts'
import { node } from './form-controls.ts'
import { getAt, setAt, type Path } from './form-state.ts'
import { screenNameAt, textButton, type FormCore } from './form-core.ts'
import { isBlank } from './block-adder.ts'
import { duplicateGroup, groupStep, isHotspot, moveGroupBefore, removeGroup } from './hotspot-model.ts'
import { itemHead, type HeadOps } from './list-field.ts'
import { LP_PRESS_CHIPS } from './lp-press-rows.ts'
import { items, str, type BlockType, type ItemData, type ScreensField, type TemplateData } from './templates/types.ts'

export interface BlockListDeps extends Pick<FormCore, 'data' | 'replace' | 'restructure' | 'onRefresh'> {
  /** 部品の並び・部品を足す を左の列に出す（右は選んだ部品の設定だけ） */
  readonly isSplit: boolean
  readonly selectedBlock: () => number | null
  /** 部品を選び直して組み立て直す（画面はそのまま）。null は選ぶのをやめる */
  readonly reselect: (block: number | null) => void
  /** 画面を開く（block はその画面で選んでおく部品） */
  readonly openScreen: (index: number, block?: number | null) => void
  /** 部品を消す（被せた移行先も一緒）。消したら true */
  readonly removePart: (screenIndex: number, blockIndex: number) => boolean
  /** 白紙に戻す（画面①だけ・部品なし） */
  readonly resetToBlank: (field: ScreensField) => void
  /** 並びの中で広げる部品の中身（左右に分けないとき・block-inspector.ts） */
  readonly blockBody: (field: ScreensField, screenIndex: number, index: number, type: BlockType) => HTMLElement
  /** いちばん下の種類ごとの「足す」（左右に分けないとき・block-adder.ts）。count はその画面の部品の数 */
  readonly adder: (field: ScreensField, screenIndex: number, count: number) => HTMLElement
}

/** 部品の並びの変え方（被せた移行先ごと動かす・複製する・消す＝hotspot-model.ts） */
function blockOps(data: () => TemplateData, listPath: Path, index: number, max: number): HeadOps {
  const list = (): readonly ItemData[] => (getAt(data(), listPath) as readonly ItemData[] | undefined) ?? []
  const put = (moved: { list: readonly ItemData[]; index: number } | null): { data: TemplateData; index: number } | null =>
    moved === null ? null : { data: setAt(data(), listPath, moved.list), index: moved.index }
  return {
    copy: () => put(duplicateGroup(list(), index, max)),
    up: () => put(groupStep(list(), index, -1)),
    down: () => put(groupStep(list(), index, 1)),
    remove: () => setAt(data(), listPath, removeGroup(list(), index)),
  }
}

/** 並びに出す移行先の移る先（「→ 画面②」「→ https://…」） */
function hotspotDestination(data: TemplateData, field: ScreensField, block: ItemData): string {
  const action = str(block, 'action')
  if (action === 'link') return str(block, 'url').trim() === '' ? '開くページが未入力' : `→ ${str(block, 'url').trim()}`
  const lp = LP_PRESS_CHIPS.find((chip) => chip.value === action)
  if (lp !== undefined && action !== 'modal') return `→ ${lp.label}`
  if (action !== 'screen' && action !== 'modal') return '移る先が未設定'
  const screens = items(data, field.key)
  const at = screens.findIndex((screen) => str(screen, 'id') === str(block, 'target'))
  return at < 0 ? '移る先の画面が未選択' : `→ ${screenNameAt(screens[at], at)}`
}

export function blockListEl(deps: BlockListDeps, field: ScreensField, screenIndex: number): HTMLElement {
  const wrap = node('div', 'ncf-field')
  const listPath: Path = [field.key, screenIndex, 'blocks']
  wrap.dataset['ncfList'] = 'blocks'
  const list = (getAt(deps.data(), listPath) as readonly ItemData[] | undefined) ?? []
  const head = node('div', 'ncf-listhead')
  head.append(
    node('span', 'ncf-label', deps.isSplit ? '並び' : '部品（上から順に並びます）'),
    node('span', 'ncf-count', `${list.length} / ${field.blockMax}`),
  )
  // 全部消して最初から（白紙に戻すと「何から作りますか？」がまた出る）
  if (!isBlank(deps.data(), field)) {
    const reset = textButton('全部消して作り直す', 'ncf-reset', () => {
      void confirmCard({
        title: '全部消して作り直しますか？',
        message: 'すべての画面と部品を消して、白紙に戻します。Widget全体の設定（背景・余白）はそのままです。',
        submitLabel: '全部消す',
        danger: true,
      }).then((ok) => {
        if (ok) deps.resetToBlank(field)
      })
    })
    head.append(reset)
  }
  const box = node('div', 'ncf-list')
  /** つかんで並べ替え（頭をドラッグ → 別の部品の上半分/下半分に落とす） */
  let dragFrom: number | null = null
  const clearDropMarks = (): void => {
    for (const el of box.querySelectorAll('.ncf-item--drop-before,.ncf-item--drop-after')) {
      el.classList.remove('ncf-item--drop-before', 'ncf-item--drop-after')
    }
  }
  list.forEach((block, index) => {
    const type: BlockType | undefined = field.types.find((t) => t.type === block['type'])
    if (type === undefined) return
    const selected = index === deps.selectedBlock()
    const itemEl = node('div', selected ? 'ncf-item ncf-item--selected' : 'ncf-item')
    itemEl.dataset['ncfBlock'] = String(index)
    // 移行先は、被せた部品（すぐ上）の下に一段下げて並べる
    if (isHotspot(block)) itemEl.classList.add('ncf-item--hotspot')
    itemEl.addEventListener('dragover', (event) => {
      if (dragFrom === null || dragFrom === index) return
      event.preventDefault()
      clearDropMarks()
      const rect = itemEl.getBoundingClientRect()
      itemEl.classList.add(event.clientY > rect.top + rect.height / 2 ? 'ncf-item--drop-after' : 'ncf-item--drop-before')
    })
    itemEl.addEventListener('dragleave', () => itemEl.classList.remove('ncf-item--drop-before', 'ncf-item--drop-after'))
    itemEl.addEventListener('drop', (event) => {
      if (dragFrom === null) return
      event.preventDefault()
      const after = itemEl.classList.contains('ncf-item--drop-after')
      clearDropMarks()
      const from = dragFrom
      dragFrom = null
      // 部品は被せた移行先ごと動かす（ほかの部品と移行先の間には入らない）
      const moved = moveGroupBefore(list, from, index + (after ? 1 : 0))
      if (moved === null || !deps.replace(setAt(deps.data(), listPath, moved.list))) return
      deps.reselect(moved.index)
    })
    const name = node('span', 'ncf-item__name')
    const icon = node('span', 'ncf-item__icon')
    icon.innerHTML = type.icon
    const snippet = node('span', 'ncf-item__snippet')
    deps.onRefresh(() => {
      const current = (getAt(deps.data(), [...listPath, index]) as ItemData | undefined) ?? {}
      snippet.textContent = isHotspot(current) ? hotspotDestination(deps.data(), field, current) : blockSnippet(current)
    })
    name.append(icon, node('span', '', type.label), snippet)
    // 複製・上下・消す のあとも、同じ部品を選んだままにする（消したら選ぶのをやめる）
    const limits = { min: 0, max: field.blockMax, noun: type.label }
    const headEl = itemHead(deps, name, listPath, index, list.length, limits, (next, kind, selectIndex) => {
      if (!deps.replace(next)) return
      deps.reselect(kind === 'remove' ? null : (selectIndex ?? index))
    }, blockOps(deps.data, listPath, index, field.blockMax))
    headEl.setAttribute('role', 'button')
    headEl.tabIndex = 0
    headEl.setAttribute('aria-expanded', String(selected))
    headEl.title = selected ? '押すと畳む。つかんで動かすと並べ替え' : '押すと、この部品を直す欄が開きます。つかんで動かすと並べ替え'
    headEl.draggable = true
    headEl.addEventListener('dragstart', (event) => {
      dragFrom = index
      const transfer = event.dataTransfer
      if (transfer !== null) {
        transfer.setData('text/plain', String(index))
        transfer.effectAllowed = 'move'
      }
      itemEl.classList.add('ncf-item--dragging')
    })
    headEl.addEventListener('dragend', () => {
      dragFrom = null
      itemEl.classList.remove('ncf-item--dragging')
      clearDropMarks()
    })
    const toggle = (): void => deps.openScreen(screenIndex, selected ? null : index)
    headEl.addEventListener('click', toggle)
    headEl.addEventListener('keydown', (event) => {
      // 行で Backspace・Delete を押したら、その部品を消す（2026-09-24・本人「バックスペース・デリートで消したい」）
      if ((event.key === 'Backspace' || event.key === 'Delete') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        deps.removePart(screenIndex, index)
        return
      }
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      toggle()
    })
    itemEl.append(headEl)
    // 左右に分けたときは、中身は右の設定に出す（並びは頭だけ）
    if (selected && !deps.isSplit) itemEl.append(deps.blockBody(field, screenIndex, index, type))
    box.append(itemEl)
  })
  if (deps.isSplit) {
    // 部品を選ぶのをやめる＝右に画面とWidget全体の設定を出す
    const whole = textButton('Widget全体の設定', 'ncf-parts__whole', () => deps.openScreen(screenIndex, null))
    whole.setAttribute('aria-pressed', String(deps.selectedBlock() === null))
    wrap.append(head, box, whole)
    return wrap
  }
  wrap.append(head, box, deps.adder(field, screenIndex, list.length))
  return wrap
}
