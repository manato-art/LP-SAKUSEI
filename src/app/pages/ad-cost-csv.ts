/**
 * 広告費のCSVを読む（2026-09-15）。
 *
 * 今は Meta 連携でしか配信金額が入らないので、Google / Yahoo / X を回している案件では
 * 配信金額・CPA・MCPA・ROAS・ROI がずっと空のままだった。
 * 各媒体の管理画面から落とした日別の実績を貼り付けて入れられるようにする。
 *
 * ⚠️ これは**実物のSquadBeyondには無い**、このシステムだけの入口（本人の依頼）。
 * 実物は広告アカウントを繋いで自動で取り込む。
 *
 * 読み方の方針:
 *  - 見出しの名前で列を決める（並び順に依存しない）。日本語・英語どちらでも引ける
 *  - 区切りはカンマとタブの両方（スプレッドシートからの貼り付けがタブ区切りのため）
 *  - 読めない行はその行だけ落として理由を返す（全部捨てると原因が分からない）
 */

/** 取り込む1日ぶん。媒体が返すのは絶対値なので、同じ日は上書きする。 */
export interface AdCostRow {
  /** YYYY-MM-DD */
  date: string
  ad_cost: number
  imp: number
  media_click: number
  media_cv: number
}

export interface AdCostParseResult {
  rows: AdCostRow[]
  /** 落とした行の理由（何行目が、なぜ）。空なら全部読めた */
  errors: string[]
}

/** 見出しの別名。左から順に探して最初に見つかった列を使う。 */
const HEADERS: Readonly<Record<keyof AdCostRow, readonly string[]>> = {
  date: ['日付', 'date', 'day', '日'],
  ad_cost: ['配信金額', '費用', '広告費', 'spend', 'cost', 'amount_spent'],
  imp: ['表示回数', 'インプレッション', 'imp', 'impressions'],
  media_click: ['クリック', 'クリック数', 'click', 'clicks', 'link_clicks'],
  media_cv: ['cv', 'コンバージョン', 'conversions', 'results', '成果'],
}

/** 「¥12,345」「 1 000 」のような書き方を数にする。読めなければ0。 */
function toNumber(raw: string): number {
  const cleaned = raw.replace(/["\s,¥￥円]/g, '')
  if (cleaned === '') return 0
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : 0
}

/**
 * 1行をセルに割る。
 * 引用符の中の区切りは割らない（`"¥12,345"` が「¥12」と「345」に割れていた）。
 * 区切り文字はタブが1つでもあればタブ、無ければカンマ。
 */
function splitCells(line: string): string[] {
  const sep = line.includes('\t') ? '\t' : ','
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      // `""` は引用符そのもの
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (ch === sep && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

/** 見出し行から、各項目が何列目かを引く */
function indexOfHeaders(cells: readonly string[]): Partial<Record<keyof AdCostRow, number>> {
  const lower = cells.map((c) => c.toLowerCase())
  const found: Partial<Record<keyof AdCostRow, number>> = {}
  for (const [key, names] of Object.entries(HEADERS) as [keyof AdCostRow, readonly string[]][]) {
    const at = lower.findIndex((cell) => names.some((name) => cell === name.toLowerCase()))
    if (at !== -1) found[key] = at
  }
  return found
}

export function parseAdCostCsv(text: string): AdCostParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) return { rows: [], errors: ['中身がありません。'] }

  const header = indexOfHeaders(splitCells(lines[0] ?? ''))
  if (header.date === undefined || header.ad_cost === undefined) {
    return {
      rows: [],
      errors: ['1行目に「日付」と「配信金額」の見出しが要ります（英語の date / spend でも読めます）。'],
    }
  }

  const rows: AdCostRow[] = []
  const errors: string[] = []
  lines.slice(1).forEach((line, i) => {
    const cells = splitCells(line)
    const pick = (key: keyof AdCostRow): string => {
      const at = header[key]
      return at === undefined ? '' : (cells[at] ?? '')
    }
    const date = pick('date')
    // 日付は YYYY-MM-DD だけ受ける。`2026/9/15` は `2026-09-15` に直して受ける。
    const normalized = /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(date)
      ? date
          .split('/')
          .map((part, index) => (index === 0 ? part : part.padStart(2, '0')))
          .join('-')
      : date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      errors.push(`${i + 2}行目: 日付が読めません（${date === '' ? '空' : date}）。`)
      return
    }
    rows.push({
      date: normalized,
      ad_cost: toNumber(pick('ad_cost')),
      imp: toNumber(pick('imp')),
      media_click: toNumber(pick('media_click')),
      media_cv: toNumber(pick('media_cv')),
    })
  })
  return { rows, errors }
}
