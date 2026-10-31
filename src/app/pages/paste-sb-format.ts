/**
 * 「SBコピー」にチェックを入れて貼ったときは、SB の飾り（色・下線・マーカー・太字・大きさを変えた所）をそのまま残す
 * （2026-10-31 本人「SBからコピペした際は書式やカラー・下線・マーカー等をSBそのまま維持したい」「保存済みの左に SBコピーって
 * ボタン設けてチェック入ってるなら、維持するとか特別な処理にする」）。
 *
 * 本人の選択: チェックは開くたびに外れる／文字の土台（LP全体の書体・大きさ・色）は EBIyon の LP設定・飾りは SB のまま。
 *  - Chrome はコピーのとき、いちばん外の行にページ全体の文字の設定（書体・大きさ・色…）を書き込み、中の飾りは違う所だけを
 *    書き込む（実際の Chrome で確かめた）。いちばん外の行で、ほかの行と同じ値（＝ページ全体の設定）だけを外す（stripPageBase）
 *  - SB のマーカー（background-image の linear-gradient）は EBIyon のマーカー（span.sb-marker）にする（markSbMarkers・
 *    しないと編集画面が読まずに捨てていた）
 *  - 残った飾りは、編集画面がもともと SB の中身を読むのと同じ読み方（Quill の clipboard.convert）で入れる
 *  - リンクは付けない（本人の選択）。画像・SB の Widget は今までどおり EBIyon に写して、元の並びの所に入れる（paste-images.ts）
 * チェックが無いときは今までどおり文字だけ（editor-paste.ts）。
 */
import {
  copyAll,
  fillImageMark,
  imageSourceOf,
  isPixel,
  videoSourceOf,
  widgetPart,
  WIDGET_CLASS,
  type PasteResult,
  type WidgetPart,
} from './paste-images.ts'
import { encodeMarker, MARKER_ATTR } from '../panels/marker-look.ts'
import { colorWithOpacityOf } from '../panels/underline-look.ts'

/** 画像・Widget を置いておく印（私用の文字で囲む。文字の中に出てこない） */
const MARK = String.fromCharCode(0xe000)
const TOKEN = new RegExp(`${MARK}([IVW])(\\d{1,4})${MARK}`, 'g')
const token = (kind: 'I' | 'V' | 'W', n: number): string => `${MARK}${kind}${String(n)}${MARK}`

/** 入れない要素 */
const DROP_TAGS = ['script', 'style', 'noscript', 'template', 'iframe', 'object', 'embed']

export interface DeltaOp {
  insert?: string | Record<string, unknown>
  retain?: number
  delete?: number
  attributes?: Record<string, unknown>
}

/** style を「名前→値」に分ける（url(…) や引用符の中の ; では切らない） */
function parseStyle(style: string): Array<[string, string]> {
  const out: Array<[string, string]> = []
  let depth = 0
  let quote = ''
  let current = ''
  const push = (): void => {
    const at = current.indexOf(':')
    if (at > 0) out.push([current.slice(0, at).trim().toLowerCase(), current.slice(at + 1).trim()])
    current = ''
  }
  for (const ch of style) {
    if (quote !== '') {
      if (ch === quote) quote = ''
    } else if (ch === '"' || ch === "'") quote = ch
    else if (ch === '(') depth += 1
    else if (ch === ')') depth = Math.max(0, depth - 1)
    else if (ch === ';' && depth === 0) {
      push()
      continue
    }
    current += ch
  }
  push()
  return out
}

/**
 * いちばん外の行に書き込まれたページ全体の文字の設定を外す（文字の土台は EBIyon の LP設定）。
 * 行ごとに、いちばん多い値（＝ページ全体の設定）と同じ所だけを外す。違う値（見出しの大きさ・中央寄せ）と中の飾りは残す
 */
export function stripPageBase(root: Element): void {
  const rows = Array.from(root.children)
  const styles = rows.map((row) => parseStyle(row.getAttribute('style') ?? ''))
  const counts = new Map<string, Map<string, number>>()
  for (const style of styles) {
    for (const [name, value] of style) {
      const byValue = counts.get(name) ?? new Map<string, number>()
      byValue.set(value, (byValue.get(value) ?? 0) + 1)
      counts.set(name, byValue)
    }
  }
  const base = new Map(
    [...counts].map(([name, byValue]) => [name, [...byValue].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''] as const),
  )
  rows.forEach((row, i) => {
    const kept = (styles[i] ?? []).filter(([name, value]) => base.get(name) !== value)
    if (kept.length === 0) row.removeAttribute('style')
    else row.setAttribute('style', kept.map(([name, value]) => `${name}: ${value}`).join('; '))
  })
}

