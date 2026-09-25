/**
 * 計測タグが離脱時にまとめて送る「ヒートマップ」を積む（delivery.ts から分離・2026-09-16）。
 *
 * 回数ではなく「ページのどこか」を積む。到達率/離脱率/滞在時間/クリック数の材料。
 * 同じ送信に添えてくる読み込み時間（表示の遅さ）もここで積む。
 * 状態を受け取って新しい状態を返すだけ（保存と応答は送り口が持つ）。
 *
 * 2026-09-24: 端末ごとの行（deviceHeatmapStats）にも積む（点検29）。広告パラメータには分けない。
 */
import { parseLoad, recordPageSpeed } from '../store/page-speed.ts'
import type { DeviceKind, HeatmapStat, State } from '../store/types.ts'

/** 1回の表示ぶんの記録（送られてきた中身を読み直したもの） */
interface HeatmapSample {
  bands: number
  reach: number[]
  dwell: number[]
  exitBand: number
  fvBands: number | undefined
  offerBand: number | undefined
  clicks: { x: number; y: number; cx?: number }[]
  isViewportBasis: boolean
}

/** 合算・広告ごとの行に持つクリックの上限（古いものから捨てる） */
const CLICK_CAP = 5000
/** 端末ごとの行に持つクリックの上限（行が増えるぶん、保存の容量を抑える） */
const DEVICE_CLICK_CAP = 2000

function readSample(body: unknown): { sample: HeatmapSample; params: string[] } {
  const hb = body as {
    bands?: unknown
    reach?: unknown
    dwell?: unknown
    exit_band?: unknown
    /** 画面1枚ぶんが何バンドか（ファーストビューの範囲） */
    fv?: unknown
    /** 最初の計測リンクが何バンド目か */
    offer?: unknown
    /** 着地URLの広告パラメータ（`utm_source=fb` の形） */
    params?: unknown
    clicks?: unknown
    /** 1 ＝ 画面の下端で到達を数えた新しいタグ（2026-09-24）。無ければ古いタグ（スクロールの進み具合） */
    rb?: unknown
  }
  const bands = typeof hb.bands === 'number' && hb.bands > 0 && hb.bands <= 100 ? hb.bands : 20
  const numArray = (v: unknown, n: number): number[] => {
    const src = Array.isArray(v) ? v : []
    return Array.from({ length: n }, (_, i) => {
      const x = src[i]
      return typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0
    })
  }
  const clicks = (Array.isArray(hb.clicks) ? hb.clicks : [])
    .slice(0, 300)
    .map((c) => c as { x?: unknown; y?: unknown; cx?: unknown })
    .filter((c) => typeof c.x === 'number' && typeof c.y === 'number')
    // cx＝画面の真ん中から何px（2026-09-25から計測タグが送る）。古いタグの送信には無い
    .map((c) => ({
      x: c.x as number,
      y: c.y as number,
      ...(typeof c.cx === 'number' && Number.isFinite(c.cx) && Math.abs(c.cx) <= 5000 ? { cx: Math.round(c.cx) } : {}),
    }))
  return {
    sample: {
      bands,
      reach: numArray(hb.reach, bands),
      dwell: numArray(hb.dwell, bands),
      exitBand:
        typeof hb.exit_band === 'number' && hb.exit_band >= 0 && hb.exit_band < bands ? Math.floor(hb.exit_band) : 0,
      // ファーストビューの幅と、最初の計測リンクの位置（2026-09-15・FVER/SVER/FSVER/OAR の材料）
      fvBands: typeof hb.fv === 'number' && hb.fv >= 1 && hb.fv <= bands ? Math.floor(hb.fv) : undefined,
      offerBand:
        typeof hb.offer === 'number' && hb.offer >= 0 && hb.offer < bands ? Math.floor(hb.offer) : undefined,
      clicks,
      // 古いタグの送信も受ける（外部LPのブラウザに古いタグが残っていることがある）。数え方の新旧だけ数えておく
      isViewportBasis: hb.rb === 1,
    },
    params: adParamsOf(hb.params),
  }
}

/**
 * 1人ぶんの FV/SV 離脱とボタン到達（どれも 0 か 1）。
 *
 * 画面1枚ぶんの幅（fv）とボタンの位置（offer）は、その人の画面の高さ・LPの横幅で変わる。
 * 行に1つだけ持つと、スマホとPCが混ざったときに別の人の画面で数えてしまうので、ここで1人ずつ判定する。
 * fv が来ない送信（ごく古いタグ）はこの数え方の母数に入れない。
 */
function judgeView(sample: HeatmapSample): {
  counted: number
  fvExit: number
  svExit: number
  hasOffer: number
  offerReach: number
} {
  const fv = sample.fvBands
  const offer = sample.offerBand
  const hasOffer = fv !== undefined && offer !== undefined
  return {
    counted: fv === undefined ? 0 : 1,
    fvExit: fv !== undefined && sample.exitBand < fv ? 1 : 0,
    svExit: fv !== undefined && sample.exitBand >= fv && sample.exitBand < fv * 2 ? 1 : 0,
    hasOffer: hasOffer ? 1 : 0,
    offerReach: hasOffer && (sample.reach[offer] ?? 0) > 0 ? 1 : 0,
  }
}

