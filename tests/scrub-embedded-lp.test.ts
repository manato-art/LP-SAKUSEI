import { describe, it, expect } from 'vitest'
import { scrubText } from '../tools/scrub/scrub.ts'
import type { ScrubMap } from '../tools/scrub/dictionary.ts'

const map: ScrubMap = {}
const hosts = { productionHostPattern: /example-real\.test/gi }

/**
 * ヒートマップ画面は、計測しているLPそのものを `<iframe srcdoc="...">` に丸ごと抱えている。
 * 中身は顧客が作った広告原稿・画像・キャッチコピーで、アプリのUIではない。
 * 土台に必要なのは「iframeがそこにある」という構造だけなので、中身は置き換える。
 */
describe('埋め込まれたLP本文（iframe srcdoc）', () => {
  it('中身を差し替える', () => {
    const input =
      '<iframe src="https://cdn.example.test/a.html" srcdoc="&lt;p&gt;今だけ半額！&lt;/p&gt;" title="preview"></iframe>'
    const out = scrubText(input, map, hosts).text
    expect(out).not.toContain('今だけ半額')
    expect(out).toContain('srcdoc="')
  })

  it('iframe の他の属性は残す（構造を壊さない）', () => {
    const input = '<iframe src="/x.html" srcdoc="&lt;p&gt;本文&lt;/p&gt;" title="preview"></iframe>'
    const out = scrubText(input, map, hosts).text
    expect(out).toContain('src="/x.html"')
    expect(out).toContain('title="preview"')
  })

  it('srcdoc が無いときは何も変えない', () => {
    const input = '<iframe src="/x.html" title="preview"></iframe>'
    expect(scrubText(input, map, hosts).text).toBe(input)
  })
})
