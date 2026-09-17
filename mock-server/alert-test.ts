/**
 * お知らせのテスト（2026-09-17・本人の依頼「これのテストしたい」）。
 *
 * 本番のページや数字に触れずに、お知らせがどう届くかを確かめられるようにする。
 *  - 見本: CV停止・CPA超え・リンク切れ・予約実行の4種類を、「テスト」と明記して1通にまとめる
 *    （LINEの枠は1回1通）。文面は**本物と同じ組み立て関数から作る**（見本と実物で文面がずれないように）
 *  - いま見張っている対象: 以前「実は何も見張っていなかった」不具合があったので、
 *    見張り先が本番のページに向いていることを画面で確かめられるようにする
 */
import { RECENT_DAYS, findAlerts, isWatchable, notifyList } from './alerts.ts'
import { jstNow } from './lib/jst.ts'
import { findBrokenLinkAlerts, linkTargets } from './link-check.ts'
import { switchMessage } from './scheduled-switch-runner.ts'
import type { State } from './store/types.ts'

const SAMPLE_PAGE = { uid: 'SAMPLE', title: 'サンプルLP', ad_status: 'prepared' }
/** CPAの上限が0（見ていない）ときに見本で使う例の上限 */
const SAMPLE_CPA_LIMIT = 8000
const HOUR = 3600

/** 見本の本文（1通） */
export function buildAlertSamples(setting: { cv_silent_hours: number; cpa_limit: number }, nowMs: number): string {
  const now = Math.floor(nowMs / 1000)
  const today = jstNow(new Date(nowMs)).date
  const hours = Math.max(1, setting.cv_silent_hours)
  const limit = setting.cpa_limit > 0 ? setting.cpa_limit : SAMPLE_CPA_LIMIT
  const base = {
    now,
    today,
    setting: { enabled: true, cv_silent_hours: hours, cpa_limit: limit, notify: [{ service: 'line' as const, destination_id: '' }] },
    pages: [SAMPLE_PAGE],
    sentSlots: [],
  }

  const cvStopped =
    findAlerts({ ...base, conversions: [{ ab_test_uid: SAMPLE_PAGE.uid, occurred_at: now - (hours + 1) * HOUR }], metrics: [] })[0]
      ?.message ?? ''
  // CPAが上限の1.5倍になる例（CV5件）
  const cpaOver =
    findAlerts({
      ...base,
      conversions: [],
      metrics: [{ entity_uid: SAMPLE_PAGE.uid, date: today, ad_cost: Math.round(limit * 1.5) * 5, cv: 5 }],
    })[0]?.message ?? ''
  const linkBroken =
    findBrokenLinkAlerts({
      now,
      targets: [{ abTestUid: SAMPLE_PAGE.uid, title: SAMPLE_PAGE.title, urls: ['https://example.com/cart'] }],
      checks: [{ url: 'https://example.com/cart', failures: 2, last_reason: 'HTTP 404', next_check_at: 0 }],
      sentSlots: [],
    })[0]?.message ?? ''
  const switched = switchMessage(
    SAMPLE_PAGE.title,
    `${today}T09:00`,
    'done',
    [
      { name: 'セールLP', before: 100, after: 0 },
      { name: '通常LP', before: 0, after: 100 },
    ],
    '',
  )

  return [
    '【テスト】異常のお知らせの見本です（実際の異常ではありません）',
    'お知らせが「入」のとき、条件に当たるとこの形で届きます。',
    '',
    '― CVが止まったとき ―',
    cvStopped,
    '',
    '― CPAが上限を超えたとき ―',
    cpaOver,
    '',
    '― リンクが開けなくなったとき ―',
    linkBroken,
    '',
    '― 予約した切り替えを実行したとき ―',
    switched,
  ].join('\n')
}

export interface AlertCoverage {
  enabled: boolean
  destinations: number
  /** CVが止まったかを見ているページ（直近7日にCVがあり、停止中・終了でない） */
  cv_pages: string[]
  /** 0 ＝ 見ていない */
  cpa_limit: number
  link_check: boolean
  /** リンクを見張っているページ数と、計測リンクの本数 */
  link_pages: number
  link_count: number
  /** これからの予約 */
  pending_switches: number
}

/** いま見張っている対象（読むだけ・何も送らない） */
export function alertCoverage(state: State, nowMs: number): AlertCoverage {
  const now = Math.floor(nowMs / 1000)
  const recent = RECENT_DAYS * 24 * HOUR
  const cvPages = state.abTests
    .filter((page) => isWatchable(page))
    .filter((page) => state.conversions.some((c) => c.ab_test_uid === page.uid && now - c.occurred_at <= recent))
    .map((page) => page.title)
  const targets = linkTargets(state, jstNow(new Date(nowMs)).date)
  const setting = state.alertSetting
  return {
    enabled: setting.enabled,
    destinations: notifyList(setting.notify).length,
    cv_pages: cvPages,
    cpa_limit: setting.cpa_limit,
    link_check: setting.link_check !== false,
    link_pages: targets.length,
    link_count: targets.reduce((sum, t) => sum + t.urls.length, 0),
    pending_switches: state.scheduledSwitches.filter((s) => s.status === 'pending').length,
  }
}
