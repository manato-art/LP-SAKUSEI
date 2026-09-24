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
 *
 * 2026-09-24 画面の作り直し（本人の決定: C-1a＝左の列に「並び」と「部品を足す」・右は選んだ部品の設定）:
 * partsHost を渡すと、部品の並び（頭だけ・ドラッグで並べ替え）と「部品を足す」（ドラッグで好きな所へ・押すといちばん下）を
 * 左の列に出し、右（element）には選んだ部品の設定だけを「レイアウト／中身／押したとき」の段に分けて出す
 * （部品を選んでいないときは画面とWidget全体の設定、白紙なら「何から作りますか？」）。
 *
 * 2026-09-24 大きくなったので分けた（ふるまいは同じ）。ここに残すのは、中身と「いまどの画面・どの部品か」を持つことと、
 * 組み立て直し（build）・よそから呼ぶ入口だけ。組み立てる部品は、中身を読み書きする入口（form-core.ts の FormCore）を受け取る:
 *  - 並び（よくある質問の1問など）＝list-field.ts ／ 部品の並び＝block-list.ts ／ 部品を足す・何から作りますか？＝block-adder.ts
 *  - 選んだ部品の設定（レイアウト／中身／押したとき）＝block-inspector.ts ／ 見本の部品＝sample-field.ts
 *  - 画面のタブ・この画面の設定・この部品を出す画面・押したとき・開いて編集する＝screen-settings.ts（「LPの上で」は lp-press-rows.ts）
 */
import { toast } from '../../ui.ts'
import { node, scalarControl, type ControlEnv, type Scalar, type ScalarField } from './form-controls.ts'
import { getAt, setAt, type Path } from './form-state.ts'
import { foldable, type FormCore } from './form-core.ts'
import { applyPlainEdit, plainTextOfRich } from './rich-text.ts'
import type { SelectionHandle } from '../selection-layer.ts'
import { screenLabel } from './screens-state.ts'
import { removeGroup } from './hotspot-model.ts'
import { createBlockAdder, isBlank } from './block-adder.ts'
import { createBlockInspector } from './block-inspector.ts'
import { blockListEl, type BlockListDeps } from './block-list.ts'
import { listFieldEl, type ListField, type ListFieldDeps } from './list-field.ts'
import { createSampleFields } from './sample-field.ts'
import { createScreenSettings } from './screen-settings.ts'
import { items, str, type Field, type ItemData, type ScreensField, type TemplateData } from './templates/types.ts'

export { NC_BLOCK_MIME, NC_HOTSPOT_MIME } from './palette.ts'

let idSeq = 0
const nextId = (): string => `ncf-${(idSeq += 1)}`

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
  /**
   * 白紙のときの「何から作りますか？」に出す例（アンケートの例 など）。選ぶと中身をまるごとその例にする
   * （2026-09-24・本人の指摘「ノーコードで作るを押すと前のものが引き継がれて消せない。選択肢がなくなった」）
   */
  examples?: readonly { label: string; summary: string; icon: string; data: () => TemplateData }[]
  /**
   * 部品の並びと「部品を足す」を置く所（2026-09-24 画面の作り直し＝左の列）。あれば右（element）には
   * 選んだ部品の設定だけを段に分けて出す
   */
  partsHost?: { readonly list: HTMLElement; readonly palette: HTMLElement }
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
  /** 中身を入れ替えて組み立て直し、その部品を選ぶ（左で部品をつかんで並べ替えたとき） */
  readonly load: (next: TemplateData, screenIndex: number, blockIndex: number | null) => void
  readonly activeScreen: () => number
  readonly selectedBlock: () => number | null
  /** いま開いている画面の at 番目に部品を足して選ぶ（左の「部品を足す」から見たまま画面へドラッグしたとき） */
  /** 部品を at 番目に入れる（見たまま画面へドラッグで運んだとき）。init は足す中身に重ねる値（移行先の位置と大きさ） */
  readonly insertBlock: (type: string, at: number, init?: ItemData) => void
  /** いま開いている画面の部品を消す（Backspace・Delete・消しゴム。被せた移行先も一緒）。消したら true */
  readonly removeBlock: (blockIndex: number) => boolean
}

