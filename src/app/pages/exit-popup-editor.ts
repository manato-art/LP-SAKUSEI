/**
 * 離脱防止・表示直後ポップアップの編集画面（exit-popup.ts から分離）。
 *
 * 中身（見た目）は「中身を編集」から Widget編集と同じ画面で直す（2026-09-24・本人の決定「中身だけWidget編集で」）。
 * タブ（基本 / 表示 / 位置 / 出し分け / コード）は exit-popup-editor-tabs.ts、上の操作は popup-editor-header.ts。
 *
 * 下書きと本番を分ける（2026-09-24・本人の決定）:
 *   - 「下書き反映」は下書きだけを保存（配信には出ない）。「本番反映」で下書きを本番にする
 *   - 「下書きを確認」は保存した下書きを、LPの上に出して新しいタブで見る（保存していない変更は先に下書き反映する）
 *   - 配信のON/OFFと割合は、変えたその場で保存する（一覧のカードと同じ・下書きに入れない）
 *
 * 依存は一方向にしてある: このファイルは exit-popup.ts を import しない。
 * 一覧の描き直しは `state.rerender()` を通す。
 */
import { popupApi, type ExitPopup } from '../api-popups.ts'
import { T, el, toast } from '../ui.ts'
import { PRESETS } from './exit-popup-presets.ts'
import { popupKindOf, type PopupPageState } from './exit-popup-state.ts'
import { EDITOR_TABS, renderEditorTab, type EditorTab } from './exit-popup-editor-tabs.ts'
import { lpPreviewUrl, openPopupStudio } from '../panels/popup-studio.ts'
import { popupContentCard } from './popup-content-card.ts'
import { runWidgetScripts } from '../panels/widget-run-scripts.ts'
import { buildPopupEditorHeader } from './popup-editor-header.ts'
import { RATIO_HELP, draftCheckUrl, exitDraftPatch, isExitDraftDirty, mainVersionUid } from './popup-draft.ts'

/**
 * 「下書きを確認」: 新しいタブに、保存した下書きをLPの上に出す。
 * タブは押した直後に開く（保存や読み込みを待ってから開くと、ブラウザにポップアップとして止められる）。
 * saveFirst が false を返したら（保存できなかったら）タブを閉じる。
 */
export async function openDraftCheck(
  abTestUid: string,
  popupUid: string,
  saveFirst: () => Promise<boolean>,
): Promise<void> {
  const win = window.open('', '_blank')
  if (win === null) {
    toast('新しいタブを開けませんでした。ブラウザのポップアップを止める設定を確かめてください', 'error')
    return
  }
  win.opener = null
  try {
    if (!(await saveFirst())) {
      win.close()
      return
    }
    const versionUid = mainVersionUid((await popupApi.popupDelivery(abTestUid)).versions)
    if (versionUid === null) {
      win.close()
      toast('確かめるLPのVersionがありません', 'error')
      return
    }
    win.location.href = draftCheckUrl(versionUid, popupUid)
  } catch (err: unknown) {
    win.close()
    toast((err as Error).message, 'error')
  }
}

