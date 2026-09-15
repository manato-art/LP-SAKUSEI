/**
 * スマホでレポートの表を1行＝1カードにしたときの、指標の出し分け（2026-09-15）。
 *
 * 15列を縦に並べると1枚のカードが14行になり、9件並べば画面3枚ぶん流れる。
 * 過去に決めた方針（スマホは縦スクロール削減が最優先・カードは主要な数字だけ）に合わせて、
 * 既定では主要な指標だけを出し、カード上の切替で残りも出せるようにする。
 * PCは全列そのまま（この仕組みは `@media(max-width:768px)` の中でだけ効く）。
 */

/** 既定で出す指標。ここに無い指標は切替で出す。 */
export const PRIMARY_METRICS: readonly string[] = [
  '配信金額',
  'PV',
  'CLICK',
  'CTR',
  'CV',
  'CVR',
]

/** 指標ではない列（名前・日付など）。常に出す。 */
const ALWAYS_SHOWN: readonly string[] = [
  '名前',
  '日付',
  'バージョン',
  '配信期間',
  'アーカイブ',
  'デバイス',
]

/**
 * その列名を既定で出すか。
 * デイリーの列名は「配信金額 円」「CTR %」のように単位が付くので、先頭の語で見る。
 */
export function isPrimaryMetric(label: string): boolean {
  const name = label.split(' ')[0] ?? label
  return ALWAYS_SHOWN.includes(name) || PRIMARY_METRICS.includes(name)
}

/** 表の中の「切替で出す」セルに目印を付ける（スマホCSSがこれを見て隠す） */
export function markSecondaryCells(table: HTMLElement): void {
  for (const td of table.querySelectorAll<HTMLElement>('tbody td[data-label]')) {
    const label = td.dataset['label'] ?? ''
    if (isPrimaryMetric(label)) continue
    td.dataset['more'] = 'true'
  }
}

/**
 * 「すべての指標」の切替ボタン。PCでは出さない（CSSで隠す）。
 * 押すと表に `show-all` が付き、隠していたセルが出る。
 */
export function metricsToggle(getTable: () => HTMLElement | null): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'rv2-btn rv2-metrics-toggle'
  button.textContent = 'すべての指標'
  button.addEventListener('click', () => {
    const table = getTable()
    if (table === null) return
    const showAll = table.classList.toggle('show-all')
    button.textContent = showAll ? '主要な指標だけ' : 'すべての指標'
  })
  return button
}
