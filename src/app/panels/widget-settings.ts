/**
 * Widget の CSS に書かれた「設定」（色・大きさ・余白・動きの速さ …）を、
 * 宣言ごとに拾い出して差し替える。Widget編集「要素ごとに編集」カードの中身。
 *
 * 経緯: 最初は色だけを拾っていたが、本人から「色・大きさ・他の要素もある。全部確認して」。
 * 採取した Widget ライブラリ25件を数えた（2026-09-10・各Widget自身のCSSだけ）:
 *   大きさ  width 206 / font-size 166 / height 82 / padding 78 / border-radius 68 / margin 67 …
 *   動き    transition 25 / animation 13 / animation-delay 6
 *   色      color 92 / background 90 / border 24 …
 *   CSS変数 ライブラリは1件だけ。本人の自作Widgetは変数で6つ持つ（色・幅・高さ・間隔・速さ・浮き上がる量）
 * これらをカードの行にする。
 *
 * 行の種類:
 *   color  … 色（見本の四角＋パレット）
 *   number … 数値1つ＋単位（px / em / % / s …）。余白の「上下・左右」のような並びは位置で名前を付ける
 *   text   … 値をそのまま書き換える（transform や calc() のように、数字が組み合わさっているもの）
 *
 * Widget の CSS には実SBのプレビュー用CSS（normalize・CodeMirror 等）が同梱されがちだが、
 * どの要素のカードに出すかは呼び出し側が DOM の当たり判定で決める（ここは純粋関数だけ）。
 */

export type SettingGroup = 'color' | 'size' | 'motion' | 'other'
export type SettingKind = 'color' | 'number' | 'text'

/** 設定が当たるセレクタ1つ（カンマで区切られた1つずつ） */
export interface SettingTarget {
  /** 擬似要素・状態を外したセレクタ（`querySelectorAll` にそのまま渡せる形） */
  readonly selector: string
  /** 状態の注記（「ホバー時」「後ろの飾り」など）。いつもの見た目なら空文字 */
  readonly state: string
}

export interface Setting {
  /**
   * 規則の通し番号・宣言の通し番号・宣言の中のどれか（c=色 n=数値 v=値まるごと）。
   * 値を差し替えても変わらないので、何度差し替えてもこれで同じ場所を指せる。
   */
  readonly key: string
  readonly targets: readonly SettingTarget[]
  readonly property: string
  /** 行に出す名前（変数なら行末のコメントか変数名） */
  readonly label: string
  readonly group: SettingGroup
  readonly kind: SettingKind
  /** 今の値。number は数字の部分だけ（書いてあるとおり。例 `.5`） */
  readonly value: string
  /** number の単位（無単位なら空文字） */
  readonly unit: string
  readonly isVariable: boolean
  /** `:root` などに書かれた変数（どの要素のカードにも属さず、Widget全体に効く） */
  readonly isGlobal: boolean
  /**
   * 効く条件（「画面幅768px以上」「動きを減らす設定のとき」など）。いつも効くなら空文字。
   * スマホとPCで値を分けている Widget では同じ名前の行が2つ出るので、これで見分ける。
   */
  readonly context: string
  /**
   * `@media` の条件そのもの（`matchMedia` にそのまま渡せる形。入れ子なら全部）。
   * 編集画面のプレビューはブラウザの画面幅で判定されるので、いまその行が効いているかを見分けるのに使う。
   */
  readonly media: readonly string[]
}

interface Located extends Setting {
  readonly start: number
  readonly end: number
}

