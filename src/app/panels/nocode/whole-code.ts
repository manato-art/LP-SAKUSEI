/**
 * Widget編集の右の「デフォルト時のコードを表示」で直すコード（2026-10-18 本人「コード上でも修正・変更できるようにして」）。
 *
 * 本人の選択「全体のコードを直す」:
 * - 部品で組み立てたWidget（mode 'parts'）… 全体のコードを出す。直して入れると、全体が「コードの部品」
 *   （見本の部品）1つになる＝部品ごとの入力欄では直せなくなる（入れる前に確かめる・「戻す」で戻せる）。
 *   設定データ（data-nc-data の長いJSON）は出さない（直す所ではない。入れるときに付け直す）。
 * - もう「コードの部品」1つだけのWidget（mode 'sample'）… その部品のコード（書いたままのCSS）を出し、
 *   直したらその部品のコードを差し替える（入れ子にしない。部品の「コードで直す」と同じ中身）。
 */
import { getAt, setAt, type Path } from './form-state.ts'
import { splitStyles, wrapHtmlAsBuilder } from './builder-data.ts'
import { BUILDER_TEMPLATE } from './templates/builder.ts'
import { items, str, type ItemData, type TemplateData } from './templates/types.ts'

export type CodeMode = 'sample' | 'parts'

export interface EditableCode {
  readonly mode: CodeMode
  readonly html: string
  readonly css: string
}

/** 画面1つ・「コードの部品」1つだけのWidgetなら、その部品の場所 */
function singleSamplePath(data: TemplateData): Path | null {
  const screens = items(data, 'screens')
  if (screens.length !== 1) return null
  const blocks = items(screens[0] ?? {}, 'blocks')
  if (blocks.length !== 1 || str(blocks[0] ?? {}, 'type') !== 'sample') return null
  return ['screens', 0, 'blocks', 0]
}

/** コード欄に出すコード */
export function editableCodeOf(data: TemplateData, uid: string): EditableCode {
  const path = singleSamplePath(data)
  if (path !== null) {
    const { css, body } = splitStyles(str(getAt(data, path) as ItemData, 'html'))
    return { mode: 'sample', html: body, css }
  }
  // 書き出し（render）には設定データが入っていない（LPに入れるときに embedBuilderData で付ける）
  const { css, body } = splitStyles(BUILDER_TEMPLATE.render(data, uid))
  return { mode: 'parts', html: body, css }
}

/** 直したコードを入れた設定データ（title は「コードの部品」の名前） */
export function dataWithEditedCode(
  data: TemplateData,
  uid: string,
  code: { readonly html: string; readonly css: string },
  title: string,
): TemplateData {
  const html = code.css.trim() === '' ? code.html : `<style>${code.css}</style>${code.html}`
  const path = editableCodeOf(data, uid).mode === 'sample' ? singleSamplePath(data) : null
  if (path !== null) return setAt(data, [...path, 'html'], html)
  return wrapHtmlAsBuilder(html, title, BUILDER_TEMPLATE.defaults(new Date()))
}
