/**
 * 「型から作る」「部品を積んで作る」の入力欄（2026-09-22・本人の依頼。ノーコードでWidgetを作る③④）。
 *
 * 型の fields（templates/types.ts）から入力欄を組み立てる。型ごとの画面は書かない。
 *  - 文字を打つたびに中身を作り直して知らせる（onChange）。入力欄そのものは作り直さない（打っている途中で外れない）
 *  - 「ほかの入力しだいで出す欄」「ほかの入力から付く名前・選べるもの」は、そのたびに出し分け・直すだけ
 *  - 並びの足す・消す・上下・複製、画面の切り替えは、入力欄を組み立て直す
 *  - 画面（「部品を積んで作る」）: 画面①②…をタブで切り替えて編集する。部品が画面へ移るなら、
 *    その下の「◯◯を開いて編集する →」で移る先の画面を開ける（本人の依頼「移行先の編集も行いたい」）
 *  - 部品ごとに「この部品を出す画面」と「押したとき」をボタンで選ぶ（本人の依頼「画面2・3・4・5…として簡単に設定」。
 *    決定: 両方＝押したら画面②③…へ移る／その部品を画面②③…に置く）。どちらにも「＋新しい画面」がある
 * 値の場所は道のり（path）で持つ: ['title'] / ['items', 1, 'q'] / ['screens', 0, 'blocks', 2, 'label']
 */
import { confirmCard } from '../../dialog.ts'
import { toast } from '../../ui.ts'
import { node, scalarControl, type ControlEnv, type Scalar, type ScalarField } from './form-controls.ts'
import { addAt, duplicateAt, getAt, moveAt, removeAt, setAt, type Path } from './form-state.ts'
import { sampleEditor } from './form-sample.ts'
import { chipRow, type Chip } from './press-chips.ts'
import { splitSampleScreens } from './sample-to-screens.ts'
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
import { SCREEN_ID } from './templates/builder-blocks.ts'
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

