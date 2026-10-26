/**
 * 公開LPの <head> で読み込む外部のもの（フォント・Widget が使う外部ライブラリ）。
 * 配信（mock-server/routes/delivery.ts）と、ヒートマップに敷くLP（src/app/pages/heatmap-lp-document.ts）で同じものを使う。
 */
import { withoutSbParts } from './sb-parts.ts'

/** 記事設定で選べる日本語フォント */
export const LP_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&family=Noto+Serif+JP:wght@400;700&family=Shippori+Mincho:wght@400;700&family=M+PLUS+Rounded+1c:wght@400;700&family=Zen+Maru+Gothic:wght@400;700&family=Kosugi+Maru&family=Dela+Gothic+One&family=RocknRoll+One&family=Reggae+One&family=Yuji+Syuku&family=Hachi+Maru+Pop&family=Yomogi&display=swap'

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
