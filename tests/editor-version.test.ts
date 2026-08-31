import { describe, it, expect } from 'vitest'
import { EDITOR_CHOICES } from '../src/app/pages/editor-choices.ts'
import { EDITOR_VERSION_LABELS } from '../src/app/pages/basic-info-form.ts'

/**
 * D-011（全1016ページをAPI走査して確定）:
 *   2 = beyondエディター（1013件） / 3 = HTMLエディター（3件） / 1 = 0件
 * 作成モーダルと基本情報タブで対応が食い違うと、保存した値と表示が合わなくなる。
 */
describe('編集タイプの値は作成モーダルと基本情報タブで一致する', () => {
  it('beyondエディターは 2', () => {
    expect(EDITOR_CHOICES.find((c) => c.label.startsWith('beyond'))?.value).toBe(2)
    expect(EDITOR_VERSION_LABELS[2]).toBe('beyondエディター')
  })

  it('HTMLエディターは 3', () => {
    expect(EDITOR_CHOICES.find((c) => c.label.startsWith('HTML'))?.value).toBe(3)
    expect(EDITOR_VERSION_LABELS[3]).toBe('HTMLエディター')
  })

  it('作成モーダルの選択肢は実物と同じ3つ・同じ並び', () => {
    expect(EDITOR_CHOICES.map((c) => c.label)).toEqual([
      'スワイプLPエディター（β）',
      'beyondエディター',
      'HTMLエディター',
    ])
  })

  it('スワイプLPエディターの値は未観測なので、保存できる値を持たせない', () => {
    expect(EDITOR_CHOICES.find((c) => c.label.startsWith('スワイプ'))?.value).toBeNull()
  })

  it('選択肢の値は基本情報タブの表示名と必ず対応する（未観測のものを除く）', () => {
    for (const choice of EDITOR_CHOICES) {
      if (choice.value === null) continue
      expect(EDITOR_VERSION_LABELS[choice.value]).toBe(choice.label)
    }
  })
})
