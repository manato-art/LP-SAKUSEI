/**
 * エディタ画面の枠組み配線（editor.ts から分離）。
 *
 * 「本文をどう編集するか」ではなく「画面のどこに何を置き、押したら何が開くか」を受け持つ:
 *   - 右レール9ツール（プレビュー / 元に戻す / やり直す / 各種パネル）の配線
 *   - 左のVersionパネル・右のプロパティパネル・上のURLバーの設置
 *   - ヘッダー行の保存ステータス / プレビュー / 公開ボタン
 *   - 自動保存の起動と、保存時刻表示の更新
 *
 * 依存は一方向にしてある: このファイルは editor.ts を import しない。
 */

import { api } from '../api.ts'
import { toast } from '../ui.ts'
import { mountVersionSettings, openVersionSettings } from '../panels/version-settings.ts'
import { mountTagSettings, openTagSettings } from '../panels/tag-settings.ts'
import { mountLinkReplace, reloadLinkReplace } from '../panels/link-replace.ts'
import { mountHistory, refreshHistory, recordArticleHistory } from '../panels/history.ts'
import { mountEditorToolbar } from '../panels/editor-toolbar.ts'
import { mountUrlBar } from '../panels/url-bar.ts'
import { mountPropertiesPanel } from '../panels/properties-panel.ts'
import { createPanelGroup } from '../panels/panel-group.ts'
import { mountWidgetLibrary } from '../panels/widget-library.ts'
import { wireWidgetClick } from '../panels/widget-editor.ts'
import { mountWidgetNav } from '../panels/widget-nav.ts'
import { EXTERNAL_IMAGE_TOOL_INDEX, mountExternalImage } from '../panels/external-image.ts'
import { toggleComparePanel } from '../panels/compare-mode.ts'
import {
  masterStyleCanvasBackground,
  masterStyleEditorDecls,
  masterStylePageBackground,
} from '../master-style.ts'
import { createAutosave, type Autosave } from './autosave.ts'
import { DELIVERY_DOMAIN_UNSET_NOTE, deliveryUrlFor } from './basic-info-form.ts'
import { isMobileViewport } from '../mobile/viewport.ts'
import type { EditorContext } from './editor-context.ts'
import { HOOK } from './editor-hooks.ts'
import { buildFullHtml, showVersionContent } from './editor-html.ts'
import { askAgainAboutConflict, saveHtml } from './editor-save.ts'
import { createSaveStatus } from './editor-save-status.ts'
import { EDITOR_CHANGE_EVENT } from '../panels/editor-change.ts'
import {
  injectCardSeamStyles,
  injectHeaderExtrasCss,
  injectSideToolbarStyles,
} from './editor-styles.ts'

/** 打ち終わってから保存するまでの待ち時間。1文字ごとに保存すると通信が飽和する。 */
const AUTOSAVE_DELAY_MS = 900
/** 右レールの並び順は SIDE_TOOLS のとおり。プレビューは1番目。 */
const PREVIEW_TOOL_INDEX = 0
/** 右レールの並び: 6=元に戻す / 7=やり直す */
const UNDO_TOOL_INDEX = 6
const REDO_TOOL_INDEX = 7
/** 右レール9ツールの表示名（指示77: ユーザーが指定した名称） */
const SIDE_TOOLS: readonly string[] = [
  'プレビュー',
  '履歴',
  'Widget',
  'リンク置換',
  'LP設定',
  'タグ設定',
  '戻る',
  '進む',
  '画像',
]
/**
 * 記事設定（MasterStyleSheet）を編集画面へ当てる。
 *   Quill本文（`.ql-editor`）… フォント/色/余白/Version背景など
 *   キャンバスの土台        … 全体背景（指示179。配信では html に当たっているもの）
 */
export async function applyMasterStyleToEditor(ctx: EditorContext): Promise<void> {
  try {
    const { master_style_sheet } = await api.masterStyleSheet(ctx.articleUid)
    const decls = masterStyleEditorDecls(master_style_sheet)
    if (decls !== '') ctx.quill.root.setAttribute('style', decls)
    applyCanvasBackground(
      ctx.quill.root,
      masterStyleCanvasBackground(master_style_sheet),
      masterStylePageBackground(master_style_sheet),
    )
  } catch {
    // 取得に失敗しても編集は続けられる（既定の見た目のまま）
  }
}

