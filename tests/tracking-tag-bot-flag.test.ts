/**
 * 計測タグが「自動操作中のブラウザ」を知らせる（2026-09-16・本人の依頼でボットを数えないため）。
 *
 * Selenium・Puppeteer・Playwright は navigator.webdriver を true にする。UAは普通のChromeなので、
 * UAだけでは見分けられない。タグがそれを見て `wd:1` を付け、サーバーが数えない。
 * **人のときは何も付けない**（送る中身を変えない＝既存の集計に影響しない）。
 */
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { buildCvScriptBody, buildTrackingScriptBody } from '../src/shared/tracking-tag.ts'

function run(script: string, options: { webdriver?: boolean; href?: string }): Record<string, unknown>[] {
  const sent: Record<string, unknown>[] = []
  class FakeBlob {
    constructor(readonly parts: string[]) {}
  }
  const url = new URL(options.href ?? 'https://lp.example.test/lp/AB1?squadbeyond_uid=VISITOR-12345678')
  const context: Record<string, unknown> = {
    location: { href: url.href, origin: url.origin, pathname: url.pathname, search: url.search },
    document: {
      cookie: '',
      hidden: false,
      documentElement: { scrollHeight: 2000 },
      querySelectorAll: () => [],
      addEventListener: () => undefined,
    },
    navigator: {
      ...(options.webdriver === undefined ? {} : { webdriver: options.webdriver }),
      sendBeacon: (_to: string, blob: FakeBlob) => {
        sent.push(JSON.parse(blob.parts[0] ?? '{}') as Record<string, unknown>)
        return true
      },
    },
    localStorage: { getItem: () => null, setItem: () => undefined },
    Blob: FakeBlob,
    URL,
    URLSearchParams,
    addEventListener: () => undefined,
    innerHeight: 800,
    innerWidth: 400,
    scrollY: 0,
    setInterval: () => 1,
    clearInterval: () => undefined,
    fetch: () => undefined,
  }
  context['window'] = context
  runInNewContext(script, context)
  return sent
}

const ENDPOINT = 'https://lp.example.test/lp/AB1/__track'

describe('LPの計測タグ', () => {
  it('自動操作中なら wd:1 を付ける', () => {
    const sent = run(buildTrackingScriptBody(ENDPOINT, 'V1'), { webdriver: true })
    expect(sent[0]?.['wd']).toBe(1)
  })

  it('人のときは何も付けない（送る中身を変えない）', () => {
    expect(run(buildTrackingScriptBody(ENDPOINT, 'V1'), { webdriver: false })[0]).not.toHaveProperty('wd')
    expect(run(buildTrackingScriptBody(ENDPOINT, 'V1'), {})[0], 'webdriver を持たない古いブラウザ').not.toHaveProperty('wd')
  })
})

describe('CVタグ（サンクスページ）', () => {
  it('自動操作中なら wd:1 を付ける（動作確認で踏んだ成果を数えない）', () => {
    const sent = run(buildCvScriptBody(ENDPOINT), { webdriver: true })
    expect(sent[0]?.['event']).toBe('cv')
    expect(sent[0]?.['wd']).toBe(1)
  })

  it('人のときは何も付けない', () => {
    expect(run(buildCvScriptBody(ENDPOINT), { webdriver: false })[0]).not.toHaveProperty('wd')
  })
})
