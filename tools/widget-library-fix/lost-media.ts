/**
 * SBが持っていた画像・動画を、灰色の仮の絵にする（2026-09-22・見本の点検と作り変え）。
 *
 * 見本の画像・動画の多くは SB の置き場（`…/uploads/article_photo/…`）にあり、匿名化で
 * `sample80.example.test/uploads/…`・スキーム無しの `example.test/uploads/…` などになった。元のファイルは
 * どこにも残っていない（採取物にも無い）ので戻せない。壊れた画像のマーク・真っ黒な動画のまま出さず、
 * ほかの見本と同じ灰色の「画像」「動画」の絵にする（あとで本人が自分の画像に差し替える前提）。
 *
 * CSS の背景（url(…)）は触らない。読めなくても何も出ないだけで、灰色の四角を敷くと文字の下に箱が出てしまう。
 */

/** ほかの見本がもともと使っている仮の絵（同じ見た目にそろえる） */
export const IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='100%25' height='100%25' fill='%23ededed'/%3E%3Ctext x='50%25' y='50%25' fill='%23a8a8a8' font-family='sans-serif' font-size='15' text-anchor='middle' dominant-baseline='middle'%3E画像%3C/text%3E%3C/svg%3E"

export const VIDEO_POSTER_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='100%25' height='100%25' fill='%23ededed'/%3E%3Ctext x='50%25' y='50%25' fill='%23a8a8a8' font-family='sans-serif' font-size='15' text-anchor='middle' dominant-baseline='middle'%3E動画%3C/text%3E%3C/svg%3E"

/** SBの置き場にあった（今は読めない）ファイルのURL */
const LOST = String.raw`(?:https?:)?(?:\/\/)?(?:[a-z0-9-]+\.)?example\.test\/uploads\/[^\s"'<>]*`
const LOST_RE = new RegExp(LOST, 'i')
const attrWithLost = (name: string): RegExp => new RegExp(String.raw`\s${name}="[^"]*${LOST}[^"]*"`, 'gi')

function fixImg(tag: string): string {
  return tag
    .replace(attrWithLost('srcset'), '')
    .replace(new RegExp(String.raw`(\s(?:src|data-src)=")${LOST}(")`, 'gi'), `$1${IMAGE_PLACEHOLDER}$2`)
}

function fixVideo(tag: string): string {
  let out = tag.replace(new RegExp(String.raw`(\sposter=")${LOST}(")`, 'gi'), `$1${VIDEO_POSTER_PLACEHOLDER}$2`)
  if (new RegExp(String.raw`\ssrc="${LOST}"`, 'i').test(out)) {
    out = out.replace(new RegExp(String.raw`\ssrc="${LOST}"`, 'gi'), '')
    if (!/\sposter="/i.test(out)) out = out.replace(/\s*(\/?)>$/, ` poster="${VIDEO_POSTER_PLACEHOLDER}"$1>`)
  }
  return out
}

export function replaceLostMedia(html: string): string {
  return (
    html
      // picture / video の source は外す（img の仮の絵・video の表紙が出る）
      .replace(/<source\b[^>]*>/gi, (tag) => (LOST_RE.test(tag) ? '' : tag))
      .replace(/<img\b[^>]*>/gi, (tag) => (LOST_RE.test(tag) ? fixImg(tag) : tag))
      .replace(/<video\b[^>]*>/gi, (tag) => (LOST_RE.test(tag) ? fixVideo(tag) : tag))
      // スクリプトが差し替えに使う画像
      .replace(new RegExp(String.raw`(\sdata-(?:img|modalimg|image|bg)=")${LOST}(")`, 'gi'), `$1${IMAGE_PLACEHOLDER}$2`)
  )
}
