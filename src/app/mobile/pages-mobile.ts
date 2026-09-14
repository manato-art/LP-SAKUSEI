/**
 * スマホの「ページ」画面（2026-09-13・本人指示）。
 *
 * PCは「フォルダ / 一覧 / 詳細」の3ペインを横に並べるが、375pxでは一覧が画面の外に出て
 * まったく使えない。スマホでは**1画面ずつ**にし、戻るバーで行き来する:
 *   フォルダ（2列のカード） → そのフォルダのページ（カード） → ページの操作
 * 指標はカードに3つだけ出し、残りは開いたときに出す（縦に伸ばさない）。
 */
import { api, type AbTest, type Folder, type ReportKpi } from '../api.ts'
import { T, el, emptyState, toast } from '../ui.ts'
import { AD_STATUS_LABELS, DELIVERY_DOMAIN_UNSET_NOTE, deliveryUrlFor } from '../pages/basic-info-form.ts'
import { defaultRange, toRangeQuery } from '../pages/report-period.ts'
import { cardDetailMetrics, cardMetrics } from './page-card.ts'
import { openCreateFolder, openCreatePage } from '../pages/folders-create.ts'

/** 配信ステータスの色（実物の配色に合わせる） */
const STATUS_COLOR: Readonly<Record<string, string>> = {
  prepared: '#F0960A',
  delivered: '#12A150',
  stopping: '#E4432B',
  finished: T.sub,
}

function card(): HTMLElement {
  return el('div', {
    style: [
      `background:${T.surface};border:1px solid ${T.line};border-radius:12px`,
      'padding:14px;display:flex;flex-direction:column;gap:10px',
    ].join(';'),
  })
}

/** 戻るバー（今いる場所と、1つ上へ戻る導線） */
function backBar(title: string, onBack: (() => void) | null): HTMLElement {
  const bar = el('div', {
    style: [
      `position:sticky;top:0;z-index:20;background:${T.surface};border-bottom:1px solid ${T.line}`,
      'display:flex;align-items:center;gap:8px;padding:10px 12px',
    ].join(';'),
  })
  if (onBack !== null) {
    const back = el('button', {
      class: 'sb-mobile-tap',
      style: [
        'border:none;background:transparent;cursor:pointer;padding:0 6px',
        `color:${T.text};font-size:20px;line-height:1;min-width:44px;text-align:left`,
      ].join(';'),
    })
    back.type = 'button'
    back.setAttribute('aria-label', '戻る')
    back.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>'
    back.addEventListener('click', onBack)
    bar.append(back)
  }
  bar.append(
    el('div', {
      text: title,
      style: `font-size:16px;font-weight:700;color:${T.text};flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`,
    }),
  )
  return bar
}

/** 画面の枠（左右の余白を作らない） */
function screen(container: HTMLElement): HTMLElement {
  container.innerHTML = ''
  container.style.cssText = `flex:1;min-width:0;background:${T.bg}`
  const body = el('div', { class: 'sb-mobile-page', style: `font-family:${T.font}` })
  container.append(body)
  return body
}

/** 「作る」ボタン（点線の枠。フォルダ一覧とページ一覧で同じ見た目にする） */
function createButton(text: string, onClick: () => void): HTMLElement {
  const btn = el('button', {
    text,
    class: 'sb-mobile-tap',
    style: [
      `border:1px dashed ${T.line};border-radius:12px;background:${T.surface}`,
      `color:${T.sub};font-size:14px;font-family:${T.font};cursor:pointer;padding:14px`,
    ].join(';'),
  })
  btn.type = 'button'
  btn.addEventListener('click', onClick)
  return btn
}

/** 一覧の中身を入れる箱（カード同士の間だけ空ける） */
function listArea(): HTMLElement {
  return el('div', { style: 'display:flex;flex-direction:column;gap:10px;padding:12px' })
}

/* ────────────── 1. フォルダ（2列のカード） ────────────── */

export async function renderMobileFolders(container: HTMLElement): Promise<void> {
  const body = screen(container)
  body.append(backBar('ページ', null))
  // フォルダが1つも無いと、ここから先へ進む道が無くなる（本人指摘「新規で作成できない」）。
  // 空のときも出したいので、一覧より前に置く。
  body.append(
    el('div', { style: 'display:flex;flex-direction:column;padding:12px 12px 0' }, [
      createButton('＋ 新規フォルダを作成', () => { openCreateFolder() }),
    ]),
  )
  const area = el('div', {
    style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px',
  })
  body.append(area)

  const { folders } = await api.folders().catch(() => ({ folders: [] as Folder[] }))
  if (folders.length === 0) {
    body.append(emptyState('フォルダがありません。'))
    return
  }
  for (const folder of folders) {
    const tile = el('button', {
      class: 'sb-mobile-tap',
      style: [
        `background:${T.surface};border:1px solid ${T.line};border-radius:12px`,
        'padding:14px 12px;display:flex;flex-direction:column;gap:6px;align-items:flex-start',
        `cursor:pointer;font-family:${T.font};text-align:left`,
      ].join(';'),
    })
    tile.type = 'button'
    tile.append(
      el('div', {
        text: folder.name,
        style: `font-size:14px;font-weight:600;color:${T.text};width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`,
      }),
      el('div', { text: `${folder.ab_tests_count ?? 0} ページ`, style: `font-size:12px;color:${T.sub}` }),
    )
    tile.addEventListener('click', () => {
      location.hash = `/folders?uid=${folder.uid}`
    })
    area.append(tile)
  }
}

/* ────────────── 2. そのフォルダのページ（カード） ────────────── */

