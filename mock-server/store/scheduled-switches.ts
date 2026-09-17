/**
 * 配信の切り替え予約（2026-09-16・本人の依頼）。
 *
 * 「9/30 23:59 にセールLPから通常LPへ」「明日9時に配信開始」を予約できるようにする。
 * 既存の「Versionオプション設定 → 日付別・時間別」は日単位・毎日くり返しなので、
 * **日時ちょうど（分単位）の切り替え**はそれでは表せない。その足りない部分だけを足す。
 *
 * ⚠️ このシステムだけの機能（実物のSquadBeyondには無い）。
 *
 * 仕組みは「決めた日時に、ステップの配信割合をこの値にする」の1つだけ。
 *   開始＝0%→100% ／ 停止＝→0% ／ 切り替え＝A 100%→0%・B 0%→100%
 * （配信割合0%のVersionは絶対に配信しない＝既存の決まり。delivery-targeting.ts）
 *
 * 日時はすべて**日本時間の 'YYYY-MM-DDTHH:MM'**（画面の datetime-local と同じ形）。
 * 同じ形なので文字列の大小で前後を比べられる。
 */
import type { State } from './types.ts'

export type SwitchStatus = 'pending' | 'done' | 'failed' | 'canceled'

export interface ScheduledSwitch {
  uid: string
  /** どのステップ（記事）の配信割合を切り替えるか */
  article_uid: string
  /** 実行する日時（日本時間 'YYYY-MM-DDTHH:MM'） */
  run_at: string
  /** 切り替え後の配信割合（そのステップの、予約した時点のアーカイブされていない全Version） */
  ratios: { version_uid: string; ratio: number }[]
  status: SwitchStatus
  /** 実行結果の説明（遅れて実行した・実行できなかった理由） */
  note: string
  /** 予約した時刻（UNIX秒） */
  created_at: number
  /** 実際に実行した日時（日本時間 'YYYY-MM-DDTHH:MM'） */
  done_at: string | null
}

export interface SwitchInput {
  run_at: string
  ratios: { version_uid: string; ratio: number }[]
}

const RUN_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/** これより遅れて実行したら「遅れて実行した」と書く（見張りは30秒おきなので、数分の揺れは遅れと言わない） */
const LATE_MINUTES = 5

/** そのステップの、アーカイブされていないVersion */
function activeVersionsOf(state: State, articleUid: string) {
  const article = state.articles.find((a) => a.uid === articleUid)
  if (article === undefined) return null
  return state.versions.filter((v) => v.article_id === article.id && v.archived !== true)
}

/** 予約の中身を確かめる。受け付けられなければ、画面に出す理由を返す */
export function validateSwitchInput(
  state: State,
  articleUid: string,
  raw: unknown,
  nowJst: string,
): { ok: true; value: SwitchInput } | { ok: false; message: string } {
  const body = (raw ?? {}) as Record<string, unknown>
  const runAt = body['run_at']
  if (typeof runAt !== 'string' || !RUN_AT_PATTERN.test(runAt)) {
    return { ok: false, message: '日時を指定してください。' }
  }
  if (runAt <= nowJst) {
    return { ok: false, message: 'これから先の日時を指定してください。' }
  }

  const versions = activeVersionsOf(state, articleUid)
  if (versions === null) return { ok: false, message: 'ステップが見つかりません。' }

  const rawRatios = Array.isArray(body['ratios']) ? body['ratios'] : null
  if (rawRatios === null) return { ok: false, message: '配信割合を指定してください。' }

  const ratios: SwitchInput['ratios'] = []
  const seen = new Set<string>()
  const known = new Set(versions.map((v) => v.uid))
  for (const item of rawRatios) {
    const { version_uid: uid, ratio } = (item ?? {}) as Record<string, unknown>
    if (typeof uid !== 'string' || !known.has(uid) || seen.has(uid)) {
      return { ok: false, message: 'このステップのVersionだけを指定してください。' }
    }
    if (typeof ratio !== 'number' || !Number.isInteger(ratio) || ratio < 0 || ratio > 100) {
      return { ok: false, message: '配信割合は0〜100の整数で指定してください。' }
    }
    seen.add(uid)
    ratios.push({ version_uid: uid, ratio })
  }
  // 1つでも抜けていると、切り替え後にどう配信されるかが決まらない
  if (seen.size !== known.size) {
    return { ok: false, message: 'このステップの全Versionの配信割合を指定してください。' }
  }
  const total = ratios.reduce((sum, r) => sum + r.ratio, 0)
  if (total !== 100 && total !== 0) {
    return { ok: false, message: `配信割合の合計を100%にしてください（今は${total}%）。全部止めるなら0%です。` }
  }
  return { ok: true, value: { run_at: runAt, ratios } }
}

