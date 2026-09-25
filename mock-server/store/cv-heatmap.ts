/**
 * 申し込んだ人だけのヒートマップ（2026-09-25・本人「申し込んだ人が実際どこまで読んでどこ押したかをヒートマップ上に出したい」）。
 *
 * 位置の記録（計測タグの heatmap）はLPを離れたときに届き、申し込み（CVタグの cv）はあとから別のページで届く。
 * 同じ人の目印（vid）で結びつける:
 *   - 位置の記録が届いたとき … その人の申し込みがもう数えられていれば、すぐ「申し込んだ人」の行に足す。
 *                               まだなら預かる。申し込みが数えられうる人（CV条件がクリックなら計測リンクを押した人・
 *                               アクセスなら見た人全員）は1日、まだ押していない人は10分
 *                               （位置の記録が「押した」記録より先に届くことがある。押した記録が届いたら1日に延ばす）
 *   - 申し込みが数えられたとき … 預かっていた記録を「申し込んだ人」の行に足し、預かりから外す
 * 行の日付は申し込みが数えられた日（レポートのCVと同じ日）。端末ごと・広告パラメータごと（param）にも足す。
 * 状態を受け取って新しい状態を返すだけ。
 */
import { toDateKey } from './metrics.ts'
import { CLICK_CAP, emptyStat, mergeSample, type HeatmapSample } from './heatmap-sample.ts'
import { ATTRIBUTION_WINDOW_MS } from './visitor-touches.ts'
import type { ConversionCondition, CvHeatmapStat, DeviceKind, PendingCvHeatmap, State } from './types.ts'

/** 預かる数の上限（流入が急に増えても保存データが膨らみすぎないよう、古いものから捨てる） */
const MAX_PENDING = 2000
/**
 * 押す前に届いた記録を待つ時間。位置の記録と「押した」記録はほぼ同時に送られ、届く順番が入れ替わることがある
 * （本番で18人中8人がこれで落ちた・2026-09-25）。押した記録はふつう数秒以内に届く。
 */
const UNCLICKED_GRACE_MS = 10 * 60 * 1000
/** 預かる記録のクリックの上限（1人ぶん） */
const PENDING_CLICK_CAP = 50

interface Held {
  abTestUid: string
  versionUid: string
  device: DeviceKind
  params: readonly string[]
  sample: HeatmapSample
}

/** 1人ぶんの記録を「申し込んだ人」の行（合算と広告ごと）に足す */
function addToCvRows(stats: readonly CvHeatmapStat[], held: Held, date: string): readonly CvHeatmapStat[] {
  let next = stats
  for (const param of ['', ...held.params]) {
    next = mergeSample(
      next,
      (h) =>
        h.ab_test_uid === held.abTestUid &&
        h.version_uid === held.versionUid &&
        h.date === date &&
        h.device === held.device &&
        (h.param ?? '') === param,
      () => ({ ...emptyStat(held.abTestUid, held.versionUid, date, held.sample.bands, param), device: held.device }),
      held.sample,
      CLICK_CAP,
    )
  }
  return next
}

/** 押した人の記録は1日、押す前の記録は10分で捨てる。上限を超えたら押す前の記録から、古いものから捨てる */
function freshPending(list: readonly PendingCvHeatmap[], now: number): PendingCvHeatmap[] {
  const alive = list.filter((p) =>
    p.clicked === false ? now - p.at <= UNCLICKED_GRACE_MS : now - p.at <= ATTRIBUTION_WINDOW_MS,
  )
  if (alive.length <= MAX_PENDING) return alive
  const unclicked = alive.filter((p) => p.clicked === false)
  const drop = new Set(unclicked.slice(0, Math.min(unclicked.length, alive.length - MAX_PENDING)))
  const kept = alive.filter((p) => !drop.has(p))
  return kept.length > MAX_PENDING ? kept.slice(-MAX_PENDING) : kept
}

/** 位置の記録が届いたとき（目印つき） */
export function holdOrAddCvHeatmap(
  state: State,
  input: Held & { vid: string; condition: ConversionCondition; now: number },
): State {
  const touch = state.visitorTouches.find((t) => t.vid === input.vid && t.ab_test_uid === input.abTestUid)
  if (touch === undefined) return state
  // 申し込みがもう数えられている（申し込みの方が先に届いた）
  if (touch.converted_at !== null) {
    return {
      ...state,
      cvHeatmapStats: addToCvRows(state.cvHeatmapStats, input, toDateKey(new Date(touch.converted_at))),
    }
  }
  // 申し込みが数えられうる人（クリック条件なら押した人）は1日、まだ押していない人は10分だけ預かる
  // （位置の記録が「押した」記録より先に届くことがあるため・markPendingClicked で1日に延びる）
  const clicked = input.condition === 'access' || touch.clicked_at !== null
  const held: PendingCvHeatmap = {
    vid: input.vid,
    ab_test_uid: input.abTestUid,
    version_uid: input.versionUid,
    device: input.device,
    params: input.params,
    at: input.now,
    clicked,
    sample: { ...input.sample, clicks: input.sample.clicks.slice(-PENDING_CLICK_CAP) },
  }
  const others = freshPending(state.pendingCvHeatmaps, input.now).filter(
    (p) => !(p.vid === input.vid && p.ab_test_uid === input.abTestUid),
  )
  return { ...state, pendingCvHeatmaps: freshPending([...others, held], input.now) }
}

/** 計測リンクを押した記録が届いたとき。押す前に預かっていた記録を、1日預かる扱いにする */
export function markPendingClicked(state: State, input: { abTestUid: string; vid: string }): State {
  const index = state.pendingCvHeatmaps.findIndex(
    (p) => p.vid === input.vid && p.ab_test_uid === input.abTestUid && p.clicked === false,
  )
  if (index === -1) return state
  return {
    ...state,
    pendingCvHeatmaps: state.pendingCvHeatmaps.map((p, i) => (i === index ? { ...p, clicked: true } : p)),
  }
}

/** 申し込みが数えられたとき。預かっていた記録があれば行に足す */
export function releaseCvHeatmap(state: State, input: { abTestUid: string; vid: string; now: number }): State {
  const pending = freshPending(state.pendingCvHeatmaps, input.now)
  const held = pending.find((p) => p.vid === input.vid && p.ab_test_uid === input.abTestUid)
  if (held === undefined) return pending.length === state.pendingCvHeatmaps.length ? state : { ...state, pendingCvHeatmaps: pending }
  return {
    ...state,
    pendingCvHeatmaps: pending.filter((p) => p !== held),
    cvHeatmapStats: addToCvRows(
      state.cvHeatmapStats,
      {
        abTestUid: held.ab_test_uid,
        versionUid: held.version_uid,
        device: held.device,
        params: held.params,
        sample: held.sample,
      },
      toDateKey(new Date(input.now)),
    ),
  }
}
