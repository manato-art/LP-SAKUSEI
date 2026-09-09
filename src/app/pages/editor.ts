/**
 * LPエディタ（企画書 §9-1 / §11 capture-and-rehydrate）。
 *
 * **手書きでUIを似せない。** 採取した実DOMをそのまま土台として描画し、
 * `data-test` 属性を目印に挙動だけを付ける（＝企画書 §11 の「島」の再実装）。
 * 見た目は本物のマークアップ＋実CSS（Emotion含む）で担保される。
 */
import Quill from 'quill'
// bubbleテーマは独自のツールチップUIを作ってしまうので使わない。
// 採取した実物のツールバーを使うため、Quillは**テーマ無し**＋coreのCSSだけにする。
import 'quill/dist/quill.core.css'
import substrate from '../fragments/ab_tests__UID__articles__editor-target.html?raw'
import { api } from '../api.ts'
import type { EditorContext } from './editor-context.ts'
import { HOOK } from './editor-hooks.ts'
import { loadVersion, renderVersionList } from './editor-version-list.ts'
import {
  applyMasterStyleToEditor,
  mountHeaderExtras,
  wireSideToolbar,
} from './editor-layout.ts'
import { isStale } from '../main.ts'
import { T, el, toast } from '../ui.ts'
import { recordHistory } from './folders.ts'
import { mountVersionListDropdown } from '../panels/version-actions.ts'
import { mountHeaderImageModal } from '../panels/header-image-modal.ts'
import { mountEditorScrollbar } from '../panels/editor-scrollbar.ts'
import { mountVersionLinkPopup } from '../panels/version-link-popup.ts'
import { mountStepAddModal } from '../panels/step-add-modal.ts'
import { registerMediaBlots } from '../panels/media-blots.ts'
import { wireMediaDrop } from '../panels/media-insert.ts'
import { wireImageResize } from '../panels/image-resize.ts'
import { wireAbTestTabs, setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'
import { wireBeyondNavAnchors } from './beyond-nav.ts'
import { injectMockupMasterStyles, applyMockupClasses } from '../styles/mockup-master.ts'
import { injectQuillScrollFix, injectVersionFilterCss } from './editor-styles.ts'


/** 配線済みのツール（未実装トーストを出さない） */




/** エディタ土台の描画までの一瞬に出す読み込み表示（クリック直後の blank を埋める）。 */
function editorLoadingPlaceholder(): HTMLElement {
  const spinner = el('div', {
    style: `width:28px;height:28px;border:3px solid #E5E7EB;border-top-color:${T.primary};
      border-radius:50%;animation:sbspin .8s linear infinite`,
  })
  // キーフレームは一度だけ注入する（重複させない）
  if (document.getElementById('sb-editor-spin-kf') === null) {
    const style = document.createElement('style')
    style.id = 'sb-editor-spin-kf'
    style.textContent = '@keyframes sbspin{to{transform:rotate(360deg)}}'
    document.head.append(style)
  }
  return el(
    'div',
    {
      style: `display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:14px;height:70vh;color:${T.sub};font-family:${T.font};font-size:13px`,
    },
    [spinner, el('div', { text: 'エディタを起動しています…' })],
  )
}

export async function renderEditor(
  container: HTMLElement,
  abTestUid: string,
  generation?: number,
): Promise<void> {
  container.innerHTML = ''
  // ページ名クリック直後は土台の描画（大きな実DOM）とQuill生成で一瞬 blank になる。
  // 何も出ないと「起動が長い」と感じるので、即座に読み込み表示を出す（描画完了で消す）。
  container.style.flex = '1'
  container.style.minWidth = '0'
  const loader = editorLoadingPlaceholder()
  container.append(loader)

  const [{ ab_test }, { articles }] = await Promise.all([
    api.abTest(abTestUid),
    api.articles(abTestUid),
  ])
  const articleUid = articles[0]?.uid
  if (articleUid === undefined) {
    container.innerHTML = ''
    container.textContent = '記事が見つかりません'
    return
  }
  // versions は articleUid に依存するが、folders は独立なので並行取得する（体感の短縮）。
  const [{ versions }, folders] = await Promise.all([api.versions(articleUid), api.folders()])
  const folder = folders.folders.find((f) => f.id === ab_test.folder_id)
  const folderName = folder?.name ?? ''

  // API待ちの間に新しい描画が始まっていたら、ここで降りる（二重描画の防止）
  if (generation !== undefined && isStale(generation)) return

  // beyondページを開いた操作を履歴に記録
  recordHistory(abTestUid, ab_test.title, 'ab_test', '編集')
  loader.remove()

  /**
   * 土台を描画（本物のDOMをそのまま）。
   * 実機のLayout実測（capture/clean/.../editor-target/layout.json）:
   *   editorWrapper   1085×626  display:flex  max-width:1100px  padding:20px
   *   Versionパネル    230×626
   *   コンテンツ枠      620×500
   *   quillIframe     620×486
   *   右レール          50×506   display:flex  padding:20px 0
   *   上部ナビ         1085×80
   * 実CSSが `height: calc(100% - 120px)` を前提にしているため、
   * 差し込み先に高さを与えないとレイアウトが潰れる。
   */
  // container はシェルのコンテンツ枠（`flex:1; min-width:0` が入っている）。
  // 指示㊿②: container 自体はスクロールさせない（キャンバスのみスクロールする）。
  // overflow:hidden で外枠のスクロールを止め、キャンバス（quillEditorContentWrapper）だけ動かす。
  container.style.flex = '1'
  container.style.minWidth = '0'
  container.style.height = '100vh'
  container.style.overflow = 'hidden'
  const root = document.createElement('div')
  root.style.cssText = 'height:100%'
  root.innerHTML = substrate
  container.append(root)

  // ── モック準拠マスタースタイルシート（全CSSを1枚で注入） ──
  injectMockupMasterStyles()

  // ── 重複サイドバーの除去 ──
  // 採取テンプレートにはサイドバー（css-1v797yu）が丸ごと含まれており、
  // position:fixed; left:0; z-index:101 でシェルの本物サイドバーを覆い隠す。
  // 除去してシェル側の配線済みサイドバーを露出させる。
  const dupSidebar = root.querySelector<HTMLElement>('.css-1v797yu')
  const dupSidebarParent = dupSidebar?.parentElement ?? null
  if (dupSidebar !== null) dupSidebar.remove()
  // 除去したサイドバーの幅分（60px）のパディングが残っているので消す。
  // これが残ると左サイドバーと4タブナビの間に空白ができる（指示137）。
  const mainContent = root.querySelector<HTMLElement>('.css-1n8b1pi')
  if (mainContent !== null) mainContent.style.setProperty('padding-left', '0', 'important')
  // 指示137: 採取物のクラスが変わっても空白が残らないよう、サイドバーが入っていた
  // コンテナ（親）の**直下要素だけ**を見て、~サイドバー幅(40〜80px)の左パディング/
  // マージンを詰める。全要素の総当りは正当な余白まで消すのでしない。
  if (dupSidebarParent !== null) {
    for (const child of dupSidebarParent.children) {
      if (!(child instanceof HTMLElement)) continue
      const cs = getComputedStyle(child)
      if (parseFloat(cs.paddingLeft) >= 40 && parseFloat(cs.paddingLeft) <= 80) {
        child.style.setProperty('padding-left', '0', 'important')
      }
      if (parseFloat(cs.marginLeft) >= 40 && parseFloat(cs.marginLeft) <= 80) {
        child.style.setProperty('margin-left', '0', 'important')
      }
    }
  }

  // ── 指示159: 左レールと本文の間に残る「謎の空白」をクラス名に依存せず実測で詰める ──
  // 上の除去はデモ採取物のクラス（css-1n8b1pi 等）に固定しているため、本番の実採取で
  // クラス名が違うと取りこぼし、レール分(約60px)の左パディング/マージンが残って空白になる。
  // ここではクラスに依存せず「レール直後・背が高い・サイドバー幅の左余白を持つ」コンテナ
  // だけを狙って詰める（誤爆防止のため範囲を厳しく限定：ローカルでは該当0＝実質no-op）。
  const closeRailGap = (): void => {
    const railEl = document.querySelector<HTMLElement>('.sb-rail')
    const railW = railEl !== null ? railEl.getBoundingClientRect().width : 60
    for (const el of root.querySelectorAll<HTMLElement>('*')) {
      const r = el.getBoundingClientRect()
      if (r.height < 200) continue // 背の高いコンテナのみ
      if (r.left > railW + 100) continue // レール直後（左端近く）だけ
      const cs = getComputedStyle(el)
      const pl = parseFloat(cs.paddingLeft)
      const ml = parseFloat(cs.marginLeft)
      if (pl >= 40 && pl <= 100) el.style.setProperty('padding-left', '0', 'important')
      if (ml >= 40 && ml <= 100) el.style.setProperty('margin-left', '0', 'important')
    }
  }
  // レイアウト確定後・フォント読込後にも効くよう複数回叩く（gap>4のときだけ作用＝冪等）
  closeRailGap()
  requestAnimationFrame(closeRailGap)
  setTimeout(closeRailGap, 200)

  // ── 指示57: 上部ナビ周辺の縦空白を詰める ──
  // 採取CSSの _navArticleWrapper_ は height:60px + padding-top:20px = 80px、
  // _editorWrapper_ は height:calc(100%-120px) + padding:20px で余白が大きい。
  // padding-top を 4px に、editorWrapper の 120px を 68px に縮め、padding を詰める。
  const navWrapper = root.querySelector<HTMLElement>('[class*="_navArticleWrapper_"]')
  if (navWrapper !== null) {
    // navWrapper のスタイルは setupHorizTabs() 内で共通設定される
    // navArticleWrapper の親コンテナ（MuiBox）に白背景 + flex-column で
    // editorWrapper が残り高さを自動で埋めるようにする
    const contentBox = navWrapper.parentElement
    if (contentBox !== null) {
      contentBox.style.background = '#fff'
      contentBox.style.display = 'flex'
      contentBox.style.flexDirection = 'column'
    }

    // ── 指示78+: 縦ナビを非表示にし、水平タブを上部帯に表示（共通関数） ──
    setupHorizTabs(root, 'version', { abTestUid, folderUid: folder?.uid ?? '' })

    // ── 指示78: LP情報を左寄せ ──
    const currentAbTest = navWrapper.querySelector<HTMLElement>('[class*="_currentAbTest_"]')
    if (currentAbTest !== null) {
      currentAbTest.style.justifyContent = 'flex-start'
      currentAbTest.style.flex = '1'
    }
  }
  const editorWrapper = root.querySelector<HTMLElement>('[class*="_editorWrapper_"]')
  if (editorWrapper !== null) {
    // flex-column 親の残り高さを埋める: height:0 + flex:1 が正しいパターン
    editorWrapper.style.height = '0'
    editorWrapper.style.flex = '1 1 0px'
    editorWrapper.style.minHeight = '0'
    editorWrapper.style.padding = '0'
    editorWrapper.style.background = '#fff'
  }
  // boostEditorWrapper も同じ flex パターン
  const boostWrapper = root.querySelector<HTMLElement>('[class*="_boostEditorWrapper_"]')
  if (boostWrapper !== null) {
    boostWrapper.style.height = '0'
    boostWrapper.style.flex = '1 1 0px'
    boostWrapper.style.minHeight = '0'
  }
  // Versionパネル（_abTestArticlesWrapper_）も同じ 120px を引いている
  const articlesWrapper = root.querySelector<HTMLElement>('[class*="_abTestArticlesWrapper_"]')
  if (articlesWrapper !== null) {
    articlesWrapper.style.height = 'calc(100vh - 92px)'
  }

  // 動画（<video>）ブロットを Quill 生成前に登録しておく（保存HTMLからの復元でも消えないように）。
  registerMediaBlots()
  // ── プレビュー枠の iframe を、動くQuillに差し替える ──
  const quill = mountQuill(root)
  // キャンバスへのドラッグ＆ドロップで、カーソル位置へ画像/GIF/動画を挿入できるようにする。
  wireMediaDrop(quill)
  // 指示㊵: 貼り付けた画像のサイズをドラッグで変更できるようにする
  // 画像・動画のリサイズ枠（動画の再生設定は右パネル側）
  wireImageResize(quill)

  // ── 指示㊿②: キャンバスのみスクロール ──
  // スクロールは Quill ホスト（#quillIframe 跡地）の overflow:auto が担当。
  // 外枠の quillEditorContentWrapper は**スクロールしない**（ヘッダー画像・ファネルバーは固定）。
  // バージョンパネルは独立スクロール（バージョンが多い場合に必要）
  // 指示㊼再修正: パネル幅を縮小してキャンバスに面積を譲る
  //
  // contentWrapper の高さを Versionパネルと揃える。
  // 採取CSSの calc(100% - 86px) だと editorWrapper のpadding分だけ短くなるため、
  // Versionパネルと同じ calc(100vh - 84px) に統一して下端を合わせる。
  // contentWrapper を flex column にして、ヘッダ画像→ツールバー→キャンバス→下部バー を
  // 隙間なく縦に並べる。キャンバス（Quillホスト）が flex:1 で残りを埋める。
  const contentWrapper = root.querySelector<HTMLElement>('.quillEditorContentWrapper')
  if (contentWrapper !== null) {
    contentWrapper.style.height = 'calc(100vh - 92px)'
    contentWrapper.style.display = 'flex'
    contentWrapper.style.flexDirection = 'column'
  }
  // 下部バーは flex の末尾子要素として自然に最下部へ（absolute 不要）
  const funnelBar = root.querySelector<HTMLElement>('[class*="_funnelStepWrapper_"]')
  if (funnelBar !== null) {
    funnelBar.style.flexShrink = '0'
  }
  const versionPanel = root.querySelector<HTMLElement>('[class*="_abTestArticlesWrapper_"]')
  if (versionPanel !== null) {
    versionPanel.style.overflowY = 'auto'
    versionPanel.style.overflowX = 'hidden'
    versionPanel.style.minWidth = '230px'
    versionPanel.style.width = '230px'
  }

  // 旧ミニマップの位置（キャンバス右端）に、常時表示の触れるスクロールバーを置く。
  const scrollHost = root.querySelector<HTMLElement>('.ql-container')
  if (scrollHost !== null) mountEditorScrollbar(root, scrollHost)

  // Versionカードの雛形を、配線前のクリーンな状態でクローンして控える（採取した実物1枚が雛形）。
  const originalCard = root.querySelector<HTMLElement>('[data-article-uid]')
  const cardTemplate = (originalCard?.cloneNode(true) as HTMLElement | null) ?? document.createElement('div')

  const ctx: EditorContext = {
    root,
    quill,
    abTestUid,
    folderUid: folder?.uid ?? '',
    articleUid,
    articles: [...articles],
    stepIndex: Math.max(0, articles.findIndex((a) => a.uid === articleUid)),
    versions: [...versions],
    currentUid: versions[0]?.uid ?? '',
    cardTemplate,
    listMode: 'active',
    selectionMode: false,
  }

  // Versionパネルは ctx.versions から**1枚ずつカードを描く**（複製/追加した分も下に増える）。
  renderVersionList(ctx)
  // 「Version追加」は renderVersionList 内の「Versionを追加」カードに統合済み
  // 「Version ▼」一覧ドロップダウンの開閉（task 2・採取済みマークアップに挙動だけ付ける）
  mountVersionListDropdown(root, {
    onSelectMode: (mode) => {
      ctx.listMode = mode
      renderVersionList(ctx)
    },
  })
  // 指示78: Version ∨ ドロップダウンをナビバーへ移動し、配信割合を非表示にする
  relocateVersionDropdownToNav(root)
  // モック準拠: Versionパネル上部に「Version」ヘッダーを表示
  addVersionPanelHeader(root)
  // モック準拠: 基板DOM要素にモックclass名を付与（CSSが直接適用される）
  applyMockupClasses(root)
  mountHeaderImageModal(root)
  mountVersionLinkPopup(root, { abTestUid, getCurrentUid: () => ctx.currentUid })
  // 下部バーの「+」＝ファネルステップ追加（指示⑮）。作成したら新ステップへ移動する。
  mountStepAddModal(root, {
    onCreate: async (name) => {
      const { article } = await api.addArticle(ctx.abTestUid, name)
      const refreshed = (await api.articles(ctx.abTestUid)).articles
      ctx.articles = [...refreshed]
      const index = refreshed.findIndex((a) => a.uid === article.uid)
      await loadStep(ctx, index >= 0 ? index : refreshed.length - 1)
      toast('ステップを作成しました')
    },
  })
  // 下部バーの「< / >」はズームコントロールに置き換える（後述 mountZoomControl）
  hideStepNavigation(root)
  wireSideToolbar(ctx)
  wireTopBar(root, ab_test.title, folderName)
  // パンくずリスト（📁板名 > 📄検証）＋ Version フィルタ（作成中 / アーカイブ済み）
  const breadcrumbRight = setupBreadcrumb(root, folderName, ab_test.title, folder?.uid)
  if (breadcrumbRight !== null) {
    mountVersionFilter(breadcrumbRight, (mode) => {
      ctx.listMode = mode
      renderVersionList(ctx)
    })
  }
  // ヘッダーに保存ステータス・プレビュー・公開ボタンを追加（breadcrumb行の構築後に呼ぶ）
  mountHeaderExtras(root, ctx, { pageTitle: ab_test.title })
  // 4タブ（基本情報 / Version / ポップアップ / レポート）を相互に行き来できるようにする
  wireAbTestTabs(root, abTestUid, folder?.uid ?? '')
  wireTopRightIcons(root, abTestUid, folder?.uid ?? '')
  loadVersion(ctx, ctx.currentUid)
  // キャンバスのみズームできる − 100% + コントロール（下部バーの < > 位置に配置）
  mountZoomControl(root, quill)
  // 記事設定（Version設定）を編集画面の本文にも反映する（保存後は「更新」または再読込で最新化）。
  void applyMasterStyleToEditor(ctx)
}


/**
 * 採取DOMのプレビューiframeを探し、その場所にQuillを立てる。
 * 実物は同一オリジンiframeへ動的書き込みしているが、クローンでは
 * 同じ寸法の枠にQuillを置いて「本当に編集できる」状態にする（§9-1 の到達点）。
 */
function mountQuill(root: HTMLElement): Quill {
  // プレビュー枠は実DOMでは `<iframe id="quillIframe" class="_quillEditorWrapper_…">`。
  // **id で引く**（class は匿名化で `_quillEditorWrapper_…`→`UID_…` に置換され得るため、
  // `[class*="quillEditorWrapper"]` だと外れて host が枠の外＝ページ末尾に落ちてしまう）。
  const frame =
    root.querySelector<HTMLIFrameElement>('#quillIframe') ??
    root.querySelector<HTMLIFrameElement>('iframe[class*="quillEditorWrapper"]')
  const host = document.createElement('div')
  if (frame !== null) {
    // iframe の採取CSS（width:100% / 角丸）を引き継ぐ。
    // 指示㊿②: Quillホストが唯一のスクロール領域。キャンバスのLP本文だけが動く。
    host.className = frame.className
    host.style.background = '#fff'
    host.style.overflow = 'auto'
    // ★ Quill は .ql-container { height:100% } を core CSS で持つ。
    // Vite の CSS injection 順（JS import → <style> 注入）が index.html の <link> より後なので
    // 採取CSSの UID_2445 { height:calc(100vh-260px) } を同詳細度の後勝ちで上書きしてしまう。
    // inline style で明示的に高さを設定し、確実にスクロール領域として機能させる。
    // contentWrapper が flex column なので、flex:1 で残りスペースを全て埋める。
    // 上のヘッダ画像・ツールバーと、下の funnelBar の間にぴったり収まる。
    host.style.flex = '1 1 0'
    host.style.minHeight = '0'
    frame.replaceWith(host)
  } else {
    host.style.cssText = 'width:100%;height:calc(100vh - 220px);background:#fff;overflow:auto'
    root.append(host)
  }
  /**
   * ツールバーは**採取した実物の markup**（`_editorToolbarWrapper_`）を使うので、
   * Quill 内蔵の bubble ツールバーは出さない（二重に出てしまうため）。
   * 書式の適用は `src/app/panels/editor-toolbar.ts` が Quill API 経由で行う。
   */
  // Quill core CSS: .ql-editor { height:100%; overflow-y:auto }
  // .ql-editor が自身でスクロールすると、ミニマップの scrollContainer（= host）と
  // スクロール位置が一致しない。height:auto にして内容に伸ばし、
  // スクロールは host（.ql-container, overflow:auto + 固定高さ）に一本化する。
  // ※ inline style は applyMasterStyleToEditor の setAttribute('style', decls) で
  //    丸ごと上書きされるため、<style> タグで !important 付きで注入する。
  injectQuillScrollFix()

  return new Quill(host, {
    placeholder: 'ここにLPの内容を入力してください',
    modules: { toolbar: false },
  })
}










/**
 * Versionカードにバッジ（編集中/保存済み）とタイムスタンプを追加する。
 * wireVersionCard の末尾で呼ぶ。
 */



// 指示93: mountCompareButton は削除。比較機能はヘッダーの「比較する」ボタンに移動。


/**
 * キャンバスのみズームできる − 100% + コントロールを下部バーの < > 位置に配置する。
 * CSS transform: scale() で Quill 本文だけを拡縮する。UIはそのまま。
 */
function mountZoomControl(root: HTMLElement, quill: Quill): void {
  const ZOOM_STEPS = [0.25, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5] as const
  const DEFAULT_INDEX = 6 // 1.0 = 100%
  let zoomIndex = DEFAULT_INDEX
  const editor = quill.root // .ql-editor

  // < > の親コンテナ（_funnelStepWrapper_ の子）を探してズームコントロールを隣に置く
  const funnelWrapper = root.querySelector<HTMLElement>('[class*="_funnelStepWrapper_"]')
  if (funnelWrapper === null) return

  const bar = document.createElement('div')
  bar.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:2px',
    'margin-left:auto',
    'padding-right:4px',
  ].join(';')

  const btnStyle = [
    'width:24px',
    'height:24px',
    'border:none',
    'background:transparent',
    'color:#666',
    'font-size:16px',
    'line-height:1',
    'cursor:pointer',
    'border-radius:4px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:0',
  ].join(';')

  const minus = document.createElement('button')
  minus.textContent = '−'
  minus.style.cssText = btnStyle
  minus.addEventListener('mouseenter', () => { minus.style.background = '#e8e8e8' })
  minus.addEventListener('mouseleave', () => { minus.style.background = 'transparent' })

  const label = document.createElement('span')
  label.style.cssText = 'font-size:12px;color:#666;min-width:36px;text-align:center;user-select:none'

  const plus = document.createElement('button')
  plus.textContent = '+'
  plus.style.cssText = btnStyle
  plus.addEventListener('mouseenter', () => { plus.style.background = '#e8e8e8' })
  plus.addEventListener('mouseleave', () => { plus.style.background = 'transparent' })

  bar.append(minus, label, plus)
  funnelWrapper.append(bar)

  function applyZoom(): void {
    const scale = ZOOM_STEPS[zoomIndex] ?? 1
    editor.style.transform = `scale(${scale})`
    editor.style.transformOrigin = 'top center'
    label.textContent = `${Math.round(scale * 100)}%`
    minus.style.opacity = zoomIndex <= 0 ? '0.3' : '1'
    minus.style.cursor = zoomIndex <= 0 ? 'default' : 'pointer'
    plus.style.opacity = zoomIndex >= ZOOM_STEPS.length - 1 ? '0.3' : '1'
    plus.style.cursor = zoomIndex >= ZOOM_STEPS.length - 1 ? 'default' : 'pointer'
  }

  minus.addEventListener('click', () => {
    if (zoomIndex > 0) { zoomIndex -= 1; applyZoom() }
  })
  plus.addEventListener('click', () => {
    if (zoomIndex < ZOOM_STEPS.length - 1) { zoomIndex += 1; applyZoom() }
  })

  applyZoom()
}

