/**
 * 押したときの「LPの上で」の段（2026-09-24・本人「LP上アクションをできるように。例えば画像を表示したりクーポンみたいな」。
 * template-form.ts から分けた）。
 *
 * 画像を大きく・動画を大きく・クーポン・小窓で見せる・LPの場所へ移動・文字をコピー・電話をかける・閉じる。
 * 上の段（画面へ移る・リンク）と同じ「押したとき」の1つを選ぶ。小窓で見せるなら、出す画面の段（＋新しい画面）も出す。
 * 選んだアクションの入力欄（画像・クーポンの割引など）は block-kit.ts の actionFields（showIfItem）が出す。
 */
import { getAt, type Path } from './form-state.ts'
import { chipRow, type Chip } from './press-chips.ts'
import { addScreenFor, goChoices, pressOf, withModalTarget, withPress } from './screens-state.ts'
import { SCREEN_ID } from './templates/builder-blocks.ts'
import { items, str, type ItemData, type ScreensField, type TemplateData } from './templates/types.ts'

export const LP_PRESS_CHIPS: readonly Chip[] = [
  { value: 'image', label: '画像を大きく' },
  { value: 'video', label: '動画を大きく' },
  { value: 'coupon', label: 'クーポン' },
  { value: 'modal', label: '小窓で見せる' },
  { value: 'scroll', label: 'LPの場所へ移動' },
  { value: 'copy', label: '文字をコピー' },
  { value: 'tel', label: '電話をかける' },
  { value: 'close', label: '閉じる' },
]

export interface LpPressRowsDeps {
  readonly field: ScreensField
  readonly screenIndex: number
  readonly itemPath: Path
  readonly data: () => TemplateData
  /** 中身を差し替える（変わったら true） */
  readonly replace: (next: TemplateData) => boolean
  /** 画面を足したときなど、組み立て直す */
  readonly restructure: (next: TemplateData) => void
  /** 入力欄の見え方をそろえる（選んだアクションの欄を出す） */
  readonly refreshAll: () => void
  /** 組み立て直さずに見え方をそろえるときに呼ぶもの */
  readonly onRefresh: (fn: () => void) => void
}

export function buildLpPressRows(deps: LpPressRowsDeps): HTMLElement[] {
  const { field, screenIndex, itemPath } = deps
  const item = (): ItemData => (getAt(deps.data(), itemPath) as ItemData | undefined) ?? {}
  const actions = chipRow({
    label: 'LPの上で',
    chips: LP_PRESS_CHIPS,
    selected: pressOf(item()),
    onPick: (value) => {
      if (deps.replace(withPress(deps.data(), itemPath, value))) deps.refreshAll()
    },
  })
  const modalState = (): { chips: Chip[]; selected: string; warn: string } => {
    const data = deps.data()
    const target = str(item(), 'target')
    const isScreen = SCREEN_ID.test(target)
    const lost = isScreen && !items(data, field.key).some((screen) => str(screen, 'id') === target)
    return {
      chips: [
        ...goChoices(data, field.key, screenIndex, isScreen ? target : null).map((choice) => ({ value: choice.id, label: choice.label })),
        { value: 'new', label: '＋新しい画面', adds: true, disabled: items(data, field.key).length >= field.max },
      ],
      selected: isScreen ? target : '',
      warn: lost ? '小窓に出す画面が消えています。選び直してください' : isScreen ? '' : '小窓に出す画面を選んでください（中身はその画面で作ります）',
    }
  }
  const first = modalState()
  const modal = chipRow({
    label: '小窓に出す画面',
    chips: first.chips,
    selected: first.selected,
    warn: first.warn,
    onPick: (value) => {
      if (value === 'new') {
        const added = addScreenFor(deps.data(), field.key, itemPath, field.max, (d, id) => withModalTarget(d, itemPath, id))
        if (added !== null) deps.restructure(added.data)
        return
      }
      if (deps.replace(withModalTarget(deps.data(), itemPath, value))) deps.refreshAll()
    },
  })
  modal.el.hidden = pressOf(item()) !== 'modal'
  deps.onRefresh(() => {
    actions.update(LP_PRESS_CHIPS, pressOf(item()))
    const next = modalState()
    modal.update(next.chips, next.selected, next.warn)
    modal.el.hidden = pressOf(item()) !== 'modal'
  })
  return [actions.el, modal.el]
}
