/**
 * ツール4ページ（一括タグ / マジック置換 / メディア / 審査）の機械証明。
 *
 * 環境は node（jsdom 無し）なので、DOMを触る配線はテストせず、
 * 「採取した実HTMLに、配線が前提にする目印・サブナビの遷移先が実在するか」と、
 * 「ルート解決の純粋関数が採取物と一致するか」を検証する（共通指示 §5）。
 *
 * 採取物の実uid・実データ名はテストへ書き写さない（§1-2）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { stripGlobalSidebar } from '../src/app/pages/sidebar-shell.ts'
import { INSPECTION_LIST_IDS } from '../src/app/pages/tool-pages.ts'
import {
  INSPECTIONS_CANONICAL_ROUTE,
  REMOVED_SUBNAV_PATHS,
  TOOL_PAGE_ROUTES,
  TOOL_SUBNAV_LABELS,
  TOOL_SUBNAV_PATHS,
  matchToolPage,
  toolSubnavHash,
} from '../src/app/pages/tool-subnav.ts'

const FRAGMENT_DIR = 'src/app/fragments'
const FRAGMENT_BY_PAGE = {
  tags: 'teams__tags__default.html',
  bulkReplaces: 'articles__bulk_replaces__default.html',
  media: 'teams__product_search_forms__default.html',
  inspections: 'inspections__folders__default.html',
} as const

function read(file: string): string {
  return readFileSync(`${FRAGMENT_DIR}/${file}`, 'utf8')
}

/** サブナビのアンカー（絶対パス→表示名）を採取HTMLから集める（空白は畳んで消す） */
function capturedSubnavPairs(html: string): { path: string; label: string }[] {
  const found: { path: string; label: string }[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<a[^>]*href="(\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const path = m[1] as string
    if (!(TOOL_SUBNAV_PATHS as readonly string[]).includes(path)) continue
    const label = (m[2] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim()
    const key = `${path}::${label}`
    if (seen.has(key)) continue
    seen.add(key)
    found.push({ path, label })
  }
  return found
}

describe('ルート解決の純粋関数', () => {
  it('各ツールパスが対応するページへ解決する', () => {
    expect(matchToolPage(TOOL_PAGE_ROUTES.tags)).toBe('tags')
    expect(matchToolPage(TOOL_PAGE_ROUTES.bulkReplaces)).toBe('bulkReplaces')
    expect(matchToolPage(TOOL_PAGE_ROUTES.media)).toBe('media')
    expect(matchToolPage(TOOL_PAGE_ROUTES.inspections)).toBe('inspections')
  })

  it('審査はサブナビの /inspections と採取した本体 /inspections/folders の両方を受ける', () => {
    expect(matchToolPage('/inspections')).toBe('inspections')
    expect(matchToolPage(INSPECTIONS_CANONICAL_ROUTE)).toBe('inspections')
  })

  it('未知・空パスは null（推測で埋めない）', () => {
    expect(matchToolPage('/folders')).toBeNull() // フォルダは既存の renderFolders 側で解決する
    expect(matchToolPage('/teams/tags/extra')).toBeNull()
    expect(matchToolPage('/inspections/authorities')).toBeNull() // 別タブは未採取
    expect(matchToolPage('')).toBeNull()
  })

  it('フォームはページを持たない（消したので解決しない・張り替えもしない）', () => {
    for (const path of REMOVED_SUBNAV_PATHS) {
      expect(matchToolPage(path)).toBeNull()
      expect(toolSubnavHash(path)).toBeNull()
      expect((TOOL_SUBNAV_PATHS as readonly string[])).not.toContain(path)
    }
  })

  it('サブナビのハッシュ変換は既知パスだけ・形が一致する', () => {
    expect(toolSubnavHash('/teams/tags')).toBe('#/teams/tags')
    expect(toolSubnavHash('/articles/bulk_replaces')).toBe('#/articles/bulk_replaces')
    expect(toolSubnavHash('/inspections')).toBe('#/inspections')
    expect(toolSubnavHash('/folders')).toBe('#/folders')
    expect(toolSubnavHash('/unknown')).toBeNull()
  })

  it('サブナビ5タブの正本が順番どおり', () => {
    expect([...TOOL_SUBNAV_PATHS]).toEqual([
      '/folders',
      '/teams/tags',
      '/articles/bulk_replaces',
      '/teams/product_search_forms',
      '/inspections',
    ])
  })
})

describe('共通サブナビが4ページすべてに、同じ遷移先・同じ文言で実在する', () => {
  for (const [page, file] of Object.entries(FRAGMENT_BY_PAGE)) {
    it(`${page}: 出す5タブが全部そろい、定数の表示名と一致する`, () => {
      const pairs = capturedSubnavPairs(read(file))
      const paths = new Set(pairs.map((p) => p.path))
      // 5タブすべての遷移先が採取物に在る
      expect(paths).toEqual(new Set(TOOL_SUBNAV_PATHS))
      // 表示名の定数が採取物の文言と一致する
      for (const { path, label } of pairs) {
        expect(label).toBe(TOOL_SUBNAV_LABELS[path as (typeof TOOL_SUBNAV_PATHS)[number]])
      }
    })

    it(`${page}: 各サブナビ href がクローンのハッシュへ変換できる`, () => {
      for (const { path } of capturedSubnavPairs(read(file))) {
        expect(toolSubnavHash(path)).toBe(`#${path}`)
      }
    })

    // 消す対象が採取物に実在し、かつ `<li>` の直下に在ることを固定する。
    // `stripRemovedSubnavTabs` は `closest('li')` ごと外すので、この形が崩れると
    // リンクだけ消えてタブの枠が残る。実在しなくなれば空振りにも気づける。
    // サブナビはPC用とSP用で2回出るので、数も一致させる。
    it(`${page}: 消すフォームタブが li ごと採取物に在る（＝空振り・枠残りをしない）`, () => {
      const html = read(file)
      for (const path of REMOVED_SUBNAV_PATHS) {
        const anchors = html.split(`href="${path}"`).length - 1
        const inList = html.match(new RegExp(`<li[^>]*>\\s*<a[^>]*href="${path}"`, 'g')) ?? []
        expect(anchors).toBeGreaterThan(0)
        expect(inList.length).toBe(anchors)
      }
    })
  }
})

describe('採取物に、配線が前提にする目印が実在する', () => {
  it('4ページともグローバルサイドバー（ロゴ）を落として本体が残る', () => {
    for (const file of Object.values(FRAGMENT_BY_PAGE)) {
      const html = read(file)
      expect(html).toContain('Squadbeyond Logo')
      const body = stripGlobalSidebar(html)
      expect(body).not.toContain('Squadbeyond Logo')
      // 本体側のサブナビは残る
      expect(body).toContain('/teams/tags')
    }
  })

  it('一括タグ: 追加ボタンの文言が在る（採取時点で一覧は空）', () => {
    expect(read(FRAGMENT_BY_PAGE.tags)).toContain('タグ設定を追加')
  })

  it('マジック置換: 実行系ボタンと置換タブの文言が在る', () => {
    const html = read(FRAGMENT_BY_PAGE.bulkReplaces)
    expect(html).toContain('置換する')
    expect(html).toContain('アップロード')
  })

  it('メディア: 一覧/商品タブと新規作成フォームの文言が在る', () => {
    const html = read(FRAGMENT_BY_PAGE.media)
    expect(html).toContain('メディア一覧')
    expect(html).toContain('商品一覧')
    expect(html).toContain('保存する')
  })

  it('審査: 実データを落とす2つのリスト容器IDが在る（枠だけ残す対象）', () => {
    const html = read(FRAGMENT_BY_PAGE.inspections)
    for (const id of INSPECTION_LIST_IDS) {
      expect(html).toContain(`id="${id}"`)
    }
    // 採取物には実データ行（フォルダグループ）が入っている＝落とす対象が実在する
    expect(html).toContain('data-folder-group-id=')
    expect(html).toContain('data-folder-id=')
  })
})
