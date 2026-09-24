/**
 * 保存するHTMLの組み立てと復元（editor.ts から分離）。
 *
 * エディタが扱うHTMLは「ヘッダー画像 + Quill本文」の2つでできている。
 * ヘッダー画像はQuillの外に置いた <img> なので、保存時に
 * `<!--header-image:src-->` というコメントで本文の先頭にくっつけ、
 * 読み込み時にまた分離してDOMへ戻す。この往復をここにまとめている。
 */
import type { EditorContext } from './editor-context.ts'
import { headerImageSrc, syncHeaderImage } from '../panels/header-image-dom.ts'

/**
 * 本文が「実質空」か。テキストも画像/動画等のメディアも無ければ空とみなす。
 * （`<p><br></p>` だけの土台初期状態や、リコンサイルで一瞬空になった状態を判定する。）
 */
export function isEffectivelyEmptyHtml(html: string): boolean {
  const probe = document.createElement('div')
  probe.innerHTML = html
  const hasMedia = probe.querySelector('img, video, iframe, audio, svg, canvas') !== null
  const text = (probe.textContent ?? '').replace(/\u200B/g, '').trim()
  return !hasMedia && text === ''
}
/** 保存用HTML = ヘッダー画像タグ + Quill本文 */
export function buildFullHtml(ctx: EditorContext): string {
  const headerSrc = headerImageSrc(ctx.root)
  const body = serializeQuillBody(ctx.quill.root)
  if (headerSrc !== null) {
    return `<!--header-image:${headerSrc}-->${body}`
  }
  return body
}
/**
 * Quill本文を保存用に直列化する。`sb-anim-run` は編集/プレビュー時のランタイム専用クラス
 * （properties-panel の replayAnims が付ける）。保存HTMLに残ると、配信LPで全アニメが
 * 「読み込み時に一斉再生」されてスクロール表示トリガが効かず、画面外で再生し終わって
 * 「アニメが動かない＝壊れている」ように見える（指示164）。保存前に必ず除去する。
 */
export function serializeQuillBody(rootEl: HTMLElement): string {
  if (rootEl.querySelector('.sb-anim-run') === null) return rootEl.innerHTML
  const clone = rootEl.cloneNode(true) as HTMLElement
  for (const el of clone.querySelectorAll('.sb-anim-run')) {
    el.classList.remove('sb-anim-run')
    if (el.getAttribute('class') === '') el.removeAttribute('class')
  }
  return clone.innerHTML
}
/** 保存HTMLからヘッダー画像srcを抽出し、本文を分離して返す */
export function splitHeaderFromHtml(html: string): { headerSrc: string | null; body: string } {
  const m = html.match(/^<!--header-image:(.+?)-->/)
  if (m !== null) {
    return { headerSrc: m[1] ?? null, body: html.slice(m[0].length) }
  }
  return { headerSrc: null, body: html }
}
/**
 * Versionを開いたときに、エディタの中身（ヘッダー画像＋本文）をそのVersionのものに入れ替える。
 *
 * - ヘッダー画像は「無いVersion」なら外す（外さないと前のVersionの画像が残り、自動保存で書き込まれていた・点検1）
 * - 入れ替えは利用者の編集ではない。Quill に `silent` で取り込ませて自動保存を起こさない
 *   （innerHTML の書き換えを Quill は「利用者の編集」として後から拾い、切り替えただけで保存が走っていた）
 * - 「戻る」の履歴を空にする（空にしないと、切り替えた直後の「戻る」で前のVersionの本文に戻り、
 *   それが今のVersionへ保存されていた・点検2）
 */
export function showVersionContent(ctx: Pick<EditorContext, 'root' | 'quill'>, html: string): void {
  const { headerSrc, body } = splitHeaderFromHtml(html)
  ctx.quill.root.innerHTML = body
  ctx.quill.update('silent')
  ctx.quill.history.clear()
  syncHeaderImage(ctx.root, headerSrc)
}
