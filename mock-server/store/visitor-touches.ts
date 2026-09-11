/**
 * 訪問者の目印（squadbeyond_uid）ごとの「LPを見た・計測リンクを押した」記録と、CVの照らし合わせ（2026-09-11・本人承認）。
 *
 * SquadBeyond 公式FAQに合わせた数え方:
 *   - CV条件「クリック」: 計測リンクを押してから1日以内の成果だけを、そのとき見ていたVersionのCVに数える
 *   - CV条件「アクセス」: LPを見て（または押して）から1日以内の成果を数える
 *   - 結びつかない成果は数えない（本人承認）。同じ目印の成果は1回だけ数える
 * 目印は LP のリンクに付く squadbeyond_uid（自前配信は Cookie _sb_tu、SquadBeyond 側のLPは本体の _sb_tu）。
 * 1日を過ぎた記録は、記録を足すときに消す（保存データを増やし続けない）。
 */
import type { ConversionCondition, VisitorTouch } from './types.ts'

/** 成果を数える期限（計測リンクを押してから1日） */
export const ATTRIBUTION_WINDOW_MS = 24 * 60 * 60 * 1000

/** 持っておく記録の上限（流入が急に増えても保存データが膨らみすぎないよう、古いものから捨てる） */
const MAX_TOUCHES = 100_000

/** 目印として受け付ける形（UUID など）。HTMLや長すぎる文字列は記録しない */
const VISITOR_ID = /^[A-Za-z0-9._-]{8,100}$/

/** 受け取った値が目印として使える形なら、その文字列を返す */
export function toVisitorId(value: unknown): string | null {
  return typeof value === 'string' && VISITOR_ID.test(value) ? value : null
}

function lastActivity(touch: VisitorTouch): number {
  return Math.max(touch.viewed_at ?? 0, touch.clicked_at ?? 0, touch.converted_at ?? 0)
}

/** 1日を過ぎた記録を消し、上限を超えたら古いものから捨てる */
function prune(touches: readonly VisitorTouch[], now: number): readonly VisitorTouch[] {
  const kept = touches.filter((t) => now - lastActivity(t) <= ATTRIBUTION_WINDOW_MS)
  return kept.length > MAX_TOUCHES ? kept.slice(-MAX_TOUCHES) : kept
}

/** LPを見た・計測リンクを押した記録を足す（同じ目印・同じページなら時刻を更新する） */
export function recordTouch(
  touches: readonly VisitorTouch[],
  input: { vid: string; ab_test_uid: string; version_uid: string; kind: 'view' | 'click'; at: number },
): readonly VisitorTouch[] {
  const pruned = prune(touches, input.at)
  const index = pruned.findIndex((t) => t.vid === input.vid && t.ab_test_uid === input.ab_test_uid)
  const base: VisitorTouch = (index === -1 ? undefined : pruned[index]) ?? {
    vid: input.vid,
    ab_test_uid: input.ab_test_uid,
    version_uid: input.version_uid,
    viewed_at: null,
    clicked_at: null,
    converted_at: null,
  }
  const next: VisitorTouch = {
    ...base,
    version_uid: input.version_uid !== '' ? input.version_uid : base.version_uid,
    ...(input.kind === 'view' ? { viewed_at: input.at } : { clicked_at: input.at }),
  }
  return index === -1 ? [...pruned, next] : pruned.map((t, i) => (i === index ? next : t))
}

export type AttributionResult =
  | { counted: true; touches: readonly VisitorTouch[]; touch: VisitorTouch }
  | { counted: false; reason: 'no_touch' | 'not_in_window' | 'duplicate' }

/** CVタグから届いた成果を、同じページの記録と照らし合わせる。数えるときは、その記録に「数えた」印を付ける */
export function attributeConversion(
  touches: readonly VisitorTouch[],
  input: { vid: string; ab_test_uid: string; condition: ConversionCondition; at: number },
): AttributionResult {
  const index = touches.findIndex((t) => t.vid === input.vid && t.ab_test_uid === input.ab_test_uid)
  const touch = index === -1 ? undefined : touches[index]
  if (touch === undefined) return { counted: false, reason: 'no_touch' }
  if (touch.converted_at !== null) return { counted: false, reason: 'duplicate' }
  const startedAt =
    input.condition === 'access' ? Math.max(touch.viewed_at ?? 0, touch.clicked_at ?? 0) : (touch.clicked_at ?? 0)
  if (startedAt === 0 || input.at - startedAt > ATTRIBUTION_WINDOW_MS) return { counted: false, reason: 'not_in_window' }
  const converted: VisitorTouch = { ...touch, converted_at: input.at }
  return { counted: true, touches: touches.map((t, i) => (i === index ? converted : t)), touch: converted }
}
