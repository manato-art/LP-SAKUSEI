/**
 * Widget編集の「背景の画像」（2026-10-24 本人「ボタンの背景だったり枠の背景だったり、そういったものを全部添付してその画像に
 * できるようにしたい。そしてその画像も位置だったり大きさは自由に決めれる」）。
 *
 * 本人の選択: 対象＝色を持つ部品すべて＋Widget全体の背景・画面ごとの背景（＋見本の中の箱）／文字は上に残す／
 * 位置と大きさは見たまま画面でつかんで動かす（右の欄の数字でも直せる）。
 *
 * 画像は部品の「背景」に敷く（要素も並びも増やさない＝見た目の箱の形・角の丸みで切り取られ、文字はその上に出る）。
 * 合わせ方は「枠いっぱいに覆う」と「大きさを自分で決める（横幅に対して%）」。位置は 0＝左端（上端）・50＝真ん中・100＝右端（下端）。
 */
import { describe, expect, it } from 'vitest'
import { bgCss, bgTargetOf } from '../src/app/panels/nocode/templates/bg-image.ts'
import { ALL_BLOCK_TYPES, BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const IMG = `data:image/png;base64,${'A'.repeat(40)}`
const UID = 'nc-bgimg001'

const renderOne = (block: ItemData, extra: ItemData = {}): string =>
  BUILDER_TEMPLATE.render({ ...BUILDER_TEMPLATE.defaults(new Date(0)), ...extra, screens: [{ id: 's1', name: '画面①', blocks: [block] }] }, UID)

describe('どの部品に背景の画像を敷けるか', () => {
  it('ボタンは押す所（色の付いた面）、図形・囲み枠は部品そのもの', () => {
    expect(bgTargetOf('button')).toBe(' .nc-b-button__a')
    expect(bgTargetOf('tel')).toBe(' .nc-b-tel__a')
    expect(bgTargetOf('badge')).toBe(' .nc-b-badge__in')
    expect(bgTargetOf('band')).toBe(' .nc-b-band__text')
    expect(bgTargetOf('coupon')).toBe(' .nc-b-coupon__ticket')
    expect(bgTargetOf('speech')).toBe(' .nc-b-speech__bubble')
    expect(bgTargetOf('shape')).toBe('')
    expect(bgTargetOf('box')).toBe('')
    expect(bgTargetOf('heading')).toBe('')
  })

  it('画像・動画そのものの部品と、余白・線・矢印・進み具合などの飾りには出さない', () => {
    for (const type of ['image', 'video', 'gallery', 'beforeAfter', 'cover', 'spacer', 'divider', 'hotspot', 'ornament', 'cue', 'progress', 'loading', 'sample']) {
      expect(bgTargetOf(type), type).toBeNull()
    }
    expect(bgTargetOf('tpl-countdown')).toBeNull()
  })

  it('敷ける部品には右の設定に「背景の画像」の段がある（合わせ方・位置・大きさは画像を選んでから出る）', () => {
    const button = ALL_BLOCK_TYPES.find((t) => t.type === 'button')
    const bg = button?.fields.filter((f) => f.section === 'background') ?? []
    expect(bg.map((f) => f.key)).toEqual(['bgImage', 'bgFit', 'bgSize', 'bgX', 'bgY'])
    const fit = bg.find((f) => f.key === 'bgFit')
    const size = bg.find((f) => f.key === 'bgSize')
    expect(fit?.showIfItem?.({})).toBe(false)
    expect(fit?.showIfItem?.({ bgImage: IMG })).toBe(true)
    // 大きさは「大きさを自分で決める」のときだけ
    expect(size?.showIfItem?.({ bgImage: IMG })).toBe(false)
    expect(size?.showIfItem?.({ bgImage: IMG, bgFit: 'free' })).toBe(true)
    expect(ALL_BLOCK_TYPES.find((t) => t.type === 'spacer')?.fields.some((f) => f.section === 'background')).toBe(false)
  })
})

describe('書き出し', () => {
  it('枠いっぱいに覆う（はじめ）: 画像を背景に敷く（色はその下・文字は上）', () => {
    expect(bgCss('.x', { bgImage: IMG })).toBe(
      `.x{background-image:url("${IMG}")!important;background-repeat:no-repeat!important;background-origin:border-box!important;` +
        'background-size:cover!important;background-position:50% 50%!important}',
    )
  })

  it('大きさを自分で決める: 横幅に対して%・位置は 0〜100（はみ出す所も置ける）', () => {
    const css = bgCss('.x', { bgImage: IMG, bgFit: 'free', bgSize: 60, bgX: 10, bgY: -20 })
    expect(css).toContain('background-size:60% auto!important')
    expect(css).toContain('background-position:10% -20%!important')
  })

  it('画像が無い・決まった形でない画像（よそのURL・スクリプト）は何も書かない', () => {
    expect(bgCss('.x', {})).toBe('')
    expect(bgCss('.x', { bgImage: 'https://example.com/a.png' })).toBe('')
    expect(bgCss('.x', { bgImage: 'javascript:alert(1)' })).toBe('')
    expect(bgCss('.x', { bgImage: 'data:image/png;base64,AAA")} body{x:url(' })).toBe('')
  })

  it('保存で別ファイルになった画像（/uploads/…）も使える', () => {
    expect(bgCss('.x', { bgImage: `/uploads/${'a'.repeat(64)}.webp` })).toContain(`url("/uploads/${'a'.repeat(64)}.webp")`)
  })

  it('部品: その部品の面にだけ効く（ボタンなら押す所）', () => {
    const html = renderOne({ type: 'button', label: '申し込む', look: 'cta', color: '#E5573F', action: 'none', target: '', url: '', bgImage: IMG })
    expect(html).toContain(`.${UID} .nc-b-1 .nc-b-button__a{background-image:url("${IMG}")`)
  })

  it('吹き出しの形の図形は、しっぽに画像を写さない', () => {
    const html = renderOne({ type: 'shape', shape: 'bubble', text: 'あ', color: '#1F7AE0', bgImage: IMG })
    expect(html).toContain(`.${UID} .nc-b-1::after{background-image:none!important}`)
  })

  it('Widget全体の背景・画面ごとの背景', () => {
    const data: TemplateData = {
      ...BUILDER_TEMPLATE.defaults(new Date(0)),
      bgImage: IMG,
      bgFit: 'free',
      bgSize: 80,
      screens: [
        { id: 's1', name: '画面①', blocks: [], bgImage: IMG, bgX: 0, bgY: 100 },
        { id: 's2', name: '画面②', blocks: [] },
      ],
    }
    const html = BUILDER_TEMPLATE.render(data, UID)
    expect(html).toContain(`.${UID}{background-image:url("${IMG}")!important`)
    expect(html).toContain('background-size:80% auto!important')
    expect(html).toContain(`.${UID} [data-nc-screen="s1"]{background-image:url("${IMG}")!important`)
    expect(html).toContain('background-position:0% 100%!important')
    expect(html).not.toContain('[data-nc-screen="s2"]{background-image')
  })

  it('Widget全体の設定に「背景の画像」がある（合わせ方などは画像を選んでから）', () => {
    const keys = BUILDER_TEMPLATE.fields.map((f) => f.key)
    expect(keys).toEqual(expect.arrayContaining(['bgImage', 'bgFit', 'bgSize', 'bgX', 'bgY']))
    const fit = BUILDER_TEMPLATE.fields.find((f) => f.key === 'bgFit')
    expect(fit?.showIf?.({})).toBe(false)
    expect(fit?.showIf?.({ bgImage: IMG })).toBe(true)
  })
})

describe('右の欄の見た目', () => {
  it('「画面でつかんで動かす」は、隠したとき（画像が無いとき）本当に消える（CSSで display を上書きしない）', async () => {
    const { readFileSync } = await import('node:fs')
    const css = readFileSync('src/app/panels/nocode/nocode-form-css.ts', 'utf8')
    expect(css).not.toMatch(/\.ncf-bg-move\{[^}]*display:/)
  })
})