/** SB のマーカー（文字の下側に色を敷く帯）: linear-gradient([向き,] 透明 N%, 色 N%) */
const MARKER_GRADIENT =
  /^linear-gradient\(\s*(?:(?:to bottom|180deg)\s*,\s*)?(?:transparent|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\))\s+(\d+(?:\.\d+)?)%\s*,\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))\s+\d+(?:\.\d+)?%\s*\)$/i

/** SB のマーカーを EBIyon のマーカー（span.sb-marker・色・太さ・不透明度）にする。ほかの飾りはそのまま */
export function markSbMarkers(root: Element): void {
  for (const el of Array.from(root.querySelectorAll('[style*="background-image"]'))) {
    // Widget の中は見た目のまま入る（編集画面を通らない）ので、帯は style のまま残す
    if (el.closest(`.${WIDGET_CLASS}`) !== null) continue
    const declarations = parseStyle(el.getAttribute('style') ?? '')
    const gradient = declarations.find(([name]) => name === 'background-image')?.[1] ?? ''
    const match = MARKER_GRADIENT.exec(gradient)
    const fill = match === null ? null : colorWithOpacityOf(match[2] ?? '')
    if (match === null || fill === null) continue
    const value = encodeMarker({ color: fill.color, thickness: 100 - Number(match[1]), opacity: fill.opacity })
    const rest = declarations.filter(([name]) => name !== 'background-image')
    if (rest.length === 0) el.removeAttribute('style')
    else el.setAttribute('style', rest.map(([name, v]) => `${name}: ${v}`).join('; '))
    // 帯は span に付ける（span でなければ、中身を span で包む）
    const marker = el.tagName.toUpperCase() === 'SPAN' ? el : el.ownerDocument.createElement('span')
    if (marker !== el) {
      marker.append(...Array.from(el.childNodes))
      el.append(marker)
    }
    marker.classList.add('sb-marker')
    marker.setAttribute(MARKER_ATTR, value)
  }
}

/**
 * 画像・動画・SB の Widget を印に置き換え、リンクは文字だけ残す。入れない要素（スクリプトなど）は外す。
 * 返す images は印 I、videos は印 V、widgets は印 W の番号の順。コピーに中身が入っていなかった動画・Widget は外して数える
 */
export function tokenizeMedia(root: Element): {
  images: string[]
  videos: string[]
  widgets: WidgetPart[]
  missingVideos: number
  missingWidgets: number
} {
  const doc = root.ownerDocument
  const widgets: WidgetPart[] = []
  let missingWidgets = 0
  // Widget は先に取り出す（中の埋め込み・style は Widget の見た目なので外さない）
  for (const wrapper of Array.from(root.querySelectorAll(`.${WIDGET_CLASS}`))) {
    // Widget の中の Widget は、外の Widget ごと入る
    if ((wrapper.parentElement?.closest(`.${WIDGET_CLASS}`) ?? null) !== null) continue
    const part = widgetPart(wrapper)
    if (part === null) {
      missingWidgets += 1
      wrapper.remove()
      continue
    }
    widgets.push(part)
    wrapper.replaceWith(doc.createTextNode(token('W', widgets.length - 1)))
  }
  for (const el of Array.from(root.querySelectorAll(DROP_TAGS.join(',')))) el.remove()
  const videos: string[] = []
  let missingVideos = 0
  for (const video of Array.from(root.querySelectorAll('video'))) {
    const src = videoSourceOf(video)
    if (src === null) {
      missingVideos += 1
      video.remove()
      continue
    }
    videos.push(src)
    video.replaceWith(doc.createTextNode(token('V', videos.length - 1)))
  }
  for (const link of Array.from(root.querySelectorAll('a'))) link.replaceWith(...Array.from(link.childNodes))
  const images: string[] = []
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const src = imageSourceOf(img)
    if (src === null || isPixel(img)) {
      img.remove()
      continue
    }
    const at = images.indexOf(src)
    const n = at >= 0 ? at : images.push(src) - 1
    img.replaceWith(doc.createTextNode(token('I', n)))
  }
  return { images, videos, widgets, missingVideos, missingWidgets }
}

