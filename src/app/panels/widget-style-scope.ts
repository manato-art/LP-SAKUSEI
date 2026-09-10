/**
 * 画面の中に Widget／LP の HTML を置くとき、その <style> を「置いた場所の中だけ」に効かせる。
 *
 * Widget の CSS はふつう `.title{…}` のように範囲を持たない。アプリの画面にそのまま置くと:
 *   - 画面全体（ほかの Widget・編集画面のボタンや見出し）に効く
 *   - 一緒に入っている SquadBeyond のプレビュー用CSS（背景グレー・編集画面用の .ql-editor 等）まで効く
 *   - @media はブラウザの幅で判定されるので、PCで開くとスマホ用の値が PC 用の値に負ける
 * 実測（2026-09-11）: バージョン一覧のサムネイルと左の「設置済みWidget」が <style> をそのまま置いていて、
 * キャンバスと Widget編集のプレビューに PC 用の `min-width:1000px` が効き、SquadBeyond の編集画面用CSS
 * （.ql-editor の指定・ボタンや入力欄の normalize 等）も編集画面全体に効いていた。
 *
 * そこで表示用に CSS を作り直す（保存するCSSは書き換えない）:
 *   - SquadBeyond のプレビュー用CSSを除く
 *   - 普通の規則は scope の中だけを指すようにする（`body .x` の `body` は外す）
 *   - `:root` / `html` / `body` そのものへの指定は、CSS変数だけを scope に移す（背景・高さ等は移さない）
 *   - @media は LPの幅（620px）で判定し直す（本人指定）。width に null を渡すとブラウザに任せる
 */
import { stripSbPreviewCss, widgetResetCss } from '../../shared/sb-preview-css.ts'
import { LP_WIDTH, mediaAtLpWidth } from './lp-width-media.ts'

export interface ScopedCss {
  /** @import（シートの先頭にしか書けないので分けて返す） */
  readonly imports: string
  readonly rules: string
}

/** 規則の書き出しに使う部分（テストでは本物の CSSOM の代わりに渡せる） */
export interface StyleRuleLike {
  readonly selectorText: string
  readonly style: Pick<CSSStyleDeclaration, 'cssText' | 'length' | 'item' | 'getPropertyValue' | 'getPropertyPriority'>
}

const SCOPE_ATTR = 'data-sb-style-scope'
let scopeCount = 0

/** 括弧の外にあるカンマでセレクタを分ける（`:is(a, b)` の中では分けない） */
export function splitSelectorList(selectorText: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < selectorText.length; i++) {
    const c = selectorText[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) {
      parts.push(selectorText.slice(start, i))
      start = i + 1
    }
  }
  parts.push(selectorText.slice(start))
  return parts
}

/** `:root` / `html` / `body` から始まる部分を外す（`body .x` → `.x`、`body` だけなら空文字） */
export function stripPageLevelPrefix(selector: string): string {
  let rest = selector
  for (;;) {
    const m = /^(?::root|html|body)(?=$|[\s>+~])/i.exec(rest)
    if (m === null) return rest
    rest = rest.slice(m[0].length).replace(/^\s*[>+~]?\s*/, '')
  }
}

/**
 * 普通の規則を scope の中だけに効く形で書き出す。
 *   - Widget の中を指すもの（`.x` / `body .x` など）… scope を前置きする（ページ側の `body ` などは外す）
 *   - `:root` / `html` / `body` そのもの … ページ全体の指定（背景・高さ・余白 等）を scope に移すと
 *     Widget の枠が塗られてしまうので捨て、CSS変数（--名前）だけを scope に届ける
 */
export function scopeStyleRule(rule: StyleRuleLike, scope: string): string {
  const inside: string[] = []
  let hasPageLevel = false
  for (const raw of splitSelectorList(rule.selectorText)) {
    const rest = stripPageLevelPrefix(raw.trim())
    if (rest === '') hasPageLevel = true
    else inside.push(`${scope} ${rest}`)
  }
  let out = inside.length > 0 ? `${inside.join(',')}{${rule.style.cssText}}` : ''
  if (hasPageLevel) {
    const variables: string[] = []
    for (let i = 0; i < rule.style.length; i++) {
      const name = rule.style.item(i)
      if (!name.startsWith('--')) continue
      const priority = rule.style.getPropertyPriority(name)
      variables.push(`${name}:${rule.style.getPropertyValue(name)}${priority === '' ? '' : ` !${priority}`}`)
    }
    if (variables.length > 0) out += `${scope}{${variables.join(';')}}`
  }
  return out
}