/**
 * ファネルステップ（記事）を切り替える（指示⑮ `< >`）。
 * 対象記事のVersion一覧を取り直し、先頭Versionを開く。範囲外は何もしない。
 */
async function loadStep(ctx: EditorContext, index: number): Promise<void> {
  if (index < 0 || index >= ctx.articles.length) return
  const article = ctx.articles[index]
  if (article === undefined) return
  ctx.stepIndex = index
  ctx.articleUid = article.uid
  ctx.listMode = 'active'
  ctx.selectionMode = false
  try {
    const { versions } = await api.versions(article.uid)
    ctx.versions = [...versions]
    ctx.currentUid = versions[0]?.uid ?? ''
    renderVersionList(ctx)
    if (ctx.currentUid !== '') loadVersion(ctx, ctx.currentUid)
    void applyMasterStyleToEditor(ctx)
    toast(`ステップ ${index + 1}/${ctx.articles.length}`)
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}

/** 下部バーの `< / >` を非表示にする（ズームコントロールに置き換えるため） */
function hideStepNavigation(root: HTMLElement): void {
  const prev = root.querySelector<HTMLElement>(HOOK.funnelPrev)
  const next = root.querySelector<HTMLElement>(HOOK.funnelNext)
  // < > の親コンテナごと隠す
  const container = prev?.parentElement ?? next?.parentElement
  if (container !== null && container !== undefined) {
    container.style.visibility = 'hidden'
    container.style.width = '0'
    container.style.overflow = 'hidden'
  }
}




















/**
 * 土台には**採取した時点の値**が焼き付いている。
 * 匿名化で `サンプル施策NNN` の形に揃えてあるので、その並びを目印にして
 * いま開いているページの値へ差し替える（＝企画書 §5-6 の「再配線」）。
 */
const ANONYMIZED_NAME = /^サンプル施策\d+$/

function replaceBakedValues(root: HTMLElement, values: readonly string[]): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const targets: Text[] = []
  let node = walker.nextNode()
  while (node !== null) {
    const text = (node.textContent ?? '').trim()
    if (ANONYMIZED_NAME.test(text)) targets.push(node as Text)
    node = walker.nextNode()
  }
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i]
    if (target === undefined) continue
    target.textContent = values[Math.min(i, values.length - 1)] ?? ''
  }
}

