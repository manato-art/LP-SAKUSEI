/**
 * 新しい見本（自作・2026-09-23）の作りの決まり。
 *
 * 本人の依頼「SB由来の見本は使い勝手が悪いので、0から作り直す」。まず3本作り、ここに足していく。
 * 見本が満たすべきことを機械で固定して、次の1本も同じ品質で足せるようにする:
 *  - LPに入れるたびに名前（uid）を付け直せる形（rekeyUid）
 *  - CSSはそのWidgetの名前の中だけ（ほかのWidgetやLP本文に漏れない）
 *  - 外から読み込むもの（画像・フォント・スクリプト）はゼロ。危ないもの（javascript: / on属性）も無い
 *  - 画面①②…を持つ見本は、最初の画面だけ見えていて、移る先が全部ある
 *  - 「画面を作って使う」で設問ごとの部品に分けられる
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { NEW_SAMPLES } from '../src/app/panels/nocode/samples/index.ts'
import { goTargetsIn } from '../src/app/panels/nocode/sample-model.ts'
import { splitSampleScreens } from '../src/app/panels/nocode/sample-to-screens.ts'
import { placeholderLinkCount } from '../src/app/panels/link-placeholder.ts'
import { rekeyUid } from '../src/app/panels/nocode/templates/kit.ts'

/** linkedom で見本を入れた箱を作る（ブラウザの DOMParser と同じ役目） */
function parse(html: string): Element {
  const { document } = parseHTML(`<!doctype html><html><body><div id="r">${html}</div></body></html>`)
  const root = document.getElementById('r')
  if (root === null) throw new Error('parse failed')
  return root as unknown as Element
}

