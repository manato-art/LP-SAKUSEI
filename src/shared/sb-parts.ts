/**
 * 取り込んだ見本（SB本体と同じ形・sb-widget-scope.ts）が本文HTMLのどこにあるか。
 * SB本体は見本の中身を書かれたまま配信するので、EBIyon が配信用に手を入れるとき（外部ライブラリの判定・動画の自動再生など）は
 * 見本の中を避ける（2026-10-26 SB本体の検証ページと比べて発覚）。
 */

/** 取り込んだ見本の外枠の開き */
const SB_PART_OPEN = /<div id="sb-part-\d+" class="sb-custom-part [^"]*">/g

/** i から始まる <script>／<style> を丸ごと飛ばした先（当たらなければ i のまま） */
function skipRawText(html: string, i: number): number {
  const m = /^<(script|style)\b/i.exec(html.slice(i, i + 8))
  if (m === null) return i
  const end = html.toLowerCase().indexOf(`</${(m[1] ?? '').toLowerCase()}>`, i)
  return end < 0 ? html.length : end + (m[1] ?? '').length + 3
}

/**
 * 取り込んだ見本の範囲 [始まり, 終わり)（外枠の div と、すぐ後ろの囲ったCSS）を前から順に。
 * 入れ子の div を数えて対になる </div> を探す。<script>・<style> の中の "<div" は数えない。
 */
function sbPartRanges(html: string): ReadonlyArray<readonly [number, number]> {
  const ranges: Array<readonly [number, number]> = []
  let from = 0
  for (const open of html.matchAll(SB_PART_OPEN)) {
    const start = open.index ?? 0
    if (start < from) continue
    let depth = 1
    let i = start + open[0].length
    while (i < html.length && depth > 0) {
      const skipped = skipRawText(html, i)
      if (skipped !== i) {
        i = skipped
        continue
      }
      if (html.startsWith('</div>', i)) depth -= 1
      else if (/^<div[\s>]/i.test(html.slice(i, i + 5))) depth += 1
      i += 1
    }
    const close = depth === 0 ? i - 1 + '</div>'.length : html.length
    const style = /^<style data-sb-custom-style="">[\s\S]*?<\/style>/.exec(html.slice(close))
    from = close + (style?.[0].length ?? 0)
    ranges.push([start, from])
  }
  return ranges
}

/** 取り込んだ見本の中身（外枠の div の中と、すぐ後ろの囲ったCSS）を除いた HTML */
export function withoutSbParts(html: string): string {
  let out = ''
  let from = 0
  for (const [start, end] of sbPartRanges(html)) {
    out += html.slice(from, start)
    from = end
  }
  return out + html.slice(from)
}

/** 取り込んだ見本の外側だけを change で変えた HTML（見本の中身は書かれたまま） */
export function mapOutsideSbParts(html: string, change: (outside: string) => string): string {
  let out = ''
  let from = 0
  for (const [start, end] of sbPartRanges(html)) {
    out += change(html.slice(from, start)) + html.slice(start, end)
    from = end
  }
  return out + change(html.slice(from))
}
