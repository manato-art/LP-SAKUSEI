/**
 * Version設定モーダル（エディタ右レール5番目の歯車・`MasterStyleSheet`）。
 *
 * **手書きでUIを似せない**（企画書 §11）。
 * モーダルのマークアップは採取した実DOM（記事設定モーダルの完全版）を
 * `ReactModal__Overlay` ごと切り出した `article-settings-modal.portals.html` を土台にし、
 * `data-test` / `name` 属性を目印に「挙動だけ」を後付けする。
 * 背景の「画像」「色」を選んだときに実物が差し込む入力欄も、状態別の採取物
 * （`article-settings-bg-image` / `-bg-color`）から切り出して使う（手書きしない）。
 *
 * 実物の見た目は index.html が読み込む採取済み実CSS（/cssom/editor.css）が担保する。
 */
// 記事設定モーダルの土台。採取した実物（背景の入力欄まで揃った完全版）を使う。
// 既定状態（設定しない）＝ article-settings-modal、
// 「画像」「色」を選んだときに実物が差し込む入力欄は、それぞれの採取物から切り出して使う。
import modalHtml from '../fragments/ab_tests__UID__articles__article-settings-modal.portals.html?raw'
import bgImageHtml from '../fragments/ab_tests__UID__articles__article-settings-bg-image.portals.html?raw'
import bgColorHtml from '../fragments/ab_tests__UID__articles__article-settings-bg-color.portals.html?raw'
import { toast } from '../ui.ts'

/**
 * 背景ラジオで「画像」「色」を選んだときに実物が差し込む入力欄は、React の条件描画なので
 * 既定の採取物には入っていない。画像状態・色状態それぞれを別途採取してあるので、
 * そこから該当グループ（全体背景/Version背景）の**追加行だけ**を切り出して使う。
 * ＝手書きせず、実物のマークアップを差し込むタイミングだけこちらで制御する（企画書 §11）。
 */
function extractBackgroundExtra(variantHtml: string, radioName: string): string {
  const doc = new DOMParser().parseFromString(variantHtml, 'text/html')
  const radio = doc.querySelector(`input[name="${radioName}"]`)
  const wrap = radio?.closest('[class*="backgroundFormWrapper"]')
  if (wrap === null || wrap === undefined) return ''
  // 先頭の子＝ラジオ行。その後ろに続く要素が「画像/色」を選んだときの追加入力欄。
  return [...wrap.children]
    .slice(1)
    .map((child) => child.outerHTML)
    .join('')
}

/** 採取DOM内の目印（実物の属性。書き換えていない） */
const HOOK = {
  open: '[data-test="MasterStyleSheetModal-BtnOpenModal"]',
  wrapper: '[data-test="MasterStyleSheetModal-ModalWrapper"]',
  save: '[data-test="MasterStyleSheetModal-BtnUpdate"]',
  /** 閉じる（実物のクラス名は綴りが `btnCnacel`。前方一致で拾う） */
  cancel: '[class*="btnCnacel"]',
  overlay: '.ReactModal__Overlay',
} as const

export interface MasterStyleSheet {
  font_size: number | null
  font_family: string
  color: string
  text_align: string
  line_height: number | null
  letter_spacing: number | null
  img_margin_top: number | null
  img_margin_bottom: number | null
  padding_top: number | null
  padding_bottom: number | null
  padding_right: number | null
  padding_left: number | null
  iframe_height: number | null
  iframe_height_unit: string
  delivery_version_width: number | null
  delivery_version_width_unit: string
  border_size: number | null
  border_type: string
  border_color: string
  outer_background_color: string
  outer_background_image: string
  inner_background_color: string
  inner_background_image: string
}

/** 採取DOMに実在する input/select の name（＝そのままAPIのキー） */
const FIELD_NAMES: readonly (keyof MasterStyleSheet)[] = [
  'font_size',
  'font_family',
  'color',
  'line_height',
  'letter_spacing',
  'img_margin_top',
  'img_margin_bottom',
  'padding_top',
  'padding_bottom',
  'padding_right',
  'padding_left',
  'iframe_height',
  'iframe_height_unit',
  'delivery_version_width',
  'delivery_version_width_unit',
  'border_size',
  'border_type',
  'border_color',
]

type BackgroundMode = 'image' | 'color' | 'none'

