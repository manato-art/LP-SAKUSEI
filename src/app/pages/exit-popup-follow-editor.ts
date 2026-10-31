/**
 * 追従型ポップアップの編集画面（exit-popup-follow.ts から分離・2026-09-24）。
 *
 * 中身（HTML）は「中身を編集」＝Widget編集と同じ画面で直す。タブは離脱防止・表示直後と同じ5つ（基本 / 表示 / 位置 /
 * 出し分け / コード）で、中身は exit-popup-follow-tabs.ts（並びは3種類で同じ表＝popup-editor-layout.ts・2026-10-31 案A）。
 * 上の操作（戻る・プレビュー・LPの上で確認・LPの上で決める・保存・⋯）は離脱防止と同じ popup-editor-header.ts。
 *
 * 「保存」したら、すぐ配信に出る（配信ONのとき・2026-10-31 下書きと本番をやめた）。
 * 配信のON/OFFは変えたその場で保存する（一覧のカードと同じ）。
 */
import { popupApi, type FollowPopup } from '../api-popups.ts'
import { T, el, toast } from '../ui.ts'
import { FOLLOW_PRESETS } from './follow-popup-presets.ts'
import type { PopupPageState } from './exit-popup-state.ts'
import { lpPreviewUrl, openPopupStudio } from '../panels/popup-studio.ts'
import { popupContentCard } from './popup-content-card.ts'
import { runWidgetScripts } from '../panels/widget-run-scripts.ts'
import { buildPopupEditorHeader } from './popup-editor-header.ts'
import { followDraftPatch, isFollowDraftDirty } from './popup-draft.ts'
import { openDraftCheck } from './exit-popup-editor.ts'
import { freeKindOf, freePlaceCss } from '../../shared/follow-free-place.ts'
import { gridPlaceOfFollow, openLpPlacer } from './popup-lp-placer.ts'
import { EDITOR_TABS, offNote, type EditorTab } from './popup-editor-layout.ts'
import { renderFollowTab } from './exit-popup-follow-tabs.ts'

/** 画面の上端・下端の帯は画面の幅いっぱい（見たまま画面はLPと同じ620px）、角は中身の幅 */
export const isCornerPosition = (position: string): boolean => position === 'bottom-right' || position === 'bottom-left'

/** 追従型の出る所（「LPの上に重ねて見る」で中身を置く所。知らない値は配信と同じく下の帯） */
const followPlace = (position: string): 'top' | 'bottom' | 'bottom-right' | 'bottom-left' =>
  position === 'top' || position === 'bottom-right' || position === 'bottom-left' ? position : 'bottom'

