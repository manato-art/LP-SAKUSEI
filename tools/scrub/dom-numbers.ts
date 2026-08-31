/**
 * 採取したDOM本文の金額・率を架空値へ置き換える。
 *
 * JSONと違い、DOMの本文には「どのフィールドか」という手がかりが無い。
 * そのため辞書方式では拾えず、実際に**本番の売上・配信金額がそのままコミットされていた**。
 *
 * 置き換えは決定論的にする（同じ実値 → 常に同じ架空値）。
 * そうしないと同じ表の中で合計と内訳が食い違い、土台として使えなくなる。
 *
 * 触らないもの:
 * - `0` や `0.00%`（新規空アカウントの見た目そのもの。変えると空状態が壊れる）
 * - タグの属性値（`data-*` や `title` はレイアウトや識別に使われる）
 * - 3桁以下の数（順位・件数・日付の一部と区別できない）
 */

/** 決定論的な擬似乱数（同じ入力からは必ず同じ出力）。 */
function hashToInt(text: string): number {
  let value = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

/** 桁数を保ったまま別の数字にする。 */
function fakeDigits(original: string, salt: string): string {
  const digits = original.replace(/,/g, '')
  const seed = hashToInt(salt + digits)
  let out = ''
  for (let index = 0; index < digits.length; index += 1) {
    const shifted = (seed >>> (index % 24)) % 10
    // 先頭が 0 にならないようにする（桁数が変わって見えるため）
    out += index === 0 ? String(1 + (shifted % 9)) : String(shifted)
  }
  return out
}

/** 元の桁区切りの位置を保って数字を入れ直す。 */
function withSameGrouping(original: string, replacement: string): string {
  if (!original.includes(',')) return replacement
  const parts: string[] = []
  let rest = replacement
  while (rest.length > 3) {
    parts.unshift(rest.slice(-3))
    rest = rest.slice(0, -3)
  }
  parts.unshift(rest)
  return parts.join(',')
}

const MONEY = /([¥￥])\s?(\d{1,3}(?:,\d{3})+|\d{4,})/g
const PERCENT = /(\d+\.\d{1,2})%/g
/** タグの中（属性）は触らない。タグとタグの間のテキストだけを対象にする。 */
const TEXT_BETWEEN_TAGS = /(>)([^<]+)(<)/g

function scrubTextRun(text: string): string {
  return text
    .replace(MONEY, (whole, mark: string, digits: string) => {
      const bare = digits.replace(/,/g, '')
      if (Number(bare) === 0) return whole
      return `${mark}${withSameGrouping(digits, fakeDigits(digits, 'money'))}`
    })
    .replace(PERCENT, (whole, value: string) => {
      if (Number(value) === 0) return whole
      const [intPart = '0', decimals = '00'] = value.split('.')
      const faked = fakeDigits(intPart, 'pct')
      const fakedDecimals = fakeDigits(decimals, 'pctd').slice(0, decimals.length)
      return `${faked}.${fakedDecimals}%`
    })
}

/** DOM文字列の本文だけを対象に、金額と率を架空値へ置き換える。 */
export function scrubDomNumbers(html: string): string {
  return html.replace(TEXT_BETWEEN_TAGS, (_whole, open: string, text: string, close: string) => {
    return `${open}${scrubTextRun(text)}${close}`
  })
}
