/**
 * 記事設定の背景2つが、編集画面のキャンバスに渡す値として出てくること（指示179）。
 *
 * これまで背景は配信・プレビューにしか効かず、編集画面のキャンバスは
 * クローン自身のCSS（`background: … !important`）に塗り潰されて既定色のままだった。
 * ＝「設定したのに編集画面だけ変わらない」。CSS変数へ入れる値をここで固定する。
 *
 * 未設定のときに空文字を返すことが要（呼び出し側はそのとき変数を置かず、既定色を保つ）。
 * 空文字でなくなると、中身の無い background 指定で地が透明になってしまう。
 *
 * 色と画像が1つの値にまとまることも見る。`background` ショートハンドなので、
 * 別々に入れると後勝ちで片方が消える。
 */
import { describe, expect, it } from 'vitest'
import {
  masterStyleCanvasBackground,
  masterStyleEditorDecls,
  masterStylePageBackground,
  type MasterStyleSheet,
} from '../src/app/master-style.ts'

const EMPTY: MasterStyleSheet = {
  font_size: null,
  font_family: '',
  color: '',
  text_align: '',
  line_height: null,
  letter_spacing: null,
  img_margin_top: null,
  img_margin_bottom: null,
  padding_top: null,
  padding_bottom: null,
  padding_right: null,
  padding_left: null,
  iframe_height: null,
  iframe_height_unit: '',
  delivery_version_width: null,
  delivery_version_width_unit: '',
  border_size: null,
  border_type: '',
  border_color: '',
  outer_background_color: '',
  outer_background_image: '',
  inner_background_color: '',
  inner_background_image: '',
}

describe('編集画面のキャンバスに渡す背景の値', () => {
  it('未設定なら空文字（変数を置かない＝既定色のまま）', () => {
    expect(masterStyleCanvasBackground(EMPTY)).toBe('')
    expect(masterStylePageBackground(EMPTY)).toBe('')
  })

  it('色だけなら色だけ（実機仕様どおり # なしで保存されるので補う）', () => {
    expect(masterStyleCanvasBackground({ ...EMPTY, outer_background_color: 'f5f5f5' })).toBe('#f5f5f5')
    expect(masterStylePageBackground({ ...EMPTY, inner_background_color: 'FFFDF5' })).toBe('#FFFDF5')
  })

  it('画像だけなら画像だけ（色を勝手に足さない）', () => {
    expect(masterStyleCanvasBackground({ ...EMPTY, outer_background_image: 'https://example.com/a.png' })).toBe(
      'url("https://example.com/a.png") center/cover no-repeat',
    )
  })

  it('色と画像は1つの値にまとまる（別々だとショートハンドで片方が消える）', () => {
    const value = masterStyleCanvasBackground({
      ...EMPTY,
      outer_background_color: '2b3a55',
      outer_background_image: 'https://example.com/a.png',
    })
    expect(value).toBe('#2b3a55 url("https://example.com/a.png") center/cover no-repeat')
  })

  it('壊れた色は無視する（#が付かない値を作らない）', () => {
    expect(masterStyleCanvasBackground({ ...EMPTY, outer_background_color: 'あか' })).toBe('')
  })

  it('土台は全体背景・LP本体はVersion背景（取り違えない）', () => {
    const sheet = { ...EMPTY, outer_background_color: '111111', inner_background_color: 'ffffff' }
    expect(masterStyleCanvasBackground(sheet)).toBe('#111111')
    expect(masterStylePageBackground(sheet)).toBe('#ffffff')
    // 配信・プレビュー側の経路は今までどおり（Version背景は本文の宣言に残る）
    expect(masterStyleEditorDecls(sheet)).toContain('background-color:#ffffff')
    expect(masterStyleEditorDecls(sheet)).not.toContain('#111111')
  })
})