/**
 * 背景設定はラジオだけが採取できている。
 * 「画像」「色」を選んだときに実物が出す入力欄（カラーピッカー/画像選択）は未採取なので、
 * ここでは **保存済みの値をそのまま保持** し、値の入力自体は未実装であることを明示する。
 */
const BACKGROUND_GROUPS: readonly {
  radioName: string
  label: string
  colorField: keyof MasterStyleSheet
  imageField: keyof MasterStyleSheet
}[] = [
  {
    radioName: 'outerBackgroundRadio',
    label: '全体背景設定',
    colorField: 'outer_background_color',
    imageField: 'outer_background_image',
  },
  {
    radioName: 'innerBackgroundRadio',
    label: 'Version背景設定',
    colorField: 'inner_background_color',
    imageField: 'inner_background_image',
  },
]

/** モックAPI（localhost固定・本番ドメインは登場させない・§3-2） */
const API_BASE = '/api/v1'

interface ActiveModal {
  portal: HTMLElement
  onKeydown: (event: KeyboardEvent) => void
}

let activeModal: ActiveModal | null = null
/** 保存成功時に呼ぶ（編集画面へ即反映するため）。 */
let onSavedCallback: (() => void) | null = null

/**
 * 右レールの歯車に Version設定モーダルを配線する。
 * 採取した土台に起動ボタンが居ることが前提（居なければ何も配線しない）。
 * `onSaved` を渡すと、保存成功のたびに呼ぶ（編集画面の本文へ即反映するのに使う）。
 */
export function mountVersionSettings(
  root: HTMLElement,
  articleUid: string,
  onSaved?: () => void,
): void {
  const opener = root.querySelector<HTMLElement>(HOOK.open)
  if (opener === null) {
    console.warn('[version-settings] 起動ボタン', HOOK.open, 'が土台に見つかりませんでした')
    return
  }
  onSavedCallback = onSaved ?? null
  if (opener.dataset['versionSettingsWired'] === 'true') return
  opener.dataset['versionSettingsWired'] = 'true'
  opener.style.cursor = 'pointer'
  opener.addEventListener('click', () => {
    void openPanel(articleUid)
  })
}

/** アイコンクリックから直接呼べるエントリポイント */
export async function openVersionSettings(articleUid: string): Promise<void> {
  return openPanel(articleUid)
}

async function openPanel(articleUid: string): Promise<void> {
  if (activeModal !== null) return
  let sheet: MasterStyleSheet
  try {
    sheet = await fetchSheet(articleUid)
  } catch (error) {
    toast((error as Error).message, 'error')
    return
  }

  // ReactModal と同じく body 直下のポータルに出す（採取DOMの構造に合わせる）
  const portal = document.createElement('div')
  portal.className = 'ReactModalPortal'
  portal.innerHTML = modalHtml
  // 採取物には ReactModal の遷移用に overlay が2枚含まれることがある。
  // 2枚とも生かすと同じモーダルが重なるので、先頭以外は取り除く。
  const overlays = portal.querySelectorAll(HOOK.overlay)
  for (let i = 1; i < overlays.length; i += 1) overlays[i]?.remove()
  document.body.append(portal)

  const wrapper = portal.querySelector<HTMLElement>(HOOK.wrapper)
  if (wrapper === null) {
    portal.remove()
    toast('Version設定のマークアップが壊れています（ModalWrapper が無い）', 'error')
    return
  }

  applySheet(wrapper, sheet)
  enhanceColorFields(wrapper)
  mountTextAlignButtons(wrapper, sheet.text_align ?? '')

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKeydown)
  activeModal = { portal, onKeydown }

  portal.querySelector<HTMLElement>(HOOK.cancel)?.addEventListener('click', () => {
    close()
  })
  portal.querySelector<HTMLElement>(HOOK.overlay)?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) close()
  })
  wireBackgroundRadios(wrapper, sheet)

  const saveButton = wrapper.querySelector<HTMLElement>(HOOK.save)
  if (saveButton === null) {
    toast('保存ボタンが見つかりません（採取マークアップを確認してください）', 'error')
    return
  }
  saveButton.addEventListener('click', () => {
    void save(articleUid, wrapper, sheet)
  })
}

function close(): void {
  if (activeModal === null) return
  document.removeEventListener('keydown', activeModal.onKeydown)
  activeModal.portal.remove()
  activeModal = null
}

