/**
 * 自作の見本の一覧（2026-09-23・本人の依頼「SBから持ってきた見本は使い勝手が悪いので0から作り直す。100種目指そう」）。
 *
 * 並び順＝ライブラリの左の種類の順＝LPの上から下（冒頭 → … → フッター）。
 * **このファイルは `npm run sample-index` が組み直す**（見本を足したら回す）。手で並べ替えない。
 * 作りの決まりは docs/見本の作り方.md と kit.ts、確かめは npm run sample-check。
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

export { SAMPLE_CATEGORIES } from './kit.ts'
export type { NewSample, SampleCategory } from './kit.ts'

export const NEW_SAMPLES: readonly NewSample[] = [
  // 冒頭・つかみ（1本）
  HERO_OFFER_SAMPLE,
  // 悩み・共感（1本）
  WORRY_CHECK_SAMPLE,
  // 特徴・価値（1本）
  THREE_POINTS_SAMPLE,
  // 説明・使い方（2本）
  IMAGE_TEXT_SAMPLE,
  STEPS_THREE_SAMPLE,
  // 信頼・実績（2本）
  STATS_NUMBERS_SAMPLE,
  VOICES_THREE_SAMPLE,
  // 比較・違い（1本）
  COMPARE_SIMPLE_SAMPLE,
  // 料金・プラン（1本）
  PRICING_TWO_SAMPLE,
  // 申し込み・CTA（2本）
  CTA_APPLY_SAMPLE,
  MID_CTA_BAND_SAMPLE,
  // よくある質問（1本）
  FAQ_OPEN_SAMPLE,
  // アンケート・診断（1本）
  SURVEY_CHOICES_SAMPLE,
  // フッター・注意書き（1本）
  FOOTER_INFO_SAMPLE,
]
