/**
 * ポップアップの「追加」に「画像」のタブ（指示38・2026-10-31 本人「ポップアップなんだけど、画像って項目を作成して。
 * これは画像をアップすることによって、その画像をポップアップとして設置できる」→ 本人の選択「全部」＝離脱防止・表示直後・追従型）。
 *
 * 選んだ画像をそのままポップアップの中身にする。押したときのリンクは、今までどおりポップアップのリンクの設定で入れる。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { imagePopupHtml, imagePopupName } from '../src/app/pages/popup-image-tab.ts'

const DATA = `data:image/webp;base64,${'A'.repeat(64)}`

describe('画像をポップアップの中身にする', () => {
  it('離脱防止・表示直後は、画像1枚（箱の幅に収める）', () => {
    const { document } = parseHTML(`<!doctype html><html><body>${imagePopupHtml(DATA, 'box')}</body></html>`)
    const img = document.querySelector('img')
    expect(img?.getAttribute('src')).toBe(DATA)
    expect(img?.getAttribute('style')).toContain('max-width:100%')
    expect(document.body.children).toHaveLength(1)
  })

  it('追従型の帯は、LPの幅（620px）まで広げて真ん中', () => {
    const html = imagePopupHtml(DATA, 'bar')
    expect(html).toContain('width:100%')
    expect(html).toContain('max-width:620px')
    expect(html).toContain('margin:0 auto')
  })

  it('住所の中の引用符は壊さない', () => {
    const { document } = parseHTML(`<!doctype html><html><body>${imagePopupHtml('/uploads/a"b.png', 'box')}</body></html>`)
    expect(document.querySelector('img')?.getAttribute('src')).toBe('/uploads/a"b.png')
  })
})

describe('ポップアップの名前', () => {
  it('ファイルの名前（拡張子は外す）', () => {
    expect(imagePopupName('秋のセール.png')).toBe('秋のセール')
    expect(imagePopupName('banner.final.jpg')).toBe('banner.final')
  })

  it('名前が無ければ「画像ポップアップ」・長すぎる名前は100文字まで', () => {
    expect(imagePopupName('.png')).toBe('画像ポップアップ')
    expect(imagePopupName('')).toBe('画像ポップアップ')
    expect(imagePopupName(`${'あ'.repeat(150)}.png`)).toHaveLength(100)
  })
})
