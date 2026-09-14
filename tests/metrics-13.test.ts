/**
 * 一覧・レポートの13列がすべて一次値から算出できることの機械保証。
 *
 * 「13個全部見られるのか」を口頭ではなくここで担保する。
 * 列の並びは採取した実ヘッダのとおり:
 *   配信ステータス / 配信金額 / PV / Click / CTR / CV / CVR / CTVR /
 *   CPA / MCPA / 媒体Click / 媒体CTR / ROAS
 * （配信ステータスだけは指標ではないので対象外＝残り12指標）
 */
import { describe, expect, it } from 'vitest'
import { deriveKpi } from '../mock-server/store/metrics.ts'

describe('13列のKPIが一次値から全部出る', () => {
  const kpi = deriveKpi({
    // LP側（計測タグの実測）
    pv: 1000,
    click: 200,
    cv: 20,
    sales: 240_000,
    // 媒体側（Meta広告APIからの取り込み）
    ad_cost: 100_000,
    imp: 50_000,
    media_click: 1500,
    media_cv: 25,
  })

  it('媒体データが揃えば12指標すべてが数値になる（nullが無い）', () => {
    const cells = {
      配信金額: kpi.ad_cost,
      PV: kpi.pv,
      Click: kpi.click,
      CTR: kpi.ctr,
      CV: kpi.cv,
      CVR: kpi.cvr,
      CTVR: kpi.ctvr,
      CPA: kpi.cpa,
      MCPA: kpi.mcpa,
      媒体Click: kpi.media_click,
      媒体CTR: kpi.media_ctr,
      ROAS: kpi.roas,
    }
    expect(Object.keys(cells)).toHaveLength(12)
    for (const [label, value] of Object.entries(cells)) {
      expect(value, `${label} が算出できていない`).not.toBeNull()
      expect(Number.isFinite(value), `${label} が数値でない`).toBe(true)
    }
  })

  it('恒等式のとおりに算出される', () => {
    expect(kpi.ctr).toBeCloseTo(200 / 1000) // click / pv
    expect(kpi.ctvr).toBeCloseTo(20 / 1000) // cv / pv
    expect(kpi.cvr).toBeCloseTo(20 / 200) // cv / click
    expect(kpi.cpa).toBeCloseTo(100_000 / 20) // ad_cost / cv
    // 2026-09-15: 採取物の列見出しに「クリックあたりの費用 = 配信金額 / CLICK」とある
    expect(kpi.mcpa).toBeCloseTo(100_000 / 200) // ad_cost / click
    expect(kpi.media_ctr).toBeCloseTo(1500 / 50_000) // media_click / imp
    expect(kpi.roas).toBeCloseTo(240_000 / 100_000) // sales / ad_cost
  })

  it('媒体データが未取得でも、LP側だけで出せる指標は出る', () => {
    const noMedia = deriveKpi({ pv: 1000, click: 200, cv: 20, sales: 240_000, ad_cost: 0 })
    // LP側だけで出せるものは出る
    expect(noMedia.ctr).not.toBeNull()
    expect(noMedia.ctvr).not.toBeNull()
    expect(noMedia.cvr).not.toBeNull()
    // MCPA は 配信金額 / CLICK なので、CLICKがあれば出る（配信金額0なら0円）。
    // 2026-09-15に採取物の記述へ合わせた＝もう媒体CVには依存しない
    expect(noMedia.mcpa).toBe(0)
    // 媒体（IMP・売上）が要るものはゼロ除算で null＝UIは「-」
    expect(noMedia.media_ctr).toBeNull()
    expect(noMedia.roas).toBeNull()
  })
})

describe('MCPA の分母（2026-09-15・採取物の記述に合わせた）', () => {
  it('CLICKが0のときだけ「-」になる', () => {
    expect(deriveKpi({ pv: 10, click: 0, cv: 0, ad_cost: 5000 }).mcpa).toBeNull()
    expect(deriveKpi({ pv: 10, click: 5, cv: 0, ad_cost: 5000 }).mcpa).toBe(1000)
  })
})

/**
 * 2026-09-15。本人指示「実際にSBの画面を見て何が足りないのかを採取して実装する」。
 *
 * 実物のレポートには FVER / SVER / FSVER / OAR の4指標がある（採取した列見出しの
 * aria-label: 「ファーストビュー離脱」「セカンドビュー離脱」
 * 「ファーストビュー&セカンドビュー離脱」「オファー到達率 ※最初の広告リンクに到達した率」）。
 *
 * 数字は**計測タグが実際に送っているスクロールの記録**から出す:
 *   hm_pv       … ヒートマップを送ってきた表示数（この4指標の母数）
 *   fv_exit     … 最初の画面（ファーストビュー）の中で離脱した数
 *   sv_exit     … 2画面目の中で離脱した数
 *   offer_reach … 最初の計測リンクの位置まで到達した数
 */
describe('ファーストビュー離脱まわりの4指標', () => {
  it('母数はヒートマップの表示数（スクロールを記録できた表示だけ）', () => {
    const kpi = deriveKpi({
      pv: 200,
      click: 10,
      cv: 1,
      ad_cost: 0,
      hm_pv: 100,
      fv_exit: 30,
      sv_exit: 20,
      offer_reach: 40,
    })
    expect(kpi.fver).toBeCloseTo(0.3)
    expect(kpi.sver).toBeCloseTo(0.2)
    expect(kpi.oar).toBeCloseTo(0.4)
  })

  it('FSVER は「ファーストビュー＋セカンドビュー」の離脱', () => {
    const kpi = deriveKpi({ pv: 0, click: 0, cv: 0, ad_cost: 0, hm_pv: 100, fv_exit: 30, sv_exit: 20 })
    expect(kpi.fsver).toBeCloseTo(0.5)
  })

  it('スクロールの記録がまだ無ければ「-」（0を出して誤解させない）', () => {
    const kpi = deriveKpi({ pv: 500, click: 10, cv: 1, ad_cost: 0 })
    expect(kpi.fver).toBeNull()
    expect(kpi.sver).toBeNull()
    expect(kpi.fsver).toBeNull()
    expect(kpi.oar).toBeNull()
  })

  it('最初の計測リンクが無いLPでは OAR だけ「-」', () => {
    const kpi = deriveKpi({ pv: 100, click: 0, cv: 0, ad_cost: 0, hm_pv: 50, fv_exit: 10, sv_exit: 5 })
    expect(kpi.oar).toBeNull()
    expect(kpi.fver).toBeCloseTo(0.2)
  })
})
