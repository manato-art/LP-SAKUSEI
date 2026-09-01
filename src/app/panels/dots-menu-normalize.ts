/**
 * 「…」メニュー土台の**構造正規化**（企画書 §11・fragments 正規化の許容手段）。
 *
 * 採取した実DOMは、先頭2項目（複製 / 別のbeyondページに複製）が
 *   `<li><div><span class="MuiListItemText-primary"><div _trigger_><div _dropdownChoice_>`
 *   → その中に**本物の `<li role="menuitem">`** が入っている
 * という**不正な入れ子**（`<li>` の中に `<li>`／`<span>` の中に `<li>`）になっている。
 * これを `element.innerHTML` に入れると、ブラウザのHTMLパーサが入れ子を修復する過程で
 * 後続の項目を落とし、**「複製」1項目しか描画されない**（実測・prod）。
 *
 * ここでは**手書きでUIを作らない**。採取済みの本物の `<li>` 項目を**そのまま**取り出し、
 * `<ul class="MuiMenu-list">` 直下に平らに並べ直すだけ（不正なラッパーだけを外す）。
 * 見た目・アイコン・文言・クラスは実物のまま。＝「島」を壊さない構造正規化。
 */

interface LiSpan {
  start: number
  end: number
  hasNestedLi: boolean
}

/** 文字列に対して `<li>…</li>` の範囲をバランス走査で全部返す（入れ子検出つき） */
function liSpans(html: string): LiSpan[] {
  const token = /<li\b[^>]*>|<\/li\s*>/gi
  const stack: number[] = []
  const spans: LiSpan[] = []
  let match: RegExpExecArray | null = token.exec(html)
  while (match !== null) {
    if (match[0].startsWith('</')) {
      const start = stack.pop()
      if (start !== undefined) {
        const end = match.index + match[0].length
        const bodyStart = html.indexOf('>', start) + 1
        const body = html.slice(bodyStart, match.index)
        spans.push({ start, end, hasNestedLi: /<li\b/i.test(body) })
      }
    } else {
      stack.push(match.index)
    }
    match = token.exec(html)
  }
  return spans
}

/**
 * 「…」メニュー土台の `<ul class="MuiMenu-list">` の中身を、**入れ子でない本物の項目**
 * （＝葉の `<li role="menuitem">`）だけに置き換えて返す。ul の外側（Popover/backdrop/paper）は不変。
 * 目印が見つからない／項目が採れないときは、壊すより現状維持で raw をそのまま返す。
 */
export function normalizeDotsMenuHtml(raw: string): string {
  const ulOpen = /<ul\b[^>]*\bMuiMenu-list\b[^>]*>/i.exec(raw)
  if (ulOpen === null) return raw
  const innerStart = ulOpen.index + ulOpen[0].length
  const ulCloseIdx = raw.indexOf('</ul>', innerStart)
  if (ulCloseIdx === -1) return raw

  const inner = raw.slice(innerStart, ulCloseIdx)
  const items = liSpans(inner)
    .filter((span) => !span.hasNestedLi)
    .filter((span) => {
      const openTag = inner.slice(span.start, inner.indexOf('>', span.start) + 1)
      if (!/role="menuitem"/i.test(openTag)) return false
      // ラベル（MuiListItemText-primary）を持つ本物の項目だけ
      return inner.slice(span.start, span.end).includes('MuiListItemText-primary')
    })
    .sort((a, b) => a.start - b.start)
    .map((span) => inner.slice(span.start, span.end))

  if (items.length === 0) return raw
  return raw.slice(0, innerStart) + items.join('') + raw.slice(ulCloseIdx)
}
