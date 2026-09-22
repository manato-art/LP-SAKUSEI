/**
 * 「型から作る」の型の一覧（2026-09-22・ノーコードでWidgetを作る③）。並びは一覧に出す順。
 * 型を足すときは、型のファイルを1つ作ってここに足す（入力欄の画面は fields から自動で組み上がる）。
 */
import { CHECKLIST_TEMPLATE } from './checklist.ts'
import { COMPARE_TEMPLATE } from './compare.ts'
import { COUNTDOWN_TEMPLATE } from './countdown.ts'
import { CTA_TEMPLATE } from './cta.ts'
import { FAQ_TEMPLATE } from './faq.ts'
import { REVIEWS_TEMPLATE } from './reviews.ts'
import { SLIDER_TEMPLATE } from './slider.ts'
import { STEPS_TEMPLATE } from './steps.ts'
import type { NocodeTemplate } from './types.ts'

export const TEMPLATES: readonly NocodeTemplate[] = [
  CTA_TEMPLATE,
  COUNTDOWN_TEMPLATE,
  FAQ_TEMPLATE,
  REVIEWS_TEMPLATE,
  COMPARE_TEMPLATE,
  STEPS_TEMPLATE,
  CHECKLIST_TEMPLATE,
  SLIDER_TEMPLATE,
]

export function templateById(id: string): NocodeTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
