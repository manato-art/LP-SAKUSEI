/**
 * 公開LPの <head> で読み込む外部のもの（フォント・Widget が使う外部ライブラリ）。
 * 配信（mock-server/routes/delivery.ts）と、ヒートマップに敷くLP（src/app/pages/heatmap-lp-document.ts）で同じものを使う。
 */

/** 記事設定で選べる日本語フォント */
export const LP_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&family=Noto+Serif+JP:wght@400;700&family=Shippori+Mincho:wght@400;700&family=M+PLUS+Rounded+1c:wght@400;700&family=Zen+Maru+Gothic:wght@400;700&family=Kosugi+Maru&family=Dela+Gothic+One&family=RocknRoll+One&family=Reggae+One&family=Yuji+Syuku&family=Hachi+Maru+Pop&family=Yomogi&display=swap'

/** 取り込んだ見本（SB本体と同じ形・sb-widget-scope.ts）の外枠の開き */
const SB_PART_OPEN = /<div id="sb-part-\d+" class="sb-custom-part [^"]*">/g

/** i から始まる <script>／<style> を丸ごと飛ばした先（当たらなければ i のまま） */
function skipRawText(html: string, i: number): number {
  const m = /^<(script|style)\b/i.exec(html.slice(i, i + 8))
  if (m === null) return i
  const end = html.toLowerCase().indexOf(`</${(m[1] ?? '').toLowerCase()}>`, i)
  return end < 0 ? html.length : end + (m[1] ?? '').length + 3
}

/**
 * 取り込んだ見本の中身（外枠の div の中と、すぐ後ろの囲ったCSS）を除いた HTML。
 * 入れ子の div を数えて対になる </div> を探す。<script>・<style> の中の "<div" は数えない。
 */
export function withoutSbParts(html: string): string {
  let out = ''
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
    out += html.slice(from, start)
    from = close + (style?.[0].length ?? 0)
  }
  return out + html.slice(from)
}

/**
 * ウィジェットが必要とする外部JSライブラリを、本文HTMLの内容から判定して <head> に読み込む。
 * 実SBのカルーセル等のウィジェットは Swiper / SmoothScroll / jQuery / GLightbox 前提で書かれており、
 * これらを読み込まないと内蔵JS（new Swiper 等）が ReferenceError で動かない。
 * 同期 <script> を head に置くことで、body内のウィジェットJSより前に定義される。
 *
 * 取り込んだ見本（.sb-custom-part）の中身は jQuery・Swiper・GLightbox の判定に使わない（2026-10-26）。
 * SB本体の配信ページはこれらを置かず（共通で置くのは LazyLoad・URI.js・smooth-scroll 16.1.3 だけ）、見本は自分で Swiper 8 等を読み込む。
 * Swiper 11 の CSS を足すと、取り込んだスライダーの並び・見えている枚数が SB と変わっていた。smooth-scroll は SB と同じく足す。
 */
export function externalWidgetLibs(html: string): string {
  const tags: string[] = []
  const own = withoutSbParts(html)
  if (/jQuery\s*\(|(?:^|[^\w.$])\$\(/.test(own)) {
    tags.push('<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>')
  }
  if (/new Swiper|class="[^"]*\bswiper|\bswiper-(?:container|wrapper|slide)/i.test(own)) {
    tags.push('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">')
    tags.push('<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>')
  }
  if (/new SmoothScroll|SmoothScroll\s*\(/.test(html)) {
    tags.push('<script src="https://cdn.jsdelivr.net/npm/smooth-scroll@16.1.3/dist/smooth-scroll.polyfills.min.js"></script>')
  }
  if (/GLightbox|glightbox/i.test(own)) {
    tags.push('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/glightbox/dist/css/glightbox.min.css">')
    tags.push('<script src="https://cdn.jsdelivr.net/npm/glightbox/dist/js/glightbox.min.js"></script>')
  }
  return tags.join('')
}

/** そのうちスタイルシートだけ。スクリプトを動かさない表示（ヒートマップ）で、見た目と高さを公開LPに合わせる */
export function externalWidgetStylesheets(html: string): string {
  return (externalWidgetLibs(html).match(/<link\b[^>]*>/g) ?? []).join('')
}
