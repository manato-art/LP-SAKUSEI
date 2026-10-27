/**
 * Widget一覧の分類を1つの並びにまとめる（2026-10-27 本人の指示⑨・選んでもらったこと「意味の近い分類をまとめる」）。
 * まとめた分類の中は、上に取り込んだ見本（SquadBeyond）・下に自作（オリジナル）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SAMPLE_CATEGORIES } from '../src/app/panels/nocode/samples/kit.ts'
import { SB_MERGE, sbCategoriesFor, sbOnlyCategories } from '../src/app/panels/widget-library-merge.ts'
import type { SbCategory } from '../src/app/panels/widget-library-sb.ts'

/** 取り込んだ見本の分類（配っている一覧そのもの） */
const SB = JSON.parse(readFileSync('mock-server/seed/sb-widgets/categories.json', 'utf8')) as SbCategory[]
const names = (list: readonly SbCategory[]): string[] => list.map((c) => c.name)

describe('取り込んだ見本の分類のまとめ方', () => {
  it('意味の同じ分類は、自作の分類へまとめる（本人に見せた対応のとおり）', () => {
    expect(names(sbCategoriesFor('冒頭・つかみ', SB))).toEqual(['見出し'])
    expect(names(sbCategoriesFor('信頼・実績', SB))).toEqual(['クチコミ'])
    expect(names(sbCategoriesFor('比較・違い', SB))).toEqual(['表'])
    expect(names(sbCategoriesFor('申し込み・CTA', SB))).toEqual(['ボタン'])
    expect(names(sbCategoriesFor('アンケート・診断', SB))).toEqual(['アンケート'])
    expect(names(sbCategoriesFor('文章・区切り', SB))).toEqual(['文字', '区切り線'])
    expect(names(sbCategoriesFor('画像・動画', SB))).toEqual(['画像'])
    expect(names(sbCategoriesFor('フッター・注意書き', SB))).toEqual(['フッター'])
  })

  it('自作だけの分類には、取り込んだ見本を入れない', () => {
    for (const category of ['悩み・共感', '特徴・価値', '説明・使い方', '料金・プラン', 'よくある質問', '限定・急ぎ'] as const) {
      expect(sbCategoriesFor(category, SB), category).toEqual([])
    }
  })

  it('まとめる先の無い取り込んだ見本の分類は、そのまま残す（取り込んだ見本の一覧の順）', () => {
    expect(names(sbOnlyCategories(SB))).toEqual(['囲み枠', '吹き出し', 'アクション', '埋め込み', '自動表示', 'テンプレート記事', 'オリジナル', '分類なし'])
  })

  it('取り込んだ見本の分類は、どれも1か所にだけ出る（まとめた先か、そのままの分類のどちらか）', () => {
    const merged = SAMPLE_CATEGORIES.flatMap((category) => names(sbCategoriesFor(category, SB)))
    const all = [...merged, ...names(sbOnlyCategories(SB))]
    expect(all.sort()).toEqual(names(SB).sort())
    expect(new Set(merged).size).toBe(merged.length)
  })

  it('対応表の名前は、どれも取り込んだ見本の一覧にある（名前が変わったら気づける）', () => {
    for (const list of Object.values(SB_MERGE)) for (const name of list ?? []) expect(names(SB), name).toContain(name)
  })
})
