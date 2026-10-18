/**
 * 「マーカー」（文字の下側に敷く太い帯）の Quill 部品（2026-10-18 本人「下線だけではなくマーカー機能もほしい」）。
 *
 * `<span class="sb-marker" data-marker="#rrggbb,太さ,不透明度" style="background-image:…">`。
 * 値の読み書きは marker-look.ts。重なり順は Quill の文字の飾り（リンク・下線・太字など）より内側に置く
 * （帯は文字のすぐ後ろに敷く。外側の太字・下線はそのまま効く）。
 *
 * media-blots.ts と同じく **Quill 本体（クラス）** を読み込むので、エディタ（ブラウザ）からだけ使う。
 */
import Quill from 'quill'
import { applyMarkerLook, markerValueOfElement } from './marker-look.ts'

type InlineBlot = (new (...args: unknown[]) => object) & {
  create(value?: unknown): HTMLElement
  order: string[]
}

let registered = false

/** マーカーの部品を登録する。Quill を作る前に1回呼ぶ（保存HTMLの `<span class="sb-marker">` を開いたときも読む） */
export function registerMarkerBlot(): void {
  if (registered) return
  const Inline = Quill.import('blots/inline') as InlineBlot

  class SbMarker extends Inline {
    static blotName = 'marker'
    static tagName = 'SPAN'
    static className = 'sb-marker'

    static override create(value?: unknown): HTMLElement {
      const node = super.create(value)
      applyMarkerLook(node, value)
      return node
    }

    static formats(domNode: HTMLElement): string {
      return markerValueOfElement(domNode)
    }
  }

  // 重なり順の表に入れる（入れないと、どの飾りより内側かが決まらない）。リンクより内側＝文字のすぐ外
  if (!Inline.order.includes('marker')) {
    const link = Inline.order.indexOf('link')
    Inline.order = [...Inline.order.slice(0, link), 'marker', ...Inline.order.slice(link)]
  }
  ;(Quill.register as (path: string, target: unknown, overwrite?: boolean) => void)('formats/marker', SbMarker, true)
  registered = true
}