export function buildTemplateForm(options: {
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
}): HTMLElement {
  let data = options.data
  /** いま編集している画面（組み立て直しても残す） */
  let activeScreen = 0
  /** 見本の部品ごとの、いま直している設問（組み立て直しても残す） */
  const activeSteps = new Map<string, number>()
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
  const openScreen = (index: number): void => {
    activeScreen = index
    build()
    const id = str(items(data, screensKey)[index] ?? {}, 'id')
    if (id !== '') options.onScreenChange?.(id)
  }

  /** 1つの入力欄（名前・入力・説明）。出し分けと名前の付け直しを登録する。itemPath は並びの中の1件 */
  const fieldEl = (field: ScalarField, path: Path, itemPath?: Path): HTMLElement => {
    const wrap = node('div', 'ncf-field')
    const id = nextId()
    const env: ControlEnv = {
      read: () => getAt(data, path),
      write: (value) => write(path, value),
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
    b.addEventListener('click', onClick)
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
  ): HTMLElement => {
    const head = node('div', 'ncf-item__head')
    const canCopy = count < limits.max
    const canRemove = count > limits.min
    const copy = textButton('複製', 'ncf-icon-btn ncf-item__copy', () => restructure(duplicateAt(data, listPath, index, limits.max)), canCopy)
    copy.title = canCopy ? `この${limits.noun}をすぐ下に複製` : `${limits.max}つまでです`
    const remove = textButton('消す', 'ncf-icon-btn ncf-item__remove', () => restructure(removeAt(data, listPath, index, limits.min)), canRemove)
    remove.title = canRemove ? `この${limits.noun}を消す` : `${limits.min}つより少なくはできません`
    head.append(
      name,
      copy,
      iconButton(ICON_UP, '上へ', () => restructure(moveAt(data, listPath, index, -1)), index > 0),
      iconButton(ICON_DOWN, '下へ', () => restructure(moveAt(data, listPath, index, 1)), index < count - 1),
      remove,
    )
    return head
  }

  /** 並び（よくある質問の1問など） */
  const listEl = (field: ListField): HTMLElement => {
    const wrap = node('div', 'ncf-field')
    wrap.dataset['ncfList'] = field.key
    const listPath: Path = [field.key]
    const list = items(data, field.key)
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
        item.append(fieldEl(sub, [field.key, index, sub.key], [field.key, index]))
      }
      box.append(item)
    })
    const full = list.length >= field.max
    const add = textButton(
      full ? `${field.itemLabel}は${field.max}つまでです` : `＋ ${field.itemLabel}を足す`,
      'ncf-add',
      () => restructure(addAt(data, listPath, field.newItem(), field.max), `[data-ncf-list="${field.key}"] .ncf-item:last-of-type`),
      !full,
    )
    wrap.append(head, box, add)
    return wrap
  }

  /** 見本の部品（見本を選ぶ・中身を直す・設問①②…を切り替える・中の画像やボタンの押したとき） */
  const sampleFieldEl = (field: ScreensField, screenIndex: number, itemPath: Path): HTMLElement => {
    const key = JSON.stringify(itemPath)
    const item = (): ItemData => (getAt(data, itemPath) as ItemData | undefined) ?? {}
    return sampleEditor({
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
    })
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
        restructure(moved.data)
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

  /** 画面の中の部品の並び。1件ごとに部品の名前と複製・上へ・下へ・消す、いちばん下に種類ごとの「足す」 */
  const blockListEl = (field: ScreensField, screenIndex: number): HTMLElement => {
    const wrap = node('div', 'ncf-field')
    const listPath: Path = [field.key, screenIndex, 'blocks']
    wrap.dataset['ncfList'] = 'blocks'
    const list = (getAt(data, listPath) as readonly ItemData[] | undefined) ?? []
    const head = node('div', 'ncf-listhead')
    head.append(node('span', 'ncf-label', '部品（上から順に並びます）'), node('span', 'ncf-count', `${list.length} / ${field.blockMax}`))
    const box = node('div', 'ncf-list')
    list.forEach((block, index) => {
      const type: BlockType | undefined = field.types.find((t) => t.type === block['type'])
      if (type === undefined) return
      const itemEl = node('div', 'ncf-item')
      const name = node('span', 'ncf-item__name')
      const icon = node('span', 'ncf-item__icon')
      icon.innerHTML = type.icon
      name.append(icon, node('span', '', type.label))
      itemEl.append(itemHead(name, listPath, index, list.length, { min: 0, max: field.blockMax, noun: type.label }))
      itemEl.append(placeFieldEl(field, screenIndex, index, type.label))
      const itemPath: Path = [...listPath, index]
      for (const sub of type.fields) {
        if (sub.kind === 'sample') {
          itemEl.append(sampleFieldEl(field, screenIndex, itemPath))
          continue
        }
        if (sub.kind === 'goto') {
          itemEl.append(pressFieldEl(field, screenIndex, itemPath, sub.label))
          continue
        }
        if (sub.kind === 'list' || sub.kind === 'screens') continue
        itemEl.append(fieldEl(sub, [...itemPath, sub.key], itemPath))
      }
      if (type.fields.some((f) => f.kind === 'goto')) itemEl.append(gotoEl(itemPath))
      box.append(itemEl)
    })
    const full = list.length >= field.blockMax
    const adder = node('div', 'ncf-adder')
    adder.append(node('span', 'ncf-adder__label', full ? `部品は1画面に${field.blockMax}こまでです` : '部品を足す（いちばん下に入ります）'))
    const grid = node('div', 'ncf-adder__grid')
    for (const type of field.types) {
      const focusNew = '[data-ncf-list="blocks"] .ncf-item:last-of-type'
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
              restructure(split, focusNew)
              toast(`「${sample.title}」の設問を、画面ごとの部品に分けました（${parts.length}画面）`)
              return
            }
            restructure(addAt(data, listPath, { ...type.newItem(), title: sample.title, html: sample.html }, field.blockMax), focusNew)
          })
          return
        }
        restructure(addAt(data, listPath, type.newItem(), field.blockMax), focusNew)
      }
      const b = textButton('', 'ncf-adder__btn', add, !full)
      const icon = node('span', 'ncf-adder__icon')
      icon.innerHTML = type.icon
      b.append(icon, node('span', '', type.label))
      grid.append(b)
    }
    adder.append(grid)
    wrap.append(head, box, adder)
    return wrap
  }

  /** いま編集している画面の頭（名前・左へ・右へ・複製・消す） */
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
    wrap.append(node('span', 'ncf-label', field.label), tabs)

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
    panel.append(screenHead(field, screens, index), note, blockListEl(field, index))
    wrap.append(panel)
    return wrap
  }

  const build = (): void => {
    options.onPreviewReset?.()
    const scroller = root.closest<HTMLElement>('.ncf-form')
    const scrollTop = scroller?.scrollTop ?? 0
    refreshers = []
    root.replaceChildren(
      ...options.fields.map((field) =>
        field.kind === 'list'
          ? listEl(field)
          : field.kind === 'screens'
            ? screensEl(field)
            : field.kind === 'sample' || field.kind === 'goto'
              ? node('div') // 見本・押したときは「部品を積んで作る」の部品の中だけで使う
              : fieldEl(field, [field.key]),
      ),
    )
    refreshAll()
    if (scroller !== null) scroller.scrollTop = scrollTop
  }

  build()
  return root
}
