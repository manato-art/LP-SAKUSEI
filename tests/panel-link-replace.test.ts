/**
 * リンク置換パネルの機械証明。
 *
 * このリポジトリのテスト環境は node（jsdom 無し）なので、
 * 画面の挙動は **DOMに依存しない純粋関数**に切り出したうえで検証する:
 *   - どのリンクが「全て選択」の対象になるか（selectableLinkIndexes）
 *   - フォームの入力から何のリクエストを組み立てるか（buildLinkReplaceRequest）
 *   - 置換先URLをどちらから採るか（pickReplacementUrl）
 * 永続化はモックサーバーを実際に立てて 取得 → 置換 → 読み直し まで通す。
 *
 * URLは RFC 6761 の予約TLD `example.test`（絶対に名前解決されない）だけを使う。
 */
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import express from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { abTestsRouter } from '../mock-server/routes/ab-tests.ts'
import { versionsRouter } from '../mock-server/routes/versions.ts'
import { linkReplaceRouter } from '../mock-server/routes/panel-link-replace.ts'
import { historyRouter } from '../mock-server/routes/panel-history.ts'
import { getState, resetState } from '../mock-server/store/store.ts'
import { resetArticleHistories } from '../mock-server/store/article-history.ts'
import {
  buildLinkReplaceRequest,
  extractLinksFromHtml,
  pickReplacementUrl,
  selectableLinkIndexes,
  type LinkReplaceFormInput,
} from '../src/shared/link-html.ts'

/* ────────────────────────────────────────────────────────────
 * 採取物そのもの（実装が推測でないことを機械で示す）
 * ──────────────────────────────────────────────────────────── */

const PANEL_FRAGMENT = 'src/app/fragments/ab_tests__UID__articles__tool-link-replace.html'
const PANEL_SOURCE = 'src/app/panels/link-replace.ts'
const EDITOR_CSSOM = 'capture/clean/ab_tests__UID__articles/editor-target/cssom.css'

/**
 * 採取したDOMには一度も出てこないが、採取したCSSには定義がある「行まわり」のクラス。
 * CSSから形を推測して行を組み立てるとここが実装に現れる。**現れてはいけない。**
 */
const UNCAPTURED_ROW_CLASSES = [
  '_targetLinkList_id5w4_134',
  '_linkHref_id5w4_156',
  '_trackingLink_id5w4_195',
  '_fullText_id5w4_156',
  '_popupList_id5w4_153',
  '_popupLinkList_id5w4_160',
  '_popupInfo_id5w4_160',
  '_popupUrl_id5w4_160',
  '_popupName_id5w4_184',
  '_popupPreviewTrigger_id5w4_203',
  '_btnLinkSelectType_id5w4_367',
  '_linkSelectDropDown_id5w4_382',
  '_trakingListHeader_id5w4_353',
]

/** コメント（＝採取状況の説明）は対象外にする。見たいのは実際に出力されるコードだけ */
function withoutBlockComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

describe('採取したリンク置換パネルの実DOM', () => {
  it('一覧枠の中身は空状態1枚だけ（＝行のマークアップは1件も採取できていない）', () => {
    const html = readFileSync(PANEL_FRAGMENT, 'utf8')
    expect(html).toContain(
      '<div class="_targetLinkLists_id5w4_134">' +
        '<div class="_noLinksDescription_id5w4_411">置き換え対象のリンクがありません</div>' +
        '</div>',
    )
  })

  it('タブは Version内リンク / 離脱防止ポップアップリンク の2枚', () => {
    const html = readFileSync(PANEL_FRAGMENT, 'utf8')
    expect(html).toContain('<div class="_tab_id5w4_28 _active_id5w4_48">Version内リンク</div>')
    expect(html).toContain('<div class="_tab_id5w4_28 ">離脱防止ポップアップリンク</div>')
  })

  it('中間ページリンクは「タブ」ではなく select の選択肢', () => {
    const html = readFileSync(PANEL_FRAGMENT, 'utf8')
    expect(html).toContain('<option value="free">新しいリンク</option>')
    expect(html).toContain('<option value="redirectPage">中間ページリンク</option>')
  })

  it('行まわりのクラスは採取CSSにだけ在り、採取DOMには無い', () => {
    const html = readFileSync(PANEL_FRAGMENT, 'utf8')
    const css = readFileSync(EDITOR_CSSOM, 'utf8')
    for (const cls of UNCAPTURED_ROW_CLASSES) {
      expect(css).toContain(`.${cls}`)
      expect(html).not.toContain(cls)
    }
  })

  it('実装はその未採取クラスを1つも出力しない（それらしい行を作っていない）', () => {
    const source = withoutBlockComments(readFileSync(PANEL_SOURCE, 'utf8'))
    for (const cls of UNCAPTURED_ROW_CLASSES) {
      expect(source).not.toContain(cls)
    }
  })

  it('土台が無いときに差し込む markup は採取物の部分木そのもの', () => {
    const source = readFileSync(PANEL_SOURCE, 'utf8')
    const literal = /const LINK_REPLACE_MARKUP = `([\s\S]*?)`\n/.exec(source)?.[1]
    expect(literal).toBeDefined()
    expect(readFileSync(PANEL_FRAGMENT, 'utf8')).toContain(literal as string)
  })
})

