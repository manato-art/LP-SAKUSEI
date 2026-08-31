/**
 * 実データの持ち込みをモックサーバ側で拒む（企画書 §3 Step0-1）。
 *
 * 「実データを持ち込まない」はコードだけの話ではない。
 * 画面を触って動作確認するときに、つい本物のフォルダ名やページ名を打ち込んでしまうと、
 * ソースには残らないのに実行時の状態には実データが載る。grepゲートはそれを見つけられない。
 * だからサーバ側で入口を塞ぐ。
 *
 * 実名の一覧は .gate-names.local（.gitignore 済み）。gate・scrub と同じファイルを使う。
 */
import { readFileSync, existsSync } from 'node:fs'

/** gate・scrub と共有する実名リスト。 */
export const KNOWN_NAMES_FILE = '.gate-names.local'

/**
 * 実名リストの中身から名前だけを取り出す。
 * `名前 = カテゴリ` の形式にも対応する（カテゴリは捨てる）。
 * 空文字は全ての文字列に一致してしまうので必ず落とす。
 */
export function loadKnownNames(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=')
      return (separator === -1 ? line : line.slice(0, separator)).trim()
    })
    .filter((name) => name !== '')
}

/** ファイルから実名リストを読む。無ければ空（ガードは働かない）。 */
export function readKnownNamesFile(path: string = KNOWN_NAMES_FILE): string[] {
  return existsSync(path) ? loadKnownNames(readFileSync(path, 'utf8')) : []
}

function walkStrings(node: unknown, visit: (text: string) => void): void {
  if (typeof node === 'string') {
    visit(node)
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) walkStrings(item, visit)
    return
  }
  if (node !== null && typeof node === 'object') {
    for (const value of Object.values(node)) walkStrings(value, visit)
  }
}

/**
 * リクエスト本文に実名が含まれていないか調べる。
 * @returns 見つかった実名（重複なし）。空なら問題なし。
 */
export function findRealNames(body: unknown, knownNames: readonly string[]): string[] {
  if (knownNames.length === 0) return []
  const found = new Set<string>()
  walkStrings(body, (text) => {
    for (const name of knownNames) {
      if (text.includes(name)) found.add(name)
    }
  })
  return [...found]
}
