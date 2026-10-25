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
import { blockElementAt, canvasPlaceOf, isTextEditableBlock, outermostBlock, syncCanvasBlock, visibleScreenPath } from './nocode/canvas-sync.ts'
import { getAt, setAt, type Path } from './nocode/form-state.ts'
import { ensureNocodeFormCss } from './nocode/nocode-form-css.ts'
import { buildTemplateForm } from './nocode/template-form.ts'
import { coveredIndexOf, hotspotRect, isFloating, isHotspot, isRider, moveGroupBefore } from './nocode/hotspot-model.ts'
import { floatOffset, setFloating } from './nocode/float-model.ts'
import { MORE_PREVIEW_CSS } from './nocode/templates/builder-blocks-more-render.ts'
import { BUILDER_PADDING, BUILDER_TEMPLATE } from './nocode/templates/builder.ts'
import {
  BUTTON_DEFAULT_HEIGHT,
  BUTTON_HEIGHT_RANGE,
  HEADING_SIZES,
  PLACES,
  SPACER_SIZES,
  TEXT_SIZES,
  blockLabel,
  sizeOf,
  widthKeyOf,
  type Place,
} from './nocode/templates/builder-blocks.ts'
import { newUid } from './nocode/templates/kit.ts'
import { int, items, pick, str, type ItemData, type TemplateData } from './nocode/templates/types.ts'
import { placeGuideX, placeLeft, snapPlace, snapThreshold, widthGuideXs, widthSnaps } from './drag-math.ts'
import { contentBoxOf, createSelectionLayer, type SelectionAction, type SelectionHandle, type SelectionMove, type SnapPoint } from './selection-layer.ts'
import { canvasEditTarget } from './widget-canvas-events.ts'
import { FONT } from './widget-editor-theme.ts'
import { runWidgetScripts } from './widget-run-scripts.ts'
import { attachBlockDrop } from './widget-studio-drop.ts'
import { attachPartKeys, type CanvasPart } from './widget-studio-delete-key.ts'
import { emptyHint, suggestBuilderName } from './widget-studio-helpers.ts'
import { createPartOps } from './widget-studio-part-ops.ts'
import { attachUndoKeys, createHistory } from './widget-studio-history.ts'
import { dataWithEditedCode, editableCodeOf, type EditableCode } from './nocode/whole-code.ts'
import { askSurveyData, askWholeSample } from './widget-studio-survey.ts'
import type { PickedSample } from './nocode/nocode-flow.ts'
import { createToolbarHooks, type ToolbarHooks } from './widget-studio-toolbar.ts'
import { hotspotHandles, hotspotMove, markEmptyHotspotHosts, type HotspotEditDeps } from './widget-studio-hotspot.ts'
import { floatMove, type FloatEditDeps } from './widget-studio-float.ts'
import { bgSurfaceOf, refitBgImages, startBgMove, withBgLook, type BgMoveSession } from './widget-studio-bg-move.ts'
import { bgLookOf } from './nocode/templates/bg-image.ts'

