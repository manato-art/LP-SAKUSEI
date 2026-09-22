/**
 * 「型から作る」の入力の書き換え（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * 入力のたびに新しい中身を作る（元の中身は変えない）。並びは型が決めた数（最小・最大）を超えない。
 * 変わらないときは元の中身をそのまま返す（画面の描き直しを省ける）。テストは tests/nocode-form-state.test.ts。
 */
import { items, type ItemData, type TemplateData } from './templates/types.ts'

type Scalar = string | boolean | number

export function setField(data: TemplateData, key: string, value: Scalar): TemplateData {
  return { ...data, [key]: value }
}

export function setItemField(data: TemplateData, listKey: string, index: number, key: string, value: Scalar): TemplateData {
  const list = items(data, listKey)
  if (list[index] === undefined) return data
  return { ...data, [listKey]: list.map((item, i) => (i === index ? { ...item, [key]: value } : item)) }
}

export function addItem(data: TemplateData, listKey: string, item: ItemData, max: number): TemplateData {
  const list = items(data, listKey)
  if (list.length >= max) return data
  return { ...data, [listKey]: [...list, item] }
}

export function removeItem(data: TemplateData, listKey: string, index: number, min: number): TemplateData {
  const list = items(data, listKey)
  if (list.length <= min || list[index] === undefined) return data
  return { ...data, [listKey]: list.filter((_, i) => i !== index) }
}

export function moveItem(data: TemplateData, listKey: string, index: number, direction: -1 | 1): TemplateData {
  const list = items(data, listKey)
  const target = index + direction
  const a = list[index]
  const b = list[target]
  if (a === undefined || b === undefined) return data
  return { ...data, [listKey]: list.map((item, i) => (i === index ? b : i === target ? a : item)) }
}

/** 比較表の記号ボタン: 頭の記号だけ差し替え、後ろの文字（「980円」など）は残す */
export function applySymbol(value: string, symbol: string, symbols: readonly string[]): string {
  const trimmed = value.trim()
  const first = Array.from(trimmed)[0] ?? ''
  const rest = symbols.includes(first) ? trimmed.slice(first.length).trim() : trimmed
  return rest === '' ? symbol : `${symbol} ${rest}`
}
