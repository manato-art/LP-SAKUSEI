/**
 * まとまった型「アンケート」の中身（2026-10-24 本人「このURLの下にあるボタンを押したときにアンケートが始まる…
 * みたいなアセットを簡単に作れるようにしてほしい」）。手本は発酵本家のLP（回答をはじめる → Q1〜Q3 → 結果）。
 *
 * 部品で作ったWidgetの画面①②③として作る（今の部品をそのまま使える＝質問は見出しでも画像でも・動画も足せる）。
 * - 出方は「下に積み重ねる」（答えると次の質問が下に出る）。「画面の切り替わり方」で入れ替わる出方にも変えられる
 * - 分かれ道は選択肢ごとの「移る先の画面」。例として Q3 の答えで 結果A／結果B に分ける
 * - 質問の画面の頭に「進み具合」（Q1 › Q2 › Q3）。いらなければ部品を消す
 * - 「回答をはじめる」ボタンのあり・なしは作るときに選ぶ（startButton）
 * - 答えは記録しない（見せるだけ・本人の選択）
 * - そのまま LP に入れられる中身にする（入れる前の確かめに引っかからない）
 */
import { BUILDER_TEMPLATE } from './builder.ts'
import { PROGRESS_TYPE } from './progress-part.ts'
import type { ItemData, TemplateData } from './types.ts'

/** 「回答をはじめる」の色（手本と同じ赤） */
const START_COLOR = '#D21717'
/** 選択肢の色 */
const CHOICE_COLOR = '#E5573F'
/** 進み具合の今の番号の色（手本と同じ金） */
const PROGRESS_COLOR = '#C9A24B'

const button = (label: string, target: string, look: 'cta' | 'choice', color: string): ItemData => ({
  type: 'button',
  label,
  look,
  color,
  action: 'screen',
  target,
  url: '',
  track: true,
})

const question = (id: string, name: string, text: string, choices: readonly ItemData[]): ItemData => ({
  id,
  name,
  blocks: [
    { type: PROGRESS_TYPE, color: PROGRESS_COLOR, prefix: 'Q' },
    { type: 'heading', text, size: 22, align: 'center', color: '#1F2A37' },
    ...choices,
  ],
})

const result = (id: string, name: string, heading: string, text: string): ItemData => ({
  id,
  name,
  blocks: [
    { type: 'heading', text: heading, size: 24, align: 'center', color: '#1F2A37' },
    { type: 'text', text, size: 15, align: 'center' },
    // 申し込みのページは、右の「押したとき」でリンクを選んで入れる
    { type: 'button', label: '詳しく見る', look: 'cta', color: '#E5573F', action: 'none', target: '', url: '', track: true },
  ],
})

export function surveyData(now: Date, options: { readonly startButton: boolean }): TemplateData {
  let count = 0
  const nextId = (): string => `s${(count += 1)}`
  const startId = options.startButton ? nextId() : null
  const [q1, q2, q3, resultA, resultB] = [nextId(), nextId(), nextId(), nextId(), nextId()]
  const choice = (label: string, target: string): ItemData => button(label, target, 'choice', CHOICE_COLOR)
  return {
    ...BUILDER_TEMPLATE.defaults(now),
    transition: 'stack',
    padding: 24,
    screens: [
      ...(startId === null ? [] : [{ id: startId, name: 'はじめ', blocks: [button('回答をはじめる', q1, 'cta', START_COLOR)] }]),
      question(q1, 'Q1', 'Q1. 〇〇を以前からご存じでしたか？', [choice('はい', q2), choice('いいえ', q2)]),
      question(q2, 'Q2', 'Q2. 〇〇を試してみたいと思いますか？', [choice('はい', q3), choice('いいえ', q3)]),
      question(q3, 'Q3', 'Q3. いちばん気になるのはどれですか？', [
        choice('手軽さ', resultA),
        choice('値段', resultA),
        choice('効き目', resultB),
        choice('安心して続けられるか', resultB),
      ]),
      result(resultA, '結果A', 'あなたにぴったりのプランがあります', 'ご回答ありがとうございました。下のボタンから詳しくご覧いただけます。'),
      result(resultB, '結果B', 'まずはお試しから始めてみませんか？', 'ご回答ありがとうございました。下のボタンから詳しくご覧いただけます。'),
    ],
  }
}
