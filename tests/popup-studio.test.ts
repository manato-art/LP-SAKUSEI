/**
 * 離脱防止ポップ・追従型ポップの中身を、Widget編集と同じ画面で直す（2026-09-24・本人の決定
 * 「中身だけWidget編集で」「追従型も同じにする」）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { embedBuilderData } from '../src/app/panels/nocode/builder-data.ts'
import { BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import { items, str, type TemplateData } from '../src/app/panels/nocode/templates/types.ts'
import { popupStudioStart } from '../src/app/panels/popup-studio-start.ts'
import { buildPopupSnippet } from '../mock-server/routes/delivery-popup-html.ts'
import type { ExitPopup } from '../mock-server/store/types.ts'

const NOW = new Date(Date.UTC(2026, 8, 24, 3, 0))
const src = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const blocksOf = (data: TemplateData) => items(items(data, 'screens')[0] ?? {}, 'blocks')

describe('ポップアップの中身を開くときの始まり', () => {
  it('中身が空なら白紙（「何から作りますか？」から選べる）', () => {
    const { data } = popupStudioStart('', '', '春のポップ', NOW)
    expect(items(data, 'screens')).toHaveLength(1)
    expect(blocksOf(data)).toHaveLength(0)
  })

  it('部品で作った中身（設定データつき）は、その設定データと名前で開く', () => {
    const built: TemplateData = {
      ...BUILDER_TEMPLATE.defaults(NOW),
      screens: [{ id: 's1', name: '画面①', blocks: [{ type: 'heading', text: '今だけ20%オフ' }] }],
    }
    const html = embedBuilderData(BUILDER_TEMPLATE.render(built, 'nc-pop00001'), built)
    const start = popupStudioStart(html, '', '春のポップ', NOW)
    expect(str(blocksOf(start.data)[0] ?? {}, 'text')).toBe('今だけ20%オフ')
    expect(start.uid).toBe('nc-pop00001')
  })

  it('プリセットなど設定データの無い中身は、見本の部品1つ（CSSも中に入れる・見え方は変えない）', () => {
    const start = popupStudioStart('<div class="ep-x">今だけ</div>', '.ep-x{color:red}', '春のポップ', NOW)
    const [only] = blocksOf(start.data)
    expect(blocksOf(start.data)).toHaveLength(1)
    expect(str(only ?? {}, 'type')).toBe('sample')
    expect(str(only ?? {}, 'title')).toBe('春のポップ')
    expect(str(only ?? {}, 'html')).toBe('<style>.ep-x{color:red}</style><div class="ep-x">今だけ</div>')
    expect(start.data['padding']).toBe(0)
    expect(start.data['background']).toBe('none')
  })
})

describe('配信: 部品で作った「次の画面へ」はポップアップの動きより先に効く', () => {
  const popup = {
    uid: 'p1', html: '<div data-nc-go="s2" role="button">次へ</div>', javascript: '', head_tag: '', body_tag: '',
    device_sp: true, device_tablet: true, device_pc: true, animation: 'none', delay_seconds: 0, scroll_trigger: false,
    scroll_position: 0, countdown_trigger: false, countdown_seconds: 0, back_button_trigger: false, exit_trigger: true,
    link_url: 'https://example.com', link_target: '_blank', tracking_urls: [], link_action: 'close',
  } as unknown as ExitPopup

  it('中身の [data-nc-go] を押したときは、閉じる・遷移先へ移動するより前に抜ける', () => {
    const snippet = buildPopupSnippet(popup, 'pc')
    const go = snippet.indexOf("closest('[data-nc-go]')")
    expect(go).toBeGreaterThan(-1)
    expect(go).toBeLessThan(snippet.indexOf("if(linkAction==='close')"))
    expect(go).toBeLessThan(snippet.indexOf('ポップアップ本体クリック'))
  })
})

describe('編集画面の配線', () => {
  const exitEditor = src('src/app/pages/exit-popup-editor.ts')
  const followEditor = src('src/app/pages/exit-popup-follow.ts')

  it('離脱防止: 中身は「中身を編集」から Widget編集の画面で直す（「デザイン」タブ・HTMLの欄は無くす）', () => {
    expect(exitEditor).toContain('openPopupStudio(')
    expect(exitEditor).toContain('中身を編集')
    expect(exitEditor).not.toContain("id: 'design'")
    expect(exitEditor).not.toContain("{ id: 'html', label: 'HTML' }")
  })

  it('追従型も同じ（中身は Widget編集の画面。HTMLの欄は無くす）', () => {
    expect(followEditor).toContain('openPopupStudio(')
    expect(followEditor).toContain('中身を編集')
    expect(followEditor).not.toContain("{ id: 'html', label: 'HTML' }")
  })

  it('ポップアップでもライブラリの見本を選べる（本人「やって」2026-09-24。LPの編集が無くても見本の一覧は開く）', () => {
    const studio = src('src/app/panels/widget-studio.ts')
    expect(studio).toContain('openWidgetLibraryForPick(host.libraryQuill,')
    expect(studio).not.toContain('libraryQuill === null')
    expect(src('src/app/panels/widget-library.ts')).toContain('export function openWidgetLibraryForPick(quill: Quill | null,')
  })

  it('LPの無い画面で開いたライブラリには、LPへ入れる・新しく作る入口を出さない（見本を選ぶだけ）', () => {
    const library = src('src/app/panels/widget-library.ts')
    expect(library).toContain('if (quill !== null) addLpEntries(')
    expect(library).toContain('if (preview !== undefined && quill !== null) addUseAsScreens(')
  })
})
