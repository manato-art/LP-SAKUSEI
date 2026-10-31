/**
 * ポップアップの編集画面を3種類（離脱防止・表示直後・追従型）で同じ型にそろえる
 * （2026-10-31 本人「なんか表示されている部分が一貫していなくて使い勝手が悪い」→ 案A・タブは今の5つ）。
 *
 *  - タブは3種類とも 基本・表示・位置・出し分け・コード（追従型の「表示設定」1つにまとめた形はやめる）
 *  - 中の並びも同じ。その種類で使えない設定は隠さずに薄く出し、どの種類で使えるかを書く
 *  - 「LPの上で決める」はタブの中に置かず、上のボタンの並びに1つだけ
 *  - スイッチがオフ（動作が違う）ときは、下の欄を薄くして触れないようにする
 *  - 言葉をそろえる（移行先URL・日本語のアニメーション名・「秒数」だけの名前は使わない・本番に出るボタンは「保存」）
 * どの種類の画面も popup-editor-layout.ts の表から作る。設定を足すときは表に1行足せば3種類に出る。
 */
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ExitPopup, FollowPopup } from '../src/app/api-popups.ts'
import {
  EDITOR_TABS,
  POPUP_SETTINGS,
  offNoteOf,
  settingsOfTab,
  type EditorTab,
  type PopupKind,
} from '../src/app/pages/popup-editor-layout.ts'
import { renderEditorTab } from '../src/app/pages/exit-popup-editor-tabs.ts'
import { renderFollowTab } from '../src/app/pages/exit-popup-follow-tabs.ts'
import { buildPopupEditorHeader } from '../src/app/pages/popup-editor-header.ts'

const src = (path: string): string => readFileSync(path, 'utf8')

beforeEach(() => {
  const { document, window } = parseHTML('<!doctype html><html><head></head><body></body></html>')
  const g = globalThis as unknown as Record<string, unknown>
  g['document'] = document
  g['window'] = window
  g['Event'] = window.Event
})

function exitPopup(over: Partial<ExitPopup> = {}): ExitPopup {
  return {
    id: 1, uid: 'EXITPOPUP_0001', ab_test_id: 1, name: 'P', ratio: 100, enabled: true, preset_id: null,
    visit_count: 'all', phone_number: '', link_url: '', link_target: '_blank', tracking_urls: [],
    animation: 'fade', delay_seconds: 0, scroll_trigger: false, scroll_position: 50,
    countdown_trigger: false, countdown_seconds: 0, back_button_trigger: false, exit_trigger: true,
    position_x: 50, position_y: 50, free_position: null, device_sp: true, device_tablet: true, device_pc: true,
    html: '<p>x</p>', javascript: '', head_tag: '', body_tag: '', popup_kind: 'exit', link_action: 'link',
    ...over,
  }
}

function followPopup(over: Partial<FollowPopup> = {}): FollowPopup {
  return {
    id: 1, uid: 'FOLLOWPOPUP_0001', ab_test_id: 1, name: 'F', enabled: true, preset_id: null, position: 'bottom',
    free_position: null, link_url: '', link_target: '_blank', show_after_scroll: 0, show_close_button: true,
    animation: 'slideUp', device_sp: true, device_tablet: true, device_pc: true, html: '<div>帯</div>', javascript: '', css: '',
    ...over,
  }
}

/** その種類のそのタブを描く */
function render(kind: PopupKind, tab: EditorTab, over: Record<string, unknown> = {}): HTMLElement {
  const body = document.createElement('div')
  if (kind === 'follow') renderFollowTab(body, followPopup(over as Partial<FollowPopup>), tab)
  else renderEditorTab(body, exitPopup({ popup_kind: kind, ...(over as Partial<ExitPopup>) }), tab)
  return body
}

const setting = (body: HTMLElement, key: string): HTMLElement => {
  const found = body.querySelector<HTMLElement>(`[data-setting="${key}"]`)
  if (found === null) throw new Error(`設定 ${key} が無い`)
  return found
}
const isDisabled = (elm: Element): boolean => elm.hasAttribute('disabled')
const KINDS: readonly PopupKind[] = ['exit', 'instant', 'follow']

