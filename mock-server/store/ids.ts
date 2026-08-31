/**
 * uid採番（企画書 §5-3「uidは常に UID_0001 等で一貫」）。
 * 実データのuid/トークン形式は一切使わない（§3-1・§5-5）。
 */

const PAD = 4

function pad(n: number): string {
  return String(n).padStart(PAD, '0')
}

/** 種別ごとの連番uid。例 uid('ab_test', 1) → "ABTEST_0001" */
export function uid(kind: string, n: number): string {
  return `${kind.toUpperCase().replace(/[^A-Z0-9]/g, '')}_${pad(n)}`
}

export const UID_KINDS = {
  team: 'TEAM',
  member: 'MEMBER',
  user: 'USER',
  folder: 'FOLDER',
  abTest: 'ABTEST',
  article: 'ARTICLE',
  version: 'VERSION',
  conversion: 'CV',
  task: 'TASK',
  plan: 'PLAN',
  domain: 'DOMAIN',
  tag: 'TAG',
  form: 'FORM',
  adAccount: 'ADACCOUNT',
  aspAccount: 'ASPACCOUNT',
  redirectPage: 'REDIRECT',
  exitPopup: 'EXITPOPUP',
  conversionTag: 'CVTAG',
  operatorArticle: 'OPARTICLE',
  inspection: 'INSPECTION',
  mediaAsset: 'ASSET',
  addon: 'ADDON',
  reportExclusion: 'EXCLUSION',
  sbAiConversation: 'AICONV',
  productSearchForm: 'PSFORM',
  htmlPart: 'HTMLPART',
  seminar: 'SEMINAR',
  introduction: 'INTRO',
} as const

export type UidKind = keyof typeof UID_KINDS

export function makeUid(kind: UidKind, n: number): string {
  return uid(UID_KINDS[kind], n)
}

/** 固定ダミーuid（企画書 §13-B「パラメータ付きは固定ダミーuidで解決」） */
export const DUMMY_UIDS = {
  abTest: makeUid('abTest', 1),
  article: makeUid('article', 1),
  version: makeUid('version', 1),
  folder: makeUid('folder', 1),
  team: makeUid('team', 1),
  member: makeUid('member', 1),
  plan: makeUid('plan', 1),
} as const
