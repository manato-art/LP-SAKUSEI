/**
 * 「タグ設定」モーダル（右レール6番・`HtmlSettingModal`）の状態。
 *
 * 実APIでは Article の `html_tags: [{tag, document_property, body}]` に対応する
 * （docs/findings-live-observation.md「Article の実フィールド」）。
 *
 * **なぜ types.ts に足さないか**: types.ts は他の担当と共有しているファイルなので触らない。
 * ここでは `State` を「拡張スライス」として持ち、読み書きをこのファイルに閉じ込める。
 * 配線担当が types.ts をまとめる段で `State.htmlTags` へ昇格させればこのファイルの
 * キャストは消える（それ以外の呼び出し側は変更不要）。
 */
import type { State } from './types.ts'

/** タグを差し込む先。実APIの `document_property`（head / body） */
export type HtmlTagDocumentProperty = 'head' | 'body'

export const HTML_TAG_DOCUMENT_PROPERTIES: readonly HtmlTagDocumentProperty[] = ['head', 'body']

/**
 * 個別設定のタグ1件。
 * - `tag`: タグ種別。モーダルの「JavaScript head / JavaScript body」は `script`。
 * - `document_property`: 差し込み先（head / body）
 * - `body`: 貼り付けたコード全文（`<script> ... </script>` を含む生テキスト）
 *
 * ※ フィールド名は実APIの実測。各値の意味づけは推定（実物のレスポンス本体は未採取）。
 */
export interface HtmlTag {
  tag: string
  document_property: HtmlTagDocumentProperty
  body: string
}

/** 1記事ぶんのタグ設定 */
export interface ArticleHtmlSetting {
  article_uid: string
  /** メタタグ設定「noindexを含める」。実機の既定はON（実機観測） */
  noindex: boolean
  html_tags: readonly HtmlTag[]
}

/** 実機観測: 「noindexを含める」トグルの既定はON */
export const DEFAULT_NOINDEX = true

/** types.ts を触らずに State を拡張するためのスライス（上のコメント参照） */
type StateWithHtmlTags = State & { readonly htmlTags?: readonly ArticleHtmlSetting[] }

function slice(state: State): readonly ArticleHtmlSetting[] {
  return (state as StateWithHtmlTags).htmlTags ?? []
}

export function emptyHtmlSetting(articleUid: string): ArticleHtmlSetting {
  return { article_uid: articleUid, noindex: DEFAULT_NOINDEX, html_tags: [] }
}

/** 未保存の記事は既定値（noindex ON・タグ無し）を返す */
export function getHtmlSetting(state: State, articleUid: string): ArticleHtmlSetting {
  return slice(state).find((s) => s.article_uid === articleUid) ?? emptyHtmlSetting(articleUid)
}

/**
 * タグ設定を差し替えた**新しい State** を返す（§12 イミュータブル）。
 * 既存の State / 配列 / 要素は一切書き換えない。
 */
export function setHtmlSetting(
  state: State,
  articleUid: string,
  patch: Partial<Pick<ArticleHtmlSetting, 'noindex' | 'html_tags'>>,
): State {
  const next: ArticleHtmlSetting = { ...getHtmlSetting(state, articleUid), ...patch }
  const others = slice(state).filter((s) => s.article_uid !== articleUid)
  const merged: StateWithHtmlTags = { ...state, htmlTags: [...others, next] }
  return merged
}

/** 終了タグを持たない要素（HTML仕様のvoid要素） */
const VOID_ELEMENTS: ReadonlySet<string> = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

/** 中身がタグとして解釈されない要素 */
const RAW_TEXT_ELEMENTS: ReadonlySet<string> = new Set(['script', 'style'])

/**
 * 閉じられていないタグを探す。
 *
 * 実CSSに `.…_alert_… ._scriptModalFormTitle_…::after { content: " タグが正しく閉じられてません。" }`
 * という状態が焼き込まれている（capture/clean/.../tool-tag-settings/cssom.css）ので、
 * 実物にも同種の検査がある。ここではその状態を再現できる最小の検査を置く。
 *
 * @returns 問題のあったタグ名。問題が無ければ null。
 */
export function findUnclosedTag(source: string): string | null {
  // コメントの中身はタグとして数えない
  const src = source.replace(/<!--[\s\S]*?-->/g, '')
  const lower = src.toLowerCase()
  const open: string[] = []
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g

  let match = tagPattern.exec(src)
  while (match !== null) {
    const name = (match[2] ?? '').toLowerCase()
    const isClosing = match[1] === '/'
    const isSelfClosing = match[3] === '/'

    if (isClosing) {
      if (open.pop() !== name) return name
    } else if (!isSelfClosing && !VOID_ELEMENTS.has(name)) {
      if (RAW_TEXT_ELEMENTS.has(name)) {
        // script / style の中身は生テキスト。`a < b` などをタグと誤認しないよう読み飛ばす。
        const closeAt = lower.indexOf(`</${name}`, tagPattern.lastIndex)
        if (closeAt < 0) return name
        open.push(name)
        tagPattern.lastIndex = closeAt
      } else {
        open.push(name)
      }
    }
    match = tagPattern.exec(src)
  }
  return open.length === 0 ? null : (open[open.length - 1] ?? null)
}
