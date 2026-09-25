/**
 * スクロールの記録（ヒートマップ）を数える（2026-09-15）。
 *
 * FVER / SVER / FSVER / OAR の一次値と、いちばん離脱が多い位置を出す。
 * レポート画面と定期レポートの**両方**がここを通す。数え方を2か所に書くと必ずずれる。
 */
import { isWithin } from './metrics.ts'
import type { State } from './types.ts'

/**
 * スクロールの記録（ヒートマップ）から FVER / SVER / FSVER / OAR の一次値を出す（2026-09-15）。
 *
 *   fv_bands … 画面1枚ぶんが何バンドか（計測タグが送る）
 *   fv_exit  … 先頭から fv_bands 個ぶんのバンドで離脱した数
 *   sv_exit  … その次の fv_bands 個ぶんで離脱した数
 *   offer_reach … 最初の計測リンクがあるバンドまで到達した数
 *
 * 2026-09-25 からは、記録を受けたときに1人ずつ**その人の画面で**判定した数（scroll_pv・fv_exit_n など）を使う。
 * 画面の幅もボタンの位置も端末で違うので、上の「行に1つの fv_bands」で全員を数えると全端末の率がずれた。
 * fv_bands / offer_band で数えるのは、それより前の保存データだけ。
 *
 * 記録がまだ無ければ 0 件のまま返す（deriveKpi 側で「-」になる）。
 */
/**
 * スクロールの記録を数える（FVER/SVER/FSVER/OAR の材料）。
 *
 * `param` を渡すとその広告で来た表示だけを数える。既定は合算（`param=''`）。
 * **合算と広告ごとの行は同じ表示を二重に持っている**ので、必ずどちらか一方だけを見る
 * （混ぜると広告が多く付いた表示ほど重く数えられて率が狂う。2026-09-15に踏んだ）。
 */
export function scrollCounts(
  state: State,
  versionUid: string,
  startDate: string,
  endDate: string,
  param = '',
): { hm_pv: number; fv_exit: number; sv_exit: number; offer_reach?: number } {
  const stats = state.heatmapStats.filter(
    (h) =>
      h.version_uid === versionUid &&
      (h.param ?? '') === param &&
      isWithin(h.date, startDate, endDate),
  )
  let hmPv = 0
  let fvExit = 0
  let svExit = 0
  let offerReach = 0
  let hasOffer = false
  for (const stat of stats) {
    // 1人ずつその人の画面で数えた記録がある行はそれを使う（2026-09-25）。
    // 同じ日の行に、それより前の記録（1人ずつの判定が無い）が混ざっていたら、その分は母数にも入れない
    if (stat.scroll_pv !== undefined) {
      hmPv += stat.scroll_pv
      fvExit += stat.fv_exit_n ?? 0
      svExit += stat.sv_exit_n ?? 0
      if ((stat.offer_pv ?? 0) > 0) {
        hasOffer = true
        offerReach += stat.offer_reach_n ?? 0
      }
      continue
    }
    // ここから下は古い保存データ（行に1つだけ持った画面の幅・ボタンの位置で数える）
    hmPv += stat.pv
    const fv = stat.fv_bands ?? 0
    if (fv > 0) {
      for (let i = 0; i < fv && i < stat.exit.length; i += 1) fvExit += stat.exit[i] ?? 0
      for (let i = fv; i < fv * 2 && i < stat.exit.length; i += 1) svExit += stat.exit[i] ?? 0
    }
    const offer = stat.offer_band
    if (offer !== undefined) {
      hasOffer = true
      offerReach += stat.reach[offer] ?? 0
    }
  }
  return hasOffer
    ? { hm_pv: hmPv, fv_exit: fvExit, sv_exit: svExit, offer_reach: offerReach }
    : { hm_pv: hmPv, fv_exit: fvExit, sv_exit: svExit }
}

/** beyondページ全体（全Version）のスクロール記録を足す */
export function scrollCountsForAbTest(
  state: State,
  abTestUid: string,
  startDate: string,
  endDate: string,
): { hm_pv: number; fv_exit: number; sv_exit: number; offer_reach?: number } {
  const versionUids = new Set(
    state.heatmapStats
      .filter((h) => h.ab_test_uid === abTestUid && (h.param ?? '') === '')
      .map((h) => h.version_uid),
  )
  let hmPv = 0
  let fvExit = 0
  let svExit = 0
  let offerReach = 0
  let hasOffer = false
  for (const uid of versionUids) {
    const part = scrollCounts(state, uid, startDate, endDate)
    hmPv += part.hm_pv
    fvExit += part.fv_exit
    svExit += part.sv_exit
    if (part.offer_reach !== undefined) {
      hasOffer = true
      offerReach += part.offer_reach
    }
  }
  return hasOffer
    ? { hm_pv: hmPv, fv_exit: fvExit, sv_exit: svExit, offer_reach: offerReach }
    : { hm_pv: hmPv, fv_exit: fvExit, sv_exit: svExit }
}

/** 深さのまとめ方。画面のヒートマップと同じ5%刻みにそろえる。 */
const DEPTH_STEP_PERCENT = 5
const DEPTH_BUCKETS = 100 / DEPTH_STEP_PERCENT

/**
 * いちばん離脱が多い深さと、その割合（2026-09-15）。
 *
 * 通知では絵を送れないので、「何％あたりで読むのをやめているか」を1行で言うために使う。
 * バンドの数は計測タグ側で決まる（今は100分割）ので、**何分割で来ても同じ意味になるよう**
 * 5%刻みに直してから足す。
 *
 * 広告パラメータごとの行は見ない（合算と同じ表示を二重に持っているため）。
 * 記録が無い・離脱が1件も無いときは null。0%と書くと「冒頭で全員離脱」に読めてしまう。
 */
export function exitPeak(
  state: State,
  abTestUid: string,
  startDate: string,
  endDate: string,
): { depth_percent: number; rate: number } | null {
  const stats = state.heatmapStats.filter(
    (h) =>
      h.ab_test_uid === abTestUid &&
      (h.param ?? '') === '' &&
      isWithin(h.date, startDate, endDate),
  )
  if (stats.length === 0) return null

  const buckets = new Array<number>(DEPTH_BUCKETS).fill(0)
  let pv = 0
  for (const stat of stats) {
    pv += stat.pv
    const bands = stat.bands > 0 ? stat.bands : stat.exit.length
    if (bands === 0) continue
    for (let i = 0; i < stat.exit.length; i += 1) {
      // そのバンドの真ん中がどの5%に入るかで振り分ける
      const middle = (i + 0.5) / bands
      const bucket = Math.min(DEPTH_BUCKETS - 1, Math.floor(middle * DEPTH_BUCKETS))
      buckets[bucket] = (buckets[bucket] ?? 0) + (stat.exit[i] ?? 0)
    }
  }
  if (pv === 0) return null

  let topIndex = 0
  for (let i = 1; i < buckets.length; i += 1) {
    if ((buckets[i] ?? 0) > (buckets[topIndex] ?? 0)) topIndex = i
  }
  const top = buckets[topIndex] ?? 0
  if (top === 0) return null

  return { depth_percent: topIndex * DEPTH_STEP_PERCENT, rate: top / pv }
}
