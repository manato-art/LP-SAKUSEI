/**
 * Meta の actions から CV を数える（2026-09-24 点検）。
 *
 * purchase と offsite_conversion.fb_pixel_purchase、lead と offsite_conversion.fb_pixel_lead は
 * **同じ成果を別の集計軸で返したもの**なので、足すと CV が2倍になり CPA が半分に見える。
 * 優先順で1つだけ拾う（上部の Meta バナーと同じ定義: lib/meta-client.ts）。
 */
import { describe, expect, it } from 'vitest'
import { conversionsOf } from '../mock-server/meta-insights.ts'

describe('Meta の CV の数え方（重なる種類は足さない）', () => {
  it('purchase と fb_pixel_purchase が両方あっても1つだけ数える', () => {
    const actions = [
      { action_type: 'purchase', value: '5' },
      { action_type: 'offsite_conversion.fb_pixel_purchase', value: '5' },
    ]
    expect(conversionsOf(actions)).toBe(5)
  })

  it('lead と fb_pixel_lead が両方あっても1つだけ数える', () => {
    const actions = [
      { action_type: 'lead', value: '3' },
      { action_type: 'offsite_conversion.fb_pixel_lead', value: '3' },
    ]
    expect(conversionsOf(actions)).toBe(3)
  })

  it('優先順（fb_pixel_purchase が先）で拾う', () => {
    const actions = [
      { action_type: 'lead', value: '9' },
      { action_type: 'offsite_conversion.fb_pixel_purchase', value: '2' },
    ]
    expect(conversionsOf(actions)).toBe(2)
  })

  it('CVに当たる種類が無ければ0（エンゲージメントは数えない）', () => {
    expect(conversionsOf([{ action_type: 'post_engagement', value: '40' }])).toBe(0)
    expect(conversionsOf(undefined)).toBe(0)
  })
})
