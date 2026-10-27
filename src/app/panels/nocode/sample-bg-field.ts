/**
 * 見本の部品の中の箱の「背景の画像」（2026-10-24 本人の選択「見本の中の箱も」）。
 *
 * 見たまま画面で見本の中の要素（カード・枠・ボタンなど）を押すと、その要素の背景の画像を選べる（form-sample.ts の selectInner から select）。
 * 画像を選んだら、その要素に印（data-nc-bg="b1"）を付け、見本の部品の bgs に設定を足す（bg-image.ts の withSampleBg）。
 * 合わせ方・大きさ・位置・「画面でつかんで動かす」は、部品の背景の画像と同じ（bgFields）。
 */
import { node, scalarControl, type ControlEnv, type Scalar, type ScalarField } from './form-controls.ts'
import { bgFields, hasBgImage, nextSampleBgId, withSampleBg } from './templates/bg-image.ts'
import { str, type ItemData, type TemplateData } from './templates/types.ts'

export interface SampleBgDeps {
  /** 見本の部品の bgs（中の箱ごとの背景の画像） */
  readonly readBgs: () => readonly ItemData[]
  readonly writeBgs: (list: readonly ItemData[]) => void
  /** いまの見本の中身（印の名前が重ならないように見る） */
  readonly readHtml: () => string
  /** 見たまま画面の要素に印を付けて、見本の中身へ読み戻す */
  readonly mark: (element: HTMLElement, id: string) => void
  readonly data: () => TemplateData
  readonly onRefresh: (refresh: () => void) => void
  /** 画面でつかんで動かす（bgs の何番目か）。無い画面では出さない */
  readonly bgMove?: (index: number) => void
  /**
   * いま背景の画像を直している要素の印を覚えておく（null＝印の無い要素・選んでいない）。印を付けると見本の中身が読み直されて
   * 入力欄が組み立て直されるので、そのあとも同じ要素を選んだままにするため（form-sample.ts）
   */
  readonly remember?: (id: string | null) => void
}

export interface SampleBgSection {
  readonly element: HTMLElement
  /** 見本の中で選んだ要素（null＝選んでいない＝隠す） */
  readonly select: (element: HTMLElement | null) => void
}

/** 背景の画像を敷かない要素（画像・動画そのもの・線・入力など） */
const NO_BG_TAGS: ReadonlySet<string> = new Set(['IMG', 'VIDEO', 'SVG', 'PICTURE', 'IFRAME', 'BR', 'HR', 'INPUT', 'SOURCE', 'SCRIPT', 'STYLE'])
const MARK = /^b\d{1,4}$/

let idSeq = 0

export function sampleBgSection(deps: SampleBgDeps): SampleBgSection {
  const wrap = node('div', 'ncf-sample-bg')
  wrap.hidden = true
  let target: HTMLElement | null = null
  let id: string | null = null
  let refreshers: (() => void)[] = []
  deps.onRefresh(() => {
    for (const refresh of refreshers) refresh()
  })

  const indexOf = (): number => (id === null ? -1 : deps.readBgs().findIndex((entry) => str(entry, 'id') === id))
  const entry = (): ItemData => deps.readBgs()[indexOf()] ?? {}
  const write = (key: string, value: Scalar): void => {
    if (id === null) {
      // 印は、画像を選んだときに初めて付ける（選んだだけでは見本の中身を変えない）
      if (target === null || key !== 'bgImage' || value === '') return
      id = nextSampleBgId(deps.readBgs(), deps.readHtml())
      deps.remember?.(id)
      deps.mark(target, id)
    }
    deps.writeBgs(withSampleBg(deps.readBgs(), id, { [key]: value }))
  }

  const build = (): void => {
    refreshers = []
    const tag = target?.tagName.toUpperCase() ?? ''
    if (NO_BG_TAGS.has(tag)) {
      wrap.replaceChildren(node('p', 'ncf-note', '画像・動画・線には背景の画像を敷けません。まわりの箱を選んでください'))
      return
    }
    const fields = bgFields('item').map((field) =>
      field.key === 'bgImage' ? { ...field, label: 'この要素の背景の画像', note: '選んだ要素の後ろに敷きます。画像でも動画でも入ります（動画は自動で再生・音なし・くり返し）。文字はこの上に出ます' } : field,
    )
    const rows = fields.map((field) => {
      const row = node('div', 'ncf-field')
      const controlId = `ncsb-${(idSeq += 1)}`
      const env: ControlEnv = {
        read: () => entry()[field.key],
        write: (value) => write(field.key, value),
        data: deps.data,
        onRefresh: (refresh) => refreshers.push(refresh),
      }
      const label = node('label', 'ncf-label', field.label)
      label.htmlFor = controlId
      row.append(label, scalarControl(field as ScalarField, env, controlId))
      if (field.note !== undefined) row.append(node('span', 'ncf-note', field.note))
      const { showIfItem } = field
      if (showIfItem !== undefined) refreshers.push(() => {
        row.hidden = !showIfItem(entry())
      })
      return row
    })
    wrap.replaceChildren(...rows)
    const { bgMove } = deps
    if (bgMove !== undefined) {
      const move = node('button', 'ncf-btn ncf-bg-move', '画面でつかんで動かす')
      move.type = 'button'
      move.addEventListener('click', () => {
        const index = indexOf()
        if (index >= 0) bgMove(index)
      })
      refreshers.push(() => {
        move.hidden = !hasBgImage(entry())
      })
      wrap.append(move)
    }
    for (const refresh of refreshers) refresh()
  }

  return {
    element: wrap,
    select: (element) => {
      target = element
      wrap.hidden = element === null
      if (element === null) return
      const mark = element.getAttribute('data-nc-bg') ?? ''
      id = MARK.test(mark) ? mark : null
      deps.remember?.(id)
      build()
    },
  }
}
