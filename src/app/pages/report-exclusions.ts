/**
 * レポート除外（実物の同名画面を再現）。
 *
 * 実物の構成（採取: `sidebar-ref/report-exclusions`）:
 *   タブ … アクセス拒否 / 配信除外オーディエンス設定
 *   本文 … 説明 → ホワイトリスト → 除外条件フォーム → 設定済み除外条件
 *          → リクエスト数（IP検索・期間・表示項目数・リファラ/ソースIP/パラメータ）
 *
 * プルダウンの選択肢は、実物を開いて確認したもの（2026-09-08）。
 */
import {
  api,
  type ExclusionJoin,
  type ExclusionKind,
  type ExclusionMatch,
  type ReportExclusionEntry,
} from '../api.ts'
import { toast } from '../ui.ts'
import { toDateKey, type DateRange } from './report-period.ts'

const CSS_ID = 'sb-exclusions-css'

/** 実物の期間ボタン */
const PERIODS = [
  { key: 'today', label: '今日', days: 0 },
  { key: 'week', label: '今週', days: 6 },
  { key: 'month', label: '今月', days: 29 },
  { key: 'quarter', label: '3ヶ月', days: 89 },
  { key: 'half', label: '半年', days: 179 },
  { key: 'year', label: '1年', days: 364 },
] as const

/**
 * 除外対象の呼び名。プルダウンと下段のランキングで同じ言葉を使うため、ここに集約する。
 * 実物は「リファラ」「パラメータ」だが、何を指すか分かりにくいので言い換えている。
 */
const KIND_LABELS = {
  email: 'メールアドレス',
  ip: 'IPアドレス',
  referer: 'どこから来たか',
  param: 'URLのパラメーター',
  team: 'チーム',
} as const satisfies Record<ExclusionKind, string>

/** 実物のプルダウンどおりの選択肢（並び順もここで決める） */
const KINDS: readonly { value: ExclusionKind; label: string }[] = [
  { value: 'email', label: KIND_LABELS.email },
  { value: 'ip', label: KIND_LABELS.ip },
  { value: 'referer', label: KIND_LABELS.referer },
  // プルダウンだけは例を添える（選ぶときに何のことか分かるように）
  { value: 'param', label: `${KIND_LABELS.param}（utm_source=fb など）` },
  { value: 'team', label: KIND_LABELS.team },
]

/** メールアドレスは値の突き合わせではなく、除外リンクを開いたブラウザで判定する */
const EMAIL_HINT =
  'メールアドレスは、その人のChromeを見分けるための名前として使います。' +
  '登録すると「除外リンク」が出るので、本人にそのChromeで一度開いてもらってください。' +
  'ブラウザのログインアカウントはWebサイトからは読めないため、この方法をとっています。'
const MATCHES: readonly { value: ExclusionMatch; label: string }[] = [
  { value: 'exact', label: '完全一致' },
  { value: 'partial', label: '部分一致' },
  { value: 'prefix', label: '前方一致' },
  { value: 'suffix', label: '後方一致' },
]
/**
 * 条件が2つ以上あるときの繋ぎ方。実物は「結合条件」で AND / OR だが、
 * 何を指すか分かりにくいので、意味が読める文言にしている。
 */
const JOINS: readonly { value: ExclusionJoin; label: string }[] = [
  { value: 'or', label: 'または（どちらかに当てはまれば除外）' },
  { value: 'and', label: 'かつ（両方に当てはまれば除外）' },
]
/** 実物の「表示項目数」は 5項目 / 10項目 の2つだけ */
const LIMITS = [5, 10] as const

