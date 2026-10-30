/**
 * 見本の中の要素「全体」のリンク先（2026-10-31 本人「このポップ全体に対して反映したいのに、ボタンだけになってしまう。
 * ボタンだけがいい時はボタンだけ押してリンク先にリンク入れますから」）。
 *
 * 見たまま画面で見本の中の要素（帯・カード・枠など）を押すと出る（form-sample.ts の selectInner から select）。
 * ボタン（リンク）そのもの・ボタンの中を押したときは出さない（ボタンは「ボタンのリンク先」で直す）。
 * 入れたリンク先は、Enter か欄の外を押したときに入れる（見えないリンクを足すと見本の中身が読み直されて、入力欄が組み立て直されるため）。
 */
import { isAllowedLinkUrl } from '../../../shared/link-html.ts'
import { node } from './form-controls.ts'
import { LINK_BOX_ATTR, canLinkWhole, nextLinkBoxId, wholeLinkOf } from './whole-link.ts'

export interface SampleLinkDeps {
  /** いまの見本の中身（印の名前が重ならないように見る） */
  readonly readHtml: () => string
  /** 見たまま画面の要素に全体のリンクを付ける・外す（url が空なら外す）。見本の中身へ読み戻す。付けられなければ false */
  readonly change: (element: HTMLElement, url: string, id: string) => boolean
  /**
   * いま直している要素の印を覚えておく（null＝印の無い要素・選んでいない）。見えないリンクを足すと入力欄が組み立て直されるので、
   * そのあとも同じ要素を選んだままにするため（form-sample.ts）
   */
  readonly remember?: (id: string | null) => void
}

export interface SampleLinkSection {
  readonly element: HTMLElement
  /** 見本の中で選んだ要素（null＝選んでいない＝隠す） */
  readonly select: (element: HTMLElement | null) => void
}

const MARK = /^l\d{1,4}$/
const BAD_URL = 'このリンクは開けません。https:// から始まるURLを書いてください'

let idSeq = 0

export function sampleLinkSection(deps: SampleLinkDeps): SampleLinkSection {
  const wrap = node('div', 'ncf-sample-link ncf-field')
  wrap.hidden = true
  const controlId = `ncsl-${(idSeq += 1)}`
  const label = node('label', 'ncf-label', 'この要素全体のリンク先')
  label.htmlFor = controlId
  const input = node('input', 'ncf-input')
  input.type = 'url'
  input.id = controlId
  input.placeholder = 'https://'
  const warn = node('span', 'ncf-warn')
  warn.hidden = true
  const note = node(
    'span',
    'ncf-note',
    '要素のどこを押しても、このリンク先へ移ります（中のボタンに別のリンク先が入っていれば、ボタンはそちらへ）。' +
      '入れたら Enter か、欄の外を押すと入ります。空にするとリンクを外します。' +
      'ボタンだけにしたいときは、左でボタンを押して「ボタンのリンク先」に入れてください。',
  )
  wrap.append(label, input, warn, note)

  let target: HTMLElement | null = null

  const check = (): boolean => {
    const url = input.value.trim()
    warn.textContent = url !== '' && !isAllowedLinkUrl(url) ? BAD_URL : ''
    warn.hidden = warn.textContent === ''
    return warn.hidden
  }
  const commit = (): void => {
    if (target === null || !check()) return
    const url = input.value.trim()
    if (url === wholeLinkOf(target)) return
    const mark = target.getAttribute(LINK_BOX_ATTR) ?? ''
    const id = MARK.test(mark) ? mark : nextLinkBoxId(deps.readHtml())
    deps.remember?.(url === '' ? null : id)
    if (!deps.change(target, url, id)) {
      warn.textContent = BAD_URL
      warn.hidden = false
    }
  }
  input.addEventListener('input', () => {
    check()
  })
  input.addEventListener('change', commit)
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return
    e.preventDefault()
    commit()
  })

  return {
    element: wrap,
    select: (element) => {
      target = element !== null && canLinkWhole(element) ? element : null
      wrap.hidden = target === null
      const mark = target?.getAttribute(LINK_BOX_ATTR) ?? ''
      deps.remember?.(MARK.test(mark) ? mark : null)
      if (target === null) return
      input.value = wholeLinkOf(target)
      check()
    },
  }
}