describe('3種類の編集画面は同じ表から作る', () => {
  it('タブは3種類とも 基本・表示・位置・出し分け・コード（追従型の「表示設定」はやめる）', () => {
    expect(EDITOR_TABS.map((tab) => tab.label)).toEqual(['基本', '表示', '位置', '出し分け', 'コード'])
    const follow = src('src/app/pages/exit-popup-follow-editor.ts')
    expect(follow).toContain("from './popup-editor-layout.ts'")
    expect(follow).not.toContain("label: '表示設定'")
    expect(src('src/app/pages/exit-popup-editor.ts')).toContain("from './popup-editor-layout.ts'")
  })

  it('表のどの行も、5つのタブのどれかに入っている', () => {
    const tabs = EDITOR_TABS.map((tab) => tab.id)
    for (const row of POPUP_SETTINGS) expect(tabs, row.key).toContain(row.tab)
  })

  for (const tab of EDITOR_TABS) {
    it(`「${tab.label}」タブは3種類とも表のとおりの順。使えない設定は薄く出して、どの種類で使えるか書く`, () => {
      const rows = settingsOfTab(tab.id)
      for (const kind of KINDS) {
        const body = render(kind, tab.id)
        const keys = [...body.querySelectorAll<HTMLElement>('[data-setting]')].map((elm) => elm.dataset['setting'])
        expect(keys, `${kind} ${tab.label}`).toEqual(rows.map((row) => row.key))
        for (const row of rows) {
          const elm = setting(body, row.key)
          expect(elm.textContent, `${kind} ${row.key}`).toContain(row.label)
          const usable = row.kinds.includes(kind)
          expect(elm.hasAttribute('data-unavailable'), `${kind} ${row.key}`).toBe(!usable)
          if (!usable) expect(elm.textContent).toContain(offNoteOf(row))
        }
      }
    })
  }

  it('「LPの上で決める」はタブの中に置かない（上のボタンの並びに1つだけ）', () => {
    // 説明の文で上のボタンを指すのはよい（ボタンは置かない）
    for (const kind of KINDS) {
      for (const tab of EDITOR_TABS) {
        const buttons = [...render(kind, tab.id).querySelectorAll('button')].map((b) => b.textContent)
        expect(buttons, `${kind} ${tab.label}`).not.toContain('LPの上で決める')
      }
    }
    let placed = 0
    const { bar } = buildPopupEditorHeader({
      isDirty: () => false,
      onBack: () => undefined,
      onPreview: () => undefined,
      onCheckDraft: async () => undefined,
      onPlace: () => {
        placed += 1
      },
      onSave: async () => true,
      onDuplicate: async () => undefined,
      onDelete: async () => undefined,
    })
    const button = [...bar.querySelectorAll('button')].find((b) => b.textContent === 'LPの上で決める')
    expect(button).toBeDefined()
    button?.click()
    expect(placed).toBe(1)
  })
})

describe('言葉をそろえる', () => {
  it('追従型のアニメーションも日本語（英語のまま出さない）', () => {
    const options = [...render('follow', 'display').querySelectorAll('option')].map((o) => o.textContent ?? '')
    expect(options).toContain('スライドアップ')
    for (const text of options) expect(text, text).not.toMatch(/^[A-Za-z]+$/)
  })

  it('「秒数」だけの名前は使わない（開いてから出さない秒数・カウントダウンの秒数）', () => {
    const labels = [...render('exit', 'display').querySelectorAll('label')].map((label) => label.textContent ?? '')
    expect(labels).not.toContain('秒数')
    expect(labels).toContain('開いてから出さない秒数')
    expect(labels).toContain('カウントダウンの秒数')
  })

  it('「中身を編集」の確定は「保存」・戻るは「戻る」。「LPの上で決める」の確定は「この内容で戻る」（まだ本番に出ない）', () => {
    const studio = src('src/app/panels/popup-studio.ts')
    expect(studio).toContain("primaryLabel: '保存'")
    expect(studio).toContain("backLabel: '戻る'")
    expect(studio).not.toContain('ポップアップに反映')
    const placer = src('src/app/pages/popup-lp-placer.ts')
    expect(placer).toContain("text: 'この内容で戻る'")
    expect(placer).not.toContain("text: '決める'")
  })

  it('中の画像・ボタン・要素全体の移る先も「移行先URL」', () => {
    const form = src('src/app/panels/nocode/form-sample.ts')
    expect(form).toContain('移行先URL（押したときに移る先）')
    expect(form).toContain('ボタンの移行先URL')
    expect(form).not.toContain("'リンク先（押したときに移る先）'")
    expect(src('src/app/panels/nocode/sample-link-field.ts')).toContain('この要素全体の移行先URL')
  })
})

