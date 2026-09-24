/**
 * 部品の文字（見出し・文章・ボタンの文字 など）の「飾りつき」の形（2026-09-24・Widget編集 第3弾）。
 *
 * 本人の依頼「文字とかの色は個別で調節したりできるように、ツールバーは残して欲しい」。
 * 見たまま画面のツールバー（太字・色・大きさ）で付けた飾りを、部品の文字にそのまま持たせる。
 * 持てるのは文字の飾りだけ（b・i・u・s・span・font・br・mark・sub・sup・small と、色や大きさの style）。
 * それ以外のタグ（script・img・a・div…）は外し、文字だけ残す。属性は style（許した性質だけ）と font の color/face/size だけ。
 *
 *  - 以前の「素の文字」（& や < を含む）もそのまま読める（タグにならない < は &lt; に、裸の & は &amp; に直す）
 *  - 右の入力欄には飾りを外した文字（plainTextOfRich）を出し、そこで打ち直したら素の文字（エスケープ）になる
 * DOM を使わない（テストは tests/nocode-rich-text.test.ts）。
 */

const ALLOWED_TAGS: ReadonlySet<string> = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'span', 'font', 'br', 'mark', 'sub', 'sup', 'small'])
/** 中身ごと捨てるタグ */
const DROP_WITH_CONTENT: ReadonlySet<string> = new Set(['script', 'style', 'noscript', 'template', 'iframe', 'object', 'embed'])
const ALLOWED_STYLE: ReadonlySet<string> = new Set([
  'color',
  'background-color',
  'background',
  'font-size',
  'font-family',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-decoration-line',
  'text-decoration-color',
  'letter-spacing',
])
const FONT_ATTRS: ReadonlySet<string> = new Set(['color', 'face', 'size'])

const TAG = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)>/
const ATTR = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g
const ENTITY = /&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/

