/**
 * Widget編集画面の左側「ビジュアルエディタ」（widget-editor.ts から分離）。
 *
 * 採取したWidgetのHTMLを contenteditable として直接いじれるようにし、
 * その上にツールバー（書式・文字サイズ・色・リンク・画像）を載せる。
 * 変更はコードパネルの textarea へ input イベントで同期する。
 */
import { COLOR, FONT, WIDGET_PREVIEW_WIDTH, type WidgetEditTarget } from './widget-editor-theme.ts'
import { notifyCanvasEdit } from './widget-canvas-events.ts'
import { closeMediaControl, openMediaControl, pickImageDataUrl } from './widget-media-control.ts'
import { toast } from '../ui.ts'
import { markStyleScope, widgetPreviewCss } from './widget-style-scope.ts'
import {
  TOOLBAR_FONT_FAMILIES,
  cssFontFamilyValue,
  fontLabelJa,
} from './toolbar/text-format.ts'
import { openColorPicker } from './toolbar/color-picker.ts'
import { attachItemToolbar } from './nocode/item-toolbar.ts'
import { openLinkBubble } from './widget-link-bubble.ts'
import { closeAlignMenu, openAlignMenu, type AlignTarget } from './align-menu.ts'
import { ensureWidgetToolbarCss } from './widget-toolbar-css.ts'
import {
  svgToolAlign,
  svgToolBgColor,
  svgToolBold,
  svgToolClearFormat,
  svgToolImage,
  svgToolItalic,
  svgToolLink,
  svgToolMarker,
  svgToolRedo,
  svgToolSizeMinus,
  svgToolSizePlus,
  svgToolStrikethrough,
  svgToolTextColor,
  svgToolUnderline,
  svgToolUndo,
} from './widget-editor-icons.ts'

/**
 * 見たまま画面の枠（2026-09-24・ポップアップの中身もこの画面で直すため）。
 *  - lp: LPと同じ620px（配信の body の幅）
 *  - overlay: 離脱防止ポップ。暗い地（配信の rgba(0,0,0,.4)）の上に、中身の幅の箱（最大500px＝配信の .ep-content）
 *  - corner: 画面の角に出る追従型ポップ。白い地の上に、中身の幅の箱
 */
export type PreviewFrame = 'lp' | 'overlay' | 'corner'

export interface VisualEditorOptions {
  /**
   * 画像の操作パネル・リンクの吹き出し・並んだ部品の操作ボタンを効かせてよい要素か（2026-09-24・第3弾）。
   * 部品で作ったWidgetでは「見本の部品の中」だけ（見出し・ボタンなどの部品は右の入力欄で直す）。無ければ全部に効く
   */
  readonly toolScope?: (el: Element) => boolean
  /** 見たまま画面を（動作確認の Ctrl/⌘ なしで）押したとき。部品を選ぶのに使う */
  readonly onClick?: (target: EventTarget | null) => void
  /** ツールバーの「配置 ⌄」で変える、選んだ部品の置く位置・文字の寄せ。null なら選んだ文字の寄せ */
  readonly alignTarget?: () => AlignTarget | null
  /** ツールバーの「サイズ」。選んだ部品の幅と位置の小窓を出したら true（そのときは画像の操作パネルを出さない） */
  readonly onSizeButton?: (anchor: HTMLElement) => boolean
  /** 見たまま画面の枠（既定は lp） */
  readonly previewFrame?: PreviewFrame
}

/**
 * 枠ごとの、見たまま画面の地の色と中身の箱の大きさ。
 * LPの枠は、620pxの箱を白い紙にして地は透かす（地はWidget編集の地の色＝ダークでは暗い。ライトはどちらも白で今までと同じ）。
 * ポップアップの枠の地は配信の見え方そのもの（離脱防止＝LPにかぶせる暗い地・追従型＝後ろのLPの白）なので、ダークでも変えない。
 */
