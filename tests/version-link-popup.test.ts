import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { VERSION_LINK_HOOK, buildVersionLinkUrl } from '../src/app/panels/version-link-popup.ts'

/**
 * 下部バーの「Versionリンク」コピー popup（task 3）。
 * popup とトリガーは editor-target の土台に実在することをパースして固定する。
 */
const EDITOR = 'src/app/fragments/ab_tests__UID__articles__editor-target.html'
const BOTTOM = 'src/app/fragments/ab_tests__UID__articles__bottom-version-link.html'
const EDITOR_CSSOM = 'capture/clean/ab_tests__UID__articles/editor-target/cssom.css'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('Versionリンク popup の目印は採取物に実在する（task 3）', () => {
  const editor = read(EDITOR)

  it('popup 本体（sample_token + data-is-hide-opacity）が土台にある', () => {
    expect(editor).toContain('data-is-hide-opacity')
    // 見出し「Versionリンク」と「コピーする」span、readonly な #versionLink 入力
    expect(editor).toContain('Versionリンク')
    expect(editor).toContain('コピーする')
    expect(editor).toContain('id="versionLink"')
  })

  it('トリガー（home ＝ _funneStepList_rugej_35）が土台にある', () => {
    expect(editor).toContain('_funneStepList_rugej_35')
    expect(VERSION_LINK_HOOK.trigger).toBe('._funneStepList_rugej_35')
  })

  it('開いた状態（data-is-hide-opacity="false"）が別採取に実在する＝開閉の仕組みが実物どおり', () => {
    const bottom = read(BOTTOM)
    expect(bottom).toContain('data-is-hide-opacity="false"')
  })

  it('popup のCSSは editor-target の実CSSに入っている（追加link不要の根拠）', () => {
    const css = read(EDITOR_CSSOM)
    expect(css).toContain('_funnelStepWrapper_rugej')
    expect(css).toContain('_title_rugej_133')
  })
})

describe('コピーするURLの組み立て（純粋関数）', () => {
  // 2026-09-24 全体点検25: 以前は `?version=` を付けていたが、配信はそれを読まず、
  // ステップ2のリンクを貼ってもステップ1が開いていた。実物と同じ `?step_uid=` にする
  it('配信URLにステップを添える（/lp/:abTestUid?step_uid=）', () => {
    expect(buildVersionLinkUrl('https://lp.example.test/lp/UID_1997', 'ARTICLE_0002')).toBe(
      'https://lp.example.test/lp/UID_1997?step_uid=ARTICLE_0002',
    )
  })

  it('ステップが分からなければ配信URLのまま', () => {
    expect(buildVersionLinkUrl('https://lp.example.test/lp/UID_1997', '')).toBe('https://lp.example.test/lp/UID_1997')
  })

  it('配信URLが無い（フォルダのドメインが未設定）なら組み立てを拒否する', () => {
    expect(() => buildVersionLinkUrl('', 'ARTICLE_0002')).toThrow()
  })
})
