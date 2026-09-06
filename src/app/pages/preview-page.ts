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
import { setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'
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

  // 旧ナビを新タブバー＋パンくずに置き換え（他ページと統一）
  setupHorizTabs(root, 'version', { abTestUid, folderUid: folder?.uid ?? '' })
  setupBreadcrumb(root, folder?.name ?? '', ab_test.title, folder?.uid)

  wireUrlCards(root, abTestUid, version)
  fillPreviewIframe(root, version, styleCss, exit_popups.filter((p) => p.enabled))
}

/**
 * URLカードを実SBの表示に合わせて配線する。
 *
 * 実SBの構成（指示111・スクショ確認済み）:
 *   配信URL:       「ドメインを設定すると使えるようになります」（更新ボタン付き）
 *   プレビューURL:  https://sb-draft-preview.… + 「※計測されません」
 *
 * クローンではドメイン設定機能が無いので:
 *   配信URL:       「ドメインを設定すると使えるようになります」（そのまま）
 *   プレビューURL:  localhost起点のプレビューURL + 「※計測されません」
 *
 * ⚠️ squadbeyond.com は使わない（実サイトへ飛んでしまう）。
 */
function wireUrlCards(root: HTMLElement, _abTestUid: string, version: Version | undefined): void {
  const origin = location.origin
  const previewUrl =
    version === undefined ? `${origin}/#/preview` : `${origin}/#/preview/${version.uid}`

  // URLの入った <p>（テキストが http で始まる or sample で始まる）を上から拾う
  const urlNodes = [...root.querySelectorAll<HTMLElement>('p')].filter((p) =>
    /^https?:\/\//.test((p.textContent ?? '').trim()),
  )

  // ラベルのテキストノード書き換え（採取DOM: 「作成中の確認用URL」→「プレビューURL」）
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    for (const child of el.childNodes) {
      if (child.nodeType !== Node.TEXT_NODE) continue
      const t = child.textContent ?? ''
      if (t.includes('作成中の確認用URL')) child.textContent = t.replace('作成中の確認用URL', 'プレビューURL')
    }
  }

  urlNodes.forEach((node, index) => {
    const card = node.parentElement
    if (card === null) return

    if (index === 0) {
      // ── プレビューURL ──
      node.textContent = previewUrl
      // 「※計測されません」注釈を追加
      const note = document.createElement('span')
      note.textContent = '※計測されません'
      note.style.cssText =
        'margin-left:12px;font-size:12px;color:#999;white-space:nowrap;flex-shrink:0'
      card.append(note)
      wireCardButtons(card, previewUrl)
    } else {
      // ── 配信URL ──
      node.textContent = 'ドメインを設定すると使えるようになります'
      node.style.color = '#999'
      // 配信URLはコピー・開くボタンを無効化（URLが無いため）
      for (const btn of card.querySelectorAll<HTMLElement>('button, a')) {
        btn.style.opacity = '0.4'
        btn.style.pointerEvents = 'none'
      }
    }
  })

  // リンクの href も書き換え（採取時の sample*.example.test を排除）
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href*="example.test"]')) {
    a.href = previewUrl
    a.addEventListener('click', (e) => {
      e.preventDefault()
      window.open(previewUrl, '_blank', 'noopener')
    })
  }
}

/** URLカード内のコピー/別タブボタンを配線 */
function wireCardButtons(card: HTMLElement, url: string): void {
  const buttons = [...card.querySelectorAll('button')]
  const copyBtn = buttons[0]
  const links = [...card.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')]
  const openLink = links[links.length - 1]
  copyBtn?.addEventListener('click', (event) => {
    event.stopPropagation()
    void navigator.clipboard.writeText(url).then(() => toast('URLをコピーしました'))
  })
  if (openLink !== undefined) {
    openLink.href = url
    openLink.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      window.open(url, '_blank', 'noopener')
    })
  }
}

/** 保存HTMLからヘッダー画像コメントを抽出し、imgタグ + 本文に分離 */
function extractHeaderImage(html: string): { headerHtml: string; body: string } {
  const m = html.match(/^<!--header-image:(.+?)-->/)
  if (m !== null) {
    const src = m[1] ?? ''
    return {
      headerHtml: `<img src="${src}" style="display:block;width:100%;object-fit:cover;position:sticky;top:0;z-index:10;max-height:200px" alt="ヘッダー画像">`,
      body: html.slice(m[0].length),
    }
  }
  return { headerHtml: '', body: html }
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

  // ヘッダー画像をHTMLコメントから復元
  const { headerHtml, body } = extractHeaderImage(version.html)

  doc.open()
  doc.write(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
      `<style>body{margin:0;font-family:"Hiragino Sans",sans-serif}${LP_BASE_CSS}${version.css}${styleCss}</style>` +
      `</head><body>${headerHtml}${withAutoplayVideos(body)}${popupSnippets}</body></html>`,
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