export function openFollowEditor(state: PopupPageState, fp: FollowPopup): void {
  for (const p of state.root.querySelectorAll('.ep-panel, .ep-closed, .ep-editor')) p.remove()

  // saved＝最後にサーバーへ保存した形。draft＝この画面で直している途中の形
  let saved: FollowPopup = fp
  const draft: FollowPopup = { ...fp }
  const replaceInState = (next: FollowPopup): void => {
    saved = next
    state.followPopups = state.followPopups.map((p) => (p.uid === next.uid ? next : p))
  }

  const editor = el('div', { class: 'ep-editor' })

  /** 保存（「中身を編集」の「保存」も同じ・すぐ配信に出る）。保存できたら true */
  const save = async (): Promise<boolean> => {
    try {
      const { follow_popup } = await popupApi.updateFollowPopup(state.abTestUid, fp.uid, followDraftPatch(draft))
      replaceInState(follow_popup)
      toast(follow_popup.enabled ? '保存しました（配信に出ています）' : '保存しました（配信がOFFなので、まだ出ません）')
      return true
    } catch (err: unknown) {
      toast((err as Error).message, 'error')
      return false
    }
  }
  const isDirty = (): boolean => isFollowDraftDirty(draft, saved)

  const header = buildPopupEditorHeader({
    isDirty,
    onBack: () => {
      editor.remove()
      state.rerender()
    },
    onPreview: () => previewFollowPopup(draft),
    onCheckDraft: () => openDraftCheck(state.abTestUid, fp.uid, async () => (isDirty() ? save() : true)),
    onPlace: () => openPlacer(),
    onSave: save,
    onDuplicate: async () => {
      try {
        const { follow_popup } = await popupApi.duplicateFollowPopup(state.abTestUid, fp.uid)
        state.followPopups = [...state.followPopups, follow_popup]
        toast(`「${follow_popup.name}」を作りました（配信ONならすぐ出ます。出したくないときは配信をOFFに）`)
        openFollowEditor(state, follow_popup)
      } catch (err: unknown) {
        toast((err as Error).message, 'error')
      }
    },
    onDelete: async () => {
      try {
        await popupApi.deleteFollowPopup(state.abTestUid, fp.uid)
        state.followPopups = state.followPopups.filter((p) => p.uid !== fp.uid)
        editor.remove()
        state.rerender()
        toast('追従型ポップアップを削除しました')
      } catch (err: unknown) {
        toast((err as Error).message, 'error')
      }
    },
  })
  editor.append(header.top, header.bar)

  // ── フォーム上部: 中身（見え方の小さな絵＋「中身を編集」＝Widget編集と同じ画面）+ 配信/名前 ──
  const formTop = el('div', { class: 'ep-form-top' })
  const presetDef = fp.preset_id !== null ? FOLLOW_PRESETS.find((p) => p.id === fp.preset_id) : undefined
  const content = popupContentCard({
    read: () => ({ html: draft.html, css: draft.css }),
    renderWidth: isCornerPosition(draft.position) ? 360 : 620,
    ...(presetDef === undefined ? {} : { emptyArt: presetDef.thumbnailSvg }),
    onEdit: () => {
      // つまんで置いた場所（「中身を編集」の「保存」で保存する。保存せずに戻れば捨てる）
      let freePlace = draft.free_position
      openPopupStudio({
        html: draft.html,
        css: draft.css,
        name: draft.name,
        badge: '追従型',
        frame: isCornerPosition(draft.position) ? 'corner' : 'lp',
        // 「LPの上に重ねて見る」: 追従型は暗い幕なし・配信で出る所（上の帯・下の帯・右下・左下）に置く。
        // つまんで好きな場所へも動かせる（2026-10-30 本人「つまんで好きな場所へ」「スマホとPCで同じ位置」）
        underlay: lpPreviewUrl(state.abTestUid).catch(() => null),
        underlayStyle: {
          dim: false,
          place: followPlace(draft.position),
          free: {
            kind: freeKindOf(draft.position),
            get: () => freePlace,
            set: (place) => {
              freePlace = place
            },
          },
        },
        onSave: async (html) => {
          // CSS は中身の <style> に入った（見本の部品の中）。二重に効かないように CSS の欄は空にする
          draft.html = html
          draft.css = ''
          draft.free_position = freePlace
          content.refresh()
          renderFollowTab(body, draft, activeTab)
          return save()
        },
      })
    },
  })
  formTop.append(content.el)

  const fields = el('div', { class: 'ep-form-fields' })

  // 配信のON/OFF（変えたその場で保存する）
  const deliveryRow = el('div', { style: 'display:flex;align-items:center;gap:8px' })
  const editorToggle = el('button', { class: `ep-toggle${saved.enabled ? ' on' : ''}` })
  editorToggle.type = 'button'
  editorToggle.setAttribute('aria-label', '配信')
  editorToggle.addEventListener('click', () => {
    const next = !saved.enabled
    editorToggle.classList.toggle('on', next)
    void popupApi.updateFollowPopup(state.abTestUid, fp.uid, { enabled: next }).then(
      ({ follow_popup }) => replaceInState(follow_popup),
      (err: unknown) => {
        toast((err as Error).message, 'error')
        editorToggle.classList.toggle('on', saved.enabled)
      },
    )
  })
  deliveryRow.append(el('span', { style: 'font-size:13px', text: '配信' }), editorToggle)
  deliveryRow.append(el('span', { style: `font-size:11px;color:${T.sub}`, text: '配信は、変えるとすぐ反映されます' }))
  fields.append(deliveryRow)

  // 割合は追従型には無い（配信ONの物が全部出る＝delivery-popups.ts）。離脱防止・表示直後と同じ所に薄く出して書く
  const ratioField = el('div', { class: 'ep-field ep-field-off', style: 'margin-bottom:0' })
  ratioField.append(el('label', { text: '割合（%）' }), offNote('追従型は、配信ONのものが全部出ます（割合は、離脱防止・表示直後で使えます）'))
  fields.append(ratioField)

  const nameField = el('div', { class: 'ep-field', style: 'margin-bottom:0' })
  nameField.append(el('label', { text: '名前' }))
  const nameInput = document.createElement('input')
  nameInput.className = 'ep-editor-name'
  nameInput.value = draft.name
  nameInput.addEventListener('input', () => { draft.name = nameInput.value })
  nameField.append(nameInput)
  fields.append(nameField)

  formTop.append(fields)
  editor.append(formTop)

  /** 「LPの上で決める」（ここまで読んだら出す・出す場所・指示39）。決めたら編集中の形に入れてタブを描き直す（保存は「保存」） */
  const openPlacer = (): void =>
    openLpPlacer({
      title: 'LPの上で決める',
      lpUrl: lpPreviewUrl(state.abTestUid).catch(() => null),
      html: draft.html,
      css: draft.css,
      kind: freeKindOf(draft.position),
      box: false,
      free: draft.free_position,
      grid: gridPlaceOfFollow(draft.position),
      scroll: { pct: draft.show_after_scroll > 0 ? draft.show_after_scroll : null },
      onApply: ({ place, scrollPct }) => {
        if (place !== undefined) draft.free_position = place
        if (scrollPct !== undefined) draft.show_after_scroll = scrollPct
        renderFollowTab(body, draft, activeTab)
        toast('入れました。「保存」を押すと配信に出ます')
      },
    })

  // ── タブ ──
  const tabBar = el('div', { class: 'ep-editor-tabs' })
  const body = el('div', { class: 'ep-editor-body' })
  let activeTab: EditorTab = 'basic'

  for (const tab of EDITOR_TABS) {
    const btn = el('button', { class: `ep-editor-tab${tab.id === activeTab ? ' active' : ''}`, text: tab.label })
    btn.dataset['tab'] = tab.id
    btn.addEventListener('click', () => {
      activeTab = tab.id
      for (const b of tabBar.querySelectorAll('.ep-editor-tab')) b.classList.remove('active')
      btn.classList.add('active')
      renderFollowTab(body, draft, activeTab)
    })
    tabBar.append(btn)
  }
  editor.append(tabBar)
  editor.append(body)
  renderFollowTab(body, draft, activeTab)

  state.root.append(editor)
}
export function previewFollowPopup(fp: FollowPopup | Partial<FollowPopup>): void {
  document.getElementById('fp-preview-overlay')?.remove()

  const overlay = el('div', {
    style: `position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:9999;font-family:${T.font}`,
  })
  overlay.id = 'fp-preview-overlay'

  // 追従型は位置に合わせて表示（つまんで置いた場所があれば、配信と同じ割合の所）
  const pos = fp.position ?? 'bottom'
  const frame = el('div', { style: 'position:absolute;left:0;right:0' })
  const free = fp.free_position ?? null

  if (free !== null) {
    frame.style.cssText = `position:absolute;${freePlaceCss(freeKindOf(pos), free)}`
  } else if (pos === 'top') {
    frame.style.top = '0'
  } else if (pos === 'bottom') {
    frame.style.bottom = '0'
  } else if (pos === 'bottom-right') {
    frame.style.cssText = 'position:absolute;bottom:20px;right:20px;left:auto'
  } else if (pos === 'bottom-left') {
    frame.style.cssText = 'position:absolute;bottom:20px;left:20px;right:auto'
  }

  frame.innerHTML = fp.html ?? '<p>プレビューできるHTMLがありません</p>'

  // CSSを適用
  if (fp.css) {
    const styleEl = document.createElement('style')
    styleEl.textContent = fp.css
    frame.prepend(styleEl)
  }

  overlay.append(frame)

  const closeHint = el('div', {
    text: 'クリックで閉じる',
    style: 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--sb-c-ffffff, #FFFFFF);font-size:14px;opacity:.8;background:rgba(0,0,0,.5);padding:8px 16px;border-radius:6px',
  })
  overlay.append(closeHint)

  overlay.addEventListener('click', (e) => {
    if (frame.contains(e.target as Node)) return
    overlay.remove()
  })
  document.body.append(overlay)
  // 中身の <script> を動かす（innerHTML では動かない。部品で作った「次へ」で画面②へ移る・見本の動き）。
  // 配信と同じ順番: 中身のスクリプト → 追従型の動き（下）
  runWidgetScripts(frame)

  // JavaScriptを実行
  if (fp.javascript) {
    try {
      const fn = new Function(fp.javascript)
      fn()
    } catch (e) {
      console.warn('[fp-preview] JS実行エラー:', e)
    }
  }
}
