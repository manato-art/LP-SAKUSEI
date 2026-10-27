/**
 * リンク置換の一覧（2026-10-27 本人の指示⑫⑬⑭）。
 * ⑫ 「リンクが入っていないものも含まれてしまっている」→ 行き先の無いリンク（# だけ・空・javascript:）は出さない
 * ⑬ 「ウィジェットの中ならわかりやすいようにWidgetって表示して」→ Widget の中のリンクに「Widget」
 * ⑭ 「ここで計測ありなしを変更したい」→ 行の「計測あり／計測なし」を押すと、その1本だけ切り替える（行き先はそのまま）
 */
import { describe, expect, it } from 'vitest'
import { extractLinksFromHtml, listedLinks } from '../src/shared/link-html.ts'
import { settle, setupLinkReplacePanel } from './helpers/link-replace-panel.ts'

const WIDGET =
  '<section class="sb-widget-block" data-widget-block="true" contenteditable="false">' +
  '<section class="inner"><a href="https://example.test/w1">Widgetの申し込み</a></section>' +
  '<a href="#">回答をはじめる</a><a href="#">はい</a></section>'
const HTML =
  '<p><a href="https://example.test/buy?sb_tracking=true" target="_blank">ボタン反応テスト</a></p>' +
  WIDGET +
  '<p><a href="https://example.test/company">運営者情報</a><a href="#faq">よくある質問へ</a><a href="">空</a><a href="javascript:void(0)">何もしない</a></p>'

describe('一覧に出すリンク（⑫）とWidgetの印（⑬）', () => {
  it('Widget の枠の中のリンクには印が付く（枠の中に section が入れ子でも、枠の外は付かない）', () => {
    expect(extractLinksFromHtml(HTML).map((link) => [link.text, link.inWidget])).toEqual([
      ['ボタン反応テスト', false],
      ['Widgetの申し込み', true],
      ['回答をはじめる', true],
      ['はい', true],
      ['運営者情報', false],
      ['よくある質問へ', false],
      ['空', false],
      ['何もしない', false],
    ])
  })

  it('行き先の無いリンク（# だけ・空・javascript:）は出さない。ページ内の移動（#faq）は出す。番号は本文の出現順のまま', () => {
    expect(listedLinks(HTML).map((link) => [link.index, link.text])).toEqual([
      [0, 'ボタン反応テスト'],
      [1, 'Widgetの申し込み'],
      [4, '運営者情報'],
      [5, 'よくある質問へ'],
    ])
  })

  it('パネルの一覧: 行き先の無いリンクは並ばず、Widget の中のリンクには「Widget」と出る', async () => {
    const t = await setupLinkReplacePanel(HTML)
    expect(t.rowIndexes()).toEqual(['0', '1', '4', '5'])
    const widgetTag = (index: number): boolean => t.panel.querySelector(`[data-link-row="${String(index)}"] [data-link-widget]`) !== null
    expect([0, 1, 4, 5].map(widgetTag)).toEqual([false, true, false, false])
    expect(t.panel.querySelector('[data-link-row="1"] [data-link-widget]')?.textContent).toBe('Widget')
  })
})

describe('行で計測あり・なしを切り替える（⑭）', () => {
  const toggle = async (t: Awaited<ReturnType<typeof setupLinkReplacePanel>>, index: number): Promise<void> => {
    t.panel.querySelector(`[data-link-row="${String(index)}"] [data-link-tracking-toggle]`)?.dispatchEvent(new t.window.Event('click'))
    await settle()
  }

  it('「計測あり」を押すと、その1本だけ計測なしになる（行き先・別タブはそのまま。ほかの行は変えない）', async () => {
    const t = await setupLinkReplacePanel(HTML)
    expect(t.panel.querySelector('[data-link-row="0"] [data-link-tracking-toggle]')?.textContent).toBe('計測あり')
    await toggle(t, 0)
    expect(t.posts()).toHaveLength(1)
    expect(t.posts()[0]?.body).toMatchObject({ indexes: [0], url: 'https://example.test/buy', tracking: false, new_tab: true, target_type: 'free' })
    const links = extractLinksFromHtml(t.body.innerHTML)
    expect(links[0]).toMatchObject({ href: 'https://example.test/buy', isTracking: false, isNewTab: true })
    expect(links[4]?.href).toBe('https://example.test/company')
    expect(t.panel.querySelector('[data-link-row="0"] [data-link-tracking-toggle]')?.textContent).toBe('計測なし')
  })

  it('「計測なし」を押すと計測ありになる。押しても行のチェック（置換の選択）は変わらない', async () => {
    const t = await setupLinkReplacePanel(HTML)
    t.pick(1)
    await toggle(t, 4)
    expect(t.posts()[0]?.body).toMatchObject({ indexes: [4], url: 'https://example.test/company', tracking: true, new_tab: false })
    expect(extractLinksFromHtml(t.body.innerHTML)[4]?.href).toBe('https://example.test/company?sb_tracking=true')
    expect(t.panel.querySelector<HTMLInputElement>('[data-link-row="1"] input')?.checked).toBe(true)
    expect(t.panel.querySelector<HTMLInputElement>('[data-link-row="4"] input')?.checked).toBe(false)
  })

  it('ページ内の移動（#faq）には切り替えを出さない（計測の印を付けられない）', async () => {
    const t = await setupLinkReplacePanel(HTML)
    expect(t.panel.querySelector('[data-link-row="5"] [data-link-tracking-toggle]')).toBeNull()
  })
})
