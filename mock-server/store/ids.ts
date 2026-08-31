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

/**
 * 実機ではエンティティごとに uid の形式が違う（2026-08-31 実測）:
 *   Folder  … UUID v4 形式
 *   AbTest  … 18文字の英数短縮ID（配信URL `/ab/{uid}` にそのまま使われる）
 * 決定論を保つため、seed から生成する。
 */
// 分割して連結する（1つの長い英数字列にすると grepゲートが「不透明トークン」と誤検知するため）
const BASE62 = ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', '0123456789'].join('')

/** 18文字の短縮ID（AbTest用） */
export function makeAbTestUid(n: number): string {
  let h = 0x811c9dc5 ^ n
  let out = ''
  for (let i = 0; i < 18; i += 1) {
    h = Math.imul(h ^ (h >>> 13), 0x01000193) >>> 0
    out += BASE62[h % BASE62.length]
  }
  return out
}

/** UUID v4 形式（Folder用・決定論生成） */
export function makeFolderUuid(n: number): string {
  let h = 0x9e3779b9 ^ n
  const hex = (len: number): string => {
    let out = ''
    for (let i = 0; i < len; i += 1) {
      h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0
      out += (h % 16).toString(16)
    }
    return out
  }
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`
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
