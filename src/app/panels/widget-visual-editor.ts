/**
 * Widget編集画面の左側「ビジュアルエディタ」（widget-editor.ts から分離）。
 *
 * 採取したWidgetのHTMLを contenteditable として直接いじれるようにし、
 * その上にツールバー（書式・文字サイズ・色・リンク・画像）を載せる。
 * 変更はコードパネルの textarea へ input イベントで同期する。
 */
import { COLOR, FONT, WIDGET_PREVIEW_WIDTH, type WidgetEditTarget } from './widget-editor-theme.ts'
import { closeMediaControl, openMediaControl, pickImageDataUrl } from './widget-media-control.ts'
import { toast } from '../ui.ts'
import {
  TOOLBAR_FONT_FAMILIES,
  cssFontFamilyValue,
  fontLabelJa,
} from './toolbar/text-format.ts'
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

export function buildVisualEditor(target: WidgetEditTarget): { pane: HTMLElement; contentDiv: HTMLElement } {
  const pane = document.createElement('div')
  // 既定幅は 620px プレビュー＋左右padding(20px) が収まる 660px（仕切りドラッグで変更可）。
  pane.style.cssText = `flex:0 0 660px;display:flex;flex-direction:column;min-width:0`

  // ── ツールバー（本番実測: 1行 flex-wrap, height:64px, 20項目, 1px×16pxセパレータ） ──
  const toolbar = document.createElement('div')
  toolbar.style.cssText =
    `background:#fff;border-bottom:1px solid #ddd;flex-shrink:0;height:64px;box-sizing:border-box;` +
    `display:flex;flex-wrap:wrap;gap:2px;padding:6px 10px;align-items:center`

  /** contentDiv への参照（ツールバーからの書式操作に使用） */
  let contentRef: HTMLElement | null = null
  // 指示154: ツールバーの「画像サイズ」で対象にする、直近クリックした画像/動画。
  let lastMedia: HTMLElement | null = null

  /** ツールバーアイコンボタンを生成 */
  const mkBtn = (
    innerHtml: string,
    title: string,
    action?: (btn: HTMLButtonElement) => void,
    wide?: boolean,
  ): HTMLButtonElement => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.innerHTML = innerHtml
    btn.title = title
    btn.style.cssText =
      `border:none;background:none;padding:4px;color:#555;cursor:pointer;` +
      `display:flex;align-items:center;justify-content:center;gap:2px;` +
      `min-width:${wide === true ? '80' : '28'}px;height:28px;border-radius:2px`
    btn.addEventListener('mouseenter', () => { btn.style.background = '#f0f0f0' })
    btn.addEventListener('mouseleave', () => { btn.style.background = 'none' })
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
    contentRef?.dispatchEvent(new Event('input', { bubbles: true }))
  }

  /** ツールバーセパレータ（本番実測: 1px × 16px） */
  const mkSep = (): HTMLElement => {
    const s = document.createElement('div')
    s.style.cssText = 'width:1px;height:16px;background:#ddd;margin:0 4px;flex-shrink:0'
    return s
  }

  /** フォントサイズ数値表示 */
  const mkSizeNum = (value: string): HTMLElement => {
    const el = document.createElement('span')
    el.textContent = value
    el.style.cssText =
      `display:flex;align-items:center;justify-content:center;min-width:28px;height:24px;` +
      `border:1px solid #ddd;border-radius:2px;font:12px/1 ${FONT};color:#555;padding:0 4px`
    return el
  }

  /** execCommand ラッパー */
  const exec = (cmd: string, val?: string): void => {
    contentRef?.focus()
    document.execCommand(cmd, false, val)
  }

  /**
   * カラーパッド（ネイティブ color input）で文字色/背景色を選ばせる。
   * prompt でカラーコードを打たせる代わりに、色をパッドから選べるようにする。
   * OS のピッカーを開くとフォーカスが外れて選択が消えるため、開く前に選択レンジを保存し、
   * 適用時に選択を復元してから execCommand する。
   */
  const pickColor = (cmd: string, fallback: string): void => {
    const sel = window.getSelection()
    const savedRange =
      sel !== null && sel.rangeCount > 0 && contentRef !== null && contentRef.contains(sel.anchorNode)
        ? sel.getRangeAt(0).cloneRange()
        : null
    const input = document.createElement('input')
    input.type = 'color'
    input.value = /^#[0-9a-f]{6}$/i.test(fallback) ? fallback : '#000000'
    input.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0'
    document.body.append(input)
    let applied = false
    const apply = (): void => {
      if (applied) return
      applied = true
      contentRef?.focus()
      if (savedRange !== null && sel !== null) {
        sel.removeAllRanges()
        sel.addRange(savedRange)
      }
      document.execCommand(cmd, false, input.value)
      syncContentToCode()
      input.remove()
    }
    // change=確定時に1回だけ適用（input は連続発火するため使わない）
    input.addEventListener('change', apply)
    input.click()
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
      `<span style="font:12px/1 ${FONT};white-space:nowrap">フォント</span>` +
      `<svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px"><path d="M2 3l2 2 2-2"/></svg>`
    trigger.style.cssText =
      `height:28px;border:1px solid #ddd;border-radius:2px;background:#fff;color:#555;` +
      `padding:0 8px;cursor:pointer;display:inline-flex;align-items:center`
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

  // 整列サイクル
  const ALIGNS = ['left', 'center', 'right', 'justifyFull'] as const
  let alignIdx = 0

  // サイズ表示
  const sizeNum = mkSizeNum('19')

  // ツールバーアイテム配置（本番の順序を再現 + 実動作接続）
  toolbar.append(
    mkBtn(svgToolUndo(), '元に戻す', () => exec('undo')),
    mkBtn(svgToolRedo(), 'やり直す', () => exec('redo')),
    mkSep(),
    mkFontSelect(),
    mkSep(),
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
    mkSep(),
    mkBtn(svgToolBold(), '太字', () => exec('bold')),
    mkBtn(svgToolUnderline(), '下線', () => exec('underline')),
    mkBtn(svgToolStrikethrough(), '取り消し線', () => exec('strikeThrough')),
    mkBtn(svgToolAlign(), '配置', () => {
      alignIdx = (alignIdx + 1) % ALIGNS.length
      const a = ALIGNS[alignIdx] ?? 'left'
      exec(`justify${a.charAt(0).toUpperCase()}${a.slice(1)}`)
    }),
    mkBtn(svgToolItalic(), '斜体', () => exec('italic')),
    mkBtn(svgToolTextColor(), '文字色', () => pickColor('foreColor', '#000000')),
    mkBtn(svgToolBgColor(), '背景色', () => pickColor('hiliteColor', '#ffff00')),
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
      '画像サイズ',
      () => {
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
  const editorBody = document.createElement('div')
  editorBody.style.cssText =
    `flex:1;background:#fff;overflow:auto;padding:20px;min-height:0`
  // CSS を style タグとして注入してからHTMLをレンダリング
  if (target.css.trim() !== '') {
    const styleTag = document.createElement('style')
    styleTag.textContent = target.css
    editorBody.append(styleTag)
  }
  const contentDiv = document.createElement('div')
  contentDiv.setAttribute('contenteditable', 'true')
  // WYSIWYG: 編集プレビューを **配信LPと同じ幅(620px)** で表示する。
  // 以前は左ペインの可変幅で表示していたため、編集時の見た目とLPの見た目（画像幅など）がズレていた。
  // 620px = 配信SSRの body max-width（mock-server/routes/delivery.ts の DELIVERY_WIDTH）。
  // line-height:1.5 は配信LPの section.sb-widget-block と揃える（指示155・WYSIWYG）。
  contentDiv.style.cssText =
    `outline:none;min-height:100px;width:${WIDGET_PREVIEW_WIDTH}px;max-width:none;margin:0 auto;box-sizing:border-box;line-height:1.5`
  contentDiv.innerHTML = target.html
  editorBody.append(contentDiv)

  // 画像/動画はクリックで操作パネル（差し替え＋サイズ変更）を出す。
  // グレーの「画像」枠も data URI の <img> なので同様に効く。
  const markImages = (): void => {
    for (const el of contentDiv.querySelectorAll<HTMLElement>('img, video')) {
      el.style.cursor = 'pointer'
      if (el.title === '') el.title = 'クリックで差し替え・サイズ変更'
    }
  }
  markImages()
  contentDiv.addEventListener('input', markImages)
  contentDiv.addEventListener('click', (e) => {
    // 修飾キー押下時はウィジェットの動作確認モード（指示146）。メディア操作パネルは出さない。
    if (e.ctrlKey || e.metaKey) return
    const media = (e.target as HTMLElement).closest<HTMLElement>('img, video')
    if (media === null || !contentDiv.contains(media)) {
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
      const interactive = (e.target as HTMLElement).closest(
        'button, a, [role="button"], input[type="button"], input[type="submit"]',
      )
      if (interactive === null) return
      const mod = e.ctrlKey || e.metaKey
      if (!mod) {
        // 編集モード: ウィジェットのクリック動作（次へ遷移など）を止める
        e.preventDefault()
        e.stopImmediatePropagation()
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

  // ── 余白調整バー（指示144: 上下の余白を調整できるように） ──
  // Widget 最外要素の padding-top / padding-bottom を px で調整する。
  // 変更はインラインstyleとして最外要素に付き、input イベント経由でコードパネル→保存に反映される。
  const spacingBar = buildSpacingBar(contentDiv)

  pane.append(toolbar, spacingBar, editorBody)
  return { pane, contentDiv }
}
/**
 * Widget の上下余白（最外要素の padding-top / padding-bottom）を調整する小さなバー。
 * 「下の余白が多すぎる」を編集画面から直接詰められるようにする（指示144）。
 */
export function buildSpacingBar(contentDiv: HTMLElement): HTMLElement {
  const bar = document.createElement('div')
  bar.style.cssText =
    `display:flex;align-items:center;gap:8px;background:#fafafa;border-bottom:1px solid #eee;` +
    `flex-shrink:0;padding:6px 12px;font:12px/1 ${FONT};color:#666`

  const label = document.createElement('span')
  label.textContent = '余白'
  label.style.cssText = 'flex-shrink:0;color:#888'

  const root = (): HTMLElement | null => contentDiv.firstElementChild as HTMLElement | null

  const readPad = (side: 'Top' | 'Bottom'): number => {
    const r = root()
    if (r === null) return 0
    const v = parseInt(getComputedStyle(r)[`padding${side}` as 'paddingTop'], 10)
    return Number.isNaN(v) ? 0 : v
  }

  const mkField = (labelText: string, side: 'Top' | 'Bottom'): HTMLElement => {
    const wrap = document.createElement('label')
    wrap.style.cssText = 'display:flex;align-items:center;gap:4px'
    const t = document.createElement('span')
    t.textContent = labelText
    const input = document.createElement('input')
    input.type = 'number'
    input.min = '0'
    input.value = String(readPad(side))
    input.style.cssText =
      `width:56px;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font:12px/1 ${FONT};` +
      `color:#333;box-sizing:border-box;font-variant-numeric:tabular-nums`
    const unit = document.createElement('span')
    unit.textContent = 'px'
    unit.style.color = '#aaa'
    const apply = (): void => {
      const r = root()
      if (r === null) return
      const n = Math.max(0, parseInt(input.value, 10) || 0)
      r.style.setProperty(`padding-${side.toLowerCase()}`, `${n}px`)
      // プログラム変更は input イベントが飛ばないので、手動で発火してコード→保存へ反映する。
      contentDiv.dispatchEvent(new Event('input', { bubbles: true }))
    }
    input.addEventListener('input', apply)
    input.addEventListener('change', apply)
    wrap.append(t, input, unit)
    return wrap
  }

  // 指示146の注意書き: ボタン等の動作確認方法をユーザーに明示する。
  const note = document.createElement('span')
  note.textContent = 'ボタンの動作確認は Ctrl（Windows）/ ⌘（Mac）＋クリック'
  note.style.cssText = 'margin-left:auto;color:#999;font-size:11px;white-space:nowrap'

  bar.append(label, mkField('上', 'Top'), mkField('下', 'Bottom'), note)
  return bar
}
