/**
 * 部品の設定の頭の「見た目をコピー」「見た目を貼る」と、貼る窓（2026-10-25 本人「ボタンの色とか大きさとか文字の色とか、
 * 必要だったら画像まで選択をして、全部一括か選択して一括かを貼り付けしたい」）。中身の計算は look-copy.ts。
 *
 * - コピーは、いま選んでいる部品の見た目を覚える（Widget編集を閉じるまで）
 * - 貼るのは同じ種類の部品だけ。窓で「写すもの」（色・大きさ・文字の見た目・形・背景の画像）と「貼る先」（このWidgetの
 *   全部の画面の同じ種類の部品・全部選ぶ）を選ぶ。背景の画像は、はじめは外しておく（必要なときだけ選ぶ）
 */
import { formCard } from '../../dialog.ts'
import { toast } from '../../ui.ts'
import { node } from './form-controls.ts'
import { textButton } from './form-core.ts'
import type { Path } from './form-state.ts'
import { copyLook, pasteLook, sameTypeTargets, type CopiedLook, type LookGroupId } from './look-copy.ts'
import type { BlockType, ItemData, TemplateData } from './templates/types.ts'

export interface LookActionDeps {
  readonly data: () => TemplateData
  readonly replace: (next: TemplateData) => boolean
  readonly refreshAll: () => void
  /** この Widget編集（コピーした部品が同じWidgetの中か見分ける） */
  readonly formId: symbol
}

/** 写した見た目（Widget編集を開いている間だけ覚える） */
let clipboard: { readonly look: CopiedLook; readonly source: Path; readonly formId: symbol; readonly label: string } | null = null

/** 部品の設定の頭に置くボタン（コピー・貼る） */
export function lookActions(deps: LookActionDeps, type: BlockType, itemPath: Path, item: () => ItemData): HTMLElement {
  const row = node('div', 'ncf-look-actions')
  const paste = textButton('見た目を貼る', 'ncf-btn ncf-btn--quiet', () => openPaste(deps, type, itemPath), clipboard?.look.type === type.type)
  paste.title = '写した見た目を、このWidgetの同じ種類の部品に貼ります'
  const copy = textButton('見た目をコピー', 'ncf-btn ncf-btn--quiet', () => {
    clipboard = { look: copyLook(type.fields, item()), source: itemPath, formId: deps.formId, label: type.label }
    paste.disabled = false
    toast(`${type.label}の見た目をコピーしました。貼りたい部品を選んで「見た目を貼る」を押してください`)
  })
  copy.title = 'この部品の色・大きさ・文字の見た目などを写します（文字と「押したとき」は写しません）'
  row.append(copy, paste)
  return row
}

function checkbox(label: string, checked: boolean): { el: HTMLElement; input: HTMLInputElement } {
  const el = node('label', 'ncf-check')
  const input = node('input')
  input.type = 'checkbox'
  input.checked = checked
  el.append(input, document.createTextNode(label))
  return { el, input }
}

/** 貼る窓（写すもの・貼る先を選んで、まとめて貼る） */
function openPaste(deps: LookActionDeps, type: BlockType, current: Path): void {
  const copied = clipboard
  if (copied === null || copied.look.type !== type.type) return
  const body = node('div', 'ncf-look-paste')

  body.append(node('p', 'ncf-label', '写すもの'))
  const groups = copied.look.groups.map((group) => ({ id: group.id, ...checkbox(group.label, group.id !== 'background') }))
  const groupBox = node('div', 'ncf-check-list')
  groupBox.append(...groups.map((g) => g.el))
  body.append(groupBox, node('p', 'ncf-note', '文字そのものと「押したとき」（移る先・リンク）は写しません'))

  const source = copied.formId === deps.formId ? copied.source : null
  const targets = sameTypeTargets(deps.data(), type.type, source).map((target) => {
    const box = checkbox(target.label, JSON.stringify(target.path) === JSON.stringify(current))
    box.el.dataset['lookTarget'] = 'true'
    return { path: target.path, ...box }
  })
  const head = node('div', 'ncf-look-paste__head')
  head.append(
    node('p', 'ncf-label', `貼る先（このWidgetの${type.label}）`),
    textButton('全部選ぶ', 'ncf-btn ncf-btn--quiet', () => {
      for (const t of targets) t.input.checked = true
    }),
    textButton('全部外す', 'ncf-btn ncf-btn--quiet', () => {
      for (const t of targets) t.input.checked = false
    }),
  )
  const targetBox = node('div', 'ncf-check-list ncf-check-list--targets')
  targetBox.append(...targets.map((t) => t.el))
  body.append(head, targets.length === 0 ? node('p', 'ncf-note', `ほかに${type.label}がありません`) : targetBox)

  void formCard({
    title: `${copied.label}の見た目を貼る`,
    body,
    submitLabel: '貼り付ける',
    onSubmit: () => {
      const chosen = new Set<LookGroupId>(groups.filter((g) => g.input.checked).map((g) => g.id))
      const paths = targets.filter((t) => t.input.checked).map((t) => t.path)
      if (chosen.size === 0) return Promise.resolve('写すものを1つ以上選んでください')
      if (paths.length === 0) return Promise.resolve('貼る先を1つ以上選んでください')
      if (deps.replace(pasteLook(deps.data(), copied.look, paths, chosen))) deps.refreshAll()
      toast(`${paths.length}個の${type.label}に見た目を貼りました（「戻す」で戻せます）`)
      return Promise.resolve(null)
    },
  })
}