/** 印を、写した画像・動画・Widget に置き換える（写せなかった画像・動画は外して数える）。リンクの飾りは付けない */
export function fillMediaTokens(
  ops: readonly DeltaOp[],
  imageUrls: ReadonlyMap<number, string | null>,
  widgets: ReadonlyArray<{ readonly html: string }>,
  videoUrls: ReadonlyMap<number, string | null> = new Map(),
): { ops: DeltaOp[]; failed: number } {
  const out: DeltaOp[] = []
  let failed = 0
  const text = (insert: string, attributes: Record<string, unknown> | undefined): void => {
    if (insert === '') return
    const { link: _link, ...rest } = attributes ?? {}
    out.push(Object.keys(rest).length === 0 ? { insert } : { insert, attributes: rest })
  }
  for (const op of ops) {
    if (typeof op.insert !== 'string') {
      out.push(op)
      continue
    }
    let last = 0
    for (const match of op.insert.matchAll(TOKEN)) {
      text(op.insert.slice(last, match.index), op.attributes)
      last = (match.index ?? 0) + match[0].length
      const n = Number(match[2])
      if (match[1] === 'W') {
        const widget = widgets[n]
        if (widget !== undefined) out.push({ insert: { sbwidget: widget.html } })
        continue
      }
      const url = (match[1] === 'V' ? videoUrls : imageUrls).get(n) ?? null
      if (url === null) failed += 1
      else out.push({ insert: match[1] === 'V' ? { sbvideo: url } : { image: url } })
    }
    text(op.insert.slice(last), op.attributes)
  }
  return { ops: out, failed }
}

/** SBコピーで使う Quill の一部（テストでは代わりを渡す） */
export interface ConvertQuill {
  getSelection(focus?: boolean): { index: number; length: number } | null
  enable(enabled?: boolean): unknown
  readonly clipboard: { convert(input: { html: string }): { ops: DeltaOp[] } }
  updateContents(ops: DeltaOp[], source?: string): unknown
  setSelection(index: number, length?: number, source?: string): unknown
}

/**
 * SB の飾りを残して貼る（カーソルの所へ・選んでいた文字は置き換える）。画像は写してから入れる（写している間は編集を止め、
 * 入れる前に戻す＝止めたまま入れると Quill が捨てる）。parse は貼った HTML を要素にする（ブラウザでは DOMParser）
 */
export async function keepSbFormatOps(
  quill: ConvertQuill,
  html: string,
  copy: (src: string) => Promise<string | null>,
  parse: (html: string) => Element,
): Promise<PasteResult> {
  const range = quill.getSelection(true)
  if (range === null) return { images: 0, videos: 0, widgets: 0, failed: 0, missingVideos: 0, missingWidgets: 0 }
  const root = parse(html)
  stripPageBase(root)
  markSbMarkers(root)
  const media = tokenizeMedia(root)
  quill.enable(false)
  let copied: Map<string, string | null>
  try {
    copied = await copyAll([...media.images, ...media.videos, ...media.widgets.flatMap((widget) => widget.images)], copy)
  } finally {
    quill.enable(true)
  }
  let widgetImages = 0
  let widgetFailed = 0
  const widgets = media.widgets.map((widget) => {
    const ok = widget.images.filter((src) => (copied.get(src) ?? null) !== null).length
    widgetImages += ok
    widgetFailed += widget.images.length - ok
    return { html: widget.images.reduce((acc, src, n) => fillImageMark(acc, n, copied.get(src) ?? null), widget.html) }
  })
  const converted = quill.clipboard.convert({ html: root.innerHTML })
  const urlsOf = (list: readonly string[]): Map<number, string | null> => new Map(list.map((src, n) => [n, copied.get(src) ?? null]))
  const filled = fillMediaTokens(converted.ops, urlsOf(media.images), widgets, urlsOf(media.videos))
  quill.updateContents([{ retain: range.index }, ...(range.length > 0 ? [{ delete: range.length }] : []), ...filled.ops], 'user')
  const length = filled.ops.reduce((n, op) => n + (typeof op.insert === 'string' ? op.insert.length : 1), 0)
  quill.setSelection(range.index + length, 0, 'user')
  const embeds = (key: string): number => filled.ops.filter((op) => typeof op.insert === 'object' && key in op.insert).length
  return {
    images: embeds('image') + widgetImages,
    videos: embeds('sbvideo'),
    widgets: embeds('sbwidget'),
    failed: filled.failed + widgetFailed,
    missingVideos: media.missingVideos,
    missingWidgets: media.missingWidgets,
  }
}
