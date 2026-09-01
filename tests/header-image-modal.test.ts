import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { HEADER_IMAGE_HOOK, HEADER_IMAGE_TABS } from '../src/app/panels/header-image-modal.ts'

/**
 * ヘッダー画像設定モーダル（task 2）。
 * タブ・空状態・ボタン・目印は**採取した実物をパースして**突き合わせる。
 */
const MODAL = 'src/app/fragments/ab_tests__UID__articles__header-image-modal.portals.html'
const EDITOR = 'src/app/fragments/ab_tests__UID__articles__editor-target.html'
const MODAL_CSSOM = 'capture/clean/ab_tests__UID__articles/header-image-modal/cssom.css'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('ヘッダー画像モーダルの中身は採取物と一致する（task 2）', () => {
  const modal = read(MODAL)

  it('検索範囲タブ4つが採取物と同じ・順番も同じ', () => {
    let cursor = -1
    for (const tab of HEADER_IMAGE_TABS) {
      const idx = modal.indexOf(`>${tab}<`)
      expect(idx, `タブ「${tab}」が採取物に無い/順番が違う`).toBeGreaterThan(cursor)
      cursor = idx
    }
    // 先頭タブ「全て」が active で採取されている
    expect(modal).toContain('_tab_1pk5s_139 _active_1pk5s_88')
  })

  it('モーダルの目印（タイトル・グリッド・閉じる・アップロードする）が採取物にある', () => {
    expect(modal).toContain('ヘッダー画像設定')
    expect(modal).toContain('_headerPhotoWrapper_1pk5s_72')
    expect(modal).toContain(`>${HEADER_IMAGE_HOOK.close}<`)
    expect(modal).toContain(`>${HEADER_IMAGE_HOOK.upload}<`)
  })

  it('空状態（画像がありません / _noImageDescription）は採取物に実在する', () => {
    // モーダル断片ではなく、土台（editor-target）と実CSSに在る採取物を使う
    // （＝手書きで作らず、実在する空状態クラス・文言に差し替える根拠）。
    const editor = read(EDITOR)
    const css = read(MODAL_CSSOM)
    expect(editor).toContain(HEADER_IMAGE_HOOK.emptyText)
    expect(editor).toContain(HEADER_IMAGE_HOOK.emptyClass)
    expect(css).toContain(HEADER_IMAGE_HOOK.emptyClass)
  })

  it('トリガー（本文上部の破線ボックス）が editor-target にある', () => {
    const editor = read(EDITOR)
    expect(editor).toContain('_articleHeaderPhoto_1pk5s_1')
    expect(editor).toContain('ヘッダー画像を追加する')
    expect(HEADER_IMAGE_HOOK.trigger).toBe('._articleHeaderPhoto_1pk5s_1')
  })

  it('モーダルのCSSクラスは採取した実CSSに実在する', () => {
    const css = read(MODAL_CSSOM)
    expect(css).toContain('_headerPhotoWrapper_1pk5s_72')
    expect(css).toContain(HEADER_IMAGE_HOOK.emptyClass)
    expect(css).toContain('_tab_1pk5s_139')
  })
})