/** 取得した値を、採取した入力欄（name属性）へ流し込む */
function applySheet(wrapper: HTMLElement, sheet: MasterStyleSheet): void {
  for (const name of FIELD_NAMES) {
    const control = findControl(wrapper, name)
    if (control === null) {
      console.warn('[version-settings] 入力欄', name, 'が土台に見つかりませんでした')
      continue
    }
    const value = sheet[name]
    control.value = value === null ? '' : String(value)
  }
  for (const group of BACKGROUND_GROUPS) {
    setBackgroundMode(wrapper, group.radioName, modeOf(sheet, group.colorField, group.imageField))
  }
}

function findControl(
  wrapper: HTMLElement,
  name: keyof MasterStyleSheet,
): HTMLInputElement | HTMLSelectElement | null {
  return wrapper.querySelector<HTMLInputElement | HTMLSelectElement>(
    `input[name="${name}"], select[name="${name}"]`,
  )
}

function modeOf(
  sheet: MasterStyleSheet,
  colorField: keyof MasterStyleSheet,
  imageField: keyof MasterStyleSheet,
): BackgroundMode {
  if (String(sheet[imageField] ?? '') !== '') return 'image'
  if (String(sheet[colorField] ?? '') !== '') return 'color'
  return 'none'
}

function setBackgroundMode(wrapper: HTMLElement, radioName: string, mode: BackgroundMode): void {
  for (const radio of wrapper.querySelectorAll<HTMLInputElement>(`input[name="${radioName}"]`)) {
    radio.checked = radio.value === mode
  }
}

function readBackgroundMode(wrapper: HTMLElement, radioName: string): BackgroundMode {
  const checked = wrapper.querySelector<HTMLInputElement>(`input[name="${radioName}"]:checked`)
  const value = checked?.value ?? 'none'
  return value === 'image' || value === 'color' ? value : 'none'
}

/**
 * 背景ラジオ。「画像」「色」を選ぶと、実物と同じ入力欄（採取物から切り出したマークアップ）を
 * ラジオ行の直後へ差し込み、「設定しない」で取り除く。
 * - 色: カラーコードのテキスト入力。保存時にそのまま送る。
 * - 画像: 実物のドロップゾーン。本番サーバーへは上げず（§3-2）、選んだ画像をその場で
 *   dataURL に読み、`data-image-value` に控えてプレビューする＝クローン内で完結する。
 */
const EXTRA_MARK = 'data-clone-bg-extra'

function wireBackgroundRadios(wrapper: HTMLElement, sheet: MasterStyleSheet): void {
  for (const group of BACKGROUND_GROUPS) {
    const groupWrap = wrapper
      .querySelector<HTMLInputElement>(`input[name="${group.radioName}"]`)
      ?.closest<HTMLElement>('[class*="backgroundFormWrapper"]')
    if (groupWrap === null || groupWrap === undefined) continue

    const render = (mode: BackgroundMode): void => {
      groupWrap.querySelector(`[${EXTRA_MARK}]`)?.remove()
      if (mode === 'none') return
      const source = mode === 'image' ? bgImageHtml : bgColorHtml
      const html = extractBackgroundExtra(source, group.radioName)
      if (html === '') return
      const holder = document.createElement('div')
      holder.setAttribute(EXTRA_MARK, mode)
      holder.style.display = 'contents'
      holder.innerHTML = html
      groupWrap.append(holder)
      wireExtraControls(holder, group, sheet, mode)
    }

    for (const radio of groupWrap.querySelectorAll<HTMLInputElement>(
      `input[name="${group.radioName}"]`,
    )) {
      radio.addEventListener('change', () => {
        if (!radio.checked) return
        render(radio.value === 'image' || radio.value === 'color' ? radio.value : 'none')
      })
    }
    // 初期状態（保存済みの値）に合わせて最初から差し込んでおく
    render(modeOf(sheet, group.colorField, group.imageField))
  }
}

