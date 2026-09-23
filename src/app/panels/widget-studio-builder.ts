/**
 * Widget編集の「部品」モード（2026-09-23・本人の決定 D1/D2。ノーコードで作る画面をWidget編集に統合）。
 *
 * 設定データ（TemplateData）が正本。右の入力欄（template-form.ts）で変えるたびに書き出し直して、
 * 左の見たまま画面（contentDiv）へ流す。左で文字を打ち直したときは、その部品だけ設定データへ読み戻す
 * （canvas-sync.ts）。左で部品を押すと右でその部品が開き、右で部品を選ぶと左に選択枠が出る。
 *
 *  - 見たまま画面には、いま右で開いている画面（画面①②…）だけを出す（書き出しの view.screen）
 *  - 文字を打てない部品（画像・余白・型の部品 など）は contenteditable を切る。左の中身は保存しないので、
 *    こうした目印を付けても配信には出ない（保存は設定データからの書き出し＝embedBuilderData）
 *  - 書式（太字・色）は付けられない。要るときは「部品を解除」でHTMLのWidgetにして、いつもの書式で直す
 */
import { toast } from '../ui.ts'
import { embedBuilderData, splitStyles } from './nocode/builder-data.ts'
import { blockElementAt, isTextEditableBlock, outermostBlock, syncCanvasBlock } from './nocode/canvas-sync.ts'
import { getAt, setAt, type Path } from './nocode/form-state.ts'
import { ensureNocodeFormCss } from './nocode/nocode-form-css.ts'
import { buildTemplateForm } from './nocode/template-form.ts'
import { BUILDER_TEMPLATE } from './nocode/templates/builder.ts'
import { blockLabel } from './nocode/templates/builder-blocks.ts'
import { newUid } from './nocode/templates/kit.ts'
import { items, str, type ItemData, type TemplateData } from './nocode/templates/types.ts'
import { createSelectionLayer } from './selection-layer.ts'
import { FONT } from './widget-editor-theme.ts'
import { runWidgetScripts } from './widget-run-scripts.ts'

export interface BuilderSessionDeps {
  readonly data: TemplateData
  readonly uid: string
  readonly contentDiv: HTMLElement
  readonly editorBody: HTMLElement
  readonly setPreviewCss: (css: string) => void
  /** 画面①②…のタブを置く所（右側のいちばん上） */
  readonly tabsHost: HTMLElement
  /** 見本の部品: いつもの見本の一覧から見本を選んでもらう（やめたら null） */
  readonly pickSample: () => Promise<{ title: string; html: string } | null>
}

export interface BuilderSession {
  /** 右側に置く「部品」の入力欄（スクロールする器ごと） */
  readonly panel: HTMLElement
  /** 見たまま画面へ最初に描く（パネルが画面に載ってから呼ぶ＝Widgetのスクリプトが document を見るため） */
  readonly start: () => void
  readonly getData: () => TemplateData
  readonly getUid: () => string
  /** LPに入れる・登録するHTML（設定データつき）。入れられない中身なら理由 */
  readonly finalHtml: () => { html: string } | { error: string }
  /** 確かめずに書き出したHTML（部品を解除するとき） */
  readonly plainHtml: () => string
  /** コード欄に出す今のHTMLとCSS */
  readonly currentCode: () => { html: string; css: string }
  /** 見たまま画面を押した（部品を選ぶ） */
  readonly onCanvasClick: (target: EventTarget | null) => void
  /** 登録の名前の初期値（「組み立てたWidget（最初の見出し）」） */
  readonly suggestName: () => string
  /** 登録したあと、次に入れる分の名前（CSSのクラス）を付け直す（同じLPに並んでも色がまざらない） */
  readonly rekey: () => void
}

/** 打つたびに見え方を描き直すと重いので、手が止まってから描く */
const PAINT_DELAY_MS = 250
/** 見本の部品を左で打ち直したあと、右の入力欄を読み直すまでの待ち */
const REBUILD_DELAY_MS = 600

/** 改行を入れられる部品（見出し・ボタンの文字は1行） */
const MULTILINE: ReadonlySet<string> = new Set(['text', 'list', 'imageText'])

