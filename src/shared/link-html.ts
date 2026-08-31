/**
 * リンク置換の純粋ロジック（DOMにもExpressにも依存しない）。
 *
 * 画面（`src/app/panels/link-replace.ts`）とモックサーバー
 * （`mock-server/routes/panel-link-replace.ts`）が **同じ実装**でHTMLを書き換えるために
 * ここへ切り出してある。片方だけ直して結果がずれる、を起こさないため。
 *
 * 「計測機能付きリンク」の意味は **採取した実 Quill Link blot のソース**から確定している
 * （capture/clean/ab_tests__UID__articles/editor-target/iframe0.html）:
 *   - tel: 以外 … href のクエリに `sb_tracking=true` を付ける
 *   - tel:     … `data-sb-tracking="true"` 属性を付ける
 *   - 別タブ   … `target="_blank"`（rel は実物が付けないので付けない＝勝手に改善しない）
 *   - 許可プロトコル … http / https / mailto / tel（実物にはもう1つ特定アプリのスキームが
 *     入っているが、第三者のブランド名なのでクローンには持ち込まない）
 */

/** 実物の Quill Link blot が使う計測フラグ */
export const TRACKING_PARAM = 'sb_tracking'
export const TRACKING_ATTRIBUTE = 'data-sb-tracking'

/** 実物の `Link.PROTOCOL_WHITELIST` 相当（特定アプリ専用スキームは除いてある） */
export const LINK_PROTOCOL_WHITELIST: readonly string[] = ['http', 'https', 'mailto', 'tel']

/** 空状態の文言（実機 verbatim・採取DOMの `_noLinksDescription_id5w4_411` の中身） */
export const EMPTY_LINKS_MESSAGE = '置き換え対象のリンクがありません'

export type LinkSortMode = 'all' | 'tracking' | 'untracked'

/** 採取した `<select>` の option value そのまま（`free` / `redirectPage`） */
export type ReplaceTargetType = 'free' | 'redirectPage'

/** 採取したタブ2枚（`Version内リンク` / `離脱防止ポップアップリンク`） */
export type LinkTab = 'version' | 'exitPopup'

export interface LpLink {
  /** 本文中の出現順（0始まり）。これが置換対象の識別子になる */
  index: number
  href: string
  text: string
  isTracking: boolean
  isNewTab: boolean
}

export interface LinkReplacement {
  href: string
  tracking: boolean
  newTab: boolean
}

interface HtmlAttribute {
  name: string
  value: string | null
}

interface AnchorTag {
  start: number
  end: number
  attrs: string
}

const NAME_START = /[A-Za-z:_@]/

function isTagBoundary(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '>' || ch === '/'
}

/** 引用符の中の `>` を終端と誤認しないタグ終端探索 */
function findTagEnd(html: string, from: number): number {
  let quote = ''
  for (let k = from; k < html.length; k += 1) {
    const ch = html.charAt(k)
    if (quote !== '') {
      if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '>') return k + 1
  }
  return -1
}

/**
 * `<a ...>` の開始タグを出現順に拾う。
 * 対象は Quill が書き出す普通のHTMLなので、コメントやCDATA内の `<a` は考慮しない（既知の限界）。
 */
function findAnchorOpenTags(html: string): AnchorTag[] {
  const out: AnchorTag[] = []
  const lower = html.toLowerCase()
  let i = lower.indexOf('<a')
  while (i >= 0) {
    if (isTagBoundary(lower.charAt(i + 2))) {
      const end = findTagEnd(html, i + 2)
      if (end > 0) {
        out.push({ start: i, end, attrs: html.slice(i + 2, end - 1) })
        i = lower.indexOf('<a', end)
        continue
      }
    }
    i = lower.indexOf('<a', i + 2)
  }
  return out
}

