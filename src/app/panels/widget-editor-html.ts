/**
 * Widget の HTML から、編集画面に要るものを取り出す小さな道具（widget-editor.ts から分離・2026-09-23）。
 * Widget編集（widget-studio.ts）と、設置済みWidgetのカード（widget-nav.ts）の両方から使う。
 */
import { templateById } from './nocode/templates/index.ts'

/** Widget の innerHTML から style タグの CSS を抽出する。 */
export function extractCss(node: HTMLElement): string {
  const styles: string[] = []
  for (const style of node.querySelectorAll('style')) {
    styles.push(style.textContent ?? '')
  }
  for (const style of document.head.querySelectorAll('style[data-widget-css]')) {
    styles.push(style.textContent ?? '')
  }
  return styles.join('\n').trim()
}

/** Widget の innerHTML から style タグを除いた HTML を抽出する。 */
export function extractHtml(node: HTMLElement): string {
  const clone = node.cloneNode(true) as HTMLElement
  for (const style of clone.querySelectorAll('style')) style.remove()
  return clone.innerHTML.trim()
}

/** 画面に見える文字だけ（script・style などの中身は入れない） */
export function visibleTextOf(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const hidden of doc.body.querySelectorAll('script,style,noscript,template')) hidden.remove()
  return doc.body.textContent ?? ''
}

/**
 * 型から作ったWidget（外側に data-nocode）なら型の名前（「よくある質問」）。
 * 無ければ undefined（クラス名の「nc」を名前にしない）。
 */
export function templateNameOf(html: string): string | undefined {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const type = doc.body.firstElementChild?.getAttribute('data-nocode')
  return type === null || type === undefined ? undefined : templateById(type)?.name
}

/** Widget の HTML から名前を推定する（型の名前・最初のクラス名・テキストの順）。 */
export function guessWidgetName(html: string): string {
  const templateName = templateNameOf(html)
  if (templateName !== undefined) return templateName
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const firstEl = doc.body.firstElementChild
  const cls = firstEl?.className ?? ''
  const firstText = doc.body.textContent?.trim().substring(0, 30) ?? ''
  if (cls !== '') return (cls.split(/\s+/)[0] ?? firstText) || 'Widget'
  return firstText || 'Widget'
}
