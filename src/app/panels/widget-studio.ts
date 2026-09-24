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
 * 2026-09-24: 離脱防止ポップ・追従型ポップの中身も、この画面で直す（popup-studio.ts。画面の組み立ては mountStudio で共通）。
 * 2026-09-24: 画面の作り直し（本人の決定 C-1a。デザイン案のモックで比べて決めた）。3列:
 *   左＝画面①②…・部品の並び（ドラッグで並べ替え）・部品を足す（ドラッグで好きな所へ）／
 *   まん中＝書式のツールバー＋灰色の地に白い紙（見たまま画面）／右＝選んだ部品の設定（段に分けて畳める）とコード。
 *   ヘッダーは「← LPに戻る」・名前・作成したWidgetに登録・更新する
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
import { buildVisualEditor, type PreviewDevice, type PreviewFrame } from './widget-visual-editor.ts'
import type { UnderlayStyle } from './popup-underlay.ts'
import { insertWidget } from './widget-creator.ts'
import { openWidgetLibraryForPick } from './widget-library.ts'
import { createBuilderSession, type BuilderSession } from './widget-studio-builder.ts'
import { buildPaneDivider } from './pane-divider.ts'

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
  const target: WidgetEditTarget =
    source.kind === 'lp' ? source.target : { node: document.createElement('div'), html: '', css: '', index: -1, length: 0 }
  const isInLp = source.kind === 'lp'
  mountStudio({
    target,
    start: builderStart(source),
    title: 'Widget編集',
    primaryLabel: isInLp ? '更新する' : 'LPに入れる',
    libraryQuill: quill,
    onPrimary: (html, current) => {
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
}

/** 画面を組み立てるのに要るもの（LPのWidget・ポップアップの中身で共通） */
export interface StudioHost {
  readonly target: WidgetEditTarget
  readonly start: { data: TemplateData; uid: string }
  /** ヘッダーの名前 */
  readonly title: string
  /** 名前の横に小さく出す説明（ポップアップの名前など） */
  readonly subtitle?: string
  /** 名前の横の印（「離脱防止」など） */
  readonly badge?: string
  /** 左上の戻るボタンの文字（既定「LPに戻る」） */
  readonly backLabel?: string
  /** 右上の青いボタンの文字 */
  readonly primaryLabel: string
  /** 右上の青いボタン。書き出したHTML（設定データつき）を渡す */
  readonly onPrimary: (html: string, session: BuilderSession) => void
  /**
   * 見本の一覧（ライブラリ）を開くのに使うLPの編集。無い画面（ポップアップ）は null＝見本を選ぶだけ
   * （LPへ入れる・新しく作る入口はライブラリに出さない）
   */
  readonly libraryQuill: Quill | null
  /** 見たまま画面の枠（既定はLPと同じ620px） */
  readonly previewFrame?: PreviewFrame
  /** 後ろに敷くLPのプレビュー（ポップアップの「LPの上に重ねて見る」） */
  readonly underlay?: Promise<string | null>
  /** 後ろにLPを敷いたときの見せ方（暗い幕・出る所） */
  readonly underlayStyle?: UnderlayStyle
}

export function mountStudio(host: StudioHost): void {
  // 指示158: フォント選択で確実に見た目が変わるよう、日本語Webフォントを読み込んでおく。
  loadGoogleFonts()
  closeWidgetStudio()
  const { target, start } = host

  // 画面いっぱい（本人の指示 2026-09-23「カードではなく画面全体で大きく・別ページみたいに」）
  const panel = document.createElement('div')
  panel.dataset['widgetEditor'] = 'true'
  panel.style.cssText =
    `position:fixed;inset:0;z-index:200;` +
    `display:flex;flex-direction:column;background:var(--sb-c-ffffff, #FFFFFF);` +
    `overflow:hidden;font-family:${FONT}`

  // 後ろのLPを触らせない下敷き（画面いっぱいのパネルの下に敷くだけで、見た目には出ない）
  const backdrop = document.createElement('div')
  backdrop.dataset['widgetBackdrop'] = 'true'
  backdrop.style.cssText = `position:fixed;inset:0;z-index:199;background:var(--sb-c-ffffff, #FFFFFF)`
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
      openWidgetLibraryForPick(host.libraryQuill, { onPick: finish, onCancel: () => finish(null) })
    })

  /* ── 本体（3列: 左＝部品・まん中＝見たまま画面・右＝設定） ── */
  const darkContainer = document.createElement('div')
  darkContainer.dataset['widgetPanes'] = 'true'
  // 地は白（以前の濃い地 #2B2B2B は仕切りの帯として見えていた）
  darkContainer.style.cssText = `flex:1;display:flex;background:var(--sb-c-ffffff, #FFFFFF);overflow:hidden;min-height:0`

  // 左: 見たまま画面（書式のツールバーつき）
  let session: BuilderSession | null = null
  const { pane: leftPane, contentDiv, editorBody, setPreviewCss, setPreviewDevice } = buildVisualEditor(target, {
    toolScope: (el) => session?.toolScope(el) ?? false,
    onClick: (clicked) => session?.onCanvasClick(clicked),
    alignTarget: () => session?.toolbar.alignTarget() ?? null,
    onSizeButton: (anchor) => session?.toolbar.onSizeButton(anchor) ?? false,
    onErase: () => session?.removeSelected() ?? false,
    partText: () => session?.toolbar.partText() ?? null,
    fontSizeStep: (delta) => session?.toolbar.fontSizeStep(delta) ?? null,
    onLink: () => session?.toolbar.onLink() ?? false,
    onImage: (dataUrl) => session?.toolbar.onImage(dataUrl) ?? false,
    onUndo: () => session?.undo() ?? false,
    onRedo: () => session?.redo() ?? false,
    ...(host.previewFrame === undefined ? {} : { previewFrame: host.previewFrame }),
    ...(host.underlay === undefined ? {} : { underlay: host.underlay }),
    ...(host.underlayStyle === undefined ? {} : { underlayStyle: host.underlayStyle }),
  })
  leftPane.dataset['widgetPane'] = 'visual'
  // まん中の地: 灰色に細かい点（白い紙＝見たまま画面が浮いて見える。ダークではアプリの暗い地）
  leftPane.style.background =
    'radial-gradient(var(--sb-c-e3e5e9, #E3E5E9) 1px, transparent 1px) 0 0 / 20px 20px, var(--sb-c-f0f1f4, #F0F1F4)'

  // 左の列: 画面①②…（上）・部品の並び・部品を足す（template-form.ts の partsHost）
  const partsPane = document.createElement('div')
  partsPane.dataset['widgetPane'] = 'parts'
  partsPane.style.cssText =
    `flex:0 0 320px;display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden;` +
    `background:var(--sb-c-ffffff, #FFFFFF);border-right:1px solid var(--sb-c-e3e5e9, #E3E5E9)`
  const partsList = document.createElement('div')
  partsList.className = 'ncf-parts'
  partsList.dataset['widgetPartsList'] = 'true'
  partsList.style.cssText = 'flex:0 1 auto;min-height:0;max-height:42%;overflow-y:auto;padding:8px 8px 10px'
  const partsPalette = document.createElement('div')
  partsPalette.dataset['widgetPartsPalette'] = 'true'
  partsPalette.style.cssText =
    'flex:1 1 auto;min-height:0;overflow-y:auto;padding:12px 12px 16px;border-top:1px solid var(--sb-c-e3e5e9, #E3E5E9)'

  // 右: 上に画面のタブ、その下に「部品」とコード
  const rightPane = document.createElement('div')
  rightPane.dataset['widgetPane'] = 'code'
  rightPane.style.cssText = `flex:${RIGHT_PANE_FLEX};display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--sb-c-ffffff, #FFFFFF)`

  // 仕切り: 白地に細い線＋真ん中のつまみ。乗せると青くなる・ドラッグで幅・ダブルクリックで元の幅（pane-divider.ts）
  const divider = buildPaneDivider({ rightPane, container: darkContainer, defaultFlex: RIGHT_PANE_FLEX })
  divider.dataset['widgetDivider'] = 'true'
  const tabsHost = document.createElement('div')
  tabsHost.dataset['widgetTabs'] = 'true'
  tabsHost.style.cssText =
    `flex-shrink:0;display:none;flex-direction:column;padding:12px 10px 0;` +
    `background:var(--sb-c-ffffff, #FFFFFF);border-bottom:1px solid var(--sb-c-e3e6ea, #E3E6EA)`
  // タブは中身があるときだけ見せる
  new MutationObserver(() => {
    tabsHost.style.display = tabsHost.childElementCount > 0 ? 'flex' : 'none'
  }).observe(tabsHost, { childList: true })

  const leftDisplay = leftPane.style.display
  const partsDisplay = partsPane.style.display
  const dividerDisplay = divider.style.display
  const onViewChange = (view: 'split' | 'code'): void => {
    // 「コード表示」を選んだら左の列・見たまま画面・仕切りを畳んで全幅にする（指示183）
    const codeOnly = view === 'code'
    leftPane.style.display = codeOnly ? 'none' : leftDisplay
    partsPane.style.display = codeOnly ? 'none' : partsDisplay
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
    partsHost: { list: partsList, palette: partsPalette },
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
  partsPane.append(tabsHost, partsList, partsPalette)
  rightPane.append(codePanel.pane)
  darkContainer.append(partsPane, leftPane, divider, rightPane)

  /* ── ヘッダー ── */
  const readOutput = (): string | null => {
    const out = current.finalHtml()
    return 'html' in out ? out.html : null
  }
  const header = buildHeader({
    title: host.title,
    subtitle: host.subtitle ?? '',
    badge: host.badge ?? '',
    backLabel: host.backLabel ?? 'LPに戻る',
    primaryLabel: host.primaryLabel,
    onDevice: (device) => setPreviewDevice(device),
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
      host.onPrimary(html, current)
    },
  })

  panel.append(header, darkContainer)
  // 画面に載ってから描く（Widgetの init は document.querySelector で自分の要素を探すため）
  current.start()
}

