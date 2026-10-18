/**
 * 「背景色」の余白（`bgpad`＝span の padding）を Quill へ登録する（2026-10-18 本人「背景の幅や不透明度調整できるようにして」）。
 *
 * 登録すると、保存してあった `<span style="padding: 8px">` を開いたときも余白として読む。
 * marker-blot.ts と同じく **Quill 本体** を読み込むので、エディタ（ブラウザ）からだけ使う。値の形は background-look.ts。
 */
import Quill from 'quill'
import { BackgroundPaddingAttributor } from './background-look.ts'

let registered = false

/** Quill を作る前に1回呼ぶ */
export function registerBackgroundPadding(): void {
  if (registered) return
  Quill.register(BackgroundPaddingAttributor, true)
  registered = true
}
