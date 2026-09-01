import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 「Version複製」モーダル（版の「…」→「複製」で開く）。
 * 見た目は採取した実物を土台にするので、文言・目印が採取物に**実在する**ことを突き合わせる
 * （手本 tests/version-dots-menu.test.ts・jsdom を使わない文字列照合）。
 */
const MODAL = 'src/app/fragments/ab_tests__UID__articles__version-duplicate-modal.portals.html'
const PANEL = 'src/app/panels/version-duplicate-modal.ts'
const DOTS = 'src/app/panels/version-dots-menu.ts'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('Version複製モーダルの文言・目印は採取物に実在する', () => {
  const modal = read(MODAL)

  it('ReactModal（ダークテーマ）の器と主要ボタンがある', () => {
    expect(modal).toContain('ReactModal__Overlay')
    expect(modal).toContain('role="dialog"')
    expect(modal).toContain('_darkTheme_11n4w_23')
    expect(modal).toContain('>Version複製<')
    expect(modal).toContain('>複製する<')
    expect(modal).toContain('>閉じる<')
  })

  it('複製個数は最大4の number 入力（実物どおり）', () => {
    expect(modal).toContain('複製個数')
    expect(modal).toMatch(/name="duplicateCount"[^>]*min="1"[^>]*max="4"[^>]*type="number"/)
  })

  it('リンク・引き継ぎの選択肢が採取物にある', () => {
    expect(modal).toContain('>リンクを残す<')
    expect(modal).toContain('>リンクを削除<')
    expect(modal).toContain('>トラッキングリンクだけ削除<')
    expect(modal).toContain('>引き継ぐ<')
  })

  it('実データ（実ページ名・本番ドメイン）が漏れていない', () => {
    expect(modal).not.toMatch(/ナイトエンペラー|複製用/)
    expect(modal).not.toContain('squadbeyond.com')
  })
})

describe('「…」→複製 はモーダルを開くよう結線されている', () => {
  it('dots-menu の複製ハンドラは openDuplicateModal を呼ぶ（即複製しない）', () => {
    const dots = read(DOTS)
    expect(dots).toContain("import { openDuplicateModal } from './version-duplicate-modal.ts'")
    expect(dots).toMatch(/DOTS_MENU_LABELS\.duplicate\]:\s*\(\)\s*=>\s*openDuplicateModal\(deps\)/)
    // 旧・即複製の関数は残っていない
    expect(dots).not.toContain('async function duplicate(')
  })

  it('パネルは採取した実モーダル断片を土台にする（手書きしない）', () => {
    const panel = read(PANEL)
    expect(panel).toContain('version-duplicate-modal.portals.html?raw')
    expect(panel).toContain("openPortal(rawModal, '.ReactModal__Overlay'")
    // 複製個数は 1〜4 にクランプして、その回数だけ複製する
    expect(panel).toContain('Math.min(4, Math.max(1, raw))')
    expect(panel).toContain('api.duplicateVersion(current.uid)')
  })
})
