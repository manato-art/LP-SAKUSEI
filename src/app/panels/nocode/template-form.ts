/**
 * 「部品を積んで作る」の入力欄（2026-09-22・本人の依頼。ノーコードでWidgetを作る③④）。
 * 2026-09-23 に Widget編集の右側に統合した（本人の決定 D1）。
 *
 * 型の fields（templates/types.ts）から入力欄を組み立てる。型ごとの画面は書かない。
 *  - 文字を打つたびに中身を作り直して知らせる（onChange）。入力欄そのものは作り直さない（打っている途中で外れない）
 *  - 「ほかの入力しだいで出す欄」「ほかの入力から付く名前・選べるもの」は、そのたびに出し分け・直すだけ
 *  - 並びの足す・消す・上下・複製、画面の切り替えは、入力欄を組み立て直す
 *  - 画面（「部品を積んで作る」）: 画面①②…をタブで切り替えて編集する。タブは studio.tabsHost（右側のいちばん上）に置く。
 *    部品が画面へ移るなら、その下の「◯◯を開いて編集する →」で移る先の画面を開ける
 *  - 部品ごとに「この部品を出す画面」と「押したとき」をボタンで選ぶ（本人の依頼「画面2・3・4・5…として簡単に設定」。
 *    決定: 両方＝押したら画面②③…へ移る／その部品を画面②③…に置く）。どちらにも「＋新しい画面」がある
 *  - 部品の一覧は、選んだ1つだけを広げる（Canva のように「選んだものを直す」。見たまま画面で押しても同じ部品が開く）。
 *    Widget全体の設定（背景・余白・切り替わり方）と、画面の設定（名前・並び・複製・消す）は畳んでおく
 *  - よそ（見たまま画面で文字を打ち直した）で変わった中身は setData で受け取り、入力欄の値だけ合わせる
 * 値の場所は道のり（path）で持つ: ['title'] / ['items', 1, 'q'] / ['screens', 0, 'blocks', 2, 'label']
 */
import { confirmCard } from '../../dialog.ts'
import { toast } from '../../ui.ts'
import { blockSnippet } from './builder-data.ts'
import { node, scalarControl, type ControlEnv, type Scalar, type ScalarField } from './form-controls.ts'
import { addAt, duplicateAt, getAt, moveAt, moveTo, removeAt, setAt, type Path } from './form-state.ts'
import { sampleEditor } from './form-sample.ts'
import { chipRow, type Chip } from './press-chips.ts'
import { plainTextOfRich, plainToRich } from './rich-text.ts'
import { splitSampleScreens } from './sample-to-screens.ts'
import type { SelectionHandle } from '../selection-layer.ts'
import {
  addSampleParts,
  addScreenFor,
  goChoices,
  incomingCount,
  moveBlockToNewScreen,
  moveBlockToScreen,
  nextScreenId,
  nextScreenName,
  pressOf,
  screenLabel,
  withPress,
} from './screens-state.ts'
import { SCREEN_ID, isTemplateBlock } from './templates/builder-blocks.ts'
import { items, str, type BlockType, type Field, type ItemData, type ScreensField, type TemplateData } from './templates/types.ts'

type ListField = Extract<Field, { kind: 'list' }>

const ICON_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 15 12 9 18 15"/></svg>'
const ICON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>'

let idSeq = 0
const nextId = (): string => `ncf-${(idSeq += 1)}`

function screenNameAt(screen: ItemData | undefined, index: number): string {
  const name = str(screen ?? {}, 'name').trim()
  return name === '' ? screenLabel(index + 1) : name
}

