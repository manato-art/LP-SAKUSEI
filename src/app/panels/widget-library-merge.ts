/**
 * Widget一覧の分類を、取り込んだ見本（SquadBeyond の分類）と自作の見本（種類でしぼる）で1つの並びにまとめる
 * （2026-10-27 本人の指示⑨「カテゴリーが既にあったものとスクワットで分かれているのでまとめてそれぞれのカテゴリーに入れて欲しい。
 * 上 スクワット・オリジナル という積み重ねで」→ 選んでもらったこと「意味の近い分類をまとめる」）。
 *
 * - 意味の同じ分類は1つにまとめ、その中は上に取り込んだ見本・下に自作（オリジナル）
 * - 対応する物が無い分類はそのまま。自作だけの分類は今までの場所、取り込んだ見本だけの分類はそのあとに並べる
 *
 * 画面を使わない（テストから読めるように）。
 */
import type { SampleCategory } from './nocode/samples/kit.ts'
import type { SbCategory } from './widget-library-sb.ts'

/** 自作の分類ごとに、まとめる取り込んだ見本の分類（名前・この順に上から出す） */
export const SB_MERGE: Readonly<Partial<Record<SampleCategory, readonly string[]>>> = {
  '冒頭・つかみ': ['見出し'],
  '信頼・実績': ['クチコミ'],
  '比較・違い': ['表'],
  '申し込み・CTA': ['ボタン'],
  'アンケート・診断': ['アンケート'],
  '文章・区切り': ['文字', '区切り線'],
  '画像・動画': ['画像'],
  'フッター・注意書き': ['フッター'],
}

const MERGED_NAMES: ReadonlySet<string> = new Set(Object.values(SB_MERGE).flat())

/** 自作の分類にまとめる、取り込んだ見本の分類（SB_MERGE の順。一覧に無い名前は飛ばす） */
export function sbCategoriesFor(category: SampleCategory, categories: readonly SbCategory[]): readonly SbCategory[] {
  return (SB_MERGE[category] ?? []).flatMap((name) => categories.filter((c) => c.name === name))
}

/** まとめる先の無い、取り込んだ見本だけの分類（取り込んだ見本の一覧の順のまま） */
export function sbOnlyCategories(categories: readonly SbCategory[]): readonly SbCategory[] {
  return categories.filter((c) => !MERGED_NAMES.has(c.name))
}
