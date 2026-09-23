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

  it('カテゴリーの器と、カードを入れる器がある（中身はアプリが描く）', () => {
    expect(fragment).toContain('MuiButton-fullWidth')
    expect(fragment).toContain('css-ojejk4')
  })

  /**
   * 2026-09-23: SB由来の見本（25枚のカードと16のカテゴリー）は本人の指示で外した。
   * 一覧に出すのは自作の見本（src/app/panels/nocode/samples/）で、アプリが描く。
   * 採取物に見本が混ざって戻らないよう（rehydrate で作り直すと戻る）、ここで空であることを固定する。
   */
  it('見本のカード・SB由来のカテゴリーは残っていない（外したものが戻らない）', () => {
    expect(fragment).not.toContain('srcdoc=')
    expect(fragment).not.toContain('MuiCard-root')
    expect([...fragment.matchAll(/MuiButton-fullWidth/g)]).toHaveLength(2) // 最初の2つ（見本・お気に入り）だけ
    expect(fragment).not.toContain('吹き出し')
    expect(fragment.length).toBeLessThan(20_000)
  })
})
