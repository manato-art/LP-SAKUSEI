/**
 * 保存済みの送り先を画面で読むところ（2026-09-15）。
 *
 * 古いサーバーが1件のオブジェクトを返したときに、画面ごと真っ白にならないこと。
 * （実際に「settings.notify is not iterable」で設定画面が丸ごと落ちた）
 */
import { describe, expect, it } from 'vitest'
import { savedTargets } from '../src/app/pages/alert-targets.ts'

describe('保存済みの送り先を読む', () => {
  it('配列はそのまま並びを保つ', () => {
    expect(
      savedTargets([
        { service: 'chatwork', destination_id: '123' },
        { service: 'line', destination_id: '' },
      ]),
    ).toEqual([
      { service: 'chatwork', id: '123' },
      { service: 'line', id: '' },
    ])
  })

  it('古い形（1件のオブジェクト）も1行として読む', () => {
    expect(savedTargets({ service: 'slack', destination_id: 'C1' })).toEqual([
      { service: 'slack', id: 'C1' },
    ])
  })

  it('null・未設定は0行', () => {
    expect(savedTargets(null)).toEqual([])
    expect(savedTargets(undefined)).toEqual([])
    expect(savedTargets([])).toEqual([])
  })

  it('知らないサービスは落とす（選べない行を出さない）', () => {
    expect(savedTargets([{ service: 'email', destination_id: 'x@example.test' }])).toEqual([])
  })

  it('送り先IDが文字列でなければ空として扱う', () => {
    expect(savedTargets([{ service: 'line', destination_id: 12345 }])).toEqual([
      { service: 'line', id: '' },
    ])
  })
})
