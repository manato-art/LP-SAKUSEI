/**
 * 見本の部品（ライブラリの見本・手で書いたHTML）の CSS を、その部品の中だけに効かせる（2026-10-18 本人の指摘）。
 *
 * 手で書いたHTMLの CSS は `.downArrow{--arrow-color:#f00}` のように範囲を持たない。
 * 部品の CSS をそのまま書き出すと LP のページ全体に効き、同じクラス名の見本を別の Widget に入れて色を変えると、
 * あとに入れた Widget の色が前の Widget にも効いていた（本人「両方青くなった、青が最後に入れた」）。
 * 書き出すときに、規則の頭へ「その Widget のその部品」（`.nc-xxxx .nc-b-3`）を付ける。
 *
 * - 部品ごとに付ける（同じ見本を1つの Widget に2つ入れて色を変えても混ざらない）。
 *   設問ごとに分けた見本は、どの部品にも同じ CSS が入っているので、どの部品にもその部品の分が残る。
 * - `:root` / `html` / `body` そのものへの指定は CSS変数だけを部品へ移す（ページ全体の背景などは持ち込まない）。
 *   Widget編集のプレビュー（widget-style-scope.ts）と同じ扱い。
 * - @media・@supports・@container の中にも付ける。@keyframes・@font-face・@import はそのまま。
 * - 保存してある見本のHTML（部品の設定データ）は書き換えない。書き出すときだけ付ける。
 *
 * ブラウザの CSSOM を使わない（node のテスト・書き出しの点検からも使うため）。
 */
import { splitSelectorList, stripPageLevelPrefix } from '../widget-style-scope.ts'

/** 中に規則を持つ @規則（中の規則にも範囲を付ける） */
const NESTING_AT_RULES: ReadonlySet<string> = new Set(['media', 'supports', 'container', 'layer', 'document', '-moz-document'])

interface CssChunk {
  prelude: string
  /** `{ }` の中。`@import …;` のような文は null */
  body: string | null
}

/** 文字列（'…' / "…"）の終わりの次の位置 */
function skipString(css: string, start: number): number {
  const quote = css[start]
  let i = start + 1
  while (i < css.length && css[i] !== quote) i += css[i] === '\\' ? 2 : 1
  return i + 1
}

/** コメントを外す（文字列の中の `/*` はそのまま） */
function stripComments(css: string): string {
  let out = ''
  let i = 0
  while (i < css.length) {
    const c = css[i]
    if (c === '"' || c === "'") {
      const end = skipString(css, i)
      out += css.slice(i, end)
      i = end
    } else if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end === -1 ? css.length : end + 2
    } else {
      out += c
      i += 1
    }
  }
  return out
}

/** `{` の位置から、対になる `}` の位置（文字列の中の括弧は数えない） */
function matchingBrace(css: string, open: number): number {
  let depth = 0
  let i = open
  while (i < css.length) {
    const c = css[i]
    if (c === '"' || c === "'") {
      i = skipString(css, i)
      continue
    }
    if (c === '{') depth += 1
    else if (c === '}') {
      depth -= 1
      if (depth === 0) return i
    }
    i += 1
  }
  return css.length
}

/** CSS を上から順に規則へ分ける */
function chunksOf(css: string): CssChunk[] {
  const out: CssChunk[] = []
  let start = 0
  let i = 0
  let parens = 0
  while (i < css.length) {
    const c = css[i]
    if (c === '"' || c === "'") {
      i = skipString(css, i)
      continue
    }
    if (c === '(') parens += 1
    else if (c === ')') parens -= 1
    else if (c === ';' && parens <= 0) {
      const prelude = css.slice(start, i).trim()
      if (prelude !== '') out.push({ prelude, body: null })
      start = i + 1
    } else if (c === '{') {
      const close = matchingBrace(css, i)
      out.push({ prelude: css.slice(start, i).trim(), body: css.slice(i + 1, close) })
      i = close + 1
      start = i
      parens = 0
      continue
    } else if (c === '}') {
      // 対になる `{` の無い `}`（書き損じ）は読み飛ばす
      start = i + 1
    }
    i += 1
  }
  return out
}

/** 宣言の並びから CSS変数（--名前）だけ */
function customProperties(body: string): string[] {
  return body
    .split(';')
    .map((decl) => decl.trim())
    .filter((decl) => decl.startsWith('--') && decl.includes(':'))
}

function scopeRule(prelude: string, body: string, scope: string): string {
  const inside: string[] = []
  let hasPageLevel = false
  for (const raw of splitSelectorList(prelude)) {
    const selector = raw.trim()
    if (selector === '') continue
    const rest = stripPageLevelPrefix(selector)
    if (rest === '') hasPageLevel = true
    else inside.push(`${scope} ${rest}`)
  }
  let out = inside.length > 0 ? `${inside.join(',')}{${body}}` : ''
  if (hasPageLevel) {
    const variables = customProperties(body)
    if (variables.length > 0) out += `${scope}{${variables.join(';')}}`
  }
  return out
}

/** CSS の規則の頭に scope を付ける（その中だけに効く形にする） */
export function scopeCss(css: string, scope: string): string {
  let out = ''
  for (const { prelude, body } of chunksOf(stripComments(css))) {
    if (body === null) {
      out += `${prelude};`
      continue
    }
    if (prelude.startsWith('@')) {
      const name = /^@([-\w]+)/.exec(prelude)?.[1]?.toLowerCase() ?? ''
      out += NESTING_AT_RULES.has(name) ? `${prelude}{${scopeCss(body, scope)}}` : `${prelude}{${body}}`
      continue
    }
    out += scopeRule(prelude, body, scope)
  }
  return out
}

const STYLE_BLOCK = /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi

/** 見本のHTMLの <style> の中身だけに scope を付ける（本文・<script> は触らない） */
export function scopeSampleStyles(html: string, scope: string): string {
  return html.replace(STYLE_BLOCK, (_all, open: string, css: string, close: string) => `${open}${scopeCss(css, scope)}${close}`)
}
