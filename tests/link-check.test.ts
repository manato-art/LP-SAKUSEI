/**
 * リンク切れの見張り（2026-09-16・本人の依頼）。
 *
 * LPのボタンの飛び先（カート・申込フォーム・ASPのリンク）が開けなくなったら知らせる。
 * 「CVが止まった」は数時間たってから気づく仕組みなので、その前に気づけるようにする。
 * そのあいだも広告費は出ていく。
 *
 * 作りで気をつけたこと:
 *  - **鳴らしすぎない**。1回開けなかっただけでは知らせず、1分後にもう一度確かめて2回続けて開けなかったら知らせる
 *  - **ボット対策の門前払い（403など）を「リンク切れ」と言わない**。本当に壊れている（404・410・5xx・つながらない）ときだけ
 *  - 見るのは**実際に見られているリンクだけ**（配信中のページの、公開中で配信割合が0より大きいVersion）
 */
import { describe, expect, it } from 'vitest'
import {
  LINK_RECHECK_MS,
  LINK_CHECK_INTERVAL_MS,
  classifyResponse,
  findBrokenLinkAlerts,
  linkTargets,
  probeLink,
  recordProbe,
  trackedLinksOf,
  type LinkCheck,
} from '../mock-server/link-check.ts'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import { ExternalPageError } from '../mock-server/external-page.ts'
import type { State } from '../mock-server/store/types.ts'

describe('LP本文から計測リンクを拾う', () => {
  it('計測機能付きリンク（sb_tracking=true）の飛び先だけ拾う', () => {
    const html = [
      '<a href="https://shop.example.test/cart?sb_tracking=true">買う</a>',
      '<a href="https://example.test/company">会社概要</a>',
      '<a href="tel:0120000000" data-sb-tracking="true">電話</a>',
      '<a href="mailto:info@example.test?sb_tracking=true">メール</a>',
    ].join('')
    expect(trackedLinksOf(html)).toEqual(['https://shop.example.test/cart?sb_tracking=true'])
  })

  it('HTMLの &amp; を & に戻す（そのままだと別のURLを確かめてしまう）', () => {
    const html = '<a href="https://asp.example.test/click?a=1&amp;b=2&amp;sb_tracking=true">申込</a>'
    expect(trackedLinksOf(html)).toEqual(['https://asp.example.test/click?a=1&b=2&sb_tracking=true'])
  })

  it('同じリンクが何度出ても1つにまとめる', () => {
    const link = '<a href="https://shop.example.test/cart?sb_tracking=true">買う</a>'
    expect(trackedLinksOf(link + link + link)).toHaveLength(1)
  })
})

describe('見張る対象', () => {
  const TODAY = '2026-09-16'

  function stateWith(patch: {
    adStatus?: string
    /** 直近のPV（無ければ誰も見ていないページ） */
    pvOn?: { date: string; pv: number }[]
    versions?: { status: string; ratio: number; archived?: boolean; html: string }[]
  }): State {
    const base = createEmptyState()
    return {
      ...base,
      abTests: [
        {
          ...(base.abTests[0] ?? ({} as never)),
          id: 1,
          uid: 'AB1',
          title: '本命LP',
          ad_status: patch.adStatus ?? 'prepared',
        } as never,
      ],
      articles: [{ id: 11, uid: 'ART1', ab_test_id: 1, memo: '', archived: false, style_applied: false, created_at: 0, updated_timestamp: 0 }],
      versions: (patch.versions ?? []).map(
        (v, i) =>
          ({
            ...(base.versions[0] ?? ({} as never)),
            id: 100 + i,
            uid: `V${i}`,
            article_id: 11,
            status: v.status,
            distribution_ratio: v.ratio,
            archived: v.archived ?? false,
            html: v.html,
          }) as never,
      ),
      metrics: (patch.pvOn ?? [{ date: TODAY, pv: 10 }]).map((m) => ({
        entity_uid: 'AB1',
        scope: 'ab_test' as const,
        date: m.date,
        pv: m.pv,
        click: 0,
        cv: 0,
        ad_cost: 0,
        sales: 0,
      })),
    }
  }
  const cart = '<a href="https://shop.example.test/cart?sb_tracking=true">買う</a>'
  const form = '<a href="https://form.example.test/apply?sb_tracking=true">申込</a>'

  it('見られているページの、公開中で配信割合が0より大きいVersionのリンクを見る', () => {
    const state = stateWith({
      versions: [
        { status: '公開中', ratio: 50, html: cart },
        { status: '公開中', ratio: 50, html: form },
      ],
    })
    expect(linkTargets(state, TODAY)).toEqual([
      {
        abTestUid: 'AB1',
        title: '本命LP',
        urls: ['https://shop.example.test/cart?sb_tracking=true', 'https://form.example.test/apply?sb_tracking=true'],
      },
    ])
  })

  it('配信ステータスが「準備中」のままでも、見られていれば見張る（本番は全ページ準備中のまま配信している）', () => {
    const state = stateWith({ adStatus: 'prepared', versions: [{ status: '公開中', ratio: 100, html: cart }] })
    expect(linkTargets(state, TODAY)).toHaveLength(1)
  })

  it('直近7日に誰も見ていないページは見ない（止まっているページのリンクを叩き続けない）', () => {
    const state = stateWith({
      pvOn: [{ date: '2026-09-01', pv: 100 }],
      versions: [{ status: '公開中', ratio: 100, html: cart }],
    })
    expect(linkTargets(state, TODAY)).toEqual([])
  })

  it('誰にも見られていないVersion（停止・割合0・アーカイブ）のリンクは見ない', () => {
    const state = stateWith({
      versions: [
        { status: '停止', ratio: 50, html: cart },
        { status: '公開中', ratio: 0, html: cart },
        { status: '公開中', ratio: 50, archived: true, html: cart },
      ],
    })
    expect(linkTargets(state, TODAY)).toEqual([])
  })

  it('「停止中」「終了」にしたページは見ない', () => {
    for (const patch of [{ adStatus: 'stopping' }, { adStatus: 'finished' }]) {
      const state = stateWith({ ...patch, versions: [{ status: '公開中', ratio: 100, html: cart }] })
      expect(linkTargets(state, TODAY), JSON.stringify(patch)).toEqual([])
    }
  })
})

