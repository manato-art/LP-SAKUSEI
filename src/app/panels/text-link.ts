/**
 * 文字のリンク（右のプロパティ「書式」→ リンク）の「リンクを設定」（2026-09-25）。
 *
 * 以前は URL の欄だけで、付けたリンクには計測の目印が付かなかった（CLICK にも CV にも入らない）。
 * 目印を付けられる浮かぶツールバーは非表示なので、ここに「クリック数をレポートで数える」を置く。
 * 目印の付け方は他の入口と同じ（src/shared/link-html.ts・nocode/templates/kit.ts の linkAttrs）:
 *   http(s) などは URL に sb_tracking=true、電話は <a> の data-sb-tracking 属性、ページ内の # には付けない。
 * 新しいリンクは「数える」から始める（Widget の部品・リンク置換と同じ）。
 */
import { formCard } from '../dialog.ts'
import { TRACKING_ATTRIBUTE, isTelHref, isTrackingLink, withTrackingParam } from '../../shared/link-html.ts'

export interface TextLinkState {
  readonly url: string
  readonly tracking: boolean
}

interface Range {
  readonly index: number
  readonly length: number
}

/** 本文に反映するのに使う Quill の一部（テストでは代わりを渡す） */
export interface LinkQuill {
  formatText(index: number, length: number, name: string, value: string | false, source?: string): unknown
  getLines(index: number, length: number): ReadonlyArray<{ domNode: Node }>
}

/** いまのリンク（無ければ空）から、欄に出す URL とチェックの状態を作る */
export function textLinkState(href: string, trackingAttribute: string | null): TextLinkState {
  if (href === '') return { url: '', tracking: true }
  const url = isTelHref(href) || href.startsWith('#') ? href : withTrackingParam(href, false)
  return { url, tracking: isTrackingLink(href, trackingAttribute) }
}

/** 欄の URL とチェックから、本文に付ける href を作る */
export function textLinkHref(url: string, tracking: boolean): string {
  const trimmed = url.trim()
  if (isTelHref(trimmed) || trimmed.startsWith('#')) return trimmed
  return withTrackingParam(trimmed, tracking)
}

/** 選んでいる範囲の中の、指定した href の <a> */
function anchorsIn(quill: LinkQuill, range: Range, href: string): HTMLAnchorElement[] {
  return quill
    .getLines(range.index, Math.max(range.length, 1))
    .flatMap((line) => [...(line.domNode as ParentNode).querySelectorAll<HTMLAnchorElement>('a')])
    .filter((a) => a.getAttribute('href') === href)
}

/** 選んでいる文字のリンクの href と、電話の計測の属性を読む（リンクが無ければ空） */
export function readTextLink(quill: LinkQuill, range: Range, href: string): { href: string; trackingAttribute: string | null } {
  if (href === '') return { href: '', trackingAttribute: null }
  const anchor = anchorsIn(quill, range, href)[0]
  return { href, trackingAttribute: anchor?.getAttribute(TRACKING_ATTRIBUTE) ?? null }
}

/** 本文に反映する。URL が空なら外す */
export function applyTextLink(quill: LinkQuill, range: Range, state: TextLinkState): void {
  const url = state.url.trim()
  if (url === '' || url === 'https://') {
    quill.formatText(range.index, range.length, 'link', false, 'user')
    return
  }
  const href = textLinkHref(url, state.tracking)
  quill.formatText(range.index, range.length, 'link', href, 'user')
  // 電話は URL に目印を付けられないので <a> に属性で付ける（保存は本文の DOM をそのまま使う）
  if (!isTelHref(href)) return
  for (const anchor of anchorsIn(quill, range, href)) {
    if (state.tracking) anchor.setAttribute(TRACKING_ATTRIBUTE, 'true')
    else anchor.removeAttribute(TRACKING_ATTRIBUTE)
  }
}

/** 「リンクを設定」の窓。取り消しなら null */
export async function openTextLinkDialog(initial: TextLinkState): Promise<TextLinkState | null> {
  const body = document.createElement('div')
  body.style.cssText = 'display:flex;flex-direction:column;gap:14px;min-width:0'

  const urlLabel = document.createElement('label')
  urlLabel.style.cssText = 'display:flex;flex-direction:column;min-width:0'
  const urlText = document.createElement('span')
  urlText.className = 'sbd-label'
  urlText.textContent = 'リンク先のURL（空にすると解除します）'
  const url = document.createElement('input')
  url.type = 'text'
  url.className = 'sbd-input'
  url.value = initial.url
  url.placeholder = 'https://'
  urlLabel.append(urlText, url)

  const track = document.createElement('input')
  track.type = 'checkbox'
  track.checked = initial.tracking
  track.dataset['textLinkTrack'] = '1'
  track.style.cssText = 'width:18px;height:18px;margin:1px 0 0;flex-shrink:0;accent-color:var(--sb-accent, #0091FF)'
  const trackRow = document.createElement('label')
  trackRow.style.cssText = 'display:flex;gap:8px;align-items:flex-start;cursor:pointer'
  const trackText = document.createElement('span')
  const trackTitle = document.createElement('span')
  trackTitle.textContent = 'クリック数をレポートで数える'
  trackTitle.style.cssText = 'font-size:13px;color:var(--sb-c-1f2937, #1F2937)'
  const trackNote = document.createElement('span')
  trackNote.textContent = '申し込みボタンなどは入れておきます。押された数が CLICK に入り、そのあとの申し込みが CV に結びつきます。'
  trackNote.style.cssText = 'display:block;font-size:11px;color:var(--sb-c-6b7280, #6B7280);line-height:1.7;margin-top:2px'
  trackText.append(trackTitle, trackNote)
  trackRow.append(track, trackText)

  body.append(urlLabel, trackRow)

  let result: TextLinkState | null = null
  const ok = await formCard({
    title: 'リンクを設定',
    body,
    submitLabel: '設定する',
    onSubmit: async () => {
      result = { url: url.value.trim(), tracking: track.checked }
      return null
    },
  })
  return ok ? result : null
}
