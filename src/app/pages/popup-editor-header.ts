/**
 * ポップアップの編集画面の上（離脱防止・表示直後・追従型で共通・2026-09-24 監査 15・26）。
 *
 *   上段: 戻る｜ポップアップ｜本番との違い（未公開／下書きあり／公開中）
 *   下段: プレビュー・下書きを確認｜下書き反映・本番反映・⋯（複製／削除）
 *
 * 「戻る」は保存していない変更があるときだけ赤い確認カードで確かめる（以前は黙って捨てていた）。
 * 「⋯ → 複製」は保存した下書きを写すので、保存していない変更があれば先に下書き反映する（断れば何もしない）。
 * 実際の保存・複製・削除は呼び出し側（exit-popup-editor.ts / exit-popup-follow-editor.ts）が渡す。
 */
import { confirmCard, type ConfirmOptions } from '../dialog.ts'
import { el } from '../ui.ts'
import type { PopupPublishStatus } from '../../shared/popup-content.ts'
import { publishStatusPill } from './popup-list-parts.ts'

export interface PopupEditorHeaderOptions {
  readonly status: () => PopupPublishStatus
  readonly isDirty: () => boolean
  /** 一覧へ戻る（確かめたあと） */
  readonly onBack: () => void
  /** その場のプレビュー（保存前の中身） */
  readonly onPreview: () => void
  /** 下書きを確認（保存した下書きをLPの上で見る） */
  readonly onCheckDraft: () => Promise<void>
  /** 下書き反映。保存できたら true */
  readonly onSaveDraft: () => Promise<boolean>
  /** 本番反映。反映できたら true */
  readonly onPublish: () => Promise<boolean>
  readonly onDuplicate: () => Promise<void>
  /** 削除（確認カードで「削除する」を押したあと） */
  readonly onDelete: () => Promise<void>
  /** 確認カード（テストで差し替える） */
  readonly confirm?: (options: ConfirmOptions) => Promise<boolean>
}

const OPEN_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px" aria-hidden="true"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>'
const TRASH_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>'

/** 押している間は二度押しできないようにして、終わったら元の文字に戻す */
function busy(btn: HTMLButtonElement, label: string, run: () => Promise<unknown>): void {
  if (btn.disabled) return
  const original = btn.innerHTML
  btn.disabled = true
  btn.textContent = label
  void run().finally(() => {
    btn.disabled = false
    btn.innerHTML = original
  })
}