function injectCss(): void {
  if (document.getElementById(CSS_ID) !== null) return
  const s = document.createElement('style')
  s.id = CSS_ID
  s.textContent = `
    .rx { padding:20px 24px; font-size:13px; color:#1f2937;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,
        "Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif; }
    .rx h1 { font-size:20px; font-weight:700; margin:0 0 14px; }
    .rx-tabs { display:flex; gap:4px; border-bottom:1px solid #e6e9f0; margin-bottom:16px; }
    .rx-tab { border:0; background:transparent; font:inherit; font-size:13px; color:#6b7280;
      padding:9px 16px; cursor:pointer; border-bottom:2px solid transparent; }
    .rx-tab.on { color:#2563eb; font-weight:700; border-bottom-color:#2563eb; }
    .rx-card { background:#fff; border:1px solid #e6e9f0; border-radius:10px;
      padding:16px 18px; margin-bottom:16px; }
    .rx-lead { font-size:12px; color:#4b5563; line-height:1.9; margin:0 0 10px; }
    .rx-note { font-size:12px; color:#6b7280; line-height:1.9; background:#f7f9fc;
      border:1px solid #eef1f6; border-radius:8px; padding:10px 12px; margin:0 0 12px; }
    .rx-h2 { font-size:14px; font-weight:700; margin:0 0 10px; }
    .rx-form { display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; }
    .rx-field { display:flex; flex-direction:column; gap:4px; }
    .rx-field label { font-size:11px; color:#6b7280; }
    .rx-field select, .rx-field input {
      border:1px solid #d5d5db; border-radius:6px; padding:7px 9px; font:inherit;
      font-size:12px; background:#fff; color:#1f2937; min-width:150px;
    }
    .rx-btn { border:1px solid #2563eb; background:#2563eb; color:#fff; border-radius:6px;
      padding:8px 16px; font:inherit; font-size:12px; font-weight:600; cursor:pointer; }
    .rx-btn:hover { background:#1d4ed8; }
    .rx-btn.ghost { background:#fff; color:#2563eb; }
    .rx-btn.ghost:hover { background:#f3f7ff; }
    .rx-check { display:flex; align-items:center; gap:6px; font-size:12px; color:#374151;
      margin:0 0 12px; cursor:pointer; }
    .rx-table { width:100%; border-collapse:collapse; font-size:12px; }
    .rx-table th, .rx-table td { border-bottom:1px solid #eef1f6; padding:9px 10px;
      text-align:left; white-space:nowrap; }
    .rx-table th { background:#f8fafc; color:#475467; font-weight:600; font-size:11px; }
    .rx-table td.num { text-align:right; font-variant-numeric:tabular-nums; }
    .rx-empty { color:#6b7280; font-size:12px; padding:18px; text-align:center; }
    .rx-periods { display:flex; gap:4px; flex-wrap:wrap; }
    .rx-period { border:1px solid #d5d5db; background:#fff; color:#555; border-radius:6px;
      padding:5px 12px; font:inherit; font-size:11px; cursor:pointer; }
    .rx-period.on { background:#2563eb; border-color:#2563eb; color:#fff; font-weight:700; }
    .rx-ranks { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; margin-top:14px; }
    @media (max-width:1000px) { .rx-ranks { grid-template-columns:minmax(0,1fr); } }
    .rx-rank h3 { font-size:12px; font-weight:700; margin:0 0 6px; color:#374151; }
    .rx-rank-row { display:flex; gap:8px; align-items:center; padding:6px 0;
      border-bottom:1px solid #f2f4f7; font-size:12px; }
    .rx-rank-row span:first-child { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .rx-rank-row b { font-variant-numeric:tabular-nums; }
    .rx-del { border:1px solid #feb2b2; background:#fff5f5; color:#e53e3e; border-radius:5px;
      padding:4px 10px; font:inherit; font-size:11px; cursor:pointer; }
  `
  document.head.append(s)
}

function rangeOf(days: number): DateRange {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  return { startDate: toDateKey(start), endDate: toDateKey(end) }
}

function field(label: string, control: HTMLElement): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'rx-field'
  const l = document.createElement('label')
  l.textContent = label
  wrap.append(l, control)
  return wrap
}

function select(options: readonly { value: string; label: string }[]): HTMLSelectElement {
  const s = document.createElement('select')
  for (const o of options) {
    const opt = document.createElement('option')
    opt.value = o.value
    opt.textContent = o.label
    s.append(opt)
  }
  return s
}

