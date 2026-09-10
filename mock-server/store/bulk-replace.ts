/**
 * マジック置換（実SB「ツール > マジック置換」= /articles/bulk_replaces）の中身。
 *
 * 実物を 2026-09-10 に実機で確認した挙動:
 *   画像   … 選んだbeyondページで使われている画像を一覧 → チェックしたものを新しい画像へ
 *   テキスト … 文字列を検索 → 前後の文脈つきで一覧 → チェックしたものを新しい文字列へ
 *   リンク  … 選んだページのリンクを一覧 → 新しいURLへ。計測機能は ON / 引き継ぐ / OFF の3択
 *
 * ここはHTMLを読み書きする純粋関数だけを置く（Stateもリクエストも触らない）。
 *
 * ## タグと本文を分けて扱う理由
 * 「まつ毛」を「眉毛」に置換したいとき、素朴に文字列置換すると
 * `href="https://…/まつ毛"` のような**属性の中まで書き換わってリンクが壊れる**。
 * 逆に画像URLを置換したいときは属性だけを見たい。
 * どちらも壊さないよう、HTMLを「タグ」と「本文」の区間に切り分けてから触る。
 */
import { TRACKING_PARAM, isTrackingLink, withTrackingParam } from '../../src/shared/link-html.ts'

/** 計測機能の扱い（実物のラジオ3択と同じ） */
export type TrackingMode = 'on' | 'keep' | 'off'

export interface ImageTarget {
  url: string
  /** そのHTML内での出現回数（実物の `[1]` 表記） */
  count: number
}

export interface LinkTarget {
  url: string
  count: number
  /** 計測機能が付いているリンクか */
  tracking: boolean
}

export interface TextTarget {
  /** 本文中の何番目の一致か（0始まり）。チェックした行だけを置換するのに使う */
  index: number
  /** 一覧に出す前後の文脈 */
  context: string
}

export interface ReplaceResult {
  html: string
  /** 実際に置き換わった箇所の数 */
  replaced: number
}

interface Segment {
  kind: 'tag' | 'text' | 'opaque'
  start: number
  end: number
}

/** script / style の中身は本文でもタグでもない（触ると壊れる） */
const OPAQUE_TAGS = ['script', 'style'] as const

/**
 * HTMLを「タグ」「本文」「触らない領域」に切り分ける。
 * 属性値の中の `>` でタグが終わったと誤解しないよう、引用符の内外を見ている。
 */
function segments(html: string): Segment[] {
  const out: Segment[] = []
  let i = 0
  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt < 0) {
      if (i < html.length) out.push({ kind: 'text', start: i, end: html.length })
      break
    }
    if (lt > i) out.push({ kind: 'text', start: i, end: lt })

    let j = lt + 1
    let quote = ''
    while (j < html.length) {
      const c = html[j] as string
      if (quote !== '') {
        if (c === quote) quote = ''
      } else if (c === '"' || c === "'") {
        quote = c
      } else if (c === '>') {
        j += 1
        break
      }
      j += 1
    }
    out.push({ kind: 'tag', start: lt, end: j })

    // script / style は閉じタグまで丸ごと「触らない領域」にする
    const name = /^<\s*([a-zA-Z][\w-]*)/.exec(html.slice(lt, j))?.[1]?.toLowerCase() ?? ''
    if ((OPAQUE_TAGS as readonly string[]).includes(name)) {
      const close = html.toLowerCase().indexOf(`</${name}`, j)
      const end = close < 0 ? html.length : close
      if (end > j) out.push({ kind: 'opaque', start: j, end })
      i = end
      continue
    }
    i = j
  }
  return out
}

/** 属性値を1つ読む（`src="…"` / `src='…'` / `src=…`） */
function attrValue(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
  if (m === null) return null
  return m[2] ?? m[3] ?? m[4] ?? ''
}

/** タグ名を読む */
function tagName(tag: string): string {
  return /^<\s*\/?\s*([a-zA-Z][\w-]*)/.exec(tag)?.[1]?.toLowerCase() ?? ''
}

/** style 属性の `url(...)` を全部読む */
function styleUrls(tag: string): string[] {
  const style = attrValue(tag, 'style')
  if (style === null) return []
  return [...style.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)].map((m) => (m[1] ?? '').trim())
}

/** 出現順を保ったまま、同じ値をまとめて数える */
function tally<T>(items: readonly { key: string; extra: T }[]): { key: string; count: number; extra: T }[] {
  const out: { key: string; count: number; extra: T }[] = []
  const index = new Map<string, number>()
  for (const item of items) {
    const at = index.get(item.key)
    if (at === undefined) {
      index.set(item.key, out.length)
      out.push({ key: item.key, count: 1, extra: item.extra })
    } else {
      const row = out[at] as { key: string; count: number; extra: T }
      row.count += 1
    }
  }
  return out
}

/** 本文で使われている画像（`<img src>` と style の `url(...)`）を出現順に */
export function findImageTargets(html: string): ImageTarget[] {
  const found: { key: string; extra: null }[] = []
  for (const seg of segments(html)) {
    if (seg.kind !== 'tag') continue
    const tag = html.slice(seg.start, seg.end)
    if (tagName(tag) === 'img') {
      const src = attrValue(tag, 'src')
      if (src !== null && src !== '') found.push({ key: src, extra: null })
    }
    for (const u of styleUrls(tag)) {
      if (u !== '') found.push({ key: u, extra: null })
    }
  }
  return tally(found).map((r) => ({ url: r.key, count: r.count }))
}