export function buildTemplateForm(options: TemplateFormOptions): TemplateForm {
  let data = options.data
  /** いま編集している画面（組み立て直しても残す） */
  let activeScreen = 0
  /** いま広げている部品（画面の中の何番目か）。null は何も選んでいない */
  let selectedBlock: number | null = null
  /** 部品の並び・部品を足す を左の列に出す（右は選んだ部品の設定だけ） */
  const split = options.partsHost
  /** 畳める段の開き具合（組み立て直しても残す）。左右に分けたときは、部品を選んでいないと右が空くので開いておく */
  let globalOpen = split !== undefined
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
    // 飾りつきの文字（見出しなど）は、入力欄では飾りを外して出す。打ち直したら、変わった所だけを差し替える
    // （見たまま画面で付けた太字・色・大きさを消さない＝2026-09-24）
    const rich = (field.kind === 'text' || field.kind === 'textarea') && field.rich === true
    const env: ControlEnv = {
      read: () => {
        const value = getAt(data, path)
        return rich && typeof value === 'string' ? plainTextOfRich(value) : value
      },
      write: (value) => {
        const before = getAt(data, path)
        write(path, rich && typeof value === 'string' ? applyPlainEdit(typeof before === 'string' ? before : '', value) : value)
      },
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

  /** 部品を選び直して組み立て直す（画面はそのまま）。null は選ぶのをやめる */
  const reselect = (block: number | null): void => {
    selectedBlock = block
    build()
    notifySelect()
  }

  /** 部品を消す（被せた移行先も一緒＝「消す」ボタンと同じ）。消したら選ぶのをやめる。消したら true */
  const removePart = (screenIndex: number, blockIndex: number): boolean => {
    const field = options.fields.find((f): f is ScreensField => f.kind === 'screens')
    if (field === undefined) return false
    const listPath: Path = [field.key, screenIndex, 'blocks']
    const list = (getAt(data, listPath) as readonly ItemData[] | undefined) ?? []
    if (list[blockIndex] === undefined || !replace(setAt(data, listPath, removeGroup(list, blockIndex)))) return false
    reselect(null)
    return true
  }

  /** 白紙に戻す（画面①だけ・部品なし。背景などWidget全体の設定はそのまま） */
  const resetToBlank = (field: ScreensField): void => {
    if (!replace(setAt(data, [field.key], [{ id: 's1', name: screenLabel(1), blocks: [] }]))) return
    const changed = activeScreen !== 0
    activeScreen = 0
    selectedBlock = null
    build()
    if (changed) options.onScreenChange?.('s1')
    notifySelect()
  }

  /** 中身をまるごと入れ替えて画面①を開く（白紙の「何から作りますか？」で例を選んだとき） */
  const startFrom = (field: ScreensField, next: TemplateData): void => {
    if (!replace(next)) return
    activeScreen = 0
    selectedBlock = null
    build()
    options.onScreenChange?.(str(items(data, field.key)[0] ?? {}, 'id'))
    notifySelect()
  }

  /** 分けた部品へ渡す入口（中身は読むたびに最新。組み立て直しは build を呼ぶ） */
  const core: FormCore = { data: () => data, replace, restructure, refreshAll, onRefresh: (fn) => refreshers.push(fn) }
  const listDeps: ListFieldDeps = { ...core, fieldEl, nextListKey: () => `l${(listSeq += 1)}` }
  const listEl = (field: ListField, basePath?: Path): HTMLElement => listFieldEl(listDeps, field, basePath)
  const screenSettings = createScreenSettings({ ...core, screensKey, activeScreen: () => activeScreen, openScreen, fieldEl })
  const samples = createSampleFields({ ...core, write, rebuild: () => build(), options })
  const inspector = createBlockInspector({ ...core, fieldEl, listEl, samples, screen: screenSettings })
  const adder = createBlockAdder({ ...core, isSplit: split !== undefined, root, selectedBlock: () => selectedBlock, reselect, startFrom, options })
  const blockListDeps: BlockListDeps = {
    ...core,
    isSplit: split !== undefined,
    selectedBlock: () => selectedBlock,
    reselect,
    openScreen,
    removePart,
    resetToBlank,
    blockBody: inspector.body,
    adder: adder.adder,
  }

  /** 画面①②…のタブと、いま編集している画面 */
  const screensEl = (field: ScreensField): HTMLElement => {
    const wrap = node('div', 'ncf-field ncf-screens')
    const screens = items(data, field.key)
    activeScreen = Math.min(Math.max(activeScreen, 0), Math.max(screens.length - 1, 0))

    const tabs = screenSettings.tabs(field, screens)
    if (options.tabsHost !== undefined) {
      options.tabsHost.replaceChildren(tabs)
    } else {
      wrap.append(node('span', 'ncf-label', field.label), tabs)
    }

    const index = activeScreen
    if (screens[index] === undefined) return wrap
    const note = screenSettings.note(field, index)
    const panel = node('div', 'ncf-screen')
    if (split !== undefined) {
      // 左の列: 並び（頭だけ）と「部品を足す」。右: 白紙なら「何から作りますか？」、部品を選んでいればその設定、
      // 選んでいなければ画面の知らせと設定（Widget全体の設定は build が足す）
      split.list.replaceChildren(blockListEl(blockListDeps, field, index))
      split.palette.replaceChildren(adder.palette(field, index))
      if (isBlank(data, field)) {
        panel.append(adder.startChooser(field))
      } else if (selectedBlock !== null) {
        const settings = inspector.inspector(field, index, selectedBlock)
        if (settings !== null) panel.append(settings)
      } else {
        panel.append(note, screenSettings.settings(field, screens, index))
      }
      wrap.append(panel)
      return wrap
    }
    // 白紙のときは「何から作りますか？」を先に出す（画面の設定・知らせは要らない）
    if (isBlank(data, field)) {
      panel.append(adder.startChooser(field), blockListEl(blockListDeps, field, index))
      wrap.append(panel)
      return wrap
    }
    panel.append(note, screenSettings.settings(field, screens, index), blockListEl(blockListDeps, field, index))
    wrap.append(panel)
    return wrap
  }

  const build = (): void => {
    options.onPreviewReset?.()
    const scroller = root.closest<HTMLElement>('[data-ncf-scroll]') ?? root.closest<HTMLElement>('.ncf-form')
    const scrollTop = scroller?.scrollTop ?? 0
    refreshers = []
    listSeq = 0
    samples.resetApis()
    const screens = options.fields.filter((field): field is ScreensField => field.kind === 'screens')
    const others = options.fields.filter((field) => field.kind !== 'screens' && field.kind !== 'sample' && field.kind !== 'goto')
    // 左右に分けたとき、部品を選んでいる間の右はその部品の設定だけ（Widget全体の設定は、部品を選んでいないときに出す）
    const showGlobal = split === undefined || selectedBlock === null
    const otherEls = showGlobal ? others.map((field) => (field.kind === 'list' ? listEl(field) : fieldEl(field, [field.key]))) : []
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
      ;(split?.list ?? root).querySelector<HTMLElement>('.ncf-item--selected')?.scrollIntoView({ block: 'nearest' })
    },
    selectInside: (screenIndex, blockIndex, target) => {
      const key = JSON.stringify(['screens', screenIndex, 'blocks', blockIndex])
      if (screenIndex === activeScreen && blockIndex === selectedBlock && samples.selectInner(key, target)) return
      samples.setPending(key, target)
      openScreen(screenIndex, blockIndex)
      root.querySelector<HTMLElement>('.ncf-item--selected')?.scrollIntoView({ block: 'nearest' })
    },
    load: (next, screenIndex, blockIndex) => {
      replace(next)
      activeScreen = screenIndex
      selectedBlock = blockIndex
      build()
      notifySelect()
    },
    activeScreen: () => activeScreen,
    selectedBlock: () => selectedBlock,
    removeBlock: (blockIndex) => removePart(activeScreen, blockIndex),
    insertBlock: (typeName, at, init) => {
      const field = options.fields.find((f): f is ScreensField => f.kind === 'screens')
      const type = field?.types.find((t) => t.type === typeName)
      if (field === undefined || type === undefined) return
      if (items(items(data, field.key)[activeScreen] ?? {}, 'blocks').length >= field.blockMax) {
        toast(`部品は1画面に${field.blockMax}こまでです`, 'error')
        return
      }
      adder.add(field, activeScreen, type, at, init)
    },
  }
}