export interface BuilderSessionDeps {
  readonly data: TemplateData
  readonly uid: string
  readonly contentDiv: HTMLElement
  readonly editorBody: HTMLElement
  readonly setPreviewCss: (css: string) => void
  /** 画面①②…のタブを置く所（右側のいちばん上） */
  readonly tabsHost: HTMLElement
  /**
   * 部品の並びと「部品を足す」を置く所（2026-09-24 画面の作り直し＝左の列）。
   * 「部品を足す」からドラッグで運ぶと、見たまま画面（editorBody）が受け取って入れる
   */
  readonly partsHost?: { readonly list: HTMLElement; readonly palette: HTMLElement }
  /** 見本の部品: いつもの見本の一覧から見本を選んでもらう（やめたら null）。無い画面（ポップアップ）では見本を選ばせない */
  readonly pickSample?: () => Promise<PickedSample | null>
  /** 戻す・やり直すで中身が入れ替わったあと（開いているコード欄を今の中身に読み直す） */
  readonly onRestore?: () => void
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
  /** コード欄に出すコード（「コードの部品」1つだけならその部品のコード、ほかは全体＝whole-code.ts） */
  readonly editableCode: () => EditableCode
  /**
   * コード欄で直したコードを入れる（2026-10-18 本人「コード上でも修正・変更できるようにして」）。
   * 部品で組み立てたWidgetは全体が「コードの部品」1つになる（名前＝CSSのクラスも付け直す。中の古い名前とまざらない）。
   * 「戻す」で戻せる
   */
  readonly applyCode: (code: { html: string; css: string }) => void
  /** 見たまま画面を押した（部品を選ぶ。見本の部品の中なら、その中の要素も） */
  readonly onCanvasClick: (target: EventTarget | null) => void
  /** 左の道具（画像の操作パネル・リンクの吹き出し・並んだ部品の操作）を効かせてよい要素か＝見本の部品の中 */
  readonly toolScope: (el: Element) => boolean
  /** 上のツールバーのうち、部品で受け持つもの（配置・サイズ・文字の飾り・リンク・画像＝widget-studio-toolbar.ts） */
  readonly toolbar: ToolbarHooks
  /** 元に戻す・やり直す（部品の操作も含む。戻せなければ false＝widget-studio-history.ts） */
  readonly undo: () => boolean
  readonly redo: () => boolean
  /** 選んでいる部品を消す（上のツールバーの消しゴムで、文字を選んでいないとき）。消したら true */
  readonly removeSelected: () => boolean
  /** 登録の名前の初期値（「組み立てたWidget（最初の見出し）」） */
  readonly suggestName: () => string
  /** 登録したあと、次に入れる分の名前（CSSのクラス）を付け直す（同じLPに並んでも色がまざらない） */
  readonly rekey: () => void
}

/**
 * 空の見出し・文章は高さ0で見えない（部品を足す・ドラッグで入れても、どこに入ったか分からない）。
 * 見たまま画面だけ、薄い字で入れる物を出す（プレビューのCSSにだけ足す。保存する中身には入らない）
 */
const EMPTY_PLACEHOLDER_CSS =
  // [data-nc-empty] は、移行先だけが入っている空の部品（widget-studio-hotspot.ts の markEmptyHotspotHosts）
  '.nc-b-heading:empty::before,.nc-b-heading[data-nc-empty]::before{content:"見出しを入れてください";opacity:.35}' +
  '.nc-b-text:empty::before,.nc-b-text[data-nc-empty]::before{content:"文章を入れてください";opacity:.35}' +
  // 画像・動画は、まだ選んでいないと何も出ない → 灰色の箱に「選んでください」
  '.nc-b-image:empty,.nc-b-video:empty,.nc-b-image[data-nc-empty],.nc-b-video[data-nc-empty]{min-height:120px;display:flex;' +
  'align-items:center;justify-content:center;background:#EEF0F3;border-radius:8px;color:#5F6673;font-size:13px}' +
  '.nc-b-image:empty::before,.nc-b-image[data-nc-empty]::before{content:"画像を選んでください（右の設定から）"}' +
  '.nc-b-video:empty::before,.nc-b-video[data-nc-empty]::before{content:"動画を選んでください（右の設定から）"}' +
  // 画像と文章: 画像の欄は灰色の箱、文章は薄い字
  '.nc-b-imageText__img:empty{min-height:90px;background:#EEF0F3;border-radius:8px}' +
  '.nc-b-imageText__text:empty::before{content:"文章を入れてください";opacity:.35}'

/** 打つたびに見え方を描き直すと重いので、手が止まってから描く */
const PAINT_DELAY_MS = 250
/** 見本の部品を左で直したあと、右の入力欄を読み直すまでの待ち */
const REBUILD_DELAY_MS = 600

/** 改行を入れられる部品（見出し・ボタンの文字は1行） */
const MULTILINE: ReadonlySet<string> = new Set(['text', 'list', 'imageText'])

/** 1画面に置ける部品の数（「画面と部品」の欄の決まり） */
const BUILDER_BLOCK_MAX = ((f) => (f?.kind === 'screens' ? f.blockMax : 30))(BUILDER_TEMPLATE.fields.find((f) => f.kind === 'screens'))