/** style の値として危ないもの（外へ読みに行く・式・タグの文字） */
const BAD_STYLE_VALUE = /url\s*\(|expression\s*\(|javascript|[<>"\\]/i

function escapeText(text: string): string {
  return text
    .replace(/&(?!(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function safeStyle(value: string): string {
  const kept: string[] = []
  for (const declaration of value.split(';')) {
    const colon = declaration.indexOf(':')
    if (colon === -1) continue
    const property = declaration.slice(0, colon).trim().toLowerCase()
    const v = declaration.slice(colon + 1).trim()
    if (!ALLOWED_STYLE.has(property) || v === '' || BAD_STYLE_VALUE.test(v)) continue
    kept.push(`${property}:${v}`)
  }
  return kept.join(';')
}

function safeAttrs(tag: string, raw: string): string {
  let out = ''
  for (const m of raw.matchAll(ATTR)) {
    const name = (m[1] ?? '').toLowerCase()
    const value = m[2] ?? m[3] ?? m[4] ?? ''
    if (name === 'style') {
      const style = safeStyle(value)
      if (style !== '') out += ` style="${style.replace(/"/g, '&quot;')}"`
    } else if (tag === 'font' && FONT_ATTRS.has(name) && !BAD_STYLE_VALUE.test(value)) {
      out += ` ${name}="${value.replace(/"/g, '&quot;')}"`
    }
  }
  return out
}

/** 飾りだけを残したHTML。素の文字（以前の形）を渡しても壊れない */
export function sanitizeRichHtml(input: string): string {
  let out = ''
  let i = 0
  let text = ''
  const flush = (): void => {
    if (text !== '') out += escapeText(text)
    text = ''
  }
  while (i < input.length) {
    const ch = input[i] ?? ''
    if (ch !== '<') {
      text += ch
      i++
      continue
    }
    if (input.startsWith('<!--', i)) {
      const end = input.indexOf('-->', i + 4)
      i = end === -1 ? input.length : end + 3
      continue
    }
    const m = TAG.exec(input.slice(i))
    if (m === null) {
      text += ch
      i++
      continue
    }
    const closing = m[1] === '/'
    const tag = (m[2] ?? '').toLowerCase()
    i += m[0].length
    if (DROP_WITH_CONTENT.has(tag)) {
      if (!closing) {
        const end = input.toLowerCase().indexOf(`</${tag}`, i)
        const close = end === -1 ? -1 : input.indexOf('>', end)
        i = close === -1 ? input.length : close + 1
      }
      continue
    }
    if (!ALLOWED_TAGS.has(tag)) continue
    flush()
    if (tag === 'br') {
      if (!closing) out += '<br>'
      continue
    }
    out += closing ? `</${tag}>` : `<${tag}${safeAttrs(tag, m[3] ?? '')}>`
  }
  flush()
  return out
}

/** 飾りつきの文字を、そのままLPに書くHTMLに（改行は <br>） */
export function richText(text: string): string {
  return sanitizeRichHtml(text.trim()).replace(/\r?\n/g, '<br>')
}

const NAMED: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** 飾りを外した素の文字（<br> は改行）。右の入力欄と、空かどうかの確かめに使う */
export function plainTextOfRich(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^<>]*>/g, '')
    .replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body: string) => {
      if (body.startsWith('#x')) return String.fromCodePoint(Number.parseInt(body.slice(2), 16))
      if (body.startsWith('#')) return String.fromCodePoint(Number(body.slice(1)))
      return NAMED[body] ?? whole
    })
}

/** 素の文字を、飾りつきの形として持てる文字に（右の入力欄で打った文字） */
export function plainToRich(text: string): string {
  return escapeText(text)
}

/**
 * 右の欄で直した素の文字を、飾りつきの文字に当てる（2026-09-24・右の欄で直すと飾りが消えていた）。
 * 前と後の素の文字を比べて、変わった所だけを差し替える（前後で同じ所の飾りは残す）。
 * 打ち足した文字は、すぐ前の文字の飾りの中に入る（見たまま画面で打ち足したときと同じ）。
 * 消した所にあったタグは残す（飾りの境目をまたいで消しても、タグの組が壊れない）。
 */
export function applyPlainEdit(oldRich: string, newPlain: string): string {
  // 飾りつきの文字を、素の文字1つずつ（HTMLの中の始まりと終わり）に分ける。タグは素の文字に数えない
  const starts: number[] = []
  const ends: number[] = []
  let plain = ''
  const token = /<br\s*\/?>|<[^<>]*>|&(?:#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);|[\s\S]/gi
  for (const m of oldRich.matchAll(token)) {
    const t = m[0]
    const at = m.index ?? 0
    const isBr = /^<br/i.test(t)
    if (!isBr && t.startsWith('<') && t.length > 1) continue
    const ch = isBr ? '\n' : plainTextOfRich(t)
    for (let k = 0; k < ch.length; k++) {
      starts.push(at)
      ends.push(at + t.length)
    }
    plain += ch
  }
  // 読み取れない形（前の素の文字とずれる）なら、今までどおり素の文字にする
  if (plain !== plainTextOfRich(oldRich)) return plainToRich(newPlain)
  let p = 0
  while (p < plain.length && p < newPlain.length && plain[p] === newPlain[p]) p++
  let q = 0
  while (q < plain.length - p && q < newPlain.length - p && plain[plain.length - 1 - q] === newPlain[newPlain.length - 1 - q]) q++
  const removedEnd = plain.length - q
  const inserted = newPlain
    .slice(p, newPlain.length - q)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, '<br>')
  if (removedEnd <= p) {
    if (inserted === '') return oldRich
    // 打ち足し: すぐ前の文字の後ろ（先頭なら最初の文字の前）
    const at = p > 0 ? (ends[p - 1] ?? oldRich.length) : (starts[0] ?? oldRich.length)
    return oldRich.slice(0, at) + inserted + oldRich.slice(at)
  }
  const from = starts[p] ?? oldRich.length
  const to = ends[removedEnd - 1] ?? oldRich.length
  const keptTags = (oldRich.slice(from, to).match(/<(?!br\b)[^<>]*>/gi) ?? []).join('')
  return oldRich.slice(0, from) + inserted + keptTags + oldRich.slice(to)
}

/** 飾りつきの文字が空か（<br> や空白だけも空） */
export function isRichEmpty(html: string): boolean {
  return plainTextOfRich(html).trim() === ''
}

export { ENTITY as RICH_ENTITY }
