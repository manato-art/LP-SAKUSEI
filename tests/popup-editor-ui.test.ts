/**
 * ポップアップの編集画面・一覧の操作（2026-09-24 監査 15・26）。
 *
 * - 「戻る」: 保存していない変更があるときだけ確かめる（以前は黙って捨てていた）
 * - 「⋯」: 複製・削除（削除は赤い確認カード）。以前は押しても何も起きなかった
 * - 「下書きを確認」: 以前は押しても何も起きなかった
 * - 「閉じる」: 以前はパネルを消して真っ白な画面のままだった → 開き直せる案内を出す
 * - 追加画面の「複製」タブ: 以前はいつも「複製可能なポップアップはありません。」→ このLPのポップアップを並べる
 * DOM は linkedom で作る（vitest の環境は node）。
 */
import { parseHTML } from 'linkedom'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ConfirmOptions } from '../src/app/dialog.ts'
import type { ExitPopup, PopupDeliveryVersion } from '../src/app/api-popups.ts'
import {
  draftCheckUrl,
  exitDraftPatch,
  isExitDraftDirty,
  mainVersionUid,
  popupDeliveryOptionLabel,
  publishStatusView,
} from '../src/app/pages/popup-draft.ts'
import { buildPopupEditorHeader, type PopupEditorHeaderOptions } from '../src/app/pages/popup-editor-header.ts'
import { closedPanelNotice, copyTabList } from '../src/app/pages/popup-list-parts.ts'

beforeEach(() => {
  const { document, window } = parseHTML('<!doctype html><html><body></body></html>')
  const g = globalThis as unknown as Record<string, unknown>
  g['document'] = document
  g['window'] = window
})

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function popup(over: Partial<ExitPopup> = {}): ExitPopup {
  return {
    id: 1, uid: 'EXITPOPUP_0001', ab_test_id: 1, name: 'P', ratio: 0, enabled: true, preset_id: null,
    visit_count: 'all', phone_number: '', link_url: '', link_target: '_blank', tracking_urls: [],
    animation: 'fade', delay_seconds: 0, scroll_trigger: false, scroll_position: 50,
    countdown_trigger: false, countdown_seconds: 0, back_button_trigger: false, exit_trigger: true,
    position_x: 50, position_y: 50, device_sp: true, device_tablet: true, device_pc: true,
    html: '<p>x</p>', javascript: '', head_tag: '', body_tag: '', popup_kind: 'exit', link_action: 'link',
    live: null, publish_status: 'unpublished',
    ...over,
  }
}

describe('下書きの道具（純粋関数）', () => {
  it('下書き反映で送るのは中身と名前だけ（配信ON/OFF・割合・本番・uid は送らない）', () => {
    const patch = exitDraftPatch(popup({ name: 'N', html: '<p>h</p>' }))
    expect(patch).toMatchObject({ name: 'N', html: '<p>h</p>' })
    for (const key of ['enabled', 'ratio', 'live', 'publish_status', 'uid', 'id', 'ab_test_id', 'popup_kind']) {
      expect(key in patch, key).toBe(false)
    }
  })

  it('保存していない変更: 中身・名前が違えば true、配信ON/OFF・割合だけの違いは false（その場で保存するため）', () => {
    const saved = popup()
    expect(isExitDraftDirty({ ...saved }, saved)).toBe(false)
    expect(isExitDraftDirty({ ...saved, html: '<p>y</p>' }, saved)).toBe(true)
    expect(isExitDraftDirty({ ...saved, name: 'Q' }, saved)).toBe(true)
    expect(isExitDraftDirty({ ...saved, tracking_urls: ['https://example.com/pixel'] }, saved)).toBe(true)
    expect(isExitDraftDirty({ ...saved, enabled: false, ratio: 40 }, saved)).toBe(false)
  })

  it('本番との違いの表示', () => {
    expect(publishStatusView('unpublished').label).toBe('未公開')
    expect(publishStatusView('changed').label).toBe('下書きあり')
    expect(publishStatusView('published').label).toBe('公開中')
  })

  it('下書きを確かめるURLと、重ねるVersion（最初のステップで割合がいちばん大きい物）', () => {
    const versions: PopupDeliveryVersion[] = [
      { uid: 'V1', name: 'A', step: 1, distribution_ratio: 30, popup_delivery: true },
      { uid: 'V2', name: 'B', step: 1, distribution_ratio: 70, popup_delivery: true },
      { uid: 'V3', name: 'C', step: 2, distribution_ratio: 100, popup_delivery: true },
    ]
    expect(mainVersionUid(versions)).toBe('V2')
    expect(mainVersionUid([])).toBeNull()
    expect(draftCheckUrl('V2', 'EXITPOPUP_0009')).toBe('/preview/V2?popup_draft=EXITPOPUP_0009')
    expect(popupDeliveryOptionLabel(versions[2]!, true)).toBe('ステップ2 / C')
    expect(popupDeliveryOptionLabel(versions[2]!, false)).toBe('C')
  })
})

