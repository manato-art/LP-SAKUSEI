/**
 * 画面に、作る側の言葉を出さない（2026-10-13 本人が選んだ: 「※クローン…」の部分だけ消し、説明は残す）。
 *
 * このシステムは実物（SquadBeyond）の画面を写して作ったので、作っている間の注意書き
 * 「※クローンが自作した画面です」「数値はモックの集計です」「値が未観測のため選べません」などが
 * 使う人の画面に残っていた。使う人には「クローン」「実物」「モック」「未観測」が何のことか分からず、
 * ダッシュボードの数字は本物の計測なのに「モック（見本）」と書いてあった。
 *
 * コメントに書くのはかまわない（コードを読む人向け）。画面に出る文字だけを見張る。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** 画面に出していた、作る側の言い回し */
const MAKER_PHRASES = [
  'クローンが自作した画面',
  '実物とは見た目が異なる',
  'モックの集計',
  'モックのbeyondページ',
  '列構成は実物に合わせて',
  '値が未観測',
  '今回のクローンでは未実装',
  // 2026-10-13 2回目（最初の数え方で漏れていたぶん）
  '実物にはありません',
  '（実物と同じ）',
  'クローン内保存',
  'クローン注記',
  '採取マークアップを確認',
  'この画面はまだ作っていません',
  '作成フローを先に作っています',
] as const

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return path.endsWith('.ts') ? [path] : []
  })
}

/** コメントだけの行（`//`・`*`・`/*` で始まる行）を除いた行 */
function codeLines(path: string): { path: string; line: number; text: string }[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((text, index) => ({ path, line: index + 1, text }))
    .filter(({ text }) => !/^\s*(\/\/|\*|\/\*)/.test(text))
}

describe('画面に作る側の言葉を出さない', () => {
  it('src/app の画面の文字に、作る側の言い回しが無い', () => {
    const hits = sourceFiles('src/app')
      .flatMap(codeLines)
      .filter(({ text }) => MAKER_PHRASES.some((phrase) => text.includes(phrase)))
      .map(({ path, line, text }) => `${path}:${line} ${text.trim()}`)

    expect(hits).toEqual([])
  })

})
