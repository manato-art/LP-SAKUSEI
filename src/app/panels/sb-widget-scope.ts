/**
 * 取り込んだ見本（SquadBeyond の Widget）を、SquadBeyond 本体と同じ形で LP に入れる（2026-10-26）。
 *
 * SB本体の「検証」ページに入れて確かめた形（tests/sb-widget-scope.test.ts）:
 *   <div class="sb-custom"><div id="sb-part-番号" class="sb-custom-part 印">元のHTML</div><style data-sb-custom-style>囲ったCSS</style></div>
 * - CSS の決まりの頭に「#sb-part-番号.印 」を付け、その Widget の中だけに効くようにする（@media・@supports の中も）
 * - @keyframes・@font-face などは囲わない。「,」で並べた決まりは1つずつ。body から始まる決まりも機械的に頭を付ける
 *   （SBではその決まりはどこにも当たらない＝効いていない。囲わずに入れると EBIyon でだけ効いてしまう）
 * - 印は入れるたびに変わる（同じ Widget を2つ入れても CSS がぶつからない）
 * EBIyon では外側の .sb-custom は LP の部品の枠が受け持つ（配信で付く・src/shared/sb-page-structure.ts）。
 */

/** 中の決まりにも頭を付ける @ の決まり（ほかの @ の決まりは中を触らない） */
const NESTED_RULES = /^@(?:-webkit-)?(?:media|supports|container|layer|document)\b/i

/** i から、空白とコメントを飛ばした先 */
function skipTrivia(css: string, from: number): number {
  let i = from
  while (i < css.length) {
    if (/\s/.test(css[i] ?? '')) i += 1
    else if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2)
      i = end < 0 ? css.length : end + 2
    } else break
  }
  return i
}

/** 文字列・コメントを1つ読み飛ばした先（当たらなければ from のまま） */
function skipQuotedOrComment(css: string, from: number): number {
  const ch = css[from]
  if (ch === '"' || ch === "'") {
    let i = from + 1
    while (i < css.length && css[i] !== ch) i += css[i] === '\\' ? 2 : 1
    return i + 1
  }
  if (css.startsWith('/*', from)) {
    const end = css.indexOf('*/', from + 2)
    return end < 0 ? css.length : end + 2
  }
  return from
}

/** 決まりの頭の終わり（深さ0の「{」か「;」の位置。無ければ末尾） */
function preludeEnd(css: string, from: number): number {
  let depth = 0
  let i = from
  while (i < css.length) {
    const skipped = skipQuotedOrComment(css, i)
    if (skipped !== i) {
      i = skipped
      continue
    }
    const ch = css[i]
    if (ch === '(' || ch === '[') depth += 1
    else if (ch === ')' || ch === ']') depth -= 1
    else if (depth <= 0 && (ch === '{' || ch === ';')) return i
    i += 1
  }
  return css.length
}

/** open の「{」と対になる「}」の位置（無ければ末尾） */
function matchingBrace(css: string, open: number): number {
  let depth = 0
  let i = open
  while (i < css.length) {
    const skipped = skipQuotedOrComment(css, i)
    if (skipped !== i) {
      i = skipped
      continue
    }
    if (css[i] === '{') depth += 1
    else if (css[i] === '}') {
      depth -= 1
      if (depth === 0) return i
    }
    i += 1
  }
  return css.length
}

/** 「,」で並べた決まりを1つずつに分ける（( ) [ ] と文字列の中の「,」では分けない） */
function splitSelectors(prelude: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  let i = 0
  while (i < prelude.length) {
    const skipped = skipQuotedOrComment(prelude, i)
    if (skipped !== i) {
      i = skipped
      continue
    }
    const ch = prelude[i]
    if (ch === '(' || ch === '[') depth += 1
    else if (ch === ')' || ch === ']') depth -= 1
    else if (ch === ',' && depth === 0) {
      parts.push(prelude.slice(start, i))
      start = i + 1
    }
    i += 1
  }
  parts.push(prelude.slice(start))
  return parts
}

/** CSS の決まりの頭に prefix を付けて、その Widget の中だけに効くようにする（SB本体と同じ） */
export function scopeSbCss(css: string, prefix: string): string {
  let out = ''
  let i = 0
  while (i < css.length) {
    const start = skipTrivia(css, i)
    out += css.slice(i, start)
    i = start
    if (i >= css.length) break
    if (css[i] === '}') {
      // 対になる「{」の無い「}」（壊れたCSS）はそのまま
      out += '}'
      i += 1
      continue
    }
    const end = preludeEnd(css, i)
    const prelude = css.slice(i, end)
    if (end >= css.length) {
      out += prelude
      break
    }
    if (css[end] === ';') {
      // @import・@charset など
      out += `${prelude};`
      i = end + 1
      continue
    }
    const close = matchingBrace(css, end)
    const body = css.slice(end + 1, close)
    const head = prelude.trim()
    if (head.startsWith('@')) out += `${prelude}{${NESTED_RULES.test(head) ? scopeSbCss(body, prefix) : body}}`
    else out += `${splitSelectors(prelude).map((part) => `${prefix} ${part.trim()}`).join(', ')}{${body}}`
    i = close + 1
  }
  return out
}

export interface SbInsertPart {
  readonly id: number
  readonly name: string
  readonly html: string
  readonly css: string
}

/** 入れるたびに変わる印（SB本体と同じく英小文字と数字。CSS のクラス名なので英字で始める） */
export function newSbToken(): string {
  return `sb${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`
}

/** LP に入れる中身（SB本体と同じ形。外側の .sb-custom は部品の枠が受け持つ） */
export function sbInsertMarkup(part: SbInsertPart, token: string): string {
  const inner = `<div id="sb-part-${part.id}" class="sb-custom-part ${token}">${part.html}</div>`
  if (part.css.trim() === '') return inner
  return `${inner}<style data-sb-custom-style="">${scopeSbCss(part.css, `#sb-part-${part.id}.${token}`)}</style>`
}