/** 「アクセス拒否」タブの中身 */
function buildDenyTab(reload: () => void): HTMLElement {
  const wrap = document.createElement('div')

  // ── 説明（実物の文言） ──
  const card = document.createElement('section')
  card.className = 'rx-card'
  const lead = document.createElement('p')
  lead.className = 'rx-lead'
  lead.textContent =
    '指定条件に合致するアクセスをレポート集計から除外します。' +
    'サイト閲覧は可能ですが、数値には反映されません。' +
    '（例：社内・関連企業・特定ボットからのアクセスを計測対象外にしたい場合などにご利用ください。）'
  const note = document.createElement('p')
  note.className = 'rx-note'
  note.textContent =
    'ホワイトリストを有効にすると、指定した条件に一致するアクセスは' +
    '「アクセス拒否の対象から除外」されます。' +
    'ここで登録された条件はアクセス拒否ルールよりも優先され、' +
    'レポートには反映されませんが、ページはブロックされずに表示されます'

  const checkLabel = document.createElement('label')
  checkLabel.className = 'rx-check'
  const whitelist = document.createElement('input')
  whitelist.type = 'checkbox'
  const checkText = document.createElement('span')
  checkText.textContent = 'ホワイトリストの対象にする'
  checkLabel.append(whitelist, checkText)

  // ── 除外条件フォーム ──
  // 実物は「＋複数条件を組み合わせる」で行を増やせる。1件のルールが複数条件を持つ。
  const h2 = document.createElement('div')
  h2.className = 'rx-h2'
  h2.textContent = '除外条件'
  const rowsHost = document.createElement('div')
  rowsHost.style.cssText = 'display:flex;flex-direction:column;gap:10px'

  interface Row {
    el: HTMLElement
    kind: HTMLSelectElement
    match: HTMLSelectElement
    value: HTMLInputElement
    join: HTMLSelectElement
    joinField: HTMLElement
  }
  const rows: Row[] = []

  /**
   * 「つなぎ方」は行と行の繋ぎなので、**次の行がある行にだけ**出す。
   * 1行しかないのに出ていると、何を指すのか分からない（実物はここが分かりにくい）。
   */
  const syncJoins = (): void => {
    rows.forEach((r, i) => {
      // 最後の行には次が無いので出さない
      const isLast = i === rows.length - 1
      r.joinField.style.setProperty('display', isLast ? 'none' : '')
    })
  }

  const addRow = (): void => {
    const line = document.createElement('div')
    line.className = 'rx-form'
    const kind = select(KINDS)
    const match = select(MATCHES)
    const value = document.createElement('input')
    value.placeholder = '値'
    const join = select(JOINS)
    join.value = 'or'
    const joinField = field('次の条件とのつなぎ方', join)
    line.append(field('除外対象', kind), field('マッチタイプ', match), field('値', value), joinField)
    // 2行目以降は取り消せるようにする（増やすだけだと戻せない）
    if (rows.length > 0) {
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'rx-del'
      remove.textContent = 'この行を削除'
      remove.addEventListener('click', () => {
        const at = rows.findIndex((r) => r.el.contains(line))
        if (at >= 0) {
          rows[at]?.el.remove()
          rows.splice(at, 1)
          syncJoins()
        }
      })
      line.append(remove)
    }
    // メールアドレスは値の突き合わせをしないので、マッチタイプは意味を持たない
    const hint = document.createElement('div')
    hint.className = 'rx-note'
    hint.style.cssText = 'margin:6px 0 0;display:none'
    hint.textContent = EMAIL_HINT
    const syncKind = (): void => {
      const isEmail = kind.value === 'email'
      match.disabled = isEmail
      hint.style.display = isEmail ? '' : 'none'
      value.placeholder = isEmail ? 'you@example.com' : '値'
      value.type = isEmail ? 'email' : 'text'
    }
    kind.addEventListener('change', syncKind)
    syncKind()

    const wrapLine = document.createElement('div')
    wrapLine.append(line, hint)
    rows.push({ el: wrapLine, kind, match, value, join, joinField })
    rowsHost.append(wrapLine)
    syncJoins()
  }
  addRow()

  const actions = document.createElement('div')
  actions.className = 'rx-form'
  actions.style.marginTop = '10px'
  const addBtn = document.createElement('button')
  addBtn.type = 'button'
  addBtn.className = 'rx-btn ghost'
  addBtn.textContent = '＋複数条件を組み合わせる'
  addBtn.addEventListener('click', addRow)
  const submit = document.createElement('button')
  submit.type = 'button'
  submit.className = 'rx-btn'
  submit.textContent = '条件を反映'
  actions.append(addBtn, submit)

  submit.addEventListener('click', () => {
    const conditions = rows.map((r) => ({
      kind: r.kind.value as ExclusionKind,
      // メールは値の突き合わせをしないので、常に完全一致で送る
      matchType: (r.kind.value === 'email' ? 'exact' : r.match.value) as ExclusionMatch,
      value: r.value.value.trim(),
      join: r.join.value as ExclusionJoin,
    }))
    if (conditions.some((c) => c.value === '')) {
      toast('値を入力してください', 'error')
      return
    }
    void api.addReportExclusion({ conditions, isWhitelist: whitelist.checked }).then(
      () => {
        toast('除外条件を反映しました')
        reload()
      },
      (error: Error) => toast(error.message, 'error'),
    )
  })

  card.append(lead, note, checkLabel, h2, rowsHost, actions)
  wrap.append(card)
  return wrap
}