/**
 * 上部右の3アイコン（編集 / Versionオプション設定 / 中間ページ）を配線する。
 *
 * 3アイコンは採取物では `_linksContainer_dcd38_102` 配下の `<a>` で、いずれも実アプリの
 * 絶対パスを指している。位置で #2/#3 を当てるのは脆いので、**アンカー自身の href /
 * data-trackid で同定**する（`wireBeyondNavAnchors` の中身・editor-target で確認した実DOM）:
 *   #1 編集              data-trackid="editor-nav-editor" / href=/ab_tests/:uid/articles#<記事uid>
 *   #2 オプション設定    href=/ab_tests/:uid/articles/split_test_settings/devices
 *   #3 中間ページ        data-trackid="editor-nav-redirect-page" / href=…/redirect_pages
 * #1(編集)は現画面。採取物の絶対hrefのままだとクリックでSPA外へ出てしまうので、
 * 現画面のハッシュへ張り替えて実害を消す（＝押しても現画面に留まる＝実質「無反応」）。
 *
 * 走査は `_linksContainer_dcd38_102` に限定する（本文の他アンカーを巻き込まないため）。
 * このクラスが採取物から消えたら、下部の Version▼ 等を触らないよう黙って何もしない。
 */
function wireTopRightIcons(root: HTMLElement, abTestUid: string, folderUid: string): void {
  const container = root.querySelector<HTMLElement>('._linksContainer_dcd38_102')
  if (container === null) {
    console.warn('[editor] 上部右アイコンの入れ物（_linksContainer_dcd38_102）が見つかりませんでした')
    return
  }
  wireBeyondNavAnchors(container, { abTestUid, folderUid })
}

