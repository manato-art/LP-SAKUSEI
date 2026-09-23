/**
 * 新しい見本の一覧（2026-09-23・本人の依頼「SB由来の見本は使い勝手が悪いので、0から作り直す」）。
 *
 * 並び順＝Widgetライブラリの「新しい見本」に出る順＝LPの上から下の順（ファーストビュー → … → フッター）。
 * この順に選んでいけば、1本のLPがひととおり組める。
 * 作りの決まりは kit.ts、確かめは tests/nocode-new-samples.test.ts。
 */
import { COMPARE_SIMPLE_SAMPLE } from './compare-simple.ts'
import { CTA_APPLY_SAMPLE } from './cta-apply.ts'
import { FAQ_OPEN_SAMPLE } from './faq-open.ts'
import { FOOTER_INFO_SAMPLE } from './footer-info.ts'
import { HERO_OFFER_SAMPLE } from './hero-offer.ts'
import { IMAGE_TEXT_SAMPLE } from './image-text.ts'
import { MID_CTA_BAND_SAMPLE } from './mid-cta-band.ts'
import { PRICING_TWO_SAMPLE } from './pricing-two.ts'
import { STATS_NUMBERS_SAMPLE } from './stats-numbers.ts'
import { STEPS_THREE_SAMPLE } from './steps-three.ts'
import { SURVEY_CHOICES_SAMPLE } from './survey-choices.ts'
import { THREE_POINTS_SAMPLE } from './three-points.ts'
import { VOICES_THREE_SAMPLE } from './voices-three.ts'
import { WORRY_CHECK_SAMPLE } from './worry-check.ts'
import type { NewSample } from './kit.ts'

export type { NewSample } from './kit.ts'

export const NEW_SAMPLES: readonly NewSample[] = [
  HERO_OFFER_SAMPLE,
  SURVEY_CHOICES_SAMPLE,
  WORRY_CHECK_SAMPLE,
  THREE_POINTS_SAMPLE,
  IMAGE_TEXT_SAMPLE,
  STATS_NUMBERS_SAMPLE,
  VOICES_THREE_SAMPLE,
  MID_CTA_BAND_SAMPLE,
  COMPARE_SIMPLE_SAMPLE,
  PRICING_TWO_SAMPLE,
  STEPS_THREE_SAMPLE,
  FAQ_OPEN_SAMPLE,
  CTA_APPLY_SAMPLE,
  FOOTER_INFO_SAMPLE,
]
