/**
 * 計測タグが離脱時にまとめて送る「ヒートマップ」を積む（delivery.ts から分離・2026-09-16）。
 *
 * 回数ではなく「ページのどこか」を積む。到達率/離脱率/滞在時間/クリック数の材料。
 * 同じ送信に添えてくる読み込み時間（表示の遅さ）もここで積む。
 * 状態を受け取って新しい状態を返すだけ（保存と応答は送り口が持つ）。
 */
import { parseLoad, recordPageSpeed } from '../store/page-speed.ts'
import type { State } from '../store/types.ts'

export function mergeHeatmapEvent(
  s: State,
  input: { abTestUid: string; versionUid: string; date: string; body: unknown },
): State {
  const { abTestUid, versionUid, date, body } = input
  const hb = body as unknown as {
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
  const reach = numArray(hb.reach, bands)
  const dwell = numArray(hb.dwell, bands)
  const exitBand =
    typeof hb.exit_band === 'number' && hb.exit_band >= 0 && hb.exit_band < bands
      ? Math.floor(hb.exit_band)
      : 0
  // ファーストビューの幅と、最初の計測リンクの位置（2026-09-15・FVER/SVER/FSVER/OAR の材料）
  const fvBands =
    typeof hb.fv === 'number' && hb.fv >= 1 && hb.fv <= bands ? Math.floor(hb.fv) : undefined
  const offerBand =
    typeof hb.offer === 'number' && hb.offer >= 0 && hb.offer < bands
      ? Math.floor(hb.offer)
      : undefined
  const params = adParamsOf(hb.params)
  // 古いタグの送信も受ける（外部LPのブラウザに古いタグが残っていることがある）。数え方の新旧だけ数えておく
  const isViewportBasis = hb.rb === 1

  const clicks = (Array.isArray(hb.clicks) ? hb.clicks : [])
    .slice(0, 300)
    .map((c) => c as { x?: unknown; y?: unknown })
    .filter((c) => typeof c.x === 'number' && typeof c.y === 'number')
    .map((c) => ({ x: c.x as number, y: c.y as number }))


  // 合算（param='')と、広告パラメータごとの行の両方に積む。
  // こうすると「utm_source=fb で来た人だけのヒートマップ」が引ける。
  // 1回の表示は合算では必ず1PV。パラメータの行では、そのパラメータが付いていた表示だけを数える。
  let stats = s.heatmapStats
  for (const param of ['', ...params]) {
    // 分割数(bands)も一致条件に入れる。分割数を変えたときに、
    // 古い配列へ新しい長さの値を足し込んで数字を壊さないため。
    const idx = stats.findIndex(
      (h) =>
        h.ab_test_uid === abTestUid &&
        h.version_uid === versionUid &&
        h.date === date &&
        h.bands === bands &&
        (h.param ?? '') === param,
    )
    const base =
      idx === -1
        ? {
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
            clicks: [] as { x: number; y: number }[],
          }
        : stats[idx]!
    const merged = {
      ...base,
      param,
      pv: base.pv + 1,
      vb_pv: (base.vb_pv ?? 0) + (isViewportBasis ? 1 : 0),
      // ページの作りで決まる値。届いたら最後のもので上書きする
      fv_bands: fvBands ?? base.fv_bands,
      offer_band: offerBand ?? base.offer_band,
      reach: base.reach.map((v, i) => v + (reach[i] ?? 0)),
      exit: base.exit.map((v, i) => v + (i === exitBand ? 1 : 0)),
      dwell_ms: base.dwell_ms.map((v, i) => v + (dwell[i] ?? 0)),
      dwell_n: base.dwell_n.map((v, i) => v + ((dwell[i] ?? 0) > 0 ? 1 : 0)),
      // クリックは増え続けるので上限を設ける（古いものから捨てる）
      clicks: [...base.clicks, ...clicks].slice(-5000),
    }
    stats = idx === -1 ? [...stats, merged] : stats.map((h, i) => (i === idx ? merged : h))
  }
  // 表示の遅さ（2026-09-16）。広告パラメータには分けず、ページ×Version×日で1人1件
  const load = parseLoad((body as { load?: unknown }).load)
  const pageSpeedStats =
    load === null
      ? s.pageSpeedStats
      : recordPageSpeed(s.pageSpeedStats, { ab_test_uid: abTestUid, version_uid: versionUid, date }, load)
  return { ...s, heatmapStats: stats, pageSpeedStats }
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
