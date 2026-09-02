/**
 * 「ページ」画面（`/folders`）の土台まわりの純粋関数。
 *
 * この画面は採取した実DOM（`fragments/folders__empty-selection.html`）をそのまま土台にする。
 * 見た目を手書きで似せない代わりに、**配線が掴む目印が実物に在ること**を機械で保証したい。
 * そのために「セレクタ」と「採取HTMLの文字列」を突き合わせる道具をここに置く
 * （環境は node で jsdom が無いため、DOMを使わずに検証できる形にしている・共通指示 §5）。
 *
 * ここに書くのは検査と切り出しだけ。マークアップは1文字も作らない。
 */

/** 実物のフォルダ行が持っている属性。行のクリック先（フォルダ）を特定する目印。 */
export const FOLDER_UID_ATTRIBUTE = 'data-folder-uid'

/**
 * 採取DOM内の目印。すべて**実物に在る**クラス名・`data-testid` で、改名も追加もしていない。
 * `css-*` は Emotion、`e********` は styled-components が振ったID。どちらも採取物のまま。
 *
 * ここに足したものは `tests/folders.test.ts` が採取HTMLと突き合わせるので、
 * 実物に無い目印を書くとテストが落ちる。
 */
export const FOLDERS_HOOK = {
  /** 本体（グローバルサイドバーを除いた側）。シェルがサイドバーを描いているので本体だけ使う。 */
  body: '.ehppitp0',

  // ── 左: フォルダツリー ──
  tree: '[data-testid="side-menu"]',
  treeSearchIcon: '[data-testid="search-icon"]',
  createFolderIcon: '[data-testid="generate-folder-icon"]',
  treeTab: '.eyrb9320',
  treeList: '.efy50tl13',
  folderRow: '[data-folder-uid]',
  folderRowName: '.ea00ncb3',
  folderRowActions: '.ea00ncb4',
  folderIcon: '[data-testid="folder-icon"]',

  // ── 右: beyondページ一覧の側 ──
  mainPane: '.e11hwzd00',
  folderSearchButton: '.efy50tl0',
  periodSelect: '.e5a3hxd1',
  adStatusSelect: '.e8c3jcp1',
  /** 一覧の入る容器。`folders__detail` ではKPI列つきのページ一覧が入る。 */
  listArea: '.efy50tl20',
  /** ページ行（`data-testid="list-menu-item"`）が並ぶ内側の容器。 */
  pageRowList: '.efy50tl18',
  /** 右の詳細パネル（URL情報 / beyondページ情報 / 配信情報 / パラメータ付きURL発行）。 */
  detailPanel: '.efy50tl16',
} as const

export interface SelectorMarker {
  kind: 'class' | 'attribute'
  name: string
  /** 属性セレクタの値。値を指定しない `[attr]` は null。 */
  value: string | null
}

const CLASS_PATTERN = /\.([A-Za-z_][\w-]*)/g
const ATTRIBUTE_PATTERN = /\[([A-Za-z_][\w-]*)(?:="([^"]*)")?\]/g

/**
 * セレクタを「採取HTMLの中で探せる条件」へ分解する。
 * 対応するのはクラスと属性だけ（`FOLDERS_HOOK` がその2種類しか使っていない）。
 * 分解できない形（子孫結合子など）は空配列になり、検査は不合格側に倒れる。
 */
export function selectorMarkers(selector: string): SelectorMarker[] {
  const markers: SelectorMarker[] = []
  for (const match of selector.matchAll(CLASS_PATTERN)) {
    markers.push({ kind: 'class', name: match[1] as string, value: null })
  }
  for (const match of selector.matchAll(ATTRIBUTE_PATTERN)) {
    markers.push({ kind: 'attribute', name: match[1] as string, value: match[2] ?? null })
  }
  const consumed = selector.replace(CLASS_PATTERN, '').replace(ATTRIBUTE_PATTERN, '').trim()
  // タグ名だけは残ってよい（`svg[data-testid=…]` のような形）。それ以外が残るなら分解できていない。
  return /^[A-Za-z]*$/.test(consumed) ? markers : []
}

/** クラス名がいくつの要素に付いているか。部分一致では数えない。 */
export function countClassToken(html: string, token: string): number {
  let count = 0
  for (const match of html.matchAll(/class="([^"]*)"/g)) {
    if ((match[1] ?? '').split(/\s+/).includes(token)) count += 1
  }
  return count
}

function hasAttribute(html: string, name: string, value: string | null): boolean {
  if (value !== null) return html.includes(`${name}="${value}"`)
  return new RegExp(`\\s${name.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')}=`).test(html)
}

/** そのセレクタが掴む相手が採取HTMLに在るか。分解できないセレクタは常に false。 */
export function isSelectorInCapture(html: string, selector: string): boolean {
  const markers = selectorMarkers(selector)
  if (markers.length === 0) return false
  return markers.every((marker) =>
    marker.kind === 'class'
      ? countClassToken(html, marker.name) > 0
      : hasAttribute(html, marker.name, marker.value),
  )
}

/**
 * `<div` から対応する `</div>` までを切り出す。
 * `div` の入れ子だけを数える（採取HTMLの属性値に `<div` は現れない）。
 */
function sliceBalancedDiv(html: string, start: number): string | null {
  const tagPattern = /<\/?div\b/g
  tagPattern.lastIndex = start
  let depth = 0
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(html)) !== null) {
    if (match[0] === '</div') {
      depth -= 1
      if (depth > 0) continue
      const end = html.indexOf('>', tagPattern.lastIndex)
      return end === -1 ? null : html.slice(start, end + 1)
    }
    depth += 1
  }
  return null
}

/**
 * 目印を含む `<div>` を、対応する閉じタグまで丸ごと切り出す。
 * 目印は属性の一部（`data-folder-uid="` など）を想定している。
 */
export function extractEnclosingDiv(html: string, marker: string): string | null {
  const at = html.indexOf(marker)
  if (at === -1) return null
  const start = html.lastIndexOf('<div', at)
  return start === -1 ? null : sliceBalancedDiv(html, start)
}

/**
 * 採取HTMLから**フォルダ1行ぶんのマークアップ**を切り出す。
 *
 * クローンのフォルダはグループを持たないので、土台にするのは
 * `data-folder-uid` を持つ「フォルダ行」（`folder-icon`）の方。
 * フォルダ「グループ」行（`folder-group-icon`・件数バッジ付き）は使わない。
 *
 * 返すのは採取物そのままの文字列で、名前と uid は描画時に差し替える。
 */
export function extractFolderRowTemplate(html: string): string | null {
  return extractEnclosingDiv(html, `${FOLDER_UID_ATTRIBUTE}="`)
}
