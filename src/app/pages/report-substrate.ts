/**
 * 採取したページ断片（`src/app/fragments/*.html`）を、クローンの画面に差し込める形にする。
 *
 * 断片は**ページ全体**（左のグローバルサイドバー＋本体）を含んでいる。
 * クローン側は `shell.ts` がサイドバーを描いているので、ここでは本体だけを取り出す。
 * マークアップは一切書き換えない（企画書 §11 capture-and-rehydrate）。
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

/** グローバルサイドバーの目印（`shell.ts` が使っているのと同じ実物の属性） */
const SHELL_MARKER = 'data-testid="list-menu-item"'

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
 * サイドバー（`list-menu-item` を含むトップレベル要素）を落として本体だけを返す。
 * サイドバーが無ければ入力をそのまま返す。
 *
 * 採取物には2通りの入れ子がある:
 *   - サイドバーと本体が**兄弟**（reports / exit_popups / split_test_settings など）
 *   - サイドバーと本体が**1枚の外枠でくるまれている**（redirect_pages。外側に
 *     `h-[100vh]` → `flex h-full flex-col` が付いた状態で採れている）
 * 後者はトップレベルが1要素で、その中にサイドバーと本体の両方が入るため、
 * 単純なトップレベル除去だと本体ごと消える。**単一の外枠は1枚ずつ剥がして再帰**する。
 */
export function stripShellFromFragment(html: string): string {
  if (!html.includes(SHELL_MARKER)) return html
  const elements = topLevelElements(html)
  if (elements.length === 0) return html
  const kept = elements
    .map((range) => html.slice(range.start, range.end))
    .filter((chunk) => !chunk.includes(SHELL_MARKER))

  // サイドバーが兄弟として分離できた（本体が残った）
  if (kept.length > 0) return kept.length === elements.length ? html : kept.join('')

  // トップレベル1要素の中にサイドバーと本体が同居 → 外枠を1枚剥がして再帰する
  if (elements.length === 1) {
    const chunk = html.slice(elements[0]?.start, elements[0]?.end)
    const inner = unwrapOuterElement(chunk)
    if (inner !== null) return stripShellFromFragment(inner)
  }
  return html
}

/** `<div ...>…</div>` の外側タグを1枚剥がして中身を返す（剥がせなければ null） */
function unwrapOuterElement(chunk: string): string | null {
  const open = chunk.indexOf('>')
  const close = chunk.lastIndexOf('</')
  if (open === -1 || close === -1 || close <= open) return null
  return chunk.slice(open + 1, close)
}

/**
 * 採取時の ab_test uid を断片から読み取る。
 *
 * 採取物の値をソースへ転記しない（共通指示 §1-2）ため、
 * 「置換対象のプレースホルダ」は**実行時に断片から取り出す**。
 */
export function extractCapturedAbTestUid(html: string): string | null {
  const match = /href="\/ab_tests\/([^/"?]+)\/(?:reports|articles)/.exec(html)
  return match?.[1] ?? null
}

/**
 * 採取物に残っている実アプリのリンクを、クローンのハッシュルートへ差し替える。
 * - 同一アプリのパス（`/` 始まり）だけを対象にする
 * - 採取時の ab_test uid は、いま開いているページの uid に置き換える
 * - それ以外（外部リンク・相対リンク）は `null` を返し、遷移させない
 */
export function toHashHref(
  href: string,
  capturedUid: string | null,
  currentUid: string,
): string | null {
  if (!href.startsWith('/')) return null
  const path =
    capturedUid === null ? href : href.split(capturedUid).join(currentUid)
  return `#${path}`
}
