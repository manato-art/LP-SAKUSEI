/**
 * ポップアップ一覧の「このVersionで配信」（2026-09-24 監査 15）。
 *
 * 以前はトグルが画面の中の値を変えるだけで、保存も配信への反映もしていなかった。
 * いまは Version を選んで、その Version を配信するときにポップアップ（離脱防止・表示直後・追従型）を出すかを
 * サーバーに保存する（PUT /ab_tests/:uid/popup_delivery/:version_uid・配信は delivery-popups.ts が見る）。
 */
import { popupApi } from '../api-popups.ts'
import { el, toast } from '../ui.ts'
import type { PopupPageState } from './exit-popup-state.ts'
import { popupDeliveryOptionLabel } from './popup-draft.ts'

export function popupDeliveryControl(state: PopupPageState): HTMLElement {
  const row = el('div', { class: 'ep-delivery' })
  const left = el('div', { class: 'ep-delivery-version' })
  left.append(el('span', { class: 'ep-delivery-label', text: 'このVersionで配信' }))

  const versions = state.deliveryVersions
  if (versions.length === 0) {
    left.append(el('span', { class: 'ep-delivery-label', text: '（Versionがありません）' }))
    row.append(left)
    return row
  }

  const hasSteps = versions.some((v) => v.step > 1)
  const select = document.createElement('select')
  select.setAttribute('aria-label', 'Version')
  for (const version of versions) {
    const option = document.createElement('option')
    option.value = version.uid
    option.textContent = popupDeliveryOptionLabel(version, hasSteps)
    option.selected = version.uid === state.deliveryVersionUid
    select.append(option)
  }
  left.append(select)

  const selected = (): boolean =>
    state.deliveryVersions.find((v) => v.uid === state.deliveryVersionUid)?.popup_delivery !== false
  const toggle = el('button', { class: `ep-toggle${selected() ? ' on' : ''}` })
  toggle.type = 'button'
  toggle.setAttribute('aria-label', 'このVersionで配信')
  toggle.title = 'OFFにすると、このVersionを配信するときはポップアップを出しません'

  select.addEventListener('change', () => {
    state.deliveryVersionUid = select.value
    toggle.classList.toggle('on', selected())
  })
  toggle.addEventListener('click', () => {
    const versionUid = state.deliveryVersionUid
    if (versionUid === null || toggle.hasAttribute('disabled')) return
    const next = !selected()
    toggle.setAttribute('disabled', '')
    void popupApi.setPopupDelivery(state.abTestUid, versionUid, next).then(
      ({ version }) => {
        state.deliveryVersions = state.deliveryVersions.map((v) => (v.uid === version.uid ? version : v))
        toggle.classList.toggle('on', version.popup_delivery)
        toast(version.popup_delivery
          ? `「${version.name}」でポップアップを配信します`
          : `「${version.name}」ではポップアップを出しません`)
      },
      (err: unknown) => toast((err as Error).message, 'error'),
    ).finally(() => toggle.removeAttribute('disabled'))
  })

  row.append(left, toggle)
  return row
}
