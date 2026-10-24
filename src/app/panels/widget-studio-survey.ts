/**
 * Widget編集の「まとまった型」の「アンケート」を押したとき（2026-10-24 本人の選択「Widget編集に『アンケート』の型」）。
 * 「回答をはじめる」ボタンのあり・なしを選んでもらい（本人の選択「選ぶ」）、アンケートの中身（nocode/templates/survey.ts）を返す。
 * もう部品があるときは、置き換える前に確かめる（「戻す」で戻せる）。やめたら null。
 */
import { chooseCard, confirmCard } from '../dialog.ts'
import { surveyData } from './nocode/templates/survey.ts'
import type { TemplateData } from './nocode/templates/types.ts'

export async function askSurveyData(hasParts: boolean): Promise<TemplateData | null> {
  const start = await chooseCard({
    title: 'アンケートを作ります',
    message: '最初に「回答をはじめる」ボタンを置きますか？（あとから画面ごと消すこともできます）',
    options: [
      { value: 'button', label: '「回答をはじめる」ボタンから始める', hint: 'ボタンを押すと、その下に Q1 が出ます' },
      { value: 'direct', label: 'すぐ Q1 から始める', hint: 'ボタンなしで、最初から Q1 が見えています' },
    ],
  })
  if (start === null) return null
  if (hasParts) {
    const ok = await confirmCard({
      title: '今の中身をアンケートにしますか？',
      message: 'このWidgetの部品は、アンケートの画面（Q1〜Q3・結果）に置き換わります。',
      detail: '左上の「戻す」で元に戻せます。',
      submitLabel: 'アンケートにする',
    })
    if (!ok) return null
  }
  return surveyData(new Date(), { startButton: start === 'button' })
}
