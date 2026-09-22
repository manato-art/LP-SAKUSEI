/**
 * 「アンケート（テキスト・画像付きの複数パターン / 選択後次へのボタン表示 / 単一・複数選択）」を画面①②…に作り変える（2026-09-22）。
 *
 * 元は問いの箱（Q1〜Q5）が縦に並び、答えると「次へ」が出る。ところが「次へ」は `href="#"`（ページの先頭へ飛ぶ）で、
 * 次の問いへは進まなかった（点検で確認）。
 *
 * 作り変え: 問いの箱を1つずつ画面にし、「次へ」→ 次の画面。最後の問いの「次へ」は元のリンクのまま。
 * 答えると「次へ」が出る・選んだ見た目は見本のまま（見本自身のスクリプト）。
 */
import { goTo, hasScreens, parseSample, placeScreens, sampleUid, stepName } from './screens-dom.ts'

const FAMILY = /sbMultiQuestions/

export function convertMultiQuestions(html: string): string {
  if (hasScreens(html) || !FAMILY.test(html)) return html
  const document = parseSample(html)
  const boxes = Array.from(document.querySelectorAll('.js-multi-questions'))
  if (boxes.length < 2 || boxes.some((box) => box.parentElement !== boxes[0]?.parentElement)) return html

  const screens = boxes.map((box, index) => {
    if (index < boxes.length - 1) for (const next of Array.from(box.querySelectorAll('.questions-next-btn'))) goTo(next, index + 1)
    return { name: stepName(index), content: [box] }
  })
  // 1つ目の箱の場所に画面の入れ物を置く（ほかの箱は画面の中へ移る）
  const place = document.createElement('div')
  boxes[0]?.before(place)
  placeScreens(document, place, sampleUid(html), screens)
  return document.toString()
}
