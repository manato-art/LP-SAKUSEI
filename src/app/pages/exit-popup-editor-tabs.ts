/**
 * 離脱防止・表示直後ポップアップの編集画面のタブ（exit-popup-editor.ts から分離・2026-09-24）。
 *
 * 5つのタブ（基本 / 表示 / 位置 / 出し分け / コード）。並びは3種類で同じ表（popup-editor-layout.ts）から作り、
 * 表示直後で使えない設定は薄く出す（2026-10-31 案A「3種類を同じ型に」）。追従型は exit-popup-follow-tabs.ts。
 * どのタブも直している途中の形（draft）を書き換えるだけで、保存は編集画面の「保存」が受け持つ（保存したらすぐ配信に出る）。
 * 中身（見た目）は「中身を編集」＝Widget編集と同じ画面。「LPの上で決める」は上のボタンの並び（popup-editor-header.ts）。
 */
import type { ExitPopup } from '../api-popups.ts'
import { T, el } from '../ui.ts'
import { makeSuffixField, makeTextField } from './exit-popup-fields.ts'
import { popupKindOf } from './exit-popup-state.ts'
import { labelOf, renderSettingsTab, setOff, type EditorTab, type SettingRenderers } from './popup-editor-layout.ts'
import { animationField, codeField, deviceField, hint, positionField, scrollField, switchWith, toggleRow } from './popup-editor-parts.ts'
import { popupLinkField } from './popup-link-field.ts'

export function renderEditorTab(body: HTMLElement, draft: ExitPopup, tab: EditorTab): void {
  renderSettingsTab(body, tab, popupKindOf(draft), renderersOf(draft, tab))
}

function renderersOf(draft: ExitPopup, tab: EditorTab): SettingRenderers {
  switch (tab) {
    case 'basic': return basicRenderers(draft)
    case 'display': return displayRenderers(draft)
    case 'position': return { position: () => exitPositionField(draft) }
    case 'device': return { device: () => deviceField(draft) }
    case 'code':
      return {
        code: () =>
          codeField(popupKindOf(draft), {
            javascript: { get: () => draft.javascript, set: (v) => { draft.javascript = v } },
            head_tag: { get: () => draft.head_tag, set: (v) => { draft.head_tag = v } },
            body_tag: { get: () => draft.body_tag, set: (v) => { draft.body_tag = v } },
          }),
      }
  }
}

function basicRenderers(draft: ExitPopup): SettingRenderers {
  // 訪問回数
  const visitField = el('div', { class: 'ep-field' })
  visitField.append(el('label', { text: labelOf('visit_count') }))
  const visitSelect = document.createElement('select')
  for (const opt of [
    { value: 'all', label: '全て' },
    { value: 'first', label: '初回のみ' },
    { value: '2+', label: '2回目以降' },
    { value: '3+', label: '3回目以降' },
  ]) {
    const o = document.createElement('option')
    o.value = opt.value
    o.textContent = opt.label
    if (opt.value === draft.visit_count) o.selected = true
    visitSelect.append(o)
  }
  visitSelect.addEventListener('change', () => { draft.visit_count = visitSelect.value })
  visitField.append(visitSelect)

  // 移行先URL（追従型と同じ欄・指示44）。入力欄は計測の目印を外したきれいな住所で見せる
  const linkField = popupLinkField({ url: draft.link_url, target: draft.link_target === '_self' ? '_self' : '_blank' }, (link) => {
    draft.link_url = link.url
    draft.link_target = link.target
  })
  // 電話番号（動作が「電話をかける」のとき使う）
  const phoneField = makeTextField(labelOf('phone'), draft.phone_number, (v) => { draft.phone_number = v }, '電話番号を入力')
  phoneField.append(hint('「ポップアップを押したときの動作」を「電話をかける」にすると、押した人がこの番号に電話をかけます（数字と + だけを使います）。計測URLは電話をかける前に送ります'))

  // 動作（指示172）: 移行先URLへ移動 / LPに戻る（閉じて元の位置へ・×と同じ）/ 電話をかける。使わない欄は薄くする（隠さない）
  const applyAction = (action: 'link' | 'close' | 'tel'): void => {
    setOff(linkField, action !== 'link')
    setOff(phoneField, action !== 'tel')
  }
  const actionField = makeActionField(draft, (action) => {
    draft.link_action = action
    applyAction(action)
  })
  // 開いただけでは draft を書き換えない（未設定の古いデータを「保存していない変更」にしない）
  applyAction(draft.link_action ?? 'link')

  return {
    visit_count: () => visitField,
    action: () => actionField,
    link: () => linkField,
    phone: () => phoneField,
    // 計測URL（クリックでビーコン発火・複数可）— 画像の「計測URL」と同じ
    tracking_urls: () => makePopupTrackingField(draft),
  }
}

