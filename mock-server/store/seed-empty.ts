/**
 * 既定シード ＝ 新規アカウント発行直後の「まっさら」な状態（企画書 §1-4・§10-5・§16-4 確定済）。
 *
 * User 1 / Team 1 / Member 1（本人）/ Plan 初期プラン1 のみ。
 * Folder・AbTest・Article・Version・Conversion・Task・AdAccount・Domain は 0件。
 * Media ロスターとベンダー側カタログ（catalog.ts）だけが選択肢として存在する。
 * ここから先はユーザー操作で増える（§10-9）。
 */
import {
  ADDON_CATALOG,
  INTRODUCTION_CATALOG,
  MEDIA_ROSTER,
  PERMISSION_CATALOG,
  SEMINAR_CATALOG,
} from './catalog.ts'
import { makeUid } from './ids.ts'
import type { State } from './types.ts'

/** 新規アカウントの本人。実在人物と紐づかない架空値（§3-1） */
export const OWNER = {
  name: 'テスト太郎',
  email: 'test.taro@example.test',
} as const

export const INITIAL_TEAM_NAME = 'サンプルチーム'

export function createEmptyState(): State {
  const teamId = 1
  const planId = 1
  return {
    users: [
      {
        id: 1,
        uid: makeUid('user', 1),
        name: OWNER.name,
        email: OWNER.email,
        public_api_key: null,
        current_team_id: teamId,
      },
    ],
    teams: [{ id: teamId, uid: makeUid('team', 1), name: INITIAL_TEAM_NAME, plan_id: planId }],
    members: [
      {
        id: 1,
        uid: makeUid('member', 1),
        name: OWNER.name,
        email: OWNER.email,
        role: 'team-owner',
        team_id: teamId,
      },
    ],
    plans: [
      {
        id: planId,
        uid: makeUid('plan', 1),
        team_id: teamId,
        name: 'スタンダード',
        price: 50000,
        seats: 5,
        current: true,
      },
    ],
    addons: ADDON_CATALOG,
    media: MEDIA_ROSTER,

    // ── ここから下はすべて 0件（新規アカウント）──
    folders: [],
    abTests: [],
    articles: [],
    versions: [],
    redirectPages: [],
    exitPopups: [],
    splitTestSettings: [],
    conversions: [],
    conversionTags: [],
    forms: [],
    operatorArticles: [],
    tasks: [],
    inspections: [],
    adAccounts: [],
    aspAccounts: [],
    domains: [],
    tags: [],
    productSearchForms: [],
    sbAiConversations: [],
    sbAiMessages: [],
    heatmaps: [],
    mediaAssets: [],
    reportExclusions: [],
    htmlParts: [],
    metrics: [],

    // ── 設定系は「既定値が入った状態」で存在する（0件ではない）──
    notificationSettings: [
      { scope: 'member', cv_notify: true, daily_report: false, ad_alert: true },
      { scope: 'team', cv_notify: true, daily_report: true, ad_alert: true },
    ],

    // ── ベンダー側カタログ ──
    permissions: PERMISSION_CATALOG,
    seminars: SEMINAR_CATALOG,
    introductions: INTRODUCTION_CATALOG,

    htmlTags: [],
  nextId: 100,
  }
}