export interface TemplateFormOptions {
  fields: readonly Field[]
  data: TemplateData
  onChange: (data: TemplateData) => void
  /** 編集する画面を切り替えたとき（見え方をその画面にする） */
  onScreenChange?: (screenId: string) => void
  /** 見本の部品: いつもの見本の一覧から見本を選んでもらう（やめたら null） */
  pickSample?: () => Promise<{ title: string; html: string } | null>
  /** 見本の部品: 見え方だけ、その部品のHTMLを差し替える（選んだ設問を出す）。null で元に戻す */
  onPreviewOverride?: (key: string, path: Path, html: string | null) => void
  /** 組み立て直すとき、見え方だけの差し替えを全部やめる（部品の並びが変わると場所がずれるため） */
  onPreviewReset?: () => void
  /** 画面①②…のタブを置く所（右側のいちばん上）。無ければ入力欄の中に出す */
  tabsHost?: HTMLElement
  /** 部品を選んだ・選ぶのをやめた（見たまま画面の選択枠を合わせる） */
  onSelect?: (screenIndex: number, blockIndex: number | null) => void
  /** 部品の、見たまま画面での要素（見本の部品のカード・つまみに使う） */
  blockElement?: (screenIndex: number, blockIndex: number) => HTMLElement | null
  /** 見本の部品の中の要素を選んだ（見たまま画面の選択枠をその要素に合わせる） */
  onInnerSelected?: (nodeEl: HTMLElement, label: string, handles: readonly SelectionHandle[]) => void
}

export interface TemplateForm {
  readonly element: HTMLElement
  readonly getData: () => TemplateData
  /** よそで変わった中身を入れる（入力欄の値だけ合わせ、見え方は描き直さない） */
  readonly setData: (next: TemplateData) => void
  /** 入力欄を組み立て直す（見本の部品の中身を読み直すときなど） */
  readonly rebuild: () => void
  /** 部品を選ぶ（その画面を開き、その部品だけ広げる）。null は選ぶのをやめる */
  readonly select: (screenIndex: number, blockIndex: number | null) => void
  /** 見本の部品の中の要素を選ぶ（その部品を広げ、カードの段でその要素のカードを出す） */
  readonly selectInside: (screenIndex: number, blockIndex: number, target: HTMLElement) => void
  readonly activeScreen: () => number
  readonly selectedBlock: () => number | null
}

