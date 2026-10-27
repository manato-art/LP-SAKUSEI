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
import { isInPageHref, type LpLink } from '../../shared/link-html.ts'
import { LR_ICONS } from './link-replace-style.ts'

export interface RowsDeps {
  readonly selected: ReadonlySet<number>
  readonly onToggle: (index: number) => void
  /** 行の「計測あり／計測なし」を押した（その1本だけ切り替える・2026-10-27 指示⑭） */
  readonly onTrackingToggle?: (link: LpLink) => void
  /** 画像・動画の行の小さなサムネ（無ければ出さない・2026-10-27 指示㉗・link-replace-thumb.ts） */
  readonly thumbnail?: (link: LpLink) => HTMLElement | null
}

/** 文字の無いリンクの行に出す言葉 */
const EMPTY_TEXT: Readonly<Record<LpLink['kind'], string>> = {
  text: '（文字のないリンク）',
  image: '画像のリンク',
  video: '動画のリンク',
}

/** 文字の前に付ける小さな印（Widget・画像・動画）。見た目は link-replace-style.ts の .lr-tag */
function tag(label: string, attr: string, value = ''): HTMLElement {
  const el = document.createElement('span')
  el.className = 'lr-tag'
  el.setAttribute(attr, value)
  el.textContent = label
  return el
}

/**
 * 計測あり／計測なしの札。押すとその1本だけ切り替える（指示⑭ 本人「ここで計測ありなしを変更したい」）。
 * 行は label なので、押しても行のチェック（置換の選択）が動かないよう既定の動きを止める
 */
function trackingToggle(link: LpLink, onToggle: (link: LpLink) => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `lr-pill ${link.isTracking ? 'lr-pill--on' : 'lr-pill--off'}`
  button.setAttribute('data-link-tracking-toggle', link.isTracking ? 'on' : 'off')
  button.textContent = link.isTracking ? '計測あり' : '計測なし'
  button.title = link.isTracking ? '押すと計測なしにします' : '押すと計測ありにします'
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onToggle(link)
  })
  return button
}

/**
 * 一覧の行（2026-10-27 指示㉒ 本人の見本どおり）: 白いカードに チェック・題名（Widget・画像・動画の印）・
 * リンクのアイコン付きのURL・右に計測の札。「⋮」は付けない（本人「計測の右の：はいらない」）
 */
export function renderLinkRows(host: HTMLElement, links: readonly LpLink[], deps: RowsDeps): void {
  host.replaceChildren(
    ...links.map((link) => {
      const row = document.createElement('label')
      row.className = 'lr-row'
      row.setAttribute('data-link-row', String(link.index))
      const box = document.createElement('input')
      box.type = 'checkbox'
      box.className = 'lr-row__check'
      box.checked = deps.selected.has(link.index)
      box.addEventListener('change', () => deps.onToggle(link.index))
      const body = document.createElement('div')
      body.className = 'lr-row__body'
      const text = document.createElement('div')
      text.className = 'lr-row__title'
      text.textContent = link.text === '' ? EMPTY_TEXT[link.kind] : link.text
      // 画像・動画に付けたリンクは分かるように（2026-10-27 指示⑲）
      if (link.kind !== 'text') text.prepend(tag(link.kind === 'image' ? '画像' : '動画', 'data-link-kind', link.kind))
      // Widget の中のリンクは分かるように印を付ける（2026-10-27 指示⑬）
      if (link.inWidget) text.prepend(tag('Widget', 'data-link-widget'))
      const href = document.createElement('div')
      href.className = 'lr-row__url'
      href.innerHTML = LR_ICONS.link
      const hrefText = document.createElement('span')
      hrefText.textContent = link.href === '' ? '（行き先なし）' : link.href
      href.append(hrefText)
      body.append(text, href)
      row.append(box)
      const thumb = link.kind === 'text' ? null : (deps.thumbnail?.(link) ?? null)
      if (thumb !== null) row.append(thumb)
      row.append(body)
      // ページ内の移動（#faq）は計測の印を付けられないので札を出さない
      if (deps.onTrackingToggle !== undefined && !isInPageHref(link.href)) {
        row.append(trackingToggle(link, deps.onTrackingToggle))
      } else if (link.isTracking) {
        const pill = document.createElement('span')
        pill.className = 'lr-pill lr-pill--on'
        pill.textContent = '計測あり'
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