export function openEditor(state: PopupPageState, popup: ExitPopup): void {
  // 一覧・閉じた案内・前の編集画面を外してから描く
  for (const p of state.root.querySelectorAll('.ep-panel, .ep-closed, .ep-editor')) p.remove()

  // saved＝最後にサーバーへ保存した形。draft＝この画面で直している下書き（保存まで一覧のデータを壊さない）
  let saved: ExitPopup = popup
  const draft: ExitPopup = { ...popup, tracking_urls: [...(popup.tracking_urls ?? [])] }
  const replaceInState = (next: ExitPopup): void => {
    saved = next
    state.popups = state.popups.map((p) => (p.uid === next.uid ? next : p))
  }

  const editor = el('div', { class: 'ep-editor' })

  /** 下書き反映（中身の「ポップアップに反映」も同じ）。保存できたら true */
  const saveDraft = async (): Promise<boolean> => {
    try {
      const { exit_popup } = await popupApi.updateExitPopup(state.abTestUid, popup.uid, exitDraftPatch(draft))
      replaceInState(exit_popup)
      toast('下書きに保存しました（配信にはまだ出ません）')
      return true
    } catch (err: unknown) {
      toast((err as Error).message, 'error')
      return false
    }
  }
  /** 本番反映: 下書きを保存してから本番にする */
  const publish = async (): Promise<boolean> => {
    try {
      await popupApi.updateExitPopup(state.abTestUid, popup.uid, exitDraftPatch(draft))
      const { exit_popup } = await popupApi.publishExitPopup(state.abTestUid, popup.uid)
      replaceInState(exit_popup)
      toast(exit_popup.enabled ? '本番に反映しました' : '本番に反映しました（配信がOFFなので、まだ出ません）')
      return true
    } catch (err: unknown) {
      toast((err as Error).message, 'error')
      return false
    }
  }
  const isDirty = (): boolean => isExitDraftDirty(draft, saved)

  const header = buildPopupEditorHeader({
    status: () => saved.publish_status,
    isDirty,
    onBack: () => {
      editor.remove()
      state.rerender()
    },
    onPreview: () => previewPopup(draft),
    onCheckDraft: () => openDraftCheck(state.abTestUid, popup.uid, async () => (isDirty() ? saveDraft() : true)),
    onSaveDraft: saveDraft,
    onPublish: publish,
    onDuplicate: async () => {
      try {
        const { exit_popup } = await popupApi.duplicateExitPopup(state.abTestUid, popup.uid, popupKindOf(popup))
        state.popups = [...state.popups, exit_popup]
        toast(`「${exit_popup.name}」を作りました（本番反映するまで配信しません）`)
        openEditor(state, exit_popup)
      } catch (err: unknown) {
        toast((err as Error).message, 'error')
      }
    },
    onDelete: async () => {
      try {
        await popupApi.deleteExitPopup(state.abTestUid, popup.uid)
        state.popups = state.popups.filter((p) => p.uid !== popup.uid)
        editor.remove()
        state.rerender()
        toast('ポップアップを削除しました')
      } catch (err: unknown) {
        toast((err as Error).message, 'error')
      }
    },
  })
  editor.append(header.top, header.bar)

  // ── フォーム上部: サムネイル + 配信/名前/割合 ──
  const formTop = el('div', { class: 'ep-form-top' })

  // 中身: 見え方の小さな絵（今の中身そのもの）＋「中身を編集」＝Widget編集と同じ画面
  const presetDef = popup.preset_id !== null ? PRESETS.find((p) => p.id === popup.preset_id) : undefined
  const content = popupContentCard({
    read: () => ({ html: draft.html, css: '' }),
    renderWidth: 500,
    ...(presetDef === undefined ? {} : { emptyArt: presetDef.thumbnailSvg }),
    onEdit: () =>
      openPopupStudio({
        html: draft.html,
        css: '',
        name: draft.name,
        badge: popupKindOf(popup) === 'instant' ? '表示直後' : '離脱防止',
        frame: 'overlay',
        // 「LPの上に重ねて見る」: このABテストのLPを後ろに敷く（読めなければ中身だけ）
        underlay: lpPreviewUrl(state.abTestUid).catch(() => null),
        onSave: async (html) => {
          draft.html = html
          content.refresh()
          const ok = await saveDraft()
          header.refreshStatus()
          return ok
        },
      }),
  })
  formTop.append(content.el)

  const fields = el('div', { class: 'ep-form-fields' })
  fields.append(buildLiveControls(state, popup.uid, () => saved, replaceInState))

  // 名前（下書き反映で保存）
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
      renderEditorTab(body, draft, activeTab)
    })
    tabBar.append(btn)
  }
  editor.append(tabBar)
  editor.append(body)
  renderEditorTab(body, draft, activeTab)

  state.root.append(editor)
}

/**
 * 配信のON/OFFと割合（変えたその場で保存する＝一覧のカードと同じ。下書き・本番に分けない）。
 * 割合がちょうど2つのときは、もう片方が 100−新しい値 に合う（サーバーで計算）。
 */
