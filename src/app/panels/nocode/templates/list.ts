/**
 * 「型から作る」の型の一覧（2026-09-22・ノーコードでWidgetを作る③）。並びは一覧に出す順。
 * 型を足すときは、型のファイルを1つ作ってここに足す（入力欄の画面は fields から自動で組み上がる）。
 *
 * 「部品を積んで作る」（builder.ts）も、この一覧から型の部品を作る（本人の決定「同じ画面と部品に型が入る」）。
 * 輪になった読み込み（builder → builder-blocks → 型の一覧 → builder）にならないよう、
 * 一覧はここに置き、builder.ts は入れない（builder も含む探し方は index.ts の templateById）。
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
