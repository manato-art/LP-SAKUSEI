import { describe, it, expect, afterEach } from 'vitest'
import { aggregateRows, isMetaConfigured, readMetaConfig } from '../mock-server/lib/meta-client.ts'

/**
 * Meta実データ連携（指示⑤⑧・cockpit方式の移植）。
 * ネットワークを伴う fetch は回さず、集計ロジックと env 設定読みを純粋に検証する。
 */
describe('aggregateRows: Meta insights を集計KPIへ畳む', () => {
  it('spend/impressions/clicks/CV/ROAS を正しく合算・換算する', () => {
    const kpi = aggregateRows([
      {
        spend: '1000',
        impressions: '50000',
        clicks: '500',
        inline_link_clicks: '400',
        actions: [
          { action_type: 'offsite_conversion.fb_pixel_purchase', value: '10' },
          { action_type: 'lead', value: '5' },
          { action_type: 'landing_page_view', value: '300' }, // CVには数えない
        ],
        purchase_roas: [{ action_type: 'omni_purchase', value: '3.5' }],
      },
    ])
    expect(kpi.ad_cost).toBe(1000)
    expect(kpi.pv).toBe(50000)
    expect(kpi.click).toBe(400) // inline_link_clicks を優先
    expect(kpi.media_click).toBe(500)
    expect(kpi.cv).toBe(15) // purchase(10) + lead(5)
    expect(kpi.ctr).toBe(1) // 500/50000*100
    expect(kpi.roas).toBe(3.5)
  })

  it('複数行（日別）を合算し、ROASは費用で加重平均する', () => {
    const kpi = aggregateRows([
      { spend: '100', impressions: '1000', clicks: '10', purchase_roas: [{ action_type: 'x', value: '2' }] },
      { spend: '300', impressions: '3000', clicks: '30', purchase_roas: [{ action_type: 'x', value: '4' }] },
    ])
    expect(kpi.ad_cost).toBe(400)
    expect(kpi.pv).toBe(4000)
    expect(kpi.media_click).toBe(40)
    // 加重平均: (2*100 + 4*300)/400 = 3.5
    expect(kpi.roas).toBe(3.5)
  })

  it('空・費用0は null/0 で返す（ゼロ除算しない）', () => {
    const kpi = aggregateRows([])
    expect(kpi.ad_cost).toBe(0)
    expect(kpi.ctr).toBeNull()
    expect(kpi.roas).toBeNull()
  })
})

describe('readMetaConfig: env から認証情報を読む', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it('未設定なら null・configured=false', () => {
    delete process.env['META_ACCESS_TOKEN']
    delete process.env['META_AD_ACCOUNT_ID']
    expect(readMetaConfig()).toBeNull()
    expect(isMetaConfigured()).toBe(false)
  })

  it('act_ の二重付与を防ぎ、versionは既定 v22.0', () => {
    process.env['META_ACCESS_TOKEN'] = 'TESTTOKEN'
    process.env['META_AD_ACCOUNT_ID'] = '1234567890' // 数字だけ
    delete process.env['META_API_VERSION']
    const config = readMetaConfig()
    expect(config?.accountId).toBe('act_1234567890')
    expect(config?.version).toBe('v22.0')
    expect(isMetaConfigured()).toBe(true)
  })

  it('act_ 付きでもそのまま act_ 一つ', () => {
    process.env['META_ACCESS_TOKEN'] = 'T'
    process.env['META_AD_ACCOUNT_ID'] = 'act_999'
    expect(readMetaConfig()?.accountId).toBe('act_999')
  })
})