/** 差し込んだ入力欄に初期値を入れ、画像はローカルで dataURL 化してプレビューする。 */
function wireExtraControls(
  holder: HTMLElement,
  group: (typeof BACKGROUND_GROUPS)[number],
  sheet: MasterStyleSheet,
  mode: BackgroundMode,
): void {
  if (mode === 'color') {
    const input = holder.querySelector<HTMLInputElement>(`input[name="${group.colorField}"]`)
    if (input !== null) input.value = String(sheet[group.colorField] ?? '')
    return
  }
  // 画像: 実物の file 入力。本番へ上げず、選んだ画像をその場で dataURL にして控える。
  const stored = String(sheet[group.imageField] ?? '')
  if (stored !== '') holder.dataset['imageValue'] = stored
  const file = holder.querySelector<HTMLInputElement>(`input[type="file"][name="${group.imageField}"]`)
  file?.addEventListener('change', () => {
    const chosen = file.files?.[0]
    if (chosen === undefined) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      holder.dataset['imageValue'] = String(reader.result ?? '')
      toast(`${group.label}の画像を読み込みました`)
    })
    reader.readAsDataURL(chosen)
  })
}

// ── カラーピッカー ──
// `color` と `border_color` のテキスト入力の横にネイティブ `<input type="color">` を付ける。
// 値はテキスト入力と双方向同期する。
const COLOR_FIELDS: readonly (keyof MasterStyleSheet)[] = ['color', 'border_color']

function enhanceColorFields(wrapper: HTMLElement): void {
  for (const name of COLOR_FIELDS) {
    const textInput = findControl(wrapper, name) as HTMLInputElement | null
    if (textInput === null) continue
    const picker = document.createElement('input')
    picker.type = 'color'
    picker.value = normalizeHex(textInput.value)
    picker.style.cssText =
      'width:28px;height:28px;padding:0;border:1px solid #ccc;border-radius:4px;' +
      'cursor:pointer;vertical-align:middle;margin-left:6px;flex-shrink:0'
    picker.addEventListener('input', () => {
      textInput.value = picker.value
    })
    textInput.addEventListener('input', () => {
      const hex = normalizeHex(textInput.value)
      if (hex !== '') picker.value = hex
    })
    // テキスト入力の直後に差し込む
    textInput.parentElement?.insertBefore(picker, textInput.nextSibling)
    // 親がflexなら横並びにする
    if (textInput.parentElement !== null) {
      textInput.parentElement.style.display = 'flex'
      textInput.parentElement.style.alignItems = 'center'
    }
  }
}

