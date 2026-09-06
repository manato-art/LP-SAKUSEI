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
import { api, type Version } from '../api.ts'
import { isStale } from '../main.ts'
import { T, el, toast } from '../ui.ts'
import { mountVersionSettings } from '../panels/version-settings.ts'
import { mountTagSettings } from '../panels/tag-settings.ts'
import { mountLinkReplace } from '../panels/link-replace.ts'
import { mountHistory, recordArticleHistory } from '../panels/history.ts'
import { mountEditorToolbar } from '../panels/editor-toolbar.ts'
import { mountUrlBar, updateUrlBar } from '../panels/url-bar.ts'
import { mountPropertiesPanel } from '../panels/properties-panel.ts'
import { createAutosave } from './autosave.ts'
import { createPanelGroup } from '../panels/panel-group.ts'
import { recordHistory } from './folders.ts'
import { mountVersionListDropdown, setVersionListMode } from '../panels/version-actions.ts'
import { mountVersionDotsMenu } from '../panels/version-dots-menu.ts'
import { mountHeaderImageModal } from '../panels/header-image-modal.ts'
import { mountVersionLinkPopup } from '../panels/version-link-popup.ts'
import { mountStepAddModal } from '../panels/step-add-modal.ts'
import { mountWidgetLibrary } from '../panels/widget-library.ts'
import { wireWidgetClick } from '../panels/widget-editor.ts'
import { mountWidgetNav } from '../panels/widget-nav.ts'
import { EXTERNAL_IMAGE_TOOL_INDEX, mountExternalImage } from '../panels/external-image.ts'
import { registerMediaBlots } from '../panels/media-blots.ts'
import { wireMediaDrop } from '../panels/media-insert.ts'
import { wireImageResize } from '../panels/image-resize.ts'
import { mountMinimap } from '../panels/minimap.ts'
import { toggleComparePanel, isComparePanelOpen, refreshComparePreview } from '../panels/compare-mode.ts'
import { wireAbTestTabs, setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'
import { wireBeyondNavAnchors } from './beyond-nav.ts'
import { masterStyleEditorDecls } from '../master-style.ts'
import { injectMockupMasterStyles, applyMockupClasses } from '../styles/mockup-master.ts'

/** 採取DOM内の目印（実物の data-test 属性。採取のたびに増える） */
const HOOK = {
  versionList: '[data-test="Article-ArticleLists"]',
  currentVersion: '[data-test="ArticleList-CurrentArticle"]',
  versionName: '[data-test="ArticleList-InputMemo"]',
  ratio: '[data-test="ArticleList-DeriveryRateForm"]',
  ratioUp: '[data-test="ArticleList-DeriveryUpRateForm"]',
  ratioDown: '[data-test="ArticleList-DeriveryDownRateForm"]',
  addVersion: '[data-test="Article-BtnCreateNewArticle"]',
  undo: '[data-test="SideToolbar-Undo"]',
  redo: '[data-test="SideToolbar-Redo"]',
  tagSettings: '[data-test="HtmlSettingModal-BtnOpenModal"]',
  versionSettings: '[data-test="MasterStyleSheetModal-BtnOpenModal"]',
  /** 右レール1番目。実DOMでは aria-label で識別できる */
  preview: '[aria-label="プレビュー"]',
  moreToolbar: '[data-test="EditorToolbar-BtnMoreToolbarOption"]',
  // 実物は data-test="editorWrapper"。data-testid="editor-wrapper" という別要素もあるが、
  // 属性名が違うので [data-test="editor-wrapper"] は永久に一致しない。念のための第2候補は置かない。
  editorWrapper: '[data-test="editorWrapper"]',
  /** Version行は記事uidを属性で持っている（実DOMで判明） */
  versionRow: '[data-article-uid]',
  funnelPrev: '[class*="changePrevFunnelStep"]',
  funnelNext: '[class*="changeNextFunnelStep"]',
  versionLinkInput: '#versionLink',
} as const

/** 配線済みのツール（未実装トーストを出さない） */
/** 打ち終わってから保存するまでの待ち時間。1文字ごとに保存すると通信が飽和する。 */
const AUTOSAVE_DELAY_MS = 900

/** 右レールの並び順は SIDE_TOOLS のとおり。プレビューは1番目。 */
const PREVIEW_TOOL_INDEX = 0
/** 右レールの並び: 6=元に戻す / 7=やり直す */
const UNDO_TOOL_INDEX = 6
const REDO_TOOL_INDEX = 7

const WIRED_TOOLS: readonly number[] = [0, 1, 2, 3, 4, 5]

/** 右レール9ツールの表示名（指示77: ユーザーが指定した名称） */
const SIDE_TOOLS: readonly string[] = [
  'プレビュー',
  '履歴',
  'ライブラリ',
  'リンク置換',
  'LP設定',
  'タグ設定',
  '戻る',
  '進む',
  '画像',
]

interface EditorContext {
  root: HTMLElement
  quill: Quill
  abTestUid: string
  /** beyondページ（＝基本情報タブ）へのリンクを組み立てるのに要る */
  folderUid: string
  articleUid: string
  /** beyondページのファネルステップ（記事）一覧。`< >` で行き来する（指示⑮） */
  articles: { uid: string }[]
  /** いま開いているステップの index（articles 内） */
  stepIndex: number
  versions: Version[]
  currentUid: string
  /** Versionカードの雛形（採取した実物カードのクリーンなクローン。Versionごとに複製して並べる） */
  cardTemplate: HTMLElement
  /** Version▼の表示モード（通常一覧 / アーカイブ一覧・指示⑮） */
  listMode: 'active' | 'archived'
  /** 「選択してアーカイブする」モード（チェックボックス選択・指示⑮） */
  selectionMode: boolean
}

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
  if (dupSidebar !== null) dupSidebar.remove()
  // 除去したサイドバーの幅分（60px）のパディングが残っているので消す。
  // これが残ると左サイドバーと4タブナビの間に空白ができる。
  const mainContent = root.querySelector<HTMLElement>('.css-1n8b1pi')
  if (mainContent !== null) mainContent.style.paddingLeft = '0'

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
  // 「Version追加」ボタンはカードの下に据え置き（再描画で消えない）。1回だけ配線する。
  wireAddVersion(ctx)
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
  // 指示㊻: エディタ右側にミニマップ（LP全体の縮小プレビュー）を表示
  // 指示㊿②: スクロール対象は Quill ホスト（LP本文のスクロール領域）
  const quillHost = quill.container as HTMLElement
  mountMinimap(root, quillHost)
  // キャンバスのみズームできる − 100% + コントロール（下部バーの < > 位置に配置）
  mountZoomControl(root, quill)
  // 記事設定（Version設定）を編集画面の本文にも反映する（保存後は「更新」または再読込で最新化）。
  void applyMasterStyleToEditor(ctx)
}

