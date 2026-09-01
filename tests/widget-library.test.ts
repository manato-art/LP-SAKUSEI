import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Widgetライブラリ（右レール「パズルピース」＝Widget管理ボタンから開くモーダル）の
 * 土台が、配線に要る目印を保つかの回帰テスト。見た目は採取した実DOM＋実CSSが担う（§11）。
 */
describe('Widgetライブラリの土台（採取マークアップ）', () => {
  const fragment = readFileSync(
    'src/app/fragments/ab_tests__UID__articles__widget-library.portals.html',
    'utf8',
  )

  it('モーダルの器（MuiDialog）と閉じる・検索がある', () => {
    expect(fragment).toContain('MuiDialog-root')
    expect(fragment).toContain('Widgetライブラリ')
    expect(fragment).toContain('placeholder="検索"')
    expect(fragment).toContain('>閉じる<')
  })

  it('カテゴリーとカードの追加/プレビューがある', () => {
    expect(fragment).toContain('最近追加されたウィジェット')
    expect(fragment).toContain('MuiCard-root')
    expect(fragment).toContain('>追加<')
    expect(fragment).toContain('>プレビュー<')
  })

  it('実ユーザーの独自Widget名・本番JS痕跡が混ざっていない', () => {
    expect(fragment).not.toContain('フェムケア')
    expect(fragment).not.toContain('<script')
    expect(fragment).not.toContain('claude-agent')
  })
})