describe('応答の読み方', () => {
  const headers = (h: Record<string, string> = {}): Headers => new Headers(h)

  it('2xx は開けている', () => {
    expect(classifyResponse(200, headers())).toBe('ok')
  })

  it('404・410・5xx はリンク切れ', () => {
    for (const status of [404, 410, 500, 502, 503]) {
      expect(classifyResponse(status, headers()), String(status)).toBe('broken')
    }
  })

  it('401・403・429 は「分からない」（ボット対策の門前払いで、人には開けていることが多い）', () => {
    for (const status of [401, 403, 429]) {
      expect(classifyResponse(status, headers()), String(status)).toBe('unknown')
    }
  })

  it('Cloudflareの確認画面（cf-mitigated）は 503 でも「分からない」', () => {
    expect(classifyResponse(503, headers({ 'cf-mitigated': 'challenge' }))).toBe('unknown')
  })
})

describe('1本確かめる', () => {
  const allow = async (): Promise<void> => undefined

  function fakeFetch(
    responses: Record<string, { status: number; headers?: Record<string, string> } | 'hang' | 'refused'>,
  ): { fetch: typeof fetch; calls: { url: string; method: string; ua: string }[] } {
    const calls: { url: string; method: string; ua: string }[] = []
    const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push({ url, method, ua: new Headers(init?.headers).get('user-agent') ?? '' })
      const key = `${method} ${url}`
      const r = responses[key] ?? responses[url]
      if (r === undefined) throw new Error(`想定外の取得: ${key}`)
      if (r === 'refused') throw new TypeError('fetch failed')
      if (r === 'hang') {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
        })
      }
      return new Response(null, { status: r.status, headers: r.headers })
    }) as typeof fetch
    return { fetch: impl, calls }
  }

  it('HEADで確かめ、ボットと名乗る（ASPのクリック数に数えられにくくするため）', async () => {
    const { fetch, calls } = fakeFetch({ 'https://shop.example.test/cart': { status: 200 } })
    const result = await probeLink('https://shop.example.test/cart', { fetch, guard: allow })
    expect(result).toEqual({ verdict: 'ok', reason: 'HTTP 200' })
    expect(calls[0]?.method).toBe('HEAD')
    expect(calls[0]?.ua).toMatch(/bot/i)
  })

  it('HEADを受け付けないサーバー（405）はGETで確かめ直す', async () => {
    const { fetch, calls } = fakeFetch({
      'HEAD https://shop.example.test/cart': { status: 405 },
      'GET https://shop.example.test/cart': { status: 200 },
    })
    const result = await probeLink('https://shop.example.test/cart', { fetch, guard: allow })
    expect(result.verdict).toBe('ok')
    expect(calls.map((c) => c.method)).toEqual(['HEAD', 'GET'])
  })

  it('リダイレクトを追って、行き先で判断する（ASPのリンクは必ず転送される）', async () => {
    const { fetch } = fakeFetch({
      'https://asp.example.test/click': { status: 302, headers: { location: 'https://shop.example.test/gone' } },
      'https://shop.example.test/gone': { status: 404 },
    })
    const result = await probeLink('https://asp.example.test/click', { fetch, guard: allow })
    expect(result).toEqual({ verdict: 'broken', reason: 'HTTP 404' })
  })

  it('転送のたびに行き先を検査する（内部のアドレスへ飛ばされる穴を塞ぐ）', async () => {
    const { fetch } = fakeFetch({
      'https://asp.example.test/click': { status: 302, headers: { location: 'http://169.254.169.254/latest' } },
    })
    const guard = async (url: URL): Promise<void> => {
      if (url.hostname === '169.254.169.254') throw new Error('内部のアドレスです')
    }
    const result = await probeLink('https://asp.example.test/click', { fetch, guard })
    expect(result.verdict, '確かめられないだけで、リンク切れとは言わない').toBe('unknown')
  })

  it('ドメインが見つからなければリンク切れ（期限切れのドメインなど）', async () => {
    const { fetch } = fakeFetch({})
    const guard = async (): Promise<void> => {
      throw new ExternalPageError('ホスト名を解決できません: gone.example.test', 'dns_failed')
    }
    const result = await probeLink('https://gone.example.test/cart', { fetch, guard })
    expect(result.verdict).toBe('broken')
    expect(result.reason).toContain('ドメインが見つかりません')
  })

  it('つながらなければリンク切れ', async () => {
    const { fetch } = fakeFetch({ 'https://shop.example.test/cart': 'refused' })
    const result = await probeLink('https://shop.example.test/cart', { fetch, guard: allow })
    expect(result.verdict).toBe('broken')
    expect(result.reason).toContain('つながりません')
  })

  it('応答が返ってこなければリンク切れ（時間で打ち切る）', async () => {
    const { fetch } = fakeFetch({ 'https://shop.example.test/cart': 'hang' })
    const result = await probeLink('https://shop.example.test/cart', { fetch, guard: allow, timeoutMs: 20 })
    expect(result.verdict).toBe('broken')
    expect(result.reason).toContain('応答がありません')
  })

  it('転送が多すぎたらリンク切れ（ループしている）', async () => {
    const { fetch } = fakeFetch({
      'https://a.example.test/': { status: 302, headers: { location: 'https://a.example.test/' } },
    })
    const result = await probeLink('https://a.example.test/', { fetch, guard: allow })
    expect(result.verdict).toBe('broken')
  })
})

