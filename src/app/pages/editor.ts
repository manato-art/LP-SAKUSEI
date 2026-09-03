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
import { createAutosave } from './autosave.ts'
import { createPanelGroup } from '../panels/panel-group.ts'
import { recordHistory } from './folders.ts'
import { mountVersionListDropdown, setVersionListMode } from '../panels/version-actions.ts'
import { mountVersionDotsMenu } from '../panels/version-dots-menu.ts'
import { mountHeaderImageModal } from '../panels/header-image-modal.ts'
import { mountVersionLinkPopup } from '../panels/version-link-popup.ts'
import { mountStepAddModal } from '../panels/step-add-modal.ts'
import { mountWidgetLibrary } from '../panels/widget-library.ts'
import { EXTERNAL_IMAGE_TOOL_INDEX, mountExternalImage } from '../panels/external-image.ts'
import { registerMediaBlots } from '../panels/media-blots.ts'
import { wireMediaDrop } from '../panels/media-insert.ts'
import { wireImageResize } from '../panels/image-resize.ts'
import { mountMinimap } from '../panels/minimap.ts'
import { wireAbTestTabs } from './tab-nav.ts'
import { wireBeyondNavAnchors } from './beyond-nav.ts'
import { masterStyleEditorDecls } from '../master-style.ts'

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

