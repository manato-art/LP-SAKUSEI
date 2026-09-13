/**
 * クローン自身が実行時に注入した `<style>` を、ダークのときだけ上書きする（2026-09-13）。
 *
 * 採取した実物CSSはビルド時に作った `/clean/_merged/dark.css` で上書きできるが、
 * エディタやパネルは画面を開いたときに `<style>` を注入するので、そこには届かない。
 * ここでは注入済みの `<style>` を読み、同じ規則（`src/shared/dark-css.ts`）で
 * 上書きを1枚だけ作って最後に足す。あとから注入されたものも拾う。
 *
 * ユーザーのLPそのもの（`.ql-editor` 配下など）は `darkSelector` が除外する。
 */
import { darkRule, parseDeclarations } from '../shared/dark-css.ts'

const OVERRIDE_ID = 'sb-dark-runtime'

/** その `<style>` を読む対象にするか（自分が作ったものと、外部CSSは除く） */
function isTarget(sheet: CSSStyleSheet): boolean {
  const node = sheet.ownerNode
  if (!(node instanceof HTMLStyleElement)) return false
  return node.id !== OVERRIDE_ID
}

/** ルール（入れ子の @media も）から上書きを作る */
function convert(rule: CSSRule): string {
  if (rule instanceof CSSStyleRule) {
    return darkRule(rule.selectorText, parseDeclarations(rule.style.cssText))
  }
  if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
    const inner = [...rule.cssRules].map(convert).filter(Boolean).join('\n')
    return inner === '' ? '' : `@${rule instanceof CSSMediaRule ? 'media' : 'supports'} ${rule.conditionText}{\n${inner}\n}`
  }
  return ''
}

/** 注入済みの `<style>` を読み直して、ダーク用の上書きを作り直す */
export function refreshRuntimeDarkCss(): void {
  const pieces: string[] = []
  for (const sheet of [...document.styleSheets]) {
    if (!(sheet instanceof CSSStyleSheet) || !isTarget(sheet)) continue
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue // 別オリジンのCSSは読めない（読めなくても画面は出す）
    }
    for (const rule of [...rules]) {
      const converted = convert(rule)
      if (converted !== '') pieces.push(converted)
    }
  }
  let style = document.getElementById(OVERRIDE_ID)
  if (!(style instanceof HTMLStyleElement)) {
    style = document.createElement('style')
    style.id = OVERRIDE_ID
    document.head.append(style)
  }
  style.textContent = pieces.join('\n')
  // 後から注入された `<style>` より後ろに居ないと勝てないので、常に末尾へ動かす
  document.head.append(style)
}

let observer: MutationObserver | null = null
let pending = 0

/** ダークの間だけ、`<style>` が増えるたびに上書きを作り直す */
export function startRuntimeDarkCss(): void {
  refreshRuntimeDarkCss()
  if (observer !== null) return
  observer = new MutationObserver((records) => {
    const added = records.some((r) =>
      [...r.addedNodes].some((n) => n instanceof HTMLStyleElement && n.id !== OVERRIDE_ID),
    )
    if (!added) return
    // 同じ画面で何枚も注入されるので、まとめて1回だけ作り直す
    window.clearTimeout(pending)
    pending = window.setTimeout(refreshRuntimeDarkCss, 60)
  })
  observer.observe(document.head, { childList: true })
}

/** ライトへ戻したとき。上書きを空にして、監視も止める */
export function stopRuntimeDarkCss(): void {
  observer?.disconnect()
  observer = null
  window.clearTimeout(pending)
  document.getElementById(OVERRIDE_ID)?.remove()
}
