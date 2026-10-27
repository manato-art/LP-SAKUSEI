/**
 * LP内背景に画像を入れると、編集画面の本文のまわりに白い線（枠）が出る（2026-10-27 指示⑯ 本人
 * 「背景をつけると、赤枠で囲んだ部分のように白い線が表示されるようになってしまった」「下にもある」）。
 * 線は編集画面だけの「本文の箱」の枠線（#e5e5ea）と影。画像は本文の幅で画面いっぱいに敷くので、
 * 箱の上下の線が画像の上に浮いて見えていた → 画像・動画を敷いている間は、箱の枠線と影を消す。
 */
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import type { MasterStyleSheet } from '../src/app/master-style.ts'

const EMPTY: MasterStyleSheet = {
  font_size: null, font_family: '', color: '', text_align: '', line_height: null, letter_spacing: null,
  img_margin_top: null, img_margin_bottom: null, padding_top: null, padding_bottom: null, padding_right: null, padding_left: null,
  iframe_height: null, iframe_height_unit: '', delivery_version_width: null, delivery_version_width_unit: '',
  border_size: null, border_type: '', border_color: '', outer_background_color: '', outer_background_image: '',
  inner_background_color: '', inner_background_image: '',
}
const PNG = `/uploads/${'b'.repeat(64)}.webp`

async function setup() {
  const { window } = parseHTML(
    '<!doctype html><html><body><div class="quillEditorContentWrapper"><div class="ql-container"><div class="ql-editor"></div></div></div></body></html>',
  )
  const g = globalThis as unknown as Record<string, unknown>
  g['document'] = window.document
  g['HTMLVideoElement'] = (window as unknown as Record<string, unknown>)['HTMLVideoElement']
  g['ResizeObserver'] = class {
    observe(): void {}
    disconnect(): void {}
  }
  const proto = (window as unknown as { HTMLElement: { prototype: Record<string, unknown> } }).HTMLElement.prototype
  proto['getBoundingClientRect'] = () => ({ left: 0, top: 0, width: 400, height: 400 })
  const quillRoot = window.document.querySelector('.ql-editor') as unknown as HTMLElement
  const base = window.document.querySelector('.quillEditorContentWrapper') as unknown as HTMLElement
  const { applyEditorBgLayers } = await import('../src/app/pages/editor-bg-layers.ts')
  return { quillRoot, base, applyEditorBgLayers }
}

describe('LP内背景の画像と、本文の箱の枠線', () => {
  it('LP内背景に画像があるあいだは、本文の箱の枠線と影を消す。外したら元に戻す', async () => {
    const { quillRoot, base, applyEditorBgLayers } = await setup()
    applyEditorBgLayers(quillRoot, { ...EMPTY, inner_background_image: PNG })
    expect(base.style.getPropertyValue('--lp-page-frame')).toBe('transparent')
    expect(base.style.getPropertyValue('--lp-page-shadow')).toBe('none')
    applyEditorBgLayers(quillRoot, EMPTY)
    expect(base.style.getPropertyValue('--lp-page-frame')).toBe('')
    expect(base.style.getPropertyValue('--lp-page-shadow')).toBe('')
  })

  it('外枠背景の画像だけのときは、本文の箱の枠線はそのまま（白い本文の箱の縁）', async () => {
    const { quillRoot, base, applyEditorBgLayers } = await setup()
    applyEditorBgLayers(quillRoot, { ...EMPTY, outer_background_image: PNG })
    expect(base.style.getPropertyValue('--lp-page-frame')).toBe('')
  })

  it('本文の箱の枠線と影は、その2つの変数で消せる形になっている（編集画面のCSS 2か所）', () => {
    for (const file of ['src/app/pages/editor-styles.ts', 'src/app/styles/mockup-master.ts']) {
      const css = readFileSync(file, 'utf8')
      const at = css.indexOf('.quillEditorContentWrapper .ql-editor {')
      const rule = css.slice(at, css.indexOf('}', at))
      expect(rule, file).toMatch(/border: 1px solid var\(--lp-page-frame,/)
      expect(rule, file).toMatch(/box-shadow: var\(--lp-page-shadow,/)
    }
  })
})
