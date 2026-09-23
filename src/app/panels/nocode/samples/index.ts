/**
 * 自作の見本の一覧（2026-09-23・本人の依頼「SBから持ってきた見本は使い勝手が悪いので0から作り直す。100種目指そう」）。
 *
 * 並び順＝ライブラリの左の種類の順＝LPの上から下（冒頭 → … → フッター）。
 * **このファイルは `npm run sample-index` が組み直す**（見本を足したら回す）。手で並べ替えない。
 * 作りの決まりは docs/見本の作り方.md と kit.ts、確かめは npm run sample-check。
 */
import { AWARDS_THREE_SAMPLE } from './awards-three.ts'
import { COMPARE_BEFORE_AFTER_SAMPLE } from './compare-before-after.ts'
import { COMPARE_CARDS_SAMPLE } from './compare-cards.ts'
import { COMPARE_CHECKMARKS_SAMPLE } from './compare-checkmarks.ts'
import { COMPARE_PRICE_SAMPLE } from './compare-price.ts'
import { COMPARE_SIMPLE_SAMPLE } from './compare-simple.ts'
import { COMPARE_THREE_SAMPLE } from './compare-three.ts'
import { CTA_APPLY_SAMPLE } from './cta-apply.ts'
import { CTA_BAR_LOOK_SAMPLE } from './cta-bar-look.ts'
import { CTA_DEADLINE_SAMPLE } from './cta-deadline.ts'
import { CTA_FORM_LEAD_SAMPLE } from './cta-form-lead.ts'
import { CTA_GUARANTEE_SAMPLE } from './cta-guarantee.ts'
import { CTA_LINE_SAMPLE } from './cta-line.ts'
import { CTA_STEPS_MINI_SAMPLE } from './cta-steps-mini.ts'
import { CTA_TEL_SAMPLE } from './cta-tel.ts'
import { CTA_TWO_BUTTONS_SAMPLE } from './cta-two-buttons.ts'
import { DIAGNOSIS_TYPE_SAMPLE } from './diagnosis-type.ts'
import { DIVIDER_DOTS_SAMPLE } from './divider-dots.ts'
import { DIVIDER_LINE_SAMPLE } from './divider-line.ts'
import { EXPERT_COMMENT_SAMPLE } from './expert-comment.ts'
import { FAQ_CATEGORY_SAMPLE } from './faq-category.ts'
import { FAQ_CONTACT_SAMPLE } from './faq-contact.ts'
import { FAQ_OPEN_SAMPLE } from './faq-open.ts'
import { FAQ_SHORT_SAMPLE } from './faq-short.ts'
import { FAQ_TWO_COLUMN_SAMPLE } from './faq-two-column.ts'
import { FAQ_WORRY_SAMPLE } from './faq-worry.ts'
import { FEATURE_BADGES_SAMPLE } from './feature-badges.ts'
import { FEATURE_BAR_CHART_SAMPLE } from './feature-bar-chart.ts'
import { FEATURE_BEFORE_AFTER_SAMPLE } from './feature-before-after.ts'
import { FEATURE_CHECKLIST_SAMPLE } from './feature-checklist.ts'
import { FEATURE_GRID4_SAMPLE } from './feature-grid4.ts'
import { FEATURE_HIGHLIGHT_SAMPLE } from './feature-highlight.ts'
import { FEATURE_ICON_LIST_SAMPLE } from './feature-icon-list.ts'
import { FEATURE_QUOTE_SAMPLE } from './feature-quote.ts'
import { FEATURE_SPEC_TABLE_SAMPLE } from './feature-spec-table.ts'
import { FOOTER_COLUMNS_SAMPLE } from './footer-columns.ts'
import { FOOTER_CTA_SAMPLE } from './footer-cta.ts'
import { FOOTER_INFO_SAMPLE } from './footer-info.ts'
import { FOOTER_SIMPLE_SAMPLE } from './footer-simple.ts'
import { HEADING_BAND_SAMPLE } from './heading-band.ts'
import { HEADING_NUMBER_SAMPLE } from './heading-number.ts'
import { HEADING_UNDERLINE_SAMPLE } from './heading-underline.ts'
import { HERO_BADGES_SAMPLE } from './hero-badges.ts'
import { HERO_IMAGE_BG_SAMPLE } from './hero-image-bg.ts'
import { HERO_LIMITED_SAMPLE } from './hero-limited.ts'
import { HERO_LOGO_LEAD_SAMPLE } from './hero-logo-lead.ts'
import { HERO_OFFER_SAMPLE } from './hero-offer.ts'
import { HERO_PRICE_SAMPLE } from './hero-price.ts'
import { HERO_QUESTION_SAMPLE } from './hero-question.ts'
import { HERO_SIMPLE_SAMPLE } from './hero-simple.ts'
import { HISTORY_TIMELINE_SAMPLE } from './history-timeline.ts'
import { HOWTO_CAUTION_SAMPLE } from './howto-caution.ts'
import { HOWTO_NUMBERED_SAMPLE } from './howto-numbered.ts'
import { HOWTO_QA_SAMPLE } from './howto-qa.ts'
import { HOWTO_TIMELINE_SAMPLE } from './howto-timeline.ts'
import { HOWTO_VIDEO_SAMPLE } from './howto-video.ts'
import { IMAGE_BEFORE_AFTER_SAMPLE } from './image-before-after.ts'
import { IMAGE_CAPTION_LIST_SAMPLE } from './image-caption-list.ts'
import { IMAGE_FULL_SAMPLE } from './image-full.ts'
import { IMAGE_GALLERY3_SAMPLE } from './image-gallery3.ts'
import { IMAGE_TEXT_SAMPLE } from './image-text.ts'
import { LEGAL_NOTE_SAMPLE } from './legal-note.ts'
import { LIMITED_BAND_SAMPLE } from './limited-band.ts'
import { LIMITED_NOTE_SAMPLE } from './limited-note.ts'
import { LIMITED_STEPS_SAMPLE } from './limited-steps.ts'
import { LIMITED_STOCK_SAMPLE } from './limited-stock.ts'
import { LIMITED_TODAY_SAMPLE } from './limited-today.ts'
import { LOGOS_ROW_SAMPLE } from './logos-row.ts'
import { MEDIA_MENTIONS_SAMPLE } from './media-mentions.ts'
import { MID_CTA_BAND_SAMPLE } from './mid-cta-band.ts'
import { PRICING_CAMPAIGN_SAMPLE } from './pricing-campaign.ts'
import { PRICING_FAQ_SAMPLE } from './pricing-faq.ts'
import { PRICING_SINGLE_SAMPLE } from './pricing-single.ts'
import { PRICING_TABLE_SAMPLE } from './pricing-table.ts'
import { PRICING_THREE_SAMPLE } from './pricing-three.ts'
import { PRICING_TWO_SAMPLE } from './pricing-two.ts'
import { PROFILE_ROUND_SAMPLE } from './profile-round.ts'
import { SPACER_BLOCK_SAMPLE } from './spacer-block.ts'
import { STATS_BAR_SAMPLE } from './stats-bar.ts'
import { STATS_NUMBERS_SAMPLE } from './stats-numbers.ts'
import { STEPS_FOUR_CARDS_SAMPLE } from './steps-four-cards.ts'
import { STEPS_THREE_SAMPLE } from './steps-three.ts'
import { SURVEY_CHOICES_SAMPLE } from './survey-choices.ts'
import { SURVEY_GATE_SAMPLE } from './survey-gate.ts'
import { SURVEY_MULTI_SAMPLE } from './survey-multi.ts'
import { SURVEY_NPS_SAMPLE } from './survey-nps.ts'
import { SURVEY_ONE_SAMPLE } from './survey-one.ts'
import { SURVEY_SCALE_SAMPLE } from './survey-scale.ts'
import { SURVEY_YESNO_SAMPLE } from './survey-yesno.ts'
import { TEXT_BODY_SAMPLE } from './text-body.ts'
import { TEXT_HIGHLIGHT_LINE_SAMPLE } from './text-highlight-line.ts'
import { TEXT_LEAD_SAMPLE } from './text-lead.ts'
import { TEXT_NOTE_BOX_SAMPLE } from './text-note-box.ts'
import { TEXT_QUOTE_SAMPLE } from './text-quote.ts'
import { TEXT_TWO_COLUMN_SAMPLE } from './text-two-column.ts'
import { THREE_POINTS_SAMPLE } from './three-points.ts'
import { VIDEO_EMBED_SAMPLE } from './video-embed.ts'
import { VOICES_PHOTO_SAMPLE } from './voices-photo.ts'
import { VOICES_QUOTE_SAMPLE } from './voices-quote.ts'
import { VOICES_THREE_SAMPLE } from './voices-three.ts'
import { WORRY_BUBBLES_SAMPLE } from './worry-bubbles.ts'
import { WORRY_CHECK_SAMPLE } from './worry-check.ts'
import { WORRY_COST_SAMPLE } from './worry-cost.ts'
import { WORRY_FAIL_SAMPLE } from './worry-fail.ts'
import { WORRY_PERSONA_SAMPLE } from './worry-persona.ts'
import { WORRY_STORY_SAMPLE } from './worry-story.ts'
import type { NewSample } from './kit.ts'