/**
 * 記事設定の背景2つを、編集画面のキャンバスへ効かせる（指示179）。
 *
 *   土台   = `.quillEditorContentWrapper`（LPの周りに見えているグレーの地）… 全体背景設定
 *   LP本体 = その中の `.ql-editor`                                        … Version背景設定
 *
 * どちらもクローン自身のCSSが `background: … !important` で塗っているため、
 * インラインで色を足しても勝てない。CSSを `var(--lp-canvas-base, 既定)` /
 * `var(--lp-page-bg, 既定)` に変えてあるので、ここでは**変数だけ**を置く。
 * 変数は継承するので、土台に置けば中の `.ql-editor` にも届く。
 * 空＝未設定なら変数を消す＝既定の色に戻る。
 *
 * 土台は Quill本文の**先祖**をたどって探す。`ctx.root` から querySelector すると
 * この時点ではまだ見つからず、変数が置かれないまま終わっていた。
 */
function applyCanvasBackground(quillRoot: HTMLElement, canvasBg: string, pageBg: string): void {
  const base = quillRoot.closest<HTMLElement>('.quillEditorContentWrapper')
  if (base === null) return
  for (const [name, value] of [
    ['--lp-canvas-base', canvasBg],
    ['--lp-page-bg', pageBg],
  ] as const) {
    if (value === '') base.style.removeProperty(name)
    else base.style.setProperty(name, value)
  }
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

  // 青い「バージョンを追加」ボタンは不要（「Versionを追加」カードに統合済み）→ 削除
  // ※ 以前はaddBtnをversionPanel最下部に固定していたが、削除したので
  //    cardsWrapperがパネル全高を使い切る（見切れ防止）
  const addBtn = cardsWrapper.querySelector<HTMLElement>(HOOK.addVersion)
  if (addBtn !== null) {
    addBtn.remove()
  }
  // addBtn分の余白が残らないよう、cardsWrapperでパネル全体を埋める
  cardsWrapper.style.paddingBottom = '12px'
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
export function mountHeaderExtras(
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

  // ── スペーサー（左のパンくず+フィルタと右のボタン群を分ける） ──
  const spacer = document.createElement('div')
  spacer.style.flex = '1'

  // ── 保存ステータス（未保存・保存中・保存済み・失敗を出す。点検11） ──
  const saveStatus = createSaveStatus(() => ctx.retrySave?.())
  ctx.saveStatus = saveStatus

  // ── セパレータ ──
  const sep1 = document.createElement('span')
  sep1.className = 'sb-header-sep header-sep'

  // ── プレビューボタン ──
  const previewBtn = document.createElement('button')
  previewBtn.className = 'sb-header-btn-preview btn-preview'
  previewBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>プレビュー`
  previewBtn.addEventListener('click', () => {
    // 指示142: 新規タブは必ず「クリックの同期処理内」で開く。
    // await を挟むとユーザー操作扱いが切れてポップアップがブロックされ無反応になる。
    // 先に空タブを開いておき、保存完了後にSSRプレビュー(/preview/:uid)へ遷移させる。
    const win = window.open('about:blank', '_blank')
    const url = `${location.origin}/preview/${ctx.currentUid}`
    const go = (): void => {
      if (win !== null && !win.closed) win.location.href = url
      else window.open(url, '_blank') // フォールバック（ハンドルが取れなかった場合）
    }
    void saveHtml(ctx).then(go).catch((error: Error) => {
      // 保存できなかったときに古い中身のプレビューを開かない（点検11）
      win?.close()
      toast(`保存できなかったので、プレビューを開きませんでした: ${error.message}`, 'error')
    })
  })

  // ── 指示93: 比較するボタン（公開するボタンを置換） ──
  const compareBtn = document.createElement('button')
  compareBtn.className = 'sb-header-btn-publish btn-publish'
  compareBtn.setAttribute('data-header-compare-btn', 'true')
  compareBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>比較する`
  compareBtn.addEventListener('click', () => {
    toggleComparePanel(ctx.root, {
      abTestUid: ctx.abTestUid,
      getCurrentHtml: () => buildFullHtml(ctx),
      getVersionUid: () => ctx.currentUid,
      // 指示138: このページの全 Version を渡す（現在 Version は編集中の最新HTMLを使う）
      getVersions: () =>
        ctx.versions.map((v) => ({
          uid: v.uid,
          name: v.name,
          ratio: v.distribution_ratio,
          html: v.uid === ctx.currentUid ? buildFullHtml(ctx) : v.html,
        })),
    })
  })

  // パンくず行に追加（既存の breadcrumb + filter の後ろにスペーサー+ボタン群）
  // 指示96: 右端の4アイコン（⋮ / 編集 / 設定 / モニター）は削除
  breadcrumbRow.append(spacer, saveStatus.el, sep1, previewBtn, compareBtn)
}
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

  const testUrl = `${location.origin}/preview/${ctx.currentUid}`
  // 実物と同じく、配信URLはフォルダのドメインで決まる。未設定ならURLの代わりに案内を出す（2026-09-13）
  const prodUrl =
    deliveryUrlFor(ctx.folderDomain, location.origin, ctx.abTestUid) ?? DELIVERY_DOMAIN_UNSET_NOTE

  const bar = mountUrlBar({ testUrl, prodUrl })

  // URLバーはヘッダー画像の上（コンテンツ領域の最上部）に配置
  contentWrapper.prepend(bar)
  return bar
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
export function wireSideToolbar(ctx: EditorContext): void {
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

  // 採取CSSのクラスセレクタ(._sideToolbarWrapper_1hcbn_1)は
  // 属性セレクタ([class*=])より高特異度のため、CSSの!importantでも負ける場面がある。
  // インラインスタイルで直接上書きする（インラインstyleは最高特異度）。
  const sideWrapper = ctx.root.querySelector<HTMLElement>('[class*="_sideToolbarWrapper_"]')
  // スマホはレールを画面の下へ横並びで固定する（mobile-css.ts）。
  // ここでインラインの !important を当てると、インラインが最強なのでCSS側が効かなくなる。
  const railIsVertical = !isMobileViewport()
  if (sideWrapper !== null && railIsVertical) {
    sideWrapper.style.setProperty('margin-top', '0', 'important')
    sideWrapper.style.setProperty('margin-bottom', '0', 'important')
    sideWrapper.style.setProperty('padding', '8px 0 0', 'important')
    sideWrapper.style.setProperty('height', '100%', 'important')
    sideWrapper.style.setProperty('display', 'flex', 'important')
    sideWrapper.style.setProperty('flex-direction', 'column', 'important')
    sideWrapper.style.setProperty('align-items', 'center', 'important')
    sideWrapper.style.setProperty('justify-content', 'flex-start', 'important')
    sideWrapper.style.setProperty('box-sizing', 'border-box', 'important')
    sideWrapper.style.setProperty('overflow', 'visible', 'important')
  }
  const sideTop = ctx.root.querySelector<HTMLElement>('[class*="_sideToolbarTop_"]')
  if (sideTop !== null && railIsVertical) {
    sideTop.style.setProperty('display', 'flex', 'important')
    sideTop.style.setProperty('flex-direction', 'column', 'important')
    sideTop.style.setProperty('align-items', 'center', 'important')
    sideTop.style.setProperty('justify-content', 'flex-start', 'important')
    sideTop.style.setProperty('padding-top', '0', 'important')
    sideTop.style.setProperty('gap', '4px', 'important')
    sideTop.style.setProperty('width', '100%', 'important')
  }

  // 指示163: 右ツールバー（履歴/Widget/…）を「キャンバス（スクロール領域）の横」に置き、
  // 高さもキャンバスに揃える。既定ではレール列がエディタ全高を占め、アイコンが上端に寄って
  // キャンバス上部の余白（ヘッダ画像ボタン/書式バー）とズレていた。キャンバスの上端・高さを
  // 実測してレール列に反映する。ヘッダ画像の有無やウィンドウ幅で変わるので ResizeObserver で追従。
  const findCanvas = (): HTMLElement | null =>
    ctx.root.querySelector<HTMLElement>('.quillEditorContentWrapper .ql-container') ??
    ctx.root.querySelector<HTMLElement>('.ql-container')
  const alignRailToCanvas = (): void => {
    if (sideWrapper === null || !railIsVertical) return
    const canvas = findCanvas()
    const cell = sideWrapper.parentElement
    if (canvas === null || cell === null) return
    const c = canvas.getBoundingClientRect()
    if (c.height < 40) return // レイアウト未確定
    const offset = Math.max(0, Math.round(c.top - cell.getBoundingClientRect().top))
    sideWrapper.style.setProperty('align-self', 'flex-start', 'important')
    sideWrapper.style.setProperty('margin-top', `${offset}px`, 'important')
    sideWrapper.style.setProperty('height', `${Math.round(c.height)}px`, 'important')
    sideWrapper.style.setProperty('padding-top', '0', 'important')
  }
  requestAnimationFrame(alignRailToCanvas)
  setTimeout(alignRailToCanvas, 250)
  const canvasForObs = findCanvas()
  if (canvasForObs !== null && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => alignRailToCanvas()).observe(canvasForObs)
  }

  const icons = [...ctx.root.querySelectorAll<HTMLElement>('[class*="sideToolbarIcon"]')]
  for (let index = 0; index < icons.length; index += 1) {
    const icon = icons[index]
    if (icon === undefined) continue
    // 指示134: プレビューは縦レールから外す（ヘッダーのプレビューボタンに一本化）。
    // index は SIDE_TOOLS / RAIL_ICON_SVGS と対応しているので、0番だけ隠して他はそのまま。
    if (index === PREVIEW_TOOL_INDEX) {
      // 採取CSSが display:flex !important を当てるので important 付きで隠す
      icon.style.setProperty('display', 'none', 'important')
      continue
    }
    icon.style.cursor = 'pointer'
    icon.classList.add('rail-item')

    // 指示92: 基板アイコンをモック準拠のSVGに完全差し替え
    // 基板の子要素（button, img, svg, dropdown trigger 等）を全て隠し、
    // モック準拠SVGだけを表示する。
    // _dropdown_ も含めて全て隠す（パネル用の _dropdown_ は resolvePanel() が
    // style.cssText で上書き＋root へ移動するので display:none は自動解除される）。
    const mockupSvg = RAIL_ICON_SVGS[index]
    if (mockupSvg !== undefined) {
      for (const child of icon.children) {
        if (
          child instanceof HTMLElement &&
          !child.hasAttribute('data-rail-svg') &&
          !child.classList.contains('sb-side-label')
        ) {
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

    // ── 各アイコンのクリックハンドラ（直接関数呼び出し方式） ──
    // 指示134: プレビュー(index 0)はループ先頭で隠して continue 済み。ここには来ない。
    // 履歴パネル（開閉はpanels.toggleに一本化）
    if (index === 1) {
      let historyRegistered = false
      icon.addEventListener('click', () => {
        const panel = mountHistory(ctx.root, ctx.articleUid, {
          versionUid: () => ctx.currentUid,
          currentHtml: () => buildFullHtml(ctx),
          // 戻した中身はサーバーで保存済み。自動保存を起こさずに入れ、中身の版も合わせる（点検3）
          apply: (html, version) => {
            showVersionContent(ctx, html)
            ctx.versions = ctx.versions.map((v) =>
              v.uid === version.uid ? { ...v, html, content_revision: version.content_revision } : v,
            )
            ctx.saveStatus?.set('saved')
          },
        })
        if (panel === null) return
        if (!historyRegistered) {
          panels.register('履歴', panel)
          historyRegistered = true
        }
        panels.toggle('履歴')
        if (panel.classList.contains('_open_x4j8w_84')) {
          refreshHistory(panel)
        }
      })
      continue
    }
    // ライブラリ（Widget管理はmountWidgetLibraryで配線済み → 中継クリック）
    if (index === 2) {
      icon.addEventListener('click', () => {
        const target = icon.querySelector<HTMLElement>('button, [role=”button”], [data-test], [class*=”_trigger_”]')
        if (target !== null) target.click()
      })
      continue
    }
    // リンク置換パネル（開閉はpanels.toggleに一本化）
    if (index === 3) {
      let linkRegistered = false
      icon.addEventListener('click', () => {
        const panel = mountLinkReplace(
          ctx.root,
          ctx.articleUid,
          () => ctx.currentUid,
          () => panels.toggle('リンク置換'),
        )
        if (panel === null) return
        if (!linkRegistered) {
          panels.register('リンク置換', panel)
          linkRegistered = true
        }
        panels.toggle('リンク置換')
        if (panel.classList.contains('_open_x4j8w_84')) {
          reloadLinkReplace(ctx.root, panel)
        }
      })
      continue
    }
    // LP設定（モーダル直接呼び出し）
    if (index === 4) {
      icon.addEventListener('click', () => {
        void openVersionSettings(ctx.articleUid)
      })
      continue
    }
    // タグ設定（モーダル直接呼び出し）
    if (index === 5) {
      icon.addEventListener('click', () => {
        void openTagSettings(ctx.articleUid)
      })
      continue
    }
    // 元に戻す / やり直す
    if (index === UNDO_TOOL_INDEX) {
      icon.addEventListener('click', () => ctx.quill.history.undo())
      continue
    }
    if (index === REDO_TOOL_INDEX) {
      icon.addEventListener('click', () => ctx.quill.history.redo())
      continue
    }
    // 外部サーバー画像
    if (index === EXTERNAL_IMAGE_TOOL_INDEX) {
      mountExternalImage(icon, ctx.quill)
      continue
    }
    // それでも残るツールがあれば正直にトースト
    const name = SIDE_TOOLS[index] ?? 'このツール'
    icon.addEventListener('click', () => toast(`${name} は未実装です`, 'error'))
  }

  // 指示93: 比較モードはヘッダーの「比較する」ボタンに移動。
  // 右レールの旧 mountCompareButton は削除。

  // 指示117/122: 縦レールはそのまま縦配置で残す（ユーザー指示「縦でよかった」）。
  // 移動は取りやめ。

  // 本文の自動保存。実物のエディタは自動保存が走る
  // （docs/findings-live-observation.md「エディタは『開くだけで自動保存』が走る」・DOMに _saveAnimation_）。
  // これが無いと、打った内容がサーバーに残らない。
  const status = ctx.saveStatus
  const autosave = createAutosave({
    // 変更のたびに保存し、同時に履歴スナップショットを積む（指示⑪・サーバー側で最新100件に丸め）。
    save: async () => {
      status?.set('saving')
      const saved = await saveHtml(ctx)
      if (saved.result === 'skipped-empty') {
        status?.set('empty')
        return
      }
      if (saved.result === 'conflict') {
        status?.set('conflict')
        return
      }
      status?.set('saved')
      try {
        // どのVersionの履歴かを添える（添えないと先頭のVersionの履歴になり、復元で先頭が書き換わっていた・点検3）
        await recordArticleHistory(ctx.articleUid, saved.html, saved.versionUid)
      } catch (error) {
        // 履歴記録の失敗で編集は止めない（保存自体は済んでいる）。
        console.warn('[editor] 履歴を記録できませんでした', error)
      }
    },
    delayMs: AUTOSAVE_DELAY_MS,
    onError: (error) => {
      // 失敗が続く間は、お知らせは最初の1回だけ（見出しの表示は出し続ける）
      if (status?.state() !== 'error') toast(`保存できませんでした: ${error.message}`, 'error')
      status?.set('error')
    },
  })
  ctx.retrySave = () => {
    // 「ほかの人が先に保存しました」を押したら、どちらを残すかをもう一度聞く
    if (status?.state() === 'conflict' && askAgainAboutConflict(ctx)) return
    void autosave.flush()
  }
  const changed = (): void => {
    status?.set('dirty')
    autosave.schedule()
  }
  ctx.quill.on('text-change', (_delta, _old, source) => {
    // 画面を切り替えた直後の再描画で保存が走ると、古い内容を書き戻してしまう。
    if (source === 'user') changed()
  })
  // Quill の外の変更（ヘッダー画像・文字間隔・行間など）も保存する（点検11）
  ctx.root.addEventListener(EDITOR_CHANGE_EVENT, changed)
  watchUnsavedOnLeave(autosave)

  // 保存（実物にはショートカットが無いが、作業用に足している）
  ctx.root.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      // 失敗したときは「保存しました」を出さない（失敗のお知らせは onError が出す）
      void autosave.flush().then((ok) => {
        if (ok && status?.state() === 'saved') toast('保存しました')
      })
    }
  })
}

/** いま開いているエディタの自動保存（ページを閉じる前に、保存していない変更があれば知らせる） */
let leaveGuard: Autosave | null = null
function watchUnsavedOnLeave(autosave: Autosave): void {
  if (leaveGuard === null) {
    addEventListener('beforeunload', (event) => {
      if (leaveGuard?.isPending() !== true) return
      // これだけで「このページを離れますか？」が出る（今のブラウザは preventDefault だけで足りる）
      event.preventDefault()
    })
  }
  leaveGuard = autosave
}
