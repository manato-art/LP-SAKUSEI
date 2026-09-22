/**
 * 「ページ遷移式アンケート（ボタンデザイン｜単一選択／複数選択）」を画面①②…に作り変える（2026-09-22）。
 *
 * 元は1問だけの見本で、進み具合（Q1〜Q5）を持ち、答え（単一選択）または「次に進む」（複数選択）が仮のリンク「ooooo」。
 * 名前のとおり、答えるたびに別のページへ移る前提だった。
 *
 * 作り変え: 進み具合の数だけ問いを複製して画面にし、答え・次に進む → 次の画面。最後の問いは元のリンクのまま。
 * 画面ごとに、進み具合の印・問いの番号（Q1）・「1/5」を合わせる。
 * 複数選択の「選ぶまで次に進むを押せない」（見本自身のスクリプトが disabled を付け外し）は、そのまま効く。
 */
import { goTo, hasScreens, parseSample, placeScreens, sampleUid, stepName } from './screens-dom.ts'

export function convertQuizBox(html: string): string {
  if (hasScreens(html) || !html.includes('l-quizBox') || !html.includes('flow-list_item')) return html
  const document = parseSample(html)
  const quiz = document.querySelector('.l-quizBox')
  if (quiz === null) return html
  const count = quiz.querySelectorAll('.flow-list .flow-list_item').length
  const answers = quiz.querySelectorAll('.quiz_cont_select a[href], .js-check-input-link')
  if (count < 2 || answers.length === 0) return html

  const screens = Array.from({ length: count }, (_, index) => {
    const copy = quiz.cloneNode(true) as Element
    Array.from(copy.querySelectorAll('.flow-list .flow-list_item')).forEach((li, k) => li.classList.toggle('current', k === index))
    const mark = copy.querySelector('.q_mark')
    if (mark !== null) mark.textContent = `Q${index + 1}`
    const progress = copy.querySelector('.quiz_cont_progress span')
    if (progress !== null) progress.textContent = String(index + 1)
    if (index < count - 1) {
      for (const answer of Array.from(copy.querySelectorAll('.quiz_cont_select a[href], .js-check-input-link'))) goTo(answer, index + 1)
    }
    return { name: stepName(index), content: [copy] }
  })
  placeScreens(document, quiz, sampleUid(html), screens)
  return document.toString()
}