/** 本文のリンクを出現順に。計測機能が付いているかも返す */
export function findLinkTargets(html: string): LinkTarget[] {
  const found: { key: string; extra: boolean }[] = []
  for (const seg of segments(html)) {
    if (seg.kind !== 'tag') continue
    const tag = html.slice(seg.start, seg.end)
    if (tagName(tag) !== 'a') continue
    const href = attrValue(tag, 'href')
    if (href === null || href === '') continue
    found.push({ key: href, extra: isTrackingLink(href, attrValue(tag, 'data-sb-tracking')) })
  }
  return tally(found).map((r) => ({ url: r.key, count: r.count, tracking: r.extra }))
}

/** 一覧に出す前後の文脈の長さ（片側） */
const CONTEXT_CHARS = 14

/**
 * 本文に出てくる `query` を、前後の文脈つきで1件ずつ返す。
 * 属性（href やクラス名）に一致しても対象にしない。
 */
export function findTextTargets(html: string, query: string): TextTarget[] {
  if (query === '') return []
  const out: TextTarget[] = []
  for (const seg of segments(html)) {
    if (seg.kind !== 'text') continue
    const text = html.slice(seg.start, seg.end)
    let from = 0
    for (;;) {
      const at = text.indexOf(query, from)
      if (at < 0) break
      const head = text.slice(Math.max(0, at - CONTEXT_CHARS), at)
      const tail = text.slice(at + query.length, at + query.length + CONTEXT_CHARS)
      out.push({ index: out.length, context: `${head}${query}${tail}`.trim() })
      from = at + query.length
    }
  }
  return out
}

/**
 * 本文の文字列を置換する。
 * @param only 置換する一致の番号（`findTextTargets` の index）。省略時は全部。
 */
export function replaceText(
  html: string,
  from: string,
  to: string,
  only?: readonly number[],
): ReplaceResult {
  if (from === '') return { html, replaced: 0 }
  const wanted = only === undefined ? null : new Set(only)
  const pieces: string[] = []
  let seen = 0
  let replaced = 0
  for (const seg of segments(html)) {
    const raw = html.slice(seg.start, seg.end)
    if (seg.kind !== 'text') {
      pieces.push(raw)
      continue
    }
    let out = ''
    let cursor = 0
    for (;;) {
      const at = raw.indexOf(from, cursor)
      if (at < 0) break
      const take = wanted === null || wanted.has(seen)
      out += raw.slice(cursor, at) + (take ? to : from)
      if (take) replaced += 1
      seen += 1
      cursor = at + from.length
    }
    pieces.push(out + raw.slice(cursor))
  }
  return { html: pieces.join(''), replaced }
}

/** タグ内の属性値だけを差し替える */
function setAttr(tag: string, name: string, value: string): string {
  const re = new RegExp(`(\\b${name}\\s*=\\s*)("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  return tag.replace(re, (_m, head: string) => `${head}"${value}"`)
}

/** 画像URLを置換する（`<img src>` と style の `url(...)` の両方） */
export function replaceImage(html: string, from: string, to: string): ReplaceResult {
  if (from === '') return { html, replaced: 0 }
  const pieces: string[] = []
  let replaced = 0
  for (const seg of segments(html)) {
    const raw = html.slice(seg.start, seg.end)
    if (seg.kind !== 'tag') {
      pieces.push(raw)
      continue
    }
    let tag = raw
    if (tagName(tag) === 'img' && attrValue(tag, 'src') === from) {
      tag = setAttr(tag, 'src', to)
      replaced += 1
    }
    const style = attrValue(tag, 'style')
    if (style !== null && styleUrls(tag).includes(from)) {
      const next = style.replace(
        /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi,
        (m, u: string) => (u.trim() === from ? `url(${to})` : m),
      )
      const hits = styleUrls(tag).filter((u) => u === from).length
      tag = setAttr(tag, 'style', next)
      replaced += hits
    }
    pieces.push(tag)
  }
  return { html: pieces.join(''), replaced }
}

/**
 * リンクを置換する。
 * @param mode 計測機能の扱い。`on`=必ず付ける / `keep`=元のリンクに合わせる / `off`=付けない
 */
export function replaceLink(
  html: string,
  from: string,
  to: string,
  mode: TrackingMode,
): ReplaceResult {
  if (from === '') return { html, replaced: 0 }
  const pieces: string[] = []
  let replaced = 0
  for (const seg of segments(html)) {
    const raw = html.slice(seg.start, seg.end)
    if (seg.kind !== 'tag' || tagName(raw) !== 'a' || attrValue(raw, 'href') !== from) {
      pieces.push(raw)
      continue
    }
    const wasTracking = isTrackingLink(from, attrValue(raw, 'data-sb-tracking'))
    const tracking = mode === 'on' ? true : mode === 'off' ? false : wasTracking
    let tag = setAttr(raw, 'href', withTrackingParam(to, tracking))
    // tel: リンクは URL にパラメータを付けられないので属性側で持つ（link-html.ts と同じ扱い）
    if (attrValue(tag, 'data-sb-tracking') !== null) {
      tag = setAttr(tag, 'data-sb-tracking', String(tracking))
    }
    replaced += 1
    pieces.push(tag)
  }
  return { html: pieces.join(''), replaced }
}

/** 置換後のURLに計測パラメータが付いているか（画面の表示用） */
export function hasTrackingParam(url: string): boolean {
  return new URLSearchParams(url.split('?')[1]?.split('#')[0] ?? '').has(TRACKING_PARAM)
}