export async function renderMobilePages(container: HTMLElement, folderUid: string): Promise<void> {
  const body = screen(container)
  const detail = await api.folderDetail(folderUid).catch(() => null)
  if (detail === null) {
    body.append(backBar('ページ', () => { location.hash = '/folders' }))
    body.append(emptyState('フォルダを開けませんでした。'))
    return
  }
  body.append(backBar(detail.folder.name, () => { location.hash = '/folders' }))

  const area = listArea()
  body.append(area)

  // 以前は `?new=1` を書くだけだったが、それを読む場所がどこにも無く、押しても何も起きなかった。
  // PCと同じ作成ダイアログをそのまま開く。
  area.append(createButton('＋ 新規ページを作成', () => { void openCreatePage(detail.folder) }))

  if (detail.ab_tests.length === 0) {
    area.append(emptyState('このフォルダにページがありません。'))
    return
  }
  for (const abTest of detail.ab_tests) {
    area.append(pageCard(abTest, detail.folder))
  }
}

/** ページ1件のカード。指標は開いたあとに読み込む（一覧の表示を待たせない） */
function pageCard(abTest: AbTest, folder: Folder): HTMLElement {
  const box = card()
  const head = el('div', { style: 'display:flex;align-items:flex-start;gap:8px' })
  head.append(
    el('div', {
      text: abTest.title,
      style: `flex:1;min-width:0;font-size:15px;font-weight:600;color:${T.text};line-height:1.5`,
    }),
    el('div', {
      text: AD_STATUS_LABELS[abTest.ad_status] ?? abTest.ad_status,
      style: [
        `font-size:11px;color:${STATUS_COLOR[abTest.ad_status] ?? T.sub}`,
        `border:1px solid ${STATUS_COLOR[abTest.ad_status] ?? T.line};border-radius:999px`,
        'padding:2px 8px;white-space:nowrap;flex-shrink:0',
      ].join(';'),
    }),
  )
  box.append(head)

  const kpis = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px' })
  box.append(kpis)
  const paint = (totals: ReportKpi | null): void => {
    kpis.innerHTML = ''
    for (const m of cardMetrics(totals)) {
      const cell = el('div', { style: 'display:flex;flex-direction:column;gap:2px' })
      cell.append(
        el('div', { text: m.label, style: `font-size:11px;color:${T.sub}` }),
        el('div', { text: m.value, style: `font-size:16px;font-weight:700;color:${T.text}` }),
      )
      kpis.append(cell)
    }
  }
  paint(null)
  void api
    .report(abTest.uid, toRangeQuery(defaultRange()))
    .then(({ totals }) => paint(totals), () => paint(null))

  box.append(pageActions(abTest, folder))
  return box
}

/** カードの操作。使う順に並べる（編集がいちばん上） */
function pageActions(abTest: AbTest, folder: Folder): HTMLElement {
  const row = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px' })
  const make = (label: string, onClick: () => void, primary = false): HTMLElement => {
    const btn = el('button', {
      text: label,
      class: 'sb-mobile-tap',
      style: [
        `border-radius:8px;font-size:13px;font-family:${T.font};cursor:pointer;padding:10px`,
        primary
          ? 'border:none;background:var(--sb-accent, #0091FF);color:var(--sb-accent-ink, #FFF)'
          : `border:1px solid ${T.line};background:${T.surface};color:${T.text}`,
      ].join(';'),
    })
    btn.type = 'button'
    btn.addEventListener('click', onClick)
    return btn
  }
  row.append(
    make('編集', () => { location.hash = `/ab_tests/${abTest.uid}/articles` }, true),
    make('レポート', () => { location.hash = `/ab_tests/${abTest.uid}/reports` }),
    make('配信URLをコピー', () => { void copyDeliveryUrl(abTest, folder) }),
    make('くわしく', () => { openDetails(abTest) }),
  )
  return row
}

async function copyDeliveryUrl(abTest: AbTest, folder: Folder): Promise<void> {
  const url = deliveryUrlFor(folder.domain, location.origin, abTest.uid)
  if (url === null) {
    toast(DELIVERY_DOMAIN_UNSET_NOTE, 'error')
    return
  }
  try {
    await navigator.clipboard.writeText(url)
    toast('配信URLをコピーしました')
  } catch {
    toast('コピーできませんでした', 'error')
  }
}

/** 残りの指標をその場で開く（別画面に飛ばさない） */
function openDetails(abTest: AbTest): void {
  const overlay = el('div', {
    style: 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.4);display:flex;align-items:flex-end',
  })
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove()
  })
  const sheet = el('div', {
    style: [
      `background:${T.surface};width:100%;border-radius:16px 16px 0 0;font-family:${T.font}`,
      'padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px))',
    ].join(';'),
  })
  sheet.append(
    el('div', { text: abTest.title, style: `font-size:15px;font-weight:700;color:${T.text};margin-bottom:12px` }),
  )
  const grid = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' })
  sheet.append(grid)
  const fill = (totals: ReportKpi | null): void => {
    grid.innerHTML = ''
    for (const m of cardDetailMetrics(totals)) {
      const cell = el('div')
      cell.append(
        el('div', { text: m.label, style: `font-size:11px;color:${T.sub}` }),
        el('div', { text: m.value, style: `font-size:15px;font-weight:600;color:${T.text}` }),
      )
      grid.append(cell)
    }
  }
  fill(null)
  void api
    .report(abTest.uid, toRangeQuery(defaultRange()))
    .then(({ totals }) => fill(totals), () => fill(null))
  overlay.append(sheet)
  document.body.append(overlay)
}
