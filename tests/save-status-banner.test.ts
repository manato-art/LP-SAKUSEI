/**
 * 数字の保存に失敗しているあいだ、管理画面のいちばん上に赤い帯を出す（2026-10-29）。
 * 異常のお知らせが切でも、画面を開いた人には必ず分かるように。直ったら消す。
 * サーバーは保存の様子を返す（GET /system/save_status）。
 */
import { parseHTML } from 'linkedom'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getJson, startTestServer, type TestServer } from './helpers/server.ts'

function dom(): Document {
  const { document } = parseHTML('<!doctype html><html><head></head><body><div id="root"></div></body></html>')
  ;(globalThis as unknown as Record<string, unknown>)['document'] = document
  return document
}

describe('管理画面の赤い帯', () => {
  it('失敗しているあいだは、最後に保存できた時刻（日本時間）と、連絡してほしいことを出す。直ったら消す', async () => {
    const doc = dom()
    const { renderSaveStatusBanner } = await import('../src/app/save-status-banner.ts')
    renderSaveStatusBanner({ ok: false, failures: 2, last_ok_at: '2026-10-29T05:05:00.000Z' })
    const bar = doc.querySelector('[data-save-status-banner]')
    expect(bar?.textContent).toContain('数字の保存に失敗しています')
    expect(bar?.textContent).toContain('10月29日 14:05')
    expect(bar?.textContent).toContain('担当者')
    expect(bar?.getAttribute('role')).toBe('alert')
    renderSaveStatusBanner({ ok: true, failures: 0, last_ok_at: '2026-10-29T05:10:00.000Z' })
    expect(doc.querySelector('[data-save-status-banner]')).toBeNull()
  })

  it('一度も保存できていないときは、そう書く。2回描いても帯は1本', async () => {
    const doc = dom()
    const { renderSaveStatusBanner } = await import('../src/app/save-status-banner.ts')
    renderSaveStatusBanner({ ok: false, failures: 1, last_ok_at: null })
    renderSaveStatusBanner({ ok: false, failures: 2, last_ok_at: null })
    expect(doc.querySelectorAll('[data-save-status-banner]')).toHaveLength(1)
    expect(doc.querySelector('[data-save-status-banner]')?.textContent).toContain('まだ一度も保存できていません')
  })
})

describe('保存の様子を返す API', () => {
  let server: TestServer
  beforeAll(async () => {
    server = await startTestServer()
  })
  afterAll(async () => {
    await server.close()
  })

  it('失敗していなければ ok・続けての失敗は0', async () => {
    const res = await getJson<{ save_status: { ok: boolean; failures: number; last_ok_at: string | null } }>(
      `${server.api}/system/save_status`,
    )
    expect(res.save_status.ok).toBe(true)
    expect(res.save_status.failures).toBe(0)
    expect(res.save_status).toHaveProperty('last_ok_at')
  })
})