/** 記事設定（MasterStyleSheet）を Quill 本文へ当てて、編集画面でも見た目を反映する。 */
async function applyMasterStyleToEditor(ctx: EditorContext): Promise<void> {
  try {
    const { master_style_sheet } = await api.masterStyleSheet(ctx.articleUid)
    const decls = masterStyleEditorDecls(master_style_sheet)
    if (decls !== '') ctx.quill.root.setAttribute('style', decls)
  } catch {
    // 取得に失敗しても編集は続けられる（既定の見た目のまま）
  }
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

/** .ql-editor のスクロールを無効化し、host (.ql-container) に一本化する CSS を1回だけ注入 */
function injectQuillScrollFix(): void {
  if (document.getElementById('sb-quill-scroll-fix') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-quill-scroll-fix'
  style.textContent = [
    '.ql-editor { height: auto !important; overflow-y: visible !important; }',
  ].join('')
  document.head.append(style)
}

/** 旧フローティングツールバーを非表示にする */
function hideFloatingToolbar(root: HTMLElement): void {
  const wrapper = root.querySelector<HTMLElement>('[data-test="EditorToolbar-EditorToolbarWrapper"]')
  if (wrapper !== null) {
    wrapper.style.display = 'none'
  }
}

/**
 * Versionパネルのレイアウト整理（指示77）。
 * ツールバーはコンテンツ上部（mountContentToolbar）に移動したため、
 * サイドバーは Versionカード + 最下部の「Version追加」だけにする。
 * 「Version追加」は funnelBar と同じ高さに固定して "下でくっつける"。
 */
function mountSidebarToolbarPanel(ctx: EditorContext): void {
  const versionPanel = ctx.root.querySelector<HTMLElement>('[class*="_abTestArticlesWrapper_"]')
  if (versionPanel === null) return

  // Versionパネルを flex column に変更
  versionPanel.style.display = 'flex'
  versionPanel.style.flexDirection = 'column'
  versionPanel.style.overflow = 'hidden'

  // 既存の子要素（Versionカード等）をスクロール可能なラッパーに移動
  const cardsWrapper = document.createElement('div')
  // flex:1 → 残りスペースをカード領域が取る。スクロールは中で。
  cardsWrapper.style.cssText = 'flex:1 1 0;overflow-y:auto;overflow-x:hidden;min-height:0'
  while (versionPanel.firstChild) {
    cardsWrapper.append(versionPanel.firstChild)
  }
  versionPanel.append(cardsWrapper)

  // 青い「バージョンを追加」ボタンは不要（「Versionを追加」カードに統合済み）→ 非表示
  const addBtn = cardsWrapper.querySelector<HTMLElement>(HOOK.addVersion)
  if (addBtn !== null) {
    addBtn.style.display = 'none'
  }
}

/**
 * エディタ領域のカードを隙間なくつなげるCSS。
 * navWrapper / editorWrapper / versionPanel / contentWrapper を白背景で一体化。
 */
function injectCardSeamStyles(): void {
  if (document.getElementById('lps-mockup-master') !== null) return
  if (document.getElementById('sb-card-seam-css') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-card-seam-css'
  style.textContent = `
    /* ── カード接続: 隙間を白で埋める ── */
    /* contentWrapper: モック準拠でグレー背景 + 角丸外す */
    .quillEditorContentWrapper {
      border-radius: 0 !important;
      background: #f5f6f8 !important;
      position: relative !important;
      display: flex !important;
      flex-direction: column !important;
    }
    /* Quillコンテナ: グレー背景内の白カード（モック .canvas-inner） */
    .quillEditorContentWrapper .ql-container {
      flex: 1 !important;
      overflow: auto !important;
      padding: 20px !important;
      display: flex !important;
      justify-content: center !important;
      background: transparent !important;
    }
    .quillEditorContentWrapper .ql-editor {
      width: 100% !important;
      max-width: 640px !important;
      background: #fff !important;
      border: 1px solid #e5e5ea !important;
      border-radius: 4px !important;
      min-height: 400px !important;
      padding: 24px !important;
      box-shadow: 0 1px 4px rgba(0,0,0,.04) !important;
    }
    /* ヘッダ画像の角丸も上部を外す */
    [class*="_articleHeaderPhoto_"] {
      border-radius: 0 !important;
    }
    /* Versionパネルの角丸を外す + 右に区切り線 + 幅260px（モック準拠） */
    [class*="_abTestArticlesWrapper_"] {
      border-radius: 0 !important;
      border-right: 1px solid #e5e5ea;
      width: 260px !important;
      min-width: 260px !important;
      flex-shrink: 0 !important;
    }
    /* sideToolbarWrapper: モック準拠で薄グレー + 左に区切り線 + フル高さ */
    [class*="_sideToolbarWrapper_"] {
      background: #fafbfc;
      border-left: 1px solid #e5e5ea;
      align-self: stretch !important;
      height: auto !important;
    }
    /* editorWrapper: 高さをフルに伸ばす + 幅を親に合わせる（基板のmax-width:1100pxを解除） */
    [class*="_editorWrapper_"] {
      flex: 1 !important;
      min-height: 0 !important;
      overflow: hidden !important;
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      align-self: stretch !important;
    }
    /* 基板の浮遊ドロップダウンを非表示 */
    [class*="_editorWrapper_"] > [class*="_dropdown_"] {
      display: none !important;
    }
    /* ── 基板DOMの漏れ要素を確実に隠す ── */
    /* 基板の作成中/アーカイブ済みフィルタ（新規DOMで置換済み） */
    [class*="_navArticleItems_"],
    [class*="_actionItems_"] {
      display: none !important;
    }
    /* 基板のLP情報行（パンくずで置換済み） */
    [class*="_currentAbTest_"] {
      display: none !important;
    }
    /* navArticleWrapper の余白を詰める */
    [class*="_navArticleWrapper_"] {
      padding-top: 0 !important;
      border-bottom: none !important;
    }
    /* ボトムバー（funnelStepWrapper）: モック準拠で白背景 + 上ボーダー + 34px高 */
    [class*="_funnelStepWrapper_"] {
      height: 34px !important;
      background: #fff !important;
      border-top: 1px solid #e5e5ea !important;
      overflow: hidden !important;
    }
    /* funnelStepWrapper内の溢れドロップダウンを非表示 */
    [class*="_funnelStepWrapper_"] > [class*="_lightTheme_"] {
      display: none !important;
    }
  `
  document.head.append(style)
}

/**
 * 右レール（_sideToolbarWrapper_）のスタイル。
 * 丸い背景は削除し、各アイコンの下にテキストラベルを表示する（指示78）。
 */
function injectSideToolbarStyles(): void {
  if (document.getElementById('lps-mockup-master') !== null) return
  if (document.getElementById('sb-side-toolbar-fix') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-side-toolbar-fix'
  style.textContent = `
    /* 指示78: 丸い背景を完全に削除 */
    [class*="_sideToolbarIcon_"]::before,
    [class*="_sideToolbarIcon_"]::after {
      display: none !important;
    }
    [class*="_sideToolbarIcon_"] {
      background: none !important;
      background-color: transparent !important;
      border-radius: 0 !important;
    }
    /* アイコン画像サイズを揃える */
    [class*="_sideToolbarIcon_"] img[class*="_icon_"] {
      width: 22px !important;
      height: 22px !important;
    }
    /* アイコン間の縦余白（本番実測: 各アイコン+ラベルの間に十分な余白） */
    [class*="_sideToolbarTop_"] {
      gap: 4px !important;
    }
    /* アイコン + テキストラベルを縦に並べる */
    [class*="_sideToolbarIcon_"] {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 2px !important;
      height: auto !important;
      padding: 4px 0 !important;
    }
    /* 指示87: Widget管理のMUIボタンが50px固定でラベルを押し出すのを修正 */
    [class*="_sideToolbarIcon_"] [aria-label="Widget管理"] {
      height: auto !important;
      padding: 4px !important;
    }
    /* テキストラベル */
    .sb-side-label {
      font-size: 9px;
      color: #666;
      line-height: 1.1;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 48px;
    }
  `
  document.head.append(style)
}


/**
 * 右プロパティパネルを editorWrapper の最右端に挿入する。
 * レイアウト: [versionPanel] [widgetNav?] [contentWrapper] [iconRail] [propsPanel]
 */
function mountPropertiesPanelInEditor(ctx: EditorContext): void {
  const editorWrapper = ctx.root.querySelector<HTMLElement>('[class*="_editorWrapper_"]')
  if (editorWrapper === null) return
  if (editorWrapper.querySelector('[data-props-panel]') !== null) return

  const panel = mountPropertiesPanel(ctx.quill)
  editorWrapper.append(panel)
}

/**
 * ヘッダー行（sb-breadcrumb-row）に保存ステータス・プレビュー・公開ボタン・⋮メニューを追加する。
 * パンくずとVersionフィルタの右側にスペーサーを挟んで挿入する。
 */
function mountHeaderExtras(
  root: HTMLElement,
  ctx: EditorContext,
  _deps: { pageTitle: string },
): void {
  // sb-breadcrumb-row（可視のヘッダー行）を探す
  const breadcrumbRow = root.querySelector<HTMLElement>('.sb-breadcrumb-row')
  if (breadcrumbRow === null) return
  // 二重挿入防止
  if (breadcrumbRow.querySelector('[data-header-save-status]') !== null) return

  // CSS注入
  injectHeaderExtrasCss()

  const newBadge = `<span class="sb-header-new-badge new-badge">NEW</span>`

  // ── スペーサー（左のパンくず+フィルタと右のボタン群を分ける） ──
  const spacer = document.createElement('div')
  spacer.style.flex = '1'

  // ── 保存ステータス（指示97: 実際の保存時刻を表示） ──
  const saveStatus = document.createElement('span')
  saveStatus.className = 'sb-header-save-status save-status'
  saveStatus.setAttribute('data-header-save-status', 'true')
  const timeSpan = document.createElement('span')
  timeSpan.style.cssText = 'font-size:10px;color:#b0b0b0'
  timeSpan.setAttribute('data-save-time', 'true')
  // 初期表示: 現在時刻を「読み込み時刻」として表示
  const initialTime = new Date()
  timeSpan.textContent = formatSaveTime(initialTime)
  timeSpan.dataset['savedAt'] = String(initialTime.getTime())
  saveStatus.innerHTML = `<span style="color:#00b341">✓</span><span>保存済み</span>`
  saveStatus.append(timeSpan)
  saveStatus.insertAdjacentHTML('beforeend', newBadge)
  // 1分ごとに相対時刻を更新
  setInterval(() => {
    const ts = Number(timeSpan.dataset['savedAt'] ?? '0')
    if (ts > 0) timeSpan.textContent = formatSaveTime(new Date(ts))
  }, 60_000)

  // ── セパレータ ──
  const sep1 = document.createElement('span')
  sep1.className = 'sb-header-sep header-sep'

  // ── プレビューボタン ──
  const previewBtn = document.createElement('button')
  previewBtn.className = 'sb-header-btn-preview btn-preview'
  previewBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>プレビュー`
  previewBtn.addEventListener('click', async () => {
    await saveHtml(ctx)
    const url =
      `${location.origin}${location.pathname}` +
      `#/ab_tests/${ctx.abTestUid}/articles/${ctx.currentUid}/previews`
    window.open(url, '_blank', 'noopener')
  })

  // ── 指示93: 比較するボタン（公開するボタンを置換） ──
  const compareBtn = document.createElement('button')
  compareBtn.className = 'sb-header-btn-publish btn-publish'
  compareBtn.setAttribute('data-header-compare-btn', 'true')
  compareBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>比較する`
  compareBtn.addEventListener('click', () => {
    toggleComparePanel(ctx.root, {
      getCurrentHtml: () => ctx.quill.root.innerHTML,
      getVersionUid: () => ctx.currentUid,
    })
  })

  // パンくず行に追加（既存の breadcrumb + filter の後ろにスペーサー+ボタン群）
  // 指示96: 右端の4アイコン（⋮ / 編集 / 設定 / モニター）は削除
  breadcrumbRow.append(spacer, saveStatus, sep1, previewBtn, compareBtn)
}

function injectHeaderExtrasCss(): void {
  if (document.getElementById('lps-mockup-master') !== null) return
  if (document.getElementById('sb-header-extras-css') !== null) return
  const s = document.createElement('style')
  s.id = 'sb-header-extras-css'
  s.textContent = `
    .sb-header-page-name {
      display:flex; align-items:center; gap:4px;
      font-size:13px; font-weight:600; color:#1a1a1a;
      flex-shrink:0; margin-left:8px;
    }
    .sb-header-save-status {
      display:flex; align-items:center; gap:5px;
      font-size:12px; color:#666; flex-shrink:0;
    }
    .sb-header-sep {
      width:1px; height:20px; background:#e5e5ea; flex-shrink:0;
    }
    .sb-header-btn-preview {
      display:flex; align-items:center; gap:4px;
      padding:5px 12px; border:1px solid #e5e5ea; border-radius:6px;
      background:#fff; font-size:12px; color:#1a1a1a; cursor:pointer;
      font-weight:500; font-family:inherit; flex-shrink:0;
      transition:background .12s;
    }
    .sb-header-btn-preview:hover { background:#f0f0f2; }
    .sb-header-btn-publish {
      display:flex; align-items:center; gap:4px;
      padding:5px 14px; border:none; border-radius:6px;
      background:#00b341; font-size:12px; color:#fff; cursor:pointer;
      font-weight:600; font-family:inherit; flex-shrink:0;
      transition:background .12s;
    }
    .sb-header-btn-publish:hover { background:#009936; }
    .sb-header-btn-icon {
      width:30px; height:30px; border:none; background:none; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      border-radius:6px; color:#666; flex-shrink:0;
      transition:background .12s;
    }
    .sb-header-btn-icon:hover { background:#f0f0f2; }
    .sb-header-new-badge {
      display:inline-block; font-size:8px; font-weight:700; color:#fff;
      background:#ff8c00; padding:1px 4px; border-radius:2px;
      letter-spacing:.3px; vertical-align:middle; margin-left:3px;
      line-height:1.3;
    }
    .sb-header-right-icons {
      display:flex; align-items:center; gap:2px; flex-shrink:0;
    }
  `
  document.head.append(s)
}

/**
 * Versionカードにバッジ（編集中/保存済み）とタイムスタンプを追加する。
 * wireVersionCard の末尾で呼ぶ。
 */
/**
 * バージョンカードのDOM要素を一から組み立てる。
 * 採取テンプレートのクローンではなく、スクリーンショット準拠の構造を生成する。
 * wireVersionCard / wireArchivedCard が配線するための data-test 属性は全て保持する。
 */
function buildVersionCardEl(version: Version, isCurrent: boolean): HTMLElement {
  injectVersionCardCss()

  const card = document.createElement('div')
  card.dataset['articleUid'] = version.uid
  card.setAttribute('data-id', String(version.id))
  card.style.cursor = 'pointer'

  const inner = document.createElement('div')
  inner.setAttribute('data-test', 'ArticleList-CurrentArticle')
  inner.className = `_currentVersion_vc${isCurrent ? ` ${ACTIVE_CARD_CLASS}` : ''}`

  // ── Row 1: Version名 + バッジ ──
  const nameRow = document.createElement('div')
  nameRow.className = 'sb-vc-name-row'

  const nameInput = document.createElement('input')
  nameInput.setAttribute('data-test', 'ArticleList-InputMemo')
  nameInput.value = version.name
  nameInput.className = 'sb-vc-name'

  const badge = document.createElement('span')
  badge.setAttribute('data-version-badge', 'true')
  badge.className = `sb-vc-badge ${isCurrent ? 'sb-vc-badge--editing' : 'sb-vc-badge--saved'}`
  badge.textContent = isCurrent ? '編集中' : '保存済み'

  nameRow.append(nameInput, badge)

  // ── Row 2: 配信割合 + 保存状態 ──
  const ratioRow = document.createElement('div')
  ratioRow.className = 'sb-vc-ratio-row'

  const ratioLabel = document.createElement('span')
  ratioLabel.className = 'sb-vc-ratio-label'
  ratioLabel.textContent = '配信割合'

  const ratioInput = document.createElement('input')
  ratioInput.setAttribute('data-test', 'ArticleList-DeriveryRateForm')
  ratioInput.type = 'number'
  ratioInput.value = String(version.distribution_ratio)
  ratioInput.className = 'sb-vc-ratio-input'

  const pct = document.createElement('span')
  pct.className = 'sb-vc-ratio-pct'
  pct.textContent = '%'

  const stepperWrap = document.createElement('div')
  stepperWrap.className = 'sb-vc-stepper'
  const upBtn = document.createElement('button')
  upBtn.setAttribute('data-test', 'ArticleList-DeriveryUpRateForm')
  upBtn.type = 'button'
  upBtn.className = 'sb-vc-stepper-btn sb-vc-stepper-up'
  upBtn.textContent = '▲'
  const downBtn = document.createElement('button')
  downBtn.setAttribute('data-test', 'ArticleList-DeriveryDownRateForm')
  downBtn.type = 'button'
  downBtn.className = 'sb-vc-stepper-btn sb-vc-stepper-down'
  downBtn.textContent = '▼'
  stepperWrap.append(upBtn, downBtn)

  const spacer = document.createElement('div')
  spacer.style.flex = '1'

  const saveBtn = document.createElement('button')
  saveBtn.setAttribute('data-save-btn', 'true')
  saveBtn.type = 'button'
  saveBtn.className = 'sb-vc-save-btn'
  saveBtn.textContent = '保存済み'

  ratioRow.append(ratioLabel, ratioInput, pct, stepperWrap, spacer, saveBtn)

  // ── サムネイル ──
  const thumb = document.createElement('div')
  thumb.setAttribute('data-version-thumb', 'true')
  thumb.className = 'sb-vc-thumb'
  const html = version.html || ''
  if (html.includes('background') || html.includes('img')) {
    const LP_W = 640
    const THUMB_H = 80
    const THUMB_SCALE = 210 / LP_W
    const preview = document.createElement('div')
    preview.style.cssText = `position:absolute;top:0;left:0;width:${LP_W}px;height:${Math.round(THUMB_H / THUMB_SCALE)}px;transform:scale(${THUMB_SCALE});transform-origin:top left;pointer-events:none;overflow:hidden`
    preview.innerHTML = html
    thumb.append(preview)
  } else {
    const placeholder = document.createElement('div')
    placeholder.className = 'sb-vc-thumb-placeholder'
    placeholder.textContent = 'プレビュー'
    thumb.append(placeholder)
  }

  // ── タイムスタンプ + NEW ──
  const meta = document.createElement('div')
  meta.setAttribute('data-version-meta', 'true')
  meta.className = 'sb-vc-meta'
  meta.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
  const timeText = document.createElement('span')
  const updatedAt = (version as unknown as Record<string, unknown>)['updated_at']
  timeText.textContent = typeof updatedAt === 'string' ? relativeTime(updatedAt) + 'に保存' : '保存済み'
  meta.append(timeText)
  const newBadge = document.createElement('span')
  newBadge.className = 'sb-vc-new-badge'
  newBadge.textContent = 'NEW'
  meta.append(newBadge)

  // ── ⋮ ドットメニュートリガー ──
  const buttonsArea = document.createElement('div')
  buttonsArea.className = '_articleButtons_1xibh_160 sb-vc-dots-area'
  const dotsBtn = document.createElement('button')
  dotsBtn.type = 'button'
  dotsBtn.className = 'css-3tls8'
  dotsBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>'
  buttonsArea.append(dotsBtn)

  // ── コンテンツラッパー（選択モードのチェックボックス挿入先） ──
  const content = document.createElement('div')
  content.className = '_abTestArticleContent_vc'
  content.append(nameRow, ratioRow, thumb, meta)

  inner.append(content, buttonsArea)
  card.append(inner)
  return card
}

/** バージョンカードのCSS（スクリーンショット準拠）を注入する */
function injectVersionCardCss(): void {
  if (document.getElementById('sb-version-card-css') !== null) return
  const s = document.createElement('style')
  s.id = 'sb-version-card-css'
  s.textContent = `
    /* ── カード外枠 ── */
    ._currentVersion_vc {
      border:2px solid #e5e5ea;
      border-radius:12px;
      padding:14px;
      margin-bottom:10px;
      transition:border-color .15s,box-shadow .15s;
      position:relative;
      background:#fff;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,
        "Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;
    }
    ._currentVersion_vc:hover {
      border-color:#0091ff;
    }
    ._currentVersion_vc.${ACTIVE_CARD_CLASS} {
      border-color:#0091ff;
      box-shadow:0 0 0 3px rgba(0,145,255,.15);
    }
    /* ── Version名行 ── */
    .sb-vc-name-row {
      display:flex;align-items:center;gap:8px;margin-bottom:10px;
    }
    .sb-vc-name {
      flex:1;min-width:0;font-size:16px;font-weight:700;color:#1a1a1a;
      border:1px solid transparent;border-radius:4px;padding:2px 4px;
      background:transparent;outline:none;font-family:inherit;
      transition:border-color .12s;
    }
    .sb-vc-name:hover { border-color:#e5e5ea; }
    .sb-vc-name:focus { border-color:#0091ff;background:#fff; }
    /* ── バッジ ── */
    .sb-vc-badge {
      font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;
      white-space:nowrap;flex-shrink:0;
    }
    .sb-vc-badge--editing { background:rgba(255,140,0,.15);color:#ff8c00; }
    .sb-vc-badge--saved   { background:rgba(0,145,255,.1);color:#0091ff; }
    /* ── 配信割合行 ── */
    .sb-vc-ratio-row {
      display:flex;align-items:center;gap:6px;margin-bottom:10px;
    }
    .sb-vc-ratio-label { font-size:12px;color:#666;white-space:nowrap; }
    .sb-vc-ratio-input {
      width:50px;height:28px;border:1px solid #e5e5ea;border-radius:4px;
      font-size:13px;text-align:center;font-variant-numeric:tabular-nums;
      outline:none;font-family:inherit;-moz-appearance:textfield;padding:0 4px;
      box-sizing:border-box;
    }
    .sb-vc-ratio-input:focus { border-color:#0091ff; }
    .sb-vc-ratio-input::-webkit-inner-spin-button,
    .sb-vc-ratio-input::-webkit-outer-spin-button { -webkit-appearance:none;margin:0; }
    .sb-vc-ratio-pct { font-size:12px;color:#666; }
    /* ── ステッパー ── */
    .sb-vc-stepper { display:flex;flex-direction:column;gap:0; }
    .sb-vc-stepper-btn {
      width:18px;height:14px;border:1px solid #e5e5ea;background:#fff;
      font-size:7px;cursor:pointer;display:flex;align-items:center;
      justify-content:center;color:#666;padding:0;line-height:1;
    }
    .sb-vc-stepper-up { border-radius:3px 3px 0 0; }
    .sb-vc-stepper-down { border-radius:0 0 3px 3px;border-top:none; }
    .sb-vc-stepper-btn:hover { background:#f0f0f2; }
    /* ── 保存ボタン ── */
    .sb-vc-save-btn {
      font-size:11px;padding:4px 10px;border:1px solid #ff8c00;
      border-radius:12px;font-weight:500;background:#fff;color:#ff8c00;
      cursor:pointer;white-space:nowrap;font-family:inherit;
      transition:background .12s;
    }
    .sb-vc-save-btn:hover { background:rgba(255,140,0,.06); }
    /* ── サムネイル ── */
    .sb-vc-thumb {
      width:100%;height:80px;background:#f5f6f8;border-radius:6px;
      overflow:hidden;position:relative;border:1px solid #f0f0f2;
      margin-bottom:8px;
    }
    .sb-vc-thumb-placeholder {
      width:100%;height:100%;display:flex;align-items:center;
      justify-content:center;color:#b0b0b0;font-size:10px;
    }
    /* ── タイムスタンプ ── */
    .sb-vc-meta {
      display:flex;align-items:center;gap:4px;
      font-size:10px;color:#b0b0b0;
    }
    .sb-vc-new-badge {
      display:inline-block;font-size:8px;font-weight:700;color:#fff;
      background:#ff8c00;padding:1px 5px;border-radius:3px;
      letter-spacing:.3px;line-height:1.3;margin-left:2px;
    }
    /* ── ⋮ メニュー（ホバー時のみ表示・重なり防止） ── */
    .sb-vc-dots-area {
      position:absolute !important;top:10px !important;right:10px !important;
      padding:0 !important;opacity:0;transition:opacity .12s;
    }
    ._currentVersion_vc:hover .sb-vc-dots-area { opacity:1; }
    .sb-vc-dots-area button.css-3tls8 {
      position:static !important;
      width:22px !important;height:22px !important;
      border:none !important;background:transparent !important;
      border-radius:4px !important;cursor:pointer !important;
      color:#b0b0b0 !important;transition:background .12s !important;
    }
    .sb-vc-dots-area button.css-3tls8:hover {
      background:#f0f0f2 !important;color:#666 !important;
    }
    /* ── Version追加ボタン（最下部固定・青） ── */
    [data-test="Article-BtnCreateNewArticle"] {
      background:#0091ff !important;color:#fff !important;
      font-weight:600 !important;font-size:12px !important;
      border-radius:0 !important;border:none !important;
      padding:10px !important;display:flex !important;
      align-items:center !important;justify-content:center !important;
      gap:4px !important;cursor:pointer !important;
    }
    [data-test="Article-BtnCreateNewArticle"]:hover {
      background:#007ae6 !important;
    }
    /* ── 「さらに読み込む」カード（カード一覧末尾） ── */
    .sb-vc-load-more {
      border:2px dashed #d0d0d5 !important;border-radius:12px !important;
      background:#fff !important;padding:14px !important;
      display:flex !important;align-items:center !important;justify-content:center !important;
      gap:6px !important;cursor:pointer !important;
      margin:8px 8px 12px !important;
      transition:border-color .15s,background .12s !important;
    }
    .sb-vc-load-more:hover {
      background:#fafafa !important;border-color:#b0b0b5 !important;
    }
    /* ── Versionパネル全体 ── */
    [class*="_abTestArticlesWrapper_"] { background:#fff !important; }
  `
  document.head.append(s)
}

/** ISO 日時文字列を相対表現に変換する */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'たった今'
  if (mins < 60) return `${mins}分前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  return `${days}日前`
}

// 指示93: mountCompareButton は削除。比較機能はヘッダーの「比較する」ボタンに移動。

/**
 * コンテンツ上部にURLコピーバーを挿入する。
 * 旧コンテンツツールバーを置き換え、検証用/本番用URLのワンクリックコピーを提供する。
 * 編集機能はすべて右プロパティパネルに集約された。
 */
function mountUrlBarInEditor(ctx: EditorContext): HTMLElement | null {
  const contentWrapper = ctx.root.querySelector<HTMLElement>('.quillEditorContentWrapper')
  if (contentWrapper === null) return null
  // 既存の旧ツールバーがあれば除去
  contentWrapper.querySelector('[data-content-toolbar]')?.remove()
  // 既存チェック
  if (contentWrapper.querySelector('[data-url-bar]') !== null) return null

  const testUrl = `https://sb-draft-preview.squadbeyond.com/articles/${ctx.currentUid}/draft`
  const prodUrl = `https://squadbeyond.com/articles/${ctx.currentUid}`

  const bar = mountUrlBar({ testUrl, prodUrl })

  // Quill ホスト（#quillIframe の後継 div）の直前に挿入
  const quillHost = ctx.quill.container as HTMLElement
  const hostParent = quillHost.parentElement
  if (hostParent !== null) {
    hostParent.insertBefore(bar, quillHost)
  } else {
    contentWrapper.prepend(bar)
  }
  return bar
}

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

function loadVersion(ctx: EditorContext, uid: string): void {
  const v = ctx.versions.find((x) => x.uid === uid)
  if (v === undefined) return

  // 指示72: バージョン切り替え中のローディング表示
  const contentWrapper = ctx.root.querySelector<HTMLElement>('.quillEditorContentWrapper')
  let overlay: HTMLElement | null = null
  if (contentWrapper !== null) {
    overlay = document.createElement('div')
    overlay.setAttribute('data-version-loading', 'true')
    overlay.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:100',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(255,255,255,.7)',
    ].join(';')
    overlay.innerHTML = `<div style="text-align:center">
      <div style="width:32px;height:32px;border:3px solid #e0e0e0;border-top-color:#4A90D9;border-radius:50%;animation:sbspin .7s linear infinite;margin:0 auto"></div>
      <div style="margin-top:8px;font-size:13px;color:#666">バージョン切り替え中...</div>
    </div>`
    if (getComputedStyle(contentWrapper).position === 'static') {
      contentWrapper.style.position = 'relative'
    }
    contentWrapper.append(overlay)
  }

  // 重い DOM 更新をマクロタスクに回してオーバーレイを先に描画させる
  setTimeout(() => {
    ctx.currentUid = uid
    ctx.quill.root.innerHTML = v.html
    renderVersionList(ctx)
    overlay?.remove()
    // URLバーを新しい Version UID で更新
    const urlBarEl = ctx.root.querySelector<HTMLElement>('[data-url-bar]')
    if (urlBarEl !== null) {
      updateUrlBar(urlBarEl, {
        testUrl: `https://sb-draft-preview.squadbeyond.com/articles/${uid}/draft`,
        prodUrl: `https://squadbeyond.com/articles/${uid}`,
      })
    }
    // 比較パネルが開いていればプレビューも更新
    if (isComparePanelOpen()) refreshComparePreview(v.html)
  }, 50)
}

/** アクティブ表示に使う実CSSクラス（採取物のクラス。書き換えていない） */
const ACTIVE_CARD_CLASS = '_active_1xibh_202'
/** カードの「…」トリガー（採取物のクラス） */
const DOTS_MENU_TRIGGER = 'button.css-3tls8'

/**
 * Versionパネルのカードを ctx.versions から**1枚ずつ描き直す**。
 * 採取物には現在Versionのカードが1枚しか無いので、それを雛形にVersionの数だけ複製して並べる。
 * これが無いと、複製/追加したVersionのカードが下に増えない（＝ユーザー報告の不具合）。
 */
function renderVersionList(ctx: EditorContext): void {
  const list = ctx.root.querySelector<HTMLElement>(HOOK.versionList)
  if (list === null) return
  const addButton = list.querySelector<HTMLElement>(HOOK.addVersion)
  for (const card of list.querySelectorAll<HTMLElement>(HOOK.versionRow)) card.remove()
  // 前回の「さらに読み込む」を除去（再描画のたびに作り直す）
  list.querySelector('.sb-vc-load-more')?.remove()

  const archivedMode = ctx.listMode === 'archived'
  const shown = ctx.versions.filter((v) => (archivedMode ? v.archived === true : v.archived !== true))
  // アーカイブ一覧では「Version追加」を隠す（実物どおり・追加は通常一覧の操作）
  if (addButton !== null) addButton.style.display = archivedMode ? 'none' : ''

  if (archivedMode && shown.length === 0) {
    const empty = document.createElement('div')
    empty.dataset['articleUid'] = '__empty__'
    empty.style.cssText = 'padding:24px 12px;color:#888;font-size:13px;line-height:1.8'
    empty.textContent = 'アーカイブされたVersionはありません。'
    if (addButton !== null) list.insertBefore(empty, addButton)
    else list.append(empty)
    return
  }

  for (const version of shown) {
    const isCurrent = version.uid === ctx.currentUid
    const card = buildVersionCardEl(version, isCurrent)
    if (archivedMode) wireArchivedCard(ctx, card, version)
    else wireVersionCard(ctx, card, version)
    if (addButton !== null) list.insertBefore(card, addButton)
    else list.append(card)
  }
  // 通常モードのみ: カード一覧末尾に「さらに読み込む」を挿入
  if (!archivedMode) {
    const loadMore = document.createElement('div')
    loadMore.className = 'sb-vc-load-more'
    const plus = document.createElement('span')
    plus.textContent = '+'
    plus.style.cssText = 'font-size:16px;font-weight:700;color:#999'
    const label = document.createElement('span')
    label.textContent = 'Versionを追加'
    label.style.cssText = 'font-size:13px;color:#666'
    const badge = document.createElement('span')
    badge.textContent = 'NEW'
    badge.style.cssText = 'font-size:9px;font-weight:700;color:#fff;background:#ff4444;border-radius:3px;padding:1px 5px;margin-left:2px'
    loadMore.append(plus, label, badge)
    loadMore.addEventListener('click', async () => {
      try {
        await saveHtml(ctx)
        const { version } = await api.addVersion(ctx.articleUid)
        ctx.versions = [...ctx.versions, version]
        toast(`${version.name} を追加しました`)
        loadVersion(ctx, version.uid)
      } catch (error) {
        toast((error as Error).message, 'error')
      }
    })
    list.append(loadMore)
  }
  applySelectionMode(ctx, list)
}

/** Versionパネル上部（選択モードでは「キャンセル / アーカイブする」を差し込む） */
const ARTICLES_TOP = '[class*="_abTestArticlesTop"]'
const CARD_CONTENT = '[class*="_abTestArticleContent"]'

/**
 * 「選択してアーカイブする」モードの見た目と挙動（指示⑮）。
 * 実物どおり: 上部を「キャンセル / アーカイブする」に、各カードにチェックボックスを足す。
 * 通常ヘッダ（Version▼等）は innerHTML を壊さず display で退避し、配線を失わない。
 * アーカイブは配信割合1以上を1件は残すサーバーガードが効く。
 */
function applySelectionMode(ctx: EditorContext, list: HTMLElement): void {
  const top = ctx.root.querySelector<HTMLElement>(ARTICLES_TOP)
  // 前回の選択ヘッダを消し、通常ヘッダの退避を解除する
  ctx.root.querySelector('[data-clone-selheader]')?.remove()
  if (top !== null) {
    for (const child of [...top.children]) (child as HTMLElement).style.removeProperty('display')
  }
  if (!ctx.selectionMode || top === null) return

  // 通常ヘッダを退避（配線は残る）し、選択ヘッダを差し込む
  for (const child of [...top.children]) (child as HTMLElement).style.display = 'none'
  const selHeader = document.createElement('div')
  selHeader.setAttribute('data-clone-selheader', '')
  selHeader.style.cssText =
    'display:flex;justify-content:space-between;align-items:center;padding:6px 10px;font-size:13px'
  selHeader.innerHTML =
    '<div data-clone-sel-cancel style="cursor:pointer;color:#0091FF">キャンセル</div>' +
    '<div data-clone-sel-bulk style="cursor:pointer;color:#bbb;pointer-events:none">アーカイブする</div>'
  top.prepend(selHeader)

  const bulk = selHeader.querySelector<HTMLElement>('[data-clone-sel-bulk]')
  selHeader.querySelector<HTMLElement>('[data-clone-sel-cancel]')?.addEventListener('click', () => {
    ctx.selectionMode = false
    renderVersionList(ctx)
  })

  const selected = new Set<string>()
  const syncBulk = (): void => {
    if (bulk === null) return
    const on = selected.size > 0
    bulk.style.color = on ? '#E5573F' : '#bbb'
    bulk.style.pointerEvents = on ? 'auto' : 'none'
  }
  for (const card of list.querySelectorAll<HTMLElement>(HOOK.versionRow)) {
    const uid = card.dataset['articleUid']
    const content = card.querySelector<HTMLElement>(CARD_CONTENT)
    if (uid === undefined || content === null) continue
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.setAttribute('data-test', 'ArticleList-ArticleCheckBox')
    checkbox.value = uid
    checkbox.style.cssText = 'margin-right:8px;cursor:pointer'
    content.prepend(checkbox)
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.add(uid)
      else selected.delete(uid)
      syncBulk()
    })
  }
  bulk?.addEventListener('click', () => {
    if (selected.size > 0) void bulkArchive(ctx, [...selected])
  })
}

/** 選択したVersionをまとめてアーカイブ（配信割合1以上を1件残すガードは各リクエストで効く） */
async function bulkArchive(ctx: EditorContext, uids: readonly string[]): Promise<void> {
  let failed = 0
  for (const uid of uids) {
    try {
      const { version } = await api.archiveVersion(uid)
      ctx.versions = ctx.versions.map((v) => (v.uid === version.uid ? version : v))
    } catch {
      failed += 1
    }
  }
  ctx.selectionMode = false
  const archived = uids.length - failed
  toast(
    failed > 0
      ? `${archived}件アーカイブ（${failed}件は配信割合1以上を残すため不可）`
      : `${archived}件アーカイブしました`,
  )
  const next = ctx.versions.find((v) => v.archived !== true)
  if (next !== undefined) loadVersion(ctx, next.uid)
  else renderVersionList(ctx)
}

/** アーカイブ一覧のカード: 名前/割合を表示し、「復元」でアーカイブ解除して通常一覧へ戻す（指示⑮） */
function wireArchivedCard(ctx: EditorContext, card: HTMLElement, version: Version): void {
  card.dataset['articleUid'] = version.uid
  card.setAttribute('data-id', String(version.id))
  card.querySelector<HTMLElement>(HOOK.currentVersion)?.classList.remove(ACTIVE_CARD_CLASS)
  const name = card.querySelector<HTMLInputElement>(HOOK.versionName)
  const ratio = card.querySelector<HTMLInputElement>(HOOK.ratio)
  if (name !== null) {
    name.value = version.name
    name.readOnly = true
  }
  if (ratio !== null) {
    ratio.value = String(version.distribution_ratio)
    ratio.readOnly = true
  }
  // 「…」トリガーは隠し、更新ボタンを「復元」に置き換える
  card.querySelector<HTMLElement>(DOTS_MENU_TRIGGER)?.style.setProperty('display', 'none')
  const restore = findUpdateButton(card)
  if (restore !== null) {
    restore.textContent = '復元'
    restore.addEventListener('click', (event) => {
      event.stopPropagation()
      void api.unarchiveVersion(version.uid).then((res) => {
        ctx.versions = ctx.versions.map((v) => (v.uid === version.uid ? res.version : v))
        toast(`${res.version.name} を復元しました`)
        ctx.listMode = 'active'
        setVersionListMode(ctx.root, 'active')
        loadVersion(ctx, res.version.uid)
      })
    })
  }
}

/** 1枚のVersionカードに操作（名前/配信割合/更新/「…」/クリック切替）を配線する */
function wireVersionCard(ctx: EditorContext, card: HTMLElement, version: Version): void {
  // このカードが表す最新のVersion（保存のたびに新しいオブジェクトへ差し替える＝イミュータブル・§12）。
  let model = version
  const isCurrent = model.uid === ctx.currentUid

  const name = card.querySelector<HTMLInputElement>(HOOK.versionName)
  const ratio = card.querySelector<HTMLInputElement>(HOOK.ratio)

  // 指示㉘: 非選択カードでは名前入力のクリックをカードへ通す（pointer-events:none）。
  // 名前編集は切替後に行う（実物と同じ「まず選択」動線）。
  if (name !== null && !isCurrent) name.style.pointerEvents = 'none'

  const save = async (): Promise<void> => {
    const nextName = name !== null && name.value !== model.name ? name.value : null
    const nextRatio =
      ratio !== null && Number(ratio.value) !== model.distribution_ratio ? Number(ratio.value) : null
    if (nextName === null && nextRatio === null) return
    try {
      let updated = model
      if (nextName !== null) {
        await api.saveVersion(model.uid, { name: nextName })
        updated = { ...updated, name: nextName }
      }
      if (nextRatio !== null) {
        const res = await api.setRatio(model.uid, nextRatio)
        updated = { ...updated, distribution_ratio: res.version.distribution_ratio }
        if (ratio !== null) ratio.value = String(res.version.distribution_ratio)
      }
      model = updated
      ctx.versions = ctx.versions.map((v) => (v.uid === updated.uid ? updated : v))
      toast('更新しました')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  name?.addEventListener('change', () => void save())
  ratio?.addEventListener('change', () => void save())
  card.querySelector(HOOK.ratioUp)?.addEventListener('click', (event) => {
    event.stopPropagation()
    if (ratio === null) return
    ratio.value = String(Math.min(100, Number(ratio.value) + 1))
    void save()
  })
  card.querySelector(HOOK.ratioDown)?.addEventListener('click', (event) => {
    event.stopPropagation()
    if (ratio === null) return
    ratio.value = String(Math.max(0, Number(ratio.value) - 1))
    void save()
  })
  // 保存ボタンの配線
  const saveBtn = findUpdateButton(card)
  if (saveBtn !== null) {
    saveBtn.addEventListener('click', (event) => {
      event.stopPropagation()
      void save()
    })
  }

  // 選択モードでは「…」を隠し、カードクリックでの切替もしない（チェックボックス操作のみ）。
  if (ctx.selectionMode) {
    card.querySelector<HTMLElement>(DOTS_MENU_TRIGGER)?.style.setProperty('display', 'none')
  }

  // カードのクリックでVersionを切り替える（入力欄・ボタン・スピナー・「…」上は除く）。
  card.style.cursor = 'pointer'
  card.addEventListener('click', (event) => {
    if (ctx.selectionMode) return
    const target = event.target as HTMLElement
    if (target.closest('input, button, ._articleButtons_1xibh_160') !== null) return
    if (target.closest(HOOK.ratioUp) !== null || target.closest(HOOK.ratioDown) !== null) return
    if (model.uid === ctx.currentUid) return
    void saveHtml(ctx).then(() => loadVersion(ctx, model.uid))
  })

  // このカードの「…」メニューは**このVersion**を対象にする。
  mountVersionDotsMenu(card, {
    abTestUid: ctx.abTestUid,
    getCurrentVersion: () => model,
    onDuplicated: (created) => {
      ctx.versions = [...ctx.versions, created]
      // 追加分のカードが下に増える。複製先へ切り替える。
      loadVersion(ctx, created.uid)
    },
    onArchived: (archived) => {
      ctx.versions = ctx.versions.map((v) =>
        v.uid === archived.uid ? { ...v, archived: true } : v,
      )
      const next = ctx.versions.find((v) => v.archived !== true)
      if (next !== undefined) loadVersion(ctx, next.uid)
      else renderVersionList(ctx)
    },
    onDeleted: (deleted) => {
      // 一覧から取り除き、残りの先頭（非アーカイブ）へ切り替える。
      ctx.versions = ctx.versions.filter((v) => v.uid !== deleted.uid)
      const next = ctx.versions.find((v) => v.archived !== true) ?? ctx.versions[0]
      if (next !== undefined) loadVersion(ctx, next.uid)
      else renderVersionList(ctx)
    },
    onSelectArchiveMode: () => {
      ctx.selectionMode = true
      renderVersionList(ctx)
    },
  })
}

/** カード内の保存ボタンを探す（data属性→文言フォールバック） */
function findUpdateButton(card: HTMLElement): HTMLElement | null {
  // data-save-btn 属性で探す（指示62で付与）
  const marked = card.querySelector<HTMLElement>('[data-save-btn]')
  if (marked !== null) return marked
  // フォールバック: 旧テキスト「更新」で探す（初回配線前）
  const buttons = card.querySelectorAll<HTMLElement>('._articleButtons_1xibh_160 button')
  for (const button of buttons) {
    if ((button.textContent ?? '').trim().startsWith('更新')) return button
  }
  return null
}

/** 「Version追加」ボタンを1回だけ配線する（カード再描画で消えない要素なので使い回す） */
function wireAddVersion(ctx: EditorContext): void {
  const addBtn = ctx.root.querySelector<HTMLElement>(HOOK.addVersion)
  if (addBtn === null) return
  // 指示100: ボタンテキストを「バージョンを追加」に変更
  const spanLabel = addBtn.querySelector('span')
  if (spanLabel !== null) spanLabel.textContent = 'バージョンを追加'
  addBtn.addEventListener('click', async () => {
    try {
      await saveHtml(ctx)
      const { version } = await api.addVersion(ctx.articleUid)
      ctx.versions = [...ctx.versions, version]
      toast(`${version.name} を追加しました`)
      loadVersion(ctx, version.uid)
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  })
}

/**
 * 本文が「実質空」か。テキストも画像/動画等のメディアも無ければ空とみなす。
 * （`<p><br></p>` だけの土台初期状態や、リコンサイルで一瞬空になった状態を判定する。）
 */
function isEffectivelyEmptyHtml(html: string): boolean {
  const probe = document.createElement('div')
  probe.innerHTML = html
  const hasMedia = probe.querySelector('img, video, iframe, audio, svg, canvas') !== null
  const text = (probe.textContent ?? '').replace(/\u200B/g, '').trim()
  return !hasMedia && text === ''
}

async function saveHtml(ctx: EditorContext): Promise<void> {
  if (ctx.currentUid === '') return
  const html = ctx.quill.root.innerHTML
  const v = ctx.versions.find((x) => x.uid === ctx.currentUid)
  // 🚨データ損失防止: いま中身のあるVersionを「空」で上書きしない。
  // エディタの再描画/Quillのリコンサイルで本文が一瞬空になった瞬間に自動保存が走ると、
  // 入れた画像ごとサーバーの内容を消してしまう事故が起きる（実際に「めぐり」で発生）。
  // 空にしたい場合はVersion自体をアーカイブ/削除で行う（自動保存で全消しはさせない）。
  if (v !== undefined && isEffectivelyEmptyHtml(html) && !isEffectivelyEmptyHtml(v.html)) {
    console.warn(
      '[editor] 空の本文で既存Versionを上書きしようとしたため保存を中止しました:',
      ctx.currentUid,
    )
    return
  }
  await api.saveVersion(ctx.currentUid, { html })
  if (v !== undefined) v.html = html
}

/** モック準拠: 右レールアイコンの SVG（指示92） */
const RAIL_ICON_SVGS: readonly string[] = [
  /* 0: プレビュー */ '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:18px;height:18px"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>',
  /* 1: 履歴 */     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:18px;height:18px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  /* 2: ライブラリ */ '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:18px;height:18px"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  /* 3: リンク置換 */ '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:18px;height:18px"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  /* 4: LP設定 */   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:18px;height:18px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  /* 5: タグ設定 */  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:18px;height:18px"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  /* 6: 戻る */     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:18px;height:18px"><path d="M3 7h8a4 4 0 0 1 0 8H7"/><polyline points="6 4 3 7 6 10"/></svg>',
  /* 7: 進む */     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:18px;height:18px"><path d="M21 7h-8a4 4 0 0 0 0 8h4"/><polyline points="18 4 21 7 18 10"/></svg>',
  /* 8: 画像 */     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:18px;height:18px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
]

function wireSideToolbar(ctx: EditorContext): void {
  // カード接続部分の隙間を埋める
  injectCardSeamStyles()
  // 右レールアイコンのスタイルを実物に合わせる（丸い背景付き）
  injectSideToolbarStyles()
  // ── 各パネルを配線（実装は src/app/panels/ に分かれている）──
  mountVersionSettings(ctx.root, ctx.articleUid, () => void applyMasterStyleToEditor(ctx))
  mountTagSettings(ctx.root, ctx.articleUid)
  // 置換の対象は「いま開いているVersion」。パネルは押されるたびに読み直す
  // サイドパネルは**押したときに開く**。実物は同時に1枚しか開かない
  // （採取したどの状態も1枚だけ開いた姿で採れている）。
  // 以前はマウント時点で全部開いており、画面上で重なっていた。
  const panels = createPanelGroup()
  const openers: Readonly<Record<number, () => HTMLElement | null>> = {
    1: () => mountHistory(ctx.root, ctx.articleUid),
    3: () => mountLinkReplace(ctx.root, ctx.articleUid, () => ctx.currentUid),
  }
  // リンクパネルの「計測ツールの変更」は、実物と同じ beyondページの編集画面（基本情報タブ）へ。
  mountEditorToolbar(ctx.root, ctx.quill, {
    trackingSettingsHref: `#/folders/${ctx.folderUid}/ab_tests/${ctx.abTestUid}/edit`,
  })
  // 旧フローティングツールバーを非表示にし、URLコピーバー + 右プロパティパネルに置き換える
  hideFloatingToolbar(ctx.root)
  mountSidebarToolbarPanel(ctx)
  mountUrlBarInEditor(ctx)
  // 右プロパティパネル（全編集機能を集約）
  mountPropertiesPanelInEditor(ctx)
  // パズルピース（Widget管理ボタン）は実物では Widgetライブラリを開く
  mountWidgetLibrary(ctx.root, ctx.quill)
  // Widget ブロットクリックで本番同様の Widget編集オーバーレイを開く
  wireWidgetClick(ctx.root, ctx.quill)
  // Widget ナビカード（バージョンリストとキャンバスの間のカード）
  mountWidgetNav(ctx.root, ctx.quill)

  // 指示70: スクロール領域が変わったため、右レールの position:fixed は不要になった。
  // 採取CSSのままで問題なく表示される。

  const icons = [...ctx.root.querySelectorAll<HTMLElement>('[class*="sideToolbarIcon"]')]
  for (let index = 0; index < icons.length; index += 1) {
    const icon = icons[index]
    if (icon === undefined) continue
    icon.style.cursor = 'pointer'
    icon.classList.add('rail-item')

    // 指示92: 基板アイコンをモック準拠のSVGに完全差し替え
    // 基板の子要素（button, img, svg, dropdown trigger 等）を全て隠し、
    // モック準拠SVGだけを表示する
    const mockupSvg = RAIL_ICON_SVGS[index]
    if (mockupSvg !== undefined) {
      for (const child of icon.children) {
        if (child instanceof HTMLElement && !child.hasAttribute('data-rail-svg') && !child.classList.contains('sb-side-label')) {
          child.style.display = 'none'
        }
      }
      // 既存のSVG差し替え済みチェック
      if (icon.querySelector('[data-rail-svg]') === null) {
        const svgWrap = document.createElement('span')
        svgWrap.setAttribute('data-rail-svg', 'true')
        svgWrap.innerHTML = mockupSvg
        icon.prepend(svgWrap)
      }
    }

    // 指示78: アイコン下にテキストラベルを表示
    const labelText = SIDE_TOOLS[index] ?? ''
    icon.title = labelText
    if (icon.querySelector('.sb-side-label') === null) {
      const label = document.createElement('span')
      label.className = 'sb-side-label'
      label.textContent = labelText
      icon.append(label)
    }

    if (index === PREVIEW_TOOL_INDEX) {
      // プレビューは右レールの1番目。aria-label で引くと別の要素に当たっていて、
      // レールのアイコンを押しても何も起きなかった。位置で引く。
      // 実物と同じく**新しいタブ**で `/ab_tests/:uid/articles/:stepUid/previews` を開く。
      icon.addEventListener('click', async () => {
        await saveHtml(ctx)
        const url =
          `${location.origin}${location.pathname}` +
          `#/ab_tests/${ctx.abTestUid}/articles/${ctx.currentUid}/previews`
        window.open(url, '_blank', 'noopener')
      })
      continue
    }

      const open = openers[index]
    if (open !== undefined) {
      // 押すたびに開閉。開くときは他のパネルを閉じる（実物は同時に1枚だけ）。
      icon.addEventListener('click', () => {
        const panel = open()
        if (panel === null) return
        panels.register(SIDE_TOOLS[index] ?? String(index), panel)
        panels.toggle(SIDE_TOOLS[index] ?? String(index))
      })
      continue
    }
    // 元に戻す / やり直す は Quill の履歴で実際に動かす（data-test がアイコンの
    // 内側にあり外側クリックを拾えないことがあるため、レールアイコンに直接配線する）。
    if (index === UNDO_TOOL_INDEX) {
      icon.addEventListener('click', () => ctx.quill.history.undo())
      continue
    }
    if (index === REDO_TOOL_INDEX) {
      icon.addEventListener('click', () => ctx.quill.history.redo())
      continue
    }
    // 外部サーバー画像アップロードは、実物のモーダルが採取できていないため
    // 見た目は真似ず、標準のファイル選択でカーソル位置へ画像を挿入する（§11 の“正直な代替”）。
    if (index === EXTERNAL_IMAGE_TOOL_INDEX) {
      mountExternalImage(icon, ctx.quill)
      continue
    }
    if (WIRED_TOOLS.includes(index)) {
      // 指示99: 基板の子要素はdisplay:noneで隠しているが、mount関数がそこに
      // click handlerを配線済み。親アイコンのクリックを隠れた子に中継する。
      icon.addEventListener('click', () => {
        const target = icon.querySelector<HTMLElement>('button, [role="button"], [class*="_trigger_"]')
        if (target !== null) target.click()
      })
      continue
    }
    // それでも残るツールがあれば正直にトースト
    const name = SIDE_TOOLS[index] ?? 'このツール'
    icon.addEventListener('click', () => toast(`${name} は未実装です`, 'error'))
  }

  // 指示93: 比較モードはヘッダーの「比較する」ボタンに移動。
  // 右レールの旧 mountCompareButton は削除。

  // 本文の自動保存。実物のエディタは自動保存が走る
  // （docs/findings-live-observation.md「エディタは『開くだけで自動保存』が走る」・DOMに _saveAnimation_）。
  // これが無いと、打った内容がサーバーに残らない。
  /** 「更新」ボタンの色で保存状態を示す: 青=保存済み / オレンジ=未保存あり */
  function findCurrentUpdateButton(): HTMLElement | null {
    const cards = ctx.root.querySelectorAll<HTMLElement>('[data-id]')
    for (const card of cards) {
      const btn = findUpdateButton(card)
      if (btn !== null) return btn
    }
    return null
  }

  function markUnsaved(): void {
    const btn = findCurrentUpdateButton()
    if (btn === null) return
    btn.textContent = '未保存'
    btn.style.transition = 'background-color 0.3s'
    btn.style.backgroundColor = '#f59e0b'
    btn.style.color = '#fff'
  }

  /** 指示83: 保存中スピナー表示 */
  function markSaving(): void {
    const btn = findCurrentUpdateButton()
    if (btn === null) return
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="animation:ep-spin .7s linear infinite;vertical-align:middle;margin-right:4px"><circle cx="7" cy="7" r="5.5" stroke="#fff" stroke-width="2" stroke-dasharray="20 12" stroke-linecap="round"/></svg>保存中`
    btn.style.transition = 'background-color 0.3s'
    btn.style.backgroundColor = '#f59e0b'
    btn.style.color = '#fff'
    // スピナーのkeyframeを1回だけ注入
    if (document.getElementById('ep-spin-kf') === null) {
      const s = document.createElement('style')
      s.id = 'ep-spin-kf'
      s.textContent = '@keyframes ep-spin{to{transform:rotate(360deg)}}'
      document.head.append(s)
    }
  }

  function markSaved(): void {
    const btn = findCurrentUpdateButton()
    if (btn === null) return
    btn.textContent = '保存済み'
    btn.style.transition = 'background-color 0.3s'
    btn.style.backgroundColor = ''
    btn.style.color = ''
    // 指示97: ヘッダーの保存時刻を更新
    updateSaveTimestamp()
  }

  const autosave = createAutosave({
    // 変更のたびに保存し、同時に履歴スナップショットを積む（指示⑪・サーバー側で最新100件に丸め）。
    save: async () => {
      markSaving()
      await saveHtml(ctx)
      markSaved()
      try {
        await recordArticleHistory(ctx.articleUid, ctx.quill.root.innerHTML)
      } catch {
        // 履歴記録の失敗で編集は止めない（保存自体は済んでいる）。
      }
    },
    delayMs: AUTOSAVE_DELAY_MS,
    onError: (error) => toast(`保存できませんでした: ${error.message}`, 'error'),
  })
  ctx.quill.on('text-change', (_delta, _old, source) => {
    // 画面を切り替えた直後の再描画で保存が走ると、古い内容を書き戻してしまう。
    if (source === 'user') {
      markUnsaved()
      autosave.schedule()
    }
  })

  // 保存（実物にはショートカットが無いが、作業用に足している）
  ctx.root.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      void autosave.flush().then(() => toast('保存しました'))
    }
  })
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

/** CSS を1回だけ注入（Versionフィルタ用） */
function injectVersionFilterCss(): void {
  if (document.getElementById('lps-mockup-master') !== null) return
  if (document.getElementById('sb-version-filter-css') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-version-filter-css'
  style.textContent = `
    .sb-version-filter-wrap {
      display: flex;
      gap: 0;
      flex-shrink: 0;
    }
    .sb-version-filter {
      display: inline-block;
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 500;
      color: #666;
      border: 1px solid #e5e5ea;
      background: #fff;
      cursor: pointer;
      line-height: 1.4;
      transition: color 0.15s, background 0.15s, border-color 0.15s;
      white-space: nowrap;
      font-family: inherit;
    }
    .sb-version-filter:first-child {
      border-radius: 4px 0 0 4px;
    }
    .sb-version-filter:last-child {
      border-radius: 0 4px 4px 0;
      border-left: none;
    }
    .sb-version-filter:hover {
      color: #333;
      background: #f0f0f2;
    }
    .sb-version-filter.sb-filter-active {
      background: #0091ff;
      color: #fff;
      border-color: #0091ff;
      font-weight: 500;
    }
  `
  document.head.append(style)
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

/** Date → 「たった今」「N分前」「N時間前」「HH:MM」形式 */
function formatSaveTime(saved: Date): string {
  const diff = Math.floor((Date.now() - saved.getTime()) / 1000)
  if (diff < 30) return 'たった今'
  if (diff < 60) return `${diff}秒前`
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins}分前`
  const hours = Math.floor(mins / 60)
  if (hours < 12) return `${hours}時間前`
  const hh = String(saved.getHours()).padStart(2, '0')
  const mm = String(saved.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** ヘッダーの保存時刻表示を「今」に更新 */
function updateSaveTimestamp(): void {
  const el = document.querySelector<HTMLElement>('[data-save-time]')
  if (el === null) return
  const now = new Date()
  el.dataset['savedAt'] = String(now.getTime())
  el.textContent = formatSaveTime(now)
}