describe('結果を記録する', () => {
  const URL_A = 'https://shop.example.test/cart'
  const NOW = 1_800_000_000_000

  it('開けなければ失敗を数え、1分後にもう一度確かめる', () => {
    const checks = recordProbe([], URL_A, { verdict: 'broken', reason: 'HTTP 404' }, NOW)
    expect(checks).toEqual([{ url: URL_A, failures: 1, last_reason: 'HTTP 404', next_check_at: NOW + LINK_RECHECK_MS }])
  })

  it('開けたら失敗を0に戻し、次は10分後', () => {
    const before: LinkCheck[] = [{ url: URL_A, failures: 1, last_reason: 'HTTP 404', next_check_at: NOW }]
    const checks = recordProbe(before, URL_A, { verdict: 'ok', reason: 'HTTP 200' }, NOW)
    expect(checks[0]).toEqual({ url: URL_A, failures: 0, last_reason: 'HTTP 200', next_check_at: NOW + LINK_CHECK_INTERVAL_MS })
  })

  it('「分からない」は失敗を増やしも戻しもしない', () => {
    const before: LinkCheck[] = [{ url: URL_A, failures: 1, last_reason: 'HTTP 404', next_check_at: NOW }]
    const checks = recordProbe(before, URL_A, { verdict: 'unknown', reason: 'HTTP 403' }, NOW)
    expect(checks[0]?.failures).toBe(1)
  })
})

describe('知らせにまとめる', () => {
  const NOW_S = Math.floor(Date.UTC(2026, 8, 16, 3, 0) / 1000)
  const targets = [
    {
      abTestUid: 'AB1',
      title: '本命LP',
      urls: ['https://shop.example.test/cart', 'https://form.example.test/apply'],
    },
  ]

  it('2回続けて開けなかったリンクがあるページだけ、ページごとに1通にまとめる', () => {
    const checks: LinkCheck[] = [
      { url: 'https://shop.example.test/cart', failures: 2, last_reason: 'HTTP 404', next_check_at: 0 },
      { url: 'https://form.example.test/apply', failures: 3, last_reason: 'つながりません', next_check_at: 0 },
    ]
    const alerts = findBrokenLinkAlerts({ now: NOW_S, targets, checks, sentSlots: [] })
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.kind).toBe('link_broken')
    expect(alerts[0]?.message).toContain('本命LP')
    expect(alerts[0]?.message).toContain('https://shop.example.test/cart')
    expect(alerts[0]?.message).toContain('HTTP 404')
    expect(alerts[0]?.message).toContain('https://form.example.test/apply')
  })

  it('1回だけ開けなかったリンクでは知らせない（一時的な不調で鳴らさない）', () => {
    const checks: LinkCheck[] = [{ url: 'https://shop.example.test/cart', failures: 1, last_reason: 'HTTP 404', next_check_at: 0 }]
    expect(findBrokenLinkAlerts({ now: NOW_S, targets, checks, sentSlots: [] })).toEqual([])
  })

  it('同じページは1日1通まで（異常のお知らせと同じ）', () => {
    const checks: LinkCheck[] = [{ url: 'https://shop.example.test/cart', failures: 2, last_reason: 'HTTP 404', next_check_at: 0 }]
    const first = findBrokenLinkAlerts({ now: NOW_S, targets, checks, sentSlots: [] })
    const again = findBrokenLinkAlerts({ now: NOW_S + 3600, targets, checks, sentSlots: [first[0]?.slot ?? ''] })
    expect(again).toEqual([])
  })
})
