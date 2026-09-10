/**
 * Widget に紛れ込んだ SquadBeyond のプレビュー用CSSを、公開LPで悪さをしない形にすることの機械証明。
 *
 * 実測（2026-09-10）: ライブラリの Widget を入れると公開LPが「背景グレー・左寄せ・高さが画面に固定」になっていた。
 * ただし Widget の見た目の一部はこのCSSに頼っているので、丸ごと消すのではなく
 *   - 3つのCSSを Widget から取り除く
 *   - 見た目に要る指定だけを Widget の中にだけ効く形で1回置く
 * とする。ここではその両方を、採取したライブラリ25件の実データで確かめる。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  WIDGET_RESET_CSS,
  neutralizeWidgetStyles,
  stripSbPreviewCss,
  widgetResetCss,
} from '../src/shared/sb-preview-css.ts'

function unescapeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

const LIBRARY = [
  ...readFileSync('src/app/fragments/ab_tests__UID__articles__widget-library.portals.html', 'utf8').matchAll(
    /aria-label="([^"]*)">[^<]*<\/p>[\s\S]*?<iframe[^>]*srcdoc="([^"]*)"/g,
  ),
].map((m) => {
  const doc = unescapeHtml(m[2] ?? '')
  const head = /<head[^>]*>([\s\S]*?)<\/head>/.exec(doc)?.[1] ?? ''
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(doc)?.[1] ?? ''
  const styles = (html: string): string[] => [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((s) => s[1] ?? '')
  return { title: m[1] ?? '', headStyles: styles(head), bodyStyles: styles(body) }
})
const [PREVIEW_DEFAULTS, PAGE_BASE, EDITOR_BASE] = (LIBRARY[0]?.headStyles ?? []).map((s) => s.trim())

describe('SquadBeyond のプレビュー用CSSを取り除く', () => {
  it('ライブラリ25件の <head> のCSS（3つ）は、どれも取り除くと空になる', () => {
    expect(LIBRARY).toHaveLength(25)
    for (const w of LIBRARY) {
      expect(w.headStyles.map((s) => stripSbPreviewCss(s).trim()), w.title).toEqual(['', '', ''])
    }
  })

  it('Widget 自身のCSS（<body> の方）には1文字も触らない', () => {
    for (const w of LIBRARY) {
      for (const own of w.bodyStyles) expect(stripSbPreviewCss(own), w.title).toBe(own)
    }
  })

  it('1つの <style> に混ざっていても（本人の矢印Widgetの形）、Widget 自身の指定は残る', () => {
    const own = '.downArrow{\n  --arrow-color: #ff0000;  /* 色 */\n}'
    const mixed = `${PREVIEW_DEFAULTS}\n${PAGE_BASE}\n\n${EDITOR_BASE}\n\n${own}`
    const stripped = stripSbPreviewCss(mixed)
    expect(stripped.trim()).toBe(own)
    expect(stripSbPreviewCss(stripped)).toBe(stripped)
  })

  it('記事設定の値が違う #articlePartPreview も取り除く', () => {
    const css = '#articlePartPreview {\n font-size: 15px !important;\n color: #333333 !important;\n}\n#articlePartPreview img {\n display: block !important;\n}\n.a{color:red}'
    expect(stripSbPreviewCss(css).trim()).toBe('.a{color:red}')
  })

  it('途中までしか無い（終わりの目印が無い）ものには触らない', () => {
    const partial = 'html{height:100vh}body{margin:0 auto;height:100vh;background-color:#ececec}.a{color:red}'
    expect(stripSbPreviewCss(partial)).toBe(partial)
  })
})

describe('Widget の中にだけ効く土台（WIDGET_RESET_CSS）', () => {
  it('2つ目のCSSから、ページ全体の指定だけを除いたもの（並び・値は元のまま、Widget の中に限定）', () => {
    const rules = [...PAGE_BASE!.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
      (m) => [(m[1] ?? '').trim(), (m[2] ?? '').trim()] as const,
    )
    // 0 html{height} / 1 body{…} / 2 ::-webkit-scrollbar / 3 body *{scrollbar} / 6 html{font-family…} はページ全体の指定
    const expected = rules.flatMap(([selectors, declarations], i) => {
      if ([0, 1, 2, 3, 6].includes(i)) return []
      if (i === 7) return [['', 'word-wrap:break-word'] as const]
      return [[selectors.replace(/^body\s+/, '').replace(/(^|,)html\s+/g, '$1'), declarations] as const]
    })
    const scope = ':where(.sb-widget-block)'
    const css = expected
      .map(([selectors, declarations]) =>
        selectors === ''
          ? `${scope}{${declarations}}`
          : `${selectors.split(',').map((s) => `${scope} ${s.trim()}`).join(',')}{${declarations}}`,
      )
      .join('')
    expect(WIDGET_RESET_CSS).toBe(css)
  })

  it('編集画面の写しにも同じ土台を、その場所の範囲に限って置ける（widgetResetCss）', () => {
    expect(widgetResetCss(':where(.sb-widget-block)')).toBe(WIDGET_RESET_CSS)
    expect(widgetResetCss('.ql-editor .sb-widget-block')).toBe(
      WIDGET_RESET_CSS.replaceAll(':where(.sb-widget-block)', '.ql-editor .sb-widget-block'),
    )
  })

  it('ページ全体に効く指定は入っていない（背景・高さ・スクロールバー・html/body）', () => {
    expect(WIDGET_RESET_CSS).not.toMatch(/100vh|#ececec|scrollbar/)
    for (const rule of WIDGET_RESET_CSS.split('}').filter((r) => r !== '')) {
      const selectors = rule.split('{')[0] ?? ''
      for (const s of selectors.split(',')) expect(s.startsWith(':where(.sb-widget-block)'), s).toBe(true)
    }
  })
})

describe('配信する LP の HTML を整える', () => {
  it('Widget の <style> からプレビュー用CSSを除き、Widget 自身の指定と本文は残す', () => {
    const html =
      `<section class="sb-widget-block"><style>${PREVIEW_DEFAULTS}${PAGE_BASE}${EDITOR_BASE}</style>` +
      `<style>.a{color:red}</style><div class="a">x</div></section><p>本文</p>`
    const out = neutralizeWidgetStyles(html)
    expect(out.hasWidget).toBe(true)
    expect(out.html).not.toContain('#ececec')
    expect(out.html).not.toContain('CodeMirror')
    expect(out.html).toContain('<style>.a{color:red}</style><div class="a">x</div></section><p>本文</p>')
  })

  it('Widget の無い LP はそのまま（土台も要らない）', () => {
    const html = '<p>本文</p><style>.x{color:blue}</style>'
    expect(neutralizeWidgetStyles(html)).toEqual({ html, hasWidget: false })
  })
})
