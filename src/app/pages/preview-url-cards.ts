/**
 * プレビュー画面の上にある2枚のURLカード（プレビューURL / 配信URL）の配線。
 *
 * 採取した土台には見本のURL（`sample*.example.test`）が入っているので、
 * このシステムのURLへ差し替え、コピー・別タブのボタンをつなぐ。
 *
 * 配信URLは、ほかの画面（編集画面・基本情報・ページ一覧）と同じ決まりで出す（2026-10-13 本人が選んだ）:
 * フォルダにドメインがあればそのURL、無いときだけ「フォルダで設定してください」の案内。
 * 以前はドメインの機能が無かった頃の作りのまま、いつも「ドメインを設定すると使えるようになります」と出していた。
 */
import { toast } from '../ui.ts'
import { DELIVERY_QR_TEXTS, PREVIEW_QR_TEXTS, toggleQrPopover, type QrTexts } from '../panels/compare-qr.ts'
import { DELIVERY_DOMAIN_UNSET_NOTE } from './basic-info-form.ts'

export interface PreviewUrls {
  /** プレビューURL（計測されない・配信には使えない） */
  previewUrl: string
  /** 配信URL。フォルダにドメインが無いときは null */
  deliveryUrl: string | null
}

/** 文字だけのノード（`Node.TEXT_NODE`。テストの土台には `Node` が無いので数で持つ） */
const TEXT_NODE = 3

/** QRコードを出す部品（テストでは差し替える） */
export interface UrlCardDeps {
  showQr: (anchor: HTMLElement, url: string, texts: QrTexts) => void
}

/**
 * スマホ用CSS（mobile-css.ts）が縦に積むための目印。
 * PCは横に2枚（合わせて846px）で、スマホ幅だと左右が画面の外で切れていた。
 */
export const PREVIEW_URL_CLASS = {
  row: 'sb-preview-urls',
  column: 'sb-preview-url-col',
  card: 'sb-preview-url-card',
  /** スマホで「URLの行」と「ボタンの行」に分ける切れ目 */
  lineBreak: 'sb-preview-url-break',
} as const

export function wireUrlCards(
  root: HTMLElement,
  urls: PreviewUrls,
  deps: UrlCardDeps = { showQr: toggleQrPopover },
): void {
  // URLの入った <p>（テキストが http で始まる）を上から拾う。1枚目＝プレビューURL、2枚目＝配信URL
  const urlNodes = [...root.querySelectorAll<HTMLElement>('p')].filter((p) =>
    /^https?:\/\//.test((p.textContent ?? '').trim()),
  )

  // ラベルのテキストノード書き換え（採取DOM: 「作成中の確認用URL」→「プレビューURL」）
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    for (const child of el.childNodes) {
      if (child.nodeType !== TEXT_NODE) continue
      const t = child.textContent ?? ''
      if (t.includes('作成中の確認用URL')) child.textContent = t.replace('作成中の確認用URL', 'プレビューURL')
    }
  }

  urlNodes.forEach((node, index) => {
    const card = node.parentElement
    if (card === null) return
    markForMobile(card)
    if (index === 0) wirePreviewCard(node, card, urls.previewUrl, deps)
    else wireDeliveryCard(node, card, urls.deliveryUrl, deps)
  })

  // 配線しなかったリンクに、採取時の見本のURL（sample*.example.test）を残さない
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href*="example.test"]')) {
    a.setAttribute('href', urls.previewUrl)
    a.addEventListener('click', (e) => {
      e.preventDefault()
      window.open(urls.previewUrl, '_blank', 'noopener')
    })
  }
}

/**
 * カード → 列（カード＋下の注意書き）→ 行（2列を横に並べる入れ物）に目印を付ける。
 *
 * カードの中は「見出し・URL・ボタン3つ」が1行に並ぶ。スマホ幅ではURLの枠が85pxまで潰れたので、
 * 最初のボタンの前に切れ目を置き、スマホだけ「見出し＋URL」と「ボタン」の2行にする。
 * 切れ目はPCでは出さない（display:none ＝並びに関わらない）。
 */
function markForMobile(card: HTMLElement): void {
  card.classList.add(PREVIEW_URL_CLASS.card)
  const column = card.parentElement
  column?.classList.add(PREVIEW_URL_CLASS.column)
  column?.parentElement?.classList.add(PREVIEW_URL_CLASS.row)

  const firstButton = card.querySelector('button')
  if (firstButton === null) return
  const lineBreak = document.createElement('span')
  lineBreak.className = PREVIEW_URL_CLASS.lineBreak
  lineBreak.setAttribute('aria-hidden', 'true')
  lineBreak.style.display = 'none'
  firstButton.before(lineBreak)
}

function wirePreviewCard(node: HTMLElement, card: HTMLElement, previewUrl: string, deps: UrlCardDeps): void {
  node.textContent = previewUrl
  const note = document.createElement('span')
  note.textContent = '※計測されません'
  note.style.cssText = 'margin-left:12px;font-size:12px;color:#999999;white-space:nowrap;flex-shrink:0'
  card.append(note)
  wireCardButtons(card, previewUrl, PREVIEW_QR_TEXTS, deps)
}

function wireDeliveryCard(
  node: HTMLElement,
  card: HTMLElement,
  deliveryUrl: string | null,
  deps: UrlCardDeps,
): void {
  if (deliveryUrl !== null) {
    node.textContent = deliveryUrl
    wireCardButtons(card, deliveryUrl, DELIVERY_QR_TEXTS, deps)
    return
  }
  // フォルダにドメインが無い＝配信URLが無い。ほかの画面と同じ案内を出す。
  // URL用の枠（採取CSS: 1行・幅200pxまで・はみ出しは「…」）のままだと案内が途中で切れて読めないので、
  // 押せるもの（コピー・QR・別タブ）は隠し、空いた幅で折り返して全部見せる。
  // 幅の下限 300px＝2行に収まる幅（カードの高さは40px）。下限が無いと、狭い画面で1文字幅の縦長になる
  node.textContent = DELIVERY_DOMAIN_UNSET_NOTE
  node.style.cssText +=
    ';color:#999;max-width:none;width:auto;flex:1 1 auto;min-width:300px;white-space:normal;overflow:visible;line-height:1.4'
  for (const control of card.querySelectorAll<HTMLElement>('button, a')) {
    control.style.display = 'none'
  }
}

/** URLカード内のボタンを配線（左から コピー / QRコード / 別タブで開く） */
function wireCardButtons(card: HTMLElement, url: string, qrTexts: QrTexts, deps: UrlCardDeps): void {
  const buttons = [...card.querySelectorAll<HTMLElement>('button')]
  const copyBtn = buttons[0]
  const qrBtn = buttons[1]
  const links = [...card.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')]
  const openLink = links[links.length - 1]
  copyBtn?.addEventListener('click', (event) => {
    event.stopPropagation()
    void navigator.clipboard.writeText(url).then(() => toast('URLをコピーしました'))
  })
  qrBtn?.addEventListener('click', (event) => {
    event.stopPropagation()
    deps.showQr(qrBtn, url, qrTexts)
  })
  if (openLink !== undefined) {
    openLink.setAttribute('href', url)
    openLink.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      window.open(url, '_blank', 'noopener')
    })
  }
}
