/**
 * ポップアップ一覧の小さな部品（2026-09-24 監査 15）。
 *
 *   publishStatusPill … 本番との違い（未公開／下書きあり／公開中・2026-09-24 下書きと本番を分けた）
 *   closedPanelNotice … 「閉じる」のあとに出す案内（以前はパネルを消して真っ白な画面のままだった）
 *   copyTabList       … 追加画面の「複製」タブ（以前はいつも「複製可能なポップアップはありません。」だった）
 */
import { el } from '../ui.ts'
import type { PopupPublishStatus } from '../../shared/popup-content.ts'
import { publishStatusView } from './popup-draft.ts'

/** 本番との違い（未公開／下書きあり／公開中）。色は小さな丸1つで表す（カードの縁に色を付けない） */
export function publishStatusPill(status: PopupPublishStatus): HTMLElement {
  const view = publishStatusView(status)
  const pill = el('span', { class: 'ep-status' })
  pill.append(el('span', { class: 'ep-status-dot', style: `background:${view.color}` }), el('span', { text: view.label }))
  pill.title = view.hint
  return pill
}

/** 「閉じる」のあと: 一覧を開き直すボタン（上のタブで別の画面へも移れる） */
export function closedPanelNotice(onReopen: () => void): HTMLElement {
  const box = el('div', { class: 'ep-closed' })
  box.append(el('p', { class: 'ep-closed-text', text: 'ポップアップの一覧を閉じました。' }))
  const reopen = el('button', { class: 'ep-closed-open', text: 'ポップアップの一覧を開く' })
  reopen.type = 'button'
  reopen.addEventListener('click', onReopen)
  box.append(reopen)
  return box
}

export interface CopySource {
  readonly uid: string
  readonly name: string
  /** 名前の下に小さく出す補足（種類など） */
  readonly note: string
}

/** 複製タブの中身: このLPのポップアップを並べ、「複製」で onCopy(uid) */
export function copyTabList(sources: readonly CopySource[], onCopy: (uid: string) => void): HTMLElement {
  const list = el('div', { class: 'ep-copy-list' })
  if (sources.length === 0) {
    list.append(el('div', { class: 'ep-empty', text: '複製できるポップアップはまだありません。「プリセット」から追加してください。' }))
    return list
  }
  for (const source of sources) {
    const row = el('div', { class: 'ep-preset-item' })
    const info = el('div', { class: 'ep-preset-info' })
    info.append(el('p', { class: 'ep-preset-name', text: source.name }))
    info.append(el('div', { class: 'ep-preset-detail', text: source.note }))
    const copy = el('button', { class: 'ep-preset-add', text: '複製' })
    copy.type = 'button'
    copy.addEventListener('click', (e) => {
      e.stopPropagation()
      onCopy(source.uid)
    })
    row.append(info, copy)
    list.append(row)
  }
  return list
}
