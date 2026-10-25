/**
 * 部品の見た目のコピーと貼り付け（2026-10-25 本人「ボタンの色とかボタンの大きさとか、その中に入っている文字の色とか
 * 必要だったら画像まで選択をして、全部一括か選択して一括かを貼り付けしたい」）。
 *
 * 本人の選択: 範囲＝このWidgetの中（全部の画面）／貼る先＝一覧にチェック（全部も）／写すもの＝貼るときに毎回選ぶ／
 * 部品＝同じ種類の部品なら何でも。
 *
 * 部品の型の入力（fields）を「まとまり」に分けて写す。文字そのもの（見出し・ボタンの文字・画像の中身など）と
 * 押したとき（移る先・リンク）は写さない。写し元で決めていない値（自動・既定）は、貼った先からも外す（同じ見た目にする）。
 * DOM を使わない（テストは tests/nocode-look-copy.test.ts）。
 */
import { blockSnippet } from './builder-data.ts'
import type { Path } from './form-state.ts'
import { items, str, type Field, type ItemData, type ItemValue, type TemplateData } from './templates/types.ts'

export type LookGroupId = 'color' | 'size' | 'text' | 'shape' | 'background'

export interface LookGroup {
  readonly id: LookGroupId
  readonly label: string
  readonly keys: readonly string[]
}

/** まとまりの並びと名前（貼り付けの窓に出す順） */
const GROUPS: readonly { readonly id: LookGroupId; readonly label: string }[] = [
  { id: 'color', label: '色' },
  { id: 'size', label: '大きさ・置く位置' },
  { id: 'text', label: '文字の見た目' },
  { id: 'shape', label: '形・見た目' },
  { id: 'background', label: '背景の画像' },
]

/** 入力1つが入るまとまり（写さない入力は null） */
function groupOf(field: Field): LookGroupId | null {
  if (field.kind === 'goto' || field.section === 'press') return null
  if (field.section === 'layout') return 'size'
  if (field.section === 'text') return 'text'
  if (field.section === 'background') return 'background'
  if (field.kind === 'color') return 'color'
  if (field.kind === 'select' || field.kind === 'number' || field.kind === 'toggle') return 'shape'
  // 文字・リンク・画像や動画の中身・並び・見本の中身などは中身（写さない）
  return null
}

/** 部品の型で写せるまとまり（入力が1つも無いまとまりは出さない・同じ名前の入力は1つにまとめる） */
export function lookGroupsOf(fields: readonly Field[]): readonly LookGroup[] {
  return GROUPS.map(({ id, label }) => {
    const keys = fields.filter((field) => groupOf(field) === id).map((field) => field.key)
    return { id, label, keys: [...new Set(keys)] }
  }).filter((group) => group.keys.length > 0)
}

/** 写した見た目（部品の種類と、まとまりごとの値。値が無い＝決めていない） */
export interface CopiedLook {
  readonly type: string
  readonly groups: readonly LookGroup[]
  readonly values: Readonly<Record<string, ItemValue | undefined>>
}

export function copyLook(fields: readonly Field[], item: ItemData): CopiedLook {
  const groups = lookGroupsOf(fields)
  const values: Record<string, ItemValue | undefined> = {}
  for (const key of groups.flatMap((group) => group.keys)) values[key] = item[key]
  return { type: str(item, 'type'), groups, values }
}

/** 部品1つに、選んだまとまりの値を写した新しい部品 */
function withLook(block: ItemData, look: CopiedLook, chosen: ReadonlySet<LookGroupId>): ItemData {
  const next: Record<string, ItemValue> = { ...block }
  for (const group of look.groups) {
    if (!chosen.has(group.id)) continue
    for (const key of group.keys) {
      const value = look.values[key]
      if (value === undefined) delete next[key]
      else next[key] = value
    }
  }
  return next
}

/** 選んだ部品（[画面の欄, 画面, 'blocks', 部品]）に見た目を貼った新しい中身。同じ種類でない部品は触らない */
export function pasteLook(data: TemplateData, look: CopiedLook, targets: readonly Path[], chosen: ReadonlySet<LookGroupId>): TemplateData {
  const wanted = new Set(targets.map((path) => JSON.stringify(path)))
  const screensKey = 'screens'
  return {
    ...data,
    [screensKey]: items(data, screensKey).map((screen, screenIndex) => ({
      ...screen,
      blocks: items(screen, 'blocks').map((block, blockIndex) =>
        wanted.has(JSON.stringify([screensKey, screenIndex, 'blocks', blockIndex])) && str(block, 'type') === look.type
          ? withLook(block, look, chosen)
          : block,
      ),
    })),
  }
}

export interface LookTarget {
  readonly path: Path
  /** 「Q1：はい」（画面の名前：部品の文字） */
  readonly label: string
}

/** このWidgetの中の同じ種類の部品（全部の画面・上から。写し元は除く） */
export function sameTypeTargets(data: TemplateData, type: string, source: Path | null): readonly LookTarget[] {
  const sourceKey = source === null ? '' : JSON.stringify(source)
  return items(data, 'screens').flatMap((screen, screenIndex) =>
    items(screen, 'blocks').flatMap((block, blockIndex) => {
      const path: Path = ['screens', screenIndex, 'blocks', blockIndex]
      if (str(block, 'type') !== type || JSON.stringify(path) === sourceKey) return []
      const name = str(screen, 'name').trim() || `画面${screenIndex + 1}`
      const snippet = blockSnippet(block) || `${blockIndex + 1}番目`
      return [{ path, label: `${name}：${snippet}` }]
    }),
  )
}
