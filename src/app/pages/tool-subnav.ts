/**
 * ツールのサブナビ（フォルダ / 一括タグ / マジック置換 / メディア / 審査）の
 * ルート解決とアンカー張り替え。4つのツールページで共通に使う（純粋関数＋最小のDOM配線）。
 *
 * サブナビの各タブは採取物では実アプリの絶対パス（`/teams/tags` など）を指している。
 * クローンはハッシュルーティングなので、それらをクローンのハッシュへ張り替える
 * （`toHashHref` を流用・共通指示 §2「配線だけを後付け」）。マークアップは書き換えない。
 *
 * 例外が1つ。**フォーム（`/folders/forms`）は出さない**（本人指示 2026-09-10）。
 * 張り替え対象から外し、タブ自体を表示前にDOMから外す
 * （`REMOVED_SUBNAV_PATHS` と `stripRemovedSubnavTabs`）。採取HTMLは書き換えない。
 */
import { toHashHref } from './report-substrate.ts'

export type ToolPage = 'tags' | 'bulkReplaces' | 'media' | 'inspections'

/**
 * 各ツールページの実ルート（採取物のサブナビ href と同じ値）。
 * 審査だけは採取物のサブナビが `/inspections` を指すが、本体を採取したのは
 * `/inspections/folders`。ルート解決では両方を受ける（下の `matchToolPage`）。
 */
export const TOOL_PAGE_ROUTES: Readonly<Record<ToolPage, string>> = {
  tags: '/teams/tags',
  bulkReplaces: '/articles/bulk_replaces',
  media: '/teams/product_search_forms',
  inspections: '/inspections',
} as const

/**
 * 採取物のサブナビには在るが、クローンでは出さないタブ。
 * フォームは実物でも2021年の告知ページのままで、唯一のボタンは href が無く押しても
 * 何も起きない。今後使わないので消す（本人指示 2026-09-10）。
 */
export const REMOVED_SUBNAV_PATHS = ['/folders/forms'] as const

/** 審査の本体を採取した実URL。サブナビの `/inspections` からもここへ着地させる。 */
export const INSPECTIONS_CANONICAL_ROUTE = '/inspections/folders'

/**
 * 出すサブナビ5タブの href の正本（採取物と同じ順・同じ値。フォームだけ抜いてある）。
 * フォルダ（`/folders`）は既存の `renderFolders` ルートへ張り替わる。
 * ここに載っている絶対パスだけをハッシュへ張り替え、それ以外の絶対リンクは遷移させない。
 */
export const TOOL_SUBNAV_PATHS = [
  '/folders',
  '/teams/tags',
  '/articles/bulk_replaces',
  '/teams/product_search_forms',
  '/inspections',
] as const

/** サブナビ5タブの表示名（採取物の文言。ラベル照合はテストが採取HTMLと突き合わせる）。 */
export const TOOL_SUBNAV_LABELS: Readonly<Record<(typeof TOOL_SUBNAV_PATHS)[number], string>> = {
  '/folders': 'フォルダ',
  '/teams/tags': '一括タグ',
  '/articles/bulk_replaces': 'マジック置換',
  '/teams/product_search_forms': 'メディア',
  '/inspections': '審査',
} as const

const TOOL_SUBNAV_SET: ReadonlySet<string> = new Set(TOOL_SUBNAV_PATHS)

/** サブナビの絶対パスを、クローンのハッシュルートへ変換する（純粋関数）。 */
export function toolSubnavHash(path: string): string | null {
  if (!TOOL_SUBNAV_SET.has(path)) return null
  return toHashHref(path, null, '')
}

/**
 * パスを対応するツールページ種別へ解決する。未知のパスは null（推測で埋めない）。
 * 審査は `/inspections`（サブナビの遷移先）と `/inspections/folders`（採取した本体）の両方を受ける。
 */
export function matchToolPage(path: string): ToolPage | null {
  switch (path) {
    case TOOL_PAGE_ROUTES.tags:
      return 'tags'
    case TOOL_PAGE_ROUTES.bulkReplaces:
      return 'bulkReplaces'
    case TOOL_PAGE_ROUTES.media:
      return 'media'
    case TOOL_PAGE_ROUTES.inspections:
    case INSPECTIONS_CANONICAL_ROUTE:
      return 'inspections'
    default:
      return null
  }
}

/**
 * 出さないタブ（`REMOVED_SUBNAV_PATHS`）を採取DOMから外す。張り替えより先に呼ぶ。
 * サブナビはPC用とSP用で同じ href が2回出るので、両方まとめて消す。
 */
export function stripRemovedSubnavTabs(root: HTMLElement): void {
  for (const path of REMOVED_SUBNAV_PATHS) {
    for (const anchor of root.querySelectorAll<HTMLAnchorElement>(`a[href="${path}"]`)) {
      ;(anchor.closest('li') ?? anchor).remove()
    }
  }
}

/**
 * サブナビ5タブ（と本体に残る既知ツールリンク）を、クローンのハッシュへ張り替える。
 * サブナビ以外の絶対リンク（採取物に残った実アプリのパス）は遷移させない（クローンの外へ出さない）。
 */
export function rewireToolSubnav(root: HTMLElement): void {
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = anchor.getAttribute('href') ?? ''
    const hash = toolSubnavHash(href)
    if (hash !== null) {
      anchor.setAttribute('href', hash)
      continue
    }
    // サブナビ以外の絶対リンクは、押しても遷移させない（実アプリの外へ出さない・§1-1）
    if (href.startsWith('/') || href.startsWith('http')) {
      anchor.addEventListener('click', (event) => event.preventDefault())
    }
  }
}

/**
 * 審査の2画面（審査 / 審査対象）の切り替え。
 * 以前は審査対象へ行く道が閉じられる案内帯にしか無く、閉じると行けなくなった。
 * 2画面とも、この切り替えを常に出す（inspections-page.ts の screenSwitch）。
 */
export const INSPECTION_SCREENS = [
  { label: '審査', hash: '#/inspections' },
  { label: '審査対象', hash: `#${INSPECTIONS_CANONICAL_ROUTE}` },
] as const

/**
 * 採取したツール画面の土台を、サブナビを残したまま中身だけ差し替えられる形に整え、
 * 中身を描く場所を返す（見つからなければ null）。
 *
 * 採取物の形: `.ehppitp0 > div(flex-col md:flex-row) > [div.hidden.md:flex > nav(PC) nav(スマホ)] + 中身の箱`
 *   1. 以前は `.ehppitp0` を丸ごと空にしていたので、サブナビまで消えていた → 中身の箱だけを返す
 *   2. スマホ用の横並びサブナビ（md:hidden）は PC 用の枠（hidden md:flex）の中にあり、
 *      スマホでは枠ごと消えていた → 枠の手前（同じ並び）へ出す。PC では md:hidden で隠れる
 */
export function prepareToolLayout(root: ParentNode): HTMLElement | null {
  const row = root.querySelector<HTMLElement>('.ehppitp0 > div')
  if (row === null) return null
  const children = [...row.children] as HTMLElement[]
  const navWrap = children.find((c) => c.querySelector('nav') !== null)
  if (navWrap !== undefined) {
    for (const nav of navWrap.querySelectorAll<HTMLElement>('nav')) {
      if (nav.classList.contains('md:hidden')) row.insertBefore(nav, navWrap)
    }
  }
  return children.find((c) => c !== navWrap) ?? null
}
