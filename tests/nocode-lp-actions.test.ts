/**
 * 「押したとき」のLP上のアクション（2026-09-24・本人「LP上アクションをできるように。例えば画像を表示したりクーポンみたいな」）。
 * 選んでもらったこと: 画像を大きく表示・クーポンを表示・小窓で見せる（中身は画面で作る）・LPの中の場所へ移動＋ほかにも色々
 * （文字をコピー・動画を大きく再生・電話をかける・閉じる）。押せる部品すべて（ボタン・画像・図形・動画・画像と文章・移行先）で使える。
 */
import { describe, expect, it } from 'vitest'
import { ACTIONS_SCRIPT } from '../src/app/panels/nocode/templates/press-actions.ts'
import { BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import { incomingCount, pressOf, withPress } from '../src/app/panels/nocode/screens-state.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const NOW = new Date(Date.UTC(2026, 8, 24, 3, 0))
const UID = 'nc-test0005'
const PNG = 'data:image/png;base64,iVBORw0KGgo='
const MP4 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29t'
const XSS = '"><img src=x onerror=alert(1)>'

const button = (extra: ItemData): ItemData => ({ type: 'button', label: '見る', look: 'cta', color: '#E5573F', target: '', url: '', track: true, ...extra })
const data = (first: readonly ItemData[], second: readonly ItemData[] = []): TemplateData =>
  ({
    ...BUILDER_TEMPLATE.defaults(NOW),
    screens: [
      { id: 's1', name: '画面①', blocks: first },
      ...(second.length === 0 ? [] : [{ id: 's2', name: 'くわしく', blocks: second }]),
    ],
  }) as TemplateData
const render = (first: readonly ItemData[], second: readonly ItemData[] = []): string => BUILDER_TEMPLATE.render(data(first, second), UID)
const validate = (first: readonly ItemData[], second: readonly ItemData[] = []): string | null =>
  BUILDER_TEMPLATE.validate(data(first, second), NOW)
const HEADING: ItemData = { type: 'heading', text: '中身', size: 21, align: 'center', color: '#1F2A37' }

describe('画像を大きく表示・動画を大きく再生・クーポンを表示（押すと小窓）', () => {
  it('画像: ボタンに小窓の目印、Widgetの中に隠れた小窓（画像入り）。1画面でもスクリプトが入る', () => {
    const html = render([button({ action: 'image', actImage: PNG })])
    expect(html).toContain(`<a class="nc-b-button__a nc-b-button__a--cta" href="#" data-nc-pop="${UID}-p1">`)
    expect(html).toMatch(new RegExp(`<div class="nc-pop" id="${UID}-p1" role="dialog" aria-modal="true" aria-label="画像" hidden>`))
    expect(html).toContain(`<img class="nc-pop__img" src="${PNG}" alt="">`)
    expect(html).toContain('data-nc-close')
    expect(html).toContain(ACTIONS_SCRIPT)
    expect(html).toMatch(/\.nc-pop\{position:fixed;inset:0/)
  })

  it('動画: 小窓の中で再生（操作ボタン付き）', () => {
    const html = render([{ type: 'image', image: PNG, alt: '', width: 100, action: 'video', actVideo: MP4 }])
    expect(html).toMatch(/<figure class="nc-b nc-b-image nc-b-1" data-nc-pop="nc-test0005-p1" role="button" tabindex="0">/)
    expect(html).toContain(`<video class="nc-pop__video" src="${MP4}" controls playsinline preload="none"></video>`)
  })

  it('クーポン: 割引・コード・コピーのボタン。入力の文字は文字として出す', () => {
    const html = render([button({ action: 'coupon', actTitle: '初回限定', actAmount: '500円OFF', actCode: `A${XSS}`, actNote: '10月末まで' })])
    expect(html).toContain('<p class="nc-pop-coupon__amount">500円OFF</p>')
    expect(html).toContain('class="nc-pop-coupon__copy" data-nc-copy="A&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"')
    expect(html).not.toContain('<img src=x')
  })

  it('選んでいない・空のときは、保存の前に知らせる', () => {
    expect(validate([button({ action: 'image', actImage: '' })])).toContain('画像')
    expect(validate([button({ action: 'video', actVideo: '' })])).toContain('動画')
    expect(validate([button({ action: 'coupon', actAmount: ' ' })])).toContain('クーポン')
  })
})

describe('小窓で見せる（中身は画面で作る）', () => {
  it('押すと、選んだ画面を小窓に出す（画面②の中身はそのまま部品で作る）', () => {
    const html = render([button({ action: 'modal', target: 's2' })], [HEADING])
    expect(html).toContain('href="#" data-nc-modal="s2"')
    expect(html).toContain('data-nc-modal-layer')
    expect(validate([button({ action: 'modal', target: 's9' })], [HEADING])).toContain('小窓')
  })

  it('小窓に出す画面も、どこかから開ける画面として数える', () => {
    const d = data([button({ action: 'modal', target: 's2' })], [HEADING])
    expect(incomingCount(d, 's2')).toBe(1)
  })
})

describe('LPの中の場所へ移動・文字をコピー・電話をかける・閉じる', () => {
  it('場所へ移動: いちばん上・このWidgetのすぐ下・LPの目印（id）', () => {
    expect(render([button({ action: 'scroll', actScroll: 'top' })])).toContain('data-nc-scroll="top"')
    expect(render([button({ action: 'scroll', actScroll: 'below' })])).toContain('data-nc-scroll="below"')
    expect(render([button({ action: 'scroll', actScroll: 'id', actAnchor: 'form' })])).toContain('data-nc-scroll="#form"')
    expect(validate([button({ action: 'scroll', actScroll: 'id', actAnchor: 'a b"<' })])).toContain('目印')
  })

  it('文字をコピー: 入力の文字は属性の中で逃がす', () => {
    const html = render([button({ action: 'copy', actCopy: `CODE${XSS}` })])
    expect(html).toContain('data-nc-copy="CODE&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"')
    expect(validate([button({ action: 'copy', actCopy: '' })])).toContain('コピー')
  })

  it('電話をかける: 番号の数字だけを tel: のリンクにする', () => {
    const html = render([button({ action: 'tel', actTel: '0120-123-456' })])
    expect(html).toMatch(/<a class="nc-b-button__a nc-b-button__a--cta" href="tel:0120123456"/)
    expect(validate([button({ action: 'tel', actTel: 'なし' })])).toContain('電話番号')
  })

  it('閉じる: 押すと、入っているポップアップ・小窓を閉じる', () => {
    expect(render([button({ action: 'close' })])).toContain('href="#" data-nc-close="true"')
  })
})

describe('移行先でも使える', () => {
  const two = (hotspot: ItemData): readonly ItemData[] => [{ type: 'image', image: PNG, alt: '', width: 100, action: 'none' }, hotspot]

  it('画像の上の移行先で、クーポンを見せる（読み上げは「クーポンを見る」）', () => {
    const html = render(two({ type: 'hotspot', x: 0, y: 0, w: 50, h: 50, action: 'coupon', actAmount: '10%OFF' }))
    expect(html).toMatch(/<span class="nc-b nc-b-hotspot nc-b-2" data-nc-pop="nc-test0005-p2" role="button" tabindex="0" aria-label="クーポンを見る"><\/span>/)
    expect(validate(two({ type: 'hotspot', action: 'coupon', actAmount: '10%OFF' }))).toBeNull()
  })

  it('電話をかける移行先は <a href="tel:">', () => {
    const html = render(two({ type: 'hotspot', action: 'tel', actTel: '03-1234-5678' }))
    expect(html).toMatch(/<a class="nc-b nc-b-hotspot nc-b-2" href="tel:0312345678"/)
  })
})

describe('押したときの選び（右の欄）', () => {
  it('LP上のアクションを選べる。小窓は画面を選ぶまで移る先を持たない', () => {
    const path = ['screens', 0, 'blocks', 0]
    const d = data([button({ action: 'none' })], [HEADING])
    const image = withPress(d, path, 'image')
    const first = (x: TemplateData): ItemData => ((x['screens'] as unknown as { blocks: ItemData[] }[])[0]?.blocks[0] ?? {}) as ItemData
    expect(first(image)['action']).toBe('image')
    expect(pressOf(first(image))).toBe('image')
    const modal = withPress(d, path, 'modal')
    expect(pressOf(first(modal))).toBe('modal')
  })
})

describe('スクリプトの決まり（countdown.ts・builder.ts と同じ）', () => {
  it('入力は一切入れない固定の文。編集中の本文（.ql-editor）では動かさない。1つのWidgetに1回だけ', () => {
    expect(ACTIONS_SCRIPT).not.toMatch(/\$\{/)
    expect(ACTIONS_SCRIPT).toContain(".closest('.ql-editor')")
    expect(ACTIONS_SCRIPT).toContain('root.__ncActs')
    // 同じWidgetに何度書き出しても、スクリプトは1回
    const html = render([button({ action: 'copy', actCopy: 'A' }), button({ action: 'scroll', actScroll: 'top' })])
    expect(html.split(ACTIONS_SCRIPT).length - 1).toBe(1)
  })

  it('アクションを使っていないWidgetには、スクリプトも小窓のCSSも入れない', () => {
    const html = render([button({ action: 'none' })])
    expect(html).not.toContain('data-nc-pop')
    expect(html).not.toContain('.nc-pop{')
    expect(html).not.toContain('<script>')
  })
})
