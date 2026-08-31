/**
 * 変更・復元履歴（右レール2番目「変更・復元履歴」→ パネル `バージョン復元`）のデータ。
 *
 * 実機観測（docs/findings-live-observation.md）:
 *   ヘッダ `バージョン復元` + `戻る` / リストは「日時 + 現行版」/ ラジオで1件選ぶ。
 *   日時書式は **ゼロ埋めなし**（例 `2026-8-31 19:41:39`）。
 *
 * 置き場所について:
 *   `State`（store/types.ts）は本タスクで触ってはいけない共有ファイルなので、
 *   履歴ログだけを **同じイミュータブル規約**（企画書 §12）でこのモジュールに持つ。
 *   スナップショットの復元先（Version.html/css）の更新は store の setState を使う。
 */
import type { Article, State } from './types.ts'

export interface ArticleHistory {
  id: number
  /** どの記事の「どの世代」か。reset をまたいだ取り違えを防ぐ複合キー */
  article_key: string
  article_uid: string
  version_uid: string
  html: string
  css: string
  /** UNIX秒（実APIの created_at/updated_at と同じ単位） */
  recorded_at: number
}

export interface ArticleHistoryState {
  readonly entries: readonly ArticleHistory[]
  readonly nextId: number
}

const EMPTY_HISTORY_STATE: ArticleHistoryState = { entries: [], nextId: 1 }

let current: ArticleHistoryState = EMPTY_HISTORY_STATE

export function getArticleHistoryState(): ArticleHistoryState {
  return current
}

/** updater は既存 State を破壊してはならない（常に新しいオブジェクト/配列を返す） */
export function setArticleHistoryState(
  updater: (state: ArticleHistoryState) => ArticleHistoryState,
): ArticleHistoryState {
  const next = updater(current)
  if (next === current) return current
  current = next
  return current
}

export function resetArticleHistories(): void {
  current = EMPTY_HISTORY_STATE
}

/**
 * 記事の同一性キー。
 *
 * uid や id では足りない: `/__mock/reset` 後に作り直された記事は uid も id も同じ
 * （どちらも決定論採番）になるため、リセット前の履歴が別物の記事にぶら下がって見えてしまう。
 * State はイミュータブルだが Article オブジェクトは作成〜削除まで差し替えられない
 * （actions.ts が触るのは追加と削除だけ）ので、**オブジェクトの同一性**を世代の印にする。
 */
const ARTICLE_KEYS = new WeakMap<Article, string>()
let keySequence = 0

export function articleKey(article: Article): string {
  const existing = ARTICLE_KEYS.get(article)
  if (existing !== undefined) return existing
  keySequence += 1
  const key = `${article.uid}@${keySequence}`
  ARTICLE_KEYS.set(article, key)
  return key
}

/** いま実在する記事のキー集合（消えた記事の履歴を捨てるために使う） */
export function liveArticleKeys(state: State): ReadonlySet<string> {
  return new Set(state.articles.map(articleKey))
}

/** 実在しない記事（削除済み・reset前の世代）の履歴を捨てる */
export function pruneArticleHistories(state: State): ArticleHistoryState {
  const live = liveArticleKeys(state)
  return setArticleHistoryState((history) => {
    const entries = history.entries.filter((e) => live.has(e.article_key))
    return entries.length === history.entries.length ? history : { ...history, entries }
  })
}

/** 記事の履歴を古い順に返す */
export function historiesOf(
  history: ArticleHistoryState,
  key: string,
): readonly ArticleHistory[] {
  return history.entries.filter((e) => e.article_key === key)
}

/** その記事の最新スナップショット（＝`現行版`） */
export function currentHistoryOf(
  history: ArticleHistoryState,
  key: string,
): ArticleHistory | undefined {
  return historiesOf(history, key).at(-1)
}

export interface AppendHistoryInput {
  article_key: string
  article_uid: string
  version_uid: string
  html: string
  css: string
  recorded_at: number
}

/**
 * スナップショットを1件積む。
 * 直前と内容が同じなら積まない（同じ日時の行が延々並ぶのを防ぐ）。
 */
export function appendArticleHistory(
  history: ArticleHistoryState,
  input: AppendHistoryInput,
): { state: ArticleHistoryState; history: ArticleHistory; recorded: boolean } {
  const latest = currentHistoryOf(history, input.article_key)
  if (latest !== undefined && latest.html === input.html && latest.css === input.css) {
    return { state: history, history: latest, recorded: false }
  }
  const entry: ArticleHistory = { id: history.nextId, ...input }
  return {
    state: { entries: [...history.entries, entry], nextId: history.nextId + 1 },
    history: entry,
    recorded: true,
  }
}

/**
 * 実機の日時書式（`2026-8-31 19:41:39`）。年/月/日/時はゼロ埋めしない。
 * 分・秒のゼロ埋めは `toLocaleString('ja-JP')` と同じ挙動に合わせている。
 * 実機で「時」が1桁になるケースは採取できていないため、そこだけ推定（ja-JP準拠）。
 */
export function formatHistoryTimestamp(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ` +
    `${d.getHours()}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}
