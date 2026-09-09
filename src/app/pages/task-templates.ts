/**
 * 「新しいタスク」のテンプレート定義。
 *
 * 実物（実物のタスク画面）を開いて、テンプレート4枚と
 * 選んだときに入る初期値をそのまま写したもの（2026-09-09 確認）。
 */

/** スケジュールの種類。実物のプルダウンどおり */
export type ScheduleKind = 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly_first' | 'monthly_last'

export const SCHEDULES: readonly { value: ScheduleKind; label: string }[] = [
  { value: 'once', label: '単発（作成直後に実行）' },
  { value: 'hourly', label: '毎時' },
  { value: 'daily', label: '毎日' },
  { value: 'weekly', label: '曜日を指定' },
  { value: 'monthly_first', label: '毎月1日' },
  { value: 'monthly_last', label: '毎月月末' },
]

/** 実物の分は 15分刻みの4つだけ */
export const MINUTES = ['00', '15', '30', '45'] as const
export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

/** 時の選択が要るスケジュール（毎時は分だけ、単発はどちらも要らない） */
export function needsHour(kind: ScheduleKind): boolean {
  return kind !== 'once' && kind !== 'hourly'
}
export function needsMinute(kind: ScheduleKind): boolean {
  return kind !== 'once'
}

/** 通知に載せるレポートの期間 */
export type ReportSpan = 'today' | 'yesterday' | 'last7days'

export const REPORT_SPANS: readonly { value: ReportSpan; label: string }[] = [
  { value: 'today', label: '本日の成果' },
  { value: 'yesterday', label: '昨日の成果' },
  { value: 'last7days', label: '直近7日間の成果' },
]

export interface TaskTemplate {
  id: string
  title: string
  description: string
  /** カードの右下に出る種別 */
  badge: '定期' | 'スポット' | '自由設定'
  /** 選んだときに入る初期値 */
  preset: {
    name: string
    schedule: ScheduleKind
    hour: string
    minute: string
    /** 送るレポートの期間 */
    span: ReportSpan
  }
}

export const TASK_TEMPLATES: readonly TaskTemplate[] = [
  {
    id: 'weekly-report',
    title: '週次成果まとめレポート',
    description:
      '毎週決まった曜日に、指定した範囲のbeyondページの成果を集計してレポートします。',
    badge: '定期',
    preset: {
      name: '週次成果まとめレポート',
      schedule: 'weekly',
      hour: '09',
      minute: '00',
      span: 'last7days',
    },
  },
  {
    id: 'daily-cv-slack',
    title: 'デイリーCV速報 → Slack',
    description: '毎日決まった時間に、前日のCV結果をまとめてSlackに送ります。',
    badge: '定期',
    preset: {
      name: 'デイリーCV速報',
      schedule: 'daily',
      hour: '08',
      minute: '00',
      span: 'yesterday',
    },
  },
  {
    id: 'bulk-duplicate',
    title: 'ページの一括複製',
    description: '指定したbeyondページをまとめて複製します。複製先のフォルダも指定できます。',
    badge: 'スポット',
    preset: {
      name: 'ページの一括複製',
      schedule: 'once',
      hour: '09',
      minute: '00',
      span: 'today',
    },
  },
  {
    id: 'blank',
    title: '空白から作成',
    description: 'テンプレートを使わず、目的に合わせてゼロから設定します。',
    badge: '自由設定',
    preset: { name: '', schedule: 'once', hour: '09', minute: '00', span: 'today' },
  },
]
