/**
 * Widget編集（1つの画面・2026-09-23・本人の決定 D1「ノーコードで作る」と「Widget編集」を1つにする）。
 *
 * 全画面。左＝見え方（620pxの見たまま画面）、右＝直すところ（この並びは崩さない・本人指定）。
 * 右は3段:
 *   1. 画面のタブ（画面①②…／見本の設問①②…）
 *   2. 直すところ（部品で作ったWidgetは「部品」の入力欄、それ以外は「要素ごとに編集」のカード）
 *   3. 「デフォルト時のコードを表示」（HTML/CSS。部品で作ったWidgetは見るだけ＋「部品を解除」）
 * ヘッダー: 閉じる／作成したWidgetに登録／LPに入れる（LPの中のWidgetなら「更新する」）
 *
 * 開き方は4つ（全部ここ）:
 *   - ライブラリの「+ ノーコードで作る」        → 新しく部品で作る
 *   - 見本のカードの「画面を作って使う」         → その見本を部品にして作る
 *   - LPの中のWidgetをクリック／設置済みWidgetのカード → 設定データがあれば「部品」、無ければHTMLとして直す
 *   - 「部品を解除」                              → 同じ中身をHTMLとして開き直す
 *
 * 本番 SquadBeyond の Widget 編集 UI の実測色（widget-editor-theme.ts）はそのまま使う。
 */
import type Quill from 'quill'
import { toast } from '../ui.ts'
import { confirmCard, promptCard } from '../dialog.ts'
import { saveCreatedWidget } from './widget-library-storage.ts'
import { defaultRegisterName } from './nocode/nocode-flow.ts'
import { extractBuilderData, splitStyles } from './nocode/builder-data.ts'
import { attachScreenSwitcher, attachStepSwitcher } from './nocode/screen-switcher.ts'
import type { TemplateData } from './nocode/templates/types.ts'
import { loadGoogleFonts } from './toolbar/text-format.ts'
import { svgPlus } from './widget-editor-icons.ts'
import { COLOR, FONT, type WidgetEditTarget } from './widget-editor-theme.ts'
import { templateNameOf, visibleTextOf } from './widget-editor-html.ts'
import { closeMediaControl } from './widget-media-control.ts'
import { RIGHT_PANE_FLEX, buildCodePanels } from './widget-code-panel.ts'
import { buildDesignPanel } from './widget-design-panel.ts'
import { buildVisualEditor } from './widget-visual-editor.ts'
import { createSelectionLayer } from './selection-layer.ts'
import { insertWidget } from './widget-creator.ts'
import { openWidgetLibraryForPick } from './widget-library.ts'
import { createBuilderSession, type BuilderSession } from './widget-studio-builder.ts'
import { runWidgetScripts } from './widget-run-scripts.ts'

export type StudioSource =
  /** LPの中のWidget（設定データがあれば部品として、無ければHTMLとして直す） */
  | { readonly kind: 'lp'; readonly target: WidgetEditTarget }
  /** 新しく部品で作る */
  | { readonly kind: 'new'; readonly data: TemplateData; readonly uid: string }
  /** 新しく、HTMLとして直す（部品を解除したとき） */
  | { readonly kind: 'new-html'; readonly html: string; readonly css: string }

/** いま開いているWidget編集を閉じる（開いていなければ何もしない） */
export function closeWidgetStudio(): void {
  closeMediaControl()
  document.querySelector('[data-widget-backdrop]')?.remove()
  document.querySelector('[data-widget-editor]')?.remove()
}

