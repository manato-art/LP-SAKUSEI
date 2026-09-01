/**
 * サイドバー各画面の採取断片から、左のグローバルサイドバーだけを落として本体を返す。
 *
 * `report-substrate.ts` の `stripShellFromFragment` は `data-testid="list-menu-item"` を
 * 目印にする。だが AI画面（sb_ai）は**本体の中にも**チャット履歴のサブナビがあり、
 * それも同じ `data-testid="list-menu-item"` を使っている。その目印では本体まで消える。
 *
 * ここでは「グローバルサイドバーだけが持つ採取物のロゴ（`alt="Squadbeyond Logo"`）」を
 * 目印に、そのロゴを含むトップレベル要素だけを落とす。マークアップは書き換えない
 * （企画書 §11 capture-and-rehydrate）。クローン側の `shell.ts` が左サイドバーを描く。
 */

/** 内容を持たない要素（閉じタグが無い） */
const VOID_TAGS: ReadonlySet<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

/** グローバルサイドバー固有の目印（採取物のロゴ。AIパネルのサブナビには無い） */
const GLOBAL_SIDEBAR_MARKER = 'Squadbeyond Logo'

interface TopLevelElement {
  start: number
  end: number
}

/** 断片のトップレベル要素の範囲を返す（タグを数えるだけ・DOM不要） */
function topLevelElements(html: string): TopLevelElement[] {
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g
  const found: TopLevelElement[] = []
  let depth = 0
  let start = -1
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(html)) !== null) {
    const isClosing = match[1] === '/'
    const tag = (match[2] ?? '').toLowerCase()
    const isSelfClosing = match[4] === '/'
    if (isClosing) {
      depth -= 1
      if (depth === 0 && start !== -1) {
        found.push({ start, end: tagPattern.lastIndex })
        start = -1
      }
      continue
    }
    if (isSelfClosing || VOID_TAGS.has(tag)) {
      if (depth === 0) found.push({ start: match.index, end: tagPattern.lastIndex })
      continue
    }
    if (depth === 0) start = match.index
    depth += 1
  }
  return found
}

/**
 * グローバルサイドバー（ロゴを含むトップレベル要素）を落として本体を返す。
 * 目印が無い、またはトップレベル要素が取れない場合は入力をそのまま返す。
 */
export function stripGlobalSidebar(html: string): string {
  if (!html.includes(GLOBAL_SIDEBAR_MARKER)) return html
  const elements = topLevelElements(html)
  if (elements.length === 0) return html
  const kept = elements
    .map((range) => html.slice(range.start, range.end))
    .filter((chunk) => !chunk.includes(GLOBAL_SIDEBAR_MARKER))
  // 落とすべき要素が1つも無ければ（目印が入れ子の途中にしか無い等）安全側で無変更
  if (kept.length === elements.length) return html
  return kept.join('')
}
