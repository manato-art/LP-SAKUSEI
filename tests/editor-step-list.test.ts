/**
 * エディタ下部のステップ一覧（2026-09-15）。
 *
 * 採取物（editor-beyond-empty）の下部バーには
 *   `_funneSteplListWrapper_` の中に `_funneStepList_`（ステップ1つぶん）
 * があり、CSSには
 *   `._funneStepList_ ._name_` … 名前（130px・はみ出しは…）
 *   `._funneStepList_._parent_` … 先頭のステップ（名前ではなく家アイコン）
 *   `._active_` … いま開いているステップ
 * が定義されている。
 *
 * クローンはステップを**作れる**のに一覧を描いていなかったので、
 * 作ったあとは行き来できず、事実上見えないままだった。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { stepLabel } from '../src/app/pages/editor-step-list.ts'

describe('ステップの名前', () => {
  it('名前があればそれを出す', () => {
    expect(stepLabel({ uid: 'A', memo: '申込ページ' }, 1)).toBe('申込ページ')
  })

  it('名前が無ければ何番目かで出す（空欄のまま並べない）', () => {
    expect(stepLabel({ uid: 'A', memo: '' }, 1)).toBe('ステップ2')
    expect(stepLabel({ uid: 'A' }, 3)).toBe('ステップ4')
  })

  it('前後の空白は落とす', () => {
    expect(stepLabel({ uid: 'A', memo: '  申込  ' }, 1)).toBe('申込')
  })
})

describe('採取物に、配線が前提にしている目印が実在する', () => {
  const dom = readFileSync('src/app/fragments/ab_tests__UID__articles__editor-beyond-empty.html', 'utf8')
  const css = readFileSync('capture/clean/_merged/cssom.css', 'utf8')

  it('ステップ一覧の器と、1つぶんの雛形がある', () => {
    expect(dom).toContain('_funneSteplListWrapper_')
    expect(dom).toContain('_funneStepList_')
  })

  it('名前・先頭・選択中のクラスが採取CSSにある', () => {
    expect(css).toContain('._name_rugej_46')
    expect(css).toContain('._parent_rugej_52')
    expect(css).toContain('_active_rugej_66')
  })
})

describe('配線', () => {
  const src = readFileSync('src/app/pages/editor-step-list.ts', 'utf8')
  const editor = readFileSync('src/app/pages/editor.ts', 'utf8')

  it('ステップの節そのものは採取物の雛形を複製して使う（手書きで似せない）', () => {
    expect(src).toContain('[class*="_funneSteplListWrapper_"]')
    expect(src).toContain('[class*="_funneStepList_"]')
    expect(src).toContain('template.cloneNode(true)')
  })

  it('ステップを作ったあとも一覧を描き直す', () => {
    expect(editor).toContain('renderStepList(ctx)')
  })
})
