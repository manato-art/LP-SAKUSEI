/**
 * 「押したとき」「この部品を出す画面」のボタンの並び（2026-09-22・本人の依頼）。
 *
 * 本人の依頼「画像や動画・ボタンなどの要素を、画面2・3・4・5…として簡単に設定したい」
 * （決定: 両方＝押したら画面②③…へ移る／その部品を画面②③…に置く・部品の一覧で画面のボタンを押すだけ）。
 * 選ぶ欄（select）は開かないと中が見えないので、候補をボタンで横に並べ、選んでいるものは色で示す（aria-pressed）。
 * 「＋新しい画面」は選ぶものではなく、押すと画面が1つ増える（点線で見分ける）。
 */
import { node } from './form-controls.ts'

export interface Chip {
  readonly value: string
  readonly label: string
  /** 「＋新しい画面」（押すと画面が増える。選んでいる印は付かない） */
  readonly adds?: boolean
  readonly disabled?: boolean
}

export interface ChipRow {
  readonly el: HTMLElement
  /** 候補・選んでいるもの・知らせを入れ直す（変わっていなければ何もしない＝押した直後の場所を保つ） */
  update: (chips: readonly Chip[], selected: string, warn?: string) => void
}

let idSeq = 0

export function chipRow(options: {
  label: string
  chips: readonly Chip[]
  selected: string
  onPick: (value: string) => void
  warn?: string
}): ChipRow {
  const wrap = node('div', 'ncf-field')
  const label = node('span', 'ncf-label', options.label)
  label.id = `ncc-${(idSeq += 1)}`
  const group = node('div', 'ncf-chips')
  group.setAttribute('role', 'group')
  group.setAttribute('aria-labelledby', label.id)
  const warn = node('span', 'ncf-warn')
  let signature = ''

  const update = (chips: readonly Chip[], selected: string, warnText = ''): void => {
    warn.textContent = warnText
    warn.hidden = warnText === ''
    const next = JSON.stringify([chips, selected])
    if (next === signature) return
    signature = next
    const active = document.activeElement
    const focused = active instanceof HTMLElement && group.contains(active) ? active.dataset['value'] : undefined
    group.replaceChildren(
      ...chips.map((chip) => {
        const b = node('button', chip.adds === true ? 'ncf-chip ncf-chip--add' : 'ncf-chip', chip.label)
        b.type = 'button'
        b.dataset['value'] = chip.value
        b.disabled = chip.disabled === true
        if (chip.adds !== true) b.setAttribute('aria-pressed', String(chip.value === selected))
        b.addEventListener('click', () => options.onPick(chip.value))
        return b
      }),
    )
    if (focused !== undefined) {
      for (const b of group.querySelectorAll<HTMLButtonElement>('.ncf-chip')) if (b.dataset['value'] === focused) b.focus()
    }
  }

  update(options.chips, options.selected, options.warn)
  wrap.append(label, group, warn)
  return { el: wrap, update }
}
