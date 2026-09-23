/**
 * 部品の文字に、ツールバーで付けた飾り（太字・色）を持たせる（2026-09-24・Widget編集 第3弾）。
 * 飾り以外（script・a・img・onclick…）は残さない（KB xss-onclick-esc）。
 */
import { describe, expect, it } from 'vitest'
import { isRichEmpty, plainTextOfRich, plainToRich, richText, sanitizeRichHtml } from '../src/app/panels/nocode/rich-text.ts'

describe('飾りだけを残す', () => {
  it('太字・色・大きさの飾りは残る', () => {
    expect(sanitizeRichHtml('A<b>B</b><span style="color:#e5573f;font-size:20px">C</span>')).toBe(
      'A<b>B</b><span style="color:#e5573f;font-size:20px">C</span>',
    )
    expect(sanitizeRichHtml('<font color="#ff0000" face="Noto Sans JP">x</font>')).toBe('<font color="#ff0000" face="Noto Sans JP">x</font>')
    expect(sanitizeRichHtml('a<br>b<br/>c<BR>')).toBe('a<br>b<br>c<br>')
  })

  it('危ないもの・飾り以外は外す（文字は残す）', () => {
    expect(sanitizeRichHtml('<b onclick="x()">A</b>')).toBe('<b>A</b>')
    expect(sanitizeRichHtml('<span class="x" style="color:red;position:fixed;background:url(x)">A</span>')).toBe('<span style="color:red">A</span>')
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">link</a>')).toBe('link')
    expect(sanitizeRichHtml('<img src=x onerror=alert(1)>after')).toBe('after')
    expect(sanitizeRichHtml('x<script>alert(1)</script>y<style>.a{}</style>z')).toBe('xyz')
    expect(sanitizeRichHtml('<div>a</div><p>b</p>')).toBe('ab')
    expect(sanitizeRichHtml('<!-- c -->a')).toBe('a')
    expect(sanitizeRichHtml('<span style="color:expression(1)">a</span>')).toBe('<span>a</span>')
  })

  it('以前の素の文字（& や < を含む）もそのまま読める', () => {
    expect(sanitizeRichHtml('A & B < C')).toBe('A &amp; B &lt; C')
    expect(sanitizeRichHtml('A &amp; B &#39;')).toBe('A &amp; B &#39;')
    expect(richText('1行目\n2行目')).toBe('1行目<br>2行目')
    expect(richText('  <b>x</b>  ')).toBe('<b>x</b>')
  })
})

describe('素の文字との行き来', () => {
  it('飾りを外した文字（右の入力欄に出す）', () => {
    expect(plainTextOfRich('A<b>B</b><br>C &amp; D &#39;e&#39;')).toBe('AB\nC & D \'e\'')
    expect(isRichEmpty('<br> <b></b>')).toBe(true)
    expect(isRichEmpty('<b>x</b>')).toBe(false)
  })

  it('入力欄で打った文字は、タグとして読まれない', () => {
    expect(plainToRich('<b>そのまま</b> & <')).toBe('&lt;b&gt;そのまま&lt;/b&gt; &amp; &lt;')
    expect(richText(plainToRich('<b>x</b>'))).toBe('&lt;b&gt;x&lt;/b&gt;')
  })
})
