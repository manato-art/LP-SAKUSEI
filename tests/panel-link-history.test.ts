/**
 * 右レールの2パネル（リンク置換 / 変更・復元履歴）の機械証明。
 *
 * - リンク抽出/置換は **DOMに依存しない純粋関数**として検証する
 *   （このリポジトリのテスト環境は node で jsdom を入れていないため）。
 *   「計測機能付きリンク」の仕様は採取した実 Quill Link blot のソースが根拠:
 *   tel: 以外は href に `sb_tracking=true`、tel: は `data-sb-tracking="true"`。
 * - 履歴は実際にモックサーバーを立てて 取得 → 復元 まで通す。
 *
 * URLは RFC 6761 の予約TLD `example.test`（絶対に名前解決されない）だけを使う。
 */
import { createServer, type Server } from 'node:http'
import express from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { abTestsRouter } from '../mock-server/routes/ab-tests.ts'
import { versionsRouter } from '../mock-server/routes/versions.ts'
import { historyRouter } from '../mock-server/routes/panel-history.ts'
import { resetState } from '../mock-server/store/store.ts'
import {
  formatHistoryTimestamp,
  resetArticleHistories,
} from '../mock-server/store/article-history.ts'
import {
  EMPTY_LINKS_MESSAGE,
  buildReplacementHref,
  extractLinksFromHtml,
  filterLinks,
  isAllowedLinkUrl,
  isTrackingLink,
  replaceLinksInHtml,
  withTrackingParam,
} from '../src/app/panels/link-replace.ts'

/* ────────────────────────────────────────────────────────────
 * リンク抽出 / 置換（純粋ロジック）
 * ──────────────────────────────────────────────────────────── */

const LP_HTML =
  '<p>まずは<a href="https://shop.example.test/lp?sb_tracking=true">こちら</a>から</p>' +
  '<p><a href="/company" class="sb-inner-link">運営者情報</a></p>' +
  '<p><a href="tel:0000000000" data-sb-tracking="true">電話する</a></p>'

describe('リンク抽出（リンク置換パネルの一覧）', () => {
  it('本文中のリンクを出現順に、計測有無つきで取り出す', () => {
    const links = extractLinksFromHtml(LP_HTML)
    expect(links.map((l) => l.index)).toEqual([0, 1, 2])
    expect(links[0]?.href).toBe('https://shop.example.test/lp?sb_tracking=true')
    expect(links[0]?.text).toBe('こちら')
    expect(links.map((l) => l.isTracking)).toEqual([true, false, true])
  })

  it('リンクが1つも無ければ空配列（画面は空状態文言を出す）', () => {
    expect(extractLinksFromHtml('<p>リンクの無い本文</p>')).toEqual([])
    expect(EMPTY_LINKS_MESSAGE).toBe('置き換え対象のリンクがありません')
  })

  it('属性値の中の `>` をタグ終端と誤認しない', () => {
    const links = extractLinksFromHtml('<p><a href="/a" title="1 > 0">x</a></p>')
    expect(links).toHaveLength(1)
    expect(links[0]?.href).toBe('/a')
  })

  it('`<article>` のような a で始まる別タグを拾わない', () => {
    expect(extractLinksFromHtml('<article><p>本文</p></article>')).toEqual([])
  })

  it('href の `&amp;` を実体参照のまま計測パラメータ判定しない', () => {
    const links = extractLinksFromHtml('<a href="/x?a=1&amp;sb_tracking=true">y</a>')
    expect(links[0]?.isTracking).toBe(true)
  })

  it('絞り込み（全て / 計測あり / 計測なし）が効く', () => {
    const links = extractLinksFromHtml(LP_HTML)
    expect(filterLinks(links, 'all')).toHaveLength(3)
    expect(filterLinks(links, 'tracking').map((l) => l.index)).toEqual([0, 2])
    expect(filterLinks(links, 'untracked').map((l) => l.index)).toEqual([1])
  })
})

describe('計測機能付きリンクの表し方（実物のQuill Link blot準拠）', () => {
  it('tel: 以外は href のクエリ `sb_tracking=true` で表す', () => {
    expect(withTrackingParam('https://shop.example.test/lp', true)).toBe(
      'https://shop.example.test/lp?sb_tracking=true',
    )
    expect(isTrackingLink('https://shop.example.test/lp?sb_tracking=true', null)).toBe(true)
  })

  it('チェックを外すと `sb_tracking` だけ消え、他のクエリは残る', () => {
    expect(withTrackingParam('https://shop.example.test/lp?utm=a&sb_tracking=true', false)).toBe(
      'https://shop.example.test/lp?utm=a',
    )
  })

  it('tel: はクエリを付けず、属性で表す', () => {
    expect(buildReplacementHref('tel:0000000000', true)).toBe('tel:0000000000')
    expect(isTrackingLink('tel:0000000000', 'true')).toBe(true)
    expect(isTrackingLink('tel:0000000000', null)).toBe(false)
  })

  it('許可プロトコル以外は置換先として受け付けない', () => {
    expect(isAllowedLinkUrl('https://shop.example.test/lp')).toBe(true)
    expect(isAllowedLinkUrl('mailto:info@example.test')).toBe(true)
    expect(isAllowedLinkUrl('/relative/path')).toBe(true)
    expect(isAllowedLinkUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedLinkUrl('   ')).toBe(false)
  })
})