export function createBuilderSession(deps: BuilderSessionDeps): BuilderSession {
  ensureNocodeFormCss()
  const { contentDiv, editorBody } = deps
  let data = deps.data
  /** 元に戻す・やり直す（中身の変わり目を順に覚える。戻している間は覚えない） */
  const history = createHistory(deps.data, { mergeMs: 700, limit: 100 })
  const track = (): void => history.record(data)
  let restoring = false
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
  panel.style.cssText = `flex:1;min-height:0;overflow-y:auto;padding:12px 16px 28px;background:var(--sb-c-ffffff, #FFFFFF);box-sizing:border-box;font-family:${FONT}`

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
  /**
   * 見たまま画面の部品の要素から、その部品の場所。いま開いている画面でなくても見つける
   * （積み重ねの出方を ⌘＋クリックで試すと、ほかの画面も見たまま画面に出る。そこを押しても選べなかった・2026-10-24）
   */
  const placeOf = (el: HTMLElement): { screenIndex: number; blockIndex: number; block: ItemData } | null => {
    const place = canvasPlaceOf(data, contentDiv, el)
    if (place === null) return null
    const block = items(items(data, 'screens')[place.screenIndex] ?? {}, 'blocks')[place.blockIndex]
    return block === undefined ? null : { ...place, block }
  }
  /** いま選んでいる部品か（画面も同じ） */
  const isSelectedPlace = (place: { screenIndex: number; blockIndex: number }): boolean =>
    place.screenIndex === form.activeScreen() && place.blockIndex === form.selectedBlock()

  /**
   * 動かしている間だけ要素に直に当てた見た目（幅・余白・高さ・文字の大きさ）。
   * 描き直すときに必ず外す（CSSだけの変化では要素を入れ替えないので、外さないと古い見た目が勝ち続ける）
   */
  const previewed = new Set<HTMLElement>()
  const PREVIEW_PROPS = ['width', 'height', 'min-height', 'font-size', 'padding-top', 'padding-bottom', 'transform', 'left', 'right', 'top'] as const
  const clearPreviews = (): void => {
    for (const el of previewed) for (const prop of PREVIEW_PROPS) el.style.removeProperty(prop)
    previewed.clear()
  }

  /** 部品の1つの値を書いて、入力欄と見え方をそろえる（選択枠のつまみ・ツールバー・大きさの小窓から） */
  const commitField = (path: Path, key: string, value: number | string): void => {
    data = setAt(data, [...path, key], value)
    track()
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
    // ボタンの高さ（下の辺・2026-10-25 本人「ボタンの縦の大きさも変えたい」）。押す所（.nc-b-button__a）の高さを変える
    if (type === 'button') {
      const face = el.querySelector<HTMLElement>('.nc-b-button__a') ?? el
      const look = str(block(), 'look') === 'choice' ? 'choice' : 'cta'
      handles.push({
        kind: 'height',
        label: '高さ',
        unit: 'px',
        range: { ...BUTTON_HEIGHT_RANGE, step: 1 },
        read: () => {
          const value = block()['height']
          return typeof value === 'number' ? value : BUTTON_DEFAULT_HEIGHT[look]
        },
        pxPerUnit: () => 1,
        preview: (n) => {
          previewed.add(face)
          face.style.minHeight = `${n}px`
          face.style.paddingTop = '4px'
          face.style.paddingBottom = '4px'
        },
        commit: (n) => commitField(path, 'height', n),
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
    // 移行先・重ねた部品は土台に乗っているので、並びの目安にしない（部品は乗っている部品ごと動く）
    const others = (): { el: HTMLElement; index: number }[] =>
      items(items(data, 'screens')[screenIndex] ?? {}, 'blocks')
        .map((block, index) => ({ el: isRider(block) ? null : blockElementAt(data, contentDiv, screenIndex, index), index }))
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
          // 入る所の次の部品の前へ（無ければいちばん下）。被せた移行先も一緒に動く
          const listPath = ['screens', screenIndex, 'blocks']
          const blocks = items(items(next, 'screens')[screenIndex] ?? {}, 'blocks')
          const moved = moveGroupBefore(blocks, blockIndex, list[insertAt]?.index ?? blocks.length)
          if (moved === null) {
            showSelection()
            return
          }
          form.load(setAt(next, listPath, moved.list), screenIndex, moved.index)
          return
        }
        if (next === data) {
          showSelection()
          return
        }
        data = next
        track()
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

  /** 移行先を見たまま画面で直すときの、読み書き（位置と大きさは被せた部品に対する %） */
  const hotspotDeps = (screenIndex: number, blockIndex: number): HotspotEditDeps => ({
    selection,
    previewed,
    rect: () => hotspotRect(blockAt(screenIndex, blockIndex) ?? {}),
    commit: (next) => {
      const path = pathOf(screenIndex, blockIndex)
      for (const [key, value] of Object.entries(next)) data = setAt(data, [...path, key], value)
      track()
      form.setData(data)
      paint()
    },
  })

  /** 重ねた部品を見たまま画面で動かすときの、読み書き（土台に対する %） */
  const floatDeps = (screenIndex: number, blockIndex: number): FloatEditDeps => ({
    selection,
    previewed,
    offset: () => floatOffset(blockAt(screenIndex, blockIndex) ?? {}),
    commit: (next) => {
      const path = pathOf(screenIndex, blockIndex)
      data = setAt(setAt(data, [...path, 'floatX'], next.x), [...path, 'floatY'], next.y)
      track()
      form.setData(data)
      paint()
    },
  })

  /** 土台がある重ねた部品か（いちばん上で重ねた部品は、ふつうに並んでいる） */
  const isFloatingAt = (screenIndex: number, blockIndex: number): boolean => {
    const blocks = items(items(data, 'screens')[screenIndex] ?? {}, 'blocks')
    return isFloating(blocks[blockIndex]) && coveredIndexOf(blocks, blockIndex) !== null
  }

  /**
   * 選んだ部品の枠の右下に出すボタン（2026-10-18 本人「複製できるようにしたい。重ねたり左右上下に配置できるようにして」）。
   * 複製＝⌘D と同じ（乗っている部品ごと）。重ねる＝すぐ上の部品の上に浮かべる／やめる＝ふつうの並びに戻す（float-model.ts）。
   * 見本の中の要素を選んでいるときも、その見本の部品に効く
   */
  const blockActions = (screenIndex: number, blockIndex: number): SelectionAction[] => {
    const blocks = items(items(data, 'screens')[screenIndex] ?? {}, 'blocks')
    const block = blocks[blockIndex]
    if (block === undefined) return []
    const duplicate: SelectionAction = { label: '複製', title: '複製する（⌘D）', run: () => void partOps.duplicate() }
    if (isHotspot(block)) return [duplicate]
    const floating = isFloating(block)
    const canFloat = floating || coveredIndexOf(blocks, blockIndex) !== null
    const layer: SelectionAction = {
      label: floating ? '重ねるのをやめる' : '重ねる',
      title: floating
        ? 'ふつうの並びに戻す'
        : canFloat
          ? 'すぐ上の部品の上に重ねる（重ねたら、つかんで上下左右へ動かせる）'
          : 'いちばん上の部品は重ねられません（すぐ上に、重ねる土台の部品が要ります）',
      disabled: !canFloat,
      run: () => {
        const now = items(items(data, 'screens')[screenIndex] ?? {}, 'blocks')
        const changed = setFloating(now, blockIndex, !floating)
        if (changed === null || changed.list === now) return
        form.load(setAt(data, ['screens', screenIndex, 'blocks'], changed.list), screenIndex, changed.index)
      },
    }
    return [duplicate, layer]
  }

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
    if (isHotspot(block)) {
      const deps = hotspotDeps(screenIndex, blockIndex)
      selection.select(el, '移行先（つかんで動かす・四辺で大きさ）', hotspotHandles(el, deps), {
        move: hotspotMove(el, deps),
        actions: blockActions(screenIndex, blockIndex),
      })
      return
    }
    const actions = blockActions(screenIndex, blockIndex)
    // 重ねた部品は、つかんで上下左右どこへでも（土台に対する %）。幅などのつまみは、ふつうの部品と同じ
    if (isFloatingAt(screenIndex, blockIndex)) {
      selection.select(frameTarget(el, type), `${blockLabel(type)}（重ねた部品・つかんで上下左右へ）`, blockHandles(el, screenIndex, blockIndex), {
        move: floatMove(el, floatDeps(screenIndex, blockIndex)),
        actions,
      })
      return
    }
    selection.select(frameTarget(el, type), blockLabel(type), blockHandles(el, screenIndex, blockIndex), {
      move: blockMove(el, screenIndex, blockIndex),
      actions,
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
    // 積み重ねの出方を ⌘＋クリックで試して出ている画面は、部品を選んで描き直しても積み重ねたまま出す
    // （2026-10-25 本人「移行先の文言や色をそのまま直したい」）。開いている画面がその中に無ければ、その画面だけに戻す
    const shown = visibleScreenPath(contentDiv)
    const path = screen !== undefined && shown.length > 1 && shown.includes(screen) ? shown : null
    const html = BUILDER_TEMPLATE.render(previewData, uid, screen === undefined ? undefined : { screen, ...(path === null ? {} : { path }) })
    const { css, body } = splitStyles(html)
    deps.setPreviewCss(css + EMPTY_PLACEHOLDER_CSS + MORE_PREVIEW_CSS)
    clearPreviews()
    // CSSだけの変化（カードのスライダーなど）は中身を入れ替えない（要素が入れ替わると、開いているカードや選択枠がずれる）。
    // 枠とつまみは今の値で作り直す（置く位置で幅のつまみの側が変わる）
    if (body === lastBody) {
      // 自由な大きさの背景の画像は、配信のスクリプトが測って当てている（CSSだけ変わったので測り直してもらう）
      refitBgImages(contentDiv)
      showSelection()
      return
    }
    lastBody = body
    contentDiv.innerHTML = body
    runWidgetScripts(contentDiv)
    markNonEditable()
    markEmptyHotspotHosts(contentDiv)
    // 部品が1つも無いときは、左に案内を出す（見たまま画面の中身は保存しないので、置いてよい）
    if (items(data, 'screens').every((s) => items(s, 'blocks').length === 0)) contentDiv.append(emptyHint())
    showSelection()
  }
  const schedulePaint = (): void => {
    window.clearTimeout(paintTimer)
    paintTimer = window.setTimeout(paint, PAINT_DELAY_MS)
  }

  /** 背景の画像を動かしている間（終わるまで1つだけ） */
  let bgSession: BgMoveSession | null = null
  const hasParts = (): boolean => items(data, 'screens').some((screen) => items(screen, 'blocks').length > 0)
  /** 中身ごと入れ替える（form.load で「戻す」の履歴にも入る） */
  const loadWhole = (next: TemplateData, message: string): void => {
    form.load(next, 0, null)
    lastBody = ''
    paint()
    toast(message)
  }
  /**
   * ライブラリから見本を選ぶ。アンケートの見本（部品で作ったWidgetそのもの・2026-10-24）は部品の1つにせず、
   * 確かめてから Widget の中身ごと置き換える（受け取る側には何も渡さない＝部品は足さない）
   */
  const pickFromLibrary = deps.pickSample
  const pickSample =
    pickFromLibrary === undefined
      ? undefined
      : async (): Promise<PickedSample | null> => {
          const sample = await pickFromLibrary()
          if (sample === null || sample.isWholeWidget !== true) return sample
          askWholeSample(sample, hasParts()).then(
            (next) => {
              if (next !== null) loadWhole(next, `「${sample.title}」を入れました。質問・答え・移る先の画面は、部品を選んで右で直せます`)
            },
            (error: unknown) => {
              console.error('[widget-studio] アンケートの見本を入れられませんでした', error)
              toast(`「${sample.title}」を入れられませんでした。もう一度選んでください`, 'error')
            },
          )
          return null
        }

  const form = buildTemplateForm({
    fields: BUILDER_TEMPLATE.fields,
    data,
    onChange: (next) => {
      data = next
      if (!restoring) track()
      schedulePaint()
    },
    onScreenChange: () => paint(),
    ...(pickSample === undefined ? {} : { pickSample }),
    onPreviewOverride: (key, path, html) => {
      if (html === null) previewOverrides.delete(key)
      else previewOverrides.set(key, { path, html })
      schedulePaint()
    },
    onPreviewReset: () => previewOverrides.clear(),
    tabsHost: deps.tabsHost,
    ...(deps.partsHost === undefined ? {} : { partsHost: deps.partsHost }),
    // 白紙のときの「何から作りますか？」に出す例
    examples: [
      {
        label: 'アンケートの例',
        summary: '質問に答えると画面②へ進む、2画面の例です。中身を直して使えます',
        icon: BUILDER_TEMPLATE.icon,
        data: () => BUILDER_TEMPLATE.defaults(new Date()),
      },
    ],
    // まとまった型の「アンケート」: Widget を Q1〜Q3・結果の画面にする（form.load で「戻す」の履歴にも入る・2026-10-24）
    // 背景の画像を見たまま画面でつかんで動かす（2026-10-24・widget-studio-bg-move.ts）
    onBgMove: (itemPath) => {
      bgSession?.stop()
      const holder = (): ItemData => (itemPath.length === 0 ? data : ((getAt(data, itemPath) as ItemData | undefined) ?? {}))
      void startBgMove({
        target: () => bgSurfaceOf(data, contentDiv, uid, itemPath),
        look: () => bgLookOf(holder()),
        commit: (next) => {
          data = withBgLook(data, itemPath, next)
          track()
          form.setData(data)
          paint()
        },
        onEnd: () => {
          bgSession = null
        },
      }).then((session) => {
        bgSession = session
        if (session === null) toast('背景の画像を読み込めませんでした。画像を選び直してください', 'error')
      })
    },
    onSurvey: () => {
      void askSurveyData(hasParts()).then((next) => {
        if (next !== null) loadWhole(next, 'アンケートの形を入れました。質問・答え・移る先の画面は、部品を選んで右で直せます')
      })
    },
    onSelect: () => showSelection(),
    blockElement: (screenIndex, blockIndex) => blockElementAt(data, contentDiv, screenIndex, blockIndex),
    onInnerSelected: (node, label, handles) => {
      const blockIndex = form.selectedBlock()
      selection.select(node, label, handles, { actions: blockIndex === null ? [] : blockActions(form.activeScreen(), blockIndex) })
    },
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
    el.removeAttribute('data-nc-empty') // 打ったので、もう空ではない（案内の文字を消す）
    const synced = syncCanvasBlock(data, el, contentDiv)
    if (synced === null) return
    data = synced.data
    track()
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
    // Canva式: 1回押すと部品を選ぶだけ（文字の入力の印を外す）。打っている途中の部品の中なら、そのまま打てる
    partKeys.onClick(el)
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
  // どの部品も本体をつかんで動かせる（Canva式・2026-09-24）。文字を打っている途中の部品と、見本の部品（中の要素を選ぶ）は除く
  // 重ねた見本の部品は本体をつかんで動かせる（少し動かすと動き出す。押すだけなら今までどおり中の要素を選ぶ）
  const isDirectMove = (block: ItemData, el: HTMLElement): boolean =>
    (str(block, 'type') !== 'sample' || isFloating(block)) && !partKeys.isEditing(el)
  contentDiv.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey) return
    const el = outermostBlock(event.target, contentDiv)
    const place = el === null ? null : placeOf(el)
    if (el === null || place === null) return
    // ほかの画面の部品は、その画面を開いて選ぶだけ（開くと描き直すので、つかんで動かすのは選んでから）
    if (place.screenIndex !== form.activeScreen()) {
      form.select(place.screenIndex, place.blockIndex)
      suppressClickUntil = Date.now() + 400
      return
    }
    if (!isDirectMove(place.block, el)) return
    if (!isSelectedPlace(place)) form.select(place.screenIndex, place.blockIndex)
    const move = isHotspot(place.block)
      ? hotspotMove(el, hotspotDeps(place.screenIndex, place.blockIndex))
      : isFloatingAt(place.screenIndex, place.blockIndex)
        ? floatMove(el, floatDeps(place.screenIndex, place.blockIndex))
        : blockMove(el, place.screenIndex, place.blockIndex)
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

  // 左の「部品を足す」からドラッグで運んで入れる（移行先は部品の上に被せる）＝widget-studio-drop.ts
  attachBlockDrop({ editorBody, contentDiv, selection, form, data: () => data })

  const removeSelected = (): boolean => ((i) => i !== null && form.removeBlock(i))(form.selectedBlock())
  /** 部品の操作（キーと、枠のそばの「複製」で使う） */
  const partOps = createPartOps({
    data: () => data,
    screen: () => form.activeScreen(),
    selected: () => form.selectedBlock(),
    load: (next, screenIndex, blockIndex) => form.load(next, screenIndex, blockIndex),
    select: (screenIndex, blockIndex) => form.select(screenIndex, blockIndex),
    blockMax: BUILDER_BLOCK_MAX,
    toast: (message) => toast(message, 'error'),
  })
  /** 見たまま画面の部品（1回押す＝選ぶ・ダブルクリック＝文字を打つ・Backspace/Delete＝消す＝widget-studio-delete-key.ts） */
  const partAt = (el: HTMLElement | null): CanvasPart | null => {
    const place = el === null ? null : placeOf(el)
    if (el === null || place === null) return null
    const isSelected = isSelectedPlace(place)
    const select = (): void => form.select(place.screenIndex, place.blockIndex)
    return { el, editable: isTextEditableBlock(place.block), nudges: isRider(place.block), isSelected, select }
  }
  const partKeys = attachPartKeys({
    editorBody,
    contentDiv,
    partOf: (node) => partAt(outermostBlock(node, contentDiv)),
    selectedPart: () => partAt(((i) => (i === null ? null : blockElementAt(data, contentDiv, form.activeScreen(), i)))(form.selectedBlock())),
    remove: () => void removeSelected(),
    // ⌘C・⌘V・⌘D・↑↓・⌥↑↓・移行先と重ねた部品の矢印（左の並びでも）＝widget-studio-part-ops.ts
    ops: partOps,
    extraRoots: deps.partsHost === undefined ? [] : [deps.partsHost.list],
  })

  /** 上のツールバーのうち、部品で受け持つもの（widget-studio-toolbar.ts） */
  const toolbar = createToolbarHooks({
    data: () => data,
    selected: () => {
      const blockIndex = form.selectedBlock()
      const screenIndex = form.activeScreen()
      const block = blockIndex === null ? undefined : blockAt(screenIndex, blockIndex)
      if (blockIndex === null || block === undefined) return null
      return { screenIndex, blockIndex, block, el: blockElementAt(data, contentDiv, screenIndex, blockIndex) }
    },
    commit: commitField,
    insertBlock: (type, at, init) => form.insertBlock(type, at, init),
    inspector: () => panel,
  })

  /** 覚えた中身に戻す（戻せなければ false）。画面は今の画面のまま（無ければ最後の画面） */
  const restore = (next: TemplateData | null): boolean => {
    if (next === null) return false
    restoring = true
    form.load(next, Math.min(form.activeScreen(), Math.max(0, items(next, 'screens').length - 1)), null)
    restoring = false
    paint()
    deps.onRestore?.()
    return true
  }
  attachUndoKeys([editorBody, panel, ...(deps.partsHost === undefined ? [] : [deps.partsHost.list, deps.partsHost.palette])], {
    undo: () => restore(history.undo()),
    redo: () => restore(history.redo()),
  })

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
    editableCode: () => editableCodeOf(data, uid),
    applyCode: (code) => {
      const wasParts = editableCodeOf(data, uid).mode === 'parts'
      const next = dataWithEditedCode(data, uid, code, suggestBuilderName(data))
      // 全体を「コードの部品」にしたら、外側の名前を付け直す（中に入った古い名前の CSS が外側にも効かないように）
      if (wasParts) uid = newUid()
      // form.load → onChange で data が変わり、「戻す」の履歴にも入る
      form.load(next, 0, null)
      lastBody = ''
      paint()
      const screens = items(data, 'screens')
      if (screens.length === 1 && items(screens[0] ?? {}, 'blocks').length === 1) form.select(0, 0)
    },
    onCanvasClick,
    toolScope,
    toolbar,
    undo: () => restore(history.undo()),
    redo: () => restore(history.redo()),
    removeSelected,
    suggestName: () => suggestBuilderName(data),
    rekey: () => {
      uid = newUid()
      lastBody = ''
      paint()
    },
  }
}
