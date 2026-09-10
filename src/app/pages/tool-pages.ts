/**
 * ツールの4ページ（一括タグ / マジック置換 / メディア / 審査）。
 * どれも採取した実DOM＋実CSSを土台にし、共通サブナビだけをクローンのハッシュへ張り替える
 * （`tool-subnav.ts`）。本文は4つとも実SB同等の機能実装に差し替えてある。
 *
 * ## クローンの基準＝新規空アカウント（企画書 §1-4・ledger `_model`）
 * 実データ行は再現しない。採取物に実データ行が残っているのは審査だけ（フォルダグループの一覧）。
 * それは容器の中身を落として「枠だけ」にする（手本: `folders.ts` の行落とし）。
 * 残り3ページは採取時点で既に空／作成フォームなので、行落としは不要。
 *
 * ## 採取物に無く、ここで作り足さないもの（推測で埋めない・共通指示 §3-5）
 * - マジック置換・メディア新規作成の**フォーム内部の挙動**（画像/テキスト/リンクのタブ切替、
 *   テンプレート選択後の再描画など）は、押した後の状態を採取していない → 静的に表示する。
 * - メディアのテンプレート選択肢（美容系／求人 等）は採取物のまま。実アプリ提供の定型か
 *   チーム作成物かは採取物からは判別できない（報告に明記）。
 */
import tagsFragment from '../fragments/teams__tags__default.html?raw'
import bulkReplacesFragment from '../fragments/articles__bulk_replaces__default.html?raw'
import mediaFragment from '../fragments/teams__product_search_forms__default.html?raw'
import inspectionsFragment from '../fragments/inspections__folders__default.html?raw'
import { stripGlobalSidebar } from './sidebar-shell.ts'
import { rewireToolSubnav, stripRemovedSubnavTabs, type ToolPage } from './tool-subnav.ts'
import { renderBulkTagsPage } from './bulk-tags-page.ts'
import { renderBulkReplacePage } from './bulk-replace-page.ts'
import { renderMediaPage } from './media-page.ts'
import { renderInspections, renderInspectionTargets } from './inspections-page.ts'

/**
 * 審査ページで実データ行を落とす容器のID（採取物のまま）。
 * `#ts-sortableFolderGroupList`＝グループ配下のフォルダ、`#ts-sortableFolderList`＝グループ外フォルダ。
 * 中身を空にして、検索ボックスと見出しの「枠」だけを残す（空アカ基準）。
 */
export const INSPECTION_LIST_IDS = ['ts-sortableFolderGroupList', 'ts-sortableFolderList'] as const

/** 共通の土台マウント: サイドバー除去 → 本体挿入 → 出さないタブを外す → サブナビ張り替え。 */
function mountToolFragment(container: HTMLElement, fragment: string): HTMLElement {
  container.style.cssText = 'flex:1;min-width:0'
  container.innerHTML = ''
  const root = document.createElement('div')
  root.innerHTML = stripGlobalSidebar(fragment)
  container.append(root)
  stripRemovedSubnavTabs(root)
  rewireToolSubnav(root)
  return root
}

// ── 一括タグ（/teams/tags）＝実SB同等の機能実装（一覧＋追加＋設定フォーム） ──
export function renderToolTags(container: HTMLElement): void {
  const root = mountToolFragment(container, tagsFragment)
  // 採取フラグメントの本文領域(.ehppitp0)を機能UIに差し替える。無ければ container 直下へ。
  const host = root.querySelector<HTMLElement>('.ehppitp0') ?? root
  if (host !== root) host.style.paddingLeft = '0'
  void renderBulkTagsPage(host)
}

// ── マジック置換（/articles/bulk_replaces）＝実SB同等の機能実装 ──
export function renderToolBulkReplaces(container: HTMLElement): void {
  const root = mountToolFragment(container, bulkReplacesFragment)
  // 採取フラグメントの本文領域を機能UIに差し替える（一括タグと同じやり方）。
  const host = root.querySelector<HTMLElement>('.ehppitp0') ?? root
  if (host !== root) host.style.paddingLeft = '0'
  host.style.height = 'calc(100vh - 120px)'
  void renderBulkReplacePage(host)
}

// ── メディア（/teams/product_search_forms）＝実SB同等の機能実装 ──
export function renderToolMedia(container: HTMLElement): void {
  const root = mountToolFragment(container, mediaFragment)
  const host = root.querySelector<HTMLElement>('.ehppitp0') ?? root
  if (host !== root) host.style.paddingLeft = '0'
  host.style.height = 'calc(100vh - 120px)'
  void renderMediaPage(host)
}

/**
 * 審査。実物は**2画面**あって役割が違う（2026-09-10 実機確認）:
 *   /inspections          「審査」   … Version/ポップアップ を絞り込んで審査する
 *   /inspections/folders  「審査対象」… どのフォルダを審査に載せるかのトグル
 * サイドバーは /inspections を指すので、ハッシュを見て出し分ける。
 */
export function renderToolInspections(container: HTMLElement): void {
  const root = mountToolFragment(container, inspectionsFragment)
  // 実データ行（フォルダグループ一覧）は再現しない。容器の中身を空にする（枠は残す）。
  for (const id of INSPECTION_LIST_IDS) {
    root.querySelector(`#${id}`)?.replaceChildren()
  }
  const host = root.querySelector<HTMLElement>('.ehppitp0') ?? root
  if (host !== root) host.style.paddingLeft = '0'
  host.style.height = 'calc(100vh - 120px)'
  const isTargets = location.hash.includes('/inspections/folders')
  void (isTargets ? renderInspectionTargets(host) : renderInspections(host))
}

/** ルート種別 → 描画関数のディスパッチ（`main.ts` から呼ぶ）。 */
export function renderToolPage(page: ToolPage, container: HTMLElement): void {
  switch (page) {
    case 'tags':
      renderToolTags(container)
      return
    case 'bulkReplaces':
      renderToolBulkReplaces(container)
      return
    case 'media':
      renderToolMedia(container)
      return
    case 'inspections':
      renderToolInspections(container)
      return
  }
}