export function buildPopupEditorHeader(options: PopupEditorHeaderOptions): {
  top: HTMLElement
  bar: HTMLElement
  refreshStatus: () => void
} {
  const ask = options.confirm ?? confirmCard

  // ── 上段 ──
  const top = el('div', { class: 'ep-editor-head-top' })
  const left = el('div', { class: 'ep-editor-head-top-left' })
  const backBtn = el('button', { class: 'ep-editor-head-back', text: '戻る' })
  backBtn.type = 'button'
  backBtn.addEventListener('click', () => {
    if (!options.isDirty()) {
      options.onBack()
      return
    }
    void ask({
      title: '保存していない変更があります',
      message: '戻ると、この画面で直した内容は消えます。',
      detail: '残すときは「編集を続ける」を押し、「下書き反映」してから戻ってください。',
      submitLabel: '保存せずに戻る',
      cancelLabel: '編集を続ける',
      danger: true,
    }).then((ok) => {
      if (ok) options.onBack()
    })
  })
  left.append(backBtn)
  const center = el('div', { class: 'ep-editor-head-top-center', text: 'ポップアップ' })
  const right = el('div', { class: 'ep-editor-head-top-right' })
  right.style.display = 'flex'
  right.style.justifyContent = 'flex-end'
  top.append(left, center, right)

  const refreshStatus = (): void => {
    right.replaceChildren(publishStatusPill(options.status()))
  }
  refreshStatus()

  // ── 下段 ──
  const bar = el('div', { class: 'ep-editor-btn-bar' })
  const btnLeft = el('div', { class: 'ep-editor-btn-group' })
  const previewBtn = el('button', { class: 'ep-editor-btn-draft', text: 'プレビュー' })
  previewBtn.type = 'button'
  previewBtn.title = '保存する前の中身を、この画面の上で見ます'
  previewBtn.addEventListener('click', () => options.onPreview())
  const checkDraftBtn = el('button', { class: 'ep-editor-btn-draft', html: `下書きを確認 ${OPEN_ICON}` })
  checkDraftBtn.type = 'button'
  checkDraftBtn.title = '下書きを、LPの上に出して新しいタブで確かめます（配信はされません）'
  checkDraftBtn.addEventListener('click', () => busy(checkDraftBtn, '開いています…', options.onCheckDraft))
  btnLeft.append(previewBtn, checkDraftBtn)

  const btnRight = el('div', { class: 'ep-editor-btn-group' })
  const saveDraftBtn = el('button', { class: 'ep-editor-btn-draft', text: '下書き反映' })
  saveDraftBtn.type = 'button'
  saveDraftBtn.title = '下書きとして保存します。配信にはまだ出ません'
  saveDraftBtn.addEventListener('click', () =>
    busy(saveDraftBtn, '保存中…', async () => {
      await options.onSaveDraft()
      refreshStatus()
    }),
  )
  const publishBtn = el('button', { class: 'ep-editor-btn-prod', text: '本番反映' })
  publishBtn.type = 'button'
  publishBtn.title = '下書きを本番にして配信します（配信がONのとき）'
  publishBtn.addEventListener('click', () =>
    busy(publishBtn, '反映中…', async () => {
      await options.onPublish()
      refreshStatus()
    }),
  )

  const moreWrap = el('span', { style: 'position:relative;display:inline-flex' })
  const moreBtn = el('button', { class: 'ep-editor-btn-more', text: '⋯' })
  moreBtn.type = 'button'
  moreBtn.setAttribute('aria-label', 'そのほかの操作')
  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleMenu(moreWrap, options, ask)
  })
  moreWrap.append(moreBtn)
  btnRight.append(saveDraftBtn, publishBtn, moreWrap)
  bar.append(btnLeft, btnRight)

  return { top, bar, refreshStatus }
}

/** ⋯ のメニュー（複製・削除） */
function toggleMenu(
  wrap: HTMLElement,
  options: PopupEditorHeaderOptions,
  ask: (o: ConfirmOptions) => Promise<boolean>,
): void {
  const existing = wrap.querySelector('.ep-dropdown')
  if (existing !== null) {
    existing.remove()
    return
  }
  const menu = el('div', { class: 'ep-dropdown', style: 'top:calc(100% + 4px);right:0' })
  const close = (): void => {
    menu.remove()
    document.removeEventListener('click', onOutside)
  }
  const onOutside = (e: MouseEvent): void => {
    if (!wrap.contains(e.target as Node)) close()
  }

  const copyBtn = el('button', { class: 'ep-dropdown-item', text: '複製' })
  copyBtn.type = 'button'
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    close()
    if (!options.isDirty()) {
      void options.onDuplicate()
      return
    }
    void ask({
      title: '保存していない変更があります',
      message: '複製には保存した下書きが写ります。いまの変更を下書き反映してから複製しますか？',
      submitLabel: '下書き反映して複製',
      cancelLabel: 'やめる',
    }).then(async (ok) => {
      if (!ok) return
      if (await options.onSaveDraft()) await options.onDuplicate()
    })
  })

  const deleteBtn = el('button', { class: 'ep-dropdown-item danger', html: `削除 ${TRASH_ICON}` })
  deleteBtn.type = 'button'
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    close()
    void ask({
      title: 'このポップアップを削除しますか？',
      message: 'このbeyondページから外れ、配信ページにも出なくなります。',
      detail: '削除すると元に戻せません。',
      submitLabel: '削除する',
      danger: true,
    }).then((ok) => {
      if (ok) void options.onDelete()
    })
  })

  menu.append(copyBtn, deleteBtn)
  wrap.append(menu)
  setTimeout(() => document.addEventListener('click', onOutside), 0)
}