/**
 * 指示78: Version ∨ ドロップダウンをVersionパネル上部からナビバーへ移動する。
 * フォルダアイコンを消し、その位置にVersion/アーカイブ切替を置く。
 * 配信割合ラベルも非表示にする。
 */
function relocateVersionDropdownToNav(root: HTMLElement): void {
  // Version ∨ ドロップダウンを探す（articleListType を含む要素から最寄りの dropdown）
  const listType = root.querySelector<HTMLElement>('[class*="articleListType"]')
  const versionDropdown = listType?.closest<HTMLElement>('[class*="dropdown_x4j8w"]') ?? null
  if (versionDropdown === null) return

  // ナビバーの actionItems を探す
  const actionItems = root.querySelector<HTMLElement>('._navArticleItems_dcd38_19._actionItems_dcd38_26')
  if (actionItems === null) return

  // フォルダアイコンのドロップダウンを探して、その位置にVersion切替を差し替える
  const folderIcon = actionItems.querySelector<HTMLElement>('[class*="folderIcon"]')
  const folderDropdown = folderIcon?.closest<HTMLElement>('[class*="dropdown_x4j8w"]') ?? null

  if (folderDropdown !== null) {
    // フォルダマークの位置にVersion切替を入れ、フォルダマークは消す
    folderDropdown.replaceWith(versionDropdown)
  } else {
    // フォルダマークが見つからなければ戻るボタンの後に挿入
    const backBtn = actionItems.querySelector<HTMLElement>('[class*="_back_"]')
    if (backBtn !== null) backBtn.after(versionDropdown)
    else actionItems.prepend(versionDropdown)
  }

  // テーマをダークからライトに切り替え（ナビバーのライトテーマに合わせる）
  versionDropdown.classList.remove('_darkTheme_x4j8w_116')
  versionDropdown.classList.add('_lightTheme_x4j8w_88')

  // 配信割合ラベルと？アイコンを非表示にする
  const subscriptText = root.querySelector<HTMLElement>('[data-testid="subscript-text"]')
  if (subscriptText !== null) {
    const stack = subscriptText.closest<HTMLElement>('.MuiStack-root')
    if (stack !== null) stack.style.display = 'none'
    else subscriptText.style.display = 'none'
  }
  const odz = subscriptText?.closest<HTMLElement>('.css-odz94x') ?? null
  if (odz !== null) odz.style.display = 'none'

  // ドロップダウンを移動した結果、Versionパネル上部（_abTestArticlesTop_）の中身は空。
  // モック準拠で「Version」ヘッダーテキストに置き換える。
  const articlesTop = root.querySelector<HTMLElement>('[class*="_abTestArticlesTop"]')
  if (articlesTop !== null) {
    articlesTop.style.padding = '10px 12px 6px'
    articlesTop.style.minHeight = '0'
    articlesTop.style.height = 'auto'
    articlesTop.style.overflow = 'visible'
    articlesTop.style.display = 'flex'
    articlesTop.style.alignItems = 'center'
    articlesTop.style.justifyContent = 'space-between'
    // 中身をクリアして「Version」ヘッダーを入れる
    articlesTop.innerHTML = ''
    const vhdr = document.createElement('h3')
    vhdr.textContent = 'Version'
    vhdr.style.cssText = 'font-size:13px;font-weight:600;color:#1a1a1a;margin:0'
    articlesTop.append(vhdr)
  }
}

