/**
 * 並びの入力欄（2026-09-24・template-form.ts から分けた）。
 *  - itemHead: 1件ごとの頭（名前・複製・上へ・下へ・消す）。部品の並び（block-list.ts）でも使う
 *  - listFieldEl: 並び（よくある質問の1問など）。型の部品の中の並びでも使う
 */
import { node, type ScalarField } from './form-controls.ts'
import { addAt, duplicateAt, getAt, moveAt, removeAt, type Path } from './form-state.ts'
import { iconButton, textButton, type FormCore } from './form-core.ts'
import type { Field, ItemData, TemplateData } from './templates/types.ts'

export type ListField = Extract<Field, { kind: 'list' }>
export type HeadKind = 'copy' | 'up' | 'down' | 'remove'
/** 並びの頭の操作（操作のあとの中身と、選び直す番号。できないときは null） */
export interface HeadOps {
  readonly copy: () => { data: TemplateData; index: number } | null
  readonly up: () => { data: TemplateData; index: number } | null
  readonly down: () => { data: TemplateData; index: number } | null
  readonly remove: () => TemplateData
}

const ICON_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 15 12 9 18 15"/></svg>'
const ICON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>'

/** 1件ごとの頭（名前・複製・上へ・下へ・消す）。ops があれば並びの変え方はそれに任せる（部品の並び＝移行先ごと動かす） */
export function itemHead(
  core: Pick<FormCore, 'data' | 'restructure'>,
  name: HTMLElement,
  listPath: Path,
  index: number,
  count: number,
  limits: { min: number; max: number; noun: string },
  onRestructured?: (next: TemplateData, kind: HeadKind, selectIndex?: number) => void,
  ops?: HeadOps,
): HTMLElement {
  const head = node('div', 'ncf-item__head')
  const canCopy = ops !== undefined ? ops.copy() !== null : count < limits.max
  const canRemove = count > limits.min
  const apply = (next: TemplateData, kind: HeadKind, selectIndex?: number): void => {
    if (onRestructured !== undefined) onRestructured(next, kind, selectIndex)
    else core.restructure(next)
  }
  const run = (kind: 'copy' | 'up' | 'down', fallback: () => TemplateData) => (): void => {
    const done = ops?.[kind]()
    if (ops === undefined) apply(fallback(), kind)
    else if (done !== null && done !== undefined) apply(done.data, kind, done.index)
  }
  const copy = textButton('複製', 'ncf-icon-btn ncf-item__copy', run('copy', () => duplicateAt(core.data(), listPath, index, limits.max)), canCopy)
  copy.title = canCopy ? `この${limits.noun}をすぐ下に複製` : `${limits.max}つまでです`
  const removeNext = (): TemplateData => (ops !== undefined ? ops.remove() : removeAt(core.data(), listPath, index, limits.min))
  const remove = textButton('消す', 'ncf-icon-btn ncf-item__remove', () => apply(removeNext(), 'remove'), canRemove)
  remove.title = canRemove ? `この${limits.noun}を消す` : `${limits.min}つより少なくはできません`
  head.append(
    name,
    copy,
    iconButton(ICON_UP, '上へ', run('up', () => moveAt(core.data(), listPath, index, -1)), ops !== undefined ? ops.up() !== null : index > 0),
    iconButton(ICON_DOWN, '下へ', run('down', () => moveAt(core.data(), listPath, index, 1)), ops !== undefined ? ops.down() !== null : index < count - 1),
    remove,
  )
  return head
}

export interface ListFieldDeps extends FormCore {
  /** 1つの入力欄（template-form.ts の fieldEl）。itemPath は並びの中の1件 */
  readonly fieldEl: (field: ScalarField, path: Path, itemPath?: Path) => HTMLElement
  /** 並びごとの目印（足したあと、その1件に目を移すのに使う。組み立て直すたびに数え直す） */
  readonly nextListKey: () => string
}

/** 並び（よくある質問の1問など）。型の部品の中の並びでも使う（basePath＝その部品の場所） */
export function listFieldEl(deps: ListFieldDeps, field: ListField, basePath: Path = []): HTMLElement {
  const wrap = node('div', 'ncf-field')
  const listKey = deps.nextListKey()
  wrap.dataset['ncfList'] = listKey
  const listPath: Path = [...basePath, field.key]
  const list = (getAt(deps.data(), listPath) as readonly ItemData[] | undefined) ?? []
  const head = node('div', 'ncf-listhead')
  head.append(node('span', 'ncf-label', field.label), node('span', 'ncf-count', `${list.length} / ${field.max}`))
  const box = node('div', 'ncf-list')
  list.forEach((_, index) => {
    const item = node('div', 'ncf-item')
    const name = node('span', 'ncf-item__name', `${field.itemLabel} ${index + 1}`)
    item.append(itemHead(deps, name, listPath, index, list.length, { min: field.min, max: field.max, noun: field.itemLabel }))
    for (const sub of field.fields) {
      // 並びの中の並びは作らない（見本・押したときは「部品を積んで作る」の部品の中だけ）
      if (sub.kind === 'list' || sub.kind === 'screens' || sub.kind === 'sample' || sub.kind === 'goto') continue
      item.append(deps.fieldEl(sub, [...listPath, index, sub.key], [...listPath, index]))
    }
    box.append(item)
  })
  const full = list.length >= field.max
  const add = textButton(
    full ? `${field.itemLabel}は${field.max}つまでです` : `＋ ${field.itemLabel}を足す`,
    'ncf-add',
    () => deps.restructure(addAt(deps.data(), listPath, field.newItem(), field.max), `[data-ncf-list="${listKey}"] .ncf-item:last-of-type`),
    !full,
  )
  wrap.append(head, box, add)
  return wrap
}
