/**
 * Widget編集（1つの画面・2026-09-23・本人の決定 D1「ノーコードで作る」と「Widget編集」を1つにする）。
 * 2026-09-24（第3弾）: 右側を「部品」に一本化した（本人「ノーコードで作るの方に合わせて。書式のツールバーは残す」）。
 *
 * 全画面。左＝見え方（620pxの見たまま画面＋書式のツールバー）、右＝直すところ（この並びは崩さない・本人指定）。
 * 右は3段:
 *   1. 画面のタブ（画面①②…）
 *   2. 部品（画面の設定／部品の一覧＝選んだ1つを広げる／部品を足す／Widget全体の設定）
 *   3. 「デフォルト時のコードを表示」（Widget全体のHTML/CSS。設定から書き出したものなので見るだけ）
 * ヘッダー: 閉じる／作成したWidgetに登録／LPに入れる（LPの中のWidgetなら「更新する」）。
 *
 * どのWidgetも同じ画面で直す:
 *   - 部品で作ったWidget（外側に data-nc-data）はその設定データで開く
 *   - 設定データを持たないWidget（自作の見本・手書きのHTML・以前の部品Widget）は「見本の部品1つ」として開く
 *     （見え方は変えない＝余白0・背景なし。文字・画像・ボタンの欄、要素ごとのカード、コードは見本の部品の中）
 * 開き方は4つ（全部ここ）:
 *   ライブラリの「+ ノーコードで作る」／見本のカードの「画面を作って使う」／LPの中のWidgetをクリック／設置済みWidgetのカード
 */
import type Quill from 'quill'
import { toast } from '../ui.ts'
import { promptCard } from '../dialog.ts'
import { saveCreatedWidget } from './widget-library-storage.ts'
import { extractBuilderData, wrapHtmlAsBuilder } from './nocode/builder-data.ts'
import { BUILDER_TEMPLATE } from './nocode/templates/builder.ts'
import { newUid } from './nocode/templates/kit.ts'
import type { TemplateData } from './nocode/templates/types.ts'
import { loadGoogleFonts } from './toolbar/text-format.ts'
import { svgPlus } from './widget-editor-icons.ts'
import { COLOR, FONT, type WidgetEditTarget } from './widget-editor-theme.ts'
import { templateNameOf, visibleTextOf } from './widget-editor-html.ts'
import { defaultRegisterName } from './nocode/nocode-flow.ts'
import { closeMediaControl } from './widget-media-control.ts'
import { RIGHT_PANE_FLEX, buildCodePanels } from './widget-code-panel.ts'
import { buildVisualEditor } from './widget-visual-editor.ts'
import { insertWidget } from './widget-creator.ts'
import { openWidgetLibraryForPick } from './widget-library.ts'
import { createBuilderSession, type BuilderSession } from './widget-studio-builder.ts'

export type StudioSource =
  /** LPの中のWidget（設定データがあればそれで、無ければ見本の部品1つとして開く） */
  | { readonly kind: 'lp'; readonly target: WidgetEditTarget }
  /** 新しく部品で作る */
  | { readonly kind: 'new'; readonly data: TemplateData; readonly uid: string }

/** いま開いているWidget編集を閉じる（開いていなければ何もしない） */
export function closeWidgetStudio(): void {
  closeMediaControl()
  document.querySelector('[data-widget-backdrop]')?.remove()
  document.querySelector('[data-widget-editor]')?.remove()
}

/** 開く元から、部品の設定データと名前（uid）を決める */
function builderStart(source: StudioSource): { data: TemplateData; uid: string } {
  if (source.kind === 'new') return { data: source.data, uid: source.uid }
  const found = extractBuilderData(source.target.html)
  if (found !== null) return found
  // 設定データを持たないWidget: 元のHTML（<style> ごと）を見本の部品1つにする。
  // 名前は型の名前か、見える文字の頭（クラス名の「MuiBox-root」を名前にしない）
  const css = source.target.css.trim()
  const html = (css === '' ? '' : `<style>${css}</style>`) + source.target.html
  const title = defaultRegisterName(templateNameOf(source.target.html), visibleTextOf(source.target.html))
  return { data: wrapHtmlAsBuilder(html, title, BUILDER_TEMPLATE.defaults(new Date())), uid: newUid() }
}