describe('リンク置換', () => {
  it('選んだリンクだけを置き換える', () => {
    const out = replaceLinksInHtml(LP_HTML, [1], {
      href: 'https://new.example.test/offer',
      tracking: true,
      newTab: false,
    })
    const links = extractLinksFromHtml(out)
    expect(links[0]?.href).toBe('https://shop.example.test/lp?sb_tracking=true')
    expect(links[1]?.href).toBe('https://new.example.test/offer?sb_tracking=true')
    expect(links[2]?.href).toBe('tel:0000000000')
  })

  it('href 以外の属性（クラス等）を落とさない', () => {
    const out = replaceLinksInHtml(LP_HTML, [1], {
      href: 'https://new.example.test/offer',
      tracking: false,
      newTab: false,
    })
    expect(out).toContain('class="sb-inner-link"')
    expect(out).toContain('href="https://new.example.test/offer"')
  })

  it('「計測機能付きリンクに変更」を外すと `sb_tracking` が付かない', () => {
    const out = replaceLinksInHtml(LP_HTML, [0], {
      href: 'https://new.example.test/offer',
      tracking: false,
      newTab: false,
    })
    expect(extractLinksFromHtml(out)[0]?.isTracking).toBe(false)
  })

  it('「リンクを別タブで開く」で target="_blank" が付き、外すと消える', () => {
    const opened = replaceLinksInHtml(LP_HTML, [0], {
      href: 'https://new.example.test/offer',
      tracking: true,
      newTab: true,
    })
    expect(extractLinksFromHtml(opened)[0]?.isNewTab).toBe(true)
    const closed = replaceLinksInHtml(opened, [0], {
      href: 'https://new.example.test/offer',
      tracking: true,
      newTab: false,
    })
    expect(extractLinksFromHtml(closed)[0]?.isNewTab).toBe(false)
    expect(closed).not.toContain('target=')
  })

  it('tel: へ置き換えると属性で計測が付き、外すと属性ごと消える', () => {
    const on = replaceLinksInHtml(LP_HTML, [1], {
      href: 'tel:0000000000',
      tracking: true,
      newTab: false,
    })
    expect(extractLinksFromHtml(on)[1]?.isTracking).toBe(true)
    const off = replaceLinksInHtml(on, [1], {
      href: 'tel:0000000000',
      tracking: false,
      newTab: false,
    })
    expect(extractLinksFromHtml(off)[1]?.isTracking).toBe(false)
    expect(off).toContain('<a href="tel:0000000000" class="sb-inner-link">')
  })

  it('複数選択をまとめて置き換えても取りこぼさない', () => {
    const out = replaceLinksInHtml(LP_HTML, [0, 1, 2], {
      href: 'https://new.example.test/offer',
      tracking: true,
      newTab: false,
    })
    const links = extractLinksFromHtml(out)
    expect(links).toHaveLength(3)
    expect(new Set(links.map((l) => l.href))).toEqual(
      new Set(['https://new.example.test/offer?sb_tracking=true']),
    )
  })

  it('元のHTMLを書き換えない（イミュータブル）', () => {
    const before = LP_HTML
    replaceLinksInHtml(before, [0], {
      href: 'https://new.example.test/offer',
      tracking: true,
      newTab: true,
    })
    expect(before).toBe(LP_HTML)
  })
})

/* ────────────────────────────────────────────────────────────
 * 変更・復元履歴（モックサーバー）
 * ──────────────────────────────────────────────────────────── */

interface HistoryRow {
  id: number
  recorded_at: number
  recorded_at_label: string
  is_current: boolean
}

let server: Server
let api: string

async function post<T>(path: string, body: unknown = {}): Promise<{ status: number; json: T }> {
  const res = await fetch(`${api}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, json: (await res.json().catch(() => null)) as T }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${api}${path}`)
  return (await res.json()) as T
}

async function seedArticle(): Promise<{ articleUid: string; versionUid: string }> {
  const created = await post<{ article: { uid: string }; version: { uid: string } }>('/ab_tests', {
    title: 'サンプル施策001',
    folder_id: null,
    media_id: null,
    editor_version: 2,
  })
  return { articleUid: created.json.article.uid, versionUid: created.json.version.uid }
}

beforeAll(async () => {
  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use('/api/v1', abTestsRouter, versionsRouter, historyRouter)
  server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('ポート取得に失敗しました')
  api = `http://127.0.0.1:${address.port}/api/v1`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  )
})

