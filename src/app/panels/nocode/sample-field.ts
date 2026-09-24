/**
 * 見本の部品の入力欄（2026-09-24・template-form.ts から分けた。中身は form-sample.ts の sampleEditor）。
 * 見本を選ぶ・中身を直す・設問①②…を切り替える・中の画像やボタンの押したとき・カード・コード。
 *  - いま直している設問は、組み立て直しても残す（ここで持つ）
 *  - 中の要素を選ぶ入口は、組み立て直すたびに作り直す（resetApis）
 *  - 見たまま画面で見本の中の要素を押したとき、部品が開いていなければ、組み立て直したあとにその要素を選ぶ（setPending）
 */
import type { Scalar } from './form-controls.ts'
import { getAt, setAt, type Path } from './form-state.ts'
import { sampleEditor } from './form-sample.ts'
import type { FormCore } from './form-core.ts'
import { addScreenFor, goChoices } from './screens-state.ts'
import { items, str, type ItemData, type ScreensField } from './templates/types.ts'
import type { TemplateFormOptions } from './template-form.ts'

export interface SampleFieldDeps extends FormCore {
  /** 1つの値を書いて知らせる（組み立て直さない） */
  readonly write: (path: Path, value: Scalar) => void
  /** 入力欄を組み立て直す */
  readonly rebuild: () => void
  readonly options: Pick<TemplateFormOptions, 'pickSample' | 'onPreviewOverride' | 'blockElement' | 'onInnerSelected'>
}

export interface SampleFields {
  /** 見本の部品の入力欄（itemPath＝その部品の場所） */
  readonly el: (field: ScreensField, screenIndex: number, blockIndex: number, itemPath: Path) => HTMLElement
  /** 組み立て直す前に、中の要素を選ぶ入口を捨てる */
  readonly resetApis: () => void
  /** その部品の入力欄が出ていれば、中の要素を選ぶ（選べたら true） */
  readonly selectInner: (key: string, target: HTMLElement) => boolean
  /** 組み立て直したあとに選んでおく、見本の中の要素 */
  readonly setPending: (key: string, target: HTMLElement) => void
}

export function createSampleFields(deps: SampleFieldDeps): SampleFields {
  const { options } = deps
  /** 見本の部品ごとの、いま直している設問（組み立て直しても残す） */
  const activeSteps = new Map<string, number>()
  /** 見本の部品ごとの入口（中の要素を選ぶ）。組み立て直すたびに作り直す */
  let sampleApis = new Map<string, { selectInner: (target: HTMLElement) => void }>()
  /** 組み立て直したあとに選んでおく、見本の中の要素 */
  let pendingInner: { key: string; target: HTMLElement } | null = null

  const el = (field: ScreensField, screenIndex: number, blockIndex: number, itemPath: Path): HTMLElement => {
    const key = JSON.stringify(itemPath)
    const item = (): ItemData => (getAt(deps.data(), itemPath) as ItemData | undefined) ?? {}
    const initialInner = pendingInner !== null && pendingInner.key === key ? pendingInner.target : null
    if (initialInner !== null) pendingInner = null
    const editor = sampleEditor({
      read: () => ({ title: str(item(), 'title'), html: str(item(), 'html') }),
      replace: (sample) => {
        activeSteps.delete(key)
        deps.restructure(setAt(setAt(deps.data(), [...itemPath, 'title'], sample.title), [...itemPath, 'html'], sample.html))
      },
      writeHtml: (html) => deps.write([...itemPath, 'html'], html),
      pickSample: options.pickSample,
      goChoices: (selected) => goChoices(deps.data(), field.key, screenIndex, selected),
      canAddScreen: () => items(deps.data(), field.key).length < field.max,
      newScreen: (htmlWith) => {
        const added = addScreenFor(deps.data(), field.key, itemPath, field.max, (d, id) => setAt(d, [...itemPath, 'html'], htmlWith(id)))
        if (added !== null) deps.restructure(added.data)
      },
      onPreview: (html) => options.onPreviewOverride?.(key, [...itemPath, 'html'], html),
      activeStep: { get: () => activeSteps.get(key) ?? 0, set: (index) => activeSteps.set(key, index) },
      getElement: () => options.blockElement?.(screenIndex, blockIndex) ?? null,
      onInnerSelected: options.onInnerSelected,
      initialInner,
      rebuild: deps.rebuild,
    })
    sampleApis.set(key, { selectInner: editor.selectInner })
    return editor.element
  }

  return {
    el,
    resetApis: () => {
      sampleApis = new Map()
    },
    selectInner: (key, target) => {
      const api = sampleApis.get(key)
      if (api === undefined) return false
      api.selectInner(target)
      return true
    },
    setPending: (key, target) => {
      pendingInner = { key, target }
    },
  }
}