/**
 * 1回の表示ぶんを、条件に合う行へ足す（無ければ作る）。
 * 分割数(bands)も一致条件に入れる。分割数を変えたときに、古い配列へ新しい長さの値を足し込んで数字を壊さないため。
 */
function mergeSample<T extends HeatmapStat>(
  stats: readonly T[],
  isSame: (h: T) => boolean,
  fresh: () => T,
  sample: HeatmapSample,
  clickCap: number,
): readonly T[] {
  const idx = stats.findIndex((h) => h.bands === sample.bands && isSame(h))
  const base = idx === -1 ? fresh() : stats[idx]!
  const view = judgeView(sample)
  const merged: T = {
    ...base,
    pv: base.pv + 1,
    vb_pv: (base.vb_pv ?? 0) + (sample.isViewportBasis ? 1 : 0),
    // FV/SV離脱・ボタン到達は、この人の画面の幅・この人に見えたボタンの位置で判定して足す（2026-09-25）
    scroll_pv: (base.scroll_pv ?? 0) + view.counted,
    fv_exit_n: (base.fv_exit_n ?? 0) + view.fvExit,
    sv_exit_n: (base.sv_exit_n ?? 0) + view.svExit,
    offer_pv: (base.offer_pv ?? 0) + view.hasOffer,
    offer_reach_n: (base.offer_reach_n ?? 0) + view.offerReach,
    // ページの作りで決まる値。届いたら最後のもので上書きする
    fv_bands: sample.fvBands ?? base.fv_bands,
    offer_band: sample.offerBand ?? base.offer_band,
    reach: base.reach.map((v, i) => v + (sample.reach[i] ?? 0)),
    exit: base.exit.map((v, i) => v + (i === sample.exitBand ? 1 : 0)),
    dwell_ms: base.dwell_ms.map((v, i) => v + (sample.dwell[i] ?? 0)),
    dwell_n: base.dwell_n.map((v, i) => v + ((sample.dwell[i] ?? 0) > 0 ? 1 : 0)),
    // クリックは増え続けるので上限を設ける（古いものから捨てる）
    clicks: [...base.clicks, ...sample.clicks].slice(-clickCap),
  }
  return idx === -1 ? [...stats, merged] : stats.map((h, i) => (i === idx ? merged : h))
}

function emptyStat(abTestUid: string, versionUid: string, date: string, bands: number, param: string): HeatmapStat {
  return {
    ab_test_uid: abTestUid,
    version_uid: versionUid,
    date,
    bands,
    param,
    pv: 0,
    reach: new Array<number>(bands).fill(0),
    exit: new Array<number>(bands).fill(0),
    dwell_ms: new Array<number>(bands).fill(0),
    dwell_n: new Array<number>(bands).fill(0),
    clicks: [],
  }
}

export function mergeHeatmapEvent(
  s: State,
  input: { abTestUid: string; versionUid: string; date: string; body: unknown; device: DeviceKind },
): State {
  const { abTestUid, versionUid, date, body, device } = input
  const { sample, params } = readSample(body)
  const sameRow = (h: HeatmapStat): boolean =>
    h.ab_test_uid === abTestUid && h.version_uid === versionUid && h.date === date

  // 合算（param='')と、広告パラメータごとの行の両方に積む。
  // こうすると「utm_source=fb で来た人だけのヒートマップ」が引ける。
  // 1回の表示は合算では必ず1PV。パラメータの行では、そのパラメータが付いていた表示だけを数える。
  let stats = s.heatmapStats
  for (const param of ['', ...params]) {
    stats = mergeSample(
      stats,
      (h) => sameRow(h) && (h.param ?? '') === param,
      () => emptyStat(abTestUid, versionUid, date, sample.bands, param),
      sample,
      CLICK_CAP,
    )
  }
  // 端末ごとの行（広告パラメータには分けない・2026-09-24）
  const deviceHeatmapStats = mergeSample(
    s.deviceHeatmapStats,
    (h) => sameRow(h) && h.device === device,
    () => ({ ...emptyStat(abTestUid, versionUid, date, sample.bands, ''), device }),
    sample,
    DEVICE_CLICK_CAP,
  )
  // 表示の遅さ（2026-09-16）。広告パラメータには分けず、ページ×Version×日で1人1件
  const load = parseLoad((body as { load?: unknown }).load)
  const pageSpeedStats =
    load === null
      ? s.pageSpeedStats
      : recordPageSpeed(s.pageSpeedStats, { ab_test_uid: abTestUid, version_uid: versionUid, date }, load)
  return {
    ...s,
    heatmapStats: stats,
    deviceHeatmapStats,
    deviceRecordedSince: s.deviceRecordedSince ?? date,
    pageSpeedStats,
  }
}

/**
 * 着地URLの広告パラメータを選び直す。
 *
 * 計測タグ側でも `utm_` だけに絞っているが、送り口は誰でも叩けるので
 * サーバーでも同じ条件で選ぶ（`utm_` で始まる key=value だけ・長さと本数に上限）。
 */
export function adParamsOf(raw: unknown): string[] {
  return [
    ...new Set(
      (Array.isArray(raw) ? raw : [])
        .filter((p): p is string => typeof p === 'string')
        .map((p) => p.slice(0, 160))
        .filter((p) => /^utm_[A-Za-z0-9_]{1,24}=.+$/.test(p)),
    ),
  ].slice(0, 20)
}
