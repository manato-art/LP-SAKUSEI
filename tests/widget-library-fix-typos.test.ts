import { describe, expect, it } from 'vitest'
import { fixKnownTypos } from '../tools/widget-library-fix/typos.ts'

/**
 * 見本（SB由来）のスクリプトそのものの打ち間違いで、ボタンが動かなかったもの（2026-09-22・全件点検で2件）。
 * 決まった書き間違いだけを直す（ほかの所は触らない）。
 */
describe('見本のスクリプトの打ち間違い', () => {
  it('「ページ上部へ戻る」の addEventListEner（押しても何も起きなかった）。出来事の名前も抜けていた', () => {
    expect(fixKnownTypos("el.addEventListEner('click', function(e) {")).toBe("el.addEventListener('click', function(e) {")
    expect(fixKnownTypos('el.addEventListEner((e) => {')).toBe("el.addEventListener('click', (e) => {")
  })

  it('横スクロールの表の、ありもしない slider（表の画像の読み込み待ちで止まっていた）', () => {
    expect(fixKnownTypos('_.lazyImgLoaded(slider.querySelectorAll("img, video"), _.scrollHint(el));')).toBe(
      '_.lazyImgLoaded(el.querySelectorAll("img, video"), _.scrollHint(el));',
    )
  })

  it('絞り込み検索の表の Array.from(…forEach(…))（絞り込みは動くが、あとでエラーが出ていた）', () => {
    expect(fixKnownTypos('Array.from(document.querySelectorAll(target).forEach(el => _.filterTable(el)));')).toBe(
      'document.querySelectorAll(target).forEach(el => _.filterTable(el));',
    )
  })

  it('「選ぶまで次へを押せない」の is-desabled（選ばなくても次へ進めていた）', () => {
    expect(fixKnownTypos("if (nextBtn.classList.contains('is-desabled') || navigating) return;")).toBe(
      "if (nextBtn.classList.contains('is-disabled') || navigating) return;",
    )
  })

  it('ほかは触らない・何度かけても同じ', () => {
    const ok = "el.addEventListener('click', f); btn.classList.contains('is-disabled')"
    expect(fixKnownTypos(ok)).toBe(ok)
    expect(fixKnownTypos(fixKnownTypos('el.addEventListEner('))).toBe('el.addEventListener(')
  })
})
