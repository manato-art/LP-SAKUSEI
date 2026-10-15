/**
 * LP作成者で入ったときの画面（2026-10-15 本人指定）。
 * 使えないものは画面にも出さない（サーバーでも断っている・tests/creator-access.test.ts）。
 */
import { describe, expect, it } from 'vitest'
import {
  CREATOR_HIDDEN_SIDEBAR_LABELS,
  creatorBottomNavHrefs,
  creatorMoreItemLabels,
  isCreatorRoute,
} from '../src/app/creator-ui.ts'
import { BOTTOM_NAV_ITEMS, MORE_ITEMS } from '../src/app/mobile/bottom-nav.ts'
import { parseSession } from '../src/app/session.ts'

describe('LP作成者が開ける画面', () => {
  it.each([
    '/folders',
    '/ab_tests/AB1/articles',
    '/folders/F1/ab_tests/AB1/edit',
    '/ab_tests/AB1/articles/exit_popups',
    '/ab_tests/AB1/articles/split_test_settings/devices',
    '/folders/F1/ab_tests/AB1/redirect_pages',
    '/settings/account',
  ])('%s は開ける', (path) => {
    expect(isCreatorRoute(path)).toBe(true)
  })

  it.each([
    '/dashboard',
    '/tasks',
    '/conversions',
    '/rankings',
    '/ab_tests/AB1/reports',
    '/ab_tests/AB1/articles/htmls/heatmaps/comparisons',
    '/teams/tags',
    '/articles/bulk_replaces',
    '/teams/product_search_forms',
    '/inspections',
    '/teams/ad_accounts',
    '/teams/asp_accounts',
    '/teams/domains',
    '/report-exclusions',
    '/settings/internal_notifications/member',
    '/sb_ai',
  ])('%s は開けない', (path) => {
    expect(isCreatorRoute(path)).toBe(false)
  })
})

describe('サイドバーとスマホの下のメニュー', () => {
  it('数字・ツール・全体の設定の項目は出さない（ページとマイページは出す）', () => {
    for (const label of ['ダッシュボード', 'タスク', 'CV速報', 'ツール', '一括タグ', '外部連携', 'ドメイン', 'レポート除外', 'テーマ', 'ダークモード']) {
      expect(CREATOR_HIDDEN_SIDEBAR_LABELS, label).toContain(label)
    }
    expect(CREATOR_HIDDEN_SIDEBAR_LABELS).not.toContain('ページ')
    expect(CREATOR_HIDDEN_SIDEBAR_LABELS).not.toContain('マイページ')
  })

  it('スマホの下のメニューは「ページ」と「その他（マイページ）」だけ', () => {
    expect(creatorBottomNavHrefs(BOTTOM_NAV_ITEMS)).toEqual(['#/folders'])
    expect(creatorMoreItemLabels(MORE_ITEMS)).toEqual(['マイページ'])
  })
})

describe('ログインしている人を読む', () => {
  it('LP作成者', () => {
    expect(parseSession({ role: 'creator', email: 'w@example.com', name: '佐藤' })).toEqual({
      role: 'creator',
      email: 'w@example.com',
      name: '佐藤',
    })
  })

  it('管理者・読めないときは管理者として扱う（使える範囲はサーバーが決めている）', () => {
    expect(parseSession({ role: 'admin' }).role).toBe('admin')
    expect(parseSession(null).role).toBe('admin')
    expect(parseSession({ role: 'something' }).role).toBe('admin')
  })
})
