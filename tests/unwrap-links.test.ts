/**
 * Version複製の「リンク設定」（2026-09-24 全体点検13: 選んでも何も変わらず、複製先にリンクが残っていた）
 */
import { describe, expect, it } from 'vitest'
import { unwrapLinksInHtml } from '../src/shared/link-html.ts'

const HTML =
  '<p>まずは<a href="https://shop.example.test/lp?sb_tracking=true">こちら</a>から</p>' +
  '<p><a href="/company" class="x"><img src="/a.png">運営者</a></p>' +
  '<p><a href="tel:0000000000" data-sb-tracking="true">電話</a></p>'

describe('リンクを外す（中身の文字・画像は残す）', () => {
  it('【削除】全てのページ内URL: どのリンクも外す', () => {
    expect(unwrapLinksInHtml(HTML, 'all')).toBe('<p>まずはこちらから</p><p><img src="/a.png">運営者</p><p>電話</p>')
  })

  it('【削除】トラッキングリンクだけ: 計測付きのリンクだけ外す', () => {
    expect(unwrapLinksInHtml(HTML, 'tracking')).toBe(
      '<p>まずはこちらから</p><p><a href="/company" class="x"><img src="/a.png">運営者</a></p><p>電話</p>',
    )
  })

  it('リンクが無ければそのまま', () => {
    expect(unwrapLinksInHtml('<p>本文</p>', 'all')).toBe('<p>本文</p>')
  })
})