describe('オフの設定は薄くして触れないようにする', () => {
  it('離脱防止: 「スクロールで表示」がオフなら、読んだら表示の数字とつまみは触れない。オンにすると触れる', () => {
    const body = render('exit', 'display', { scroll_trigger: false })
    const scroll = setting(body, 'scroll')
    const inputs = () => [...scroll.querySelectorAll('input')]
    expect(inputs().length).toBe(2)
    expect(inputs().every(isDisabled)).toBe(true)
    scroll.querySelector<HTMLButtonElement>('.ep-toggle')?.click()
    expect(inputs().some(isDisabled)).toBe(false)
  })

  it('離脱防止: 「カウントダウンで表示」がオフなら、カウントダウンの秒数は触れない', () => {
    const countdown = setting(render('exit', 'display', { countdown_trigger: false }), 'countdown')
    expect(isDisabled(countdown.querySelector('input') as Element)).toBe(true)
    countdown.querySelector<HTMLButtonElement>('.ep-toggle')?.click()
    expect(isDisabled(countdown.querySelector('input') as Element)).toBe(false)
  })

  it('押したときの動作が「LPに戻る」なら移行先URLと電話番号は触れない。「電話をかける」なら電話番号だけ触れる', () => {
    const body = render('exit', 'basic', { link_action: 'close' })
    const urlInput = (): Element => setting(body, 'link').querySelector('input[type="text"]') as Element
    const phoneInput = (): Element => setting(body, 'phone').querySelector('input') as Element
    expect(isDisabled(urlInput())).toBe(true)
    expect(isDisabled(phoneInput())).toBe(true)
    const tel = setting(body, 'action').querySelector<HTMLInputElement>('input[value="tel"]') as HTMLInputElement
    tel.checked = true
    tel.dispatchEvent(new Event('change'))
    expect(isDisabled(urlInput())).toBe(true)
    expect(isDisabled(phoneInput())).toBe(false)
  })

  it('追従型: 「スクロールで表示」をオンにすると50%から、オフにすると0（開いてすぐ出す）', () => {
    const draft = followPopup({ show_after_scroll: 0 })
    const body = document.createElement('div')
    renderFollowTab(body, draft, 'display')
    const scroll = setting(body, 'scroll')
    expect(isDisabled(scroll.querySelector('input') as Element)).toBe(true)
    scroll.querySelector<HTMLButtonElement>('.ep-toggle')?.click()
    expect(draft.show_after_scroll).toBe(50)
    expect(isDisabled(scroll.querySelector('input') as Element)).toBe(false)
    scroll.querySelector<HTMLButtonElement>('.ep-toggle')?.click()
    expect(draft.show_after_scroll).toBe(0)
  })
})

describe('追従型の「位置」も9マス', () => {
  it('上・左下・下・右下だけ押せて、押すとその場所になる（つまんで置いた場所は消す）', () => {
    const draft = followPopup({ position: 'bottom', free_position: { x: 10, y: 20 } })
    const body = document.createElement('div')
    renderFollowTab(body, draft, 'position')
    const cells = [...body.querySelectorAll<HTMLButtonElement>('.ep-pos-cell')]
    expect(cells.length).toBe(9)
    expect(cells.filter((cell) => !isDisabled(cell)).map((cell) => cell.title)).toEqual(['上', '左下', '下', '右下'])
    cells.find((cell) => cell.title === '右下')?.click()
    expect(draft.position).toBe('bottom-right')
    expect(draft.free_position).toBeNull()
  })
})