export function buildTemplateForm(options: TemplateFormOptions): TemplateForm {
  let data = options.data
  /** いま編集している画面（組み立て直しても残す） */
  let activeScreen = 0
  /** いま広げている部品（画面の中の何番目か）。null は何も選んでいない */
  let selectedBlock: number | null = null
  /** 畳める段の開き具合（組み立て直しても残す） */
  let globalOpen = false
  let screenSettingsOpen = false
  /** 見本の部品ごとの、いま直している設問（組み立て直しても残す） */
  const activeSteps = new Map<string, number>()
  /** 見本の部品ごとの入口（中の要素を選ぶ）。組み立て直すたびに作り直す */
  let sampleApis = new Map<string, { selectInner: (target: HTMLElement) => void }>()
  /** 組み立て直したあとに選んでおく、見本の中の要素 */
  let pendingInner: { key: string; target: HTMLElement } | null = null
  /** 並びごとの目印（足したあと、その1件に目を移すのに使う。組み立て直すたびに数え直す） */
  let listSeq = 0
  const root = node('div', 'ncf-form-body')
  /** 出し分け・名前や選べるものの直し（入力のたびに全部回す。軽い） */
  let refreshers: (() => void)[] = []
  const refreshAll = (): void => {
    for (const refresh of refreshers) refresh()
  }

  const write = (path: Path, value: Scalar): void => {
    data = setAt(data, path, value)
    options.onChange(data)
    refreshAll()
  }

  /** 中身を差し替えて知らせる（組み立て直しは呼ぶ側） */
  const replace = (next: TemplateData): boolean => {
    if (next === data) return false
    data = next
    options.onChange(data)
    return true
  }

  /** 並びの足し引きなど（入力欄を組み立て直す）。focus は入力を置く場所の目印 */
  const restructure = (next: TemplateData, focus?: string): void => {
    if (!replace(next)) return
    build()
    if (focus !== undefined) root.querySelector<HTMLElement>(focus)?.querySelector<HTMLElement>('input,textarea,select')?.focus()
  }

  const screensKey = options.fields.find((f): f is ScreensField => f.kind === 'screens')?.key ?? ''
  const notifySelect = (): void => options.onSelect?.(activeScreen, selectedBlock)
  const openScreen = (index: number, block: number | null = null): void => {
    const screenChanged = index !== activeScreen
    activeScreen = index
    selectedBlock = block
    build()
    const id = str(items(data, screensKey)[index] ?? {}, 'id')
    if (screenChanged && id !== '') options.onScreenChange?.(id)
    notifySelect()
  }

  /** 1つの入力欄（名前・入力・説明）。出し分けと名前の付け直しを登録する。itemPath は並びの中の1件 */
  const fieldEl = (field: ScalarField, path: Path, itemPath?: Path): HTMLElement => {
    const wrap = node('div', 'ncf-field')
    const id = nextId()
    // 飾りつきの文字（見出しなど）は、入力欄では飾りを外して出し、打ち直したら素の文字にする
    const rich = (field.kind === 'text' || field.kind === 'textarea') && field.rich === true
    const env: ControlEnv = {
      read: () => {
        const value = getAt(data, path)
        return rich && typeof value === 'string' ? plainTextOfRich(value) : value
      },
      write: (value) => write(path, rich && typeof value === 'string' ? plainToRich(value) : value),
      data: () => data,
      onRefresh: (refresh) => refreshers.push(refresh),
    }
    const control = scalarControl(field, env, id)
    if (field.kind === 'toggle') {
      wrap.append(control)
    } else {
      const label = node('label', 'ncf-label', field.label)
      label.htmlFor = id
      wrap.append(label, control)
      if (field.labelOf !== undefined) {
        const labelOf = field.labelOf
        refreshers.push(() => {
          label.textContent = labelOf(data)
        })
      }
    }
    if (field.note !== undefined) wrap.append(node('span', 'ncf-note', field.note))
    const { showIf, showIfItem } = field
    if (showIf !== undefined || (showIfItem !== undefined && itemPath !== undefined)) {
      refreshers.push(() => {
        const item = itemPath === undefined ? undefined : (getAt(data, itemPath) as ItemData | undefined)
        const shown = (showIf?.(data) ?? true) && (showIfItem === undefined || item === undefined || showIfItem(item))
        wrap.hidden = !shown
      })
    }
    return wrap
  }

  const textButton = (text: string, className: string, onClick: () => void, enabled = true): HTMLButtonElement => {
    const b = node('button', className, text)
    b.type = 'button'
    b.disabled = !enabled
    b.addEventListener('click', (event) => {
      // 部品の頭（押すと広がる）の中にあるボタンは、頭の押下として扱わない
      event.stopPropagation()
      onClick()
    })
    return b
  }

  const iconButton = (html: string, label: string, onClick: () => void, enabled: boolean): HTMLButtonElement => {
    const b = textButton('', 'ncf-icon-btn', onClick, enabled)
    b.innerHTML = html
    b.setAttribute('aria-label', label)
    b.title = label
    return b
  }

  /** 1件ごとの頭（名前・複製・上へ・下へ・消す） */
  const itemHead = (
    name: HTMLElement,
    listPath: Path,
    index: number,
    count: number,
    limits: { min: number; max: number; noun: string },
    onRestructured?: (next: TemplateData, kind: 'copy' | 'up' | 'down' | 'remove') => void,
  ): HTMLElement => {
    const head = node('div', 'ncf-item__head')
    const canCopy = count < limits.max
    const canRemove = count > limits.min
    const apply = (next: TemplateData, kind: 'copy' | 'up' | 'down' | 'remove'): void => {
      if (onRestructured !== undefined) onRestructured(next, kind)
      else restructure(next)
    }
    const copy = textButton('複製', 'ncf-icon-btn ncf-item__copy', () => apply(duplicateAt(data, listPath, index, limits.max), 'copy'), canCopy)
    copy.title = canCopy ? `この${limits.noun}をすぐ下に複製` : `${limits.max}つまでです`
    const remove = textButton('消す', 'ncf-icon-btn ncf-item__remove', () => apply(removeAt(data, listPath, index, limits.min), 'remove'), canRemove)
    remove.title = canRemove ? `この${limits.noun}を消す` : `${limits.min}つより少なくはできません`
    head.append(
      name,
      copy,
      iconButton(ICON_UP, '上へ', () => apply(moveAt(data, listPath, index, -1), 'up'), index > 0),
      iconButton(ICON_DOWN, '下へ', () => apply(moveAt(data, listPath, index, 1), 'down'), index < count - 1),
      remove,
    )
    return head
  }

  /** 並び（よくある質問の1問など）。型の部品の中の並びでも使う（basePath＝その部品の場所） */
  const listEl = (field: ListField, basePath: Path = []): HTMLElement => {
    const wrap = node('div', 'ncf-field')
    const listKey = `l${(listSeq += 1)}`
    wrap.dataset['ncfList'] = listKey
    const listPath: Path = [...basePath, field.key]
    const list = (getAt(data, listPath) as readonly ItemData[] | undefined) ?? []
    const head = node('div', 'ncf-listhead')
    head.append(node('span', 'ncf-label', field.label), node('span', 'ncf-count', `${list.length} / ${field.max}`))
    const box = node('div', 'ncf-list')
    list.forEach((_, index) => {
      const item = node('div', 'ncf-item')
      const name = node('span', 'ncf-item__name', `${field.itemLabel} ${index + 1}`)
      item.append(itemHead(name, listPath, index, list.length, { min: field.min, max: field.max, noun: field.itemLabel }))
      for (const sub of field.fields) {
        // 並びの中の並びは作らない（見本・押したときは「部品を積んで作る」の部品の中だけ）
        if (sub.kind === 'list' || sub.kind === 'screens' || sub.kind === 'sample' || sub.kind === 'goto') continue
        item.append(fieldEl(sub, [...listPath, index, sub.key], [...listPath, index]))
      }
      box.append(item)
    })
    const full = list.length >= field.max
    const add = textButton(
      full ? `${field.itemLabel}は${field.max}つまでです` : `＋ ${field.itemLabel}を足す`,
      'ncf-add',
      () => restructure(addAt(data, listPath, field.newItem(), field.max), `[data-ncf-list="${listKey}"] .ncf-item:last-of-type`),
      !full,
    )
    wrap.append(head, box, add)
    return wrap
  }

  /** 見本の部品（見本を選ぶ・中身を直す・設問①②…を切り替える・中の画像やボタンの押したとき・カード・コード） */
  const sampleFieldEl = (field: ScreensField, screenIndex: number, blockIndex: number, itemPath: Path): HTMLElement => {
    const key = JSON.stringify(itemPath)
    const item = (): ItemData => (getAt(data, itemPath) as ItemData | undefined) ?? {}
    const initialInner = pendingInner !== null && pendingInner.key === key ? pendingInner.target : null
    if (initialInner !== null) pendingInner = null
    const editor = sampleEditor({
      read: () => ({ title: str(item(), 'title'), html: str(item(), 'html') }),
      replace: (sample) => {
        activeSteps.delete(key)
        restructure(setAt(setAt(data, [...itemPath, 'title'], sample.title), [...itemPath, 'html'], sample.html))
      },
      writeHtml: (html) => write([...itemPath, 'html'], html),
      pickSample: options.pickSample,
      goChoices: (selected) => goChoices(data, field.key, screenIndex, selected),
      canAddScreen: () => items(data, field.key).length < field.max,
      newScreen: (htmlWith) => {
        const added = addScreenFor(data, field.key, itemPath, field.max, (d, id) => setAt(d, [...itemPath, 'html'], htmlWith(id)))
        if (added !== null) restructure(added.data)
      },
      onPreview: (html) => options.onPreviewOverride?.(key, [...itemPath, 'html'], html),
      activeStep: { get: () => activeSteps.get(key) ?? 0, set: (index) => activeSteps.set(key, index) },
      getElement: () => options.blockElement?.(screenIndex, blockIndex) ?? null,
      onInnerSelected: options.onInnerSelected,
      initialInner,
      rebuild: build,
    })
    sampleApis.set(key, { selectInner: editor.selectInner })
    return editor.element
  }

  /** 部品の「押したとき」（なし・画面②③…・＋新しい画面・リンクを開く） */
  const pressFieldEl = (field: ScreensField, screenIndex: number, itemPath: Path, label: string): HTMLElement => {
    const item = (): ItemData => (getAt(data, itemPath) as ItemData | undefined) ?? {}
    const state = (): { chips: Chip[]; selected: string; warn: string } => {
      const selected = pressOf(item())
      const isScreen = SCREEN_ID.test(selected)
      const choices = goChoices(data, field.key, screenIndex, isScreen ? selected : null)
      const lost = isScreen && !items(data, field.key).some((screen) => str(screen, 'id') === selected)
      return {
        chips: [
          { value: 'none', label: 'なし' },
          ...choices.map((choice) => ({ value: choice.id, label: choice.label })),
          { value: 'new', label: '＋新しい画面', adds: true, disabled: items(data, field.key).length >= field.max },
          { value: 'link', label: 'リンクを開く' },
        ],
        selected,
        warn: lost ? '移る先の画面が消えています。移る先の画面を選び直してください' : '',
      }
    }
    const first = state()
    const row = chipRow({
      label,
      chips: first.chips,
      selected: first.selected,
      warn: first.warn,
      onPick: (value) => {
        if (value === 'new') {
          const added = addScreenFor(data, field.key, itemPath, field.max)
          if (added !== null) restructure(added.data)
          return
        }
        if (replace(withPress(data, itemPath, value))) refreshAll()
      },
    })
    refreshers.push(() => {
      const next = state()
      row.update(next.chips, next.selected, next.warn)
    })
    return row.el
  }

  /** 部品の「この部品を出す画面」（押すと、その画面のいちばん下へ移る。「＋新しい画面」は画面を足して移す） */
  const placeFieldEl = (field: ScreensField, screenIndex: number, blockIndex: number, noun: string): HTMLElement => {
    const chips = (): Chip[] => [
      ...items(data, field.key).map((screen, index) => ({ value: String(index), label: screenNameAt(screen, index) })),
      { value: 'new', label: '＋新しい画面', adds: true, disabled: items(data, field.key).length >= field.max },
    ]
    const row = chipRow({
      label: 'この部品を出す画面',
      chips: chips(),
      selected: String(screenIndex),
      onPick: (value) => {
        if (value === String(screenIndex)) return
        const to = Number(value)
        const moved =
          value === 'new'
            ? moveBlockToNewScreen(data, field.key, screenIndex, blockIndex, field.max, field.blockMax)
            : { data: moveBlockToScreen(data, field.key, screenIndex, blockIndex, to, field.blockMax), index: to }
        if (moved === null || moved.data === data) {
          toast(`移せませんでした（1画面に${field.blockMax}こまでです）`, 'error')
          return
        }
        // 移した部品を、移した先の画面で選んだままにする（いちばん下に入る）
        const movedIndex = items(items(moved.data, field.key)[moved.index] ?? {}, 'blocks').length - 1
        if (replace(moved.data)) openScreen(moved.index, movedIndex)
        toast(`${noun}を「${screenNameAt(items(data, field.key)[moved.index], moved.index)}」のいちばん下へ移しました`)
      },
    })
    refreshers.push(() => row.update(chips(), String(screenIndex)))
    return row.el
  }

  /** 部品の下の「◯◯を開いて編集する →」（押したら移る部品だけ。移る先の画面を開く） */
  const gotoEl = (itemPath: Path): HTMLElement => {
    const targetIndex = (): number => {
      const target = pressOf((getAt(data, itemPath) as ItemData | undefined) ?? {})
      return SCREEN_ID.test(target) ? items(data, screensKey).findIndex((screen) => str(screen, 'id') === target) : -1
    }
    const b = textButton('', 'ncf-goto', () => {
      const index = targetIndex()
      if (index >= 0) openScreen(index)
    })
    refreshers.push(() => {
      const index = targetIndex()
      b.hidden = index < 0 || index === activeScreen
      if (!b.hidden) b.textContent = `「${screenNameAt(items(data, screensKey)[index], index)}」を開いて編集する →`
    })
    return b
  }

  /** 部品1つの中身（この部品を出す画面・入力欄・押したとき・移る先を開く） */
  const blockBody = (field: ScreensField, screenIndex: number, index: number, type: BlockType): HTMLElement => {
    const body = node('div', 'ncf-item__body')
    const listPath: Path = [field.key, screenIndex, 'blocks']
    body.append(placeFieldEl(field, screenIndex, index, type.label))
    const itemPath: Path = [...listPath, index]
    for (const sub of type.fields) {
      if (sub.kind === 'sample') {
        body.append(sampleFieldEl(field, screenIndex, index, itemPath))
        continue
      }
      if (sub.kind === 'goto') {
        body.append(pressFieldEl(field, screenIndex, itemPath, sub.label))
        continue
      }
      // 型の部品の中の並び（よくある質問の1問・口コミの1件など）も、そのまま足したり消したりできる
      if (sub.kind === 'list') {
        body.append(listEl(sub, itemPath))
        continue
      }
      if (sub.kind === 'screens') continue
      body.append(fieldEl(sub, [...itemPath, sub.key], itemPath))
    }
    if (type.fields.some((f) => f.kind === 'goto')) body.append(gotoEl(itemPath))
    return body
  }

  /**
   * 画面の中の部品の並び。1件ごとに部品の名前と複製・上へ・下へ・消す。頭を押すとその部品だけが広がる
   * （見たまま画面で部品を押したときも同じ）。いちばん下に種類ごとの「足す」
   */
  const blockListEl = (field: ScreensField, screenIndex: number): HTMLElement => {
    const wrap = node('div', 'ncf-field')
    const listPath: Path = [field.key, screenIndex, 'blocks']
    wrap.dataset['ncfList'] = 'blocks'
    const list = (getAt(data, listPath) as readonly ItemData[] | undefined) ?? []
    const head = node('div', 'ncf-listhead')
    head.append(node('span', 'ncf-label', '部品（上から順に並びます）'), node('span', 'ncf-count', `${list.length} / ${field.blockMax}`))
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
      const selected = index === selectedBlock
      const itemEl = node('div', selected ? 'ncf-item ncf-item--selected' : 'ncf-item')
      itemEl.dataset['ncfBlock'] = String(index)
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
        let to = index + (after ? 1 : 0)
        if (from < to) to -= 1
        if (!replace(moveTo(data, listPath, from, to))) return
        selectedBlock = to
        build()
        notifySelect()
      })
      const name = node('span', 'ncf-item__name')
      const icon = node('span', 'ncf-item__icon')
      icon.innerHTML = type.icon
      const snippet = node('span', 'ncf-item__snippet')
      refreshers.push(() => {
        snippet.textContent = blockSnippet((getAt(data, [...listPath, index]) as ItemData | undefined) ?? {})
      })
      name.append(icon, node('span', '', type.label), snippet)
      // 複製・上下・消す のあとも、同じ部品を選んだままにする（消したら選ぶのをやめる）
      const headEl = itemHead(name, listPath, index, list.length, { min: 0, max: field.blockMax, noun: type.label }, (next, kind) => {
        if (!replace(next)) return
        selectedBlock = kind === 'remove' ? null : kind === 'copy' ? index + 1 : kind === 'up' ? index - 1 : kind === 'down' ? index + 1 : index
        build()
        notifySelect()
      })
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
      const toggle = (): void => openScreen(screenIndex, selected ? null : index)
      headEl.addEventListener('click', toggle)
      headEl.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        toggle()
      })
      itemEl.append(headEl)
      if (selected) itemEl.append(blockBody(field, screenIndex, index, type))
      box.append(itemEl)
    })
    const full = list.length >= field.blockMax
    const adder = node('div', 'ncf-adder')
    const grid = node('div', 'ncf-adder__grid')
    // 型の部品（まとまった部品）は、ふつうの部品と分けて並べる
    const templateGrid = node('div', 'ncf-adder__grid')
    adder.append(node('span', 'ncf-adder__label', full ? `部品は1画面に${field.blockMax}こまでです` : '部品を足す（いちばん下に入り、すぐ直せます）'), grid)
    /** 足した部品を選んだ状態で組み立て直す */
    const addSelected = (next: TemplateData): void => {
      if (!replace(next)) return
      selectedBlock = items(items(data, field.key)[screenIndex] ?? {}, 'blocks').length - 1
      build()
      notifySelect()
      root.querySelector<HTMLElement>('.ncf-item--selected')?.querySelector<HTMLElement>('input,textarea,select')?.focus()
    }
    for (const type of field.types) {
      const add = (): void => {
        // 見本は、先に見本の一覧で選んでもらい、選んだら部品として入れる（やめたら何も足さない）
        if (type.type === 'sample' && options.pickSample !== undefined) {
          void options.pickSample().then((sample) => {
            if (sample === null) return
            // 設問①②③で進む見本は、設問ごとの部品にして画面①②③へ分ける（本人の決定）
            const parts = splitSampleScreens(sample.html)
            const split =
              parts.length < 2
                ? null
                : addSampleParts(data, field.key, screenIndex, sample.title, parts, { max: field.max, blockMax: field.blockMax })
            if (split !== null) {
              addSelected(split)
              toast(`「${sample.title}」の設問を、画面ごとの部品に分けました（${parts.length}画面）`)
              return
            }
            addSelected(addAt(data, listPath, { ...type.newItem(), title: sample.title, html: sample.html }, field.blockMax))
          })
          return
        }
        addSelected(addAt(data, listPath, type.newItem(), field.blockMax))
      }
      const b = textButton('', 'ncf-adder__btn', add, !full)
      const icon = node('span', 'ncf-adder__icon')
      icon.innerHTML = type.icon
      b.append(icon, node('span', '', type.label))
      ;(isTemplateBlock(type.type) ? templateGrid : grid).append(b)
    }
    if (templateGrid.children.length > 0) {
      adder.append(node('span', 'ncf-adder__label ncf-adder__label--tpl', '型を足す（中身は入力欄で直します）'), templateGrid)
    }
    wrap.append(head, box, adder)
    return wrap
  }

  /** 畳める段（開き具合は組み立て直しても残す） */
  const foldable = (title: string, isOpen: () => boolean, setOpen: (open: boolean) => void, body: readonly HTMLElement[]): HTMLElement => {
    const details = node('details', 'ncf-fold')
    details.open = isOpen()
    const summary = node('summary', 'ncf-fold__summary', title)
    details.append(summary, ...body)
    details.addEventListener('toggle', () => setOpen(details.open))
    return details
  }

  /** いま編集している画面の設定（名前・左へ・右へ・複製・消す） */
  const screenHead = (field: ScreensField, screens: readonly ItemData[], index: number): HTMLElement => {
    const ids = screens.map((screen) => str(screen, 'id'))
    const row = node('div', 'ncf-screen-head')
    row.append(fieldEl({ kind: 'text', key: 'name', label: '画面の名前', placeholder: screenLabel(index + 1) }, [field.key, index, 'name']))
    const move = (direction: -1 | 1): void => {
      if (replace(moveAt(data, [field.key], index, direction))) openScreen(index + direction)
    }
    const actions = node('div', 'ncf-screen-actions')
    actions.append(
      textButton('← 左へ', 'ncf-btn ncf-btn--quiet', () => move(-1), index > 0),
      textButton('右へ →', 'ncf-btn ncf-btn--quiet', () => move(1), index < screens.length - 1),
      textButton(
        'この画面を複製',
        'ncf-btn ncf-btn--quiet',
        () => {
          const copyName = (copy: ItemData): ItemData => ({ ...copy, id: nextScreenId(ids), name: `${screenNameAt(copy, index)}のコピー` })
          if (replace(duplicateAt(data, [field.key], index, field.max, copyName))) openScreen(index + 1)
        },
        screens.length < field.max,
      ),
      textButton(
        'この画面を消す',
        'ncf-btn ncf-btn--quiet ncf-danger',
        () => {
          void confirmCard({
            title: '画面を消しますか？',
            message: `「${screenNameAt(screens[index], index)}」と、その中の部品を消します。`,
            submitLabel: '消す',
            danger: true,
          }).then((ok) => {
            if (ok && replace(removeAt(data, [field.key], index, field.min))) openScreen(Math.max(0, index - 1))
          })
        },
        screens.length > field.min,
      ),
    )
    row.append(actions)
    return row
  }

  /** 画面①②…のタブと、いま編集している画面 */
  const screensEl = (field: ScreensField): HTMLElement => {
    const wrap = node('div', 'ncf-field ncf-screens')
    const screens = items(data, field.key)
    activeScreen = Math.min(Math.max(activeScreen, 0), Math.max(screens.length - 1, 0))

    const tabs = node('div', 'ncf-screen-tabs')
    tabs.setAttribute('role', 'tablist')
    tabs.setAttribute('aria-label', '編集する画面')
    screens.forEach((screen, index) => {
      const tab = textButton(screenNameAt(screen, index), 'ncf-screen-tab', () => openScreen(index))
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-selected', String(index === activeScreen))
      refreshers.push(() => {
        tab.textContent = screenNameAt(items(data, field.key)[index], index)
      })
      tabs.append(tab)
    })
    const full = screens.length >= field.max
    const add = textButton(
      full ? `画面は${field.max}こまで` : '＋ 画面を足す',
      'ncf-screen-add',
      () => {
        const screen = { id: nextScreenId(screens.map((s) => str(s, 'id'))), name: nextScreenName(screens.map((s) => str(s, 'name'))), blocks: [] }
        if (replace(addAt(data, [field.key], screen, field.max))) openScreen(screens.length)
      },
      !full,
    )
    tabs.append(add)
    if (options.tabsHost !== undefined) {
      options.tabsHost.replaceChildren(tabs)
    } else {
      wrap.append(node('span', 'ncf-label', field.label), tabs)
    }

    const index = activeScreen
    if (screens[index] === undefined) return wrap
    const note = node('p', 'ncf-screen-note')
    refreshers.push(() => {
      const id = str(items(data, field.key)[index] ?? {}, 'id')
      const reachable = index === 0 || incomingCount(data, id) > 0
      note.classList.toggle('ncf-screen-note--warn', !reachable)
      note.textContent =
        index === 0
          ? 'いちばん左の画面が、最初に出ます。'
          : reachable
            ? 'この画面へは、ほかの画面の部品の「押したとき」から移ってきます。'
            : 'まだどの部品からも、この画面へ移れません。ほかの画面のボタンなどの「押したとき」で、この画面を選んでください。'
    })
    const panel = node('div', 'ncf-screen')
    panel.append(
      note,
      foldable(
        `この画面の設定（${screenNameAt(screens[index], index)}）`,
        () => screenSettingsOpen,
        (open) => {
          screenSettingsOpen = open
        },
        [screenHead(field, screens, index)],
      ),
      blockListEl(field, index),
    )
    wrap.append(panel)
    return wrap
  }

  const build = (): void => {
    options.onPreviewReset?.()
    const scroller = root.closest<HTMLElement>('[data-ncf-scroll]') ?? root.closest<HTMLElement>('.ncf-form')
    const scrollTop = scroller?.scrollTop ?? 0
    refreshers = []
    listSeq = 0
    sampleApis = new Map()
    const screens = options.fields.filter((field): field is ScreensField => field.kind === 'screens')
    const others = options.fields.filter((field) => field.kind !== 'screens' && field.kind !== 'sample' && field.kind !== 'goto')
    const otherEls = others.map((field) => (field.kind === 'list' ? listEl(field) : fieldEl(field, [field.key])))
    root.replaceChildren(
      ...screens.map((field) => screensEl(field)),
      // Widget全体の設定（背景・余白・切り替わり方）は畳んでおく。画面を持たない型ではそのまま並べる
      ...(screens.length > 0 && otherEls.length > 0
        ? [
            foldable(
              'Widget全体の設定（背景・余白・切り替わり方）',
              () => globalOpen,
              (open) => {
                globalOpen = open
              },
              otherEls,
            ),
          ]
        : otherEls),
    )
    refreshAll()
    if (scroller !== null) scroller.scrollTop = scrollTop
  }

  build()
  return {
    element: root,
    getData: () => data,
    setData: (next) => {
      if (next === data) return
      data = next
      refreshAll()
    },
    rebuild: build,
    select: (screenIndex, blockIndex) => {
      const screens = items(data, screensKey)
      if (screens[screenIndex] === undefined) return
      if (screenIndex === activeScreen && blockIndex === selectedBlock) return
      openScreen(screenIndex, blockIndex)
      root.querySelector<HTMLElement>('.ncf-item--selected')?.scrollIntoView({ block: 'nearest' })
    },
    selectInside: (screenIndex, blockIndex, target) => {
      const key = JSON.stringify(['screens', screenIndex, 'blocks', blockIndex])
      const api = sampleApis.get(key)
      if (api !== undefined && screenIndex === activeScreen && blockIndex === selectedBlock) {
        api.selectInner(target)
        return
      }
      pendingInner = { key, target }
      openScreen(screenIndex, blockIndex)
      root.querySelector<HTMLElement>('.ncf-item--selected')?.scrollIntoView({ block: 'nearest' })
    },
    activeScreen: () => activeScreen,
    selectedBlock: () => selectedBlock,
  }
}