interface Calls {
  back: number
  saveDraft: number
  publish: number
  duplicate: number
  remove: number
  checkDraft: number
  confirms: ConfirmOptions[]
}

function header(dirty: boolean, confirmAnswer: boolean): { calls: Calls; root: HTMLElement } {
  const calls: Calls = { back: 0, saveDraft: 0, publish: 0, duplicate: 0, remove: 0, checkDraft: 0, confirms: [] }
  const options: PopupEditorHeaderOptions = {
    status: () => 'changed',
    isDirty: () => dirty,
    onBack: () => { calls.back += 1 },
    onPreview: () => undefined,
    onCheckDraft: async () => { calls.checkDraft += 1 },
    onSaveDraft: async () => { calls.saveDraft += 1; return true },
    onPublish: async () => { calls.publish += 1; return true },
    onDuplicate: async () => { calls.duplicate += 1 },
    onDelete: async () => { calls.remove += 1 },
    confirm: async (o) => { calls.confirms.push(o); return confirmAnswer },
  }
  const built = buildPopupEditorHeader(options)
  const root = document.createElement('div')
  root.append(built.top, built.bar)
  document.body.append(root)
  return { calls, root }
}

const byText = (root: HTMLElement, text: string): HTMLElement => {
  const found = [...root.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim().startsWith(text))
  if (found === undefined) throw new Error(`「${text}」のボタンがありません`)
  return found as HTMLElement
}

describe('編集画面の上の操作', () => {
  it('戻る: 変更が無ければ確かめずに戻る', async () => {
    const { calls, root } = header(false, false)
    byText(root, '戻る').click()
    await flush()
    expect(calls.confirms).toHaveLength(0)
    expect(calls.back).toBe(1)
  })

  it('戻る: 変更があれば赤い確認カードで確かめ、「編集を続ける」なら戻らない', async () => {
    const { calls, root } = header(true, false)
    byText(root, '戻る').click()
    await flush()
    expect(calls.confirms).toHaveLength(1)
    expect(calls.confirms[0]?.danger).toBe(true)
    expect(calls.back).toBe(0)
  })

  it('戻る: 確認で「保存せずに戻る」なら戻る', async () => {
    const { calls, root } = header(true, true)
    byText(root, '戻る').click()
    await flush()
    expect(calls.back).toBe(1)
  })

  it('下書き反映・本番反映・下書きを確認がそれぞれ動く', async () => {
    const { calls, root } = header(false, true)
    byText(root, '下書き反映').click()
    byText(root, '本番反映').click()
    byText(root, '下書きを確認').click()
    await flush()
    expect(calls.saveDraft).toBe(1)
    expect(calls.publish).toBe(1)
    expect(calls.checkDraft).toBe(1)
  })

  it('⋯: 複製と削除が出る。削除は赤い確認カードで確かめてから', async () => {
    const { calls, root } = header(false, true)
    byText(root, '⋯').click()
    byText(root, '削除').click()
    await flush()
    expect(calls.confirms[0]?.danger).toBe(true)
    expect(calls.confirms[0]?.submitLabel).toBe('削除する')
    expect(calls.remove).toBe(1)

    byText(root, '⋯').click()
    byText(root, '複製').click()
    await flush()
    expect(calls.duplicate).toBe(1)
  })

  it('⋯ 複製: 保存していない変更があれば、下書き反映してから複製する（断れば何もしない）', async () => {
    const yes = header(true, true)
    byText(yes.root, '⋯').click()
    byText(yes.root, '複製').click()
    await flush()
    expect(yes.calls.saveDraft).toBe(1)
    expect(yes.calls.duplicate).toBe(1)

    const no = header(true, false)
    byText(no.root, '⋯').click()
    byText(no.root, '複製').click()
    await flush()
    expect(no.calls.saveDraft).toBe(0)
    expect(no.calls.duplicate).toBe(0)
  })

  it('本番との違いを表示する', () => {
    const { root } = header(false, true)
    expect(root.textContent).toContain('下書きあり')
  })
})

describe('一覧の部品', () => {
  it('閉じたあとの案内から、ポップアップの一覧を開き直せる', () => {
    let reopened = 0
    const notice = closedPanelNotice(() => { reopened += 1 })
    document.body.append(notice)
    byText(notice, 'ポップアップの一覧を開く').click()
    expect(reopened).toBe(1)
  })

  it('複製タブ: このLPのポップアップを並べ、選んだ物を複製する。無ければそう出す', () => {
    const chosen: string[] = []
    const list = copyTabList(
      [{ uid: 'A', name: 'セール', note: '離脱防止' }, { uid: 'B', name: '初回限定', note: '表示直後' }],
      (uid) => { chosen.push(uid) },
    )
    document.body.append(list)
    expect(list.textContent).toContain('セール')
    expect(list.textContent).toContain('初回限定')
    const buttons = [...list.querySelectorAll('button')]
    expect(buttons).toHaveLength(2)
    ;(buttons[1] as HTMLElement).click()
    expect(chosen).toEqual(['B'])

    const empty = copyTabList([], () => undefined)
    expect(empty.textContent).toContain('複製できるポップアップはまだありません')
  })
})
