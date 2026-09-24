/**
 * ポップアップの編集画面の「中身」（2026-09-24・中身は Widget編集と同じ画面で直すことにした）。
 *
 * 見え方の小さな絵と「中身を編集」ボタン。絵を押しても編集が開く。中身を直したら refresh() で描き直す。
 * 一覧のカードの絵も同じ drawPopupThumb で描く（プリセットの絵のままだと、直した中身が一覧に出ない）。
 */
import { el } from '../ui.ts'

export interface PopupContentCardOptions {
  readonly read: () => { html: string; css: string }
  readonly onEdit: () => void
  /** 配信で中身が出る幅（離脱防止は最大500px・追従型の帯は620px） */
  readonly renderWidth: number
  /** 中身が空のときに出す絵（プリセットの絵など。無ければ「中身なし」） */
  readonly emptyArt?: string
}

/** 中身のまわりに残す余白（iframe の中の px） */
const PAD = 8

/**
 * 小さな絵に描く中身（<script> は外す）。絵の iframe はスクリプトを動かさない作りなので、
 * 残すとブラウザが「実行を止めた」とエラーを出し続ける（2026-09-24 実測）
 */
export function thumbnailHtml(html: string): string {
  return html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
}

/**
 * 枠（target）に、ポップアップの今の中身を縮めて描く（編集画面の左上・一覧のカードで共通）。
 * iframe の中に描く（中身の <style> が外へ漏れない・スクリプトは動かさない）。読み込めたら中身の大きさを測って、
 * 枠いっぱいに収まるよう縮めて真ん中に置く（小さい中身も見えるように）。中身が空なら emptyArt（無ければ「中身なし」）
 */
export function drawPopupThumb(
  target: HTMLElement,
  content: { html: string; css: string },
  renderWidth: number,
  emptyArt?: string,
): void {
  const t = target // eslint-safe alias（no-param-reassign 回避）
  t.replaceChildren()
  if (content.html.trim() === '') {
    if (emptyArt !== undefined) t.innerHTML = emptyArt
    else t.textContent = '中身なし'
    return
  }
  t.style.position = 'relative'
  const frame = document.createElement('iframe')
  // スクリプトは動かさない。外から中身の大きさを測れるように同じオリジンだけ許す
  frame.setAttribute('sandbox', 'allow-same-origin')
  frame.setAttribute('tabindex', '-1')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText =
    `position:absolute;top:0;left:0;border:0;pointer-events:none;transform-origin:0 0;visibility:hidden;` +
    `width:${renderWidth}px;height:900px`
  frame.srcdoc =
    `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}` +
    `body{display:flex;justify-content:center;align-items:flex-start;padding:${PAD}px 0}${content.css}</style></head>` +
    `<body><div style="width:fit-content;max-width:100%">${thumbnailHtml(content.html)}</div></body></html>`
  frame.addEventListener('load', () => {
    const box = frame.contentDocument?.body.firstElementChild?.getBoundingClientRect()
    const boxW = t.clientWidth
    const boxH = t.clientHeight
    if (box === undefined || box.width === 0 || box.height === 0 || boxW === 0 || boxH === 0) {
      frame.style.visibility = 'visible'
      return
    }
    const w = box.width + PAD * 2
    const h = box.height + PAD * 2
    const scale = Math.min(boxW / w, boxH / h, 1)
    const tx = (boxW - w * scale) / 2 - (box.left - PAD) * scale
    const ty = (boxH - h * scale) / 2 - (box.top - PAD) * scale
    frame.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`
    frame.style.visibility = 'visible'
  })
  t.append(frame)
}

export function popupContentCard(options: PopupContentCardOptions): { el: HTMLElement; refresh: () => void } {
  const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:8px;flex-shrink:0;width:120px' })
  const thumb = el('button', { class: 'ep-form-thumb', style: 'border:none;padding:0;cursor:pointer' })
  thumb.setAttribute('type', 'button')
  thumb.title = '中身を編集'
  thumb.setAttribute('aria-label', '中身を編集')
  thumb.addEventListener('click', options.onEdit)

  const edit = el('button', {
    text: '中身を編集',
    style:
      'width:100%;padding:7px 0;border:1px solid var(--sb-accent,#0091FF);border-radius:6px;background:#fff;' +
      'color:var(--sb-accent,#0091FF);font-size:12px;font-weight:600;cursor:pointer',
  })
  edit.setAttribute('type', 'button')
  edit.dataset['popupContentEdit'] = 'true'
  edit.addEventListener('click', options.onEdit)

  const refresh = (): void => drawPopupThumb(thumb, options.read(), options.renderWidth, options.emptyArt)
  refresh()
  wrap.append(thumb, edit)
  return { el: wrap, refresh }
}
