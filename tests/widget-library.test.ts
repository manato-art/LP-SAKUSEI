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

  /**
   * この断片は `npm run rehydrate` の出力**ではない**。
   * 元になった `capture/clean/widget-library/baked/dom.html` は
   * カテゴリ別の grid.html.gz に置き換わったときに消しており、
   * 25枚の実プレビューはこのファイルにしか残っていない。
   * rehydrate を回すと採取物から作り直されて 1MB → 70KB に痩せる（＝プレビューが消える）。
   * 気付かずコミットしないよう、ここで大きさと中身を固定する。
   */
  it('25枚の実プレビュー（srcdoc）を保つ＝rehydrateで痩せていない', () => {
    expect([...fragment.matchAll(/srcdoc=/g)].length).toBeGreaterThanOrEqual(25)
    expect(fragment.length).toBeGreaterThan(900_000)
  })

  it('実ユーザーの独自Widget名・本番JS痕跡が混ざっていない', () => {
    expect(fragment).not.toContain('フェムケア')
    expect(fragment).not.toContain('<script')
    expect(fragment).not.toContain('claude-agent')
  })
})
