/**
 * リンク切れの見張りを回す（2026-09-16・本人の依頼）。
 *
 * 30秒ごとの見張り（task-runner）から呼ばれ、確かめる時刻が来たリンクだけ確かめる。
 * 2回続けて開けなかったら、異常のお知らせと同じ送り先へ、ページごとに1日1通まで知らせる。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LinkProbe } from '../mock-server/link-check.ts'

const spy = vi.hoisted(() => ({ sent: [] as { service: string; text: string }[] }))

vi.mock('../mock-server/notify.ts', () => ({
  NotifyError: class NotifyError extends Error {},
  sendNotification: (service: string, _id: string, text: string): Promise<void> => {
    spy.sent.push({ service, text })
    return Promise.resolve()
  },
}))

const { runLinkChecks, MAX_PROBES_PER_RUN } = await import('../mock-server/link-check-runner.ts')
const { LINK_RECHECK_MS } = await import('../mock-server/link-check.ts')
const { getState, resetState, setState } = await import('../mock-server/store/store.ts')

const CART = 'https://shop.example.test/cart?sb_tracking=true'
const NOW = Date.UTC(2026, 8, 16, 3, 0)

function seed(options: { enabled?: boolean; linkCheck?: boolean; notify?: boolean; html?: string } = {}): void {
  resetState()
  setState((s) => ({
    ...s,
    abTests: [{ ...(s.abTests[0] ?? ({} as never)), id: 1, uid: 'AB1', title: '本命LP', ad_status: 'prepared' } as never],
    articles: [{ id: 11, uid: 'ART1', ab_test_id: 1, memo: '', archived: false, style_applied: false, created_at: 0, updated_timestamp: 0 }],
    versions: [
      {
        ...(s.versions[0] ?? ({} as never)),
        id: 101,
        uid: 'V1',
        article_id: 11,
        status: '公開中',
        distribution_ratio: 100,
        archived: false,
        html: options.html ?? `<a href="${CART}">買う</a>`,
      } as never,
    ],
    // 見張るのは直近7日に見られているページだけ
    metrics: [{ entity_uid: 'AB1', scope: 'ab_test', date: '2026-09-16', pv: 10, click: 0, cv: 0, ad_cost: 0, sales: 0 }],
    alertSetting: {
      enabled: options.enabled ?? true,
      cv_silent_hours: 6,
      cpa_limit: 0,
      link_check: options.linkCheck ?? true,
      notify: options.notify === false ? [] : [{ service: 'line', destination_id: '' }],
    },
    alertSentSlots: [],
    linkChecks: [],
  }))
}

const probeWith = (verdict: LinkProbe['verdict'], reason = 'HTTP 404') => {
  const calls: string[] = []
  const probe = (url: string): Promise<LinkProbe> => {
    calls.push(url)
    return Promise.resolve({ verdict, reason })
  }
  return { probe, calls }
}

beforeEach(() => {
  spy.sent.length = 0
})

describe('リンク切れの見張りを回す', () => {
  it('2回続けて開けなかったら、ページごとに1通知らせる', async () => {
    seed()
    const { probe } = probeWith('broken')

    await runLinkChecks(NOW, probe)
    expect(spy.sent, '1回目では知らせない').toHaveLength(0)

    await runLinkChecks(NOW + LINK_RECHECK_MS, probe)
    expect(spy.sent).toHaveLength(1)
    expect(spy.sent[0]?.text).toContain('リンクが開けません')
    expect(spy.sent[0]?.text).toContain(CART)
  })

  it('同じページは1日1通まで', async () => {
    seed()
    const { probe } = probeWith('broken')
    for (let i = 0; i < 5; i += 1) await runLinkChecks(NOW + i * LINK_RECHECK_MS, probe)
    expect(spy.sent).toHaveLength(1)
  })

  it('確かめる時刻が来ていないリンクは確かめない（10分おき）', async () => {
    seed()
    const { probe, calls } = probeWith('ok', 'HTTP 200')
    await runLinkChecks(NOW, probe)
    await runLinkChecks(NOW + 30_000, probe)
    expect(calls).toHaveLength(1)
  })

  it('開けたら何も送らない', async () => {
    seed()
    const { probe } = probeWith('ok', 'HTTP 200')
    await runLinkChecks(NOW, probe)
    await runLinkChecks(NOW + LINK_RECHECK_MS * 20, probe)
    expect(spy.sent).toHaveLength(0)
  })

  it('お知らせが切・リンクの見張りが切・送り先が無いときは、確かめもしない（外へ取りに行かない）', async () => {
    for (const options of [{ enabled: false }, { linkCheck: false }, { notify: false }]) {
      seed(options)
      const { probe, calls } = probeWith('broken')
      await runLinkChecks(NOW, probe)
      expect(calls, JSON.stringify(options)).toHaveLength(0)
    }
  })

  it('LPから消えたリンクの記録は捨てる（直したあとに古い失敗で鳴らない）', async () => {
    seed()
    const { probe } = probeWith('broken')
    await runLinkChecks(NOW, probe)
    expect(getState().linkChecks).toHaveLength(1)

    setState((s) => ({ ...s, versions: s.versions.map((v) => ({ ...v, html: '<p>リンクなし</p>' })) }))
    await runLinkChecks(NOW + LINK_RECHECK_MS, probe)
    expect(getState().linkChecks).toEqual([])
    expect(spy.sent).toHaveLength(0)
  })

  it(`1回に確かめるのは${MAX_PROBES_PER_RUN}本まで（残りは次の回へ）`, async () => {
    const html = Array.from({ length: MAX_PROBES_PER_RUN + 10 }, (_, i) => `<a href="https://shop.example.test/item${i}?sb_tracking=true">x</a>`).join('')
    seed({ html })
    const { probe, calls } = probeWith('ok', 'HTTP 200')
    await runLinkChecks(NOW, probe)
    expect(calls).toHaveLength(MAX_PROBES_PER_RUN)
    await runLinkChecks(NOW + 30_000, probe)
    expect(calls).toHaveLength(MAX_PROBES_PER_RUN + 10)
  })
})