beforeEach(() => {
  resetState()
  resetArticleHistories()
})

describe('日時書式（実機はゼロ埋めなし）', () => {
  it('`2026-8-31 19:41:39` の形で出す', () => {
    const at = Math.floor(new Date(2026, 7, 31, 19, 41, 39).getTime() / 1000)
    expect(formatHistoryTimestamp(at)).toBe('2026-8-31 19:41:39')
  })

  it('月日はゼロ埋めせず、分秒はゼロ埋めする', () => {
    const at = Math.floor(new Date(2026, 0, 5, 10, 5, 3).getTime() / 1000)
    expect(formatHistoryTimestamp(at)).toBe('2026-1-5 10:05:03')
  })
})

describe('変更・復元履歴API', () => {
  it('開いた直後は `現行版` の1件だけが返る', async () => {
    const { articleUid } = await seedArticle()
    const { histories } = await get<{ histories: HistoryRow[] }>(
      `/articles/${articleUid}/histories`,
    )
    expect(histories).toHaveLength(1)
    expect(histories[0]?.is_current).toBe(true)
    expect(histories[0]?.recorded_at_label).toMatch(/^\d{4}-\d{1,2}-\d{1,2} \d{1,2}:\d{2}:\d{2}$/)
  })

  it('存在しない記事は404', async () => {
    const res = await fetch(`${api}/articles/ARTICLE_9999/histories`)
    expect(res.status).toBe(404)
  })

  it('本文を記録すると履歴が増え、新しいものが先頭で `現行版` になる', async () => {
    const { articleUid } = await seedArticle()
    await get(`/articles/${articleUid}/histories`)
    const recorded = await post<{ recorded: boolean }>(`/articles/${articleUid}/histories`, {
      html: '<p>2代目の本文</p>',
    })
    expect(recorded.json.recorded).toBe(true)

    const { histories } = await get<{ histories: HistoryRow[] }>(
      `/articles/${articleUid}/histories`,
    )
    expect(histories).toHaveLength(2)
    expect(histories[0]?.is_current).toBe(true)
    expect(histories[1]?.is_current).toBe(false)
  })

  it('直前と同じ本文は積まない（同じ行が並ばない）', async () => {
    const { articleUid } = await seedArticle()
    await post(`/articles/${articleUid}/histories`, { html: '<p>同じ本文</p>' })
    const again = await post<{ recorded: boolean }>(`/articles/${articleUid}/histories`, {
      html: '<p>同じ本文</p>',
    })
    expect(again.json.recorded).toBe(false)
    const { histories } = await get<{ histories: HistoryRow[] }>(
      `/articles/${articleUid}/histories`,
    )
    expect(histories).toHaveLength(2) // 初期の現行版 + 「同じ本文」
  })

  it('選んだ世代へ復元すると本文とVersionが戻る', async () => {
    const { articleUid, versionUid } = await seedArticle()
    await post(`/articles/${articleUid}/histories`, { html: '<p>1代目</p>' })
    await post(`/articles/${articleUid}/histories`, { html: '<p>2代目</p>' })

    // 新しい順に並ぶので、現行版でない最初の1件が「1つ前の世代」＝ `1代目`
    const listed = await get<{ histories: HistoryRow[] }>(`/articles/${articleUid}/histories`)
    const target = listed.histories.filter((h) => !h.is_current)[0]
    expect(target).toBeDefined()

    const restored = await post<{ html: string; restored_from: number }>(
      `/articles/${articleUid}/histories/${target?.id}/restore`,
    )
    expect(restored.status).toBe(200)
    expect(restored.json.html).toBe('<p>1代目</p>')

    // Version本体（＝エディタが次に開く中身）も戻っている
    const versions = await get<{ versions: { uid: string; html: string }[] }>(
      `/articles/${articleUid}/versions`,
    )
    expect(versions.versions.find((v) => v.uid === versionUid)?.html).toBe('<p>1代目</p>')

    // 戻した状態が新しい `現行版` として積まれている
    const after = await get<{ histories: HistoryRow[] }>(`/articles/${articleUid}/histories`)
    expect(after.histories[0]?.is_current).toBe(true)
    expect(after.histories).toHaveLength(4)
  })

  it('存在しない履歴IDの復元は404', async () => {
    const { articleUid } = await seedArticle()
    await get(`/articles/${articleUid}/histories`)
    const res = await post(`/articles/${articleUid}/histories/9999/restore`)
    expect(res.status).toBe(404)
  })

  it('リセット後は前の世代の履歴が混ざらない', async () => {
    const first = await seedArticle()
    await post(`/articles/${first.articleUid}/histories`, { html: '<p>リセット前</p>' })

    resetState()
    const second = await seedArticle()
    const { histories } = await get<{ histories: HistoryRow[] }>(
      `/articles/${second.articleUid}/histories`,
    )
    expect(histories).toHaveLength(1)
    expect(histories[0]?.is_current).toBe(true)
  })
})
