/**
 * 画面のコードは1つのファイルにまとめる（あとから読む部品を作らない）。
 *
 * 2026-10-24 本人「全部の種類で種類選択しても何も出ない」（ライブラリが「見本を読み込めませんでした」）。
 * 見本の一覧だけ、ライブラリを開いたときに別のファイル（samples-<名前>.js）を読んでいた。
 * 本番を更新するとそのファイルの名前が変わり、前のファイルは無くなる → 更新の前から開いていた画面は、
 * もう無い名前を読みに行って失敗していた（ライブラリを開き直しても直らない）。
 * あとから読むファイルが無ければ、更新の前から開いている画面も困らない。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.ts$/.test(name) ? [path] : []
  })
}

describe('あとから読むファイルを作らない', () => {
  it('画面のコードに、自分のファイルをあとから読む import(...) が無い', () => {
    const lazy = sourceFiles('src').filter((path) => /\bimport\(\s*['"`]\./.test(readFileSync(path, 'utf8')))
    expect(lazy).toEqual([])
  })
})
