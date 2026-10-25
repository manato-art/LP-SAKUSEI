import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { NEW_PAGE_EDITOR_VERSION } from '../src/app/pages/editor-choices.ts'
import { EDITOR_VERSION_LABELS } from '../src/app/pages/basic-info-form.ts'

/**
 * D-011（全1016ページをAPI走査して確定）:
 *   2 = beyondエディター（1013件） / 3 = HTMLエディター（3件） / 1 = 0件
 * 作成モーダルと基本情報タブで対応が食い違うと、保存した値と表示が合わなくなる。
 *
 * 2026-10-25 本人「beyondエディターって書いてるのしか今選択できないから他の二個いらない。
 * あと選択じゃなくて、そもそもそれに移行するようにしてほしい」→ 作成モーダルのエディターの選択をなくし、
 * いつも beyondエディターで作る。
 */
describe('新しいページは beyondエディターで作る', () => {
  it('作る値は 2（基本情報タブでは beyondエディター）', () => {
    expect(NEW_PAGE_EDITOR_VERSION).toBe(2)
    expect(EDITOR_VERSION_LABELS[2]).toBe('beyondエディター')
    expect(EDITOR_VERSION_LABELS[3]).toBe('HTMLエディター')
  })

  it('作成モーダルにエディターの選択は出さない（ページ名・広告媒体の2つ）', () => {
    const source = readFileSync('src/app/pages/folders-create.ts', 'utf8')
    expect(source).not.toContain('エディターを選択')
    expect(source).not.toContain("type = 'radio'")
    expect(source).toContain("field('1. ページ名'")
    expect(source).toContain("field('2. 広告媒体（必須）'")
    expect(source).toContain('editor_version: NEW_PAGE_EDITOR_VERSION')
  })
})
