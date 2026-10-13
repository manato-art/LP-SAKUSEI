/**
 * ヒートマップの「ソート」（横に並ぶ案＝Version の列の並び順を選ぶ一覧）の配線。
 *
 * 採取した一覧は実物の9択（手動＋8つの並び順）。画面に出すときに次の2つを直す（2026-10-13）。
 *
 * 1. 「手動」を外す。実物では列を手でつかんで並べ替える選択肢だが、その仕組みは作っていない。
 *    選んでも「Versionの古い順」と同じ並びになるだけだった（本人の判断で外した。採取した断片は書き換えない）。
 * 2. 行のどこを押しても選べるようにする。採取物の label はラジオと結び付いていないので、
 *    文字を押しても選べなかった（押せるのは小さな丸だけ）。
 *
 * 一覧が右に切れて読めなかった件は、ドロップダウン共通の仕組みで直している（dropdown-placement.ts）。
 */

/** 最初に選んでおく並び順（「手動」のときと同じ並び＝今までの見え方と変わらない） */
export const DEFAULT_SORT_LABEL = 'Versionの古い順'

/** 画面に出さない選択肢 */
const MANUAL_LABEL = '手動'

interface SortRow {
  label: string
  item: HTMLElement
  radio: HTMLInputElement
}

function readRows(modal: HTMLElement): SortRow[] {
  return [...modal.querySelectorAll<HTMLElement>('li')].flatMap((item) => {
    const radio = item.querySelector<HTMLInputElement>('input[type="radio"]')
    if (radio === null) return []
    return [{ label: (item.querySelector('label')?.textContent ?? item.textContent ?? '').trim(), item, radio }]
  })
}

/** 選ばれている1つだけに印を付ける（採取物のラジオは name が無く、排他にならない） */
function check(rows: readonly SortRow[], picked: SortRow): void {
  for (const row of rows) row.radio.checked = row === picked
}

export function wireSortModal(root: HTMLElement, onChange: (label: string) => void): void {
  const modal = root.querySelector<HTMLElement>('[class*="_sortModal_"]')
  if (modal === null) return

  for (const row of readRows(modal)) {
    if (row.label === MANUAL_LABEL) row.item.remove()
  }
  const rows = readRows(modal)
  const initial = rows.find((row) => row.label === DEFAULT_SORT_LABEL) ?? rows[0]
  if (initial === undefined) return
  check(rows, initial)

  let current = initial
  for (const row of rows) {
    row.item.style.cursor = 'pointer'
    row.item.addEventListener('click', () => {
      // ラジオを直に押したときはブラウザが先に印を付けるので、どの行から来ても同じ所でそろえ直す
      check(rows, row)
      if (row === current) return
      current = row
      onChange(row.label)
    })
  }
}
