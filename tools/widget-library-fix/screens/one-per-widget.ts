/**
 * 「フェードインするアンケート（1問ずつ）」を画面①②③に作り変える（2026-09-22）。
 *
 * 元は1問だけの見本で、同じWidgetをLPに縦に並べて使う前提だった。答えると下に続き（画像と「次へ」）が出て、
 * 「次へ」は **次のWidget**（SBのWidgetの外枠 `.sb-custom` の次）の問いを出す。LP-SAKUSEI にはその外枠が無く、
 * 「次へ」を押すとスクリプトが止まっていた（点検で確認）。
 *
 * 作り変え: 問いを3問ぶん複製して画面にし、「次へ」→ 次の問いの画面。答えると続きが出るのは見本のまま。
 * 最後の問いの「次へ」は行き先が無いので置かない。
 */
import { goTo, hasScreens, removeInScreen, parseSample, placeScreens, sampleUid, stepName } from './screens-dom.ts'

const FAMILY = /fadeInAction/
const QUESTIONS = 3

export function convertOnePerWidget(html: string): string {
  if (hasScreens(html) || !FAMILY.test(html) || !html.includes('is-nextWidget')) return html
  const document = parseSample(html)
  const first = document.querySelector('.js-fadein.-firstArea')
  const rest = first === null ? [] : siblingsUntilEnd(first)
  if (first === null || rest.length === 0) return html

  const screens = Array.from({ length: QUESTIONS }, (_, index) => {
    const content = [first, ...rest].map((node) => node.cloneNode(true) as Element)
    for (const content_ of content) {
      const num = content_.querySelector('.num')
      if (num !== null) {
        const small = num.querySelector('.small')
        num.textContent = ''
        if (small !== null) num.append(small)
        num.append(String(index + 1))
      }
      for (const next of Array.from(content_.querySelectorAll('.is-nextWidget'))) {
        if (index < QUESTIONS - 1) goTo(next, index + 1)
        else removeInScreen(next)
      }
    }
    return { name: stepName(index), content }
  })
  // 元の問い以外の続き（画像と「次へ」）は、画面の中へ移したので元の場所から外す
  for (const node of rest) node.remove()
  placeScreens(document, first, sampleUid(html), screens)
  return document.toString()
}

/** first のあとに続く「続き」の箱（同じ種類の .js-fadein） */
function siblingsUntilEnd(first: Element): Element[] {
  const out: Element[] = []
  for (let node = first.nextElementSibling; node !== null; node = node.nextElementSibling) {
    if (!node.classList.contains('js-fadein')) break
    out.push(node)
  }
  return out
}
