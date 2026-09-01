/**
 * バージョンカードの「…」メニュー（エディタ Version パネル・企画書 §11 capture-and-rehydrate）。
 *
 * **手書きでUIを似せない。** メニュー本体は採取した実DOM
 * `fragments/ab_tests__UID__articles__version-dots-menu.portals.html`（MUI Popover）を
 * そのまま土台にし、項目の**挙動だけ**を後付けする。見た目は採取済み実CSS
 * `/clean/ab_tests__UID__articles/version-dots-menu/cssom.css`（index.html が読み込む）が担保する。
 *
 * トリガーはカードの「…」ボタン（`_articleButtons_1xibh_160` 内の `button.css-3tls8`・実DOMで確認）。
 *
 * 各項目の裏付け:
 *  - 複製             … モックの `POST /versions/:uid/duplicate`（api.duplicateVersion）に結線＝実挙動。
 *  - HTMLをダウンロード … いま開いている Version の html/css からクライアント側でファイルを作る＝実挙動。
 *  - 別のbeyondページに複製 … モックに「別ページへ複製」概念が無いので未実装トーストで正直に。
 *  - アーカイブする      … モックにアーカイブ概念が無い。破壊系なので確認してから未実装トースト。
 *  - 選択してアーカイブする … 同上（一括選択モードも未モデル化）。
 */
import rawMenu from '../fragments/ab_tests__UID__articles__version-dots-menu.portals.html?raw'
import type { Version } from '../api.ts'
import { api } from '../api.ts'
import { toast } from '../ui.ts'
import { bindBackdropClose, findByExactText, openPortal } from './portal.ts'

/** 採取物の目印（実物のクラス。書き換えていない） */
export const DOTS_MENU_HOOK = {
  /** カードのボタン群 */
  buttons: '._articleButtons_1xibh_160',
  /** 「…」ボタン（MoreHoriz・実DOMのクラス） */
  trigger: 'button.css-3tls8',
  /** ポータル本体（MUI Popover） */
  popover: '[role="presentation"]',
  /** 背景（クリックで閉じる） */
  backdrop: '.MuiBackdrop-root',
  /** メニュー項目 */
  item: 'li[role="menuitem"]',
  /** 項目ラベル */
  label: '.MuiListItemText-primary',
} as const

/** 採取物に実在するメニュー項目の文言（順番も実物のとおり） */
export const DOTS_MENU_LABELS = {
  duplicate: '複製',
  duplicateToOther: '別のbeyondページに複製',
  downloadHtml: 'HTMLをダウンロード',
  archive: 'アーカイブする',
  archiveSelected: '選択してアーカイブする',
} as const

/**
 * Version の html/css から、ダウンロード用の完結したHTML文書を組み立てる（純粋関数）。
 * 実物のダウンロード物の中身は未採取なので、クローンでは保存済みの html を css 付きで包むだけにする
 * （外部へは一切出さない・§3-2）。
 */
export function buildVersionHtmlDocument(version: Pick<Version, 'name' | 'html' | 'css'>): string {
  return [
    '<!doctype html>',
    '<html lang="ja">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(version.name)}</title>`,
    `<style>${version.css}</style>`,
    '</head>',
    `<body>${version.html}</body>`,
    '</html>',
    '',
  ].join('\n')
}