export { SAMPLE_CATEGORIES } from './kit.ts'
export type { NewSample, SampleCategory } from './kit.ts'

export const NEW_SAMPLES: readonly NewSample[] = [
  // 冒頭・つかみ（8本）
  HERO_BADGES_SAMPLE,
  HERO_IMAGE_BG_SAMPLE,
  HERO_LIMITED_SAMPLE,
  HERO_LOGO_LEAD_SAMPLE,
  HERO_OFFER_SAMPLE,
  HERO_PRICE_SAMPLE,
  HERO_QUESTION_SAMPLE,
  HERO_SIMPLE_SAMPLE,
  // 悩み・共感（6本）
  WORRY_BUBBLES_SAMPLE,
  WORRY_CHECK_SAMPLE,
  WORRY_COST_SAMPLE,
  WORRY_FAIL_SAMPLE,
  WORRY_PERSONA_SAMPLE,
  WORRY_STORY_SAMPLE,
  // 特徴・価値（10本）
  FEATURE_BADGES_SAMPLE,
  FEATURE_BAR_CHART_SAMPLE,
  FEATURE_BEFORE_AFTER_SAMPLE,
  FEATURE_CHECKLIST_SAMPLE,
  FEATURE_GRID4_SAMPLE,
  FEATURE_HIGHLIGHT_SAMPLE,
  FEATURE_ICON_LIST_SAMPLE,
  FEATURE_QUOTE_SAMPLE,
  FEATURE_SPEC_TABLE_SAMPLE,
  THREE_POINTS_SAMPLE,
  // 説明・使い方（8本）
  HOWTO_CAUTION_SAMPLE,
  HOWTO_NUMBERED_SAMPLE,
  HOWTO_QA_SAMPLE,
  HOWTO_TIMELINE_SAMPLE,
  HOWTO_VIDEO_SAMPLE,
  IMAGE_TEXT_SAMPLE,
  STEPS_FOUR_CARDS_SAMPLE,
  STEPS_THREE_SAMPLE,
  // 信頼・実績（10本）
  AWARDS_THREE_SAMPLE,
  EXPERT_COMMENT_SAMPLE,
  HISTORY_TIMELINE_SAMPLE,
  LOGOS_ROW_SAMPLE,
  MEDIA_MENTIONS_SAMPLE,
  STATS_BAR_SAMPLE,
  STATS_NUMBERS_SAMPLE,
  VOICES_PHOTO_SAMPLE,
  VOICES_QUOTE_SAMPLE,
  VOICES_THREE_SAMPLE,
  // 比較・違い（6本）
  COMPARE_BEFORE_AFTER_SAMPLE,
  COMPARE_CARDS_SAMPLE,
  COMPARE_CHECKMARKS_SAMPLE,
  COMPARE_PRICE_SAMPLE,
  COMPARE_SIMPLE_SAMPLE,
  COMPARE_THREE_SAMPLE,
  // 料金・プラン（6本）
  PRICING_CAMPAIGN_SAMPLE,
  PRICING_FAQ_SAMPLE,
  PRICING_SINGLE_SAMPLE,
  PRICING_TABLE_SAMPLE,
  PRICING_THREE_SAMPLE,
  PRICING_TWO_SAMPLE,
  // 申し込み・CTA（10本）
  CTA_APPLY_SAMPLE,
  CTA_BAR_LOOK_SAMPLE,
  CTA_DEADLINE_SAMPLE,
  CTA_FORM_LEAD_SAMPLE,
  CTA_GUARANTEE_SAMPLE,
  CTA_LINE_SAMPLE,
  CTA_STEPS_MINI_SAMPLE,
  CTA_TEL_SAMPLE,
  CTA_TWO_BUTTONS_SAMPLE,
  MID_CTA_BAND_SAMPLE,
  // よくある質問（6本）
  FAQ_CATEGORY_SAMPLE,
  FAQ_CONTACT_SAMPLE,
  FAQ_OPEN_SAMPLE,
  FAQ_SHORT_SAMPLE,
  FAQ_TWO_COLUMN_SAMPLE,
  FAQ_WORRY_SAMPLE,
  // アンケート・診断（8本）
  DIAGNOSIS_TYPE_SAMPLE,
  SURVEY_CHOICES_SAMPLE,
  SURVEY_GATE_SAMPLE,
  SURVEY_MULTI_SAMPLE,
  SURVEY_NPS_SAMPLE,
  SURVEY_ONE_SAMPLE,
  SURVEY_SCALE_SAMPLE,
  SURVEY_YESNO_SAMPLE,
  // 限定・急ぎ（5本）
  LIMITED_BAND_SAMPLE,
  LIMITED_NOTE_SAMPLE,
  LIMITED_STEPS_SAMPLE,
  LIMITED_STOCK_SAMPLE,
  LIMITED_TODAY_SAMPLE,
  // 文章・区切り（12本）
  DIVIDER_DOTS_SAMPLE,
  DIVIDER_LINE_SAMPLE,
  HEADING_BAND_SAMPLE,
  HEADING_NUMBER_SAMPLE,
  HEADING_UNDERLINE_SAMPLE,
  SPACER_BLOCK_SAMPLE,
  TEXT_BODY_SAMPLE,
  TEXT_HIGHLIGHT_LINE_SAMPLE,
  TEXT_LEAD_SAMPLE,
  TEXT_NOTE_BOX_SAMPLE,
  TEXT_QUOTE_SAMPLE,
  TEXT_TWO_COLUMN_SAMPLE,
  // 画像・動画（6本）
  IMAGE_BEFORE_AFTER_SAMPLE,
  IMAGE_CAPTION_LIST_SAMPLE,
  IMAGE_FULL_SAMPLE,
  IMAGE_GALLERY3_SAMPLE,
  PROFILE_ROUND_SAMPLE,
  VIDEO_EMBED_SAMPLE,
  // フッター・注意書き（5本）
  FOOTER_COLUMNS_SAMPLE,
  FOOTER_CTA_SAMPLE,
  FOOTER_INFO_SAMPLE,
  FOOTER_SIMPLE_SAMPLE,
  LEGAL_NOTE_SAMPLE,
]
