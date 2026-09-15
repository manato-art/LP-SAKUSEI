/**
 * 匿名化がどのファイルを「文字列として」扱うかの一覧。
 *
 * ここを1か所にまとめる理由: 2026-09-15 に、URL形の実IDを探す走査だけが
 * `.json` を対象外にしていて、`api-urls.json` にしか出てこない数字のID
 * （APIのURLに入る `ab_tests` の数字ID）が辞書に載らず素通りした。
 * 「置換する対象」と「IDを探す対象」がズレると必ずこの事故が起きる。
 */
import { extname } from 'node:path'

/** 中身が文字列そのもののファイル。丸ごと置換をかける。 */
export const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  '.html', '.htm', '.css', '.js', '.txt', '.md', '.har', '.svg',
])

/** 構造を保ったまま値だけ置換するファイル。 */
export const JSON_EXTENSIONS: ReadonlySet<string> = new Set(['.json'])

export function isTextFile(file: string): boolean {
  return TEXT_EXTENSIONS.has(extname(file))
}

export function isJsonFile(file: string): boolean {
  return JSON_EXTENSIONS.has(extname(file))
}

/**
 * URLの形をした実IDを探す対象か。
 * 置換をかけるファイル（テキスト＋JSON）は、そのまま探索の対象でもある。
 */
export function scansUrlIdentifiers(file: string): boolean {
  return isTextFile(file) || isJsonFile(file)
}
