/**
 * レポートタブ（`/ab_tests/:uid/reports`・企画書 §10-3）。
 *
 * この画面はアプリの他画面と**配色が違う（ダークテーマ）**。
 * 見た目は採取した実DOM＋実CSS（`capture/clean/ab_tests__UID__reports/default/`）が担保し、
 * ここは「挙動だけ」を後付けする（企画書 §11 capture-and-rehydrate）。
 *
 * 採取物には4つのセクションがある:
 *   デイリーレポート / クリエイティブ / Branch Operation / ファネル（＋ポップアップの未契約枠）
 */
import substrate from '../fragments/ab_tests__UID__reports__default.html?raw'
import { api, type ReportResponse } from '../api.ts'
import { isStale } from '../main.ts'
import { toast } from '../ui.ts'
import {
  cloneNote,
  mountCapturedPage,
  replaceBakedPageName,
  setTopBarNames,
  wireBackLink,
  wireCapturedLinks,
  wireThemeToggle,
} from './report-dom.ts'
import { recordHistory } from './folders.ts'
import {
  cardByHeading,
  fillBranchTable,
  fillDailyTable,
  fillFunnelSummary,
  sectionByTitle,
} from './report-tables.ts'
import { defaultRange, resolvePreset, toRangeQuery, type DateRange } from './report-period.ts'
import { wireAbTestTabs, setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'
import { mountMetaSummary } from './report-meta.ts'

/** クローン側の注記に使う印（重複挿入を防ぐ） */
const NOTE_FLAG = 'sbCloneNote'

/** ハッシュのクエリから期間を読む。未指定は採取物と同じ「当日のみ」 */
export function rangeFromParams(params: URLSearchParams): DateRange {
  const start = params.get('start_date')
  const end = params.get('end_date')
  if (start === null || end === null) return defaultRange()
  return start <= end ? { startDate: start, endDate: end } : { startDate: end, endDate: start }
}

function gotoRange(abTestUid: string, range: DateRange): void {
  location.hash = `/ab_tests/${abTestUid}/reports?${toRangeQuery(range)}`
}

/** 目印の要素の直後に注記を置く（同じ要素に二重に付けない） */
function noteAfter(node: HTMLElement | null, message: string): void {
  if (node === null || node.dataset[NOTE_FLAG] === 'true') return
  node.dataset[NOTE_FLAG] = 'true'
  node.insertAdjacentElement('afterend', cloneNote(message))
}

export async function renderReport(
  container: HTMLElement,
  abTestUid: string,
  params: URLSearchParams,
  generation?: number,
): Promise<void> {
  // エディタが `height:100vh;overflow:hidden` を残していくので、縦に伸びるこの画面では戻す
  container.style.cssText = 'flex:1;min-width:0'
  container.innerHTML = ''

  const range = rangeFromParams(params)
  const [{ ab_test }, report, { folders }] = await Promise.all([
    api.abTest(abTestUid),
    api.report(abTestUid, toRangeQuery(range)),
    api.folders(),
  ])
  const folder = folders.find((f) => f.id === ab_test.folder_id) ?? null

  // API待ちの間に別の描画が始まっていたら降りる（main.ts の描画世代トークン）
  if (generation !== undefined && isStale(generation)) return

  // レポート閲覧を履歴に記録
  recordHistory(abTestUid, ab_test.title, 'ab_test', 'レポート閲覧')

  const folderName = folder?.name ?? ''
  const root = mountCapturedPage(container, substrate)
  wireCapturedLinks(root, substrate, abTestUid)
  // 左レールの4タブと「戻る」は、採取元のフォルダuidが焼き付いているので専用の配線で上書きする
  wireAbTestTabs(root, abTestUid, folder?.uid ?? '')
  setupHorizTabs(root, 'report', { abTestUid, folderUid: folder?.uid ?? '' })
  // 指示86: navWrapper の親に flex-column を設定し、採取CSSのレイアウト干渉を防ぐ
  const navWrapper86 = root.querySelector<HTMLElement>('[class*="_navArticleWrapper_"]')
  if (navWrapper86?.parentElement !== null && navWrapper86?.parentElement !== undefined) {
    navWrapper86.parentElement.style.display = 'flex'
    navWrapper86.parentElement.style.flexDirection = 'column'
    navWrapper86.parentElement.style.background = '#fff'
  }
  wireBackLink(root, folder?.uid ?? null)
  setTopBarNames(root, ab_test.title, folderName)
  setupBreadcrumb(root, folderName, ab_test.title, folder?.uid)
  wireThemeToggle(root)

  const alert = root.querySelector<HTMLElement>('.MuiAlert-message')
  if (alert !== null) replaceBakedPageName(alert, ab_test.title)

  wireDailyReport(root, abTestUid, range, report)
  wireBranchOperation(root, abTestUid, range, report, ab_test.title, ab_test.media?.name ?? '')
  wireCreative(root, abTestUid, range)
  wireFunnel(root, abTestUid, range, report)

  // Meta連携（env設定済みのときだけ）: アカウント全体の実データKPIを上部バナーで出す（指示⑤⑧）。
  void mountMetaSummary(root, toRangeQuery(range), range)
}

/** 「デイリーレポート」= 期間フィルタ ＋ 折れ線 ＋ 日付ごとの表 */
function wireDailyReport(
  root: HTMLElement,
  abTestUid: string,
  range: DateRange,
  report: ReportResponse,
): void {
  const card = cardByHeading(root, 'デイリーレポート')
  if (card === null) {
    console.warn('[report] デイリーレポートのカードが土台に見つかりませんでした')
    return
  }
  wireRangeInputs(card, abTestUid, range)
  fillDailyTable(card, report.totals, report.daily)

  /**
   * 折れ線は実物が **Recharts**（採取DOMに `recharts-responsive-container` /
   * `recharts-surface` が入っている）で描いている。クローンには Recharts が無く、
   * `package.json` は触らない規約なので、採取された静止SVGのまま＝期間を変えても動かない。
   */
  noteAfter(
    card.querySelector<HTMLElement>('.recharts-responsive-container'),
    '折れ線グラフは実物が Recharts で描画している。採取したSVGをそのまま置いているだけで、期間を変えても再描画されない（依存追加は未実施）。',
  )
  noteAfter(
    card.querySelector<HTMLElement>('h3')?.parentElement ?? null,
    '「日付」「Version」「アーカイブ」「端末」はMUIのSelectで、開いたときのメニューがポータル側に描画されるため採取できていない。開始日/終了日だけが動く。',
  )
}

/** 「Branch Operation」= 期間フィルタ ＋ 折りたたみフィルタ ＋ Version別の表 */
function wireBranchOperation(
  root: HTMLElement,
  abTestUid: string,
  range: DateRange,
  report: ReportResponse,
  title: string,
  mediaName: string,
): void {
  const card = cardByHeading(root, 'Branch Operation')
  if (card === null) {
    console.warn('[report] Branch Operation のカードが土台に見つかりませんでした')
    return
  }
  wireRangeInputs(card, abTestUid, range)
  fillBranchTable(card, { title, mediaName, totals: report.totals, versions: report.rows })
  wireFilterCollapse(card)
  wireCsvDownload(card, report, title)

  noteAfter(
    findButtonByText(card, '配信除外設定'),
    '「配信除外設定」は未配線（別画面の採取物が無い）。',
  )
}

/** 「フィルター」ボタンで MuiCollapse を開閉する（実物と同じ挙動） */
function wireFilterCollapse(card: HTMLElement): void {
  const button = findButtonByText(card, 'フィルター')
  const collapse = card.querySelector<HTMLElement>('.MuiCollapse-root')
  if (button === null || collapse === null) return
  let isOpen = false
  button.addEventListener('click', () => {
    isOpen = !isOpen
    collapse.classList.toggle('MuiCollapse-hidden', !isOpen)
    collapse.style.height = isOpen ? 'auto' : '0px'
    collapse.style.visibility = isOpen ? 'visible' : 'hidden'
    collapse.style.overflow = isOpen ? 'visible' : 'hidden'
  })
}

/** 「クリエイティブ」= 期間プリセット（実物のnative select）＋ 並び替え列 ＋ 空表示 */
function wireCreative(root: HTMLElement, abTestUid: string, range: DateRange): void {
  const section = sectionByTitle(root, 'クリエイティブ')
  if (section === null) return
  wirePresetSelect(section, abTestUid)
  showRangeInReadonlyInputs(section, range)

  noteAfter(
    section.querySelector<HTMLElement>('[class*="_noReportDescription_"]'),
    'クリエイティブは広告媒体から取り込んだ素材の集計。取り込みが無いので実物と同じく空。列の並び替え・広告ステータス絞り込み・Parameter検索は行が無いため未配線。',
  )
}

/** 「ファネル」= 期間プリセット ＋ 経路別のPV/離脱 ＋ 集計（PV/CV/CVR） */
function wireFunnel(
  root: HTMLElement,
  abTestUid: string,
  range: DateRange,
  report: ReportResponse,
): void {
  const section = sectionByTitle(root, 'ファネル')
  if (section === null) return
  wirePresetSelect(section, abTestUid)
  showRangeInReadonlyInputs(section, range)
  fillFunnelSummary(section, report.totals)

  noteAfter(
    section.querySelector<HTMLElement>('[class*="_containerDetail_"]'),
    'ファネルの経路一覧（経路 / PV数・割合 / 棒グラフ）は採取時も空で、中間ページのAPIも無い。集計（PV/CV/CVR）だけモックの値を出している。',
  )
}

/** 開始日 / 終了日（MUIのTextField・実物は type="text"）を期間に結ぶ */
function wireRangeInputs(card: HTMLElement, abTestUid: string, range: DateRange): void {
  const inputs = [...card.querySelectorAll<HTMLInputElement>('input[type="text"]:not([readonly])')]
  const start = inputs[0]
  const end = inputs[1]
  if (start === undefined || end === undefined) return
  start.value = range.startDate
  end.value = range.endDate
  const submit = (): void => {
    gotoRange(abTestUid, { startDate: start.value, endDate: end.value })
  }
  start.addEventListener('change', submit)
  end.addEventListener('change', submit)
}

/** 読み取り専用の期間表示（実物はカレンダーをポータルで開く。採取物が無いので表示だけ） */
function showRangeInReadonlyInputs(section: HTMLElement, range: DateRange): void {
  const inputs = [...section.querySelectorAll<HTMLInputElement>('input[type="text"][readonly]')]
  const start = inputs[0]
  const end = inputs[1]
  if (start !== undefined) start.value = range.startDate
  if (end !== undefined) end.value = range.endDate
}

/** 実物の native `<select>`（今日 / 昨日 / …）を期間に結ぶ */
function wirePresetSelect(section: HTMLElement, abTestUid: string): void {
  const select = section.querySelector<HTMLSelectElement>('select')
  if (select === null) return
  select.addEventListener('change', () => {
    const resolved = resolvePreset(select.value)
    if (resolved === null) {
      // 「7日間」など、数え方が採取物から確認できていないものは動かさない（推測で埋めない）
      toast('この期間の数え方は採取物から確認できていません', 'error')
      select.selectedIndex = 0
      return
    }
    gotoRange(abTestUid, resolved)
  })
}

/** CSVダウンロードボタンを配線 */
function wireCsvDownload(card: HTMLElement, report: ReportResponse, title: string): void {
  const btn = findButtonByText(card, 'CSVダウンロード')
  if (btn === null) return

  btn.addEventListener('click', () => {
    const header = ['scope', 'name', 'status', 'PV', 'Click', 'CV', '広告費', '売上', '粗利', 'ROAS', 'ROI', 'CVR', 'CPA']
    const rows = report.rows.map((r) => [
      r.scope,
      r.name,
      r.status,
      String(r.pv),
      String(r.click),
      String(r.cv),
      String(r.ad_cost),
      String(r.sales),
      String(r.gross_profit),
      r.roas !== null ? String(r.roas) : '',
      r.roi !== null ? String(r.roi) : '',
      r.cvr !== null ? String(r.cvr) : '',
      r.cpa !== null ? String(r.cpa) : '',
    ])

    // BOM付きUTF-8でExcelでも文字化けしない
    const bom = '﻿'
    const csv = bom + [header, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}_report.csv`
    document.body.append(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast('CSVをダウンロードしました')
  })
}

function findButtonByText(scope: HTMLElement, label: string): HTMLElement | null {
  for (const button of scope.querySelectorAll<HTMLElement>('button')) {
    if ((button.textContent ?? '').trim() === label) return button
  }
  return null
}
