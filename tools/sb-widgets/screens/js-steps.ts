/**
 * スクリプトで1問ずつ出していく見本を、画面①②③に分けた形にする（2026-10-27 本人選択「答えて進むだけの物だけ分ける」）。
 * どの見本をどう分けるかは js-steps-specs.ts（15個）。
 *
 * 9月の8個（ページ移動で次の問いへ進む見本）は問いを新しい入れ物で包んだ（screens-dom.ts の placeScreens）が、
 * こちらの見本の CSS は「並んだ問いの間の余白」などを親子の関係（`.widget-wrapper>*+*`）で書いているので、包むと崩れる。
 * そこで**問いの要素そのものを画面にし、問いを並べている親を画面の入れ物にする**。
 * 隠した画面が見本の CSS（display の指定）で見えてしまわないよう、入れ物の名前の付いた style で必ず隠す。
 *
 * - 見本自身のスクリプト（問いを隠す・次を出す）は外す。押すと次の画面へ（data-nc-go・SCREENS_SCRIPT）
 * - 出方は元の見本と同じ（下に積み重ねる＝前の問いが残る／入れ替える／横から）
 * - 答えると出ていた続き（解説・画像・動画）は次の画面の頭へ移す（積み重ねでは、答えたあとに続きとして出る）
 * - 入れ物は `<div class="nc nc-sample nc-xxxxxxxx 元のclass" data-nocode="sample" …>`（kit.ts の rekeyUid が読める形）
 */
import { SCREENS_SCRIPT } from '../../../src/app/panels/nocode/templates/builder.ts'
import { goTo, hasScreens, parseSample, removeInScreen, sampleUid, screenId, stepName, type SampleDocument } from './screens-dom.ts'
import { JS_STEP_SPECS, type JsStepSpec } from './js-steps-specs.ts'

/** 分けた見本の番号（build.ts の数え上げ・テスト用） */
export const JS_STEP_IDS: readonly number[] = JS_STEP_SPECS.map((spec) => spec.id)

const all = (root: ParentNode, selector: string | undefined): Element[] =>
  selector === undefined || selector === '' ? [] : Array.from(root.querySelectorAll(selector))

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 押すと移る印を付ける。選択肢（input）は、押す所になる label にも付ける */
function markGo(step: Element, el: Element, index: number): void {
  goTo(el, index)
  if (el.tagName !== 'INPUT') return
  const labels = new Set<Element>()
  const around = el.closest('label')
  if (around !== null) labels.add(around)
  const next = el.nextElementSibling
  if (next !== null && next.tagName === 'LABEL') labels.add(next)
  const id = el.getAttribute('id')
  if (id !== null && id !== '') for (const label of all(step, 'label[for]')) if (label.getAttribute('for') === id) labels.add(label)
  for (const label of labels) goTo(label, index)
}

/** 問いを並べている親を、画面の入れ物にする（元の class・属性は残す）。親が div でなければ包む */
function makeHolder(document: SampleDocument, steps: readonly Element[], spec: JsStepSpec, uid: string): Element {
  const first = steps[0]
  if (first === undefined) throw new Error(`${spec.id}: 画面にする要素がありません`)
  const parent = first.parentElement
  const transition = spec.transition === 'none' ? '' : ` data-nc-transition="${spec.transition}"`
  const shell = document.createElement('div')
  if (parent === null || parent.tagName !== 'DIV') {
    // 問いが見本のいちばん外に並んでいる（10966・16038）: 新しい入れ物で包む
    shell.innerHTML = `<div class="nc nc-sample ${uid}" data-nocode="sample" data-nc-screens=""${transition}></div>`
    const holder = shell.firstElementChild
    if (holder === null) throw new Error(`${spec.id}: 入れ物を作れませんでした`)
    first.before(holder)
    return holder
  }
  const keep = Array.from(parent.attributes)
    .filter((attr) => attr.name !== 'class')
    .map((attr) => ` ${attr.name}="${escapeAttribute(attr.value)}"`)
    .join('')
  const original = (parent.getAttribute('class') ?? '').trim()
  shell.innerHTML = `<div class="nc nc-sample ${uid}${original === '' ? '' : ` ${original}`}" data-nocode="sample" data-nc-screens=""${transition}${keep}></div>`
  const holder = shell.firstElementChild
  if (holder === null) throw new Error(`${spec.id}: 入れ物を作れませんでした`)
  holder.append(...Array.from(parent.childNodes))
  parent.replaceWith(holder)
  return holder
}

