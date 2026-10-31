/**
 * 追従型ポップアップの編集画面（exit-popup-follow.ts から分離・2026-09-24）。
 *
 * 中身（HTML）は「中身を編集」＝Widget編集と同じ画面で直す。タブは 表示設定 / 出し分け / コード（CSS・JavaScript）。
 * 上の操作（戻る・プレビュー・LPの上で確認・保存・⋯）は離脱防止と同じ popup-editor-header.ts。
 *
 * 「保存」したら、すぐ配信に出る（配信ONのとき・2026-10-31 下書きと本番をやめた）。
 * 配信のON/OFFは変えたその場で保存する（一覧のカードと同じ）。
 */
import { popupApi, type FollowPopup } from '../api-popups.ts'
import { T, el, toast } from '../ui.ts'
import { highlight } from '../panels/syntax-highlight.ts'
import { FOLLOW_PRESETS } from './follow-popup-presets.ts'
import type { PopupPageState } from './exit-popup-state.ts'
import { makeNumberField, updateGutter } from './exit-popup-fields.ts'
import { lpPreviewUrl, openPopupStudio } from '../panels/popup-studio.ts'
import { popupContentCard } from './popup-content-card.ts'
import { runWidgetScripts } from '../panels/widget-run-scripts.ts'
import { buildPopupEditorHeader } from './popup-editor-header.ts'
import { followDraftPatch, isFollowDraftDirty } from './popup-draft.ts'
import { openDraftCheck } from './exit-popup-editor.ts'
import { freeKindOf, freePlaceCss } from '../../shared/follow-free-place.ts'
import { gridPlaceOfFollow, openLpPlacer } from './popup-lp-placer.ts'
import { popupLinkField } from './popup-link-field.ts'

type FollowEditorTab = 'settings' | 'device' | 'code'
const FOLLOW_EDITOR_TABS: readonly { id: FollowEditorTab; label: string }[] = [
  { id: 'settings', label: '表示設定' },
  { id: 'device', label: '出し分け' },
  // 中身の HTML は「中身を編集」＝Widget編集と同じ画面で直す（2026-09-24）。ここは CSS と動きの JavaScript
  { id: 'code', label: 'コード' },
]

