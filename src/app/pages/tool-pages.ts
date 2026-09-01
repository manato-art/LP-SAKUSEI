/**
 * ツールの5ページ（一括タグ / マジック置換 / メディア / 審査 / フォーム）。
 * どれも採取した実DOM＋実CSSを土台にし、共通サブナビだけをクローンのハッシュへ張り替える
 * （`tool-subnav.ts`）。書き込み系の操作は挙動を採取していないので未実装トーストで正直に返す。
 *
 * ## クローンの基準＝新規空アカウント（企画書 §1-4・ledger `_model`）
 * 実データ行は再現しない。採取物に実データ行が残っているのは審査だけ（フォルダグループの一覧）。
 * それは容器の中身を落として「枠だけ」にする（手本: `folders.ts` の行落とし）。
 * 残り4ページは採取時点で既に空／作成フォーム／告知なので、行落としは不要。
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
import formsFragment from '../fragments/folders__forms__default.html?raw'
import { stripGlobalSidebar } from './sidebar-shell.ts'
import { rewireToolSubnav, type ToolPage } from './tool-subnav.ts'
import { toast } from '../ui.ts'

/**
 * 審査ページで実データ行を落とす容器のID（採取物のまま）。
 * `#ts-sortableFolderGroupList`＝グループ配下のフォルダ、`#ts-sortableFolderList`＝グループ外フォルダ。
 * 中身を空にして、検索ボックスと見出しの「枠」だけを残す（空アカ基準）。
 */
export const INSPECTION_LIST_IDS = ['ts-sortableFolderGroupList', 'ts-sortableFolderList'] as const

/** 共通の土台マウント: サイドバー除去 → 本体挿入 → サブナビ張り替え。 */
function mountToolFragment(container: HTMLElement, fragment: string): HTMLElement {
  container.style.cssText = 'flex:1;min-width:0'
  container.innerHTML = ''
  const root = document.createElement('div')
  root.innerHTML = stripGlobalSidebar(fragment)
  container.append(root)
  rewireToolSubnav(root)
  return root
}

/**
 * 指定ラベルの要素（葉ノード）を押したら未実装トーストを出す。
 * 書き込み系（保存/作成/アップロード/送信/追加）は採取物に挙動が無いので実行しない（§3-5）。
 */
function wireUnimplementedByText(root: HTMLElement, labels: readonly string[]): void {
  const wanted = new Set(labels)
  for (const node of root.querySelectorAll<HTMLElement>('*')) {
    if (node.children.length > 0) continue // 葉ノードだけ（親コンテナを誤爆させない）
    const text = (node.textContent ?? '').trim()
    if (!wanted.has(text)) continue
    const target = (node.closest('button, [role="button"], a') as HTMLElement | null) ?? node
    target.style.cursor = 'pointer'
    target.addEventListener('click', () => {
      toast(`「${text}」はモックでは未実装です`, 'error')
    })
  }
}

// ── 一括タグ（/teams/tags）＝空。追加ボタンだけ ─────────────────
export function renderToolTags(container: HTMLElement): void {
  const root = mountToolFragment(container, tagsFragment)
  // 「タグ設定を追加」＝作成起点（POST相当）。作成フォームは未採取。
  wireUnimplementedByText(root, ['タグ設定を追加'])
}

// ── マジック置換（/articles/bulk_replaces）＝設定フォーム。実行系のみ配線 ──
export function renderToolBulkReplaces(container: HTMLElement): void {
  const root = mountToolFragment(container, bulkReplacesFragment)
  wireUnimplementedByText(root, ['置換する', 'アップロード', 'リセット'])
}

// ── メディア（/teams/product_search_forms）＝一覧は空＋新規作成フォーム ──
export function renderToolMedia(container: HTMLElement): void {
  const root = mountToolFragment(container, mediaFragment)
  wireUnimplementedByText(root, ['保存する', '新規作成'])
}

// ── 審査（/inspections・/inspections/folders）＝実データ行を落として枠だけ ──
export function renderToolInspections(container: HTMLElement): void {
  const root = mountToolFragment(container, inspectionsFragment)
  // 実データ行（フォルダグループ一覧）は再現しない。容器の中身を空にする（枠は残す）。
  for (const id of INSPECTION_LIST_IDS) {
    root.querySelector(`#${id}`)?.replaceChildren()
  }
}

// ── フォーム（/folders/forms）＝機能追加の告知ページ（静的） ──────
export function renderToolForms(container: HTMLElement): void {
  const root = mountToolFragment(container, formsFragment)
  // 「担当者に問い合わせをする」＝送信相当。押しても実行しない。
  wireUnimplementedByText(root, ['担当者に問い合わせをする'])
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
    case 'forms':
      renderToolForms(container)
      return
  }
}