export function openWidgetStudio(quill: Quill, source: StudioSource): void {
  // 指示158: フォント選択で確実に見た目が変わるよう、日本語Webフォントを読み込んでおく。
  loadGoogleFonts()
  closeWidgetStudio()

  const target: WidgetEditTarget =
    source.kind === 'lp'
      ? source.target
      : { node: document.createElement('div'), html: source.kind === 'new-html' ? source.html : '', css: source.kind === 'new-html' ? source.css : '', index: -1, length: 0 }
  const builderStart = source.kind === 'new' ? { data: source.data, uid: source.uid } : source.kind === 'lp' ? extractBuilderData(source.target.html) : null
  const isBuilder = builderStart !== null
  const isInLp = source.kind === 'lp'

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

  // 左: 見たまま画面
  let session: BuilderSession | null = null
  /** HTMLモードで左を押したとき（要素を選ぶ）。部品モードは session が受ける */
  let selectDom: (clicked: EventTarget | null) => void = () => undefined
  const { pane: leftPane, contentDiv, editorBody, setPreviewCss } = buildVisualEditor(target, {
    builder: isBuilder,
    onClick: (clicked) => {
      if (session !== null) session.onCanvasClick(clicked)
      else selectDom(clicked)
    },
  })
  leftPane.dataset['widgetPane'] = 'visual'

  // 仕切り（本番実測: ~10px幅, cursor:col-resize, 中身は空＝ドットなし）
  const divider = document.createElement('div')
  divider.dataset['widgetDivider'] = 'true'
  divider.style.cssText =
    `width:10px;background:${COLOR.container};cursor:col-resize;flex-shrink:0;` +
    `display:flex;align-items:center;justify-content:center`

  // 右: 上に画面のタブ、その下に「直すところ」（部品／要素ごと）とコード
  const rightPane = document.createElement('div')
  rightPane.dataset['widgetPane'] = 'code'
  rightPane.style.cssText = `flex:${RIGHT_PANE_FLEX};display:flex;flex-direction:column;min-width:0;min-height:0;background:#fff`
  const tabsHost = document.createElement('div')
  tabsHost.dataset['widgetTabs'] = 'true'
  tabsHost.style.cssText = `flex-shrink:0;display:none;flex-direction:column;background:#fff;border-bottom:1px solid #E3E6EA`
  // タブは中身があるときだけ見せる（見本の設問は少し遅れて見つかる）
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

  let codePanel: ReturnType<typeof buildCodePanels>
  /** 部品を解除して、同じ中身をHTMLとして開き直す */
  const detach = (): void => {
    if (session === null) return
    void confirmCard({
      title: '部品を解除して、HTMLとして直しますか？',
      message:
        '見出しを足す・押したときを選ぶ などの部品の操作はできなくなり、代わりに文字の書式やコードを直接直せるようになります。元には戻せません。',
      submitLabel: '解除する',
      danger: true,
    }).then((ok) => {
      if (!ok || session === null) return
      const { css, body } = splitStyles(session.plainHtml())
      closeWidgetStudio()
      openWidgetStudio(quill, isInLp ? { kind: 'lp', target: { ...target, html: body, css } } : { kind: 'new-html', html: body, css })
    })
  }

  if (builderStart !== null) {
    session = createBuilderSession({
      data: builderStart.data,
      uid: builderStart.uid,
      contentDiv,
      editorBody,
      setPreviewCss,
      tabsHost,
      pickSample,
    })
    const current = session
    codePanel = buildCodePanels(target, {
      onViewChange,
      design: { element: current.panel, refresh: () => undefined },
      readOnly: {
        note: '部品で作ったWidgetのコードは、設定から書き出したものです（見るだけ）。',
        detachLabel: '部品を解除してコードを直す',
        onDetach: detach,
      },
      onShowCode: () => {
        const code = current.currentCode()
        codePanel.setCode(code.html, code.css)
      },
    })
  } else {
    // HTMLとして直す（「要素ごとに編集」のカード＋コード）。CSS の正本はコード欄の textarea
    let cssArea: HTMLTextAreaElement | null = null
    const design = buildDesignPanel({
      content: contentDiv,
      readCss: () => cssArea?.value ?? target.css,
      writeCss: (css) => {
        if (cssArea === null) return
        cssArea.value = css
        cssArea.dispatchEvent(new Event('input'))
      },
    })
    codePanel = buildCodePanels(target, { onViewChange, design, onCssInput: setPreviewCss })
    cssArea = codePanel.pane.querySelector<HTMLTextAreaElement>('[data-code-css]')
    // ビジュアルエディタ → コードパネルの同期（入力イベントで反映）
    const htmlArea = codePanel.pane.querySelector<HTMLTextAreaElement>('[data-code-html]')
    const syncFn = (): void => {
      if (htmlArea === null) return
      htmlArea.value = contentDiv.innerHTML
      htmlArea.dispatchEvent(new Event('input'))
    }
    contentDiv.addEventListener('input', syncFn)
    syncFn()

    // 左で要素を押すと選択枠＋ハンドル（幅・高さ・文字の大きさ）、右はその要素のカードだけ（Canva風・第2弾）。
    // 何も選んでいないときは Widget全体を薄い枠で出し、上下の辺で上下の余白を動かせる
    const selection = createSelectionLayer(editorBody, contentDiv)
    const selectRoot = (): void => {
      design.select(null)
      const outer = contentDiv.firstElementChild
      if (outer instanceof HTMLElement) selection.select(outer, 'Widget全体（上下の辺で余白）', design.handlesFor(outer), { soft: true })
      else selection.select(null)
    }
    selectDom = (clicked) => {
      const el = clicked instanceof HTMLElement ? clicked : clicked instanceof Node ? clicked.parentElement : null
      if (el === null || el === contentDiv || !contentDiv.contains(el)) {
        selectRoot()
        return
      }
      const picked = design.select(el)
      if (picked === null) {
        selectRoot()
        return
      }
      selection.select(picked.node, picked.label, design.handlesFor(picked.node))
    }
    // コード欄から書き換えたあとなど、中身が入れ替わったら選択枠を合わせ直す
    contentDiv.addEventListener('input', () => selection.refresh())
    selectRoot()
  }
  rightPane.append(tabsHost, codePanel.pane)
  darkContainer.append(leftPane, divider, rightPane)
  wireDividerResize(divider, rightPane, darkContainer)

  /* ── ヘッダー ── */
  const readOutput = (): string | null => {
    if (session !== null) {
      const out = session.finalHtml()
      return 'html' in out ? out.html : null
    }
    const htmlCode = panel.querySelector<HTMLTextAreaElement>('[data-code-html]')?.value.trim() ?? ''
    const cssCode = panel.querySelector<HTMLTextAreaElement>('[data-code-css]')?.value.trim() ?? ''
    if (htmlCode === '') {
      toast('HTMLが空です', 'error')
      return null
    }
    return cssCode !== '' ? `<style>${cssCode}</style>${htmlCode}` : htmlCode
  }
  const header = buildHeader({
    title: isInLp ? 'Widget編集' : 'Widgetを作る',
    primaryLabel: isInLp ? '更新する' : 'LPに入れる',
    onClose: closeWidgetStudio,
    onRegister: () => {
      const html = readOutput()
      if (html === null) return
      const value = session !== null ? session.suggestName() : defaultRegisterName(templateNameOf(html), visibleTextOf(html))
      void promptCard({
        title: '作成したWidgetに登録',
        label: '名前（「作成したWidget」にこの名前で入ります）',
        value,
        submitLabel: '登録する',
        validate: (v) => (v === '' ? '名前を入れてください' : null),
      }).then((name) => {
        if (name === null) return
        if (!saveCreatedWidget(name, html)) {
          toast('登録できませんでした。画像が大きいと、このブラウザに保存しきれないことがあります', 'error')
          return
        }
        // このあと入れる分は別の名前にする（登録した分と同じLPに並んでも、色がまざらない）
        session?.rekey()
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
      const name = session !== null ? session.suggestName() : defaultRegisterName(templateNameOf(html), visibleTextOf(html))
      closeWidgetStudio()
      requestAnimationFrame(() => {
        insertWidget(quill, html, name)
        toast(`「${name}」を入れました。LPの中でクリックすると、また直せます`)
      })
    },
  })

  panel.append(header, darkContainer)

  // 画面に載ってから描く（Widgetの init は document.querySelector で自分の要素を探すため）
  if (session !== null) {
    session.start()
  } else {
    runWidgetScripts(contentDiv)
    // 画面①②…・見本の設問①②…のタブ（右側のいちばん上）
    attachScreenSwitcher(tabsHost, contentDiv)
    attachStepSwitcher(tabsHost, contentDiv)
  }
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
    startRightW = rightPane.getBoundingClientRect().width
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