export function openWidgetStudio(quill: Quill, source: StudioSource): void {
  // 指示158: フォント選択で確実に見た目が変わるよう、日本語Webフォントを読み込んでおく。
  loadGoogleFonts()
  closeWidgetStudio()

  const target: WidgetEditTarget =
    source.kind === 'lp' ? source.target : { node: document.createElement('div'), html: '', css: '', index: -1, length: 0 }
  const isInLp = source.kind === 'lp'
  const start = builderStart(source)

  // 画面いっぱい（本人の指示 2026-09-23「カードではなく画面全体で大きく・別ページみたいに」）
  const panel = document.createElement('div')
  panel.dataset['widgetEditor'] = 'true'
  panel.style.cssText =
    `position:fixed;inset:0;z-index:200;` +
    `display:flex;flex-direction:column;background:#fff;` +
    `overflow:hidden;font-family:${FONT}`

  // 後ろのLPを触らせない下敷き（画面いっぱいのパネルの下に敷くだけで、見た目には出ない）
  const backdrop = document.createElement('div')
  backdrop.dataset['widgetBackdrop'] = 'true'
  backdrop.style.cssText = `position:fixed;inset:0;z-index:199;background:#FFFFFF`
  document.body.append(backdrop, panel)

  /** 見本を選んでいる間だけ、この画面を隠す（入力中の中身は残る） */
  const hide = (): void => {
    panel.style.display = 'none'
    backdrop.style.display = 'none'
  }
  const show = (): void => {
    panel.style.display = 'flex'
    backdrop.style.display = 'block'
  }
  const pickSample = (): Promise<{ title: string; html: string } | null> =>
    new Promise((resolve) => {
      hide()
      const finish = (sample: { title: string; html: string } | null): void => {
        show()
        if (sample !== null) toast(`「${sample.title}」を部品に入れました`)
        resolve(sample)
      }
      openWidgetLibraryForPick(quill, { onPick: finish, onCancel: () => finish(null) })
    })

  /* ── 本体（2ペイン） ── */
  const darkContainer = document.createElement('div')
  darkContainer.dataset['widgetPanes'] = 'true'
  darkContainer.style.cssText = `flex:1;display:flex;background:${COLOR.container};overflow:hidden;min-height:0`

  // 左: 見たまま画面（書式のツールバーつき）
  let session: BuilderSession | null = null
  const { pane: leftPane, contentDiv, editorBody, setPreviewCss } = buildVisualEditor(target, {
    toolScope: (el) => session?.toolScope(el) ?? false,
    onClick: (clicked) => session?.onCanvasClick(clicked),
  })
  leftPane.dataset['widgetPane'] = 'visual'

  // 仕切り（本番実測: ~10px幅, cursor:col-resize, 中身は空＝ドットなし）
  const divider = document.createElement('div')
  divider.dataset['widgetDivider'] = 'true'
  divider.style.cssText =
    `width:10px;background:${COLOR.container};cursor:col-resize;flex-shrink:0;` +
    `display:flex;align-items:center;justify-content:center`

  // 右: 上に画面のタブ、その下に「部品」とコード
  const rightPane = document.createElement('div')
  rightPane.dataset['widgetPane'] = 'code'
  rightPane.style.cssText = `flex:${RIGHT_PANE_FLEX};display:flex;flex-direction:column;min-width:0;min-height:0;background:#fff`
  const tabsHost = document.createElement('div')
  tabsHost.dataset['widgetTabs'] = 'true'
  tabsHost.style.cssText = `flex-shrink:0;display:none;flex-direction:column;background:#fff;border-bottom:1px solid #E3E6EA`
  // タブは中身があるときだけ見せる
  new MutationObserver(() => {
    tabsHost.style.display = tabsHost.childElementCount > 0 ? 'flex' : 'none'
  }).observe(tabsHost, { childList: true })

  const leftDisplay = leftPane.style.display
  const dividerDisplay = divider.style.display
  const onViewChange = (view: 'split' | 'code'): void => {
    // 「コード表示」を選んだら左ペインと仕切りを畳んで全幅にする（指示183）
    const codeOnly = view === 'code'
    leftPane.style.display = codeOnly ? 'none' : leftDisplay
    divider.style.display = codeOnly ? 'none' : dividerDisplay
    rightPane.style.flex = codeOnly ? '1 1 auto' : RIGHT_PANE_FLEX
  }

  session = createBuilderSession({
    data: start.data,
    uid: start.uid,
    contentDiv,
    editorBody,
    setPreviewCss,
    tabsHost,
    pickSample,
  })
  const current = session
  const codePanel = buildCodePanels(target, {
    onViewChange,
    design: { element: current.panel, refresh: () => undefined },
    readOnly: {
      note: 'Widget全体のコードは、部品の設定から書き出したものです（見るだけ）。見本の部品のコードは、その部品の「コードで直す」から直せます。',
    },
    onShowCode: () => {
      const code = current.currentCode()
      codePanel.setCode(code.html, code.css)
    },
  })
  rightPane.append(tabsHost, codePanel.pane)
  darkContainer.append(leftPane, divider, rightPane)
  wireDividerResize(divider, rightPane, darkContainer)

  /* ── ヘッダー ── */
  const readOutput = (): string | null => {
    const out = current.finalHtml()
    return 'html' in out ? out.html : null
  }
  const header = buildHeader({
    title: 'Widget編集',
    primaryLabel: isInLp ? '更新する' : 'LPに入れる',
    onClose: closeWidgetStudio,
    onRegister: () => {
      const html = readOutput()
      if (html === null) return
      void promptCard({
        title: '作成したWidgetに登録',
        label: '名前（「作成したWidget」にこの名前で入ります）',
        value: current.suggestName(),
        submitLabel: '登録する',
        validate: (v) => (v === '' ? '名前を入れてください' : null),
      }).then((name) => {
        if (name === null) return
        if (!saveCreatedWidget(name, html)) {
          toast('登録できませんでした。画像が大きいと、このブラウザに保存しきれないことがあります', 'error')
          return
        }
        // このあと入れる分は別の名前にする（登録した分と同じLPに並んでも、色がまざらない）
        current.rekey()
        toast(`「${name}」を作成したWidgetに登録しました`)
      })
    },
    onPrimary: () => {
      const html = readOutput()
      if (html === null) return
      if (isInLp) {
        quill.deleteText(target.index, target.length, 'user')
        quill.insertEmbed(target.index, 'sbwidget', html, 'user')
        closeWidgetStudio()
        toast('Widgetを更新しました')
        return
      }
      const name = current.suggestName()
      closeWidgetStudio()
      requestAnimationFrame(() => {
        insertWidget(quill, html, name)
        toast(`「${name}」を入れました。LPの中でクリックすると、また直せます`)
      })
    },
  })

  panel.append(header, darkContainer)
  // 画面に載ってから描く（Widgetの init は document.querySelector で自分の要素を探すため）
  current.start()
}

