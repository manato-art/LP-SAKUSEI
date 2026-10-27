/**
 * ノーコードWidgetの計測のスイッチの名前は「計測リンクにする」にそろえる（2026-10-27 本人
 * 「ノーコードWidgetのスイッチも計測リンクにするにそろえて」。文字の「リンクを設定」と同じ名前）。
 * 入れ子（くり返す項目・部品を積んで作るの部品）の中のスイッチも含めて全部見る。
 */
import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '../src/app/panels/nocode/templates/index.ts'
import { BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import type { Field } from '../src/app/panels/nocode/templates/types.ts'

function trackLabels(fields: readonly Field[]): string[] {
  return fields.flatMap((field) => {
    if (field.kind === 'list') return trackLabels(field.fields)
    if (field.kind === 'screens') return field.types.flatMap((type) => trackLabels(type.fields))
    return field.kind === 'toggle' && field.key === 'track' ? [field.label] : []
  })
}

describe('ノーコードWidgetの計測のスイッチ', () => {
  it('名前はどこでも「計測リンクにする」', () => {
    // 「部品を積んで作る」は一覧（TEMPLATES）とは別に持っている
    const labels = [...TEMPLATES, BUILDER_TEMPLATE].flatMap((template) => trackLabels(template.fields))
    expect(labels.length).toBeGreaterThanOrEqual(5)
    expect([...new Set(labels)]).toEqual(['計測リンクにする'])
  })
})
