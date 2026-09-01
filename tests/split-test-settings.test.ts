/**
 * Versionオプション設定（`/ab_tests/:uid/articles/split_test_settings/:tab`）の機械証明。
 *
 * 環境は node（jsdom 無し）なので、DOMを触る配線はテストせず、
 * 「採取した実HTMLに、配線が前提にする目印・タブが実在するか」と、
 * 「ルート解決の純粋関数が採取物と一致するか」を検証する（共通指示 §5）。
 *
 * 採取物のuidはテストへ書き写さない（§1-2）。href は形（`shape`）にしてから比べる。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { stripShellFromFragment } from '../src/app/pages/report-substrate.ts'
import {
  DEFAULT_SPLIT_TEST_TAB,
  SPLIT_TEST_TABS,
  SPLIT_TEST_TAB_LABELS,
  editorHash,
  isSplitTestTab,
  redirectPagesHash,
  splitTestSettingsHash,
  splitTestTabFromHref,
  type SplitTestTab,
} from '../src/app/pages/beyond-nav.ts'

const FRAGMENT_DIR = 'src/app/fragments'
function fragmentPath(tab: SplitTestTab): string {
  return `${FRAGMENT_DIR}/ab_tests__UID__articles__split_test_settings__${tab}.html`
}
function read(tab: SplitTestTab): string {
  return readFileSync(fragmentPath(tab), 'utf8')
}

/** uid部分を伏せて「URLの形」だけにする（採取物のuidをテストに書かないため） */
function shape(url: string): string {
  return url
    .replace(/\/folders\/[^/?#]+/, '/folders/:folder_uid')
    .replace(/\/ab_tests\/[^/?#]+/, '/ab_tests/:ab_test_uid')
}

/** タブバーのアンカー（テキスト付き）から (tab, label) を集める */
function capturedTabPairs(html: string): { tab: string; label: string }[] {
  const found: { tab: string; label: string }[] = []
  for (const m of html.matchAll(
    /<a[^>]*href="[^"]*split_test_settings\/(\w+)"[^>]*>(.*?)<\/a>/g,
  )) {
    const text = (m[2] ?? '').replace(/<[^>]+>/g, '').trim()
    if (text === '') continue // 上部右の「オプション設定」アイコン（テキスト無し）は除く
    found.push({ tab: m[1] as string, label: text })
  }
  return found
}

describe('採取物が示す6タブが、定数・表示名と一致する', () => {
  it('6タブの並びが採取物どおり', () => {
    expect([...SPLIT_TEST_TABS]).toEqual(['devices', 'params', 'hours', 'periods', 'oses', 'carriers'])
  })

  it('既定タブは devices（オプション設定アイコンの遷移先）', () => {
    expect(DEFAULT_SPLIT_TEST_TAB).toBe('devices')
  })

  it('各タブ断片のタブバーに6タブ全部が同じ順・同じ文言で並ぶ', () => {
    for (const tab of SPLIT_TEST_TABS) {
      const pairs = capturedTabPairs(read(tab))
      expect(pairs.map((p) => p.tab)).toEqual([...SPLIT_TEST_TABS])
      // 表示名の定数が採取物の文言と一致する
      for (const { tab: t, label } of pairs) {
        expect(SPLIT_TEST_TAB_LABELS[t as SplitTestTab]).toBe(label)
      }
    }
  })
})

describe('ルート解決の純粋関数', () => {
  it('href の末尾からタブを取り出す', () => {
    expect(splitTestTabFromHref('/ab_tests/CAP/articles/split_test_settings/params')).toBe('params')
    expect(splitTestTabFromHref('/ab_tests/CAP/articles/split_test_settings/carriers')).toBe(
      'carriers',
    )
  })

  it('split_test_settings 以外・未知のタブは null（推測で埋めない）', () => {
    expect(splitTestTabFromHref('/ab_tests/CAP/articles')).toBeNull()
    expect(splitTestTabFromHref('/ab_tests/CAP/articles/split_test_settings/unknown')).toBeNull()
    expect(splitTestTabFromHref('')).toBeNull()
  })

  it('isSplitTestTab は6タブだけ true', () => {
    for (const tab of SPLIT_TEST_TABS) expect(isSplitTestTab(tab)).toBe(true)
    expect(isSplitTestTab('devices ')).toBe(false)
    expect(isSplitTestTab('exit_popups')).toBe(false)
  })

  it('各ハッシュルートの形', () => {
    expect(splitTestSettingsHash(':ab_test_uid', 'devices')).toBe(
      '#/ab_tests/:ab_test_uid/articles/split_test_settings/devices',
    )
    expect(redirectPagesHash(':folder_uid', ':ab_test_uid')).toBe(
      '#/folders/:folder_uid/ab_tests/:ab_test_uid/redirect_pages',
    )
    expect(editorHash(':ab_test_uid')).toBe('#/ab_tests/:ab_test_uid/articles')
  })

  it('採取したタブアンカーの href が、生成するハッシュルートと形として一致する', () => {
    const pairs = capturedTabPairs(read('devices'))
    // 採取物のタブバーの href（uidを伏せた形）
    const hrefs = [...read('devices').matchAll(/href="([^"]*split_test_settings\/\w+)"/g)]
      .map((m) => shape(m[1] as string))
      .filter((h, i, a) => a.indexOf(h) === i)
    for (const { tab } of pairs) {
      const generated = shape(splitTestSettingsHash(':ab_test_uid', tab as SplitTestTab).slice(1))
      expect(hrefs).toContain(generated)
    }
  })
})

describe('採取物に、配線が前提にする目印が実在する', () => {
  it('シェルのサイドバーを落として本文が残る', () => {
    const fragment = read('devices')
    expect(fragment).toContain('data-testid="list-menu-item"')
    const content = stripShellFromFragment(fragment)
    expect(content).not.toContain('data-testid="list-menu-item"')
    expect(content).toContain('_currentAbTest_dcd38_60') // 上部バー
  })

  const topBarMarks = ['_back_dcd38_35', '_title_dcd38_67', '_folderName_dcd38_85'] as const
  for (const tab of SPLIT_TEST_TABS) {
    it(`${tab}: 上部バーの差し替え目印が全部ある`, () => {
      const html = read(tab)
      for (const mark of topBarMarks) expect(html).toContain(mark)
    })
    it(`${tab}: 左レール4タブ（info/version/popup/report）が居る`, () => {
      const ids = [
        ...read(tab).matchAll(/<a[^>]*\bid="(info|version|popup|report)"/g),
      ].map((m) => m[1])
      // PC用・SP用の2組で各タブ2回ずつ
      expect(new Set(ids)).toEqual(new Set(['info', 'version', 'popup', 'report']))
    })
  }

  it('上部右3アイコン（編集/オプション設定/中間ページ）のアンカーが同定できる', () => {
    const html = read('devices')
    expect(html).toContain('data-trackid="editor-nav-editor"') // #1 編集
    expect(shape('/ab_tests/UID/articles/split_test_settings/devices')).toBe(
      '/ab_tests/:ab_test_uid/articles/split_test_settings/devices',
    )
    // #3 中間ページ（folder_uid を含む実ルート）
    expect(html).toMatch(/href="\/folders\/[^/"]+\/ab_tests\/[^/"]+\/redirect_pages"/)
  })
})
