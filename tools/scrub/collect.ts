/**
 * 置換辞書を組み立てる（どのファイルから何を拾うか）。
 *
 * CLI（index.ts）から切り出してあるのは、ここが一番間違えやすいから。
 * 実際に2つの事故を起こした:
 *  - URL形のIDを探す走査だけが `.json` を見ていなくて、`api-urls.json` にしか
 *    出てこない数字のIDが素通りした。
 *  - `meta.json` の `title`（＝ブラウザのページタイトル＝製品名）を施策名として
 *    拾ってしまい、画面じゅうの製品名が「サンプル施策237」に化けた。
 */
import { basename } from 'node:path'
import { collectFromJson, collectUrlIdentifiers, type ScrubMap } from './dictionary.ts'
import { isJsonFile, scansUrlIdentifiers } from './scan-targets.ts'

/**
 * 採取ツール自身が書く記録か。
 * 中身は URL・ページタイトル・採取時刻で、ユーザーデータの手がかりではない。
 */
export function isCaptureMetadata(file: string): boolean {
  return basename(file) === 'meta.json'
}

/**
 * ファイル一覧から辞書を作る。
 *
 * @param readFile 中身の取り出し方（テストでは実ファイルを作らずに差し替える）
 * @param routeWords ルートの固定語。実IDと見分けるために使う。
 */
export function buildCollectedMap(
  files: readonly string[],
  readFile: (file: string) => string,
  routeWords: readonly string[],
): ScrubMap {
  const collected: ScrubMap = {}
  // 1) fixtures(JSON) のフィールド名を手がかりに literal を集める
  for (const file of files) {
    if (!isJsonFile(file) || isCaptureMetadata(file)) continue
    try {
      collectFromJson(JSON.parse(readFile(file)), collected)
    } catch (error) {
      console.warn(`[scrub] JSON解析に失敗（スキップ）: ${file}: ${(error as Error).message}`)
    }
  }
  // 2) fixtures を採っていないページのIDは辞書に載らない。
  //    本文を走査し、URLの形（/ab_tests/<id> 等）から実IDを拾う。
  //    meta.json もここでは対象（リンク先の実IDは潰す必要がある）。
  for (const file of files) {
    if (!scansUrlIdentifiers(file)) continue
    collectUrlIdentifiers(readFile(file), collected, routeWords)
  }
  return collected
}
