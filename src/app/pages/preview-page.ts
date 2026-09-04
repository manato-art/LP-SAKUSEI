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
import { api, type ExitPopup, type Version } from '../api.ts'
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

  const [{ ab_test }, { articles }, { exit_popups }] = await Promise.all([
    api.abTest(abTestUid),
    api.articles(abTestUid),
    api.exitPopups(abTestUid),
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
  fillPreviewIframe(root, version, styleCss, exit_popups.filter((p) => p.enabled))
}

/**
 * URLカードのURLを、クローンの（localhost起点の）URLへ差し替え、コピー/別タブを配線する。
 * 実DOMでは URL は `<p>` に入り、直後にコピー・QR・別タブのアイコンボタンが並ぶ。
 */
function wireUrlCards(root: HTMLElement, abTestUid: string, version: Version | undefined): void {
  const origin = location.origin
  const urls = [
    version === undefined ? `${origin}/#/preview` : `${origin}/#/preview/${version.uid}`,
    `${origin}/lp/${abTestUid}`,
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
  popups: readonly ExitPopup[] = [],
): void {
  const frame = root.querySelector<HTMLIFrameElement>('#previewIframe')
  if (frame === null || version === undefined) return
  const doc = frame.contentDocument
  if (doc === null) return

  // 離脱防止ポップアップのHTMLを構築（プレビュー用: 即時表示ボタン付き）
  const popupSnippets = popups.map((p) => buildPreviewPopupSnippet(p)).join('')

  doc.open()
  doc.write(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
      `<style>body{margin:0;font-family:"Hiragino Sans",sans-serif}${LP_BASE_CSS}${version.css}${styleCss}</style>` +
      `</head><body>${withAutoplayVideos(version.html)}${popupSnippets}</body></html>`,
  )
  doc.close()
}

/**
 * プレビュー用ポップアップスニペット。配信版と同じオーバーレイ構造だが、
 * プレビューでは即座に表示確認できるよう、離脱トリガーの代わりに
 * フローティングボタンで開閉する。
 */
function buildPreviewPopupSnippet(popup: ExitPopup): string {
  const popupId = `exit-popup-${popup.uid}`
  const animClass = popup.animation !== 'none' ? popup.animation : ''

  // プレビュー用: フローティングボタンで開閉 + ep-show イベントで内部アニメ起動
  const previewScript = `(function(){
    var epId='${popupId}';
    var overlay=document.getElementById(epId);
    if(!overlay)return;
    var fired=false;

    // 内部アニメーションJS
    ${popup.javascript}

    // トグルボタン
    var btn=document.getElementById('${popupId}-trigger');
    if(btn)btn.addEventListener('click',function(){
      var v=overlay.classList.toggle('visible');
      if(v&&!fired){fired=true;try{overlay.dispatchEvent(new CustomEvent('ep-show'))}catch(e){}}
    });
    // 閉じる
    overlay.addEventListener('click',function(e){
      if(e.target===overlay||e.target.classList.contains('ep-close'))overlay.classList.remove('visible');
    });
  })()`

  return `
    <style>
      @keyframes epFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes epSlideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
      @keyframes epSlideDown{from{opacity:0;transform:translateY(-30px)}to{opacity:1;transform:translateY(0)}}
      @keyframes epSlideLeft{from{opacity:0;transform:translateX(-50px)}to{opacity:1;transform:translateX(0)}}
      @keyframes epSlideRight{from{opacity:0;transform:translateX(50px)}to{opacity:1;transform:translateX(0)}}
      @keyframes epZoomIn{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
      @keyframes epBounceIn{0%{opacity:0;transform:scale(.3)}50%{opacity:1;transform:scale(1.05)}70%{transform:scale(.95)}100%{opacity:1;transform:scale(1)}}
      @keyframes epElastic{0%{opacity:0;transform:scale(.5)}55%{opacity:1;transform:scale(1.12)}75%{transform:scale(.96)}100%{opacity:1;transform:scale(1)}}
      @keyframes epFlipIn{0%{opacity:0;transform:perspective(400px) rotateX(90deg)}40%{transform:perspective(400px) rotateX(-10deg)}70%{transform:perspective(400px) rotateX(10deg)}100%{opacity:1;transform:perspective(400px) rotateX(0)}}
      @keyframes epConfettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(400px) rotate(720deg);opacity:0}}
      @keyframes epPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
      .ep-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:99999;display:none;align-items:center;justify-content:center}
      .ep-overlay.visible{display:flex}
      .ep-content{max-width:500px;width:90%;max-height:80vh;overflow:auto;position:relative}
      .ep-content.fade{animation:epFadeIn .3s ease}
      .ep-content.slideUp{animation:epSlideUp .4s ease}
      .ep-content.slideDown{animation:epSlideDown .4s ease}
      .ep-content.slideLeft{animation:epSlideLeft .4s ease}
      .ep-content.slideRight{animation:epSlideRight .4s ease}
      .ep-content.zoomIn{animation:epZoomIn .3s ease}
      .ep-content.bounceIn{animation:epBounceIn .6s ease}
      .ep-content.elastic{animation:epElastic .8s ease}
      .ep-content.flipIn{animation:epFlipIn .6s ease}
      .ep-close{position:absolute;top:-12px;right:-12px;width:28px;height:28px;border-radius:50%;background:#fff;border:1px solid #ddd;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.15);z-index:1}
      .ep-preview-trigger{position:fixed;bottom:16px;right:16px;background:#0091FF;color:#fff;border:none;border-radius:24px;padding:8px 16px;font-size:12px;cursor:pointer;z-index:99998;box-shadow:0 2px 8px rgba(0,0,0,.2)}
    </style>
    <div id="${popupId}" class="ep-overlay">
      <div class="ep-content ${animClass}">
        <button class="ep-close">✕</button>
        ${popup.html}
      </div>
    </div>
    <button id="${popupId}-trigger" class="ep-preview-trigger">
      ポップアップ: ${popup.name.substring(0, 10)}
    </button>
    <script>${previewScript}<\/script>
  `
}
