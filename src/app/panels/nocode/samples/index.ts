/**
 * 新しい見本の一覧（2026-09-23・本人の依頼「SB由来の見本は使い勝手が悪いので、0から作り直す」）。
 *
 * まずは3本（選んで進むアンケート・申し込みボタン・数字の見せ場）。ここに足していき、
 * 十分そろったところで古い見本（SB由来）を外す。並び順＝Widgetライブラリの「新しい見本」に出る順。
 * 作りの決まりは kit.ts、確かめは tests/nocode-new-samples.test.ts。
 */
import { CTA_APPLY_SAMPLE } from './cta-apply.ts'
import { STATS_NUMBERS_SAMPLE } from './stats-numbers.ts'
import { SURVEY_CHOICES_SAMPLE } from './survey-choices.ts'
import type { NewSample } from './kit.ts'

export type { NewSample } from './kit.ts'

export const NEW_SAMPLES: readonly NewSample[] = [SURVEY_CHOICES_SAMPLE, CTA_APPLY_SAMPLE, STATS_NUMBERS_SAMPLE]
