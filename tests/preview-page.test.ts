import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * プレビュー画面（右レール「プレビュー」→新しいタブで開く実ルート
 * `/ab_tests/:uid/articles/:stepUid/previews`）の土台が、配線に要る目印を保つかの回帰テスト。
 * 見た目は採取した実DOM＋実CSSが担保する（手書きで似せない・§11）。
 */
describe('プレビュー画面の土台（採取マークアップ）', () => {
  const fragment = readFileSync(
    'src/app/fragments/ab_tests__UID__articles__UID__previews__default.html',
    'utf8',
  )

  it('中央のLPプレビュー iframe（#previewIframe）がある', () => {
    expect(fragment).toContain('id="previewIframe"')
  })

  it('上部の2枚のURLカード（作成中の確認用URL / 配信URL）がある', () => {
    expect(fragment).toContain('作成中の確認用URL')
    expect(fragment).toContain('配信URL')
    expect(fragment).toContain('レポート除外設定')
  })

  it('採取ノイズ（本番JS・採取ツールの痕跡・実URL）が混ざっていない', () => {
    expect(fragment).not.toContain('<script')
    expect(fragment).not.toContain('claude-agent')
    // 実ドメイン/トークンは匿名化されているはず（例示ドメインのみ許容）
    expect(fragment).not.toContain('squadbeyond.com')
    expect(fragment).not.toContain('discover-news')
  })
})