/**
 * Versionパネル上部に「Version」ヘッダーテキストを表示する。
 * relocateVersionDropdownToNav が成功した場合でも独立して動作するよう別関数にしている。
 */
function addVersionPanelHeader(root: HTMLElement): void {
  const articlesTop = root.querySelector<HTMLElement>('[class*="_abTestArticlesTop"]')
  if (articlesTop === null) return
  // 既にヘッダー設置済みなら何もしない
  if (articlesTop.querySelector('[data-version-panel-header]') !== null) return
  // 基板の中身をクリアし、モック準拠の「Version」ヘッダーに置き換える
  articlesTop.innerHTML = ''
  articlesTop.style.cssText =
    'padding:10px 12px 6px;min-height:0;height:auto;overflow:visible;display:flex;align-items:center;justify-content:space-between'
  const vhdr = document.createElement('h3')
  vhdr.setAttribute('data-version-panel-header', 'true')
  vhdr.textContent = 'Version'
  vhdr.style.cssText = 'font-size:13px;font-weight:600;color:#1a1a1a;margin:0'
  articlesTop.append(vhdr)
}

function wireTopBar(root: HTMLElement, title: string, folderName: string): void {
  // 1つ目＝ページ名、2つ目＝フォルダ名（実機の上部バーの並び）
  replaceBakedValues(root, [title, folderName])

  for (const back of root.querySelectorAll<HTMLElement>('[class*="back"]')) {
    back.style.cursor = 'pointer'
    back.addEventListener('click', () => {
      location.hash = '/folders'
    })
  }
}