/** 登録するときの名前の初期値（「組み立てたWidget（最初の見出し）」） */
function suggestBuilderName(data: TemplateData): string {
  const firstHeading = items(data, 'screens')
    .flatMap((screen) => items(screen, 'blocks'))
    .find((block) => str(block, 'type') === 'heading')
  const hint = str(firstHeading ?? {}, 'text').trim().slice(0, 20)
  return hint === '' ? BUILDER_TEMPLATE.name : `${BUILDER_TEMPLATE.name}（${hint}）`
}

export function createBuilderSession(deps: BuilderSessionDeps): BuilderSession {
  ensureNocodeFormCss()
  const { contentDiv, editorBody } = deps
  let data = deps.data
  let uid = deps.uid
  let paintTimer = 0
  let rebuildTimer = 0
  /** 見え方だけの差し替え（見本の部品で選んだ設問を出したHTML）。保存する中身には入れない */
  const previewOverrides = new Map<string, { path: Path; html: string }>()

  const panel = document.createElement('div')
  panel.dataset['ncTab'] = 'studio'
  panel.dataset['ncfScroll'] = 'true'
  panel.style.cssText = `flex:1;min-height:0;overflow-y:auto;padding:12px 16px 28px;background:#fff;box-sizing:border-box;font-family:${FONT}`

  const selection = createSelectionLayer(editorBody, contentDiv)

  const activeScreenId = (): string | undefined => {
    const screen = items(data, 'screens')[form.activeScreen()]
    const id = str(screen ?? {}, 'id')
    return id === '' ? undefined : id
  }

  /** 部品の場所から、その部品の中身 */
  const blockAt = (screenIndex: number, blockIndex: number): ItemData | undefined =>
    getAt(data, ['screens', screenIndex, 'blocks', blockIndex]) as ItemData | undefined

  /** 見たまま画面の部品の要素 → 設定データの中の場所（画面・何番目） */
  const placeOf = (el: HTMLElement): { screenIndex: number; blockIndex: number; block: ItemData } | null => {
    const screenIndex = form.activeScreen()
    const blocks = items(items(data, 'screens')[screenIndex] ?? {}, 'blocks')
    for (const blockIndex of blocks.keys()) {
      if (blockElementAt(data, contentDiv, screenIndex, blockIndex) === el) {
        const block = blocks[blockIndex]
        return block === undefined ? null : { screenIndex, blockIndex, block }
      }
    }
    return null
  }

  /** 左の選択枠を、右で選んでいる部品に合わせる */
  const showSelection = (): void => {
    const blockIndex = form.selectedBlock()
    if (blockIndex === null) {
      selection.select(null)
      return
    }
    const el = blockElementAt(data, contentDiv, form.activeScreen(), blockIndex)
    const block = blockAt(form.activeScreen(), blockIndex)
    selection.select(el, block === undefined ? '' : blockLabel(str(block, 'type')))
  }

  /** 文字を打てない部品には、見たまま画面で文字を打てないようにする（左の中身は保存しないので目印を付けてよい） */
  const markNonEditable = (): void => {
    for (const el of contentDiv.querySelectorAll<HTMLElement>('.nc-b')) {
      if (outermostBlock(el, contentDiv) !== el) continue
      const place = placeOf(el)
      if (place !== null && !isTextEditableBlock(place.block)) el.setAttribute('contenteditable', 'false')
    }
  }

  const paint = (): void => {
    window.clearTimeout(paintTimer)
    let previewData = data
    for (const override of previewOverrides.values()) previewData = setAt(previewData, override.path, override.html)
    const screen = activeScreenId()
    const html = BUILDER_TEMPLATE.render(previewData, uid, screen === undefined ? undefined : { screen })
    const { css, body } = splitStyles(html)
    contentDiv.innerHTML = body
    deps.setPreviewCss(css)
    runWidgetScripts(contentDiv)
    markNonEditable()
    showSelection()
  }
  const schedulePaint = (): void => {
    window.clearTimeout(paintTimer)
    paintTimer = window.setTimeout(paint, PAINT_DELAY_MS)
  }

  const form = buildTemplateForm({
    fields: BUILDER_TEMPLATE.fields,
    data,
    onChange: (next) => {
      data = next
      schedulePaint()
    },
    onScreenChange: () => paint(),
    pickSample: deps.pickSample,
    onPreviewOverride: (key, path, html) => {
      if (html === null) previewOverrides.delete(key)
      else previewOverrides.set(key, { path, html })
      schedulePaint()
    },
    onPreviewReset: () => previewOverrides.clear(),
    tabsHost: deps.tabsHost,
    onSelect: () => showSelection(),
  })
  panel.append(form.element)

  /* ── 左で文字を打ち直したら、その部品だけ設定データへ読み戻す ── */
  const selectionBlock = (): { el: HTMLElement; block: ItemData } | null => {
    const sel = document.getSelection()
    if (sel === null || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    const start = outermostBlock(range.startContainer, contentDiv)
    const end = outermostBlock(range.endContainer, contentDiv)
    if (start === null || start !== end) return null
    const place = placeOf(start)
    return place === null ? null : { el: start, block: place.block }
  }

  contentDiv.addEventListener('beforeinput', (event) => {
    const found = selectionBlock()
    // 部品の外・部品をまたぐ・文字を打てない部品 → 何もしない（部品の形が壊れないように）
    if (found === null || !isTextEditableBlock(found.block)) {
      event.preventDefault()
      return
    }
    const type = str(found.block, 'type')
    // 見本の部品の中は見本の形のまま（HTMLごと読み戻す）ので、ブラウザに任せる
    if (type === 'sample') return
    if (event.inputType.startsWith('format')) {
      event.preventDefault()
      return
    }
    if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
      event.preventDefault()
      if (MULTILINE.has(type)) document.execCommand('insertLineBreak')
      return
    }
    if (event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop') {
      // 貼り付けは素の文字だけ（書式やタグを持ち込まない）
      event.preventDefault()
      const text = event.dataTransfer?.getData('text/plain') ?? ''
      if (text !== '') document.execCommand('insertText', false, MULTILINE.has(type) ? text : text.replace(/\s*\n\s*/g, ' '))
      return
    }
    // 部品の頭で Backspace・末尾で Delete は、隣の部品と混ざるので止める
    const sel = document.getSelection()
    const range = sel?.getRangeAt(0)
    if (range === undefined || !range.collapsed) return
    if (event.inputType === 'deleteContentBackward') {
      const before = document.createRange()
      before.setStart(found.el, 0)
      before.setEnd(range.startContainer, range.startOffset)
      if (before.toString() === '') event.preventDefault()
    } else if (event.inputType === 'deleteContentForward') {
      const after = document.createRange()
      after.setStart(range.endContainer, range.endOffset)
      after.setEnd(found.el, found.el.childNodes.length)
      if (after.toString() === '') event.preventDefault()
    }
  })

  contentDiv.addEventListener('input', () => {
    const found = selectionBlock()
    if (found === null) return
    const synced = syncCanvasBlock(data, found.el, contentDiv)
    if (synced === null) return
    data = synced.data
    form.setData(data)
    selection.refresh()
    // 見本の部品の入力欄は中身から作っているので、少し待ってから読み直す
    if (str(synced.block, 'type') === 'sample') {
      window.clearTimeout(rebuildTimer)
      rebuildTimer = window.setTimeout(() => form.rebuild(), REBUILD_DELAY_MS)
    }
  })

  const onCanvasClick = (target: EventTarget | null): void => {
    const el = outermostBlock(target, contentDiv)
    const place = el === null ? null : placeOf(el)
    if (place === null) {
      form.select(form.activeScreen(), null)
      return
    }
    form.select(place.screenIndex, place.blockIndex)
  }

  const rendered = (): string => embedBuilderData(BUILDER_TEMPLATE.render(data, uid), data)

  return {
    panel,
    start: paint,
    getData: () => data,
    getUid: () => uid,
    finalHtml: () => {
      const problem = BUILDER_TEMPLATE.validate(data, new Date())
      if (problem !== null) {
        toast(problem, 'error')
        return { error: problem }
      }
      return { html: rendered() }
    },
    plainHtml: () => BUILDER_TEMPLATE.render(data, uid),
    currentCode: () => {
      const { css, body } = splitStyles(rendered())
      return { html: body, css }
    },
    onCanvasClick,
    suggestName: () => suggestBuilderName(data),
    rekey: () => {
      uid = newUid()
      paint()
    },
  }
}
