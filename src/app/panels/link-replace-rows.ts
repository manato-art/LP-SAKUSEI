/**
 * リンク置換パネルの一覧の中身（2026-09-24 全体点検37）。
 *
 * 実物の1行のマークアップは採取できていない（link-replace.ts の冒頭）。そのため以前は、リンクがあると
 * 一覧を空のまま件数だけ属性に書いていて、画面は真っ白・1件ずつ選べなかった。
 * 実物に似せた行は作らず、このシステムの行として素直に並べる（チェック・リンクの文字・行き先・計測あり）。
 *
 * - 「中間ページリンク」を選んだら、置き換え先の中間ページを選ぶプルダウンを出す（以前は「未採取」のエラーだけ）
 * - 「離脱防止ポップアップリンク」タブは、ポップアップの一覧と「開いて直す」を出す
 *   （ポップアップの中身は下書きと本番に分かれているので、中身の編集画面で直す）
 */
import type { LpLink } from '../../shared/link-html.ts'

export interface RowsDeps {
  readonly selected: ReadonlySet<number>
  readonly onToggle: (index: number) => void
}

export function renderLinkRows(host: HTMLElement, links: readonly LpLink[], deps: RowsDeps): void {
  host.replaceChildren(
    ...links.map((link) => {
      const row = document.createElement('label')
      row.setAttribute('data-link-row', String(link.index))
      row.style.cssText =
        'display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-bottom:1px solid var(--sb-c-eeeeee, #EEEEEE);cursor:pointer;font-size:12px;line-height:1.5'
      const box = document.createElement('input')
      box.type = 'checkbox'
      box.checked = deps.selected.has(link.index)
      box.style.marginTop = '2px'
      box.addEventListener('change', () => deps.onToggle(link.index))
      const body = document.createElement('div')
      body.style.cssText = 'min-width:0;flex:1'
      const text = document.createElement('div')
      text.textContent = link.text === '' ? '（文字のないリンク・画像など）' : link.text
      text.style.cssText = 'font-weight:700;overflow-wrap:anywhere'
      const href = document.createElement('div')
      href.textContent = link.href === '' ? '（行き先なし）' : link.href
      href.style.cssText = 'color:var(--sb-c-8a8a8e, #8A8A8E);overflow-wrap:anywhere'
      body.append(text, href)
      row.append(box, body)
      if (link.isTracking) {
        const pill = document.createElement('span')
        pill.textContent = '計測あり'
        pill.style.cssText =
          'flex-shrink:0;padding:1px 8px;border-radius:999px;background:#E8F4FF;color:var(--sb-accent, #0091FF);font-size:11px;font-weight:700'
        row.append(pill)
      }
      return row
    }),
  )
}

export interface RedirectChoice {
  readonly uid: string
  readonly name: string
  readonly url: string
}

/** 置き換え先の中間ページを選ぶプルダウン（中間ページリンクを選んだときだけ出す） */
export function renderRedirectPicker(
  anchor: HTMLElement,
  pages: readonly RedirectChoice[],
  current: string,
  onPick: (uid: string) => void,
): void {
  anchor.parentElement?.querySelector('[data-redirect-picker]')?.remove()
  const wrap = document.createElement('div')
  wrap.setAttribute('data-redirect-picker', 'true')
  wrap.style.cssText = 'margin-top:6px'
  if (pages.length === 0) {
    wrap.textContent = '中間ページがまだありません。「中間ページ」タブで作ってください。'
    wrap.style.cssText += ';font-size:12px;color:var(--sb-c-8a8a8e, #8A8A8E)'
    anchor.after(wrap)
    return
  }
  const select = document.createElement('select')
  select.className = '_formControl_1n7ll_17'
  select.setAttribute('aria-label', '置き換え先の中間ページ')
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = '中間ページを選ぶ'
  select.append(
    placeholder,
    ...pages.map((page) => {
      const option = document.createElement('option')
      option.value = page.uid
      option.textContent = page.name === '' ? page.url : page.name
      if (page.uid === current) option.setAttribute('selected', '')
      return option
    }),
  )
  select.addEventListener('change', () => onPick(select.value))
  wrap.append(select)
  anchor.after(wrap)
}

export interface PopupChoice {
  readonly uid: string
  readonly name: string
}

/** 「離脱防止ポップアップリンク」タブ: ポップアップの一覧と、中身の編集画面を開くボタン */
export function renderPopupRows(host: HTMLElement, popups: readonly PopupChoice[], openEditor: () => void): void {
  if (popups.length === 0) {
    const empty = document.createElement('div')
    empty.textContent = 'このページには離脱防止ポップアップがありません'
    empty.style.cssText = 'padding:16px;font-size:12px;color:var(--sb-c-8a8a8e, #8A8A8E)'
    host.replaceChildren(empty)
    return
  }
  const note = document.createElement('div')
  note.textContent = 'ポップアップの中のリンクは、ポップアップの編集画面で直します（下書き→本番反映で公開）。'
  note.style.cssText = 'padding:8px 10px;font-size:12px;line-height:1.6;color:var(--sb-c-666666, #666666)'
  host.replaceChildren(
    note,
    ...popups.map((popup) => {
      const row = document.createElement('div')
      row.style.cssText =
        'display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--sb-c-eeeeee, #EEEEEE);font-size:12px'
      const name = document.createElement('span')
      name.textContent = popup.name === '' ? '名前のないポップアップ' : popup.name
      name.style.cssText = 'flex:1;min-width:0;overflow-wrap:anywhere;font-weight:700'
      const open = document.createElement('button')
      open.type = 'button'
      open.textContent = '開いて直す'
      open.style.cssText =
        'flex-shrink:0;padding:4px 10px;border:1px solid var(--sb-accent, #0091FF);border-radius:6px;background:transparent;color:var(--sb-accent, #0091FF);font-size:12px;cursor:pointer'
      open.addEventListener('click', openEditor)
      row.append(name, open)
      return row
    }),
  )
}