/** CSSOM の規則を scope の中だけに効く文字にする（@import は先頭に集めるので呼び出し側で扱う） */
function serializeRules(rules: CSSRuleList, scope: string, width: number | null): string {
  let out = ''
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      out += scopeStyleRule(rule, scope)
    } else if (rule instanceof CSSMediaRule) {
      if (width === null) {
        out += `@media ${rule.media.mediaText}{${serializeRules(rule.cssRules, scope, width)}}`
        continue
      }
      // 幅の条件は LPの幅で決め、外れる中身は捨てる。決められない条件だけ @media に残す
      const verdict = mediaAtLpWidth(rule.media.mediaText, width)
      if (!verdict.applies) continue
      const inner = serializeRules(rule.cssRules, scope, width)
      out += verdict.rest === '' ? inner : `@media ${verdict.rest}{${inner}}`
    } else if (rule instanceof CSSSupportsRule || rule instanceof CSSContainerRule) {
      // @supports / @container: 条件はそのまま（@container は置いた場所の大きさで決まる）、中身だけ範囲をつける。
      // ライブラリにも @container を使う Widget がある（サイトフッター・ポイント説明）。
      const prelude = rule.cssText.slice(0, rule.cssText.indexOf('{')).trim()
      out += `${prelude}{${serializeRules(rule.cssRules, scope, width)}}`
    } else if (!(rule instanceof CSSImportRule)) {
      // @keyframes / @font-face など: 範囲をつけるものが無いのでそのまま
      out += rule.cssText
    }
  }
  return out
}

/** Widget の CSS を scope の中だけに効く形にする（SquadBeyond のプレビュー用CSSは除き、@media は width で判定） */
export function scopeWidgetCss(css: string, scope: string, width: number | null = LP_WIDTH): ScopedCss {
  const text = stripSbPreviewCss(css)
  if (text.trim() === '') return { imports: '', rules: '' }
  const probe = document.createElement('style')
  // 読み込むだけで画面には効かせない
  probe.media = 'not all'
  probe.textContent = text
  document.head.append(probe)
  try {
    const rules = probe.sheet?.cssRules
    if (rules === undefined) return { imports: '', rules: '' }
    const imports = Array.from(rules)
      .filter((rule) => rule instanceof CSSImportRule)
      .map((rule) => rule.cssText)
      .join('')
    return { imports, rules: serializeRules(rules, scope, width) }
  } finally {
    probe.remove()
  }
}

/** 入れ物に目印を付け、その中だけを指すセレクタを返す（目印は入れ物自身に付くので innerHTML には出ない） */
export function markStyleScope(container: HTMLElement): string {
  scopeCount += 1
  const id = String(scopeCount)
  container.setAttribute(SCOPE_ATTR, id)
  return `[${SCOPE_ATTR}="${id}"]`
}

/**
 * Widget編集のプレビュー用。scope を Widget の外枠とみなし、配信と同じ「Widget の見た目に要る土台」を付けて書き出す。
 * 土台は Widget 自身の指定より前に置く（同じ強さなら Widget 自身の指定が勝つ＝配信と同じ）。
 */
export function widgetPreviewCss(css: string, scope: string): string {
  const scoped = scopeWidgetCss(css, scope)
  return scoped.imports + widgetResetCss(scope) + scoped.rules
}

/**
 * 表示するだけの写し（サムネイル・縮小プレビュー）の <style> を、その入れ物の中だけに効く形へ書き換える。
 * `root` は入れ物が何の写しか: 'widget' = Widget 1つ分の中身 / 'lp' = LP の本文（Widget を含むことがある）。
 * Widget があれば配信と同じ土台も、最初の <style> の頭（Widget 自身の指定より前）に置く。
 * 要素は足さない（足すと :first-child や何番目かの指定がずれる）。
 */
export function containWidgetStyles(
  container: HTMLElement,
  root: 'widget' | 'lp',
  width: number | null = LP_WIDTH,
): void {
  const styles = Array.from(container.querySelectorAll('style'))
  if (styles.length === 0) return
  const scope = markStyleScope(container)
  const hasWidget = root === 'widget' || container.querySelector('.sb-widget-block') !== null
  const reset = hasWidget ? widgetResetCss(root === 'widget' ? scope : `${scope} .sb-widget-block`) : ''
  for (const [i, style] of styles.entries()) {
    const scoped = scopeWidgetCss(style.textContent ?? '', scope, width)
    style.textContent = scoped.imports + (i === 0 ? reset : '') + scoped.rules
  }
}