/** 表示位置の「つまんで置いた場所」（保存する値ではない。選んでいる間は position も置いた場所もそのまま） */
const FREE_OPTION = 'free'

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

  /** 保存（中身の「ポップアップに反映」も同じ・すぐ配信に出る）。保存できたら true */
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
      // つまんで置いた場所（「ポップアップに反映」で保存する。反映せずに戻れば捨てる）
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
          renderFollowEditorTab(body, draft)
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
  deliveryRow.append(el('span', { style: `font-size:11px;color:${T.sub}`, text: '配信のON/OFFは、変えるとすぐ反映されます' }))
  fields.append(deliveryRow)

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
        renderFollowEditorTab(body, draft)
        toast('決めました。「保存」を押すと配信に出ます')
      },
    })

  // ── タブ ──
  const tabBar = el('div', { class: 'ep-editor-tabs' })
  const body = el('div', { class: 'ep-editor-body' })
  let activeTab: FollowEditorTab = 'settings'

  for (const tab of FOLLOW_EDITOR_TABS) {
    const btn = el('button', { class: `ep-editor-tab${tab.id === activeTab ? ' active' : ''}`, text: tab.label })
    btn.dataset['tab'] = tab.id
    btn.addEventListener('click', () => {
      activeTab = tab.id
      for (const b of tabBar.querySelectorAll('.ep-editor-tab')) b.classList.remove('active')
      btn.classList.add('active')
      renderFollowEditorTab(body, draft)
    })
    tabBar.append(btn)
  }
  editor.append(tabBar)
  editor.append(body)
  renderFollowEditorTab(body, draft)

  state.root.append(editor)

  function renderFollowEditorTab(container: HTMLElement, d: FollowPopup): void {
    container.innerHTML = ''
    switch (activeTab) {
      case 'settings': renderFollowSettingsTab(container, d, openPlacer); break
      case 'device': renderFollowDeviceTab(container, d); break
      case 'code': renderFollowCodeTab(container, d); break
    }
  }
}
function renderFollowSettingsTab(body: HTMLElement, draft: FollowPopup, openPlacer: () => void): void {
  // LP を実際にスクロールして「ここまで読んだら出す」と出す場所を決める（指示39・popup-lp-placer.ts）
  const placer = el('div', { style: 'margin-bottom:16px' })
  const placerBtn = el('button', { class: 'ep-editor-btn-draft', text: 'LPの上で決める' })
  placerBtn.type = 'button'
  placerBtn.addEventListener('click', openPlacer)
  placer.append(
    placerBtn,
    el('p', { style: `margin:6px 0 0;font-size:12px;color:${T.sub}`, text: 'LP を実際にスクロールして「ここまで読んだら出す」と、出す場所（つまんで動かす）を決めます' }),
  )
  body.append(placer)

  // 移行先URL（帯のどこを押してもそこへ移る・指示44）
  body.append(
    popupLinkField({ url: draft.link_url, target: draft.link_target }, (link) => {
      draft.link_url = link.url
      draft.link_target = link.target
    }),
  )

  // 表示位置
  const posField = el('div', { class: 'ep-field' })
  posField.append(el('label', { text: '表示位置' }))
  const posSelect = document.createElement('select')
  const posOptions: { value: string; label: string }[] = [
    { value: 'top', label: '上部（画面上端に固定）' },
    { value: 'bottom', label: '下部（画面下端に固定）' },
    { value: 'bottom-right', label: '右下（フローティング）' },
    { value: 'bottom-left', label: '左下（フローティング）' },
  ]
  for (const opt of posOptions) {
    const o = document.createElement('option')
    o.value = opt.value
    o.textContent = opt.label
    if (opt.value === draft.position && draft.free_position === null) o.selected = true
    posSelect.append(o)
  }
  // つまんで置いた場所（「中身を編集」の「LPの上に重ねて見る」で動かす）。ほかを選ぶと置いた場所を消して、その端に戻す
  if (draft.free_position !== null) {
    const o = document.createElement('option')
    o.value = FREE_OPTION
    o.textContent = 'つまんで置いた場所（「中身を編集」の画面で動かせます）'
    o.selected = true
    posSelect.append(o)
  }
  posSelect.addEventListener('change', () => {
    if (posSelect.value === FREE_OPTION) return
    draft.position = posSelect.value as typeof draft.position
    draft.free_position = null
  })
  posField.append(posSelect)
  body.append(posField)

  // 表示アニメーション
  const animField = el('div', { class: 'ep-field' })
  animField.append(el('label', { text: '表示アニメーション' }))
  const animSelect = document.createElement('select')
  for (const opt of ['slideUp', 'slideDown', 'fade', 'none']) {
    const o = document.createElement('option')
    o.value = opt
    o.textContent = opt
    if (opt === draft.animation) o.selected = true
    animSelect.append(o)
  }
  animSelect.addEventListener('change', () => { draft.animation = animSelect.value })
  animField.append(animSelect)
  body.append(animField)

  // スクロール%で表示
  // LP を何%まで読んだら出すか（0＝開いてすぐ）。名前は離脱防止と同じ「↓まで読んだら表示」（指示40）
  body.append(makeNumberField('↓まで読んだら表示（%・0はすぐ）', draft.show_after_scroll, (v) => { draft.show_after_scroll = v }))

  // 閉じるボタン
  const closeRow = el('div', { class: 'ep-toggle-row' })
  const closeToggle = el('button', { class: `ep-toggle${draft.show_close_button ? ' on' : ''}` })
  closeToggle.addEventListener('click', () => {
    draft.show_close_button = !draft.show_close_button
    closeToggle.classList.toggle('on', draft.show_close_button)
  })
  closeRow.append(closeToggle, el('span', { class: 'ep-toggle-label', text: '閉じるボタンを表示' }))
  body.append(closeRow)
}
function renderFollowDeviceTab(body: HTMLElement, draft: FollowPopup): void {
  body.append(el('div', { class: 'ep-field' }, [el('label', { text: 'デバイス別の表示制御' })]))
  const devices: { key: 'device_sp' | 'device_tablet' | 'device_pc'; label: string }[] = [
    { key: 'device_sp', label: 'スマートフォン (SP)' },
    { key: 'device_tablet', label: 'タブレット' },
    { key: 'device_pc', label: 'PC' },
  ]
  for (const device of devices) {
    const row = el('div', { class: 'ep-device-row' })
    const name = el('div', { class: 'ep-device-name', text: device.label })
    const toggle = el('button', { class: `ep-toggle${draft[device.key] ? ' on' : ''}` })
    toggle.addEventListener('click', () => {
      draft[device.key] = !draft[device.key]
      toggle.classList.toggle('on', draft[device.key])
    })
    row.append(name, toggle)
    body.append(row)
  }
}
/** コード（中身の HTML は「中身を編集」で直す。ここは CSS と動きの JavaScript） */
function renderFollowCodeTab(body: HTMLElement, draft: FollowPopup): void {
  type HtmlSubTab = 'css' | 'javascript'
  const subTabs: { id: HtmlSubTab; label: string }[] = [
    { id: 'css', label: 'CSS' },
    { id: 'javascript', label: 'JavaScript' },
  ]

  let activeSubTab: HtmlSubTab = 'css'
  const tabBar = el('div', { class: 'ep-html-tabs' })
  const editorArea = el('div')

  function renderSubTab(): void {
    editorArea.innerHTML = ''
    const wrap = el('div', { class: 'ep-html-code-wrap' })
    const inner = el('div', { class: 'ep-html-code-inner' })

    const gutter = el('div', { class: 'ep-html-gutter' })
    const content = draft[activeSubTab]
    updateGutter(gutter, content)

    // overlay パターン: pre(ハイライト) + textarea(入力)
    const editorBox = el('div', { class: 'ep-html-editor-box' })
    const pre = document.createElement('pre')
    pre.className = 'ep-html-highlight'
    pre.innerHTML = highlight(content, activeSubTab)

    const textarea = document.createElement('textarea')
    textarea.className = 'ep-html-textarea'
    textarea.spellcheck = false
    textarea.value = content

    const sync = (): void => {
      if (activeSubTab === 'css') draft.css = textarea.value
      else if (activeSubTab === 'javascript') draft.javascript = textarea.value
      pre.innerHTML = highlight(textarea.value, activeSubTab)
      updateGutter(gutter, textarea.value)
    }
    textarea.addEventListener('input', sync)
    textarea.addEventListener('scroll', () => {
      pre.style.transform = `translate(-${textarea.scrollLeft}px,-${textarea.scrollTop}px)`
      gutter.scrollTop = textarea.scrollTop
    })
    textarea.addEventListener('keydown', (ev) => {
      if (ev.key === 'Tab') {
        ev.preventDefault()
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end)
        textarea.selectionStart = textarea.selectionEnd = start + 2
        sync()
      }
    })

    editorBox.append(pre, textarea)
    inner.append(gutter, editorBox)
    wrap.append(inner)
    editorArea.append(wrap)
  }

  for (const sub of subTabs) {
    const btn = el('button', { class: `ep-html-tab${sub.id === activeSubTab ? ' active' : ''}`, text: sub.label })
    btn.addEventListener('click', () => {
      activeSubTab = sub.id
      for (const b of tabBar.querySelectorAll('.ep-html-tab')) b.classList.remove('active')
      btn.classList.add('active')
      renderSubTab()
    })
    tabBar.append(btn)
  }

  body.append(tabBar)
  body.append(editorArea)
  renderSubTab()
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
