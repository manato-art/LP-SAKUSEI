/**
 * CSSルールをダーク用の上書きに写す（2026-09-13）。
 *
 * 使い道は2つあり、どちらも同じ規則で写す:
 *   - 採取した実物CSS → ビルド時に上書きCSSを作る（tools/rehydrate/build-dark-css.ts）
 *   - クローンが実行時に注入する `<style>` → その場で上書きを作る（src/app/dark-runtime-css.ts）
 */
import { mapDarkDeclaration } from './dark-color.ts'

/** ダークのときに効かせる印 */
export const DARK_SCOPE = 'html[data-theme="dark"]'

/**
 * 暗くしないセレクタ。ユーザーのLPそのもの（エディタの中身・LPの下地）は
 * 作った人が決めた見た目なので、こちらで色を変えない。
 */
const SKIP_SELECTOR = /\.ql-editor|\.sb-lp|#lp-|\[data-lp\b/

/** `html[data-theme="dark"]` を前置する。html / :root / body は形を変えて付ける */
export function darkSelector(selector: string): string {
  return selector
    .split(',')
    .map((one) => {
      const sel = one.trim()
      if (sel === '' || sel.startsWith('@') || sel.startsWith('%')) return null
      if (SKIP_SELECTOR.test(sel)) return null
      if (sel === 'html' || sel === ':root') return DARK_SCOPE
      if (sel.startsWith('html')) return `${DARK_SCOPE}${sel.slice('html'.length)}`
      return `${DARK_SCOPE} ${sel}`
    })
    .filter((s): s is string => s !== null)
    .join(', ')
}

/** 宣言の並びから、ダークで変える宣言だけを取り出す（`色:値;` を並べた文字列を返す） */
export function darkDeclarations(declarations: readonly { property: string; value: string }[]): string {
  const out: string[] = []
  for (const { property, value } of declarations) {
    if (property === '' || value === '') continue
    // 変数の定義（--*）は写さない。その変数が文字用か地用かは名前から決まらず、
    // 向きを取り違えると「暗い地の上の暗い文字」を作ってしまう。
    // ダークの値が要る変数は、定義しているところで明示的に指定する。
    if (property.startsWith('--')) continue
    const mapped = mapDarkDeclaration(property, value)
    if (mapped !== null) out.push(`${property}:${mapped}`)
  }
  return out.join(';')
}

/** `color:#fff;background:#000` のような文字列を宣言の並びにする */
export function parseDeclarations(block: string): { property: string; value: string }[] {
  const out: { property: string; value: string }[] = []
  for (const raw of block.split(';')) {
    const at = raw.indexOf(':')
    if (at === -1) continue
    const property = raw.slice(0, at).trim()
    const value = raw.slice(at + 1).trim()
    if (property !== '' && value !== '') out.push({ property, value })
  }
  return out
}

/** セレクタと宣言から、ダーク用のルール1つを作る。変えるものが無ければ空文字 */
export function darkRule(selector: string, declarations: readonly { property: string; value: string }[]): string {
  const sel = darkSelector(selector)
  if (sel === '') return ''
  const decls = darkDeclarations(declarations)
  return decls === '' ? '' : `${sel}{${decls}}`
}
