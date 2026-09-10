import { describe, it, expect } from 'vitest'
import {
  findImageTargets,
  findLinkTargets,
  findTextTargets,
  replaceImage,
  replaceLink,
  replaceText,
} from '../mock-server/store/bulk-replace.ts'

/**
 * マジック置換（実SB「ツール > マジック置換」= /articles/bulk_replaces）の中身。
 *
 * 実物の挙動（2026-09-10 に実機で確認）:
 *   画像   … 選んだbeyondページで使われている画像を一覧 → チェックしたものを新しい画像へ
 *   テキスト … 文字列を検索 → 前後の文脈つきで一覧 → チェックしたものを新しい文字列へ
 *   リンク  … 選んだページのリンクを一覧 → 新しいURLへ。計測機能はON/引き継ぐ/OFFの3択
 *
 * 一覧には出現回数（実物の `[1]` 表記）と、どのVersionのものかが並ぶ。
 */

describe('画像の置換対象', () => {
  it('同じ画像が2回使われていたら1行にまとめて回数を2と数える', () => {
    const html = '<img src="https://x.test/a.jpg"><p>あ</p><img src="https://x.test/a.jpg">'
    expect(findImageTargets(html)).toEqual([{ url: 'https://x.test/a.jpg', count: 2 }])
  })

  it('背景画像（style の url(...)）も画像として拾う', () => {
    const html = '<div style="background-image:url(https://x.test/bg.png)"></div>'
    expect(findImageTargets(html)).toEqual([{ url: 'https://x.test/bg.png', count: 1 }])
  })

  it('出てくる順に並べる（画面の並びを毎回同じにする）', () => {
    const html = '<img src="b.jpg"><img src="a.jpg"><img src="b.jpg">'
    expect(findImageTargets(html).map((t) => t.url)).toEqual(['b.jpg', 'a.jpg'])
  })

  it('置換すると、その画像の出現箇所が全部新しいURLに変わる', () => {
    const html = '<img src="a.jpg"><img src="a.jpg"><img src="b.jpg">'
    const out = replaceImage(html, 'a.jpg', 'new.jpg')
    expect(out.replaced).toBe(2)
    expect(out.html).toBe('<img src="new.jpg"><img src="new.jpg"><img src="b.jpg">')
  })
})

describe('テキストの置換対象', () => {
  it('本文に出てくる文字列を、前後の文脈つきで返す', () => {
    const html = '<p>もうまつ毛落ちてきたんだけど…</p>'
    const rows = findTextTargets(html, 'まつ毛')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.context).toContain('まつ毛')
    expect(rows[0]?.context).toContain('もう')
  })

  it('タグの中（属性）に一致しても拾わない', () => {
    // href に含まれる「まつ毛」は本文ではないので対象外
    const html = '<a href="https://x.test/まつ毛">リンク</a>'
    expect(findTextTargets(html, 'まつ毛')).toEqual([])
  })

  it('同じ文字列が複数あればその数だけ行を返す（1件ずつ選べるように）', () => {
    const html = '<p>まつ毛が好き</p><p>まつ毛は大事</p>'
    expect(findTextTargets(html, 'まつ毛')).toHaveLength(2)
  })

  it('空の検索文字列では何も返さない（全文が対象になるのを防ぐ）', () => {
    expect(findTextTargets('<p>あ</p>', '')).toEqual([])
  })

  it('置換は本文だけを書き換え、属性は触らない', () => {
    const html = '<a href="https://x.test/まつ毛">まつ毛はこちら</a>'
    const out = replaceText(html, 'まつ毛', '眉毛')
    expect(out.replaced).toBe(1)
    expect(out.html).toBe('<a href="https://x.test/まつ毛">眉毛はこちら</a>')
  })

  it('n番目の1件だけを置換できる（一覧でチェックした行だけ変える）', () => {
    const html = '<p>まつ毛A</p><p>まつ毛B</p>'
    const out = replaceText(html, 'まつ毛', '眉毛', [1])
    expect(out.replaced).toBe(1)
    expect(out.html).toBe('<p>まつ毛A</p><p>眉毛B</p>')
  })
})

