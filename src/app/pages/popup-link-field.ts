/**
 * ポップアップの「移行先URL」の欄（指示44・2026-10-31 本人「表示設定でも移行先URLを設定できるようにしてほしい。
 * これは3種類全部。てか、今後も全部に対して」）。追従型の「表示設定」に置く（離脱防止・表示直後は「基本」のタブの
 * 「ポップアップを触ったときの動作」の同じ作り＝exit-popup-editor-tabs.ts）。
 *
 * 入力欄には計測の目印（sb_tracking）を外したきれいな住所を見せ、計測のあり・なしはチェックで表す（離脱防止と同じ）。
 */
import { el } from '../ui.ts'
import { isAllowedLinkUrl, isTrackingLink, withTrackingParam } from '../../shared/link-html.ts'
import { makeCheckboxRow } from './exit-popup-fields.ts'

export interface PopupLink {
  readonly url: string
  readonly target: '_blank' | '_self'
}

export function popupLinkField(initial: PopupLink, onChange: (link: PopupLink) => void): HTMLElement {
  const field = el('div', { class: 'ep-field' })
  field.append(el('label', { text: '移行先URL（押したときに移る先）' }))
  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'https://'
  input.value = initial.url === '' ? '' : withTrackingParam(initial.url, false)
  const warn = el('p', { style: 'margin:4px 0 0;font-size:12px;color:#DC2626' })
  warn.hidden = true
  const opts = el('div', { style: 'display:flex;flex-direction:column;gap:6px;margin-top:8px' })
  const [newTabWrap, newTabCb] = makeCheckboxRow('新しいタブで開く', initial.target !== '_self')
  const [trackWrap, trackCb] = makeCheckboxRow(
    'このシステムで計測する（クリックをレポートに計上）',
    initial.url !== '' && isTrackingLink(initial.url, null),
  )
  opts.append(newTabWrap, trackWrap)
  const write = (): void => {
    const url = input.value.trim()
    const bad = url !== '' && !isAllowedLinkUrl(url)
    warn.textContent = bad ? 'このリンクは開けません。https:// から始まるURLを書いてください' : ''
    warn.hidden = !bad
    if (bad) return
    onChange({ url: url === '' ? '' : withTrackingParam(url, trackCb.checked), target: newTabCb.checked ? '_blank' : '_self' })
  }
  input.addEventListener('input', write)
  newTabCb.addEventListener('change', write)
  trackCb.addEventListener('change', write)
  field.append(
    input,
    warn,
    opts,
    el('p', {
      style: 'margin:6px 0 0;font-size:12px;color:#6B7280',
      text: 'ポップアップのどこを押しても、このURLへ移ります（中のボタンに別のリンク先があれば、ボタンはそちら）。空にすると移りません。',
    }),
  )
  return field
}
