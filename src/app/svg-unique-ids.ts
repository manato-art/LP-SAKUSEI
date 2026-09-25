/**
 * アイコン（SVG）の中で使う名前（id）を、アイコンごとに別にする（2026-09-25）。
 *
 * SVG のグラデーション・切り抜き（clipPath）・マスクなどは `url(#id)` や `href="#id"` で指す。
 * id はページ全体で1つの名前として扱われるので、同じ id のアイコンが並ぶと全部が最初の1つの定義を使い、
 * その1つが隠れている（閉じたメニューの中など）と、ほかの全部の色・切り抜きも消える
 * （流入元の Instagram アイコンで実際に色が消えた。写し取った画面にも同じ id が並んでいる）。
 *
 * そのSVGの**中で使っている** id だけを付け替える。中で使っていない id（ほかのSVGから `<use>` で使う
 * スプライトの symbol など）は触らない。ユーザーのLPの中身（エディタ）には使わない（保存されるHTMLが変わる）。
 */

let seq = 0
/** 付け替えた名前の末尾。付け直すときは、これを外してから新しい番号を付ける（名前が伸び続けない） */
const SUFFIX = /--i\d+$/
const baseOf = (id: string): string => id.replace(SUFFIX, '')

/** 文字列の中の `url(#old)` / `href="#old"` を付け替える */
function replaceRefs(text: string, map: ReadonlyMap<string, string>): string {
  return text
    .replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (whole, quote: string, id: string) => {
      const fresh = map.get(id)
      return fresh === undefined ? whole : `url(${quote}#${fresh}${quote})`
    })
    .replace(/^#(.+)$/, (whole, id: string) => {
      const fresh = map.get(id)
      return fresh === undefined ? whole : `#${fresh}`
    })
}

/** そのSVGの中で参照されている id の一覧 */
function localRefs(svg: Element): Set<string> {
  const refs = new Set<string>()
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      for (const m of attr.value.matchAll(/url\(\s*['"]?#([^'")\s]+)/g)) refs.add(m[1] ?? '')
      if ((attr.name === 'href' || attr.name === 'xlink:href') && attr.value.startsWith('#')) refs.add(attr.value.slice(1))
    }
  }
  return refs
}

/**
 * 画面に置いたSVGの id を付け替える。呼ぶたびに新しい名前に付け直す（末尾の番号を替えるだけで、名前は伸びない）。
 * 付け替え済みのアイコンを行ごとコピー（cloneNode）して増やす画面があるので、コピーのあとにもう一度かければ別の名前になる。
 */
export function uniquifySvgIds(root: ParentNode): void {
  for (const svg of root.querySelectorAll('svg')) {
    const refs = localRefs(svg)
    const targets = [...svg.querySelectorAll('[id]')].filter((el) => refs.has(el.id))
    if (targets.length === 0) continue
    seq += 1
    const map = new Map(targets.map((el) => [el.id, `${baseOf(el.id)}--i${seq}`]))
    for (const el of targets) el.id = map.get(el.id) ?? el.id
    for (const el of [svg, ...svg.querySelectorAll('*')]) {
      for (const attr of [...el.attributes]) {
        const next = replaceRefs(attr.value, map)
        if (next !== attr.value) el.setAttribute(attr.name, next)
      }
    }
  }
}

/** 文字列で作るアイコン用。呼ぶたびに別の名前にする（中で使っている id だけ） */
export function withUniqueSvgIds(markup: string): string {
  const used = new Set([...markup.matchAll(/url\(\s*['"]?#([^'")\s]+)|href="#([^"]+)"/g)].map((m) => m[1] ?? m[2] ?? ''))
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] ?? '').filter((id) => used.has(id))
  if (ids.length === 0) return markup
  seq += 1
  const map = new Map(ids.map((id) => [id, `${baseOf(id)}--i${seq}`]))
  return markup
    .replace(/\sid="([^"]+)"/g, (whole, id: string) => (map.has(id) ? ` id="${map.get(id)}"` : whole))
    .replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (whole, quote: string, id: string) =>
      map.has(id) ? `url(${quote}#${map.get(id)}${quote})` : whole,
    )
    .replace(/href="#([^"]+)"/g, (whole, id: string) => (map.has(id) ? `href="#${map.get(id)}"` : whole))
}