/** 「設定済み除外条件」表 */
function buildRulesTable(rows: readonly ReportExclusionEntry[], reload: () => void): HTMLElement {
  const card = document.createElement('section')
  card.className = 'rx-card'
  const title = document.createElement('div')
  title.className = 'rx-h2'
  title.textContent = '設定済み除外条件'
  card.append(title)

  if (rows.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'rx-empty'
    empty.textContent = '除外条件はまだ登録されていません。'
    card.append(empty)
    return card
  }

  const table = document.createElement('table')
  table.className = 'rx-table'
  const thead = document.createElement('thead')
  const hr = document.createElement('tr')
  for (const [label, num] of [
    ['除外対象', false],
    ['マッチタイプ', false],
    ['値', false],
    ['つなぎ方', false],
    ['除外アクセス数', true],
    ['', false],
  ] as const) {
    const th = document.createElement('th')
    if (num) th.className = 'num'
    th.textContent = label
    hr.append(th)
  }
  thead.append(hr)

  const tbody = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    // 1件が複数条件を持つので、まとめて1行に並べる
    const kindText = row.conditions.map((c) => KIND_LABELS[c.kind] ?? c.kind).join(' / ')
    const matchText = row.conditions
      .map((c) => MATCHES.find((m) => m.value === c.match_type)?.label ?? c.match_type)
      .join(' / ')
    const valueText = row.conditions.map((c) => c.value).join(' / ')
    // 結合条件は行と行の繋ぎなので、最後の1つは使わない
    const joinText =
      row.conditions.length <= 1
        ? '―'
        : row.conditions
            .slice(0, -1)
            .map((c) => (c.join === 'and' ? 'かつ' : 'または'))
            .join(' / ')
    for (const [text, num] of [
      [row.is_whitelist ? `${kindText}（ホワイトリスト）` : kindText, false],
      [matchText, false],
      [valueText, false],
      [joinText, false],
      // 実物も記録が無いときは「―」だった
      [row.excluded_count === null ? '―' : row.excluded_count.toLocaleString('ja-JP'), true],
    ] as const) {
      const td = document.createElement('td')
      if (num) td.className = 'num'
      td.textContent = text
      tr.append(td)
    }
    const last = document.createElement('td')
    // メールアドレスの条件には「除外リンク」を出す。本人にこのChromeで開いてもらう。
    if (row.conditions.some((c) => c.kind === 'email')) {
      const copy = document.createElement('button')
      copy.type = 'button'
      copy.className = 'rx-btn ghost'
      copy.style.cssText += ';margin-right:6px;padding:4px 10px;font-size:11px'
      copy.textContent = '除外リンクをコピー'
      const url = `${location.origin}/exclude/${row.uid}`
      copy.title = `${url}\n本人のChromeでこのURLを一度開いてもらうと、そのブラウザが除外されます。`
      copy.addEventListener('click', () => {
        void navigator.clipboard?.writeText(url).then(
          () => toast('除外リンクをコピーしました。本人のChromeで開いてもらってください'),
          () => toast('コピーできませんでした', 'error'),
        )
      })
      last.append(copy)
    }
    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'rx-del'
    del.textContent = '削除'
    del.addEventListener('click', () => {
      void api.deleteReportExclusion(row.uid).then(
        () => {
          toast('除外条件を削除しました')
          reload()
        },
        (error: Error) => toast(error.message, 'error'),
      )
    })
    last.append(del)
    tr.append(last)
    tbody.append(tr)
  }
  table.append(thead, tbody)
  card.append(table)
  return card
}