describe('リンクの置換対象', () => {
  it('リンクをURLごとにまとめ、計測機能が付いているかを返す', () => {
    const html =
      '<a href="https://x.test/a?sb_tracking=true">A</a><a href="https://x.test/b">B</a>'
    expect(findLinkTargets(html)).toEqual([
      { url: 'https://x.test/a?sb_tracking=true', count: 1, tracking: true },
      { url: 'https://x.test/b', count: 1, tracking: false },
    ])
  })

  it('「全てONにする」は新しいURLに計測パラメータを付ける', () => {
    const html = '<a href="https://x.test/old">A</a>'
    const out = replaceLink(html, 'https://x.test/old', 'https://y.test/new', 'on')
    expect(out.replaced).toBe(1)
    expect(out.html).toContain('href="https://y.test/new?sb_tracking=true"')
  })

  it('「全てOFFにする」は計測パラメータを付けない', () => {
    const html = '<a href="https://x.test/old?sb_tracking=true">A</a>'
    const out = replaceLink(html, 'https://x.test/old?sb_tracking=true', 'https://y.test/new', 'off')
    expect(out.html).toContain('href="https://y.test/new"')
    expect(out.html).not.toContain('sb_tracking')
  })

  it('「置換前の設定を引き継ぐ」は元のリンクの計測設定に合わせる', () => {
    const tracked = '<a href="https://x.test/old?sb_tracking=true">A</a>'
    expect(replaceLink(tracked, 'https://x.test/old?sb_tracking=true', 'https://y.test/n', 'keep').html)
      .toContain('sb_tracking=true')

    const plain = '<a href="https://x.test/old">A</a>'
    expect(replaceLink(plain, 'https://x.test/old', 'https://y.test/n', 'keep').html)
      .not.toContain('sb_tracking')
  })
})

/* ────────────────────────────────────────────────────────────
 * API（取得 → 置換 → 読み直し）を実際に通す
 * ──────────────────────────────────────────────────────────── */

describe('マジック置換のAPI', () => {
  it('置換対象の取得と実行が通り、選んだ1件だけが書き換わる', async () => {
    const { createServer } = await import('node:http')
    const express = (await import('express')).default
    const { abTestsRouter } = await import('../mock-server/routes/ab-tests.ts')
    const { versionsRouter } = await import('../mock-server/routes/versions.ts')
    const { bulkReplaceRouter } = await import('../mock-server/routes/bulk-replace.ts')
    const { miscRouter } = await import('../mock-server/routes/misc.ts')
    const { resetState } = await import('../mock-server/store/store.ts')

    resetState()
    const app = express()
    app.use(express.json({ limit: '8mb' }))
    // 実際の並び（misc が先）で載せる。miscに置き石が戻ると、ここで落ちる。
    app.use('/api/v1', miscRouter, abTestsRouter, versionsRouter, bulkReplaceRouter)
    const server = createServer(app)
    await new Promise<void>((r) => server.listen(0, r))
    const port = (server.address() as { port: number }).port
    const base = `http://127.0.0.1:${port}/api/v1`
    const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      return (await res.json()) as T
    }

    try {
      const created = await call<{ ab_test: { uid: string }; version: { uid: string } }>(
        'POST',
        '/ab_tests',
        { title: 'サンプル施策001' },
      )
      const abUid = created.ab_test.uid
      const versionUid = created.version.uid
      await call('PUT', `/versions/${versionUid}`, {
        html: '<p>あああ</p><p>あああ</p><a href="https://x.test/o">L</a>',
      })

      const targets = await call<{ pages: { rows: { value: string; text_index?: number }[] }[] }>(
        'GET',
        `/articles/bulk_replaces/targets?ab_test_uids=${abUid}&kind=text&q=${encodeURIComponent('あああ')}`,
      )
      expect(targets.pages[0]?.rows).toHaveLength(2)

      const done = await call<{ replaced: number; versions: number }>(
        'POST',
        '/articles/bulk_replaces',
        {
          kind: 'text',
          targets: [{ version_uid: versionUid, value: 'あああ', indexes: [1] }],
          replacement: 'いいい',
        },
      )
      expect(done).toEqual({ replaced: 1, versions: 1 })

      // 置換された1件は一覧から消え、残り1件だけになる
      const again = await call<{ pages: { rows: unknown[] }[] }>(
        'GET',
        `/articles/bulk_replaces/targets?ab_test_uids=${abUid}&kind=text&q=${encodeURIComponent('あああ')}`,
      )
      expect(again.pages[0]?.rows).toHaveLength(1)
    } finally {
      await new Promise<void>((r) => server.close(() => r()))
    }
  })
})
