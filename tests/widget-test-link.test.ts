/**
 * Widget編集（ポップアップの中身も同じ画面）で、Ctrl/⌘＋クリックの動作確認をしたリンクのボタンは、
 * 新しいタブでリンク先を開く（2026-10-30 本人「ここに入れたリンクに移行できない」）。
 *
 * 動作確認でも編集画面からは離れない（指示156）ので、これまでリンクは止めたままで、リンク先を入れても
 * どこへも移らなかった。外のページ（http・https）へのリンクだけ新しいタブで開き、編集画面はそのまま残す。
 */
import { describe, expect, it } from 'vitest'
import { testLinkUrl } from '../src/app/panels/widget-test-link.ts'

/** a 要素の代わり（href と、押したら見本の中で動く印が付いた祖先があるか） */
const anchor = (href: string | null, inWidgetPress = false) => ({
  getAttribute: (name: string) => (name === 'href' ? href : null),
  closest: (_selector: string) => (inWidgetPress ? {} : null),
})

describe('動作確認で押したリンクのボタン', () => {
  it('リンク先（https・http）を入れたボタンは、そのリンク先を新しいタブで開く', () => {
    expect(testLinkUrl(anchor('https://shop.example.test/buy'))).toBe('https://shop.example.test/buy')
    expect(testLinkUrl(anchor('http://shop.example.test/buy?sb_tracking=true'))).toBe('http://shop.example.test/buy?sb_tracking=true')
    expect(testLinkUrl(anchor('  https://shop.example.test/buy  '))).toBe('https://shop.example.test/buy')
  })

  it('仮のリンク（#）・javascript:・リンク先なしは開かない', () => {
    expect(testLinkUrl(anchor('#'))).toBeNull()
    expect(testLinkUrl(anchor('#form'))).toBeNull()
    expect(testLinkUrl(anchor('javascript:void(0)'))).toBeNull()
    expect(testLinkUrl(anchor(null))).toBeNull()
  })

  it('相対のURLは開かない（編集画面の住所で開いてしまい、配信で移る先と違う）', () => {
    expect(testLinkUrl(anchor('/thanks'))).toBeNull()
    expect(testLinkUrl(anchor('thanks.html'))).toBeNull()
  })

  it('押すと見本の中で画面が切り替わる・小窓を出すボタンは開かない（配信でもリンク先へは移らない）', () => {
    expect(testLinkUrl(anchor('https://shop.example.test/buy', true))).toBeNull()
  })
})
