/**
 * Widget編集の「まとまった型」の「アンケート」を押したとき（2026-10-24 本人の選択「Widget編集に『アンケート』の型」）。
 * 「回答をはじめる」ボタンのあり・なしを選んでもらい（本人の選択「選ぶ」）、アンケートの中身（nocode/templates/survey.ts）を返す。
 * もう部品があるときは、置き換える前に確かめる（「戻す」で戻せる）。やめたら null。
 */
import { chooseCard, confirmCard } from '../dialog.ts'
import { extractBuilderData } from './nocode/builder-data.ts'
import { surveyData } from './nocode/templates/survey.ts'
import type { TemplateData } from './nocode/templates/types.ts'

/** 今の部品を置き換えてよいか確かめる（「戻す」で戻せる） */
function confirmReplace(title: string, message: string, submitLabel: string): Promise<boolean> {
  return confirmCard({ title, message, detail: '左上の「戻す」で元に戻せます。', submitLabel })
}

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
    const ok = await confirmReplace(
      '今の中身をアンケートにしますか？',
      'このWidgetの部品は、アンケートの画面（Q1〜Q3・結果）に置き換わります。',
      'アンケートにする',
    )
    if (!ok) return null
  }
  return surveyData(new Date(), { startButton: start === 'button' })
}

/**
 * ライブラリのアンケート（部品で作ったWidgetそのものの見本・nocode/library-surveys.ts）を Widget編集で選んだとき
 * （2026-10-24 本人「ここにも反映してほしい」）。部品の1つにせず、Widget の中身ごと置き換える。
 * もう部品があるときは確かめる。やめたら null。中身が読めない見本は失敗として返す（呼ぶ側が知らせる）
 */
export async function askWholeSample(sample: { readonly title: string; readonly html: string }, hasParts: boolean): Promise<TemplateData | null> {
  const found = extractBuilderData(sample.html)
  if (found === null) throw new Error(`「${sample.title}」の中身を読めませんでした`)
  if (hasParts) {
    const ok = await confirmReplace(
      `今の中身を「${sample.title}」にしますか？`,
      'このWidgetの部品は、選んだアンケートの画面に置き換わります。',
      '置き換える',
    )
    if (!ok) return null
  }
  return found.data
}
