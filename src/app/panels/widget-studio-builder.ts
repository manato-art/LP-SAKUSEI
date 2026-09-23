/**
 * Widget編集の「部品」の仕組み（2026-09-23・本人の決定 D1/D2。2026-09-24 第3弾で唯一の直し方になった）。
 *
 * 設定データ（TemplateData）が正本。右の入力欄（template-form.ts）で変えるたびに書き出し直して、
 * 左の見たまま画面（contentDiv）へ流す。左で文字を打ち直したり、道具（ツールバー・画像の操作パネル・
 * 並んだ部品の操作ボタン・要素ごとのカード）で直したときは、変えた要素の部品だけ設定データへ読み戻す
 * （canvas-sync.ts。どの要素を変えたかは input イベントに添えて届く＝widget-canvas-events.ts）。
 * 左で部品を押すと右でその部品が開き、右で部品を選ぶと左に選択枠が出る。
 *
 *  - 設定データを持たないWidget（自作の見本・手書きのHTML）は「見本の部品1つ」として開く（widget-studio.ts）
 *  - 見たまま画面には、いま右で開いている画面（画面①②…）だけを出す（書き出しの view.screen）
 *  - 文字を打てない部品（画像・余白・型の部品 など）は contenteditable を切る。左の中身は保存しないので、
 *    こうした目印を付けても配信には出ない（保存は設定データからの書き出し＝embedBuilderData）
 *  - 見出し・文章などの文字は、ツールバーで付けた飾り（太字・色）ごと持つ（rich-text.ts）
 *  - CSSだけが変わったとき（カードのスライダーなど）は、中身を入れ替えずCSSだけ差し替える（軽い・要素が入れ替わらない）
 */
import { toast } from '../ui.ts'
import { embedBuilderData, splitStyles } from './nocode/builder-data.ts'
import { blockElementAt, isTextEditableBlock, outermostBlock, syncCanvasBlock } from './nocode/canvas-sync.ts'
import { getAt, setAt, type Path } from './nocode/form-state.ts'
import { ensureNocodeFormCss } from './nocode/nocode-form-css.ts'
import { buildTemplateForm } from './nocode/template-form.ts'
import { BUILDER_PADDING, BUILDER_TEMPLATE } from './nocode/templates/builder.ts'
import { HEADING_SIZES, SPACER_SIZES, TEXT_SIZES, blockLabel, sizeOf } from './nocode/templates/builder-blocks.ts'
import { newUid } from './nocode/templates/kit.ts'
import { int, items, str, type ItemData, type TemplateData } from './nocode/templates/types.ts'
import { createSelectionLayer, type SelectionHandle } from './selection-layer.ts'
import { canvasEditTarget } from './widget-canvas-events.ts'
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
  /** コード欄に出す今のHTMLとCSS */
  readonly currentCode: () => { html: string; css: string }
  /** 見たまま画面を押した（部品を選ぶ。見本の部品の中なら、その中の要素も） */
  readonly onCanvasClick: (target: EventTarget | null) => void
  /** 左の道具（画像の操作パネル・リンクの吹き出し・並んだ部品の操作）を効かせてよい要素か＝見本の部品の中 */
  readonly toolScope: (el: Element) => boolean
  /** 登録の名前の初期値（「組み立てたWidget（最初の見出し）」） */
  readonly suggestName: () => string
  /** 登録したあと、次に入れる分の名前（CSSのクラス）を付け直す（同じLPに並んでも色がまざらない） */
  readonly rekey: () => void
}

/** 打つたびに見え方を描き直すと重いので、手が止まってから描く */
const PAINT_DELAY_MS = 250
/** 見本の部品を左で直したあと、右の入力欄を読み直すまでの待ち */
const REBUILD_DELAY_MS = 600

/** 改行を入れられる部品（見出し・ボタンの文字は1行） */
const MULTILINE: ReadonlySet<string> = new Set(['text', 'list', 'imageText'])

/** 登録するときの名前の初期値（「組み立てたWidget（最初の見出し）」。見本1つなら見本の名前） */
function suggestBuilderName(data: TemplateData): string {
  const blocks = items(data, 'screens').flatMap((screen) => items(screen, 'blocks'))
  const only = blocks.length === 1 ? blocks[0] : undefined
  if (only !== undefined && str(only, 'type') === 'sample' && str(only, 'title').trim() !== '') return str(only, 'title').trim()
  const firstHeading = blocks.find((block) => str(block, 'type') === 'heading')
  const hint = str(firstHeading ?? {}, 'text')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 20)
  return hint === '' ? BUILDER_TEMPLATE.name : `${BUILDER_TEMPLATE.name}（${hint}）`
}

