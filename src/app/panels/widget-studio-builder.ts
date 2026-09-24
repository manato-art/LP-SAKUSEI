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
import { getAt, moveTo, setAt, type Path } from './nocode/form-state.ts'
import { ensureNocodeFormCss } from './nocode/nocode-form-css.ts'
import { buildTemplateForm } from './nocode/template-form.ts'
import { BUILDER_PADDING, BUILDER_TEMPLATE } from './nocode/templates/builder.ts'
import { ALIGNS, HEADING_SIZES, PLACES, SPACER_SIZES, TEXT_SIZES, blockLabel, sizeOf, widthKeyOf, type Place } from './nocode/templates/builder-blocks.ts'
import { newUid } from './nocode/templates/kit.ts'
import { int, items, pick, str, type ItemData, type TemplateData } from './nocode/templates/types.ts'
import { placeGuideX, placeLeft, snapPlace, snapThreshold, widthGuideXs, widthSnaps } from './drag-math.ts'
import { contentBoxOf, createSelectionLayer, type SelectionHandle, type SelectionMove, type SnapPoint } from './selection-layer.ts'
import type { AlignTarget } from './align-menu.ts'
import { openSizePopover } from './size-popover.ts'
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
  /** 見本の部品: いつもの見本の一覧から見本を選んでもらう（やめたら null）。無い画面（ポップアップ）では見本を選ばせない */
  readonly pickSample?: () => Promise<{ title: string; html: string } | null>
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
  /** 上のツールバーの「配置 ⌄」で変える、選んだ部品の置く位置・文字の寄せ（受け持たないときは null） */
  readonly alignTarget: () => AlignTarget | null
  /** 上のツールバーの「サイズ」。選んだ部品の幅と置く位置の小窓を出す。受け持ったら true */
  readonly onSizeButton: (anchor: HTMLElement) => boolean
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

