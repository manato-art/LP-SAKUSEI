import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  MINUTES,
  SCHEDULES,
  TASK_TEMPLATES,
  WEEKDAYS,
  needsHour,
  needsMinute,
} from '../src/app/pages/task-templates.ts'

/**
 * 「新しいタスク」の挙動。
 *
 * 実物（app.squadbeyond.com/tasks・2026-09-09 確認）は
 * モーダルではなく、一覧の中身がテンプレート選択→設定フォームへ差し替わる。
 */
describe('テンプレートは実物どおり', () => {
  it('4枚をこの順で出す', () => {
    expect(TASK_TEMPLATES.map((t) => t.title)).toEqual([
      '週次成果まとめレポート',
      'デイリーCV速報 → Slack',
      'ページの一括複製',
      '空白から作成',
    ])
  })

  it('種別バッジも実物どおり', () => {
    expect(TASK_TEMPLATES.map((t) => t.badge)).toEqual(['定期', '定期', 'スポット', '自由設定'])
  })

  it('選ぶと初期値が入る（空白だけは空のまま）', () => {
    const weekly = TASK_TEMPLATES[0]
    expect(weekly?.preset.name).toBe('週次成果まとめレポート')
    expect(weekly?.preset.schedule).toBe('weekly')
    expect(weekly?.preset.hour).toBe('09')
    expect(weekly?.preset.span).toBe('last7days')

    const daily = TASK_TEMPLATES[1]
    expect(daily?.preset.name).toBe('デイリーCV速報')
    expect(daily?.preset.schedule).toBe('daily')
    expect(daily?.preset.hour).toBe('08')

    const bulk = TASK_TEMPLATES[2]
    expect(bulk?.preset.schedule).toBe('once')

    const blank = TASK_TEMPLATES[3]
    expect(blank?.preset.name).toBe('')
    expect(blank?.preset.schedule).toBe('once')
  })
})

describe('スケジュールの選択肢', () => {
  it('実物のプルダウンどおり6種類', () => {
    expect(SCHEDULES.map((s) => s.label)).toEqual([
      '単発（作成直後に実行）',
      '毎時',
      '毎日',
      '曜日を指定',
      '毎月1日',
      '毎月月末',
    ])
  })

  it('分は15分刻みの4つだけ', () => {
    expect([...MINUTES]).toEqual(['00', '15', '30', '45'])
  })

  it('曜日は日曜始まり', () => {
    expect([...WEEKDAYS]).toEqual(['日', '月', '火', '水', '木', '金', '土'])
  })

  it('単発は時も分も要らない', () => {
    expect(needsHour('once')).toBe(false)
    expect(needsMinute('once')).toBe(false)
  })

  it('毎時は分だけ（時は要らない）', () => {
    expect(needsHour('hourly')).toBe(false)
    expect(needsMinute('hourly')).toBe(true)
  })

  it('毎日・曜日指定・毎月は時と分の両方', () => {
    for (const kind of ['daily', 'weekly', 'monthly_first', 'monthly_last'] as const) {
      expect(needsHour(kind), kind).toBe(true)
      expect(needsMinute(kind), kind).toBe(true)
    }
  })
})

describe('画面の作りは実物に合わせる', () => {
  const create = readFileSync('src/app/pages/task-create.ts', 'utf8')
  const tasks = readFileSync('src/app/pages/tasks.ts', 'utf8')

  it('モーダルではなく一覧の中身を差し替える', () => {
    expect(tasks).toContain('renderTemplatePicker(container')
    // 旧実装のオーバーレイは残っていない
    expect(tasks).not.toContain('openCreateTaskDialog')
    expect(create).not.toContain('position:fixed;inset:0')
  })

  it('各段に戻るリンクを置く', () => {
    expect(create).toContain('タスク一覧に戻る')
    expect(create).toContain('テンプレート選択に戻る')
  })

  it('実物と同じ項目を並べる', () => {
    for (const label of [
      'タスク名',
      'スケジュール',
      // 実物は「実行結果のSlack通知」。チャットワークも選べるようにしたので
      // ここだけサービス名を外している。
      '実行結果の通知',
      // beyondAI が当システムに無いので、プロンプトの代わりに
      // 「何のレポートを送るか」を選ばせる。
      'レポート内容',
      '説明',
      'タスクを作成',
    ]) {
      expect(create, label).toContain(label)
    }
  })

  it('実物と同じ入力の案内文を使う', () => {
    expect(create).toContain('例: 週次レポート')
    expect(create).toContain('タスクの概要')
  })

  it('必須の項目が空のまま作成させない', () => {
    expect(create).toContain('タスク名を入力してください')
    expect(create).toContain('曜日を1つ以上選んでください')
  })

  it('beyondAIのプロンプト欄は置かない（当システムにbeyondAIが無いため）', () => {
    expect(create).not.toContain('AIへの指示内容')
  })
})