export function createBuilderSession(deps: BuilderSessionDeps): BuilderSession {
  ensureNocodeFormCss()
  const { contentDiv, editorBody } = deps
  let data = deps.data
  let uid = deps.uid
  let paintTimer = 0
  let rebuildTimer = 0
  /** 直近に描いた本文（CSSだけの変化を見分ける） */
  let lastBody = ''
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

  /** 部品の1つの値を書いて、入力欄と見え方をそろえる（選択枠のつまみから） */
  const commitField = (path: Path, key: string, value: number): void => {
    data = setAt(data, [...path, key], value)
    form.setData(data)
    paint()
  }

  /**
   * 部品の選択枠に付けるつまみ（Canva風・第2弾）。
   * 画像・図形＝幅%（右の辺）、余白＝高さ（下の辺）、見出し・文章＝文字の大きさ（右下の角）。
   * 動かしている間は要素の style だけ変え（軽い）、離したら設定データへ書いて描き直す
   */
  const blockHandles = (blockEl: HTMLElement, screenIndex: number, blockIndex: number): SelectionHandle[] => {
    const el = blockEl // eslint-safe alias（no-param-reassign 回避。動かしている間は style を直に書く）
    const path: Path = ['screens', screenIndex, 'blocks', blockIndex]
    const block = (): ItemData => blockAt(screenIndex, blockIndex) ?? {}
    const pct = (): number => el.clientWidth / 100 || 1
    switch (str(block(), 'type')) {
      case 'image':
        return [
          {
            kind: 'width',
            label: '幅',
            unit: '%',
            range: { min: 10, max: 100, step: 1 },
            read: () => int(block(), 'width', 10, 100, 100),
            pxPerUnit: pct,
            preview: (n) => {
              const img = el.querySelector<HTMLElement>('img')
              if (img !== null) img.style.width = `${n}%`
            },
            commit: (n) => commitField(path, 'width', n),
          },
        ]
      case 'shape':
        return [
          {
            kind: 'width',
            label: '幅',
            unit: '%',
            range: { min: 10, max: 100, step: 1 },
            read: () => int(block(), 'size', 10, 100, 100),
            pxPerUnit: () => (el.parentElement?.clientWidth ?? el.clientWidth) / 100 || 1,
            preview: (n) => {
              el.style.width = `${n}%`
            },
            commit: (n) => commitField(path, 'size', n),
          },
        ]
      case 'spacer':
        return [
          {
            kind: 'height',
            label: '高さ',
            unit: 'px',
            range: { min: 0, max: 160, step: 1 },
            read: () => sizeOf(block(), 'size', SPACER_SIZES, 0, 160, 32),
            pxPerUnit: () => 1,
            preview: (n) => {
              el.style.height = `${n}px`
            },
            commit: (n) => commitField(path, 'size', n),
          },
        ]
      case 'heading':
      case 'text': {
        const isHeading = str(block(), 'type') === 'heading'
        return [
          {
            kind: 'font',
            label: '文字の大きさ',
            unit: 'px',
            range: isHeading ? { min: 12, max: 48, step: 1 } : { min: 10, max: 24, step: 0.5 },
            read: () => (isHeading ? sizeOf(block(), 'size', HEADING_SIZES, 12, 48, 21) : sizeOf(block(), 'size', TEXT_SIZES, 10, 24, 15)),
            pxPerUnit: () => 3,
            preview: (n) => {
              el.style.fontSize = `${n}px`
            },
            commit: (n) => commitField(path, 'size', n),
          },
        ]
      }
      default:
        return []
    }
  }

  /** Widget全体（何も選んでいないとき）: 上下の辺で上下の余白 */
  const rootHandles = (root: HTMLElement): SelectionHandle[] =>
    (['padTop', 'padBottom'] as const).map((kind) => ({
      kind,
      label: kind === 'padTop' ? '上の余白' : '下の余白',
      unit: 'px',
      range: { min: 0, max: 120, step: 1 },
      read: () => sizeOf(data, 'padding', BUILDER_PADDING, 0, 120, 40),
      pxPerUnit: () => 1,
      preview: (n) => {
        root.style.paddingTop = `${n}px`
        root.style.paddingBottom = `${n}px`
      },
      commit: (n) => commitField([], 'padding', n),
    }))

  /** 左の選択枠を、右で選んでいる部品に合わせる（何も選んでいなければ Widget全体を薄い枠で） */
  const showSelection = (): void => {
    const blockIndex = form.selectedBlock()
    const root = contentDiv.querySelector<HTMLElement>('.nc-builder')
    if (blockIndex === null) {
      if (root === null) selection.select(null)
      else selection.select(root, 'Widget全体（上下の辺で余白）', rootHandles(root), { soft: true })
      return
    }
    const screenIndex = form.activeScreen()
    const el = blockElementAt(data, contentDiv, screenIndex, blockIndex)
    const block = blockAt(screenIndex, blockIndex)
    selection.select(el, block === undefined ? '' : blockLabel(str(block, 'type')), el === null ? [] : blockHandles(el, screenIndex, blockIndex))
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
    deps.setPreviewCss(css)
    // CSSだけの変化（カードのスライダーなど）は中身を入れ替えない（要素が入れ替わると、開いているカードや選択枠がずれる）
    if (body === lastBody) {
      selection.refresh()
      return
    }
    lastBody = body
    contentDiv.innerHTML = body
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
    blockElement: (screenIndex, blockIndex) => blockElementAt(data, contentDiv, screenIndex, blockIndex),
    onInnerSelected: (node, label, handles) => selection.select(node, label, handles),
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
    if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
      event.preventDefault()
      if (MULTILINE.has(type)) document.execCommand('insertLineBreak')
      return
    }
    if (event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop') {
      // 貼り付けは素の文字だけ（外のページの飾りやタグを持ち込まない）
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

  /** 見本の部品の入力欄を読み直す（打っている途中なら、手が離れてから） */
  const scheduleRebuild = (): void => {
    window.clearTimeout(rebuildTimer)
    rebuildTimer = window.setTimeout(() => {
      const active = document.activeElement
      if (active !== null && panel.contains(active)) {
        scheduleRebuild()
        return
      }
      form.rebuild()
    }, REBUILD_DELAY_MS)
  }

  contentDiv.addEventListener('input', (event) => {
    // 道具が変えた要素（添えてある）か、いま文字を打っている所
    const changed = canvasEditTarget(event)
    const el = changed !== undefined ? outermostBlock(changed, contentDiv) : (selectionBlock()?.el ?? null)
    if (el === null) return
    const synced = syncCanvasBlock(data, el, contentDiv)
    if (synced === null) return
    data = synced.data
    form.setData(data)
    selection.refresh()
    // 見本の部品の入力欄は中身から作っているので、少し待ってから読み直す
    if (str(synced.block, 'type') === 'sample') scheduleRebuild()
  })

  const onCanvasClick = (target: EventTarget | null): void => {
    const el = outermostBlock(target, contentDiv)
    const place = el === null ? null : placeOf(el)
    if (el === null || place === null) {
      form.select(form.activeScreen(), null)
      return
    }
    const inner = target instanceof HTMLElement ? target : target instanceof Node ? target.parentElement : null
    // 見本の部品の中を押したら、その要素のカードも開く（左の選択枠はその要素に合う）
    if (str(place.block, 'type') === 'sample' && inner !== null && inner !== el && el.contains(inner)) {
      form.selectInside(place.screenIndex, place.blockIndex, inner)
      return
    }
    form.select(place.screenIndex, place.blockIndex)
  }

  const toolScope = (el: Element): boolean => {
    const block = outermostBlock(el, contentDiv)
    if (block === null || block === el) return false
    const place = placeOf(block)
    return place !== null && str(place.block, 'type') === 'sample'
  }

  const rendered = (): string => embedBuilderData(BUILDER_TEMPLATE.render(data, uid), data)

  /**
   * 最初の描画。部品が1つだけ（見本1つとして開いたWidget など）なら、その部品を開いておく
   * （以前の画面のように、開いた直後から中身の欄が見える）
   */
  const start = (): void => {
    paint()
    const screens = items(data, 'screens')
    if (screens.length === 1 && items(screens[0] ?? {}, 'blocks').length === 1) form.select(0, 0)
  }

  return {
    panel,
    start,
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
    currentCode: () => {
      const { css, body } = splitStyles(rendered())
      return { html: body, css }
    },
    onCanvasClick,
    toolScope,
    suggestName: () => suggestBuilderName(data),
    rekey: () => {
      uid = newUid()
      lastBody = ''
      paint()
    },
  }
}
