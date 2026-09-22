/**
 * 「リンクでアンケート（単一選択風／複数選択風、ファネルモード推奨）」を画面①②③に作り変える（2026-09-22）。
 *
 * 元は1問だけの見本で、答え（はい／いいえ・次へ）は仮のリンク「ooooo」。SBのファネル（ステップごとに別ページ）で
 * 1問ずつページを分けて使う前提だった。LP-SAKUSEI に入れると、押して1秒後に行き止まりのページへ飛ぶ
 * （本人「ボタンとして機能していない」）。
 *
 * 作り変え: 進み具合（Q1〜Q3）の数だけ問いを複製して画面にし、答え・次へ → 次の画面、もどる → 前の画面。
 * 最後の問いの答え・次へは元のリンクのまま（結果のページ等のリンク先を入れる）。1問目には「もどる」を置かない（戻る先が無い）。
 * 見本自身のスクリプト（押した見た目・選ぶまで次へを押せない）はそのまま残す。
 */
import { goTo, hasScreens, removeInScreen, parseSample, placeScreens, renumberChoices, sampleUid, stepName } from './screens-dom.ts'

const FAMILY = /linkQuestionFunc|selectQuestionFunc/

export function convertQuestionLink(html: string): string {
  if (hasScreens(html) || !FAMILY.test(html)) return html
  const document = parseSample(html)
  const survey = document.querySelector('.questionLink')
  if (survey === null) return html
  const count = survey.querySelectorAll('.progress .progress__item').length
  if (count < 2) return html

  const screens = Array.from({ length: count }, (_, index) => {
    const copy = survey.cloneNode(true) as Element
    Array.from(copy.querySelectorAll('.progress .progress__item')).forEach((item, k) => {
      item.classList.toggle('is-active', k === index)
    })
    const num = copy.querySelector('.head__num')
    if (num !== null) num.textContent = `Q${index + 1}`
    renumberChoices(copy, (value) => value.replace(/^q\d+/, `q${index + 1}`))
    const last = index === count - 1
    for (const answer of Array.from(copy.querySelectorAll('.js-link, .js-next'))) {
      if (!last) goTo(answer, index + 1)
    }
    for (const back of Array.from(copy.querySelectorAll('.link__button--back'))) {
      if (index === 0) removeInScreen(back)
      else goTo(back, index - 1)
    }
    return { name: stepName(index), content: [copy] }
  })
  placeScreens(document, survey, sampleUid(html), screens)
  return document.toString()
}
