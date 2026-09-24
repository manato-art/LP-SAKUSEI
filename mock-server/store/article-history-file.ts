/**
 * 変更・復元履歴のディスク保存（2026-09-24 全体点検3）。
 *
 * 履歴はサーバーのメモリにしか無く、再起動・デプロイ（push のたび）で消えていた。
 * `DATA_DIR` があるとき（本番＝Railway の Volume）だけ `${DATA_DIR}/article-histories.json` へ書き、起動時に読み戻す。
 * State（state.json）とは別のファイルにする（履歴は本文の写しを多く持つので、state.json を重くしない）。
 *
 * 記事の同一性キー（article_key）はプロセスの中だけの印なので、ファイルには記事の uid で持ち、
 * 読み戻すときに今の記事へ付け直す。消えた記事・Versionの分は読み戻さない。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  articleKey,
  onArticleHistoryChange,
  setArticleHistoryState,
  type ArticleHistory,
  type ArticleHistoryState,
} from './article-history.ts'
import type { State } from './types.ts'

interface HistoryFile {
  readonly entries: readonly Omit<ArticleHistory, 'article_key'>[]
  readonly nextId: number
}

/** ファイルの中身を今の記事・Versionに合わせて読み戻す（純粋関数） */
export function historiesFromFile(file: HistoryFile, state: State): ArticleHistoryState {
  const articles = new Map(state.articles.map((a) => [a.uid, a]))
  const versions = new Set(state.versions.map((v) => v.uid))
  const entries: ArticleHistory[] = []
  for (const entry of file.entries) {
    const article = articles.get(entry.article_uid)
    if (article === undefined || !versions.has(entry.version_uid)) continue
    entries.push({ ...entry, article_key: articleKey(article) })
  }
  const maxId = entries.reduce((m, e) => Math.max(m, e.id), 0)
  return { entries, nextId: Math.max(file.nextId, maxId + 1) }
}

/** ファイルに書く形（プロセスの中だけの印 article_key は外す） */
export function historiesToFile(history: ArticleHistoryState): HistoryFile {
  return {
    entries: history.entries.map(({ article_key: _key, ...rest }) => rest),
    nextId: history.nextId,
  }
}

const DATA_DIR = process.env['DATA_DIR']
const FILE = DATA_DIR === undefined || DATA_DIR === '' ? null : join(DATA_DIR, 'article-histories.json')

let timer: ReturnType<typeof setTimeout> | null = null
let pending: ArticleHistoryState | null = null

function flush(): void {
  timer = null
  const history = pending
  pending = null
  if (history === null || FILE === null) return
  try {
    if (DATA_DIR !== undefined && !existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    // 書きかけで落ちても前のファイルが壊れないよう、別名に書いてから置き換える
    const tmp = `${FILE}.tmp`
    writeFileSync(tmp, JSON.stringify(historiesToFile(history)))
    renameSync(tmp, FILE)
  } catch (error) {
    console.error('[history] 変更・復元履歴をファイルに保存できませんでした:', (error as Error).message)
  }
}

/** 起動時に1回呼ぶ: ファイルがあれば読み戻し、以後の変更を（まとめて）書く */
export function startArticleHistoryPersistence(state: State): void {
  if (FILE === null) return
  if (existsSync(FILE)) {
    try {
      const file = JSON.parse(readFileSync(FILE, 'utf8')) as HistoryFile
      const restored = historiesFromFile(file, state)
      setArticleHistoryState(() => restored)
      console.log(`[history] 変更・復元履歴を読み戻しました（${String(restored.entries.length)}件）`)
    } catch (error) {
      // 読めないファイルは消さずに残す（手で確かめられるように）。履歴は空から始める
      console.error('[history] 変更・復元履歴のファイルを読めませんでした:', (error as Error).message)
    }
  }
  onArticleHistoryChange((history) => {
    pending = history
    if (timer === null) timer = setTimeout(flush, 1500)
  })
}