function makeActionField(draft: ExitPopup, onChange: (action: 'link' | 'close' | 'tel') => void): HTMLElement {
  const field = el('div', { class: 'ep-field' })
  field.append(el('label', { text: labelOf('action') }))
  const row = el('div', { style: 'display:flex;align-items:center;gap:16px;margin:2px 0 0;flex-wrap:wrap' })
  const current = draft.link_action ?? 'link'
  for (const opt of [
    // 名前は「移行先URL」（追従型の移行先URLとそろえる・指示44）
    { value: 'link', label: '移行先URLへ移動' },
    { value: 'close', label: 'LPに戻る（閉じて元の位置へ）' },
    { value: 'tel', label: '電話をかける' },
  ] as const) {
    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.name = `ep-action-${draft.uid}`
    radio.value = opt.value
    radio.checked = opt.value === current
    radio.addEventListener('change', () => {
      if (radio.checked) onChange(opt.value)
    })
    // 指示: ラベルは折り返さず横一列に（white-space:nowrap + flex-shrink:0）
    const label = el('label', { style: 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;white-space:nowrap;flex-shrink:0;margin:0;color:inherit' })
    label.append(radio, el('span', { text: opt.label }))
    row.append(label)
  }
  field.append(row)
  return field
}
/** 計測用URL（複数）。クリック時にビーコンを飛ばす。画像の data-tracking-urls と同じ。 */
function makePopupTrackingField(draft: ExitPopup): HTMLElement {
  const field = el('div', { class: 'ep-field' })
  field.append(el('label', { text: labelOf('tracking_urls') }))

  // draft の配列を直接破壊しない（popup とシャローコピーで共有しているため）。編集用に複製する。
  const urls: string[] = [...(draft.tracking_urls ?? [])]
  const commit = (): void => { draft.tracking_urls = urls.filter((u) => u.trim() !== '') }

  const list = el('div', { style: 'display:flex;flex-direction:column;gap:6px' })
  const rebuild = (): void => {
    list.innerHTML = ''
    if (urls.length === 0) urls.push('')
    urls.forEach((u, i) => {
      const row = el('div', { style: 'display:flex;align-items:center;gap:6px' })
      const inp = document.createElement('input')
      inp.type = 'text'
      inp.placeholder = 'https://tracking.example.com/pixel'
      inp.value = u
      inp.style.flex = '1'
      inp.addEventListener('input', () => { urls[i] = inp.value; commit() })
      const rm = el('button', {
        text: '✕',
        style: `flex-shrink:0;width:28px;height:28px;border:none;background:none;color:#E5573F;cursor:pointer;border-radius:4px;font-size:14px`,
      })
      rm.type = 'button'
      rm.addEventListener('click', () => { urls.splice(i, 1); commit(); rebuild() })
      row.append(inp, rm)
      list.append(row)
    })
  }
  rebuild()

  const addBtn = el('button', {
    text: '＋ URLを追加',
    style: `align-self:flex-start;margin-top:6px;padding:4px 0;border:none;background:none;color:${T.primary};cursor:pointer;font-size:12px;font-family:${T.font}`,
  })
  addBtn.type = 'button'
  addBtn.addEventListener('click', () => { urls.push(''); rebuild() })

  field.append(list, addBtn)
  return field
}
function displayRenderers(draft: ExitPopup): SettingRenderers {
  const isInstant = popupKindOf(draft) === 'instant'
  // 開いてから出さない秒数（配信での意味を下に書く＝delivery-popup-html.ts）
  const delayField = makeSuffixField(labelOf('delay'), draft.delay_seconds, '秒', (v) => { draft.delay_seconds = v })
  delayField.append(hint(isInstant
    ? 'LPを開いてから、この秒数がたったら出します'
    : 'LPを開いてからこの秒数のあいだは、離脱で表示（カーソルが画面の上へ抜ける）では出しません'))
  return {
    animation: () => animationField(null, draft.animation, (v) => { draft.animation = v }),
    delay: () => delayField,
    scroll: () =>
      scrollField(draft.scroll_trigger, draft.scroll_position, (on, pct) => {
        draft.scroll_trigger = on
        draft.scroll_position = pct
      }),
    countdown: () =>
      switchWith(
        labelOf('countdown'),
        draft.countdown_trigger,
        makeSuffixField('カウントダウンの秒数', draft.countdown_seconds, '秒', (v) => { draft.countdown_seconds = v }),
        (on) => { draft.countdown_trigger = on },
      ),
    back_button: () => toggleRow(labelOf('back_button'), draft.back_button_trigger, (on) => { draft.back_button_trigger = on }),
    exit_intent: () => toggleRow(labelOf('exit_intent'), draft.exit_trigger, (on) => { draft.exit_trigger = on }),
  }
}

/** 自由座標を最寄りの 0/50/100 に丸める（旧データの互換） */
function snapPos(v: number): number {
  if (v < 25) return 0
  if (v > 75) return 100
  return 50
}

/**
 * 表示位置。実SB準拠で「9分割グリッド（上/中/下 × 左/中/右）」で選ぶ。
 * 保存は既存の position_x / position_y（%）に 0/50/100 でマッピングする。
 */
function exitPositionField(draft: ExitPopup): HTMLElement {
  return positionField({
    grid: { x: snapPos(draft.position_x), y: snapPos(draft.position_y) },
    isFree: draft.free_position !== null,
    usable: () => true,
    wide: () => false,
    onPick: (cell) => {
      draft.position_x = cell.x
      draft.position_y = cell.y
      draft.free_position = null
    },
  })
}