const HEX_LENGTHS: ReadonlySet<number> = new Set([3, 4, 6, 8])
const COLOR_TOKEN = /#[0-9a-fA-F]+\b|\b(?:rgba?|hsla?)\([^()]*\)/g
const COLOR_VALUE = /^(?:#[0-9a-fA-F]+|(?:rgba?|hsla?)\([^()]*\))$/
const NUMBER_PART = /^(-?(?:\d+\.?\d*|\.\d+))(px|em|rem|%|vw|vh|vmin|vmax|ch|s|ms|deg)?$/
const TIME_UNITS: ReadonlySet<string> = new Set(['s', 'ms'])
const IMPORTANT = /\s*!\s*important\s*$/i

/** ここに書かれた変数は、どの要素にも当たらなくても `var()` 経由で Widget に届く */
const GLOBAL_SCOPE: ReadonlySet<string> = new Set([':root', 'html', 'body', '*'])

/**
 * 突き合わせの前に外す擬似要素・状態と、その注記。
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

const COLOR_LABELS: readonly (readonly [RegExp, string])[] = [
  [/^color$/, '文字色'],
  [/^background/, '背景色'],
  [/^(?:border|outline)/, '枠線の色'],
  [/^fill$/, '塗りの色'],
  [/^stroke$/, '線の色'],
  [/shadow$/, '影の色'],
]

/** 数値が1つだけ入る大きさ系（ライブラリで多い順におおむね並べた） */
const SIZE_LABELS: Readonly<Record<string, string>> = {
  width: '幅',
  height: '高さ',
  'font-size': '文字の大きさ',
  'max-width': '最大の幅',
  'min-width': '最小の幅',
  'max-height': '最大の高さ',
  'min-height': '最小の高さ',
  'letter-spacing': '文字の間隔',
  'line-height': '行の高さ',
  'font-weight': '文字の太さ',
  top: '上からの位置',
  right: '右からの位置',
  bottom: '下からの位置',
  left: '左からの位置',
  border: '枠線の太さ',
  'border-top': '上の枠線の太さ',
  'border-right': '右の枠線の太さ',
  'border-bottom': '下の枠線の太さ',
  'border-left': '左の枠線の太さ',
  outline: '外枠の太さ',
  'outline-width': '外枠の太さ',
  'padding-top': '内側の余白・上',
  'padding-right': '内側の余白・右',
  'padding-bottom': '内側の余白・下',
  'padding-left': '内側の余白・左',
  'margin-top': '外側の余白・上',
  'margin-right': '外側の余白・右',
  'margin-bottom': '外側の余白・下',
  'margin-left': '外側の余白・左',
  'row-gap': '行の間隔',
  'column-gap': '列の間隔',
  'text-indent': '字下げ',
  opacity: '不透明度',
}

/** 数値の並び（1〜4個）の位置で名前が決まるもの */
const POSITIONAL: Readonly<Record<string, { label: string; names: Readonly<Record<number, readonly string[]>> }>> = {
  padding: { label: '内側の余白', names: { 2: ['上下', '左右'], 3: ['上', '左右', '下'], 4: ['上', '右', '下', '左'] } },
  margin: { label: '外側の余白', names: { 2: ['上下', '左右'], 3: ['上', '左右', '下'], 4: ['上', '右', '下', '左'] } },
  'border-width': { label: '枠線の太さ', names: { 2: ['上下', '左右'], 3: ['上', '左右', '下'], 4: ['上', '右', '下', '左'] } },
  inset: { label: '位置', names: { 2: ['上下', '左右'], 3: ['上', '左右', '下'], 4: ['上', '右', '下', '左'] } },
  'border-radius': {
    label: '角の丸み',
    names: { 2: ['左上と右下', '右上と左下'], 3: ['左上', '右上と左下', '右下'], 4: ['左上', '右上', '右下', '左下'] },
  },
  gap: { label: '間隔', names: { 2: ['行', '列'] } },
}

/** 時間（1つ目・2つ目）の名前 */
const TIME_LABELS: Readonly<Record<string, { first: string; second: string }>> = {
  transition: { first: '変化にかける時間', second: '変化が始まるまでの待ち' },
  'transition-duration': { first: '変化にかける時間', second: '変化にかける時間' },
  'transition-delay': { first: '変化が始まるまでの待ち', second: '変化が始まるまでの待ち' },
  animation: { first: '動き1回の時間', second: '動きが始まるまでの待ち' },
  'animation-duration': { first: '動き1回の時間', second: '動き1回の時間' },
  'animation-delay': { first: '動きが始まるまでの待ち', second: '動きが始まるまでの待ち' },
}

/** 数字が組み合わさっていて、値まるごと書き換えるもの */
const TEXT_LABELS: Readonly<Record<string, { label: string; group: SettingGroup }>> = {
  transform: { label: '変形（位置・回転・拡大）', group: 'other' },
  'transform-origin': { label: '変形の基準点', group: 'other' },
  'box-shadow': { label: '影', group: 'other' },
  'text-shadow': { label: '文字の影', group: 'other' },
  filter: { label: 'フィルター', group: 'other' },
  'background-size': { label: '背景画像の大きさ', group: 'size' },
  'background-position': { label: '背景画像の位置', group: 'size' },
  'aspect-ratio': { label: '縦横比', group: 'size' },
  'grid-template-columns': { label: '列の幅', group: 'size' },
  flex: { label: '伸び縮み', group: 'size' },
  'flex-basis': { label: '伸び縮みの基準の幅', group: 'size' },
}

/** 単位が無いのが正しい数値（ここ以外の大きさで無単位の 0 を変えるときは px を付ける） */
const UNITLESS_PROPERTIES: ReadonlySet<string> = new Set(['line-height', 'font-weight', 'opacity'])

/** 名前に使うコメントの長さの上限（長い説明文は名前にしない） */
const MAX_LABEL_LENGTH = 24

interface Rule {
  readonly selector: string
  readonly bodyStart: number
  readonly bodyEnd: number
  /** `@media` などの条件（入れ子なら「・」でつなぐ） */
  readonly context: string
  readonly media: readonly string[]
}

interface DeclContext {
  readonly css: string
  readonly masked: string
  readonly ruleIndex: number
  readonly declIndex: number
  readonly property: string
  /** 値の範囲（前後の空白を含む。rawEnd は `;` か `}` の位置） */
  readonly rawStart: number
  readonly rawEnd: number
  readonly targets: readonly SettingTarget[]
  readonly isGlobal: boolean
  readonly context: string
  readonly media: readonly string[]
}

interface Part {
  readonly start: number
  readonly end: number
  readonly text: string
  /** カンマで区切られた何番目のまとまりか（transition を複数書いたとき） */
  readonly group: number
}

/**
 * コメント・文字列・`url(...)` の中身を同じ長さの空白に置き換える。
 * 以後の走査はこの文字列で行うので、コメント内の `{` やデータURIの `#` に惑わされない。
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

/**
 * `@media` などの条件を、見て分かる言葉にする。
 * 画面幅・動きを減らす設定・画面の向きは言い換え、それ以外は条件の文字をそのまま出す。
 */
function conditionLabel(prelude: string): string {
  const text = prelude.replace(/\s+/g, ' ').trim()
  if (/^@layer\b/i.test(text)) return ''
  const parts: string[] = []
  for (const m of text.matchAll(/\(\s*(min|max)-width\s*:\s*([\d.]+)(px|em|rem)\s*\)/gi)) {
    parts.push(`画面幅${m[2] ?? ''}${m[3] ?? ''}${(m[1] ?? '').toLowerCase() === 'min' ? '以上' : '以下'}`)
  }
  if (/prefers-reduced-motion\s*:\s*reduce/i.test(text)) parts.push('動きを減らす設定のとき')
  if (/orientation\s*:\s*landscape/i.test(text)) parts.push('横向きのとき')
  if (/orientation\s*:\s*portrait/i.test(text)) parts.push('縦向きのとき')
  if (parts.length > 0) return parts.join('・')
  return text.replace(/^@(?:media|supports|container)\s*/i, '')
}

/** 規則を出てきた順に集める。`@media` などの中は潜り（条件を控える）、`@keyframes` `@font-face` は飛ばす。 */
function collectRules(
  masked: string,
  from: number,
  to: number,
  out: Rule[],
  context = '',
  media: readonly string[] = [],
): void {
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
      i = stop + 1
      continue
    }
    const close = matchingBrace(masked, stop, to)
    if (close === -1) return
    const prelude = masked.slice(i, stop).trim()
    if (prelude.startsWith('@')) {
      if (/^@(?:media|supports|container|layer)\b/i.test(prelude)) {
        const inner = [context, conditionLabel(prelude)].filter((c) => c !== '').join('・')
        const query = /^@media\b/i.test(prelude) ? prelude.replace(/^@media\s*/i, '').replace(/\s+/g, ' ') : ''
        collectRules(masked, stop + 1, close, out, inner, query === '' ? media : [...media, query])
      }
    } else if (prelude !== '') {
      out.push({ selector: prelude, bodyStart: stop + 1, bodyEnd: close, context, media })
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

/** 値を、括弧の外の空白とカンマで区切る（`translate(0, -8px)` の中では区切らない） */
function valueParts(masked: string, start: number, end: number): Part[] {
  const parts: Part[] = []
  let depth = 0
  let group = 0
  let partStart = -1
  const flush = (at: number): void => {
    if (partStart === -1) return
    parts.push({ start: partStart, end: at, text: masked.slice(partStart, at), group })
    partStart = -1
  }
  for (let i = start; i < end; i++) {
    const c = masked[i] ?? ''
    if (c === '(') depth++
    else if (c === ')') depth--
    if (depth === 0 && (c === ',' || /\s/.test(c))) {
      flush(i)
      if (c === ',') group++
      continue
    }
    if (partStart === -1) partStart = i
  }
  flush(end)
  return parts
}

/** 前後の空白と末尾の `!important` を外した値の範囲 */
function trimmedRange(masked: string, start: number, end: number): { start: number; end: number } {
  let s = start
  let e = end
  while (s < e && /\s/.test(masked[s] ?? '')) s++
  while (e > s && /\s/.test(masked[e - 1] ?? '')) e--
  const important = IMPORTANT.exec(masked.slice(s, e))
  if (important !== null) e = s + important.index
  while (e > s && /\s/.test(masked[e - 1] ?? '')) e--
  return { start: s, end: e }
}

function toTarget(part: string): SettingTarget {
  const states = [...part.matchAll(PSEUDO)]
    .map((m) => STATE_LABELS[m[1] ?? m[2] ?? ''] ?? '')
    .filter((s) => s !== '')
  return { selector: part.replace(PSEUDO, '').trim(), state: [...new Set(states)].join('・') }
}

function colorLabel(property: string): string {
  for (const [pattern, label] of COLOR_LABELS) {
    if (pattern.test(property)) return label
  }
  return property
}

/** CSS変数の名前。宣言の中か直後（同じ行）のコメントがあればそれを使う。 */
function variableLabel(css: string, property: string, start: number, end: number): string {
  const inside = /\/\*([\s\S]*?)\*\//.exec(css.slice(start, end))
  const after = /^[ \t]*;?[ \t]*\/\*([\s\S]*?)\*\//.exec(css.slice(end))
  const comment = (inside?.[1] ?? after?.[1] ?? '').trim()
  if (comment !== '' && comment.length <= MAX_LABEL_LENGTH) return comment
  return property.replace(/^--/, '')
}

function isValidColor(token: string): boolean {
  return !token.startsWith('#') || HEX_LENGTHS.has(token.length - 1)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 規則の宣言を1つずつ渡す（地の色など、body 等に直接書かれた変数以外の宣言は渡さない） */
function forEachDeclaration(css: string, visit: (ctx: DeclContext) => void): void {
  const masked = maskCss(css)
  const rules: Rule[] = []
  collectRules(masked, 0, masked.length, rules)
  rules.forEach((rule, ruleIndex) => {
    const allTargets = splitTopLevel(rule.selector, ',')
      .map((p) => toTarget(rule.selector.slice(p.start, p.end)))
      .filter((t) => t.selector !== '')
    const body = masked.slice(rule.bodyStart, rule.bodyEnd)
    splitTopLevel(body, ';').forEach((decl, declIndex) => {
      const colon = body.indexOf(':', decl.start)
      if (colon === -1 || colon >= decl.end) return
      const property = body.slice(decl.start, colon).trim().toLowerCase()
      if (property === '' || /[{}]/.test(property)) return
      const isVariable = property.startsWith('--')
      // 変数でない設定は、クラス・id・属性で書かれた規則のものだけにする。
      // `h1{…}` `img{…}` `body a{…}` のような要素名だけの規則は、Widget の CSS に同梱された
      // 実SBのプレビュー用CSS（normalize 等）で、Widget の要素にも当たってしまう
      // （全件確認で、1つのWidgetに777行出た原因）。Widget 自身のCSSでこの形は 1987件中11件だけ。
      // 変数は `:root` などに書かれていても `var()` で届くので、そのまま残す。
      const targets = isVariable ? allTargets : allTargets.filter((t) => /[.#[]/.test(t.selector))
      if (targets.length === 0) return
      visit({
        css,
        masked,
        ruleIndex,
        declIndex,
        property,
        rawStart: rule.bodyStart + colon + 1,
        rawEnd: rule.bodyStart + decl.end,
        targets,
        isGlobal: targets.every((t) => GLOBAL_SCOPE.has(t.selector)),
        context: rule.context,
        media: rule.media,
      })
    })
  })
}

function declarationSettings(ctx: DeclContext): Located[] {
  const { css, masked, property } = ctx
  const range = trimmedRange(masked, ctx.rawStart, ctx.rawEnd)
  const text = masked.slice(range.start, range.end)
  if (text === '') return []
  const key = (suffix: string): string => `${ctx.ruleIndex}:${ctx.declIndex}:${suffix}`
  const common = {
    targets: ctx.targets,
    property,
    isGlobal: ctx.isGlobal,
    context: ctx.context,
    media: ctx.media,
  }
  const whole = (label: string, group: SettingGroup): Located => ({
    ...common,
    key: key('v'),
    label,
    group,
    kind: 'text',
    value: css.slice(range.start, range.end),
    unit: '',
    isVariable: property.startsWith('--'),
    start: range.start,
    end: range.end,
  })

  // ── CSS変数: 値まるごと1行（色／数値／そのほか） ──
  if (property.startsWith('--')) {
    const label = variableLabel(css, property, ctx.rawStart, ctx.rawEnd)
    if (COLOR_VALUE.test(text) && isValidColor(text)) {
      return [{ ...whole(label, 'color'), kind: 'color' }]
    }
    const num = NUMBER_PART.exec(text)
    if (num !== null) {
      const unit = num[2] ?? ''
      const group: SettingGroup = TIME_UNITS.has(unit) ? 'motion' : unit === 'deg' ? 'other' : 'size'
      return [{ ...whole(label, group), kind: 'number', value: num[1] ?? '', unit }]
    }
    return [whole(label, 'other')]
  }

  const out: Located[] = []

  // ── 色（見本の四角）。数字を変数で持つ宣言でも、直接書かれた色はここで変えられる ──
  let colorIndex = 0
  for (const m of text.matchAll(COLOR_TOKEN)) {
    if (!isValidColor(m[0])) continue
    const start = range.start + (m.index ?? 0)
    const end = start + m[0].length
    out.push({
      ...common,
      key: key(`c${colorIndex}`),
      label: colorLabel(property),
      group: 'color',
      kind: 'color',
      value: css.slice(start, end),
      unit: '',
      isVariable: false,
      start,
      end,
    })
    colorIndex++
  }

  // 数字を変数で持つ宣言は、変数の行で変える（ここでも出すと同じものが2か所に出る）
  if (text.includes('var(')) return out

  const parts = valueParts(masked, range.start, range.end)
  const hasFunction = parts.some((p) => p.text.includes('(') && /\d/.test(p.text))
  let numberIndex = 0
  const pushNumber = (part: Part, label: string, group: SettingGroup): void => {
    const m = NUMBER_PART.exec(part.text)
    if (m === null) return
    out.push({
      ...common,
      key: key(`n${numberIndex}`),
      label,
      group,
      kind: 'number',
      value: m[1] ?? '',
      unit: m[2] ?? '',
      isVariable: false,
      start: part.start,
      end: part.end,
    })
    numberIndex++
  }

  const positional = POSITIONAL[property]
  if (positional !== undefined) {
    if (hasFunction || parts.length > 4 || parts.some((p) => p.text.includes('/'))) {
      out.push(whole(positional.label, 'size'))
      return out
    }
    const names = positional.names[parts.length] ?? []
    parts.forEach((part, i) => {
      const suffix = names[i]
      pushNumber(part, suffix === undefined ? positional.label : `${positional.label}・${suffix}`, 'size')
    })
    return out
  }

  const time = TIME_LABELS[property]
  if (time !== undefined) {
    const groupCount = new Set(parts.map((p) => p.group)).size
    const seen = new Map<number, number>()
    for (const part of parts) {
      const m = NUMBER_PART.exec(part.text)
      if (m === null || !TIME_UNITS.has(m[2] ?? '')) continue
      const order = seen.get(part.group) ?? 0
      seen.set(part.group, order + 1)
      const name = order === 0 ? time.first : time.second
      pushNumber(part, groupCount > 1 ? `${name}（${part.group + 1}つ目）` : name, 'motion')
    }
    return out
  }

  const size = SIZE_LABELS[property]
  if (size !== undefined) {
    const numeric = parts.filter((p) => NUMBER_PART.test(p.text))
    const group: SettingGroup = property === 'opacity' ? 'other' : 'size'
    if (hasFunction || numeric.length > 1) {
      out.push(whole(size, group))
      return out
    }
    const only = numeric[0]
    if (only !== undefined) pushNumber(only, size, group)
    return out
  }

  const other = TEXT_LABELS[property]
  if (other !== undefined && /\d/.test(text)) out.push(whole(other.label, other.group))
  return out
}

function locateSettings(css: string): Located[] {
  const out: Located[] = []
  forEachDeclaration(css, (ctx) => {
    // 宣言だけあって使われていない変数は、変えても何も起きないので出さない
    if (ctx.property.startsWith('--')) {
      const used = new RegExp(`var\\(\\s*${escapeRegExp(ctx.property)}(?![\\w-])`).test(ctx.masked)
      if (!used) return
    }
    out.push(...declarationSettings(ctx))
  })
  return out
}

/** Widget の CSS に書かれた設定を、出てきた順に全部返す。 */
export function scanSettings(css: string): Setting[] {
  return locateSettings(css).map(({ start: _start, end: _end, ...setting }) => setting)
}

/**
 * `key` の場所だけを `next` に差し替える。ほかの文字（同じ値の別の宣言・コメント・字下げ・!important）には触らない。
 * 位置は毎回 CSS から探し直すので、何度続けて差し替えてもずれない。見つからなければそのまま返す。
 * 値まるごとの行（`…:v`）は、いったん空にされても同じ宣言を指し続ける（打ち直しの途中で迷子にしない）。
 */
export function replaceSetting(css: string, key: string, next: string): string {
  const found = locateSettings(css).find((s) => s.key === key)
  if (found !== undefined) return css.slice(0, found.start) + next + css.slice(found.end)
  if (!key.endsWith(':v')) return css
  let range: { start: number; end: number } | null = null
  forEachDeclaration(css, (ctx) => {
    if (range === null && `${ctx.ruleIndex}:${ctx.declIndex}:v` === key) {
      range = trimmedRange(ctx.masked, ctx.rawStart, ctx.rawEnd)
    }
  })
  const at = range as { start: number; end: number } | null
  return at === null ? css : css.slice(0, at.start) + next + css.slice(at.end)
}

/** 数値の入力欄の刻み */
export function numberStep(setting: Pick<Setting, 'unit' | 'property'>): number {
  if (setting.property === 'font-weight') return 100
  if (setting.unit === 'ms') return 50
  if (['px', '%', 'deg', 'vw', 'vh', 'vmin', 'vmax', 'ch'].includes(setting.unit)) return 1
  return 0.1 // s / em / rem / 無単位（行の高さ・不透明度）
}

/**
 * 数値の行から CSS に書く文字列を作る。
 * 大きさで単位の無い 0（`margin: 0 auto` の 0 など）を 0 以外にするときは px を付ける
 * （`margin: 12 auto` は CSS として無効で、見た目が変わらないため）。
 */
export function numberToken(
  setting: Pick<Setting, 'unit' | 'property' | 'group' | 'isVariable'>,
  n: number,
): { token: string; unit: string } {
  const text = String(Number(n.toFixed(4)))
  const needsPx =
    setting.unit === '' &&
    n !== 0 &&
    setting.group === 'size' &&
    !setting.isVariable &&
    !UNITLESS_PROPERTIES.has(setting.property)
  const unit = needsPx ? 'px' : setting.unit
  return { token: `${text}${unit}`, unit }
}

/** 自由入力の値から、宣言を壊す文字（; { }）を取り除く */
export function sanitizeValue(text: string): string {
  return text.replace(/[;{}]/g, '')
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
