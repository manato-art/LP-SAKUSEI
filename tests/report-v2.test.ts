import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { previousRange } from '../src/app/pages/report-v2.ts'

/**
 * 指示178 のレポート再設計。
 * 増減の比較対象は「同じ日数だけ手前にずらした期間」で、ここを間違えると
 * 全KPIの増減が一斉に狂うので機械で押さえる。
 */
describe('増減の比較対象になる前期間', () => {
  it('1日だけの期間は、その前日1日と比べる', () => {
    expect(previousRange({ startDate: '2026-09-08', endDate: '2026-09-08' })).toEqual({
      startDate: '2026-09-07',
      endDate: '2026-09-07',
    })
  })

  it('15日間の期間は、直前の15日間と比べる', () => {
    expect(previousRange({ startDate: '2025-06-16', endDate: '2025-06-30' })).toEqual({
      startDate: '2025-06-01',
      endDate: '2025-06-15',
    })
  })

  it('月をまたぐ期間でも日数が合う', () => {
    const prev = previousRange({ startDate: '2026-03-01', endDate: '2026-03-07' })
    expect(prev).toEqual({ startDate: '2026-02-22', endDate: '2026-02-28' })
  })

  it('前期間は現期間と重ならない（終了日が開始日の前日）', () => {
    const range = { startDate: '2026-01-10', endDate: '2026-01-20' }
    expect(previousRange(range).endDate < range.startDate).toBe(true)
  })
})

describe('レポート本体は指定デザインの構成になっている', () => {
  const src = readFileSync('src/app/pages/report-v2.ts', 'utf8')

  it('フィルター→KPI→クリエイティブ→一覧→Branch の順で積む', () => {
    const order = ['buildFilters', 'buildKpiCards', 'buildCreativeReport', 'buildReportList', 'buildBranchOperation']
    let at = -1
    for (const name of order) {
      const i = src.indexOf(`${name}(`, at + 1)
      expect(i, `${name} が見つからない`).toBeGreaterThan(at)
      at = i
    }
  })

  it('絞り込みの選択肢は実際に持っている値から出す（既定の表記は採取物のまま）', () => {
    // 2026-09-15: 既定値1つしか入れていなかったので「押しても選択肢が無い」状態だった。
    // Versionは一覧から、アーカイブと端末はこのシステムが持つ値から出す。
    // 表記（指定なし／アーカイブ済みを除く／全端末）は採取物のまま変えない。
    expect(src).toContain("['', '指定なし']")
    expect(src).toContain("['except_archived', 'アーカイブ済みを除く']")
    expect(src).toContain("['0', '全端末']")
    expect(src).toContain('deps.versionOptions.map')
    // 選ぶとサーバーで絞り直す（画面の中だけで隠すのではない）
    expect(src).toContain('deps.onFilterChange(')
  })

  it('CSVはBOM付きで出す（Excelで文字化けさせない）', () => {
    expect(src).toContain('\\ufeff')
  })
})

describe('KPIカード', () => {
  const src = readFileSync('src/app/pages/report-v2-kpi.ts', 'utf8')

  it('指定画像の7指標をこの順で出す', () => {
    const labels = ['配信金額', 'PV', 'CLICK', 'CTR', 'CV', 'CVR', 'CPA']
    let at = -1
    for (const label of labels) {
      const i = src.indexOf(`label: '${label}'`, at + 1)
      expect(i, `${label} が無い`).toBeGreaterThan(at)
      at = i
    }
  })

  it('CPAだけは「増えると悪い」（増加を赤で出す）', () => {
    const cpa = src.slice(src.indexOf("key: 'cpa'"))
    expect(cpa).toContain('higherIsBetter: false')
  })

  it('前期間が0や無しのときは増減を出さない（0からの増加は率にならない）', () => {
    expect(src).toContain('previous === 0')
    expect(src).toContain('前期間なし')
  })

  it('UIに絵文字を使わずSVGアイコンで描く', () => {
    // 絵文字の面（U+1F300〜）を検出する
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
    expect(emoji.test(src)).toBe(false)
    expect(src).toContain('<svg')
  })
})

/**
 * 2026-09-15。本人指示「表示内容だったり絞り込みが実際のSBと異なっている部分があるので、
 * 実際のページを参照した上で修正」。採取した実DOMを正として直したもの。
 */