type VersionListMode = 'active' | 'archived'

/**
 * パンくず行の右端に「作成中 / アーカイブ済み」フィルタボタンを設置する。
 * 採取 DOM のドロップダウンは使わず、新規 DOM で構築する。
 */
function mountVersionFilter(
  container: HTMLElement,
  onSelectMode: (mode: VersionListMode) => void,
): void {
  injectVersionFilterCss()

  const modes: readonly { mode: VersionListMode; label: string }[] = [
    { mode: 'active', label: '作成中' },
    { mode: 'archived', label: 'アーカイブ済み' },
  ]

  const wrap = document.createElement('div')
  wrap.className = 'sb-version-filter-wrap version-filter'

  const buttons: HTMLElement[] = []
  for (const { mode, label } of modes) {
    const btn = document.createElement('span')
    btn.className = 'sb-version-filter version-filter-btn'
    btn.textContent = label
    if (mode === 'active') {
      btn.classList.add('sb-filter-active')
      btn.classList.add('active')
    }
    btn.addEventListener('click', () => {
      for (const b of buttons) {
        b.classList.remove('sb-filter-active')
        b.classList.remove('active')
      }
      btn.classList.add('sb-filter-active')
      btn.classList.add('active')
      onSelectMode(mode)
    })
    buttons.push(btn)
    wrap.append(btn)
  }
  container.append(wrap)
}

// ── 指示97: 保存時刻の相対表示 ──



// 指示117/122: 縦レールはそのまま縦配置で残す（ユーザー指示「縦でよかった」）。
// relocateToolsToPanel / injectHorizToolbarStyles は削除済み。