/* ────────────────────────────────────────────────────────────
 * 純粋ロジック
 * ──────────────────────────────────────────────────────────── */

const LP_HTML =
  '<p><a href="https://shop.example.test/lp?sb_tracking=true">こちら</a></p>' +
  '<p><a href="/company">運営者情報</a></p>' +
  '<p><a href="https://shop.example.test/form?sb_tracking=true">申し込む</a></p>'

const FORM: LinkReplaceFormInput = {
  targetType: 'free',
  selected: [0],
  url: 'https://new.example.test/offer',
  redirectPageUid: '',
  isTracking: true,
  isNewTab: false,
  versionUid: 'VERSION_0001',
}

describe('「全て選択」が対象にするリンク', () => {
  it('絞り込みが `全て` なら本文の全リンクを対象にする', () => {
    const links = extractLinksFromHtml(LP_HTML)
    expect(selectableLinkIndexes(links, 'all')).toEqual([0, 1, 2])
  })

  it('絞り込みが `計測あり` なら計測リンクの出現順だけを返す', () => {
    const links = extractLinksFromHtml(LP_HTML)
    expect(selectableLinkIndexes(links, 'tracking')).toEqual([0, 2])
  })

  it('絞り込みが `計測なし` なら計測なしの出現順だけを返す', () => {
    const links = extractLinksFromHtml(LP_HTML)
    expect(selectableLinkIndexes(links, 'untracked')).toEqual([1])
  })
})

describe('置換リクエストの組み立て', () => {
  it('選択したリンクとチェックボックスの状態をそのまま載せる', () => {
    const built = buildLinkReplaceRequest({ ...FORM, selected: [2, 0], isNewTab: true })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.value).toEqual({
      version_uid: 'VERSION_0001',
      indexes: [0, 2],
      target_type: 'free',
      url: 'https://new.example.test/offer',
      redirect_page_uid: '',
      tracking: true,
      new_tab: true,
    })
  })

  it('1つも選ばれていなければリクエストを作らない', () => {
    const built = buildLinkReplaceRequest({ ...FORM, selected: [] })
    expect(built).toEqual({ ok: false, message: '置き換えるリンクを選択してください' })
  })

  it('許可プロトコル以外のURLはリクエストを作らない', () => {
    const built = buildLinkReplaceRequest({ ...FORM, url: 'javascript:alert(1)' })
    expect(built.ok).toBe(false)
  })

  it('URLが空ならリクエストを作らない', () => {
    const built = buildLinkReplaceRequest({ ...FORM, url: '   ' })
    expect(built.ok).toBe(false)
  })

  it('中間ページリンクは中間ページを選んでいなければリクエストを作らない', () => {
    const built = buildLinkReplaceRequest({ ...FORM, targetType: 'redirectPage', url: '' })
    expect(built.ok).toBe(false)
  })

  it('中間ページリンクを選んでいればURLが空でもリクエストになる', () => {
    const built = buildLinkReplaceRequest({
      ...FORM,
      targetType: 'redirectPage',
      url: '',
      redirectPageUid: 'REDIRECT_0001',
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.value.target_type).toBe('redirectPage')
    expect(built.value.redirect_page_uid).toBe('REDIRECT_0001')
  })

  it('version_uid が空でもリクエストは作れる（サーバー側が先頭Versionへ解決する）', () => {
    const built = buildLinkReplaceRequest({ ...FORM, versionUid: '' })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.value.version_uid).toBe('')
  })
})

describe('置換先URLの決め方', () => {
  it('`新しいリンク` は入力欄のURLを使う', () => {
    expect(
      pickReplacementUrl({
        targetType: 'free',
        url: ' https://new.example.test/offer ',
        redirectPageUrl: 'https://redirect.example.test/1',
      }),
    ).toBe('https://new.example.test/offer')
  })

  it('`中間ページリンク` は中間ページのURLを使う（入力欄は無視する）', () => {
    expect(
      pickReplacementUrl({
        targetType: 'redirectPage',
        url: 'https://new.example.test/offer',
        redirectPageUrl: 'https://redirect.example.test/1',
      }),
    ).toBe('https://redirect.example.test/1')
  })

  it('中間ページが解決できなければ null（呼び出し側が422にする）', () => {
    expect(
      pickReplacementUrl({ targetType: 'redirectPage', url: 'https://x.example.test', redirectPageUrl: null }),
    ).toBeNull()
  })
})