/** 右レール9ツールの実際の名前（実DOMの tooltip / aria-label より） */
const SIDE_TOOLS: readonly string[] = [
  'プレビュー',
  '変更・復元履歴',
  'Widget管理',
  'リンク置換',
  'Version設定',
  'タグ設定',
  '元に戻す',
  'やり直す',
  '外部サーバー画像アップロード',
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
    navWrapper.style.paddingTop = '14px'
    navWrapper.style.height = '54px'
  }
  const editorWrapper = root.querySelector<HTMLElement>('[class*="_editorWrapper_"]')
  if (editorWrapper !== null) {
    editorWrapper.style.height = 'calc(100% - 78px)'
    editorWrapper.style.padding = '8px 12px'
  }
  // boostEditorWrapper も同じ calc を使う
  const boostWrapper = root.querySelector<HTMLElement>('[class*="_boostEditorWrapper_"]')
  if (boostWrapper !== null) {
    boostWrapper.style.height = 'calc(100% - 78px)'
  }
  // Versionパネル（_abTestArticlesWrapper_）も同じ 120px を引いている
  const articlesWrapper = root.querySelector<HTMLElement>('[class*="_abTestArticlesWrapper_"]')
  if (articlesWrapper !== null) {
    articlesWrapper.style.height = 'calc(100vh - 68px)'
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
  // 下部バーの「< / >」＝ファネルステップの行き来（指示⑮）
  wireStepNavigation(ctx)
  wireSideToolbar(ctx)
  wireTopBar(root, ab_test.title, folderName)
  // 4タブ（基本情報 / Version / ポップアップ / レポート）を相互に行き来できるようにする
  wireAbTestTabs(root, abTestUid, folder?.uid ?? '')
  wireTopRightIcons(root, abTestUid, folder?.uid ?? '')
  loadVersion(ctx, ctx.currentUid)
  // 指示㊻: エディタ右側にミニマップ（LP全体の縮小プレビュー）を表示
  // 指示㊿②: スクロール対象は Quill ホスト（LP本文のスクロール領域）
  const quillHost = quill.container as HTMLElement
  mountMinimap(root, quillHost)
  // pinToolbar は requestAnimationFrame で走る。同一フレーム内の後続 RAF では
  // layout がまだ反映されていないことがあるので、次フレームまで遅延させる。
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const minimap = document.querySelector<HTMLElement>('[data-clone-minimap]')
    const toolbar = root.querySelector<HTMLElement>('[class*="_sideToolbarWrapper_"]')
    const previewIcon = root.querySelector<HTMLElement>('[class*="_sideToolbarIcon_"]')
    if (minimap !== null && toolbar !== null) {
      const toolbarRect = toolbar.getBoundingClientRect()
      const previewTop = previewIcon?.getBoundingClientRect().top ?? 100
      minimap.style.top = `${previewTop}px`
      minimap.style.right = `${document.documentElement.clientWidth - toolbarRect.left + 4}px`
    }
  }))
  // キャンバスのみズームできる  − / + コントロール
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
    host.style.height = 'calc(100vh - 260px)'
    frame.replaceWith(host)
  } else {
    host.style.cssText = 'width:100%;height:calc(100vh - 260px);background:#fff;overflow:auto'
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

/**
 * 右レール（_sideToolbarWrapper_）のアイコンを実物と同じ丸い背景付きに揃える CSS を注入。
 * 実物では各アイコンが 36×36 の円形背景に入り、hover で少し濃くなる。
 * プレビュー（index 0）は採取 CSS で既にスタイル済みなので除外。
 * ::before 疑似要素で背景円を描くことで、内部構造に依存しない。
 */
function injectSideToolbarStyles(): void {
  if (document.getElementById('sb-side-toolbar-fix') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-side-toolbar-fix'
  style.textContent = `
    /* ── 右レール: アイコンに丸い背景を付ける ── */
    [class*="_sideToolbarIcon_"]:not([class*="_preview_"]) {
      position: relative;
    }
    [class*="_sideToolbarIcon_"]:not([class*="_preview_"])::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #f0f0f0;
      transition: background 0.15s ease;
      z-index: 0;
    }
    [class*="_sideToolbarIcon_"]:not([class*="_preview_"]):hover::before {
      background: #e0e0e0;
    }
    /* アイコンの中身を ::before より前面に */
    [class*="_sideToolbarIcon_"]:not([class*="_preview_"]) > * {
      position: relative;
      z-index: 1;
    }
    /* アイコン画像サイズを揃える */
    [class*="_sideToolbarIcon_"] img[class*="_icon_"] {
      width: 22px !important;
      height: 22px !important;
    }
  `
  document.head.append(style)
}

/**
 * キャンバスのみズームできる − / + コントロールを下部に配置する。
 * CSS transform: scale() で Quill 本文だけを拡縮する。UIはそのまま。
 */
function mountZoomControl(_root: HTMLElement, quill: Quill): void {
  const ZOOM_STEPS = [0.25, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5] as const
  const DEFAULT_INDEX = 6 // 1.0 = 100%
  let zoomIndex = DEFAULT_INDEX
  const editor = quill.root // .ql-editor

  const bar = document.createElement('div')
  bar.style.cssText = [
    'position:fixed',
    'bottom:8px',
    'left:50%',
    'transform:translateX(-50%)',
    'display:flex',
    'align-items:center',
    'gap:4px',
    'z-index:50',
    'background:rgba(50,50,50,0.85)',
    'border-radius:20px',
    'padding:4px 8px',
  ].join(';')

  const btnStyle = [
    'width:28px',
    'height:28px',
    'border:none',
    'background:transparent',
    'color:#fff',
    'font-size:18px',
    'line-height:1',
    'cursor:pointer',
    'border-radius:50%',
    'display:flex',
    'align-items:center',
    'justify-content:center',
  ].join(';')

  const minus = document.createElement('button')
  minus.textContent = '−'
  minus.style.cssText = btnStyle
  minus.addEventListener('mouseenter', () => { minus.style.background = 'rgba(255,255,255,0.15)' })
  minus.addEventListener('mouseleave', () => { minus.style.background = 'transparent' })

  const plus = document.createElement('button')
  plus.textContent = '+'
  plus.style.cssText = btnStyle
  plus.addEventListener('mouseenter', () => { plus.style.background = 'rgba(255,255,255,0.15)' })
  plus.addEventListener('mouseleave', () => { plus.style.background = 'transparent' })

  bar.append(minus, plus)
  document.body.append(bar)

  function applyZoom(): void {
    const scale = ZOOM_STEPS[zoomIndex] ?? 1
    editor.style.transform = `scale(${scale})`
    editor.style.transformOrigin = 'top center'
    minus.style.opacity = zoomIndex <= 0 ? '0.3' : '1'
    plus.style.opacity = zoomIndex >= ZOOM_STEPS.length - 1 ? '0.3' : '1'
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

/** 下部バーの `< / >`（前/次のステップ）を配線する */
function wireStepNavigation(ctx: EditorContext): void {
  const prev = ctx.root.querySelector<HTMLElement>(HOOK.funnelPrev)
  const next = ctx.root.querySelector<HTMLElement>(HOOK.funnelNext)
  if (prev !== null) {
    prev.style.cursor = 'pointer'
    prev.addEventListener('click', () => void loadStep(ctx, ctx.stepIndex - 1))
  }
  if (next !== null) {
    next.style.cursor = 'pointer'
    next.addEventListener('click', () => void loadStep(ctx, ctx.stepIndex + 1))
  }
}

function loadVersion(ctx: EditorContext, uid: string): void {
  const v = ctx.versions.find((x) => x.uid === uid)
  if (v === undefined) return
  ctx.currentUid = uid
  ctx.quill.root.innerHTML = v.html
  // 現在Versionの本文を載せ替えたら、カード一覧も描き直して選択状態を合わせる。
  renderVersionList(ctx)
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
    const card = ctx.cardTemplate.cloneNode(true) as HTMLElement
    if (archivedMode) wireArchivedCard(ctx, card, version)
    else wireVersionCard(ctx, card, version)
    if (addButton !== null) list.insertBefore(card, addButton)
    else list.append(card)
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

/** 1枚のVersionカードに、そのVersionの値と操作（名前/配信割合/更新/「…」/クリック切替）を配線する */
function wireVersionCard(ctx: EditorContext, card: HTMLElement, version: Version): void {
  // このカードが表す最新のVersion（保存のたびに新しいオブジェクトへ差し替える＝イミュータブル・§12）。
  let model = version
  card.dataset['articleUid'] = model.uid
  card.setAttribute('data-id', String(model.id))
  const isCurrent = model.uid === ctx.currentUid
  card.querySelector<HTMLElement>(HOOK.currentVersion)?.classList.toggle(ACTIVE_CARD_CLASS, isCurrent)

  // 指示㊼再修正: カードを詰めて次のバージョンをすぐ下に置く
  const inner = card.querySelector<HTMLElement>(HOOK.currentVersion)
  if (inner !== null) inner.style.padding = '8px 10px'
  const buttons = card.querySelector<HTMLElement>('._articleButtons_1xibh_160')
  if (buttons !== null) buttons.style.padding = '4px 0 2px'

  const name = card.querySelector<HTMLInputElement>(HOOK.versionName)
  const ratio = card.querySelector<HTMLInputElement>(HOOK.ratio)
  if (name !== null) name.value = model.name
  if (ratio !== null) ratio.value = String(model.distribution_ratio)

  // 指示㉘: 切替の当たり判定が狭い問題。非選択カードでは名前入力がカードの大半を覆って
  // クリックを食う（＝切替できる余白が僅か）ので、名前入力のクリックをカードへ通す
  // （pointer-events:none）。名前編集は切替後に行う（実物と同じ「まず選択」動線）。
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
  // 「更新」ボタン（`_articleButtons_` 内の文言「更新」のボタン）
  findUpdateButton(card)?.addEventListener('click', (event) => {
    event.stopPropagation()
    void save()
  })

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

/** カード内の「更新」ボタンを文言で探す（Emotionクラスは匿名化され得るので文言で引く） */
function findUpdateButton(card: HTMLElement): HTMLElement | null {
  const buttons = card.querySelectorAll<HTMLElement>('._articleButtons_1xibh_160 button')
  for (const button of buttons) {
    if ((button.textContent ?? '').trim().startsWith('更新')) return button
  }
  return null
}

/** 「Version追加」ボタンを1回だけ配線する（カード再描画で消えない要素なので使い回す） */
function wireAddVersion(ctx: EditorContext): void {
  ctx.root.querySelector(HOOK.addVersion)?.addEventListener('click', async () => {
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

function wireSideToolbar(ctx: EditorContext): void {
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
  // パズルピース（Widget管理ボタン）は実物では Widgetライブラリを開く
  mountWidgetLibrary(ctx.root, ctx.quill)

  // 指示㊶: 右レールをスクロール追従させる。
  // 実DOMの構造（指示㊿② 更新後）:
  //   container (overflow:hidden, height:100vh) ← 外枠はスクロールしない
  //     └ _editorWrapper_ (display:flex, height:calc(100%-120px))
  //         └ quillEditorContentWrapper (overflow-y:auto) ← キャンバスのみスクロール
  //             └ _sideToolbarWrapper_ (width:50px, height:calc(100%-80px))
  // 親が flex で height 制約あり → sticky は効かない。position:fixed で viewport に固定する。
  const sideToolbarWrapper = ctx.root.querySelector<HTMLElement>('[class*="_sideToolbarWrapper_"]')
  if (sideToolbarWrapper !== null) {
    // 初期位置を計測して fixed に切り替える
    const pinToolbar = (): void => {
      const rect = sideToolbarWrapper.getBoundingClientRect()
      // 右端の x を viewport 右端からの距離で固定
      sideToolbarWrapper.style.position = 'fixed'
      sideToolbarWrapper.style.top = `${Math.max(rect.top, 80)}px`
      sideToolbarWrapper.style.right = `${document.documentElement.clientWidth - rect.right}px`
      sideToolbarWrapper.style.left = 'auto'
      sideToolbarWrapper.style.height = 'auto'
      sideToolbarWrapper.style.marginTop = '0'
      sideToolbarWrapper.style.marginBottom = '0'
      sideToolbarWrapper.style.zIndex = '50'
    }
    // 初回配置は DOM が安定してから
    requestAnimationFrame(pinToolbar)
    // ウィンドウリサイズで再計算
    addEventListener('resize', pinToolbar)
  }

  const icons = [...ctx.root.querySelectorAll<HTMLElement>('[class*="sideToolbarIcon"]')]
  for (let index = 0; index < icons.length; index += 1) {
    const icon = icons[index]
    if (icon === undefined) continue
    icon.style.cursor = 'pointer'

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
    if (WIRED_TOOLS.includes(index)) continue
    // それでも残るツールがあれば正直にトースト
    const name = SIDE_TOOLS[index] ?? 'このツール'
    icon.addEventListener('click', () => toast(`${name} は未実装です`, 'error'))
  }

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
    btn.style.transition = 'background-color 0.3s'
    btn.style.backgroundColor = '#f59e0b'
    btn.style.color = '#fff'
  }

  function markSaved(): void {
    const btn = findCurrentUpdateButton()
    if (btn === null) return
    btn.style.transition = 'background-color 0.3s'
    btn.style.backgroundColor = ''
    btn.style.color = ''
  }

  const autosave = createAutosave({
    // 変更のたびに保存し、同時に履歴スナップショットを積む（指示⑪・サーバー側で最新100件に丸め）。
    save: async () => {
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
