/**
 * Version の勝ち負けの判定（2026-09-24・E「有意差判定」）。
 *
 * 【方法】2つの割合の差の z 検定（両側）。広告の A/B 比較で標準的に使われるやり方。
 *   比べる割合は CVR ＝ CV ÷ CLICK（SquadBeyond の定義）。
 *   基準はコントロールの Version（ページを作ったときの最初の Version）。
 *     p̂ = (CV_基準 + CV_比較) / (CLICK_基準 + CLICK_比較)      … 2つを合わせた割合（プール）
 *     SE = √( p̂ (1 − p̂) (1/CLICK_基準 + 1/CLICK_比較) )
 *     z  = (CVR_比較 − CVR_基準) / SE
 *     p値 = 2 × (1 − Φ(|z|))                                   … Φ は標準正規分布の累積
 *   p値 < 0.05（95%）で「差あり」。z の向きで勝ち／負け。
 * 【使えないとき】正規分布で近似できる目安（どちらも CLICK 30以上・CVした数としなかった数の見込みが5以上）に
 *   届かなければ「サンプル不足」として判定しない（少ない数で「勝ち」と言わない）。
 * 【注意】何度も見て「差あり」になった時点で止めると、95%より当たりやすく見える（見続けるほど偶然の差を拾う）。
 */
import type { ReportVersionRow } from '../api.ts'

/** 95% で差ありとする境目 */
const ALPHA = 0.05
/** 1つの Version に要る CLICK の目安 */
const MIN_CLICKS = 30
/** CVした数・しなかった数の見込みの目安 */
const MIN_EXPECTED = 5

/**
 * 標準正規分布の累積 Φ(z)。
 * 誤差関数の近似（Abramowitz & Stegun 7.1.26・誤差 1.5×10⁻⁷ 以内）から出す。
 */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x)
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf)
}

export type CvrComparison =
  | { kind: 'too_small' }
  | { kind: 'tested'; z: number; pValue: number; verdict: 'better' | 'worse' | 'no_difference' }

/** 基準と比べて、比較側の CVR に差があるか */
export function compareCvr(
  baseline: { cv: number; click: number },
  variant: { cv: number; click: number },
): CvrComparison {
  const nA = baseline.click
  const nB = variant.click
  if (nA < MIN_CLICKS || nB < MIN_CLICKS) return { kind: 'too_small' }
  const pooled = (baseline.cv + variant.cv) / (nA + nB)
  const expectedOk = [nA, nB].every((n) => n * pooled >= MIN_EXPECTED && n * (1 - pooled) >= MIN_EXPECTED)
  if (!expectedOk) return { kind: 'too_small' }
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB))
  const z = (variant.cv / nB - baseline.cv / nA) / se
  const pValue = 2 * (1 - normalCdf(Math.abs(z)))
  const verdict = pValue >= ALPHA ? 'no_difference' : z > 0 ? 'better' : 'worse'
  return { kind: 'tested', z, pValue, verdict }
}

type Row = Pick<ReportVersionRow, 'name' | 'entity_uid' | 'cv' | 'click'> & { is_control?: boolean }

const VERDICT_LABEL = {
  better: '勝ち（95%で差あり）',
  worse: '負け（95%で差あり）',
  no_difference: '差なし（95%では言えない）',
} as const

export interface SignificanceResult {
  name: string
  cvr: number | null
  label: string
  pValue: number | null
}

/** 表に出ている Version を、コントロールを基準に比べる。コントロールが表に無ければ baseline は null */
export function significanceRows(rows: readonly Row[]): {
  baseline: (Row & { cvr: number | null }) | null
  results: SignificanceResult[]
} {
  const control = rows.find((row) => row.is_control === true)
  if (control === undefined) return { baseline: null, results: [] }
  const cvrOf = (row: Row): number | null => (row.click === 0 ? null : row.cv / row.click)
  const results = rows
    .filter((row) => row.entity_uid !== control.entity_uid)
    .map((row) => {
      const out = compareCvr(control, row)
      return {
        name: row.name,
        cvr: cvrOf(row),
        label: out.kind === 'too_small' ? 'サンプル不足（CLICK 30以上・CV 5件以上が目安）' : VERDICT_LABEL[out.verdict],
        pValue: out.kind === 'tested' ? out.pValue : null,
      }
    })
  return { baseline: { ...control, cvr: cvrOf(control) }, results }
}

const pct = (v: number | null): string => (v === null ? '-' : `${(v * 100).toFixed(2)}%`)

/** 「Versionの差（CVR）」の枠（見た目はレポートの他の枠と同じ部品） */
export function buildSignificanceCard(rows: readonly Row[]): HTMLElement {
  const card = document.createElement('section')
  card.className = 'rv2-card'
  const head = document.createElement('div')
  head.className = 'rv2-head'
  const title = document.createElement('span')
  title.className = 'rv2-title'
  title.textContent = 'Versionの差（CVR）'
  head.append(title)

  const body = document.createElement('div')
  body.className = 'rv2-scroll'
  const { baseline, results } = significanceRows(rows)
  if (baseline === null || results.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'rv2-note'
    empty.textContent =
      baseline === null
        ? '基準にするコントロールのVersion（ページを作ったときの最初のVersion）が表に無いので、判定できません。'
        : '比べるVersionがありません（コントロールのほかにVersionを作ると判定します）。'
    body.append(empty)
  } else {
    const table = document.createElement('table')
    table.className = 'rv2-table'
    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    for (const [text, isNum] of [['Version', false], ['CVR', true], ['基準との差', false], ['p値', true]] as const) {
      const th = document.createElement('th')
      th.textContent = text
      if (isNum) th.className = 'num'
      headRow.append(th)
    }
    thead.append(headRow)
    const tbody = document.createElement('tbody')
    const line = (cells: readonly [string, string, boolean][]): HTMLTableRowElement => {
      const tr = document.createElement('tr')
      for (const [label, text, isNum] of cells) {
        const td = document.createElement('td')
        td.dataset['label'] = label
        td.textContent = text
        if (isNum) td.className = 'num'
        tr.append(td)
      }
      return tr
    }
    tbody.append(
      line([
        ['Version', `${baseline.name}（基準）`, false],
        ['CVR', pct(baseline.cvr), true],
        ['基準との差', '-', false],
        ['p値', '-', true],
      ]),
    )
    for (const result of results) {
      tbody.append(
        line([
          ['Version', result.name, false],
          ['CVR', pct(result.cvr), true],
          ['基準との差', result.label, false],
          ['p値', result.pValue === null ? '-' : result.pValue.toFixed(3), true],
        ]),
      )
    }
    table.append(thead, tbody)
    body.append(table)
  }
  const method = document.createElement('div')
  method.className = 'rv2-note'
  method.textContent =
    '判定の方法: CVR（CV÷CLICK）の差を、コントロールのVersionと2つの割合の z 検定（両側）で比べ、p値が0.05未満なら「95%で差あり」。' +
    'CLICKが30未満など数が少ないときは判定しません。何度も見て差が出た時点で止めると、偶然の差を拾いやすくなります。'
  card.append(head, body, method)
  return card
}
