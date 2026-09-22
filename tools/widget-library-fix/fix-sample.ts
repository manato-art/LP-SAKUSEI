/**
 * 見本1件（iframe srcdoc の中身＝HTML文書）にかける直しの順番（2026-09-22）。
 * どれも「何度かけても同じ」。直す必要が無い見本は、そのまま返す。
 *
 * 1. 匿名化で架空にされた公開ライブラリ・共有ボタンの行き先を戻す（restore-urls.ts）。
 *    壊れた改ざんチェック（integrity）も正しい値に戻す（integrity.ts）
 * 2. 戻せない画像・動画を灰色の仮の絵にする（lost-media.ts）。見本のスクリプトの打ち間違いを直す（typos.ts）
 * 3. 「次へ系」を画面①②…に作り変える（screens/。本人の決定「次へ系は画面化」）。
 *    どの見本かは、見本自身のスクリプト・形で見分ける（名前では決めない）
 */
import { repairIntegrity } from './integrity.ts'
import { replaceLostMedia } from './lost-media.ts'
import { restorePublicUrls } from './restore-urls.ts'
import { fixKnownTypos } from './typos.ts'
import { convertAccordionLink } from './screens/accordion-link.ts'
import { convertMultiQuestions } from './screens/multi-questions.ts'
import { convertOnePerWidget } from './screens/one-per-widget.ts'
import { convertQuestionLink } from './screens/question-link.ts'
import { convertQuizBox } from './screens/quiz-box.ts'

const TO_SCREENS: readonly ((html: string) => string)[] = [
  convertQuestionLink,
  convertOnePerWidget,
  convertAccordionLink,
  convertQuizBox,
  convertMultiQuestions,
]

export function fixSample(html: string): string {
  let out = fixKnownTypos(replaceLostMedia(repairIntegrity(restorePublicUrls(html))))
  for (const convert of TO_SCREENS) out = convert(out)
  return out
}
