import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { STEP_ADD_HOOK, STEP_COLORS } from '../src/app/panels/step-add-modal.ts'

/**
 * ステップの追加モーダル（task 4）。
 * カラー・文言・目印は**採取した実物をパースして**突き合わせる。
 */
const MODAL = 'src/app/fragments/ab_tests__UID__articles__step-add-modal.portals.html'
const EDITOR = 'src/app/fragments/ab_tests__UID__articles__editor-target.html'
const MODAL_CSSOM = 'capture/clean/ab_tests__UID__articles/step-add-modal/cssom.css'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

/** _colorList_rugej_277 の background-color を採取物から順番どおり取り出す */
function capturedColors(html: string): string[] {
  return [...html.matchAll(/_colorList_rugej_277[^>]*?style="background-color:\s*(rgb\([^)]*\))/g)].map(
    (m) => (m[1] as string).trim(),
  )
}

describe('ステップ追加モーダルの中身は採取物と一致する（task 4）', () => {
  const modal = read(MODAL)

  it('カラー見本8色（先頭に黒）が採取物と同じ・順番も同じ', () => {
    const captured = capturedColors(modal)
    // 採取物にユニークで存在する色（重複コピーを除いた最初の1セット）
    const firstSet = captured.slice(0, STEP_COLORS.length)
    expect(firstSet.length).toBe(STEP_COLORS.length)
    expect(STEP_COLORS).toEqual(firstSet)
    expect(STEP_COLORS[0]).toBe('rgb(0, 0, 0)')
  })

  it('主要な文言（見出し・引き継ぎ・ナビゲーション・ボタン）が採取物にある', () => {
    for (const text of [
      'ステップの追加',
      'ステップ名',
      'ステップカラー',
      '引き継ぎ設定',
      'ヘッダー',
      'フッター',
      'Version設定',
      '引き継ぐ',
      '引き継がない',
      'ナビゲーション',
      '追加する',
      '追加しない',
      STEP_ADD_HOOK.cancel,
      STEP_ADD_HOOK.create,
    ]) {
      expect(modal, `「${text}」が採取物に無い`).toContain(text)
    }
  })

  it('トリガー（下部バーの「+」＝ _btnNewFunnel_rugej_13）が editor-target にある', () => {
    const editor = read(EDITOR)
    expect(editor).toContain('_btnNewFunnel_rugej_13')
    expect(STEP_ADD_HOOK.trigger).toBe('._btnNewFunnel_rugej_13')
  })

  it('カラー選択の active クラスは採取した実CSSに実在する', () => {
    const css = read(MODAL_CSSOM)
    expect(css).toContain(STEP_ADD_HOOK.colorActive)
    expect(css).toContain('_funnelStepModal_rugej_212')
  })
})
