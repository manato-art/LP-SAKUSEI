/**
 * Widget の CSS に書かれた「色」を、宣言1つずつ拾い出して差し替える（指示182の続き）。
 *
 * Widget の色は文字に付いているとは限らない。矢印や帯のような飾りは
 * `::before` / `::after` や `background` で塗られていて、ツールバーの「文字色」では
 * 変えられない（実際「色変わらない」と言われた）。そこで CSS に書かれた色を直接いじれるようにする。
 *
 * 画面は離脱防止ポップアップと同じ「要素ごとのカード」にする（本人指定）。
 * どの色がどの要素のものかは DOM で判定するしかないので、ここでは
 * 「この色の宣言はどのセレクタに書いてあるか」までを返し、要素との突き合わせは呼び出し側が行う。
 *
 * 拾う色は2通り。採取した Widget ライブラリ27件を数えて決めた:
 *   - 規則に色が直接書いてあるもの（`background: #ff0000`）… ライブラリの25件
 *   - CSS変数に色が入っているもの（`--arrow-color: #d096bb;`）… ライブラリは0件、本人の自作Widgetが使用。
 *     行末のコメント（例: `色`）があれば、それをそのまま名前にする
 *
 * DOM に触らない純粋関数だけを置く（テストは node 環境で回す）。
 */

/** 色の宣言が当たるセレクタ1つ（カンマで区切られた1つずつ） */
export interface ColorTarget {
  /** 擬似要素・状態を外したセレクタ（`querySelectorAll` にそのまま渡せる形） */
  readonly selector: string
  /** 状態の注記（「ホバー時」「後ろの飾り」など）。いつもの見た目なら空文字 */
  readonly state: string
}

export interface ColorDecl {
  /**
   * 規則の通し番号・宣言の通し番号・その中で何個目の色か。
   * 色の値を差し替えても変わらないので、何度差し替えてもこれで同じ宣言を指せる。
   */
  readonly key: string
  readonly targets: readonly ColorTarget[]
  readonly property: string
  /** カードの行に出す名前（文字色 / 背景色 / 枠線の色 … 変数ならコメントか変数名） */
  readonly label: string
  /** CSS に書かれている値そのまま */
  readonly value: string
  readonly isVariable: boolean
  /** `:root` などに書かれた変数（どの要素のカードにも属さず、Widget全体に効く） */
  readonly isGlobal: boolean
}

interface Located extends ColorDecl {
  readonly start: number
  readonly end: number
}

/** 16進の桁数として色になるもの（#abc / #abcd / #aabbcc / #aabbccdd） */
const HEX_LENGTHS: ReadonlySet<number> = new Set([3, 4, 6, 8])
const COLOR_TOKEN = /#[0-9a-fA-F]+\b|\b(?:rgba?|hsla?)\([^()]*\)/g

/** ここに書かれた変数は、どの要素にも当たらなくても `var()` 経由で Widget に届く */
const GLOBAL_SCOPE: ReadonlySet<string> = new Set([':root', 'html', 'body', '*'])

/**
 * 突き合わせの前に外す擬似要素・状態と、その注記。
 * `::before` は要素そのものではないので querySelectorAll に渡せない。
 * `:hover` などは「その状態のときの色」も同じ要素のカードに出したいので、外して当てる。
 * `focus-visible` / `focus-within` は `focus` より先に並べる（途中で切れないように）。
 */
const PSEUDO = /::?(before|after|placeholder|marker|selection|first-line|first-letter)\b|:(hover|focus-visible|focus-within|focus|active|visited|checked|disabled)\b/g
const STATE_LABELS: Readonly<Record<string, string>> = {
  before: '前の飾り',
  after: '後ろの飾り',
  placeholder: '入力欄の薄い文字',
  marker: '箇条書きの印',
  selection: '選択した範囲',
  'first-line': '1行目',
  'first-letter': '1文字目',
  hover: 'ホバー時',
  focus: 'フォーカス時',
  'focus-visible': 'フォーカス時',
  'focus-within': 'フォーカス時',
  active: '押している間',
  visited: '訪問済み',
  checked: 'チェック時',
  disabled: '無効時',
}