function buildLiveControls(
  state: PopupPageState,
  uid: string,
  current: () => ExitPopup,
  onSaved: (next: ExitPopup) => void,
): HTMLElement {
  const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:10px' })
  const save = (patch: Partial<ExitPopup>, revert: () => void): void => {
    void popupApi.updateExitPopup(state.abTestUid, uid, patch).then(
      (res) => {
        onSaved(res.exit_popup)
        state.popups = state.popups.map((p) => {
          const sibling = (res.adjusted_siblings ?? []).find((s) => s.uid === p.uid)
          return sibling === undefined ? p : { ...p, ratio: sibling.ratio }
        })
      },
      (err: unknown) => {
        toast((err as Error).message, 'error')
        revert()
      },
    )
  }

  const deliveryRow = el('div', { style: 'display:flex;align-items:center;gap:8px' })
  const toggle = el('button', { class: `ep-toggle${current().enabled ? ' on' : ''}` })
  toggle.type = 'button'
  toggle.setAttribute('aria-label', '配信')
  toggle.addEventListener('click', () => {
    const next = !current().enabled
    toggle.classList.toggle('on', next)
    save({ enabled: next }, () => toggle.classList.toggle('on', current().enabled))
  })
  deliveryRow.append(el('span', { style: 'font-size:13px', text: '配信' }), toggle)
  deliveryRow.append(el('span', { style: `font-size:11px;color:${T.sub}`, text: '配信と割合は、変えるとすぐ反映されます' }))
  wrap.append(deliveryRow)

  const ratioField = el('div', { class: 'ep-field', style: 'margin-bottom:0' })
  ratioField.append(el('label', { text: '割合（%）' }))
  const ratioInput = document.createElement('input')
  ratioInput.type = 'number'
  ratioInput.min = '0'
  ratioInput.max = '100'
  ratioInput.value = String(current().ratio)
  ratioInput.addEventListener('change', () => {
    const n = Math.max(0, Math.min(100, Math.round(Number(ratioInput.value))))
    if (!Number.isFinite(n)) {
      ratioInput.value = String(current().ratio)
      return
    }
    ratioInput.value = String(n)
    save({ ratio: n }, () => { ratioInput.value = String(current().ratio) })
  })
  ratioField.append(ratioInput)
  ratioField.append(el('p', { style: `font-size:11px;color:${T.sub};margin:4px 0 0;line-height:1.6`, text: RATIO_HELP }))
  wrap.append(ratioField)
  return wrap
}

export function previewPopup(popup: ExitPopup | Partial<ExitPopup>): void {
  // 既存プレビューを除去（二重表示防止）
  document.getElementById('ep-preview-overlay')?.remove()
  document.getElementById('ep-preview-style')?.remove()

  // 内部アニメーション用キーフレームを注入
  const styleEl = document.createElement('style')
  styleEl.id = 'ep-preview-style'
  styleEl.textContent = `
    @keyframes epConfettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(400px) rotate(720deg);opacity:0}}
    @keyframes epPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
    @keyframes epBounceIn{0%{opacity:0;transform:scale(.3)}50%{opacity:1;transform:scale(1.05)}70%{transform:scale(.95)}100%{opacity:1;transform:scale(1)}}
  `
  document.head.append(styleEl)

  const overlay = el('div', {
    style: `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;
      display:flex;align-items:center;justify-content:center;font-family:${T.font}`,
  })
  overlay.id = 'ep-preview-overlay'

  const frame = el('div', { style: 'max-width:500px;max-height:80vh;overflow:auto;position:relative' })
  frame.innerHTML = popup.html ?? '<p>プレビューできるHTMLがありません</p>'
  overlay.append(frame)

  const closeHint = el('div', {
    text: 'クリックで閉じる',
    style: 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:#FFFFFF;font-size:13px;opacity:.7',
  })
  overlay.append(closeHint)

  overlay.addEventListener('click', (e) => {
    // frame 内のクリック（ボタン等）は閉じない
    if (frame.contains(e.target as Node)) return
    overlay.remove()
    styleEl.remove()
  })
  document.body.append(overlay)
  // 中身の <script> を動かす（innerHTML では動かない。部品で作った「次へ」で画面②へ移る・見本の動き）。
  // 配信と同じ順番: 中身のスクリプト → ポップアップの動き（下）
  runWidgetScripts(frame)

  // ポップアップのJavaScriptを実行（delivery.ts と同じスコープ変数を提供）
  if (popup.javascript) {
    try {
      const epId = 'ep-preview-overlay'
      // overlay / epId をスコープに入れて実行
      const fn = new Function('overlay', 'epId', popup.javascript)
      fn(overlay, epId)
    } catch (e) {
      console.warn('[ep-preview] JS実行エラー:', e)
    }
  }
  // ep-show イベントを発火して内部アニメを起動
  try { overlay.dispatchEvent(new CustomEvent('ep-show')) } catch (_) { /* noop */ }
}
