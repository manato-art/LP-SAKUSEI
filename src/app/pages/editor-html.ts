/**
 * 保存するHTMLの組み立てと復元（editor.ts から分離）。
 *
 * エディタが扱うHTMLは「ヘッダー画像 + Quill本文」の2つでできている。
 * ヘッダー画像はQuillの外に置いた <img> なので、保存時に
 * `<!--header-image:src-->` というコメントで本文の先頭にくっつけ、
 * 読み込み時にまた分離してDOMへ戻す。この往復をここにまとめている。
 */
import type { EditorContext } from './editor-context.ts'

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
/** ヘッダー画像のsrcを取得（無ければnull） */
function getHeaderImageSrc(root: HTMLElement): string | null {
  const img = root.querySelector<HTMLImageElement>('img[data-clone-header="true"]')
  return img?.src ?? null
}
/** 保存用HTML = ヘッダー画像タグ + Quill本文 */
export function buildFullHtml(ctx: EditorContext): string {
  const headerSrc = getHeaderImageSrc(ctx.root)
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
/** ヘッダー画像をDOMに復元する */
export function restoreHeaderImage(root: HTMLElement, src: string): void {
  const headerBox = root.querySelector<HTMLElement>('[class*="_articleHeaderPhoto_"]')
  if (headerBox === null) return
  headerBox.style.position = 'relative'
  headerBox.style.border = 'none'
  headerBox.style.padding = '0'
  headerBox.style.margin = '0'
  headerBox.style.outline = 'none'
  headerBox.style.background = '#fff'
  let img = headerBox.querySelector<HTMLImageElement>('img[data-clone-header="true"]')
  if (img === null) {
    img = document.createElement('img')
    img.dataset['cloneHeader'] = 'true'
    img.style.cssText = 'display:block;width:100%;max-height:200px;object-fit:cover;border-radius:0'
    headerBox.prepend(img)
  }
  img.src = src
  // 青い点線枠の内側要素(sample_token)と案内文を全て隠す
  for (const el of headerBox.querySelectorAll<HTMLElement>('[class*="sample_token"]')) {
    el.style.display = 'none'
  }
  const spans = headerBox.querySelectorAll<HTMLElement>('span')
  for (const s of spans) {
    if (s.textContent?.trim() === 'ヘッダー画像を追加する') s.style.display = 'none'
  }
  // 削除ボタンがなければ追加
  if (headerBox.querySelector('[data-clone-header-remove]') === null) {
    const remove = document.createElement('button')
    remove.dataset['cloneHeaderRemove'] = 'true'
    remove.type = 'button'
    remove.textContent = '削除'
    remove.title = 'ヘッダー画像を削除'
    remove.style.cssText =
      'position:absolute;top:15px;right:15px;z-index:2;padding:8px 16px;border:none;border-radius:6px;' +
      'background:#fff;color:var(--sb-accent, #0091FF);font-size:14px;line-height:1;cursor:pointer;' +
      'box-shadow:0 1px 4px rgba(0,0,0,.2)'
    remove.addEventListener('click', (event) => {
      event.stopPropagation()
      // 画像を消す
      headerBox.querySelector('img[data-clone-header="true"]')?.remove()
      remove.remove()
      const prompt = [...headerBox.querySelectorAll<HTMLElement>('span')].find(
        (s) => s.textContent?.trim() === 'ヘッダー画像を追加する',
      ) ?? null
      if (prompt !== null) prompt.style.display = ''
      headerBox.style.border = ''
      headerBox.style.padding = ''
      headerBox.style.margin = ''
      headerBox.style.outline = ''
    })
    headerBox.append(remove)
  }
}