/** 実行する時刻が来た予約（予約の日時を過ぎた、まだ実行していないもの）。古い順 */
export function dueSwitches(switches: readonly ScheduledSwitch[], nowJst: string): ScheduledSwitch[] {
  return switches
    .filter((s) => s.status === 'pending' && s.run_at <= nowJst)
    .sort((a, b) => a.run_at.localeCompare(b.run_at))
}

/** 'YYYY-MM-DDTHH:MM' 同士の差（分） */
function minutesBetween(from: string, to: string): number {
  const toMs = (s: string): number => Date.parse(`${s}:00Z`)
  return Math.round((toMs(to) - toMs(from)) / 60_000)
}

export interface SwitchChange {
  name: string
  before: number
  after: number
}

/**
 * 予約を1件実行する。
 *
 * **全部そろっているときだけ切り替える**（半分だけ切り替えると、どちらも出ない・両方出るなどの事故になる）。
 * 予約したVersionが消えていたら何も変えず「実行できなかった」にする。
 * すでに実行した予約は何もしない（見張りが重なっても二度実行しない）。
 */
export function applySwitch(
  state: State,
  switchUid: string,
  nowJst: string,
): { state: State; outcome: 'done' | 'failed' | 'skipped'; changes: SwitchChange[] } {
  const target = state.scheduledSwitches.find((s) => s.uid === switchUid)
  if (target === undefined || target.status !== 'pending') {
    return { state, outcome: 'skipped', changes: [] }
  }

  const finish = (patch: Partial<ScheduledSwitch>, next: State = state): State => ({
    ...next,
    scheduledSwitches: next.scheduledSwitches.map((s) =>
      s.uid === switchUid ? { ...s, done_at: nowJst, ...patch } : s,
    ),
  })

  const versions = target.ratios.map((r) => ({
    reserved: r,
    version: state.versions.find((v) => v.uid === r.version_uid && v.archived !== true),
  }))
  if (versions.some((v) => v.version === undefined)) {
    return {
      state: finish({ status: 'failed', note: '予約したVersionが見つかりません（削除またはアーカイブされた）。配信割合は変えていません。' }),
      outcome: 'failed',
      changes: [],
    }
  }

  const ratioOf = new Map(target.ratios.map((r) => [r.version_uid, r.ratio]))
  const switched: State = {
    ...state,
    versions: state.versions.map((v) => {
      const ratio = ratioOf.get(v.uid)
      return ratio === undefined ? v : { ...v, distribution_ratio: ratio }
    }),
  }
  const late = minutesBetween(target.run_at, nowJst) > LATE_MINUTES
  return {
    state: finish(
      {
        status: 'done',
        note: late ? `予定（${target.run_at.replace('T', ' ')}）より遅れて実行しました（サーバーの再起動などのため）。` : '',
      },
      switched,
    ),
    outcome: 'done',
    changes: versions.map(({ reserved, version }) => ({
      name: version?.name ?? '',
      before: version?.distribution_ratio ?? 0,
      after: reserved.ratio,
    })),
  }
}
