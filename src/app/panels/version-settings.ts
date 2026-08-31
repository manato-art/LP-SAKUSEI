/**
 * Version設定モーダル（エディタ右レール5番目の歯車・`MasterStyleSheet`）。
 *
 * **手書きでUIを似せない**（企画書 §11）。
 * モーダルのマークアップは採取した実DOM
 * `capture/clean/ab_tests__UID__articles/tool-version-settings/dom.html` から
 * `ReactModal__Overlay` ごと切り出した `fragments/version-settings-modal.html` をそのまま使い、
 * `data-test` 属性と `name` 属性を目印に「挙動だけ」を後付けする。
 *
 * 実物の見た目は index.html が読み込む採取済み実CSS（/cssom/editor.css）が担保する。
 */
import modalHtml from '../fragments/version-settings-modal.html?raw'
import { toast } from '../ui.ts'

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

/**
 * 右レールの歯車に Version設定モーダルを配線する。
 * 採取した土台に起動ボタンが居ることが前提（居なければ何も配線しない）。
 */
export function mountVersionSettings(root: HTMLElement, articleUid: string): void {
  const opener = root.querySelector<HTMLElement>(HOOK.open)
  if (opener === null) {
    console.warn('[version-settings] 起動ボタン', HOOK.open, 'が土台に見つかりませんでした')
    return
  }
  if (opener.dataset['versionSettingsWired'] === 'true') return
  opener.dataset['versionSettingsWired'] = 'true'
  opener.style.cursor = 'pointer'
  opener.addEventListener('click', () => {
    void openPanel(articleUid)
  })
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
  document.body.append(portal)

  const wrapper = portal.querySelector<HTMLElement>(HOOK.wrapper)
  if (wrapper === null) {
    portal.remove()
    toast('Version設定のマークアップが壊れています（ModalWrapper が無い）', 'error')
    return
  }

  applySheet(wrapper, sheet)

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
 * 背景ラジオ。「画像」「色」の入力欄は未採取のため、選んでも入力先が無いことを正直に伝える
 * （保存済みの値がある場合はその値が維持される）。
 */
function wireBackgroundRadios(wrapper: HTMLElement, sheet: MasterStyleSheet): void {
  for (const group of BACKGROUND_GROUPS) {
    for (const radio of wrapper.querySelectorAll<HTMLInputElement>(
      `input[name="${group.radioName}"]`,
    )) {
      radio.addEventListener('change', () => {
        if (radio.value === 'none' || !radio.checked) return
        const stored = radio.value === 'image' ? sheet[group.imageField] : sheet[group.colorField]
        if (String(stored ?? '') === '') {
          toast(`${group.label}の「${radio.value === 'image' ? '画像' : '色'}」の入力欄は未実装です`, 'error')
        }
      })
    }
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
  for (const group of BACKGROUND_GROUPS) {
    const mode = readBackgroundMode(wrapper, group.radioName)
    payload[group.colorField] = mode === 'color' ? String(sheet[group.colorField] ?? '') : ''
    payload[group.imageField] = mode === 'image' ? String(sheet[group.imageField] ?? '') : ''
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
