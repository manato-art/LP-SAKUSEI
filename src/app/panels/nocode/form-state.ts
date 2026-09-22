/**
 * 「型から作る」「部品を積んで作る」の入力の書き換え（2026-09-22・ノーコードでWidgetを作る③④）。
 *
 * 入力のたびに新しい中身を作る（元の中身は変えない）。値の場所は道のり（path）で指す:
 *   ['title'] / ['items', 1, 'q'] / ['screens', 0, 'blocks', 2, 'label']（画面の中の部品）
 * 並びは型が決めた数（最小・最大）を超えない。変わらないときは元の中身をそのまま返す（描き直しを省ける）。
 * テストは tests/nocode-form-state.test.ts。
 */
import type { ItemData, ItemValue, TemplateData } from './templates/types.ts'

export type Path = readonly (string | number)[]
/** 道のりの途中にあるもの（値・1件の中身・並び） */
type Tree = ItemValue | ItemData

function isList(value: unknown): value is readonly ItemData[] {
  return Array.isArray(value)
}

/** path の値（無ければ undefined） */
export function getAt(data: TemplateData, path: Path): unknown {
  let current: unknown = data
  for (const step of path) {
    if (typeof step === 'number') {
      if (!isList(current)) return undefined
      current = current[step]
    } else {
      if (current === null || typeof current !== 'object' || isList(current)) return undefined
      current = (current as ItemData)[step]
    }
  }
  return current
}

/** path の値を変えた新しい中身。途中は作り直し、関係ない枝はそのまま使う。無い場所なら元のまま */
function updateAt(node: Tree, path: Path, update: (value: unknown) => Tree | undefined): Tree | undefined {
  const [step, ...rest] = path
  if (step === undefined) return update(node)
  if (typeof step === 'number') {
    if (!isList(node) || node[step] === undefined) return undefined
    const child = node[step] as ItemData
    const next = rest.length === 0 ? update(child) : updateAt(child, rest, update)
    if (next === undefined) return undefined
    return node.map((item, i) => (i === step ? (next as ItemData) : item))
  }
  if (typeof node !== 'object' || isList(node)) return undefined
  const record = node as ItemData
  if (rest.length === 0) {
    const next = update(record[step])
    return next === undefined ? undefined : { ...record, [step]: next as ItemValue }
  }
  const child = record[step]
  if (child === undefined) return undefined
  const next = updateAt(child, rest, update)
  return next === undefined ? undefined : { ...record, [step]: next as ItemValue }
}

export function setAt(data: TemplateData, path: Path, value: Tree): TemplateData {
  return (updateAt(data, path, () => value) as TemplateData | undefined) ?? data
}

/** path の並びを作り直す（変わらなければ元の中身） */
function updateList(data: TemplateData, listPath: Path, change: (list: readonly ItemData[]) => readonly ItemData[] | null): TemplateData {
  const current = getAt(data, listPath)
  const list = isList(current) ? current : []
  const next = change(list)
  return next === null ? data : setAt(data, listPath, next)
}

export function addAt(data: TemplateData, listPath: Path, item: ItemData, max: number): TemplateData {
  return updateList(data, listPath, (list) => (list.length >= max ? null : [...list, item]))
}

export function removeAt(data: TemplateData, listPath: Path, index: number, min: number): TemplateData {
  return updateList(data, listPath, (list) =>
    list.length <= min || list[index] === undefined ? null : list.filter((_, i) => i !== index),
  )
}

export function moveAt(data: TemplateData, listPath: Path, index: number, direction: -1 | 1): TemplateData {
  return updateList(data, listPath, (list) => {
    const target = index + direction
    const a = list[index]
    const b = list[target]
    if (a === undefined || b === undefined) return null
    return list.map((item, i) => (i === index ? b : i === target ? a : item))
  })
}

/** すぐ下に同じ中身を入れる。copy で少し変えられる（画面を複製したら別のid・名前にする） */
export function duplicateAt(
  data: TemplateData,
  listPath: Path,
  index: number,
  max: number,
  copy: (item: ItemData) => ItemData = (item) => item,
): TemplateData {
  return updateList(data, listPath, (list) => {
    const original = list[index]
    if (original === undefined || list.length >= max) return null
    return [...list.slice(0, index + 1), copy(original), ...list.slice(index + 1)]
  })
}

/** 比較表の記号ボタン: 頭の記号だけ差し替え、後ろの文字（「980円」など）は残す */
export function applySymbol(value: string, symbol: string, symbols: readonly string[]): string {
  const trimmed = value.trim()
  const first = Array.from(trimmed)[0] ?? ''
  const rest = symbols.includes(first) ? trimmed.slice(first.length).trim() : trimmed
  return rest === '' ? symbol : `${symbol} ${rest}`
}
