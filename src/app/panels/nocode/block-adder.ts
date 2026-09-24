/**
 * 部品を足す（2026-09-24・template-form.ts から分けた）。
 *  - palette: 左の列の「部品を足す」（よく使う11個＋もっと見る・palette.ts）。もっと見るの開き具合は組み立て直しても残す
 *  - adder: 並びのいちばん下の種類ごとの「足す」（左右に分けないとき。型の部品は別の段）
 *  - startChooser: 白紙のときの「何から作りますか？」（例・ライブラリの見本・型から選ぶ）
 *  - add: 部品を1つ足して選ぶ。見本は先に見本の一覧で選んでもらい、設問①②③で進む見本は画面ごとの部品に分ける。
 *    移行先は部品の上に被せる（選んでいる部品か、いちばん下の部品）
 */
import { toast } from '../../ui.ts'
import { node } from './form-controls.ts'
import { addAt, moveTo, type Path } from './form-state.ts'
import { textButton, type FormCore } from './form-core.ts'
import { HOTSPOT_TYPE, coveredIndexOf, groupEndOf, isHotspot } from './hotspot-model.ts'
import { createPalette } from './palette.ts'
import { splitSampleScreens } from './sample-to-screens.ts'
import { addSampleParts } from './screens-state.ts'
import { isTemplateBlock, templateOfBlock } from './templates/builder-blocks.ts'
import { items, type BlockType, type ItemData, type ScreensField, type TemplateData } from './templates/types.ts'
import type { TemplateFormOptions } from './template-form.ts'

export interface BlockAdderDeps extends Pick<FormCore, 'data' | 'replace'> {
  /** 部品の並び・部品を足す を左の列に出す（右は選んだ部品の設定だけ） */
  readonly isSplit: boolean
  /** 入力欄の器（足した部品の文字の欄に入力の印を置く） */
  readonly root: HTMLElement
  readonly selectedBlock: () => number | null
  /** 部品を選び直して組み立て直す（画面はそのまま） */
  readonly reselect: (block: number) => void
  /** 中身をまるごと入れ替えて、最初の画面を開く（「何から作りますか？」で例を選んだとき） */
  readonly startFrom: (field: ScreensField, next: TemplateData) => void
  readonly options: Pick<TemplateFormOptions, 'pickSample' | 'examples'>
}

export interface BlockAdder {
  /** 部品を1つ、その画面のいちばん下（at があればその位置）に足して選ぶ。init は足す中身に重ねる値 */
  readonly add: (field: ScreensField, screenIndex: number, type: BlockType, at?: number, init?: ItemData) => void
  readonly palette: (field: ScreensField, screenIndex: number) => HTMLElement
  /** count はその画面の部品の数 */
  readonly adder: (field: ScreensField, screenIndex: number, count: number) => HTMLElement
  readonly startChooser: (field: ScreensField) => HTMLElement
}

/** 部品が1つも無く、画面も1つだけ（白紙） */
export function isBlank(data: TemplateData, field: ScreensField): boolean {
  const screens = items(data, field.key)
  return screens.length <= 1 && items(screens[0] ?? {}, 'blocks').length === 0
}

