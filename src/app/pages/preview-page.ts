/**
 * プレビュー画面（右レール「プレビュー」＝新しいタブで開く実ルート
 * `/ab_tests/:abTestUid/articles/:stepUid/previews`・企画書 §9-1 / §11）。
 *
 * 実物は**アプリのシェル内**に、上部2枚のURLカード（作成中の確認用URL / 配信URL）と、
 * 3カラムのプレビュー枠（設置済みリンク｜LPプレビュー iframe｜設置済みウィジェット名）を出す。
 * 見た目は採取した実DOM＋実CSSがそのまま担保する（手書きで似せない）。ここでは
 * ①URLをクローンのものへ差し替え、②コピー/別タブを配線、③中央iframeへ保存済みLPを流し込む。
 * 本番へは一切出さない（§3-2・URLは localhost 起点／iframe はローカルの html・css）。
 */
import substrate from '../fragments/ab_tests__UID__articles__UID__previews__default.html?raw'
import { api, type Version } from '../api.ts'
import { isStale } from '../main.ts'
import { toast } from '../ui.ts'
import { mountCapturedPage, setTopBarNames, wireBackLink, wireCapturedLinks } from './report-dom.ts'
import { LP_BASE_CSS } from '../lp-base-css.ts'
import { masterStyleIframeCss } from '../master-style.ts'
import { withAutoplayVideos } from '../lp-video.ts'

export async function renderPreview(
  container: HTMLElement,
  abTestUid: string,
  stepUid: string,
  generation?: number,
): Promise<void> {
  container.innerHTML = ''

  const [{ ab_test }, { articles }] = await Promise.all([
    api.abTest(abTestUid),
    api.articles(abTestUid),
  ])
  const articleUid = articles[0]?.uid
  if (articleUid === undefined) {
    container.textContent = '記事が見つかりません'
    return
  }
  const { versions } = await api.versions(articleUid)
  const folders = await api.folders()
  const folder = folders.folders.find((f) => f.id === ab_test.folder_id)
  // ステップ（＝Version）uid で開く。無ければ先頭Version。
  const version = versions.find((v) => v.uid === stepUid) ?? versions[0]
  // 記事設定（Version設定）をプレビューにも反映
  const styleCss = masterStyleIframeCss((await api.masterStyleSheet(articleUid)).master_style_sheet)

  if (generation !== undefined && isStale(generation)) return

  const root = mountCapturedPage(container, substrate)
  wireCapturedLinks(root, substrate, abTestUid)
  wireBackLink(root, folder?.uid ?? null)
  setTopBarNames(root, ab_test.title, folder?.name ?? '')

  wireUrlCards(root, abTestUid, version)
  fillPreviewIframe(root, version, styleCss)
}

/**
 * URLカードのURLを、クローンの（localhost起点の）URLへ差し替え、コピー/別タブを配線する。
 * 実DOMでは URL は `<p>` に入り、直後にコピー・QR・別タブのアイコンボタンが並ぶ。
 */
function wireUrlCards(root: HTMLElement, abTestUid: string, version: Version | undefined): void {
  const origin = location.origin
  const urls = [
    version === undefined ? `${origin}/#/preview` : `${origin}/#/preview/${version.uid}`,
    `${origin}/#/ab/${abTestUid}`,
  ]
  // URLの入った <p>（テキストが http で始まる）を上から拾う
  const urlNodes = [...root.querySelectorAll<HTMLElement>('p')].filter((p) =>
    /^https?:\/\//.test((p.textContent ?? '').trim()),
  )
  urlNodes.forEach((node, index) => {
    const url = urls[Math.min(index, urls.length - 1)] ?? ''
    node.textContent = url
    // カード内のアイコンボタン: 1つ目＝コピー / 最後＝別タブ（実物のアイコン並び）
    const card = node.parentElement
    if (card === null) return
    const buttons = [...card.querySelectorAll('button')]
    const copyBtn = buttons[0]
    const openBtn = buttons[buttons.length - 1]
    copyBtn?.addEventListener('click', (event) => {
      event.stopPropagation()
      void navigator.clipboard.writeText(url).then(() => toast('URLをコピーしました'))
    })
    if (openBtn !== undefined && openBtn !== copyBtn) {
      openBtn.addEventListener('click', (event) => {
        event.stopPropagation()
        window.open(url, '_blank', 'noopener')
      })
    }
  })
}

/** 中央のプレビュー iframe に、保存済みの html/css を流し込む（本番へは出さない） */
function fillPreviewIframe(
  root: HTMLElement,
  version: Version | undefined,
  styleCss: string,
): void {
  const frame = root.querySelector<HTMLIFrameElement>('#previewIframe')
  if (frame === null || version === undefined) return
  const doc = frame.contentDocument
  if (doc === null) return
  doc.open()
  doc.write(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
      `<style>body{margin:0;font-family:"Hiragino Sans",sans-serif}${LP_BASE_CSS}${version.css}${styleCss}</style>` +
      `</head><body>${withAutoplayVideos(version.html)}</body></html>`,
  )
  doc.close()
}
