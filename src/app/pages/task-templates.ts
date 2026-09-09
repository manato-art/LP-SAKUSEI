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
    prompt: string
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
      prompt: [
        '先週(月曜〜日曜)の成果をまとめてレポートしてください。',
        '',
        '対象: (ここに対象のフォルダ名を書いてください。例: 「◯◯案件」フォルダ)',
        '',
        '手順:',
        '1. 対象フォルダのレポートを取得し、主要KPI(セッション数・CV数・CVR)を集計する',
        '2. 前週と比較し、大きく変動したbeyondページがあれば要因を分析する',
        '3. 「主要指標(前週比) → ハイライト → 気になる点」の順に、見出し付きで簡潔にまとめる',
      ].join('\n'),
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
      prompt: [
        '昨日のCV結果を速報としてまとめてください。',
        '',
        '出力は装飾のないプレーンテキストのみとする。' +
          'Markdown記法（表・見出し・太字・箇条書き記号の * や - など）は使わない。',
        '',
        '対象: (ここに対象のフォルダ名を書いてください)',
        '',
        '手順:',
        '1. 最初に「対象日 = 昨日」「前日」の日付(JST)を導出し、冒頭に明記する',
        '2. 対象フォルダのレポートを 前日〜対象日 で取得する（複数ページある場合は全ページ取得する）',
        '3. ページ別の一覧を、1行1ページで次の形式にまとめる',
        '   順位. ページ名（フォルダ名）: 対象日 CV X件 / CLICK C件 / CTR a% / CVR b% ・ 前日 CV Y件 (Y→X, 差分)',
      ].join('\n'),
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
      prompt: [
        '以下のbeyondページを複製してください。',
        '',
        '複製するbeyondページ: (beyondページの UID を列挙してください。URL でも指定できます)',
        '複製先フォルダ: (フォルダ名を書いてください。未記入の場合は元のフォルダに複製します)',
        '',
        '注意: 1つのタスクで複製できるのは10件程度までです。それ以上は複数のタスクに分けてください。',
      ].join('\n'),
    },
  },
  {
    id: 'blank',
    title: '空白から作成',
    description: 'テンプレートを使わず、目的に合わせてゼロから設定します。',
    badge: '自由設定',
    preset: { name: '', schedule: 'once', hour: '09', minute: '00', prompt: '' },
  },
]