/** #000000 形式に正規化（3桁 #abc → #aabbcc 対応、不正な値は空文字） */
function normalizeHex(raw: string): string {
  const s = raw.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`
  }
  return '#000000'
}

// ── テキスト揃え ──
const ALIGN_OPTIONS: readonly { value: string; label: string; icon: string }[] = [
  { value: 'left', label: '左揃え', icon: 'M3 4h18v2H3zm0 4h12v2H3zm0 4h18v2H3zm0 4h12v2H3z' },
  { value: 'center', label: '中央揃え', icon: 'M3 4h18v2H3zm3 4h12v2H6zm-3 4h18v2H3zm3 4h12v2H6z' },
  { value: 'right', label: '右揃え', icon: 'M3 4h18v2H3zm6 4h12v2H9zm-6 4h18v2H3zm6 4h12v2H9z' },
]
/** data属性でcollectPayloadから取得するためのキー */
const ALIGN_DATA_KEY = 'textAlignValue'

function mountTextAlignButtons(wrapper: HTMLElement, currentValue: string): void {
  // `color` 入力の行の直後に挿入する
  const colorInput = findControl(wrapper, 'color')
  const insertAfter = colorInput?.closest('[class*="formGroup"], [class*="row"], div')
  const anchorParent = insertAfter?.parentElement ?? wrapper
  const anchor = insertAfter ?? null

  const row = document.createElement('div')
  row.setAttribute('data-clone-text-align-row', 'true')
  row.style.cssText =
    'display:flex;align-items:center;gap:4px;padding:8px 16px;font-size:12px;color:#666'
  const label = document.createElement('span')
  label.textContent = 'テキスト揃え'
  label.style.cssText = 'min-width:100px;flex-shrink:0'
  row.append(label)

  const group = document.createElement('div')
  group.style.cssText = 'display:flex;gap:2px'

  const active = currentValue || 'left'
  for (const opt of ALIGN_OPTIONS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.title = opt.label
    btn.style.cssText =
      'width:30px;height:28px;display:flex;align-items:center;justify-content:center;' +
      'border:1px solid #ccc;border-radius:4px;cursor:pointer;background:#fff;padding:0'
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('width', '16')
    svg.setAttribute('height', '16')
    svg.setAttribute('fill', 'currentColor')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', opt.icon)
    svg.append(path)
    btn.append(svg)

    if (opt.value === active) {
      btn.style.background = '#e3f2fd'
      btn.style.borderColor = '#2196f3'
      btn.style.color = '#1976d2'
    }
    btn.addEventListener('click', () => {
      row.dataset[ALIGN_DATA_KEY] = opt.value
      // 全ボタンのスタイルをリセットし、押されたものだけアクティブにする
      for (const sibling of group.children) {
        ;(sibling as HTMLElement).style.background = '#fff'
        ;(sibling as HTMLElement).style.borderColor = '#ccc'
        ;(sibling as HTMLElement).style.color = '#333'
      }
      btn.style.background = '#e3f2fd'
      btn.style.borderColor = '#2196f3'
      btn.style.color = '#1976d2'
    })
    group.append(btn)
  }
  row.append(group)
  row.dataset[ALIGN_DATA_KEY] = active

  if (anchor !== null && anchor.nextSibling !== null) {
    anchorParent.insertBefore(row, anchor.nextSibling)
  } else {
    anchorParent.append(row)
  }
}

/** 入力欄の生の文字列をそのまま送り、検証はモックAPI（境界）に任せる */
function collectPayload(wrapper: HTMLElement, sheet: MasterStyleSheet): Record<string, string> {
  const payload: Record<string, string> = {}
  for (const name of FIELD_NAMES) {
    const control = findControl(wrapper, name)
    if (control === null) continue
    payload[name] = control.value.trim()
  }
  // テキスト揃え（DOM直作成のためFIELD_NAMESには無い）
  const alignRow = wrapper.querySelector<HTMLElement>('[data-clone-text-align-row]')
  payload['text_align'] = alignRow?.dataset[ALIGN_DATA_KEY] ?? ''
  for (const group of BACKGROUND_GROUPS) {
    const mode = readBackgroundMode(wrapper, group.radioName)
    const holder = wrapper
      .querySelector<HTMLInputElement>(`input[name="${group.radioName}"]`)
      ?.closest<HTMLElement>('[class*="backgroundFormWrapper"]')
      ?.querySelector<HTMLElement>(`[${EXTRA_MARK}]`)
    // 色: 差し込んだテキスト入力の生値。画像: file→dataURL を控えた data-image-value。
    const colorValue =
      holder?.querySelector<HTMLInputElement>(`input[name="${group.colorField}"]`)?.value ??
      String(sheet[group.colorField] ?? '')
    const imageValue = holder?.dataset['imageValue'] ?? String(sheet[group.imageField] ?? '')
    payload[group.colorField] = mode === 'color' ? colorValue.trim() : ''
    payload[group.imageField] = mode === 'image' ? imageValue : ''
  }
  return payload
}

async function save(
  articleUid: string,
  wrapper: HTMLElement,
  sheet: MasterStyleSheet,
): Promise<void> {
  const saveButton = wrapper.querySelector<HTMLElement>(HOOK.save)
  if (saveButton === null) return
  if (saveButton.dataset['busy'] === 'true') return
  saveButton.dataset['busy'] = 'true'
  saveButton.style.opacity = '0.6'
  try {
    await requestJson<{ master_style_sheet: MasterStyleSheet }>(
      'PUT',
      `/articles/${articleUid}/master_style_sheet`,
      collectPayload(wrapper, sheet),
    )
    toast('Version設定を保存しました')
    onSavedCallback?.() // 編集画面の本文へ即反映
    close()
  } catch (error) {
    toast((error as Error).message, 'error')
    saveButton.dataset['busy'] = 'false'
    saveButton.style.opacity = '1'
  }
}

async function fetchSheet(articleUid: string): Promise<MasterStyleSheet> {
  const body = await requestJson<{ master_style_sheet: MasterStyleSheet }>(
    'GET',
    `/articles/${articleUid}/master_style_sheet`,
  )
  return body.master_style_sheet
}

async function requestJson<T>(method: 'GET' | 'PUT', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const json = (await res.json().catch(() => null)) as
    | ({ error?: { message?: string } } & T)
    | null
  if (!res.ok || json === null) {
    throw new Error(json?.error?.message ?? `Version設定の${method === 'GET' ? '取得' : '保存'}に失敗しました (${res.status})`)
  }
  return json
}
