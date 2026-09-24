/**
 * 部品1つの設定（2026-09-24・template-form.ts から分けた）。
 * 部品の型の fields を段に分ける: レイアウト＝出す画面・幅・置く位置／中身／押したとき＝移る先・リンク・LPの上で。
 *  - inspector: 右の設定（左右に分けたとき）。選んだ部品の名前と、畳める段。段の開き具合は組み立て直しても残す（ここで持つ）
 *  - body: 並びの中で広げるとき（左右に分けないとき）。段に分けずに上から並べる
 */
import { blockSnippet } from './builder-data.ts'
import { node, type ScalarField } from './form-controls.ts'
import { getAt, type Path } from './form-state.ts'
import { foldable, type FormCore } from './form-core.ts'
import { isHotspot } from './hotspot-model.ts'
import type { ListField } from './list-field.ts'
import type { SampleFields } from './sample-field.ts'
import type { ScreenSettings } from './screen-settings.ts'
import type { BlockType, ItemData, ScreensField } from './templates/types.ts'

export interface BlockInspectorDeps extends Pick<FormCore, 'data' | 'onRefresh'> {
  /** 1つの入力欄（template-form.ts の fieldEl）。itemPath は部品の場所 */
  readonly fieldEl: (field: ScalarField, path: Path, itemPath?: Path) => HTMLElement
  /** 型の部品の中の並び（よくある質問の1問・口コミの1件など） */
  readonly listEl: (field: ListField, basePath: Path) => HTMLElement
  readonly samples: Pick<SampleFields, 'el'>
  readonly screen: Pick<ScreenSettings, 'place' | 'press' | 'goto'>
}

export interface BlockInspector {
  /** 部品1つの中身（並びの中で広げるとき） */
  readonly body: (field: ScreensField, screenIndex: number, index: number, type: BlockType) => HTMLElement
  /** 右の設定: 選んだ部品の名前と、段（部品が無い・種類が分からないときは null） */
  readonly inspector: (field: ScreensField, screenIndex: number, index: number) => HTMLElement | null
}

export function createBlockInspector(deps: BlockInspectorDeps): BlockInspector {
  /** 右の部品の設定の段（レイアウト・中身・押したとき）の開き具合。既定は開く */
  const sectionOpen = new Map<string, boolean>()

  /** 部品1つの中身を段ごとに（レイアウト＝出す画面・幅・置く位置／中身／押したとき＝移る先・リンク） */
  const blockParts = (
    field: ScreensField,
    screenIndex: number,
    index: number,
    type: BlockType,
  ): { layout: HTMLElement[]; content: HTMLElement[]; press: HTMLElement[] } => {
    const itemPath: Path = [field.key, screenIndex, 'blocks', index]
    // 移行先は被せた部品と同じ画面にしか置けない（「この部品を出す画面」は出さない。部品を移すと一緒に移る）
    const block = (getAt(deps.data(), [field.key, screenIndex, 'blocks', index]) as ItemData | undefined) ?? {}
    const parts = {
      layout: isHotspot(block) ? [] : [deps.screen.place(field, screenIndex, index, type.label)],
      content: [] as HTMLElement[],
      press: [] as HTMLElement[],
    }
    for (const sub of type.fields) {
      if (sub.kind === 'screens') continue
      const el =
        sub.kind === 'sample'
          ? deps.samples.el(field, screenIndex, index, itemPath)
          : sub.kind === 'goto'
            ? deps.screen.press(field, screenIndex, itemPath, sub.label)
            : // 型の部品の中の並び（よくある質問の1問・口コミの1件など）も、そのまま足したり消したりできる
              sub.kind === 'list'
              ? deps.listEl(sub, itemPath)
              : deps.fieldEl(sub, [...itemPath, sub.key], itemPath)
      ;(sub.section === 'layout' ? parts.layout : sub.section === 'press' ? parts.press : parts.content).push(el)
    }
    if (type.fields.some((f) => f.kind === 'goto')) parts.press.push(deps.screen.goto(itemPath))
    return parts
  }

  const body = (field: ScreensField, screenIndex: number, index: number, type: BlockType): HTMLElement => {
    const el = node('div', 'ncf-item__body')
    const parts = blockParts(field, screenIndex, index, type)
    el.append(...parts.layout, ...parts.content, ...parts.press)
    return el
  }

  const inspector = (field: ScreensField, screenIndex: number, index: number): HTMLElement | null => {
    const itemPath: Path = [field.key, screenIndex, 'blocks', index]
    const block = getAt(deps.data(), itemPath) as ItemData | undefined
    const type: BlockType | undefined = field.types.find((t) => t.type === block?.['type'])
    if (block === undefined || type === undefined) return null
    const wrap = node('div', 'ncf-inspector')
    const head = node('div', 'ncf-inspector__head')
    const icon = node('span', 'ncf-inspector__icon')
    icon.innerHTML = type.icon
    const snippet = node('span', 'ncf-inspector__snippet')
    deps.onRefresh(() => {
      snippet.textContent = blockSnippet((getAt(deps.data(), itemPath) as ItemData | undefined) ?? {})
    })
    head.append(icon, node('span', 'ncf-inspector__name', type.label), snippet)
    wrap.append(head)
    const parts = blockParts(field, screenIndex, index, type)
    const section = (key: string, title: string, els: readonly HTMLElement[]): void => {
      if (els.length === 0) return
      const fold = foldable(
        title,
        () => sectionOpen.get(key) ?? true,
        (open) => {
          sectionOpen.set(key, open)
        },
        els,
      )
      fold.classList.add('ncf-fold--section')
      wrap.append(fold)
    }
    section('layout', 'レイアウト', parts.layout)
    section('content', '中身', parts.content)
    section('press', '押したとき', parts.press)
    return wrap
  }

  return { body, inspector }
}
