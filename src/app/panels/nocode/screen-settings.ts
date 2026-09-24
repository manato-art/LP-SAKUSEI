/**
 * 画面①②…にかかわる入力欄（2026-09-24・template-form.ts から分けた）。
 *  - 画面のタブ（＋ 画面を足す）・画面の知らせ（最初に出る／どこから移ってくるか）・「この画面の設定」（名前・左へ・右へ・複製・消す）
 *  - 部品の「この部品を出す画面」「押したとき」（なし・画面②③…・＋新しい画面・リンク＋「LPの上で」＝lp-press-rows.ts）
 *  - 部品の下の「◯◯を開いて編集する →」（移る先の画面を開く）
 * 「この画面の設定」の開き具合は、組み立て直しても残す（ここで持つ）
 */
import { confirmCard } from '../../dialog.ts'
import { toast } from '../../ui.ts'
import { node, type ScalarField } from './form-controls.ts'
import { addAt, duplicateAt, getAt, moveAt, removeAt, type Path } from './form-state.ts'
import { foldable, screenNameAt, textButton, type FormCore } from './form-core.ts'
import { buildLpPressRows } from './lp-press-rows.ts'
import { chipRow, type Chip } from './press-chips.ts'
import {
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
import { groupEndOf } from './hotspot-model.ts'
import { SCREEN_ID } from './templates/builder-blocks.ts'
import { items, str, type ItemData, type ScreensField } from './templates/types.ts'

export interface ScreenSettingsDeps extends FormCore {
  /** 画面を持つ欄の key（「開いて編集する」で移る先の画面を探す） */
  readonly screensKey: string
  /** いま編集している画面 */
  readonly activeScreen: () => number
  /** 画面を開く（block はその画面で選んでおく部品） */
  readonly openScreen: (index: number, block?: number | null) => void
  /** 1つの入力欄（template-form.ts の fieldEl。画面の名前に使う） */
  readonly fieldEl: (field: ScalarField, path: Path) => HTMLElement
}

export interface ScreenSettings {
  /** 画面①②…のタブと「＋ 画面を足す」 */
  readonly tabs: (field: ScreensField, screens: readonly ItemData[]) => HTMLElement
  /** その画面の知らせ（最初に出る／ほかの画面から移ってくる／まだどこからも移れない） */
  readonly note: (field: ScreensField, index: number) => HTMLElement
  /** 畳んだ「この画面の設定（◯◯）」 */
  readonly settings: (field: ScreensField, screens: readonly ItemData[], index: number) => HTMLElement
  /** 部品の「この部品を出す画面」 */
  readonly place: (field: ScreensField, screenIndex: number, blockIndex: number, noun: string) => HTMLElement
  /** 部品の「押したとき」 */
  readonly press: (field: ScreensField, screenIndex: number, itemPath: Path, label: string) => HTMLElement
  /** 部品の下の「◯◯を開いて編集する →」 */
  readonly goto: (itemPath: Path) => HTMLElement
}

export function createScreenSettings(deps: ScreenSettingsDeps): ScreenSettings {
  let screenSettingsOpen = false

  const tabs = (field: ScreensField, screens: readonly ItemData[]): HTMLElement => {
    const el = node('div', 'ncf-screen-tabs')
    el.setAttribute('role', 'tablist')
    el.setAttribute('aria-label', '編集する画面')
    screens.forEach((screen, index) => {
      const tab = textButton(screenNameAt(screen, index), 'ncf-screen-tab', () => deps.openScreen(index))
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-selected', String(index === deps.activeScreen()))
      deps.onRefresh(() => {
        tab.textContent = screenNameAt(items(deps.data(), field.key)[index], index)
      })
      el.append(tab)
    })
    const full = screens.length >= field.max
    const add = textButton(
      full ? `画面は${field.max}こまで` : '＋ 画面を足す',
      'ncf-screen-add',
      () => {
        const screen = { id: nextScreenId(screens.map((s) => str(s, 'id'))), name: nextScreenName(screens.map((s) => str(s, 'name'))), blocks: [] }
        if (deps.replace(addAt(deps.data(), [field.key], screen, field.max))) deps.openScreen(screens.length)
      },
      !full,
    )
    el.append(add)
    return el
  }

  const note = (field: ScreensField, index: number): HTMLElement => {
    const el = node('p', 'ncf-screen-note')
    deps.onRefresh(() => {
      const id = str(items(deps.data(), field.key)[index] ?? {}, 'id')
      const reachable = index === 0 || incomingCount(deps.data(), id) > 0
      el.classList.toggle('ncf-screen-note--warn', !reachable)
      el.textContent =
        index === 0
          ? 'いちばん左の画面が、最初に出ます。'
          : reachable
            ? 'この画面へは、ほかの画面の部品の「押したとき」から移ってきます。'
            : 'まだどの部品からも、この画面へ移れません。ほかの画面のボタンなどの「押したとき」で、この画面を選んでください。'
    })
    return el
  }

  /** いま編集している画面の設定（名前・左へ・右へ・複製・消す） */
  const screenHead = (field: ScreensField, screens: readonly ItemData[], index: number): HTMLElement => {
    const ids = screens.map((screen) => str(screen, 'id'))
    const row = node('div', 'ncf-screen-head')
    row.append(deps.fieldEl({ kind: 'text', key: 'name', label: '画面の名前', placeholder: screenLabel(index + 1) }, [field.key, index, 'name']))
    const move = (direction: -1 | 1): void => {
      if (deps.replace(moveAt(deps.data(), [field.key], index, direction))) deps.openScreen(index + direction)
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
          if (deps.replace(duplicateAt(deps.data(), [field.key], index, field.max, copyName))) deps.openScreen(index + 1)
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
            if (ok && deps.replace(removeAt(deps.data(), [field.key], index, field.min))) deps.openScreen(Math.max(0, index - 1))
          })
        },
        screens.length > field.min,
      ),
    )
    row.append(actions)
    return row
  }

  const settings = (field: ScreensField, screens: readonly ItemData[], index: number): HTMLElement =>
    foldable(
      `この画面の設定（${screenNameAt(screens[index], index)}）`,
      () => screenSettingsOpen,
      (open) => {
        screenSettingsOpen = open
      },
      [screenHead(field, screens, index)],
    )

  /** 部品の「この部品を出す画面」（押すと、その画面のいちばん下へ移る。「＋新しい画面」は画面を足して移す） */
  const place = (field: ScreensField, screenIndex: number, blockIndex: number, noun: string): HTMLElement => {
    const chips = (): Chip[] => [
      ...items(deps.data(), field.key).map((screen, index) => ({ value: String(index), label: screenNameAt(screen, index) })),
      { value: 'new', label: '＋新しい画面', adds: true, disabled: items(deps.data(), field.key).length >= field.max },
    ]
    const row = chipRow({
      label: 'この部品を出す画面',
      chips: chips(),
      selected: String(screenIndex),
      onPick: (value) => {
        if (value === String(screenIndex)) return
        const data = deps.data()
        const to = Number(value)
        const moved =
          value === 'new'
            ? moveBlockToNewScreen(data, field.key, screenIndex, blockIndex, field.max, field.blockMax)
            : { data: moveBlockToScreen(data, field.key, screenIndex, blockIndex, to, field.blockMax), index: to }
        if (moved === null || moved.data === data) {
          toast(`移せませんでした（1画面に${field.blockMax}こまでです）`, 'error')
          return
        }
        // 移した部品を、移した先の画面で選んだままにする（いちばん下に入る。被せた移行先ごと移るので、その分だけ上）
        const blocks = items(items(data, field.key)[screenIndex] ?? {}, 'blocks')
        const carried = groupEndOf(blocks, blockIndex) - blockIndex
        const movedIndex = items(items(moved.data, field.key)[moved.index] ?? {}, 'blocks').length - carried
        if (deps.replace(moved.data)) deps.openScreen(moved.index, movedIndex)
        toast(`${noun}を「${screenNameAt(items(deps.data(), field.key)[moved.index], moved.index)}」のいちばん下へ移しました`)
      },
    })
    deps.onRefresh(() => row.update(chips(), String(screenIndex)))
    return row.el
  }

  /** 部品の「押したとき」（なし・画面②③…・＋新しい画面・リンクを開く） */
  const press = (field: ScreensField, screenIndex: number, itemPath: Path, label: string): HTMLElement => {
    const item = (): ItemData => (getAt(deps.data(), itemPath) as ItemData | undefined) ?? {}
    const state = (): { chips: Chip[]; selected: string; warn: string } => {
      const data = deps.data()
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
          const added = addScreenFor(deps.data(), field.key, itemPath, field.max)
          if (added !== null) deps.restructure(added.data)
          return
        }
        if (deps.replace(withPress(deps.data(), itemPath, value))) deps.refreshAll()
      },
    })
    deps.onRefresh(() => {
      const next = state()
      row.update(next.chips, next.selected, next.warn)
    })
    const wrap = node('div', 'ncf-press')
    // ロード中の「終わったら」は画面かリンクだけ（LP上のアクションは出さない）
    const isLoading = str(item(), 'type') === 'loading'
    wrap.append(row.el, ...(isLoading ? [] : buildLpPressRows({ ...deps, field, screenIndex, itemPath })))
    return wrap
  }

  /** 部品の下の「◯◯を開いて編集する →」（押したら移る部品だけ。移る先の画面を開く） */
  const goto = (itemPath: Path): HTMLElement => {
    const targetIndex = (): number => {
      const item = (getAt(deps.data(), itemPath) as ItemData | undefined) ?? {}
      // 小窓で見せる画面も、ここから開いて中身を直せる
      const target = str(item, 'action') === 'modal' ? str(item, 'target') : pressOf(item)
      return SCREEN_ID.test(target) ? items(deps.data(), deps.screensKey).findIndex((screen) => str(screen, 'id') === target) : -1
    }
    const b = textButton('', 'ncf-goto', () => {
      const index = targetIndex()
      if (index >= 0) deps.openScreen(index)
    })
    deps.onRefresh(() => {
      const index = targetIndex()
      b.hidden = index < 0 || index === deps.activeScreen()
      if (!b.hidden) b.textContent = `「${screenNameAt(items(deps.data(), deps.screensKey)[index], index)}」を開いて編集する →`
    })
    return b
  }

  return { tabs, note, settings, place, press, goto }
}