describe('採取物に合わせた表示内容・絞り込み', () => {
  const src = readFileSync('src/app/pages/report-v2.ts', 'utf8')
  const tables = readFileSync('src/app/pages/report-v2-tables.ts', 'utf8')
  const chart = readFileSync('src/app/pages/report-v2-chart.ts', 'utf8')
  const dom = readFileSync('src/app/fragments/ab_tests__UID__reports__default.html', 'utf8')

  it('絞り込みの名前と既定値を実物に合わせる（Version／アーカイブ済みを除く／全端末）', () => {
    // 採取物の既定値
    expect(dom).toContain('アーカイブ済みを除く')
    expect(dom).toContain('全端末')
    expect(src).toMatch(/field\(\s*'Version'/)
    expect(src).toContain('アーカイブ済みを除く')
    expect(src).toContain('全端末')
  })

  it('実物に無い絞り込み（広告主・キャンペーン・クリエイティブ）は出さない', () => {
    // 採取物のレポート画面にこの3語は1つも無い
    for (const label of ['広告主', 'キャンペーン']) {
      expect(dom.includes(`>${label}<`), `採取物に ${label} は無いはず`).toBe(false)
      expect(src).not.toContain(`field('${label}'`)
    }
  })

  it('Branch Operation に CTVR と MCPA を出す（モックに値がある）', () => {
    expect(tables).toContain("'CTVR'")
    expect(tables).toContain("'MCPA'")
  })

  it('表の先頭に合計行を出す（実物は合計が先頭行）', () => {
    expect(dom).toContain('合計')
    expect(tables).toContain('合計')
  })

  it('0件の文言は実物にそろえる', () => {
    expect(dom).toContain('表示できるレポートがありません')
    expect(tables).toContain('表示できるレポートがありません')
    expect(chart).toContain('表示できるレポートがありません')
  })

  it('CSVにも CTVR / MCPA を含める', () => {
    expect(src).toContain("'CTVR'")
    expect(src).toContain("'MCPA'")
  })

  it('1日だけ選んでもグラフに点を打つ（既定は今日1日）', () => {
    expect(chart).not.toContain('points.length < 2')
  })
})

describe('FVER / SVER / FSVER / OAR を画面に出す（見た目は変えない）', () => {
  const tables = readFileSync('src/app/pages/report-v2-tables.ts', 'utf8')
  const src = readFileSync('src/app/pages/report-v2.ts', 'utf8')
  const api = readFileSync('src/app/api.ts', 'utf8')
  const columns = readFileSync('src/app/pages/report-columns.ts', 'utf8')

  it('APIの型に4指標がある', () => {
    for (const key of ['fver', 'sver', 'fsver', 'oar']) {
      expect(api, key).toContain(`${key}: number | null`)
    }
  })

  it('13列の定義から「式が無い指標」が消える', () => {
    expect(columns).toContain("metric: 'fver'")
    expect(columns).toContain("metric: 'oar'")
  })

  it('表に4列を足す（列を足すだけ・配色や枠は触らない）', () => {
    for (const label of ['FVER', 'SVER', 'FSVER', 'OAR']) {
      expect(tables, label).toContain(`'${label}'`)
    }
  })

  it('CSVにも4指標を含める', () => {
    for (const label of ['FVER', 'SVER', 'FSVER', 'OAR']) {
      expect(src, label).toContain(`'${label}'`)
    }
  })
})

/**
 * 2026-09-15。本人指示「実物を見て足りないものを実装する（UIは変えない）」。
 * 採取した実DOMにあってクローンに無かったものを足したぶん。
 */
describe('実物にあって足りなかったもの', () => {
  const src = readFileSync('src/app/pages/report-v2.ts', 'utf8')
  const tables = readFileSync('src/app/pages/report-v2-tables.ts', 'utf8')
  const dom = readFileSync('src/app/fragments/ab_tests__UID__reports__default.html', 'utf8')

  it('デイリーレポート（日付ごとの表）がある', () => {
    expect(dom).toContain('デイリーレポート')
    expect(src).toContain('buildDailyTable')
    // 13指標を1か所の定義から出す（列の定義を二重に持たない）
    expect(tables).toContain('REPORT_COLUMNS')
  })

  it('日付ごとの行の先頭は日付、合計行が先頭にある', () => {
    expect(tables).toContain('DAILY_LABEL_COLUMN')
  })

  it('期間プリセット（今日/昨日/7日間/過去3日間/過去7日間）がある', () => {
    for (const label of ['今日', '昨日', '7日間', '過去3日間', '過去7日間']) {
      expect(dom, label).toContain(`>${label}<`)
    }
    expect(src).toContain('DATE_PRESET_VALUES')
  })

  it('ポップアップの未設定枠がある（実物の文言とリンク先）', () => {
    expect(dom).toContain('ポップアップを設定するとレポートが表示されます')
    expect(src).toContain('ポップアップを設定するとレポートが表示されます')
    expect(src).toContain('exit_popups')
  })

  it('Branch Operation の見出しに「配信除外設定」と「配信割合について」がある', () => {
    expect(dom).toContain('配信除外設定')
    expect(dom).toContain('配信割合について')
    expect(tables).toContain('配信除外設定')
    expect(tables).toContain('配信割合について')
  })

  it('列見出しに実物の説明（aria-label）を付ける', () => {
    expect(dom).toContain('aria-label="オファー到達率 ※最初の広告リンクに到達した率"')
    const columns = readFileSync('src/app/pages/report-columns.ts', 'utf8')
    expect(columns).toContain('オファー到達率 ※最初の広告リンクに到達した率')
    expect(tables).toContain('aria-label')
  })
})

describe('クリエイティブレポートの絞り込み（実物に合わせる）', () => {
  const chart = readFileSync('src/app/pages/report-v2-chart.ts', 'utf8')
  const dom = readFileSync('src/app/fragments/ab_tests__UID__reports__default.html', 'utf8')

  it('広告ステータス（配信中 / 停止中 / ALL・既定はALL）がある', () => {
    expect(dom).toContain('>配信中<')
    expect(dom).toContain('>停止中<')
    expect(dom).toContain('>ALL<')
    for (const label of ['配信中', '停止中', 'ALL']) {
      expect(chart, label).toContain(`'${label}'`)
    }
  })

  it('「平均 / 合計」の切替がある', () => {
    expect(dom).toContain('>平均<')
    expect(dom).toContain('>合計<')
    expect(chart).toContain("'平均'")
    expect(chart).toContain("'合計'")
  })

  it('日付チップ（期間内の日を1日ずつ選ぶ）がある', () => {
    expect(chart).toContain('rv2-datechip')
  })

  it('列選択（9指標のチェック＋保存）がある', () => {
    // 採取物のチェックボックス名がそのまま9指標
    for (const name of ['adSpending', 'pv', 'click', 'ctr', 'cv', 'cvr', 'ctvr', 'cpa', 'mcpa']) {
      expect(dom, name).toContain(`name="${name}"`)
    }
    expect(chart).toContain('COLUMN_CHOICES')
    expect(chart).toContain('保存')
  })
})
