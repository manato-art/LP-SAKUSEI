/**
 * 見本を「画面①②…」の形に作り変えるときの共通の部品（2026-09-22・本人の決定「次へ系は画面化」）。
 *
 * 形は「部品を積んで作る」（src/app/panels/nocode/templates/builder.ts）と同じ決まりにそろえる:
 *   <div class="nc nc-sample nc-xxxxxxxx" data-nocode="sample" data-nc-screens>
 *     <div class="nc-screen" data-nc-screen="s1" data-nc-name="設問①">…</div>
 *     <div class="nc-screen" data-nc-screen="s2" data-nc-name="設問②" hidden>…</div>
 *   </div><script>（SCREENS_SCRIPT）</script>
 * - LPでは最初の画面だけが見え、data-nc-go を押すと瞬時にその画面へ切り替わる（見本自身のスクリプトより先に受け取る）
 * - Widget編集では「編集する画面」のタブで1画面ずつ直せる（screen-switcher.ts。nc-xxxxxxxx が要る）
 * - 「作成したWidget」と同じく、入れるたびに nc-xxxxxxxx を付け直せる（kit.ts の rekeyUid が読める形）
 */
import { createHash } from 'node:crypto'
import { parseHTML } from 'linkedom'
import { SCREENS_SCRIPT } from '../../../src/app/panels/nocode/templates/builder.ts'

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'

export const stepName = (index: number): string => `設問${Array.from(CIRCLED)[index] ?? String(index + 1)}`
export const screenId = (index: number): string => `s${index + 1}`

/** 作り変えた見本の名前（CSSのクラス）。元の見本から決める（何度回しても同じ名前） */
export function sampleUid(original: string): string {
  const digest = createHash('sha256').update(original).digest()
  return `nc-${Array.from(digest.subarray(0, 8), (b) => (b % 36).toString(36)).join('')}`
}

export type SampleDocument = ReturnType<typeof parseHTML>['document']

export function parseSample(html: string): SampleDocument {
  return parseHTML(html).document
}

/** もう画面の形になっている（作り変え済み）見本か */
export function hasScreens(html: string): boolean {
  return html.includes('data-nc-screens')
}

/**
 * place の位置に、画面①②…の入れ物を置いて、切り替えのスクリプトをその直後に入れる。
 * screens は画面の中身（上から順に。1つ目が最初に見える画面）。
 */
export function placeScreens(
  document: SampleDocument,
  place: Element,
  uid: string,
  screens: readonly { name: string; content: readonly Element[] }[],
): void {
  // 入れ物は文字のHTMLから作る（setAttribute だと属性が逆の順で書き出され、class が先頭でなくなる。
  // 入れるたびに名前を付け直す kit.ts の rekeyUid は「class が先頭・次に data-nocode」の形で探す）
  const holder = document.createElement('div')
  holder.innerHTML =
    `<div class="nc nc-sample ${uid}" data-nocode="sample" data-nc-screens="">` +
    screens
      .map((screen, index) => `<div class="nc-screen" data-nc-screen="${screenId(index)}" data-nc-name="${screen.name}"${index > 0 ? ' hidden=""' : ''}></div>`)
      .join('') +
    `</div><script></script>`
  const root = holder.firstElementChild
  const script = root?.nextElementSibling
  if (root === null || root === undefined || script === null || script === undefined) throw new Error('画面の入れ物を作れませんでした')
  script.textContent = SCREENS_SCRIPT
  Array.from(root.children).forEach((box, index) => {
    for (const node of screens[index]?.content ?? []) box.append(node)
  })
  place.replaceWith(root)
  root.after(script)
}

/** 押すと別の画面へ移るようにする（見本自身のリンク先は残す＝最後の画面などで使う） */
export function goTo(element: Element, index: number): void {
  element.setAttribute('data-nc-go', screenId(index))
}

/**
 * その画面には置かない（前の画面が無い「もどる」・次の無い「次へ」）。
 * 隠すだけだと、見えない仮のリンクとして数えられ、見たまま編集でも選べない。それだけが入っていた入れ物ごと外す
 */
export function removeInScreen(element: Element): void {
  const parent = element.parentElement
  const alone = parent !== null && Array.from(parent.children).every((child) => child === element) && (parent.textContent ?? '').trim() === (element.textContent ?? '').trim()
  ;(alone ? parent : element).remove()
}

/** 画面ごとに、選択肢の id・name と label の for を付け直す（同じ id が画面の数だけ並ばないように） */
export function renumberChoices(screen: Element, rename: (value: string) => string): void {
  const ids = new Map<string, string>()
  for (const input of Array.from(screen.querySelectorAll('input[id]'))) {
    const next = rename(input.id)
    ids.set(input.id, next)
    input.id = next
  }
  for (const label of Array.from(screen.querySelectorAll('label[for]'))) {
    const next = ids.get(label.getAttribute('for') ?? '')
    if (next !== undefined) label.setAttribute('for', next)
  }
  for (const input of Array.from(screen.querySelectorAll('input[name]'))) {
    input.setAttribute('name', rename(input.getAttribute('name') ?? ''))
  }
}