const PROPERTY_LABELS: readonly (readonly [RegExp, string])[] = [
  [/^color$/, '文字色'],
  [/^background/, '背景色'],
  [/^(?:border|outline)/, '枠線の色'],
  [/^fill$/, '塗りの色'],
  [/^stroke$/, '線の色'],
  [/shadow$/, '影の色'],
]

/** 名前に使うコメントの長さの上限（長い説明文は名前にしない） */
const MAX_LABEL_LENGTH = 24

interface Rule {
  readonly selector: string
  readonly bodyStart: number
  readonly bodyEnd: number
}

/**
 * コメント・文字列・`url(...)` の中身を同じ長さの空白に置き換える。
 * 以後の走査（括弧・セミコロン・色の検出）はこの文字列で行うので、
 * コメント内の `{` やデータURIの `#` に惑わされない。位置は元の CSS と一致したまま。
 */
function maskCss(css: string): string {
  const blank = (s: string): string => s.replace(/[^\n]/g, ' ')
  return css
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, blank)
    .replace(/url\([^)]*\)/gi, blank)
}

function matchingBrace(masked: string, open: number, to: number): number {
  let depth = 0
  for (let i = open; i < to; i++) {
    const c = masked[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** 規則を出てきた順に集める。`@media` などの中は潜り、`@keyframes` `@font-face` は飛ばす。 */
function collectRules(masked: string, from: number, to: number, out: Rule[]): void {
  let i = from
  while (i < to) {
    let stop = -1
    for (let j = i; j < to; j++) {
      const c = masked[j]
      if (c === '{' || c === ';' || c === '}') {
        stop = j
        break
      }
    }
    if (stop === -1) return
    if (masked[stop] !== '{') {
      // `@import …;` や、閉じ過ぎた `}` は読み飛ばす
      i = stop + 1
      continue
    }
    const close = matchingBrace(masked, stop, to)
    if (close === -1) return
    const prelude = masked.slice(i, stop).trim()
    if (prelude.startsWith('@')) {
      if (/^@(?:media|supports|container|layer)\b/i.test(prelude)) {
        collectRules(masked, stop + 1, close, out)
      }
    } else if (prelude !== '') {
      out.push({ selector: prelude, bodyStart: stop + 1, bodyEnd: close })
    }
    i = close + 1
  }
}

/** 括弧の外にある区切り文字で分ける（`:is(a, b)` の中では分けない） */
function splitTopLevel(text: string, separator: string): { start: number; end: number }[] {
  const parts: { start: number; end: number }[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === separator && depth === 0) {
      parts.push({ start, end: i })
      start = i + 1
    }
  }
  parts.push({ start, end: text.length })
  return parts
}

function toTarget(part: string): ColorTarget {
  const states = [...part.matchAll(PSEUDO)]
    .map((m) => STATE_LABELS[m[1] ?? m[2] ?? ''] ?? '')
    .filter((s) => s !== '')
  return {
    selector: part.replace(PSEUDO, '').trim(),
    state: [...new Set(states)].join('・'),
  }
}

function propertyLabel(property: string): string {
  for (const [pattern, label] of PROPERTY_LABELS) {
    if (pattern.test(property)) return label
  }
  return property
}

/** CSS変数の名前。宣言の中か直後（同じ行）のコメントがあればそれを使う。 */
function variableLabel(css: string, property: string, valueStart: number, valueEnd: number): string {
  const inside = /\/\*([\s\S]*?)\*\//.exec(css.slice(valueStart, valueEnd))
  const after = /^[ \t]*;?[ \t]*\/\*([\s\S]*?)\*\//.exec(css.slice(valueEnd))
  const comment = (inside?.[1] ?? after?.[1] ?? '').trim()
  if (comment !== '' && comment.length <= MAX_LABEL_LENGTH) return comment
  return property.replace(/^--/, '')
}

function isValidColorToken(token: string): boolean {
  return !token.startsWith('#') || HEX_LENGTHS.has(token.length - 1)
}

function locateColorDecls(css: string): Located[] {
  const masked = maskCss(css)
  const rules: Rule[] = []
  collectRules(masked, 0, masked.length, rules)

  const out: Located[] = []
  rules.forEach((rule, ruleIndex) => {
    const parts = splitTopLevel(rule.selector, ',')
      .map((p) => toTarget(rule.selector.slice(p.start, p.end)))
      .filter((t) => t.selector !== '')
    const body = masked.slice(rule.bodyStart, rule.bodyEnd)

    splitTopLevel(body, ';').forEach((decl, declIndex) => {
      const colon = body.indexOf(':', decl.start)
      if (colon === -1 || colon >= decl.end) return
      const property = body.slice(decl.start, colon).trim().toLowerCase()
      if (property === '' || /[{}]/.test(property)) return
      const isVariable = property.startsWith('--')
      // 宣言だけあって使われていない変数は、変えても何も起きないので出さない
      if (isVariable && !new RegExp(`var\\(\\s*${property}(?![\\w-])`).test(masked)) return

      // 地の色（body 等）に直接書かれた色は Widget の見た目ではないので出さない。変数は届くので残す
      const targets = isVariable ? parts : parts.filter((t) => !GLOBAL_SCOPE.has(t.selector))
      if (targets.length === 0) return
      const isGlobal = targets.every((t) => GLOBAL_SCOPE.has(t.selector))

      const valueStart = rule.bodyStart + colon + 1
      const valueEnd = rule.bodyStart + decl.end
      const label = isVariable
        ? variableLabel(css, property, valueStart, valueEnd)
        : propertyLabel(property)
      let tokenIndex = 0
      for (const m of masked.slice(valueStart, valueEnd).matchAll(COLOR_TOKEN)) {
        if (!isValidColorToken(m[0])) continue
        const start = valueStart + (m.index ?? 0)
        const end = start + m[0].length
        out.push({
          key: `${ruleIndex}:${declIndex}:${tokenIndex}`,
          targets,
          property,
          label,
          value: css.slice(start, end),
          isVariable,
          isGlobal,
          start,
          end,
        })
        tokenIndex++
      }
    })
  })
  return out
}

/** Widget の CSS に書かれた色の宣言を、出てきた順に全部返す。 */
export function scanColorDecls(css: string): ColorDecl[] {
  return locateColorDecls(css).map(({ start: _start, end: _end, ...decl }) => decl)
}

/**
 * `key` の色だけを差し替える。ほかの文字（同じ色の別の宣言・コメント・字下げ）には触らない。
 * 位置は毎回 CSS から探し直すので、何度続けて差し替えてもずれない。見つからなければそのまま返す。
 */
export function replaceColor(css: string, key: string, next: string): string {
  const found = locateColorDecls(css).find((d) => d.key === key)
  if (found === undefined) return css
  return css.slice(0, found.start) + next + css.slice(found.end)
}

/** 見本の四角とピッカーの初期値に使う `#rrggbb`。変換できない書き方なら null。 */
export function colorToHex(value: string): string | null {
  const v = value.trim().toLowerCase()
  if (v.startsWith('#')) {
    const hex = v.slice(1)
    if (hex.length === 3 || hex.length === 4) return `#${[...hex.slice(0, 3)].map((c) => c + c).join('')}`
    return hex.length === 6 || hex.length === 8 ? `#${hex.slice(0, 6)}` : null
  }
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(v)
  if (rgb === null) return null
  const channels = [rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n ?? 0)))
  return `#${channels.map((n) => n.toString(16).padStart(2, '0')).join('')}`
}