/**
 * 仕切り（col-resize）のドラッグで左ペイン(見え方)と右ペイン(直すところ)の幅を変える。
 * 右ペインに幅(px)を与え、左ペインが残り全部を埋める。左右とも最小幅を確保。
 */
function wireDividerResize(divider: HTMLElement, rightPane: HTMLElement, container: HTMLElement): void {
  const MIN = 280
  const pane = rightPane // eslint-safe alias（no-param-reassign 回避）
  let startX = 0
  let startRightW = 0
  const onMove = (e: MouseEvent): void => {
    e.preventDefault()
    const total = container.clientWidth
    const max = total - divider.offsetWidth - MIN
    let next = startRightW - (e.clientX - startX)
    if (next < MIN) next = MIN
    if (next > max) next = max
    pane.style.flex = `0 0 ${next}px`
  }
  const onUp = (): void => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.userSelect = ''
  }
  divider.addEventListener('mousedown', (e) => {
    e.preventDefault()
    startX = e.clientX
    startRightW = pane.getBoundingClientRect().width
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })
}

/* ================================================================
 *  ヘッダー（本番実測: padding:12px, borderBottom:1px solid #f4f4f4）
 * ================================================================ */

function buildHeader(options: {
  title: string
  primaryLabel: string
  onClose: () => void
  onRegister: () => void
  onPrimary: () => void
}): HTMLElement {
  const header = document.createElement('div')
  // スマホCSSの目印（PCでは属性が増えるだけ）。クラス名は採取物と衝突するので data 属性を使う
  header.dataset['widgetHeader'] = 'true'
  header.style.cssText = `display:flex;align-items:center;padding:12px;border-bottom:1px solid #f4f4f4;flex-shrink:0`

  // 閉じる（本番実測: fontSize:12px, color:rgb(128,128,128), padding:0 8px）
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.textContent = '閉じる'
  closeBtn.style.cssText = `border:none;background:none;color:rgb(128,128,128);font:12px/1 ${FONT};cursor:pointer;padding:0 8px`
  closeBtn.addEventListener('click', options.onClose)

  const title = document.createElement('div')
  title.textContent = options.title
  title.style.cssText = `flex:1;text-align:center;font:600 15px/1.4 ${FONT};color:#333`

  const rightBtns = document.createElement('div')
  rightBtns.style.cssText = 'display:flex;gap:8px;align-items:center'

  // 「作成したWidgetに登録」（本番実測: fontSize:12px, color:var(--sb-accent, #0091FF), border:none, SVG plus icon）
  const registerBtn = document.createElement('button')
  registerBtn.type = 'button'
  registerBtn.innerHTML = svgPlus() + ' 作成したWidgetに登録'
  registerBtn.style.cssText =
    `display:flex;align-items:center;gap:4px;border:none;background:none;` +
    `color:${COLOR.brand};padding:6px 14px;font:12px/1 ${FONT};cursor:pointer`
  registerBtn.addEventListener('click', options.onRegister)

  // 「更新する」「LPに入れる」（本番実測: fontSize:12px, color:white, bg:var(--sb-accent, #0091FF), borderRadius:4px）
  const primaryBtn = document.createElement('button')
  primaryBtn.type = 'button'
  primaryBtn.textContent = options.primaryLabel
  primaryBtn.style.cssText =
    `border:none;background:${COLOR.brand};color:#fff;border-radius:4px;padding:6px 20px;` +
    `font:12px/1 ${FONT};cursor:pointer`
  primaryBtn.addEventListener('click', options.onPrimary)

  rightBtns.append(registerBtn, primaryBtn)
  header.append(closeBtn, title, rightBtns)
  return header
}