export function convertJsSteps(id: number, html: string): string {
  const spec = JS_STEP_SPECS.find((entry) => entry.id === id)
  if (spec === undefined || hasScreens(html)) return html
  const document = parseSample(html)

  for (const script of all(document, 'script')) {
    if (spec.script.test(script.textContent ?? '') || spec.script.test(script.getAttribute('src') ?? '')) script.remove()
  }
  for (const name of spec.unhide ?? []) for (const el of all(document, `.${name}`)) el.classList.remove(name)
  for (const el of all(document, spec.remove)) el.remove()
  for (const el of all(document, spec.enable)) {
    el.removeAttribute('disabled')
    el.classList.remove('disabled', 'is-disabled')
  }

  const steps = all(document, spec.steps)
  if (steps.length < 2) throw new Error(`${id}: 画面にする要素が2つ以上ありません（${spec.steps}）`)
  // 問いと問いのあいだの「次へ」の箱は、すぐ前の問いの中へ
  for (const el of all(document, spec.attach)) {
    let previous = el.previousElementSibling
    while (previous !== null && !steps.includes(previous)) previous = previous.previousElementSibling
    previous?.append(el)
  }

  const uid = sampleUid(html)
  const holder = makeHolder(document, steps, spec, uid)
  // 親の違う要素（入れ物の外の結果など）は、入れ物の中のいちばん後ろへ
  for (const step of steps) if (step.parentElement !== holder) holder.append(step)

  // 答えると出ていた続きは、次の画面の頭へ（最後の問いの分は、同じ形の画面を足して入れる）
  if (spec.carry !== undefined) {
    const carried = steps.map((step) => all(step, spec.carry))
    carried.forEach((list, index) => {
      for (const el of list) for (const drop of all(el, spec.carryDrop)) drop.remove()
      if (list.length === 0) return
      let target = steps[index + 1]
      if (target === undefined) {
        const last = steps[index]
        if (last === undefined) return
        target = last.cloneNode(false) as Element
        last.after(target)
        steps.push(target)
      }
      target.prepend(...list)
    })
  }

  const lastIndex = steps.length - 1
  steps.forEach((step, index) => {
    const name =
      index === 0 && spec.firstName !== undefined ? spec.firstName : index === lastIndex && spec.lastName !== undefined ? spec.lastName : stepName(index - (spec.firstName === undefined ? 0 : 1))
    step.classList.add('nc-screen')
    step.setAttribute('data-nc-screen', screenId(index))
    step.setAttribute('data-nc-name', name)
    step.removeAttribute('hidden')
    if (index > 0) step.setAttribute('hidden', '')
    if (index < lastIndex) {
      const found = spec.next.map((selector) => all(step, selector)).find((list) => list.length > 0) ?? []
      for (const el of found) markGo(step, el, index + 1)
    }
    for (const el of all(step, spec.back)) {
      if (index === 0) removeInScreen(el)
      else goTo(el, index - 1)
    }
  })

  // 隠した画面は、見本の CSS の display より強く隠す（入れ物の名前の付いた指定）
  const style = document.createElement('style')
  style.textContent = `.${uid}>[data-nc-screen][hidden]{display:none!important}`
  holder.before(style)
  const script = document.createElement('script')
  script.textContent = SCREENS_SCRIPT
  holder.after(script)
  return document.toString()
}