export function createBlockAdder(deps: BlockAdderDeps): BlockAdder {
  const { options } = deps

  /** 足した部品を選んだ状態で組み立て直す。at があれば、いちばん下ではなくその位置へ入れる（ドラッグで入れたとき） */
  const addSelected = (field: ScreensField, screenIndex: number, next: TemplateData, at?: number): void => {
    const listPath: Path = [field.key, screenIndex, 'blocks']
    const last = items(items(next, field.key)[screenIndex] ?? {}, 'blocks').length - 1
    const moveUp = at !== undefined && at >= 0 && at < last
    if (!deps.replace(moveUp ? moveTo(next, listPath, last, at) : next)) return
    deps.reselect(moveUp ? at : last)
    // 入力の印は中身の文字の欄へ（いちばん上の「幅」ではなく）。文字の欄が無い部品は置かない
    const scope = deps.isSplit ? deps.root : deps.root.querySelector<HTMLElement>('.ncf-item--selected')
    scope?.querySelector<HTMLElement>('input[type="text"],input[type="url"],textarea')?.focus()
  }

  /**
   * 移行先を足す（部品の上に被せて使う）。at があればその位置（見たまま画面で部品の上に落としたとき）。
   * 押しただけなら、選んでいる部品（移行先を選んでいたら、その被せ先）に、無ければいちばん下の部品に被せる
   */
  const addHotspot = (field: ScreensField, screenIndex: number, type: BlockType, at?: number, init: ItemData = {}): void => {
    const listPath: Path = [field.key, screenIndex, 'blocks']
    const blocks = items(items(deps.data(), field.key)[screenIndex] ?? {}, 'blocks')
    const selectedBlock = deps.selectedBlock()
    const selected = selectedBlock === null || blocks[selectedBlock] === undefined ? null : selectedBlock
    const chosen = selected === null ? null : isHotspot(blocks[selected]) ? coveredIndexOf(blocks, selected) : selected
    const lastPart = [...blocks.keys()].reverse().find((i) => !isHotspot(blocks[i]))
    const cover = chosen ?? lastPart ?? null
    if (at === undefined && cover === null) {
      toast('移行先は、ボタンや画像などの部品の上に被せて使います。先に部品を置いてください', 'error')
      return
    }
    const where = at ?? (cover === null ? blocks.length : groupEndOf(blocks, cover))
    addSelected(field, screenIndex, addAt(deps.data(), listPath, { ...type.newItem(), ...init }, field.blockMax), where)
  }

  const add = (field: ScreensField, screenIndex: number, type: BlockType, at?: number, init: ItemData = {}): void => {
    const listPath: Path = [field.key, screenIndex, 'blocks']
    if (type.type === HOTSPOT_TYPE) {
      addHotspot(field, screenIndex, type, at, init)
      return
    }
    // 見本は、先に見本の一覧で選んでもらい、選んだら部品として入れる（やめたら何も足さない）
    if (type.type === 'sample' && options.pickSample !== undefined) {
      void options.pickSample().then((sample) => {
        if (sample === null) return
        // 設問①②③で進む見本は、設問ごとの部品にして画面①②③へ分ける（本人の決定）
        const parts = splitSampleScreens(sample.html)
        const split =
          parts.length < 2 ? null : addSampleParts(deps.data(), field.key, screenIndex, sample.title, parts, { max: field.max, blockMax: field.blockMax })
        if (split !== null) {
          addSelected(field, screenIndex, split)
          toast(`「${sample.title}」の設問を、画面ごとの部品に分けました（${parts.length}画面）`)
          return
        }
        addSelected(field, screenIndex, addAt(deps.data(), listPath, { ...type.newItem(), title: sample.title, html: sample.html }, field.blockMax), at)
      })
      return
    }
    addSelected(field, screenIndex, addAt(deps.data(), listPath, { ...type.newItem(), ...init }, field.blockMax), at)
  }

  const paletteState = createPalette()
  const palette = (field: ScreensField, screenIndex: number): HTMLElement =>
    paletteState.render(field, items(items(deps.data(), field.key)[screenIndex] ?? {}, 'blocks').length, {
      add: (type) => add(field, screenIndex, type),
      canPickSample: options.pickSample !== undefined,
    })

  const adder = (field: ScreensField, screenIndex: number, count: number): HTMLElement => {
    const full = count >= field.blockMax
    const el = node('div', 'ncf-adder')
    const grid = node('div', 'ncf-adder__grid')
    // 型の部品（まとまった部品）は、ふつうの部品と分けて並べる
    const templateGrid = node('div', 'ncf-adder__grid')
    el.append(node('span', 'ncf-adder__label', full ? `部品は1画面に${field.blockMax}こまでです` : '部品を足す（いちばん下に入り、すぐ直せます）'), grid)
    for (const type of field.types) {
      // 見本の一覧を開けない画面（ポップアップの中身）では「見本」を出さない（中身の無い見本の部品になるだけ）
      if (type.type === 'sample' && options.pickSample === undefined) continue
      const b = textButton('', 'ncf-adder__btn', () => add(field, screenIndex, type), !full)
      const icon = node('span', 'ncf-adder__icon')
      icon.innerHTML = type.icon
      b.append(icon, node('span', '', type.label))
      ;(isTemplateBlock(type.type) ? templateGrid : grid).append(b)
    }
    if (templateGrid.children.length > 0) {
      el.append(node('span', 'ncf-adder__label ncf-adder__label--tpl', '型を足す（中身は入力欄で直します）'), templateGrid)
    }
    return el
  }

  /**
   * 白紙のときの「何から作りますか？」（以前の「型から作る」の一覧と同じ見た目）。
   * 例（アンケート）・ライブラリの見本・型8種から選ぶ。選ぶと画面①に入る（例は中身まるごと）
   */
  const startChooser = (field: ScreensField): HTMLElement => {
    const wrap = node('div', 'ncf-start')
    wrap.append(
      node('p', 'ncf-start__title', '何から作りますか？'),
      node('p', 'ncf-note', deps.isSplit ? '選ぶと、まん中に出ます。左の「部品を足す」から、部品を1つずつ運んで作ることもできます。' : '選ぶと左に出ます。あとから部品を足したり、消したり、並べ替えたりできます。'),
    )
    const grid = node('div', 'ncf-picker')
    const choice = (icon: string, name: string, summary: string, onPick: () => void): void => {
      const b = textButton('', 'ncf-pick', onPick)
      const iconEl = node('span', 'ncf-pick__icon')
      iconEl.innerHTML = icon
      const text = node('span')
      text.append(node('span', 'ncf-pick__name', name), node('span', 'ncf-pick__sum', summary))
      b.append(iconEl, text)
      grid.append(b)
    }
    for (const example of options.examples ?? []) {
      choice(example.icon, example.label, example.summary, () => deps.startFrom(field, example.data()))
    }
    const sample = field.types.find((t) => t.type === 'sample')
    if (sample !== undefined && options.pickSample !== undefined) {
      choice(sample.icon, 'ライブラリの見本から', '用意された見本から選んで、中身を直して使います', () => add(field, 0, sample))
    }
    for (const type of field.types) {
      const template = templateOfBlock(type.type)
      if (template === undefined) continue
      choice(type.icon, template.name, template.summary, () => add(field, 0, type))
    }
    if (!deps.isSplit) wrap.append(grid, node('p', 'ncf-note', '下の「部品を足す」から、見出し・文章・画像などを1つずつ積んで作ることもできます。'))
    else wrap.append(grid)
    return wrap
  }

  return { add, palette, adder, startChooser }
}