/** `<style>` の中の、1つ1つの決まり（セレクター単位）。@media・@keyframes の外枠は外す */
function selectorsOf(css: string): string[] {
  const body = css.replace(/@(?:media|supports)[^{]*\{/g, '').replace(/@keyframes[^{]*\{[\s\S]*?\}\s*\}/g, '')
  return body
    .split('}')
    .map((chunk) => chunk.split('{')[0]?.trim() ?? '')
    .filter((selector) => selector !== '' && !selector.startsWith('@'))
}

describe('新しい見本（自作）', () => {
  it('名前・一言・種類の名前がそろっていて、種類の名前は重ならない', () => {
    expect(NEW_SAMPLES.length).toBeGreaterThanOrEqual(3)
    const ids = NEW_SAMPLES.map((sample) => sample.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const sample of NEW_SAMPLES) {
      expect(sample.id).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(sample.name.trim()).not.toBe('')
      expect(sample.summary.trim()).not.toBe('')
    }
  })

  it('LPに入れるたびに名前（uid）を付け直せる形（CSSも一緒に付け替わる）', () => {
    for (const sample of NEW_SAMPLES) {
      expect(sample.html).toMatch(/<div class="nc nc-sample nc-[a-z0-9]{8}" data-nocode="sample"/)
      const next = rekeyUid(sample.html, 'nc-zzzzzzzz')
      expect(next).toContain('<div class="nc nc-sample nc-zzzzzzzz" data-nocode="sample"')
      // 元の名前が1つも残らない（CSSの中も含めて付け替わっている）
      const uid = /<div class="nc nc-sample (nc-[a-z0-9]{8})"/.exec(sample.html)?.[1] ?? ''
      expect(next.includes(uid)).toBe(false)
      expect(next.split('.nc-zzzzzzzz').length).toBeGreaterThan(5)
    }
  })

  it('CSSはそのWidgetの名前の中だけ（ほかのWidget・LP本文に漏れない）', () => {
    for (const sample of NEW_SAMPLES) {
      const uid = /<div class="nc nc-sample (nc-[a-z0-9]{8})"/.exec(sample.html)?.[1] ?? ''
      const css = [...sample.html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? '').join('')
      expect(css).not.toBe('')
      for (const selector of selectorsOf(css)) {
        expect(selector.split(',').every((one) => one.trim().startsWith(`.${uid}`))).toBe(true)
      }
    }
  })

  it('外から読み込むものが無く、危ないものも入っていない', () => {
    for (const sample of NEW_SAMPLES) {
      // SVGの名前空間（http://www.w3.org/2000/svg）は読み込み先ではないので数えない
      expect(sample.html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')).not.toMatch(/https?:\/\//)
      expect(sample.html).not.toMatch(/\son[a-z]+=/i)
      expect(sample.html).not.toMatch(/javascript:/i)
      expect(sample.html).not.toMatch(/@import|url\((?!['"]?data:)/i)
      // 絵文字は使わない（印は固定のSVG。本人の決まり）
      expect(sample.html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    }
  })

  // 2026-09-25 本人「他のウィジェットも確認して」: 27本のボタン・申し込みボタンが `font:800 17px/1.5 inherit` と書かれていた。
  // 字体の名前の所に inherit は書けない（ブラウザがこの宣言まるごとを捨てる）ので、太さ・大きさが効かず、
  // ボタンは既定の細い13px、リンクのボタンは周りの字のままだった（ライブラリ・LP・Widget編集のどこでも）
  it('文字の見た目をまとめて書く font: に inherit を混ぜない（宣言ごと捨てられて太さ・大きさが効かない）', () => {
    for (const sample of NEW_SAMPLES) {
      // `font:inherit` だけ（全部を親から受け継ぐ）は正しい書き方なので対象外
      expect(sample.html, sample.id).not.toMatch(/font:\s*[^;}]*\S\s+inherit\b/)
    }
  })

  it('画面①②…を持つ見本は、最初の画面だけ見えていて、移る先が全部ある', () => {
    for (const sample of NEW_SAMPLES) {
      const root = parse(sample.html)
      const holder = root.querySelector('[data-nc-screens]')
      if (holder === null) {
        expect(sample.html).not.toContain('data-nc-go')
        continue
      }
      const screens = Array.from(holder.children).filter((child) => child.getAttribute('data-nc-screen') !== null)
      expect(screens.length).toBeGreaterThanOrEqual(2)
      expect(screens.filter((s) => !s.hasAttribute('hidden'))).toHaveLength(1)
      expect(screens[0]?.hasAttribute('hidden')).toBe(false)
      const ids = new Set(screens.map((s) => s.getAttribute('data-nc-screen')))
      for (const target of goTargetsIn(sample.html.replace(/ data-nc-screens=""/, ''))) expect(ids.has(target)).toBe(true)
      // 切り替えのスクリプトが入っている（LPに入れただけで動く）
      expect(sample.html).toContain('data-nc-screens')
      expect(sample.html).toMatch(/<script>[\s\S]*data-nc-screen[\s\S]*<\/script>/)
    }
  })

  it('「選んで進むアンケート」は設問ごとの部品に分けられる（画面と部品で使える）', () => {
    const survey = NEW_SAMPLES.find((sample) => sample.id === 'survey-choices')
    expect(survey).toBeDefined()
    const parts = splitSampleScreens(survey?.html ?? '', parse)
    expect(parts).toHaveLength(4)
    expect(parts[0]).toContain('いま、いちばん気になっていることは？')
    expect(parts[0]).toContain('data-nc-go="@1"')
    expect(parts[3]).toContain('ご回答ありがとうございました')
    for (const part of parts) expect(part).not.toContain('data-nc-screens')
  })

  it('リンク先を入れてもらうボタンは「仮のリンク」として数えられる', () => {
    const cta = NEW_SAMPLES.find((sample) => sample.id === 'cta-apply')
    expect(placeholderLinkCount(cta?.html ?? '')).toBe(1)
    const survey = NEW_SAMPLES.find((sample) => sample.id === 'survey-choices')
    // アンケートは最後のお礼の画面のボタンだけ（選択肢は画面へ移るので数えない）
    expect(placeholderLinkCount(survey?.html ?? '')).toBe(1)
  })
})
