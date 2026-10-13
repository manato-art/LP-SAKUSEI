/**
 * ヒートマップの「ソート」（横に並ぶ案＝Version の列の並び順を選ぶ一覧）。
 *
 * 2026-10-13、本人に場所を説明するためにボタンを押して撮ったスクリーンショットで、2つ見つかった。
 *
 * 1. **一覧が右に切れて、文字が読めない**。一覧（幅225px）は矢印の印の左端から右へ開くが、
 *    印は画面の右端にあり、外側の枠がはみ出しを隠すので、丸い印だけが見えて文字がほぼ全部隠れていた
 *    （1280px幅で 一覧 1199〜1424px・枠の右端 1239px）。画面を広げても同じ。
 *    → ドロップダウン共通の仕組みで直した（tests/dropdown-placement.test.ts）。
 * 2. **「手動」は名前どおりに動かない**。実物では列を手でつかんで並べ替える選択肢だが、その仕組みは作っていない。
 *    選んでも「Versionの古い順」と同じ並びになるだけで、「※まだできません」の注意書きを出していた。
 *
 * 本人の判断（2026-10-13）: 「手動」は消す・一覧が切れるのは直す。
 * 採取した断片（実物の9択）は書き換えず、画面に出すときに外す。
 */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installDom } from './helpers/dom.ts'
import { DEFAULT_SORT_LABEL, wireSortModal } from '../src/app/pages/heatmap-sort-modal.ts'

const FRAGMENT = readFileSync(
  'src/app/fragments/ab_tests__UID__articles__htmls__heatmaps__comparisons__default.html',
  'utf8',
)

interface Row {
  label: string
  item: HTMLElement
  radio: HTMLInputElement
}

let root: HTMLElement
let onChange: ReturnType<typeof vi.fn<(label: string) => void>>

function rows(): Row[] {
  const modal = root.querySelector('[class*="_sortModal_"]')
  if (modal === null) throw new Error('土台にソートの一覧がありません')
  return [...modal.querySelectorAll<HTMLElement>('li')].map((item) => {
    const radio = item.querySelector<HTMLInputElement>('input[type="radio"]')
    if (radio === null) throw new Error('行にラジオがありません')
    return { label: (item.querySelector('label')?.textContent ?? '').trim(), item, radio }
  })
}

const checkedLabels = (): string[] => rows().filter((row) => row.radio.checked).map((row) => row.label)
const press = (el: Element): void => {
  el.dispatchEvent(new Event('click', { bubbles: true }))
}

beforeEach(() => {
  const document = installDom()
  document.body.innerHTML = FRAGMENT
  root = document.body
  onChange = vi.fn<(label: string) => void>()
  wireSortModal(root, onChange)
})

describe('ヒートマップのソートの一覧', () => {
  it('「手動」は出さない（できない並べ替えを選択肢に置かない）', () => {
    expect(rows().map((row) => row.label)).toEqual([
      'Versionの新しい順',
      'Versionの古い順',
      'PVの多い順',
      'PVの少ない順',
      'CTRの高い順',
      'CTRの低い順',
      'CVの多い順',
      'CVの少ない順',
    ])
  })

  it('最初は「Versionの古い順」が選ばれている（「手動」のときと同じ並び）', () => {
    expect(DEFAULT_SORT_LABEL).toBe('Versionの古い順')
    expect(checkedLabels()).toEqual(['Versionの古い順'])
  })

  it('「まだできません」の注意書きを出さない', () => {
    expect(root.querySelector('[class*="_sortModal_"]')?.textContent).not.toContain('まだできません')
  })

  it('行のどこを押しても選べる（文字を押しても選べなかった。丸い印は14pxしかない）', () => {
    const target = rows().find((row) => row.label === 'PVの多い順')
    const label = target?.item.querySelector('label') ?? null
    if (target === undefined || label === null) throw new Error('「PVの多い順」がありません')

    press(label)

    expect(checkedLabels()).toEqual(['PVの多い順'])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('PVの多い順')
  })

  it('選んであるものをもう一度押しても、並べ直しはしない', () => {
    const current = rows().find((row) => row.label === 'Versionの古い順')
    if (current === undefined) throw new Error('「Versionの古い順」がありません')

    press(current.item)

    expect(checkedLabels()).toEqual(['Versionの古い順'])
    expect(onChange).not.toHaveBeenCalled()
  })
})
