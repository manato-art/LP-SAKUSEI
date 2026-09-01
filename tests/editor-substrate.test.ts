import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * エディタの土台（採取DOM）が、挙動配線に必要な**安定した目印**を保っているかの回帰テスト。
 *
 * 背景（実際に踏んだ不具合）: 匿名化がプレビュー枠 iframe のEmotionクラス
 * `_quillEditorWrapper_…` を `UID_…` に置換したため、`mountQuill` が
 * `iframe[class*="quillEditorWrapper"]` で枠を見つけられず、Quill をページ末尾に
 * 生成してしまい「本文がエディタの下に落ちる（画角が崩れる）」状態になった。
 * → クラスは匿名化され得るので、**id で引く**（`#quillIframe`）方針に変更。
 * このテストは、その id が土台に在り続けることを保証する。
 */
describe('エディタ土台の安定した目印', () => {
  const substrate = readFileSync(
    'src/app/fragments/ab_tests__UID__articles__editor-target.html',
    'utf8',
  )

  it('プレビュー枠 iframe は id="quillIframe" で引ける（クラスは匿名化され得るので id が正）', () => {
    expect(substrate).toContain('id="quillIframe"')
  })

  it('右レール・Versionパネル・エディタ枠の目印が土台に在る', () => {
    expect(substrate).toContain('data-test="editorWrapper"')
    expect(substrate).toContain('sideToolbarIcon') // 右レール9アイコンの土台
    expect(substrate).toContain('quillEditorContentWrapper') // 本文コンテンツ枠
  })
})