function frameStyle(frame: PreviewFrame): { backdrop: string; box: string } {
  if (frame === 'overlay') return { backdrop: '#999999', box: 'width:fit-content;max-width:500px;margin:24px auto' }
  if (frame === 'corner') return { backdrop: '#fff', box: 'width:fit-content;max-width:100%;margin:24px auto' }
  return { backdrop: 'transparent', box: `width:${WIDGET_PREVIEW_WIDTH}px;max-width:none;margin:0 auto;background:#fff` }
}

export function buildVisualEditor(
  target: WidgetEditTarget,
  options: VisualEditorOptions = {},
): {
  pane: HTMLElement
  contentDiv: HTMLElement
  /** 見たまま画面のスクロールする器（選択枠などの層を置く所） */
  editorBody: HTMLElement
  /** プレビューに当てる Widget の CSS を差し替える。コード欄や「要素ごとに編集」の変更をここへ流し込む */
  setPreviewCss: (css: string) => void
} {
  const inScope = (el: Element): boolean => options.toolScope === undefined || options.toolScope(el)
  const pane = document.createElement('div')
  // 620px プレビュー＋左右padding(20px)＝660px を下回らないよう min-width を置く（仕切りドラッグで変更可）。
  // 画面いっぱいになったので、左（見え方）が残り全部を取る。620pxのプレビューは中央に置かれる
  pane.style.cssText = `flex:1 1 auto;display:flex;flex-direction:column;min-width:560px`

  // ── ツールバー（2026-09-24 本人が見せたデザイン: 角の丸い白い帯。見た目は widget-toolbar-css.ts） ──
  ensureWidgetToolbarCss()
  const toolbar = document.createElement('div')
  toolbar.dataset['widgetToolbar'] = 'true'
  toolbar.className = 'wtb'

  /** contentDiv への参照（ツールバーからの書式操作に使用） */
  let contentRef: HTMLElement | null = null
  // 指示154: ツールバーの「画像サイズ」で対象にする、直近クリックした画像/動画。
  let lastMedia: HTMLElement | null = null

  /** ツールバーアイコンボタンを生成（variant: round＝丸い灰色の地・menu＝下向きの印つきで少し広い） */
  const mkBtn = (
    innerHtml: string,
    title: string,
    action?: (btn: HTMLButtonElement) => void,
    variant?: 'round' | 'menu',
  ): HTMLButtonElement => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.innerHTML = innerHtml
    btn.title = title
    btn.setAttribute('aria-label', title)
    btn.className = variant === undefined ? 'wtb__btn' : `wtb__btn wtb__btn--${variant}`
    btn.addEventListener('mousedown', (e) => { e.preventDefault() }) // 選択を維持
    if (action !== undefined) {
      btn.addEventListener('click', () => { action(btn); syncContentToCode() })
    }
    return btn
  }

  /**
   * ツールバーの操作をコードパネルの textarea に反映させる。
   *
   * 同期は contentDiv の input イベント1本（呼び出し元で配線）。
   * execCommand は input を出すが、`style.fontSize` を直に書くような DOM 直接操作は出さない。
   * サイズ−/+ は execCommand の**後**に px を直書きするので、
   * 何もしないと textarea は直書き前の HTML で止まり、
   * 「更新する」（textarea から保存）でサイズ変更だけが失われる。
   * ここで input を自分で出して、経路を1本に揃える（openMediaControl と同じ手）。
   */
  const syncContentToCode = (): void => {
    if (contentRef === null) return
    // どこを変えたか＝いま選んでいる所（部品で作ったWidgetは、その部品だけを設定データへ読み戻す）
    const sel = window.getSelection()
    const anchor = sel !== null && sel.rangeCount > 0 && contentRef.contains(sel.anchorNode) ? (sel.anchorNode ?? undefined) : undefined
    notifyCanvasEdit(contentRef, anchor)
  }

  /** ツールバーの区切りの縦線 */
  const mkSep = (): HTMLElement => {
    const s = document.createElement('div')
    s.className = 'wtb__sep'
    return s
  }

  /** フォントサイズ数値表示 */
  const mkSizeNum = (value: string): HTMLElement => {
    const el = document.createElement('span')
    el.textContent = value
    el.className = 'wtb__size-num'
    return el
  }

  /** 文字の大きさ −／数字／+ を1つの枠にまとめる */
  const mkSizeGroup = (...children: HTMLElement[]): HTMLElement => {
    const group = document.createElement('div')
    group.className = 'wtb__size'
    group.append(...children)
    return group
  }

  /** execCommand ラッパー */
  const exec = (cmd: string, val?: string): void => {
    contentRef?.focus()
    document.execCommand(cmd, false, val)
  }

  /**
   * 文字色 / 背景色を、LPエディタと**同じアプリ内パレット**から選ばせる（指示182）。
   *
   * 以前は OS のカラーダイアログ（`<input type="color">`）を開いていたが、
   * Mac だと別窓が立ち上がって重く、よく使う色にすぐ届かなかった。
   * `toolbar/color-picker.ts` は採取した実物のパレット（40色＋スポイト＋hex入力）なので、
   * ここから呼べば LPエディタと操作が揃う。
   *
   * パレットを開くとフォーカスが外れて選択が消えるため、開く前に選択レンジを保存し、
   * 適用時に復元してから execCommand する（この扱いは前から同じ）。
   */
  const pickColor = (anchor: HTMLElement, cmd: string, title: string): void => {
    const sel = window.getSelection()
    const savedRange =
      sel !== null && sel.rangeCount > 0 && contentRef !== null && contentRef.contains(sel.anchorNode)
        ? sel.getRangeAt(0).cloneRange()
        : null
    openColorPicker(
      anchor,
      title,
      (hex) => {
        contentRef?.focus()
        if (savedRange !== null && sel !== null) {
          sel.removeAllRanges()
          sel.addRange(savedRange)
        }
        document.execCommand(cmd, false, hex)
        syncContentToCode()
      },
      // Widget編集のツールバーは常時表示なので、開閉状態を持たせる必要がない
      { lastRange: null, keepOpen: false },
      () => undefined,
    )
  }

  /* 選択範囲を保持して、フォーカスが外れるツール（フォント選択・リンク入力）でも
   * 適用先の選択を失わないようにする。pickColor と同じ考え方。 */
  let savedRange: Range | null = null
  const saveSelection = (): void => {
    const sel = window.getSelection()
    if (sel !== null && sel.rangeCount > 0 && contentRef !== null && contentRef.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange()
    }
  }
  const restoreSelection = (): void => {
    contentRef?.focus()
    const sel = window.getSelection()
    if (savedRange !== null && sel !== null) {
      sel.removeAllRanges()
      sel.addRange(savedRange)
    }
  }

  /**
   * フォント選択のプルダウン（指示149/158/最新）。
   * ネイティブ <select> は macOS でオプションごとの font-family を描画しないため、
   * カスタムのドロップダウンにして各項目を「そのフォントの日本語名（＝プレビュー）」として
   * そのフォントで表示する。クリックで選択範囲にフォントを適用する。
   */
  const applyFont = (font: string): void => {
    restoreSelection()
    // 指示158: styleWithCSS=true で font-family をインラインstyleとして当てる。
    // 既定の execCommand('fontName') は <font face> を出すが、Widget/親のCSSに font-family が
    // あると打ち消されて「変化ない」ため、インラインstyle（詳細度最強）にして確実に効かせる。
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('fontName', false, cssFontFamilyValue(font))
    syncContentToCode()
  }

  const closeFontMenu = (): void => {
    document.querySelector('[data-widget-font-menu]')?.remove()
  }

  const mkFontSelect = (): HTMLElement => {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'position:relative;display:inline-flex'
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.title = 'フォント'
    trigger.innerHTML =
      `<span>フォント</span>` +
      `<svg width="10" height="10" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3l2 2 2-2"/></svg>`
    trigger.className = 'wtb__font'
    trigger.addEventListener('mousedown', (e) => { e.preventDefault(); saveSelection() })
    trigger.addEventListener('click', () => {
      if (document.querySelector('[data-widget-font-menu]') !== null) { closeFontMenu(); return }
      const menu = document.createElement('div')
      menu.setAttribute('data-widget-font-menu', 'true')
      menu.style.cssText =
        `position:fixed;z-index:9600;background:#fff;border:1px solid #ddd;border-radius:8px;` +
        `box-shadow:0 6px 22px rgba(0,0,0,.18);padding:4px;max-height:60vh;overflow:auto;min-width:180px`
      for (const font of TOOLBAR_FONT_FAMILIES) {
        const item = document.createElement('div')
        // ラベルはフォント名を日本語にしたもの（＝そのフォントで表示するプレビュー）。
        item.textContent = fontLabelJa(font)
        item.style.cssText =
          `padding:8px 12px;border-radius:6px;cursor:pointer;white-space:nowrap;color:#222;` +
          `font-family:${cssFontFamilyValue(font)};font-size:17px;line-height:1.3`
        item.addEventListener('mouseenter', () => { item.style.background = '#f0f4ff' })
        item.addEventListener('mouseleave', () => { item.style.background = 'transparent' })
        item.addEventListener('mousedown', (e) => e.preventDefault()) // 選択を保持
        item.addEventListener('click', () => { applyFont(font); closeFontMenu() })
        menu.append(item)
      }
      document.body.append(menu)
      const r = trigger.getBoundingClientRect()
      menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8))}px`
      const below = r.bottom + 4
      menu.style.top =
        below + menu.offsetHeight > window.innerHeight - 8
          ? `${Math.max(8, r.top - menu.offsetHeight - 4)}px`
          : `${below}px`
      const onOutside = (ev: MouseEvent): void => {
        if (!menu.contains(ev.target as Node) && ev.target !== trigger) {
          closeFontMenu()
          document.removeEventListener('mousedown', onOutside, true)
        }
      }
      setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0)
    })
    wrap.append(trigger)
    return wrap
  }

  /** リンク入力の小さなインラインポップ（指示149: prompt をやめる）。 */
  const closeLinkInput = (): void => {
    document.querySelector('[data-widget-link-input]')?.remove()
  }
  const openLinkInput = (anchorBtn: HTMLElement): void => {
    saveSelection()
    closeLinkInput()
    const box = document.createElement('div')
    box.setAttribute('data-widget-link-input', 'true')
    box.style.cssText =
      `position:fixed;z-index:9600;background:#fff;border:1px solid #ddd;border-radius:8px;` +
      `box-shadow:0 4px 18px rgba(0,0,0,.18);padding:10px;display:flex;gap:6px;align-items:center;font:12px ${FONT}`
    box.addEventListener('mousedown', (e) => e.stopPropagation())
    const input = document.createElement('input')
    input.type = 'url'
    input.placeholder = 'https://'
    input.style.cssText =
      `width:220px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;outline:none;font:12px ${FONT}`
    const ok = document.createElement('button')
    ok.type = 'button'
    ok.textContent = '適用'
    ok.style.cssText =
      `border:none;background:${COLOR.brand};color:#fff;border-radius:6px;padding:6px 12px;cursor:pointer;font:12px ${FONT}`
    const apply = (): void => {
      const url = input.value.trim()
      closeLinkInput()
      if (url === '' || url === 'https://') return
      restoreSelection()
      document.execCommand('createLink', false, url)
      syncContentToCode()
    }
    ok.addEventListener('click', apply)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); apply() }
      if (e.key === 'Escape') closeLinkInput()
    })
    box.append(input, ok)
    document.body.append(box)
    const r = anchorBtn.getBoundingClientRect()
    box.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 320))}px`
    box.style.top = `${r.bottom + 6}px`
    input.focus()
    const onOutside = (e: MouseEvent): void => {
      if (!box.contains(e.target as Node)) { closeLinkInput(); document.removeEventListener('mousedown', onOutside, true) }
    }
    setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0)
  }

  // サイズ表示
  const sizeNum = mkSizeNum('19')

  // ツールバーアイテム配置（本番の順序を再現 + 実動作接続）
  toolbar.append(
    mkBtn(svgToolUndo(), '元に戻す', () => exec('undo'), 'round'),
    mkBtn(svgToolRedo(), 'やり直す', () => exec('redo'), 'round'),
    mkSep(),
    mkFontSelect(),
    mkSizeGroup(
    mkBtn(svgToolSizeMinus(), 'サイズ−', () => {
      const cur = parseInt(sizeNum.textContent ?? '19', 10)
      const next = Math.max(8, cur - 1)
      exec('fontSize', '3')
      // fontSize command uses 1-7 scale; use inline style for exact px
      const sel = window.getSelection()
      if (sel !== null && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        const span = range.commonAncestorContainer.parentElement
        if (span !== null) span.style.fontSize = `${next}px`
      }
      sizeNum.textContent = String(next)
    }),
    sizeNum,
    mkBtn(svgToolSizePlus(), 'サイズ+', () => {
      const cur = parseInt(sizeNum.textContent ?? '19', 10)
      const next = Math.min(72, cur + 1)
      exec('fontSize', '5')
      const sel = window.getSelection()
      if (sel !== null && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        const span = range.commonAncestorContainer.parentElement
        if (span !== null) span.style.fontSize = `${next}px`
      }
      sizeNum.textContent = String(next)
    }),
    ),
    mkSep(),
    mkBtn(svgToolBold(), '太字', () => exec('bold')),
    mkBtn(svgToolUnderline(), '下線', () => exec('underline')),
    mkBtn(svgToolStrikethrough(), '取り消し線', () => exec('strikeThrough')),
    mkBtn(
      svgToolAlign(),
      '配置（選んだ部品は置く位置・文字は寄せ）',
      (btn) => {
        if (document.querySelector('[data-align-menu]') !== null) {
          closeAlignMenu()
          return
        }
        // 部品を選んでいれば、その部品の置く位置（見出し・文章は文字の寄せ）。選んでいなければ選んだ文字の寄せ
        openAlignMenu(btn, options.alignTarget?.() ?? null, (value) => {
          exec(`justify${value.charAt(0).toUpperCase()}${value.slice(1)}`)
          syncContentToCode()
        })
      },
      'menu',
    ),
    mkBtn(svgToolItalic(), '斜体', () => exec('italic')),
    mkBtn(svgToolTextColor(), '文字色', (btn) => pickColor(btn, 'foreColor', '文字色')),
    mkBtn(svgToolBgColor(), '背景色', (btn) => pickColor(btn, 'hiliteColor', '背景色')),
    mkBtn(svgToolImage(), '画像（PCから追加）', () => {
      void pickImageDataUrl().then((dataUrl) => {
        if (dataUrl === null) return
        contentRef?.focus()
        document.execCommand('insertImage', false, dataUrl)
      })
    }),
    // 指示154: 画像サイズ変更を上のツールバーからも開ける。直近クリックした画像、無ければ唯一の画像を対象にする。
    mkBtn(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:16px;height:16px"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      'サイズ（選んだ部品の幅と位置）',
      (btn) => {
        // 部品を選んでいれば、その部品の幅と置く位置の小窓を出す
        if (options.onSizeButton?.(btn) === true) return
        if (contentRef === null) return
        let target: HTMLElement | null =
          lastMedia !== null && contentRef.contains(lastMedia) ? lastMedia : null
        if (target === null) {
          const imgs = contentRef.querySelectorAll<HTMLElement>('img, video')
          if (imgs.length === 1) target = imgs[0] ?? null
        }
        if (target === null) {
          toast('サイズを変える画像をクリックして選んでください', 'error')
          return
        }
        openMediaControl(target, contentRef)
      },
    ),
    mkBtn(svgToolMarker(), 'マーカー（蛍光ペン）', () => exec('hiliteColor', '#fff176')),
    mkBtn(svgToolLink(), 'リンク', (btn) => openLinkInput(btn)),
    mkBtn(svgToolClearFormat(), '書式クリア', () => exec('removeFormat')),
  )

  // エディタ本文（本番実測: padding:20px, contenteditable で書式操作を可能に）
  // overflow:auto にして、下の固定幅プレビューが狭いペインでは横スクロールできるようにする。
  const frame = frameStyle(options.previewFrame ?? 'lp')
  const editorBody = document.createElement('div')
  editorBody.style.cssText =
    `flex:1;background:${frame.backdrop};overflow:auto;padding:20px;min-height:0`
  // CSS を style タグとして注入してからHTMLをレンダリング。
  // 空でも必ず1つ置く（あとからコード欄や「要素ごとに編集」の変更をここへ流し込むため）。
  // 表示用に作り直す（保存するCSSはそのまま）: このプレビューの中だけに効かせ（編集画面のボタンや後ろのキャンバスに漏らさない）、
  // SquadBeyond のプレビュー用CSSを除き、@media は LPの幅（620px）で判定し、配信と同じ土台を付ける。
  const styleTag = document.createElement('style')
  // LPに入る中身なので、ダークでも上書きを作らない（配信されるLPは白いまま。Widget自身の <style> も contentDiv の印で外れる）
  styleTag.dataset['darkRuntime'] = 'skip'
  editorBody.append(styleTag)
  const contentDiv = document.createElement('div')
  const previewScope = markStyleScope(contentDiv)
  const setPreviewCss = (css: string): void => {
    styleTag.textContent = widgetPreviewCss(css, previewScope)
  }
  setPreviewCss(target.css)
  contentDiv.setAttribute('contenteditable', 'true')
  // WYSIWYG: 編集プレビューを **配信LPと同じ幅(620px)** で表示する。
  // 以前は左ペインの可変幅で表示していたため、編集時の見た目とLPの見た目（画像幅など）がズレていた。
  // 620px = 配信SSRの body max-width（mock-server/routes/delivery.ts の DELIVERY_WIDTH）。
  // line-height:1.5 は配信LPの section.sb-widget-block と揃える（指示155・WYSIWYG）。
  contentDiv.dataset['widgetPreview'] = 'true'
  contentDiv.dataset['darkRuntime'] = 'skip'
  // ポップアップの中身は、配信と同じく中身の幅の箱（frameStyle）。
  // 文字は配信と同じ黒（ダークの html は color-scheme:dark なので、何もしないと継いだ文字が白くなり白い紙に消える）
  contentDiv.style.cssText =
    `outline:none;min-height:100px;${frame.box};box-sizing:border-box;line-height:1.5;color:#000;color-scheme:light`
  contentDiv.innerHTML = target.html
  editorBody.append(contentDiv)
  // よくある質問・口コミのように並んでいる部品に「複製・上へ・下へ・消す」を出す（ノーコードでWidgetを作る②）。
  // 部品で作ったWidgetでは見本の部品の中だけ（見出し・ボタンなどの部品の並びは右で直す）
  attachItemToolbar(editorBody, contentDiv, { allow: inScope })

  // 画像/動画はクリックで操作パネル（差し替え＋サイズ変更）を出す。
  // グレーの「画像」枠も data URI の <img> なので同様に効く。
  // 部品（画像の部品）は、押すとその部品が右で開く（画像の差し替え・幅はそこで）
  const markImages = (): void => {
    for (const el of contentDiv.querySelectorAll<HTMLElement>('img, video')) {
      el.style.cursor = 'pointer'
      if (el.title === '') el.title = inScope(el) ? 'クリックで差し替え・サイズ変更' : 'クリックで右に開く（差し替え・幅）'
    }
  }
  markImages()
  contentDiv.addEventListener('input', markImages)
  contentDiv.addEventListener('click', (e) => {
    // 修飾キー押下時はウィジェットの動作確認モード（指示146）。メディア操作パネルは出さない。
    if (e.ctrlKey || e.metaKey) return
    const media = (e.target as HTMLElement).closest<HTMLElement>('img, video')
    if (media === null || !contentDiv.contains(media) || !inScope(media)) {
      closeMediaControl()
      return
    }
    e.preventDefault()
    lastMedia = media // 指示154: ツールバーの「画像サイズ」用に覚えておく
    openMediaControl(media, contentDiv)
  })

  // ── 指示146: ボタン等の動作確認 ──
  // 通常クリック＝編集（ウィジェットのJS動作は止める）。Ctrl(Win)/⌘(Mac)+クリック＝実際の動作を発火。
  // ウィジェットの <script> は innerHTML では実行されないので、パネルがDOMに載った後
  // （openWidgetEditor 末尾）で runWidgetScripts を呼んで実行する（init が document を参照するため）。
  contentDiv.addEventListener(
    'click',
    (e) => {
      const mod = e.ctrlKey || e.metaKey
      // 部品を選ぶなど、押した所を知りたい側へ先に知らせる（この下でボタンの押下を止めても届くように）
      if (!mod) options.onClick?.(e.target)
      const interactive = (e.target as HTMLElement).closest(
        'button, a, [role="button"], input[type="button"], input[type="submit"]',
      )
      if (interactive === null) return
      if (!mod) {
        // 編集モード: ウィジェットのクリック動作（次へ遷移など）を止める
        e.preventDefault()
        e.stopImmediatePropagation()
        // リンクのボタンなら、下にリンク先を出す（見本のリンク先は仮のまま入っていることが多い・その場で入れられる）。
        // ボタンの部品のリンク先は右の「押したとき」で直す（見本の部品の中だけ吹き出しを出す）
        const anchor = (e.target as HTMLElement).closest('a')
        if (anchor !== null && contentDiv.contains(anchor) && inScope(anchor)) openLinkBubble(anchor, syncContentToCode)
      } else if (interactive.tagName === 'A') {
        // 動作確認モード（指示156）: ウィジェットには `window.location.href = this.href` で
        // ページ遷移するタイプ（リンク型アンケート等）があり、そのまま通すと編集画面から離脱して
        // 画面が壊れる。ハンドラ（この後 bubble で走る）が読む href を一時的に無害な no-op へ差し替え、
        // 直後に元へ戻す（保存はコードパネル基準なので実HTMLには影響しない）。is-active 等の見た目は動く。
        e.preventDefault()
        const a = interactive
        const orig = a.getAttribute('href')
        a.setAttribute('href', 'javascript:void(0)')
        setTimeout(() => {
          if (orig === null) a.removeAttribute('href')
          else a.setAttribute('href', orig)
        }, 0)
      }
    },
    true,
  )

  // ツールバーから参照できるようにする
  contentRef = contentDiv

  // 指示146の注意書き: ボタン等の動作確認方法をユーザーに明示する（ツールバーの右端）
  const note = document.createElement('span')
  note.dataset['widgetNote'] = 'true'
  note.textContent = 'ボタンの動作確認は Ctrl（Windows）/ ⌘（Mac）＋クリック'
  note.className = 'wtb__note'
  toolbar.append(note)

  // Widget全体の上下の余白は、右の「Widget全体の設定」か左の選択枠の上下の辺で直す（2026-09-24・第3弾で余白の欄は外した）。
  // 画面①②…・設問①②…のタブは、右側のいちばん上に出す（widget-studio.ts）
  pane.append(toolbar, editorBody)
  return { pane, contentDiv, editorBody, setPreviewCss }
}