/* ────────────────────────────────────────────────────────────
 * 永続化（モックサーバー）
 * ──────────────────────────────────────────────────────────── */

interface LinkRow {
  index: number
  href: string
  text: string
  is_tracking: boolean
  is_new_tab: boolean
}

let server: Server
let api: string

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: T }> {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: res.status, json: (await res.json().catch(() => null)) as T }
}

async function seedArticle(): Promise<{ articleUid: string; versionUid: string }> {
  const created = await request<{ article: { uid: string }; version: { uid: string } }>(
    'POST',
    '/ab_tests',
    { title: 'サンプル施策001', folder_id: null, media_id: null, editor_version: 2 },
  )
  return { articleUid: created.json.article.uid, versionUid: created.json.version.uid }
}

/** 本文にリンクを3本持たせる（初期LPはCTAが1本しか無いため） */
async function seedHtml(versionUid: string, html: string): Promise<void> {
  await request('PUT', `/versions/${versionUid}`, { html })
}

beforeAll(async () => {
  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use('/api/v1', abTestsRouter, versionsRouter, linkReplaceRouter, historyRouter)
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

describe('リンク置換API 取得', () => {
  it('本文のリンクを出現順に返す', async () => {
    const { articleUid, versionUid } = await seedArticle()
    await seedHtml(versionUid, LP_HTML)
    const got = await request<{ links: LinkRow[]; version_uid: string }>(
      'GET',
      `/articles/${articleUid}/link_replace`,
    )
    expect(got.status).toBe(200)
    expect(got.json.version_uid).toBe(versionUid)
    expect(got.json.links.map((l) => l.href)).toEqual([
      'https://shop.example.test/lp?sb_tracking=true',
      '/company',
      'https://shop.example.test/form?sb_tracking=true',
    ])
    expect(got.json.links.map((l) => l.is_tracking)).toEqual([true, false, true])
  })

  it('新規アカウント直後は中間ページも離脱防止ポップアップも0件', async () => {
    const { articleUid } = await seedArticle()
    const got = await request<{ redirect_pages: unknown[]; exit_popups: unknown[] }>(
      'GET',
      `/articles/${articleUid}/link_replace`,
    )
    expect(got.json.redirect_pages).toEqual([])
    expect(got.json.exit_popups).toEqual([])
  })

  it('存在しない記事は404', async () => {
    const got = await request('GET', '/articles/ARTICLE_9999/link_replace')
    expect(got.status).toBe(404)
  })
})

describe('リンク置換API 置換の永続化', () => {
  it('選んだリンクだけを置き換え、Versionに保存する', async () => {
    const { articleUid, versionUid } = await seedArticle()
    await seedHtml(versionUid, LP_HTML)

    const replaced = await request<{ replaced_count: number; html: string }>(
      'POST',
      `/articles/${articleUid}/link_replace`,
      {
        version_uid: versionUid,
        indexes: [1],
        target_type: 'free',
        url: 'https://new.example.test/offer',
        tracking: true,
        new_tab: false,
      },
    )
    expect(replaced.status).toBe(200)
    expect(replaced.json.replaced_count).toBe(1)

    // 画面上だけでなく、読み直しても置換後の本文が返る
    const reread = await request<{ versions: { uid: string; html: string }[] }>(
      'GET',
      `/articles/${articleUid}/versions`,
    )
    const html = reread.json.versions.find((v) => v.uid === versionUid)?.html ?? ''
    expect(html).toContain('https://new.example.test/offer?sb_tracking=true')
    expect(html).toContain('https://shop.example.test/lp?sb_tracking=true')
    expect(html).not.toContain('"/company"')
  })

  it('別タブのチェックで target="_blank" が付く', async () => {
    const { articleUid, versionUid } = await seedArticle()
    await seedHtml(versionUid, LP_HTML)
    await request('POST', `/articles/${articleUid}/link_replace`, {
      version_uid: versionUid,
      indexes: [0],
      target_type: 'free',
      url: 'https://new.example.test/offer',
      tracking: false,
      new_tab: true,
    })
    const reread = await request<{ versions: { uid: string; html: string }[] }>(
      'GET',
      `/articles/${articleUid}/versions`,
    )
    const html = reread.json.versions.find((v) => v.uid === versionUid)?.html ?? ''
    expect(html).toContain('target="_blank"')
    expect(html).toContain('href="https://new.example.test/offer"')
  })

  it('保存は不変更新（置換前のVersionオブジェクトは書き換わらない）', async () => {
    const { articleUid, versionUid } = await seedArticle()
    await seedHtml(versionUid, LP_HTML)
    const before = getState().versions.find((v) => v.uid === versionUid)
    expect(before).toBeDefined()

    await request('POST', `/articles/${articleUid}/link_replace`, {
      version_uid: versionUid,
      indexes: [0],
      target_type: 'free',
      url: 'https://new.example.test/offer',
      tracking: true,
      new_tab: false,
    })

    const after = getState().versions.find((v) => v.uid === versionUid)
    expect(after).not.toBe(before)
    expect(before?.html).toBe(LP_HTML)
    expect(after?.html).not.toBe(LP_HTML)
  })

  it('置換の前後がバージョン復元の履歴に積まれる', async () => {
    const { articleUid, versionUid } = await seedArticle()
    await seedHtml(versionUid, LP_HTML)
    await request('POST', `/articles/${articleUid}/link_replace`, {
      version_uid: versionUid,
      indexes: [0],
      target_type: 'free',
      url: 'https://new.example.test/offer',
      tracking: true,
      new_tab: false,
    })
    const got = await request<{ histories: { id: number }[] }>(
      'GET',
      `/articles/${articleUid}/histories`,
    )
    expect(got.json.histories.length).toBeGreaterThanOrEqual(2)
  })

  it('編集中の本文を渡すと、それを土台に置換して保存する（保存前の編集を落とさない）', async () => {
    const { articleUid, versionUid } = await seedArticle()
    await seedHtml(versionUid, LP_HTML)

    // 保存していない編集: 先頭に段落を1つ足し、リンクも1本増えている
    const editing =
      '<p>追記した段落</p><p><a href="https://added.example.test/x">追加リンク</a></p>' + LP_HTML

    const replaced = await request<{ html: string }>(
      'POST',
      `/articles/${articleUid}/link_replace`,
      {
        version_uid: versionUid,
        indexes: [3],
        target_type: 'free',
        url: 'https://new.example.test/offer',
        tracking: false,
        new_tab: false,
        html: editing,
      },
    )
    expect(replaced.status).toBe(200)
    expect(replaced.json.html).toContain('追記した段落')

    const reread = await request<{ versions: { uid: string; html: string }[] }>(
      'GET',
      `/articles/${articleUid}/versions`,
    )
    const html = reread.json.versions.find((v) => v.uid === versionUid)?.html ?? ''
    expect(html).toContain('追記した段落')
    // 出現順3 は編集後の本文でのみ存在する（保存済みHTMLを土台にしていたら置換できない）
    expect(html).toContain('href="https://new.example.test/offer"')
    expect(html).toContain('href="https://added.example.test/x"')
  })

  it('存在しない出現順は無視され、置換件数に数えない', async () => {
    const { articleUid, versionUid } = await seedArticle()
    await seedHtml(versionUid, LP_HTML)
    const replaced = await request<{ replaced_count: number }>(
      'POST',
      `/articles/${articleUid}/link_replace`,
      {
        version_uid: versionUid,
        indexes: [0, 99],
        target_type: 'free',
        url: 'https://new.example.test/offer',
        tracking: true,
        new_tab: false,
      },
    )
    expect(replaced.json.replaced_count).toBe(1)
  })

  it('許可プロトコル以外のURLは422で拒否する', async () => {
    const { articleUid, versionUid } = await seedArticle()
    const bad = await request<{ error: { code: string } }>(
      'POST',
      `/articles/${articleUid}/link_replace`,
      {
        version_uid: versionUid,
        indexes: [0],
        target_type: 'free',
        url: 'javascript:alert(1)',
        tracking: true,
        new_tab: false,
      },
    )
    expect(bad.status).toBe(422)
    expect(bad.json.error.code).toBe('validation_failed')
  })

  it('選択が空なら422で拒否する', async () => {
    const { articleUid, versionUid } = await seedArticle()
    const bad = await request('POST', `/articles/${articleUid}/link_replace`, {
      version_uid: versionUid,
      indexes: [],
      target_type: 'free',
      url: 'https://new.example.test/offer',
      tracking: true,
      new_tab: false,
    })
    expect(bad.status).toBe(422)
  })

  it('存在しない中間ページを指すと422で拒否する', async () => {
    const { articleUid, versionUid } = await seedArticle()
    const bad = await request('POST', `/articles/${articleUid}/link_replace`, {
      version_uid: versionUid,
      indexes: [0],
      target_type: 'redirectPage',
      redirect_page_uid: 'REDIRECT_9999',
      tracking: true,
      new_tab: false,
    })
    expect(bad.status).toBe(422)
  })

  it('存在しない記事は404', async () => {
    const bad = await request('POST', '/articles/ARTICLE_9999/link_replace', {
      indexes: [0],
      target_type: 'free',
      url: 'https://new.example.test/offer',
      tracking: true,
      new_tab: false,
    })
    expect(bad.status).toBe(404)
  })
})