/* ================================================================
 *  ヘッダー（2026-09-24 画面の作り直し: 「← LPに戻る」・名前・右に登録と更新）
 * ================================================================ */

function buildHeader(options: {
  title: string
  subtitle: string
  badge: string
  backLabel: string
  primaryLabel: string
  onDevice: (device: PreviewDevice) => void
  onClose: () => void
  onRegister: () => void
  onPrimary: () => void
}): HTMLElement {
  const header = document.createElement('div')
  // スマホCSSの目印（PCでは属性が増えるだけ）。クラス名は採取物と衝突するので data 属性を使う
  header.dataset['widgetHeader'] = 'true'
  header.style.cssText =
    `display:flex;align-items:center;gap:12px;min-height:52px;padding:0 14px;box-sizing:border-box;flex-shrink:0;` +
    `background:var(--sb-c-ffffff, #FFFFFF);border-bottom:1px solid var(--sb-c-e3e5e9, #E3E5E9)`

  // 戻る（閉じる）。変えた中身は、右上のボタンを押すまでLPに入らない
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.title = `${options.backLabel}（右上のボタンを押す前の変更は入りません）`
  closeBtn.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>'
  const backLabel = document.createElement('span')
  backLabel.dataset['widgetBackLabel'] = 'true'
  backLabel.textContent = options.backLabel
  closeBtn.append(backLabel)
  closeBtn.setAttribute('aria-label', options.backLabel)
  closeBtn.style.cssText =
    `height:32px;display:inline-flex;align-items:center;gap:4px;padding:0 10px 0 6px;border-radius:8px;cursor:pointer;` +
    `border:1px solid var(--sb-c-e3e5e9, #E3E5E9);background:var(--sb-c-ffffff, #FFFFFF);color:var(--sb-c-333333, #333333);font:12.5px/1 ${FONT}`
  closeBtn.addEventListener('click', options.onClose)

  // 名前（と小さな説明・印）
  const title = document.createElement('div')
  title.style.cssText =
    `flex:1;min-width:0;display:flex;align-items:center;gap:10px;font:600 14px/1.4 ${FONT};color:var(--sb-c-333333, #333333)`
  const name = document.createElement('span')
  name.textContent = options.title
  name.style.cssText = 'white-space:nowrap'
  title.append(name)
  if (options.badge !== '') {
    const badge = document.createElement('span')
    badge.dataset['widgetBadge'] = 'true'
    badge.textContent = options.badge
    badge.style.cssText =
      `height:22px;display:inline-flex;align-items:center;padding:0 9px;border-radius:999px;flex-shrink:0;` +
      `background:var(--sb-neutral, #F4F4F4);color:var(--sb-c-333333, #333333);font:700 11.5px/1 ${FONT}`
    title.append(badge)
  }
  if (options.subtitle !== '') {
    const sub = document.createElement('span')
    sub.dataset['widgetSubtitle'] = 'true'
    sub.textContent = options.subtitle
    sub.style.cssText = `min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12.5px/1.4 ${FONT};color:var(--sb-sub, #5F6673)`
    title.append(sub)
  }

  // PC／スマホ（2026-09-24）: 見たまま画面の幅と @media を判定する幅を切り替える
  const device = document.createElement('div')
  device.dataset['widgetDevice'] = 'true'
  device.setAttribute('role', 'radiogroup')
  device.setAttribute('aria-label', '見る大きさ')
  device.style.cssText = 'display:flex;gap:2px;padding:3px;border-radius:9px;background:var(--sb-neutral, #F4F4F4);flex-shrink:0'
  const deviceButtons: HTMLButtonElement[] = []
  const paintDevice = (current: PreviewDevice): void => {
    for (const b of deviceButtons) {
      const on = b.dataset['device'] === current
      b.setAttribute('aria-checked', String(on))
      b.style.background = on ? 'var(--sb-c-ffffff, #FFFFFF)' : 'transparent'
      b.style.boxShadow = on ? '0 1px 2px rgba(16,24,40,.12)' : 'none'
      b.style.fontWeight = on ? '700' : '400'
    }
  }
  for (const [value, label, title] of [
    ['pc', 'PC', 'PCで見る（LPの幅 620px）'],
    ['sp', 'スマホ', 'スマホで見る（幅 375px・スマホ用の指定が効いた見え方）'],
  ] as const) {
    const b = document.createElement('button')
    b.type = 'button'
    b.dataset['device'] = value
    b.textContent = label
    b.title = title
    b.setAttribute('role', 'radio')
    b.style.cssText = `height:28px;padding:0 14px;border:none;border-radius:7px;cursor:pointer;color:var(--sb-c-333333, #333333);font:12.5px/1 ${FONT}`
    b.addEventListener('click', () => {
      paintDevice(value)
      options.onDevice(value)
    })
    deviceButtons.push(b)
    device.append(b)
  }
  paintDevice('pc')

  const rightBtns = document.createElement('div')
  rightBtns.style.cssText = 'display:flex;gap:6px;align-items:center'

  // 「作成したWidgetに登録」
  const registerBtn = document.createElement('button')
  registerBtn.type = 'button'
  registerBtn.innerHTML = svgPlus() + ' 作成したWidgetに登録'
  registerBtn.style.cssText =
    `display:flex;align-items:center;gap:4px;height:32px;border:none;border-radius:8px;background:none;` +
    `color:${COLOR.brand};padding:0 12px;font:700 12.5px/1 ${FONT};cursor:pointer`
  registerBtn.addEventListener('click', options.onRegister)

  // 「更新する」「LPに入れる」「ポップアップに反映」
  const primaryBtn = document.createElement('button')
  primaryBtn.type = 'button'
  primaryBtn.textContent = options.primaryLabel
  primaryBtn.style.cssText =
    `height:32px;border:none;background:${COLOR.brand};color:#fff;border-radius:8px;padding:0 18px;` +
    `font:700 12.5px/1 ${FONT};cursor:pointer`
  primaryBtn.addEventListener('click', options.onPrimary)

  rightBtns.append(registerBtn, primaryBtn)
  header.append(closeBtn, title, device, rightBtns)
  return header
}