/** 部品が1つも無いときの左の案内 */
function emptyHint(): HTMLElement {
  const hint = document.createElement('div')
  hint.dataset['widgetEmpty'] = 'true'
  hint.setAttribute('contenteditable', 'false')
  hint.textContent = '右の「何から作りますか？」から選ぶか、「部品を足す」で部品を積むと、ここに出ます'
  hint.style.cssText =
    `margin:24px 16px;padding:40px 16px;border:1.5px dashed #C9CFD6;border-radius:10px;text-align:center;` +
    `color:#6B7480;font:14px/1.8 ${FONT};user-select:none`
  return hint
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

  /**
   * 動かしている間だけ要素に直に当てた見た目（幅・余白・高さ・文字の大きさ）。
   * 描き直すときに必ず外す（CSSだけの変化では要素を入れ替えないので、外さないと古い見た目が勝ち続ける）
   */
  const previewed = new Set<HTMLElement>()
  const PREVIEW_PROPS = ['width', 'height', 'font-size', 'padding-top', 'padding-bottom', 'transform'] as const
  const clearPreviews = (): void => {
    for (const el of previewed) for (const prop of PREVIEW_PROPS) el.style.removeProperty(prop)
    previewed.clear()
  }

  /** 部品の1つの値を書いて、入力欄と見え方をそろえる（選択枠のつまみ・ツールバー・大きさの小窓から） */
  const commitField = (path: Path, key: string, value: number | string): void => {
    data = setAt(data, [...path, key], value)
    form.setData(data)
    paint()
  }

  /** 部品の場所 */
  const pathOf = (screenIndex: number, blockIndex: number): Path => ['screens', screenIndex, 'blocks', blockIndex]

  /** 枠を合わせる要素（画像・動画は中の絵そのもの。ほかは部品の外枠） */
  const frameTarget = (el: HTMLElement, type: string): HTMLElement => {
    if (type === 'image') return el.querySelector<HTMLElement>('img') ?? el
    if (type === 'video') return el.querySelector<HTMLElement>('video') ?? el
    return el
  }

  /** 部品の幅（%）と置く位置 */
  const widthOf = (block: ItemData): number => {
    const key = widthKeyOf(str(block, 'type'))
    return key === null ? 100 : int(block, key, 10, 100, 100)
  }
  const placeOf2 = (block: ItemData): Place => pick(block, 'place', PLACES, 'center')

  /** 同じ画面のほかの部品の、枠を合わせる要素（補助線でそろえる相手） */
  const otherTargets = (screenIndex: number, exceptIndex: number): HTMLElement[] =>
    items(items(data, 'screens')[screenIndex] ?? {}, 'blocks').flatMap((block, index) => {
      if (index === exceptIndex) return []
      const el = blockElementAt(data, contentDiv, screenIndex, index)
      return el === null ? [] : [frameTarget(el, str(block, 'type'))]
    })

  /**
   * 幅のつまみの吸い付き先: ほかの部品の左右の端に辺がそろう幅と、よく使う幅（25/50/75/100%）。
   * 補助線は Widget の上から下まで、自分の辺（中央に置いた部品は両側の辺）に引く
   */
  const widthSnapPoints = (target: HTMLElement, place: Place, screenIndex: number, blockIndex: number): SnapPoint[] => {
    const box = contentBoxOf(target.parentElement ?? target)
    const area = contentDiv.getBoundingClientRect()
    const edges = otherTargets(screenIndex, blockIndex).flatMap((other) => {
      const r = other.getBoundingClientRect()
      return r.width > 0 ? [r.left, r.right] : []
    })
    return widthSnaps(place, box, edges, { min: 10, max: 100 }).map((value) => ({
      value,
      lines: widthGuideXs(value, place, box).map((x) => ({ x, top: area.top, bottom: area.bottom })),
    }))
  }

  /**
   * 部品の選択枠に付けるつまみ（Canva風）。
   * どの部品も幅%（右の辺。右に置いた部品は左の辺）。余白＝高さ（下の辺）、見出し・文章＝文字の大きさ（右下の角）。
   * 動かしている間は要素の style だけ変え（軽い）、離したら設定データへ書いて描き直す
   */
  const blockHandles = (blockEl: HTMLElement, screenIndex: number, blockIndex: number): SelectionHandle[] => {
    const el = blockEl // eslint-safe alias（no-param-reassign 回避。動かしている間は style を直に書く）
    const path = pathOf(screenIndex, blockIndex)
    const block = (): ItemData => blockAt(screenIndex, blockIndex) ?? {}
    const type = str(block(), 'type')
    const handles: SelectionHandle[] = []
    const key = widthKeyOf(type)
    if (key !== null) {
      const target = frameTarget(el, type)
      const place = placeOf2(block())
      handles.push({
        kind: place === 'right' ? 'widthLeft' : 'width',
        label: '幅',
        unit: '%',
        range: { min: 10, max: 100, step: 1 },
        read: () => widthOf(block()),
        // 幅%は親の中身（padding の内側）に対して。中央に置いた部品は両側へ広がるので、手の動きの2倍ぶん幅が変わる
        pxPerUnit: () => {
          const box = contentBoxOf(target.parentElement ?? el)
          return ((box.right - box.left) / 100 || 1) / (place === 'center' ? 2 : 1)
        },
        preview: (n) => {
          previewed.add(target)
          target.style.width = `${n}%`
        },
        commit: (n) => commitField(path, key, n),
        snaps: () => widthSnapPoints(target, place, screenIndex, blockIndex),
      })
    }
    if (type === 'spacer') {
      handles.push({
        kind: 'height',
        label: '高さ',
        unit: 'px',
        range: { min: 0, max: 160, step: 1 },
        read: () => sizeOf(block(), 'size', SPACER_SIZES, 0, 160, 32),
        pxPerUnit: () => 1,
        preview: (n) => {
          previewed.add(el)
          el.style.height = `${n}px`
        },
        commit: (n) => commitField(path, 'size', n),
      })
    }
    if (type === 'heading' || type === 'text') {
      const isHeading = type === 'heading'
      handles.push({
        kind: 'font',
        label: '文字の大きさ',
        unit: 'px',
        range: isHeading ? { min: 12, max: 48, step: 1 } : { min: 10, max: 24, step: 0.5 },
        read: () => (isHeading ? sizeOf(block(), 'size', HEADING_SIZES, 12, 48, 21) : sizeOf(block(), 'size', TEXT_SIZES, 10, 24, 15)),
        pxPerUnit: () => 3,
        preview: (n) => {
          previewed.add(el)
          el.style.fontSize = `${n}px`
        },
        commit: (n) => commitField(path, 'size', n),
      })
    }
    return handles
  }

  /**
   * 部品ごと動かす（つかみ所・部品そのものをつかんだとき）。部品は手について動く（見た目だけ translate）。
   * 左右: 左・中央・右に近づくと吸い付いてピンクの補助線（Alt・option を押していれば吸い付かない）。
   * 離すと一番近い位置に収まる（収まる所は点線の影で見せる）。
   * 幅が100%の部品は横に動かない。
   * 上下: ほかの部品の間に入れる（部品の真ん中がどこまで来たか。入る所に線を出す）。離したら設定データへ書く
   */
  const blockMove = (blockEl: HTMLElement, screenIndex: number, blockIndex: number): SelectionMove => {
    const type = str(blockAt(screenIndex, blockIndex) ?? {}, 'type')
    const target = frameTarget(blockEl, type)
    // 置く位置は動かし始めた時点の値（ツールバーや小窓で変えたあとでも、今の値から始める）
    const nowPlace = (): Place => placeOf2(blockAt(screenIndex, blockIndex) ?? {})
    const canPlace = widthKeyOf(type) !== null
    let startPlace = nowPlace()
    let place = startPlace
    let insertAt = blockIndex
    /** 動かし始めたときの四角（動かしている間は translate が乗るので、最初に測っておく）。null＝まだ動かしていない */
    let from: { target: DOMRect; block: DOMRect } | null = null
    /** この画面の部品の要素（自分を除く並び・元の番号つき） */
    const others = (): { el: HTMLElement; index: number }[] =>
      items(items(data, 'screens')[screenIndex] ?? {}, 'blocks')
        .map((_, index) => ({ el: blockElementAt(data, contentDiv, screenIndex, index), index }))
        .filter((o): o is { el: HTMLElement; index: number } => o.el !== null && o.index !== blockIndex)
    /** 自分より前にある部品の数（並びを変えていなければ、入る位置はこれ） */
    const originalAt = (list: readonly { index: number }[]): number => list.filter((o) => o.index < blockIndex).length
    const PLACE_WORDS: Readonly<Record<Place, string>> = { left: '左に置く', center: '中央に置く', right: '右に置く' }
    const finish = (): void => {
      from = null
      selection.dropLine(null)
      selection.guides([])
      selection.ghost(null)
      clearPreviews()
    }
    return {
      update: ({ x, y, startX, startY, isFree }) => {
        if (from === null) {
          startPlace = nowPlace()
          place = startPlace
          target.style.removeProperty('transform')
          from = { target: target.getBoundingClientRect(), block: blockEl.getBoundingClientRect() }
        }
        const start = from.target
        const box = contentBoxOf(target.parentElement ?? blockEl)
        const area = contentDiv.getBoundingClientRect()
        // 横: 手の位置のまま。左・中央・右に近づいたら吸い付く
        let left = start.left
        let snapped = false
        const movable = canPlace && box.right - box.left - start.width >= 1
        if (movable) {
          const snap = snapPlace(start.left + x - startX, start.width, box, snapThreshold(isFree))
          place = snap.side
          left = snap.left
          snapped = snap.snapped
        }
        previewed.add(target)
        target.style.transform = `translate(${left - start.left}px,${y - startY}px)`
        // 上下: 動かしている部品の真ん中より上に真ん中がある部品の数＝入る位置
        // （手の位置でなく部品の真ん中で見る。つかみ所は部品の上の辺にあるので、手の位置だと動かす前から上の部品を越えてしまう）
        const middle = from.block.top + from.block.height / 2 + (y - startY)
        const list = others()
        insertAt = list.filter((o) => {
          const r = o.el.getBoundingClientRect()
          return r.top + r.height / 2 < middle
        }).length
        const reorder = insertAt !== originalAt(list)
        if (reorder) {
          const anchor = list[insertAt]?.el.getBoundingClientRect()
          const last = list[list.length - 1]?.el.getBoundingClientRect()
          const lineY = anchor !== undefined ? anchor.top - 6 : (last?.bottom ?? from.block.bottom) + 6
          selection.dropLine({ y: lineY, left: area.left + 8, width: area.width - 16 })
        } else {
          selection.dropLine(null)
        }
        selection.guides(movable && snapped ? [{ x: placeGuideX(place, box), top: area.top, bottom: area.bottom }] : [])
        // 吸い付いていないときは、離したら収まる所を点線の影で見せる（並びを変えるときは線の方で見せる）
        selection.ghost(
          movable && !snapped && !reorder
            ? { left: placeLeft(place, start.width, box), top: start.top, width: start.width, height: start.height }
            : null,
        )
        const words: string[] = []
        if (movable && place !== startPlace) words.push(PLACE_WORDS[place])
        if (reorder) words.push('ここへ移す')
        return words.join('・')
      },
      commit: () => {
        if (from === null) return
        finish()
        const list = others()
        let next = data
        if (canPlace && place !== startPlace) next = setAt(next, [...pathOf(screenIndex, blockIndex), 'place'], place)
        if (insertAt !== originalAt(list)) {
          next = moveTo(next, ['screens', screenIndex, 'blocks'], blockIndex, insertAt)
          form.load(next, screenIndex, insertAt)
          return
        }
        if (next === data) {
          showSelection()
          return
        }
        data = next
        form.setData(data)
        paint()
      },
      cancel: () => {
        // 動かす前に離した（ただ押しただけ）なら何もしない
        if (from === null) return
        finish()
        showSelection()
      },
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
        previewed.add(root)
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
    if (el === null || block === undefined) {
      selection.select(null)
      return
    }
    const type = str(block, 'type')
    selection.select(frameTarget(el, type), blockLabel(type), blockHandles(el, screenIndex, blockIndex), {
      move: blockMove(el, screenIndex, blockIndex),
    })
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
    clearPreviews()
    // CSSだけの変化（カードのスライダーなど）は中身を入れ替えない（要素が入れ替わると、開いているカードや選択枠がずれる）。
    // 枠とつまみは今の値で作り直す（置く位置で幅のつまみの側が変わる）
    if (body === lastBody) {
      showSelection()
      return
    }
    lastBody = body
    contentDiv.innerHTML = body
    runWidgetScripts(contentDiv)
    markNonEditable()
    // 部品が1つも無いときは、左に案内を出す（見たまま画面の中身は保存しないので、置いてよい）
    if (items(data, 'screens').every((s) => items(s, 'blocks').length === 0)) contentDiv.append(emptyHint())
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
    ...(deps.pickSample === undefined ? {} : { pickSample: deps.pickSample }),
    onPreviewOverride: (key, path, html) => {
      if (html === null) previewOverrides.delete(key)
      else previewOverrides.set(key, { path, html })
      schedulePaint()
    },
    onPreviewReset: () => previewOverrides.clear(),
    tabsHost: deps.tabsHost,
    // 白紙のときの「何から作りますか？」に出す例
    examples: [
      {
        label: 'アンケートの例',
        summary: '質問に答えると画面②へ進む、2画面の例です。中身を直して使えます',
        icon: BUILDER_TEMPLATE.icon,
        data: () => BUILDER_TEMPLATE.defaults(new Date()),
      },
    ],
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

  /** つかんで動かした直後の click（離したときに出る）は、選び直しに使わない */
  let suppressClickUntil = 0

  const onCanvasClick = (target: EventTarget | null): void => {
    if (Date.now() < suppressClickUntil) return
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

  /* ── マウスを乗せた部品に薄い枠（どれを触るか、押す前に分かる） ── */
  contentDiv.addEventListener('mousemove', (event) => {
    const el = outermostBlock(event.target, contentDiv)
    const place = el === null ? null : placeOf(el)
    if (el === null || place === null) {
      selection.hover(null)
      return
    }
    selection.hover(frameTarget(el, str(place.block, 'type')), blockLabel(str(place.block, 'type')))
  })
  contentDiv.addEventListener('mouseleave', () => selection.hover(null))

  /*
   * 文字を打つ部品以外（画像・動画・図形・余白・区切り線・型の部品）は、部品そのものをつかんで動かせる
   * （少し動かすと動き出す。そのまま離せば、ただ選ぶだけ）。文字の部品・見本は、つかみ所（枠の上のまん中）で動かす
   */
  const DIRECT_MOVE: ReadonlySet<string> = new Set(['image', 'video', 'shape', 'spacer', 'divider'])
  contentDiv.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey) return
    const el = outermostBlock(event.target, contentDiv)
    const place = el === null ? null : placeOf(el)
    if (el === null || place === null) return
    const type = str(place.block, 'type')
    if (!DIRECT_MOVE.has(type) && !type.startsWith('tpl-')) return
    if (form.selectedBlock() !== place.blockIndex) form.select(place.screenIndex, place.blockIndex)
    const move = blockMove(el, place.screenIndex, place.blockIndex)
    selection.startMove(event, {
      update: move.update,
      commit: (x, y) => {
        suppressClickUntil = Date.now() + 400
        move.commit(x, y)
      },
      cancel: move.cancel,
    })
  })
  // 画像を掴んだときにブラウザが画像そのものを運ぼうとするのを止める（部品の位置は上で動かす）
  contentDiv.addEventListener('dragstart', (event) => event.preventDefault())

  /**
   * 上のツールバーの「配置 ⌄」で変えるもの（見出し・文章は文字の寄せ、ほかは置く位置）。
   * 見本の中・何も選んでいない・幅の無い部品（余白）は null＝選んだ文字の寄せ
   */
  const alignTarget = (): AlignTarget | null => {
    const blockIndex = form.selectedBlock()
    if (blockIndex === null) return null
    const screenIndex = form.activeScreen()
    const block = blockAt(screenIndex, blockIndex)
    if (block === undefined) return null
    const type = str(block, 'type')
    const path = pathOf(screenIndex, blockIndex)
    if (type === 'heading' || type === 'text') {
      return { kind: 'text', value: pick(block, 'align', ALIGNS, 'left'), set: (v) => commitField(path, 'align', v) }
    }
    if (type === 'sample' || widthKeyOf(type) === null) return null
    return { kind: 'place', value: placeOf2(block), set: (v) => commitField(path, 'place', v) }
  }

  /** 上のツールバーの「サイズ」（選んだ部品の幅と置く位置の小窓）。見本の中・何も選んでいないときは受け持たない */
  const onSizeButton = (anchor: HTMLElement): boolean => {
    const blockIndex = form.selectedBlock()
    if (blockIndex === null) return false
    const screenIndex = form.activeScreen()
    const block = blockAt(screenIndex, blockIndex)
    if (block === undefined || str(block, 'type') === 'sample') return false
    const key = widthKeyOf(str(block, 'type'))
    if (key === null) return false
    const path = pathOf(screenIndex, blockIndex)
    openSizePopover(anchor, {
      width: widthOf(block),
      place: placeOf2(block),
      onWidth: (n) => commitField(path, key, n),
      onPlace: (p) => commitField(path, 'place', p),
    })
    return true
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
    alignTarget,
    onSizeButton,
    suggestName: () => suggestBuilderName(data),
    rekey: () => {
      uid = newUid()
      lastBody = ''
      paint()
    },
  }
}
