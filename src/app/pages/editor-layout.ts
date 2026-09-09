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
import { masterStyleEditorDecls } from '../master-style.ts'
import { createAutosave } from './autosave.ts'
import { deliveryUrl } from './basic-info-form.ts'
import type { EditorContext } from './editor-context.ts'
import { HOOK } from './editor-hooks.ts'
import { buildFullHtml } from './editor-html.ts'
import { findUpdateButton, saveHtml } from './editor-version-list.ts'
import { jstHhmm } from '../jst.ts'
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
/** 記事設定（MasterStyleSheet）を Quill 本文へ当てて、編集画面でも見た目を反映する。 */
export async function applyMasterStyleToEditor(ctx: EditorContext): Promise<void> {
  try {
    const { master_style_sheet } = await api.masterStyleSheet(ctx.articleUid)
    const decls = masterStyleEditorDecls(master_style_sheet)
    if (decls !== '') ctx.quill.root.setAttribute('style', decls)
  } catch {
    // 取得に失敗しても編集は続けられる（既定の見た目のまま）
  }
}
/** 旧フローティングツールバーを非表示にする */
export function hideFloatingToolbar(root: HTMLElement): void {
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
export function mountSidebarToolbarPanel(ctx: EditorContext): void {
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
export function mountPropertiesPanelInEditor(ctx: EditorContext): void {
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
    void saveHtml(ctx).then(go).catch(go)
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
  breadcrumbRow.append(spacer, saveStatus, sep1, previewBtn, compareBtn)
}
/**
 * コンテンツ上部にURLコピーバーを挿入する。
 * 旧コンテンツツールバーを置き換え、検証用/本番用URLのワンクリックコピーを提供する。
 * 編集機能はすべて右プロパティパネルに集約された。
 */
export function mountUrlBarInEditor(ctx: EditorContext): HTMLElement | null {
  const contentWrapper = ctx.root.querySelector<HTMLElement>('.quillEditorContentWrapper')
  if (contentWrapper === null) return null
  // 既存の旧ツールバーがあれば除去
  contentWrapper.querySelector('[data-content-toolbar]')?.remove()
  // 既存チェック
  if (contentWrapper.querySelector('[data-url-bar]') !== null) return null

  const testUrl = `${location.origin}/preview/${ctx.currentUid}`
  const prodUrl = deliveryUrl(location.origin, ctx.abTestUid)

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
  if (sideWrapper !== null) {
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
  if (sideTop !== null) {
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
    if (sideWrapper === null) return
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
        const panel = mountHistory(ctx.root, ctx.articleUid)
        if (panel === null) return
        if (!historyRegistered) {
          panels.register('履歴', panel)
          historyRegistered = true
        }
        panels.toggle('履歴')
        if (panel.classList.contains('_open_x4j8w_84')) {
          refreshHistory(ctx.root, panel)
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
    // ヘッダーの保存時刻を常に更新（ボタンの有無に依存しない）
    updateSaveTimestamp()
    const btn = findCurrentUpdateButton()
    if (btn === null) return
    btn.textContent = '保存済み'
    btn.style.transition = 'background-color 0.3s'
    btn.style.backgroundColor = ''
    btn.style.color = ''
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
/** Date → 「たった今」「N分前」「N時間前」「HH:MM」形式 */
export function formatSaveTime(saved: Date): string {
  const diff = Math.floor((Date.now() - saved.getTime()) / 1000)
  if (diff < 30) return 'たった今'
  if (diff < 60) return `${diff}秒前`
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins}分前`
  const hours = Math.floor(mins / 60)
  if (hours < 12) return `${hours}時間前`
  return jstHhmm(saved)
}
/** ヘッダーの保存時刻表示を「今」に更新 */
export function updateSaveTimestamp(): void {
  const el = document.querySelector<HTMLElement>('[data-save-time]')
  if (el === null) return
  const now = new Date()
  el.dataset['savedAt'] = String(now.getTime())
  el.textContent = formatSaveTime(now)
}
