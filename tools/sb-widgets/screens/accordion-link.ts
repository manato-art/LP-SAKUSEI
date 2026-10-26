/**
 * 「ステップを使用したアンケート」「アンケート 回答後にコンテンツをアコーディオンで開く」を画面①②③に作り変える（2026-09-22）。
 *
 * 元は1問だけの見本で、答えると下に続き（画像など）が開き、「次の質問へ」は仮のリンク「ooooo」。
 * SBのステップ（ファネル）で1問ずつページを分けて使う前提だった（名前の「ステップを使用した」）。
 *
 * 作り変え: ステップの印（1・2・3）の数だけ問いを複製して画面にし、「次の質問へ」→ 次の画面。
 * 最後の問いの「次の質問へ」は元のリンクのまま（結果のページ等のリンク先を入れる）。
 * 答えると続きが開くのは見本のまま（見本自身のスクリプト）。
 */
import { goTo, hasScreens, parseSample, placeScreens, renumberChoices, sampleUid, stepName } from './screens-dom.ts'

const FAMILY = /sbAccordionLink/

export function convertAccordionLink(html: string): string {
  if (hasScreens(html) || !FAMILY.test(html)) return html
  const document = parseSample(html)
  const survey = document.querySelector('.js-accordion-link')
  if (survey === null) return html
  const count = survey.querySelectorAll('.list-step li').length
  const next = survey.querySelectorAll('a.btn')
  if (count < 2 || next.length === 0) return html

  const screens = Array.from({ length: count }, (_, index) => {
    const copy = survey.cloneNode(true) as Element
    Array.from(copy.querySelectorAll('.list-step li')).forEach((li, k) => li.classList.toggle('current', k === index))
    renumberChoices(copy, (value) => value.replace(/^q\d+/, `q${index + 1}`))
    if (index < count - 1) for (const link of Array.from(copy.querySelectorAll('a.btn'))) goTo(link, index + 1)
    return { name: stepName(index), content: [copy] }
  })
  placeScreens(document, survey, sampleUid(html), screens)
  return document.toString()
}