const ATTRIBUTE_PATTERN = /([^\s"'=<>/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g

function decodeAttributeValue(raw: string): string {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
}

function encodeAttributeValue(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseAttributes(source: string): HtmlAttribute[] {
  const out: HtmlAttribute[] = []
  ATTRIBUTE_PATTERN.lastIndex = 0
  let match = ATTRIBUTE_PATTERN.exec(source)
  while (match !== null) {
    const name = match[1]
    if (name !== undefined && NAME_START.test(name.charAt(0))) {
      const raw = match[2]
      const unquoted =
        raw === undefined
          ? null
          : raw.startsWith('"') || raw.startsWith("'")
            ? raw.slice(1, -1)
            : raw
      out.push({ name, value: unquoted === null ? null : decodeAttributeValue(unquoted) })
    }
    match = ATTRIBUTE_PATTERN.exec(source)
  }
  return out
}

function serializeAttributes(attrs: readonly HtmlAttribute[]): string {
  if (attrs.length === 0) return ''
  const body = attrs
    .map((a) => (a.value === null ? a.name : `${a.name}="${encodeAttributeValue(a.value)}"`))
    .join(' ')
  return ` ${body}`
}

function attributeValue(attrs: readonly HtmlAttribute[], name: string): string | null {
  const lower = name.toLowerCase()
  return attrs.find((a) => a.name.toLowerCase() === lower)?.value ?? null
}

/** イミュータブルに属性を差し替える（元の並び順は保つ） */
function setAttribute(attrs: readonly HtmlAttribute[], name: string, value: string): HtmlAttribute[] {
  const lower = name.toLowerCase()
  const exists = attrs.some((a) => a.name.toLowerCase() === lower)
  if (!exists) return [...attrs, { name, value }]
  return attrs.map((a) => (a.name.toLowerCase() === lower ? { name: a.name, value } : a))
}

function removeAttribute(attrs: readonly HtmlAttribute[], name: string): HtmlAttribute[] {
  const lower = name.toLowerCase()
  return attrs.filter((a) => a.name.toLowerCase() !== lower)
}

export function isTelHref(href: string): boolean {
  return /^tel:/i.test(href.trim())
}

function splitHref(href: string): { base: string; query: string; hash: string } {
  const hashAt = href.indexOf('#')
  const hash = hashAt < 0 ? '' : href.slice(hashAt)
  const withoutHash = hashAt < 0 ? href : href.slice(0, hashAt)
  const queryAt = withoutHash.indexOf('?')
  return {
    base: queryAt < 0 ? withoutHash : withoutHash.slice(0, queryAt),
    query: queryAt < 0 ? '' : withoutHash.slice(queryAt + 1),
    hash,
  }
}

/** `sb_tracking` を付けた / 外した href を返す（元の href は変更しない） */
export function withTrackingParam(href: string, tracking: boolean): string {
  const { base, query, hash } = splitHref(href)
  const params = new URLSearchParams(query)
  if (tracking) params.set(TRACKING_PARAM, 'true')
  else params.delete(TRACKING_PARAM)
  const next = params.toString()
  return `${base}${next === '' ? '' : `?${next}`}${hash}`
}

/** 計測機能付きリンクか（tel: だけ属性で、それ以外はクエリで表す＝実物の挙動） */
export function isTrackingLink(href: string, trackingAttribute: string | null): boolean {
  if (isTelHref(href)) return trackingAttribute === 'true'
  return new URLSearchParams(splitHref(href).query).has(TRACKING_PARAM)
}

/** 実物の `linkSanitize` 相当。スキーム無し（相対URL）はページのhttp(s)で解決されるので許可 */
export function isAllowedLinkUrl(url: string): boolean {
  const trimmed = url.trim()
  if (trimmed === '') return false
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(trimmed)
  if (scheme === null) return true
  const protocol = scheme[1]
  return protocol !== undefined && LINK_PROTOCOL_WHITELIST.includes(protocol.toLowerCase())
}

export function buildReplacementHref(url: string, tracking: boolean): string {
  const trimmed = url.trim()
  return isTelHref(trimmed) ? trimmed : withTrackingParam(trimmed, tracking)
}

function innerTextAfter(html: string, from: number): string {
  const closeAt = html.toLowerCase().indexOf('</a', from)
  const inner = closeAt < 0 ? html.slice(from) : html.slice(from, closeAt)
  return decodeAttributeValue(inner.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
}

/** 本文HTMLからリンクを出現順に抽出する */
export function extractLinksFromHtml(html: string): LpLink[] {
  return findAnchorOpenTags(html).map((tag, index) => {
    const attrs = parseAttributes(tag.attrs)
    const href = attributeValue(attrs, 'href') ?? ''
    return {
      index,
      href,
      text: innerTextAfter(html, tag.end),
      isTracking: isTrackingLink(href, attributeValue(attrs, TRACKING_ATTRIBUTE)),
      isNewTab: (attributeValue(attrs, 'target') ?? '').toLowerCase() === '_blank',
    }
  })
}

export function filterLinks(links: readonly LpLink[], mode: LinkSortMode): LpLink[] {
  if (mode === 'tracking') return links.filter((l) => l.isTracking)
  if (mode === 'untracked') return links.filter((l) => !l.isTracking)
  return [...links]
}

/** 採取した `全て選択` ボタンが対象にする出現順の集合（いまの絞り込みに従う） */
export function selectableLinkIndexes(
  links: readonly LpLink[],
  mode: LinkSortMode,
): number[] {
  return filterLinks(links, mode).map((l) => l.index)
}

/**
 * 指定した出現順のリンクだけを置き換えた新しいHTMLを返す（元のHTMLは変更しない）。
 * href 以外の属性（`data-sb-link-name` 等）は落とさずに残す。
 */
export function replaceLinksInHtml(
  html: string,
  indexes: readonly number[],
  replacement: LinkReplacement,
): string {
  const wanted = new Set(indexes)
  const tags = findAnchorOpenTags(html)
  const href = buildReplacementHref(replacement.href, replacement.tracking)
  let out = html
  for (let i = tags.length - 1; i >= 0; i -= 1) {
    const tag = tags[i]
    if (tag === undefined || !wanted.has(i)) continue
    let attrs = setAttribute(parseAttributes(tag.attrs), 'href', href)
    attrs =
      isTelHref(href) && replacement.tracking
        ? setAttribute(attrs, TRACKING_ATTRIBUTE, 'true')
        : removeAttribute(attrs, TRACKING_ATTRIBUTE)
    attrs = replacement.newTab
      ? setAttribute(attrs, 'target', '_blank')
      : removeAttribute(attrs, 'target')
    out = `${out.slice(0, tag.start)}<a${serializeAttributes(attrs)}>${out.slice(tag.end)}`
  }
  return out
}

/** 実際に置き換わる出現順だけを返す（範囲外の値は数えない） */
export function replaceableIndexes(html: string, indexes: readonly number[]): number[] {
  const count = findAnchorOpenTags(html).length
  const unique = new Set(indexes.filter((i) => Number.isInteger(i) && i >= 0 && i < count))
  return [...unique].sort((a, b) => a - b)
}

/* ────────────────────────────────────────────────────────────
 * フォーム入力 → リクエスト
 * ──────────────────────────────────────────────────────────── */

export interface LinkReplaceFormInput {
  targetType: ReplaceTargetType
  /** チェックした行の出現順（順不同で渡ってよい） */
  selected: readonly number[]
  /** 入力欄 `新規のリンクを入力` の値 */
  url: string
  /** `中間ページリンク` を選んだときに指す中間ページ */
  redirectPageUid: string
  /** チェックボックス `計測機能付きリンクに変更`（既定ON） */
  isTracking: boolean
  /** チェックボックス `リンクを別タブで開く`（既定OFF） */
  isNewTab: boolean
  /** 空ならサーバー側が先頭Versionへ解決する */
  versionUid: string
}

export interface LinkReplaceRequest {
  version_uid: string
  indexes: readonly number[]
  target_type: ReplaceTargetType
  url: string
  redirect_page_uid: string
  tracking: boolean
  new_tab: boolean
}

export type BuildResult<T> = { ok: true; value: T } | { ok: false; message: string }

/**
 * 画面のいまの状態から置換リクエストを組み立てる。
 * ここで弾いた場合の文言は **採取できていない**（実機のエラー表示を見ていない）。
 * クローン独自の文言であることを分かるようにここへ集約している。
 */
export function buildLinkReplaceRequest(
  input: LinkReplaceFormInput,
): BuildResult<LinkReplaceRequest> {
  const indexes = [...new Set(input.selected)].sort((a, b) => a - b)
  if (indexes.length === 0) {
    return { ok: false, message: '置き換えるリンクを選択してください' }
  }
  if (input.targetType === 'redirectPage') {
    if (input.redirectPageUid.trim() === '') {
      return { ok: false, message: '置き換え先の中間ページを選択してください' }
    }
  } else if (!isAllowedLinkUrl(input.url)) {
    return { ok: false, message: '置き換え先のURLを正しく入力してください' }
  }
  return {
    ok: true,
    value: {
      version_uid: input.versionUid,
      indexes,
      target_type: input.targetType,
      url: input.targetType === 'redirectPage' ? '' : input.url.trim(),
      redirect_page_uid: input.targetType === 'redirectPage' ? input.redirectPageUid.trim() : '',
      tracking: input.isTracking,
      new_tab: input.isNewTab,
    },
  }
}

export interface ReplacementUrlInput {
  targetType: ReplaceTargetType
  url: string
  /** 中間ページのURL（見つからなければ null） */
  redirectPageUrl: string | null
}

/** 置換先URLをどちらから採るか。`中間ページリンク` は入力欄ではなく中間ページのURLを使う */
export function pickReplacementUrl(input: ReplacementUrlInput): string | null {
  if (input.targetType === 'redirectPage') {
    const url = input.redirectPageUrl?.trim() ?? ''
    return url === '' ? null : url
  }
  const url = input.url.trim()
  return url === '' ? null : url
}
