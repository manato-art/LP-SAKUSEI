/**
 * 一度作ったWidgetを複製する（2026-10-24 本人「一度作ったウィジェットを複製する機能が欲しい」・本人の選択「両方」）。
 * - LPに置いたWidget … そのすぐ下にもう1つ置く（widget-nav.ts の「複製」）
 * - 「作成したWidget」… コピーを作る（widget-library.ts の「複製」・名前は copyName）
 *
 * LPに置いたWidgetの複製は、中の名前（CSSのクラス）を付け直す。同じ名前のままだと、片方の色を変えたときに
 * もう片方も変わる（2026-10-18 の「両方青くなった」と同じ仕組み）。
 */
import type Quill from 'quill'
import { newUid, rekeyUid } from './nocode/templates/kit.ts'

/** 保存できる名前の長さ（mock-server/store/widget-library.ts と同じ） */
const NAME_MAX = 80
const COPY_SUFFIX = '（コピー）'

/** コピーの名前（長い名前は、保存できる長さに収めてから「（コピー）」を付ける） */
export function copyName(name: string): string {
  return `${name.slice(0, NAME_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`
}

/** LPに置いたWidgetを、そのすぐ下に複製する。LPの部品として見つからなければ false */
export function duplicatePlacedWidget(quill: Quill, widgetNode: HTMLElement, nextUid: () => string = newUid): boolean {
  const blot = quill.scroll.find(widgetNode)
  if (blot === null) return false
  const index = quill.getIndex(blot)
  quill.insertEmbed(index + 1, 'sbwidget', rekeyUid(widgetNode.innerHTML, nextUid()), 'user')
  return true
}