/** 「リクエスト数」セクション（リファラ / ソースIP / パラメータ） */
function buildRequests(): HTMLElement {
  const card = document.createElement('section')
  card.className = 'rx-card'
  const title = document.createElement('div')
  title.className = 'rx-h2'
  title.textContent = 'リクエスト数'

  const bar = document.createElement('div')
  bar.className = 'rx-form'
  const ip = document.createElement('input')
  ip.placeholder = 'IP検索'
  const periods = document.createElement('div')
  periods.className = 'rx-periods'
  const limit = select(LIMITS.map((n) => ({ value: String(n), label: `${n}項目` })))
  bar.append(field('IP検索', ip), field('期間', periods), field('表示項目数', limit))

  const ranks = document.createElement('div')
  ranks.className = 'rx-ranks'
  const totalLine = document.createElement('div')
  totalLine.style.cssText = 'font-size:12px;color:#6b7280;margin-top:10px'

  let current: (typeof PERIODS)[number] = PERIODS[0]

  const load = (): void => {
    const range = rangeOf(current.days)
    const query = new URLSearchParams({
      start_date: range.startDate,
      end_date: range.endDate,
      limit: limit.value,
    })
    if (ip.value.trim() !== '') query.set('ip', ip.value.trim())

    void api.exclusionRequests(query.toString()).then(
      (stats) => {
        totalLine.textContent = `対象リクエスト ${stats.total.toLocaleString('ja-JP')} 件（${range.startDate} 〜 ${range.endDate}）`
        ranks.replaceChildren(
          rankBox(KIND_LABELS.referer, stats.referers),
          rankBox(KIND_LABELS.ip, stats.ips),
          rankBox(KIND_LABELS.param, stats.params),
        )
      },
      () => {
        totalLine.textContent = 'リクエストの集計を取得できませんでした。'
        ranks.replaceChildren()
      },
    )
  }

  for (const p of PERIODS) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `rx-period${p.key === current.key ? ' on' : ''}`
    b.textContent = p.label
    b.addEventListener('click', () => {
      current = p
      for (const other of periods.querySelectorAll('button')) {
        other.classList.toggle('on', other === b)
      }
      load()
    })
    periods.append(b)
  }
  limit.addEventListener('change', load)
  ip.addEventListener('change', load)

  card.append(title, bar, totalLine, ranks)
  load()
  return card
}

function rankBox(
  title: string,
  rows: readonly { value: string; count: number }[],
): HTMLElement {
  const box = document.createElement('div')
  box.className = 'rx-rank'
  const h = document.createElement('h3')
  h.textContent = title
  box.append(h)
  if (rows.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'rx-empty'
    empty.style.padding = '10px'
    empty.textContent = 'まだ記録がありません'
    box.append(empty)
    return box
  }
  for (const row of rows) {
    const line = document.createElement('div')
    line.className = 'rx-rank-row'
    const v = document.createElement('span')
    v.textContent = row.value
    v.title = row.value
    const c = document.createElement('b')
    c.textContent = row.count.toLocaleString('ja-JP')
    line.append(v, c)
    box.append(line)
  }
  return box
}

export async function renderReportExclusions(container: HTMLElement): Promise<void> {
  injectCss()
  container.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'rx'
  container.append(root)

  const h1 = document.createElement('h1')
  h1.textContent = 'レポート除外'

  const tabs = document.createElement('div')
  tabs.className = 'rx-tabs'
  const bodyHost = document.createElement('div')

  const reload = (): void => {
    void renderReportExclusions(container)
  }

  const showDeny = async (): Promise<void> => {
    const denyWrap = document.createElement('div')
    denyWrap.append(buildDenyTab(reload))
    bodyHost.replaceChildren(denyWrap)
    try {
      const { report_exclusions } = await api.reportExclusions()
      denyWrap.append(buildRulesTable(report_exclusions, reload), buildRequests())
    } catch {
      const err = document.createElement('div')
      err.className = 'rx-empty'
      err.textContent = '除外条件を読み込めませんでした。'
      denyWrap.append(err)
    }
  }

  /**
   * タブは「アクセス拒否」だけ。
   * 実物には「配信除外オーディエンス設定」もあるが、中身を確認できておらず
   * 指示で不要となったため置いていない。
   */
  const denyTab = document.createElement('button')
  denyTab.type = 'button'
  denyTab.className = 'rx-tab on'
  denyTab.textContent = 'アクセス拒否'
  denyTab.addEventListener('click', () => void showDeny())
  tabs.append(denyTab)

  root.append(h1, tabs, bodyHost)
  await showDeny()
}