/** ダウンロードファイル名（Version 名を安全化して .html を付ける・純粋関数） */
export function versionHtmlFilename(name: string): string {
  const safe = name.trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_')
  const base = safe === '' ? 'version' : safe
  return `${base}.html`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export interface DotsMenuDeps {
  /** いま開いている Version（複製元・ダウンロード対象） */
  getCurrentVersion: () => Version | null
  /** 複製に成功したときの後処理（複製先へ切り替える等） */
  onDuplicated: (version: Version) => void
  /** アーカイブに成功したときの後処理（一覧から外して別Versionへ切り替える等） */
  onArchived: (version: Version) => void
}

/**
 * カードの「…」ボタンにメニューを配線する。
 * 土台にトリガーが居ることが前提（居なければ何も配線しない）。
 */
export function mountVersionDotsMenu(root: HTMLElement, deps: DotsMenuDeps): void {
  const buttons = root.querySelector<HTMLElement>(DOTS_MENU_HOOK.buttons)
  const trigger = buttons?.querySelector<HTMLElement>(DOTS_MENU_HOOK.trigger) ?? null
  if (trigger === null) {
    console.warn('[version-dots-menu] 「…」トリガー', DOTS_MENU_HOOK.trigger, 'が土台に見つかりませんでした')
    return
  }
  if (trigger.dataset['cloneDotsMenuWired'] === 'true') return
  trigger.dataset['cloneDotsMenuWired'] = 'true'
  trigger.style.cursor = 'pointer'

  let open = false
  trigger.addEventListener('click', (event) => {
    event.stopPropagation()
    if (open) return
    open = true
    openMenu(deps, () => {
      open = false
    })
  })
}

function openMenu(deps: DotsMenuDeps, onClosed: () => void): void {
  const portal = openPortal(rawMenu, DOTS_MENU_HOOK.popover, onClosed)
  if (portal === null) {
    onClosed()
    toast('メニューのマークアップが壊れています', 'error')
    return
  }

  const backdrop = portal.root.querySelector<HTMLElement>(DOTS_MENU_HOOK.backdrop)
  if (backdrop !== null) bindBackdropClose(backdrop, portal.close)

  const handlers: Readonly<Record<string, () => void>> = {
    [DOTS_MENU_LABELS.duplicate]: () => void duplicate(deps),
    [DOTS_MENU_LABELS.downloadHtml]: () => downloadHtml(deps),
    [DOTS_MENU_LABELS.duplicateToOther]: () =>
      toast('別のbeyondページに複製は未実装です', 'error'),
    [DOTS_MENU_LABELS.archive]: () => {
      if (globalThis.confirm('このVersionをアーカイブしますか？')) void archive(deps)
    },
    [DOTS_MENU_LABELS.archiveSelected]: () =>
      toast('選択してアーカイブするは未実装です', 'error'),
  }

  for (const [label, handler] of Object.entries(handlers)) {
    const span = findByExactText(portal.root, DOTS_MENU_HOOK.label, label)
    const item = span?.closest<HTMLElement>(DOTS_MENU_HOOK.item) ?? null
    if (item === null) {
      console.warn('[version-dots-menu] 項目', label, 'が採取物に見つかりませんでした')
      continue
    }
    item.style.cursor = 'pointer'
    item.addEventListener('click', (event) => {
      event.stopPropagation()
      portal.close()
      handler()
    })
  }
}

async function archive(deps: DotsMenuDeps): Promise<void> {
  const current = deps.getCurrentVersion()
  if (current === null) {
    toast('アーカイブ対象のVersionが見つかりません', 'error')
    return
  }
  try {
    const { version } = await api.archiveVersion(current.uid)
    toast(`${version.name} をアーカイブしました`)
    deps.onArchived(version)
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}

async function duplicate(deps: DotsMenuDeps): Promise<void> {
  const current = deps.getCurrentVersion()
  if (current === null) {
    toast('複製元のVersionが見つかりません', 'error')
    return
  }
  try {
    const { version } = await api.duplicateVersion(current.uid)
    toast(`${version.name} に複製しました`)
    deps.onDuplicated(version)
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}

function downloadHtml(deps: DotsMenuDeps): void {
  const current = deps.getCurrentVersion()
  if (current === null) {
    toast('ダウンロード対象のVersionが見つかりません', 'error')
    return
  }
  const blob = new Blob([buildVersionHtmlDocument(current)], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = versionHtmlFilename(current.name)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    toast('HTMLをダウンロードしました')
  } finally {
    URL.revokeObjectURL(url)
  }
}
