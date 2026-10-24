/**
 * Widgetライブラリの「アンケート・診断」に出す、Widget編集の「アンケート」の型（2026-10-24 本人「あなたが今作った
 * アンケート結構いいから、ここにも反映してほしい」）。
 *
 * samples/ の見本（見本の部品になる形）とは違い、部品で作ったWidgetそのもの（設定データつき）にする。
 * そのため LPに入れてから開いても、「画面を作って使う」から開いても、部品のまま直せる（進み具合も自動で並び直す）。
 * Widget編集の「ライブラリの見本から選ぶ」で選んだときは、部品の1つにせず Widget の中身ごと置き換える（isWholeWidget）。
 *
 * 型と同じく「回答をはじめる」ボタンから／すぐ Q1 から の2本。アンケート・診断の先頭に並べる。
 */
import { embedBuilderData } from './builder-data.ts'
import { NEW_SAMPLES } from './samples/index.ts'
import type { NewSample } from './samples/kit.ts'
import { BUILDER_TEMPLATE } from './templates/builder.ts'
import { surveyData } from './templates/survey.ts'

/** 中身を作る日（日付は中身に出ない。書き出しを毎回同じにするため決めておく） */
const MADE_AT = new Date('2026-10-24T00:00:00+09:00')

function surveySample(id: string, uid: string, startButton: boolean, name: string, summary: string): NewSample {
  const data = surveyData(MADE_AT, { startButton })
  return {
    id,
    category: 'アンケート・診断',
    name,
    summary,
    html: embedBuilderData(BUILDER_TEMPLATE.render(data, uid), data),
    isWholeWidget: true,
  }
}

export const SURVEY_SAMPLES: readonly NewSample[] = [
  surveySample(
    'survey-stack-start',
    'nc-svst0001',
    true,
    'アンケート（回答をはじめるボタンから）',
    '答えると次の質問が下に出る。答えで結果が分かれる。部品のまま直せる',
  ),
  surveySample(
    'survey-stack',
    'nc-svst0002',
    false,
    'アンケート（すぐ Q1 から）',
    '最初から Q1 が見えている形。答えると次の質問が下に出る',
  ),
]

/** ライブラリの「アンケート・診断」の先頭（アンケート・診断のいちばん前）に足す */
const at = NEW_SAMPLES.findIndex((sample) => sample.category === 'アンケート・診断')

/** ライブラリに並べる見本の全部（samples/ の見本＋アンケートの型） */
export const LIBRARY_SAMPLES: readonly NewSample[] =
  at < 0 ? [...NEW_SAMPLES, ...SURVEY_SAMPLES] : [...NEW_SAMPLES.slice(0, at), ...SURVEY_SAMPLES, ...NEW_SAMPLES.slice(at)]

/** アンケートの型の見本の名前（お気に入りから選んだときも中身ごと置き換えるため） */
export const WHOLE_SAMPLE_NAMES: ReadonlySet<string> = new Set(SURVEY_SAMPLES.map((sample) => sample.name))
