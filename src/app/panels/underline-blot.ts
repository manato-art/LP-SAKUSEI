/**
 * 見た目（色・太さ・不透明度）を持てる下線の Quill 部品（2026-10-18 本人指定）。
 *
 * Quill 標準の下線（`<u>`）は「付いている／いない」しか持たない。値に見た目の文字列を持たせ、
 * `<u>` 自身の style へ書く（値の形・読み書きは underline-look.ts）。値が `true` のときは今までどおりの `<u>`。
 *
 * media-blots.ts と同じく **Quill 本体（クラス）** を読み込むので、エディタ（ブラウザ）からだけ使う。
 */
import Quill from 'quill'
import { applyUnderlineLook, underlineValueOfElement, type UnderlineFormatValue } from './underline-look.ts'

type InlineFormat = (new (...args: unknown[]) => object) & {
  create(value?: unknown): HTMLElement
}

let registered = false

/** 下線の部品を差し替える。Quill を作る前に1回呼ぶ（保存HTMLの `<u style>` を開いたときも見た目を読む） */
export function registerUnderlineBlot(): void {
  if (registered) return
  const BaseUnderline = Quill.import('formats/underline') as InlineFormat

  class SbUnderline extends BaseUnderline {
    static blotName = 'underline'
    static tagName = 'U'

    static override create(value?: unknown): HTMLElement {
      const node = super.create(value)
      applyUnderlineLook(node, value)
      return node
    }

    static formats(domNode: HTMLElement): UnderlineFormatValue {
      return underlineValueOfElement(domNode)
    }
  }

  ;(Quill.register as (path: string, target: unknown, overwrite?: boolean) => void)(
    'formats/underline',
    SbUnderline,
    true,
  )
  registered = true
}
