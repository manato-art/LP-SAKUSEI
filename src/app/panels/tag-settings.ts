/**
 * 「タグ設定」モーダル（右レール6番・`data-test="HtmlSettingModal-BtnOpenModal"`）。
 *
 * **手書きでUIを似せない（企画書 §11）。**
 * 下の MARKUP は `capture/clean/ab_tests__UID__articles/tool-tag-settings/dom.html` から
 * `HtmlSettingModal-ModalWrapper` を含む ReactModalPortal を切り出した**実マークアップ**。
 * クラス名（`_modal_11n4w_1` `_contents_obetg_6` `_settings_5e523_1` …）をそのまま残しているので、
 * `/cssom/editor.css`（採取した実CSS）がそのまま効く。ここでは挙動だけを付ける。
 *
 * 実マークアップから変えている箇所は、CodeMirrorを差し替えた1箇所とオーバーレイの中央寄せの計2つ。
 * 以前はここに `width:100%` と `role="switch"` も足していたが、どちらも実物に無い。
 * 実物に無い属性を足すと「実物がそうなっている」と誤読されるので消した。
 *  1. 個別設定のコードエディタ。実物は CodeMirror だが、依存追加は配線担当の判断が要るので
 *     `<textarea>` + 行番号ガターの簡易実装に差し替えた（CodeMirror のクラス名と寸法は踏襲）。
 *  2. オーバーレイの中央寄せ。react-modal が実行時に付けるインラインstyleは採取物に残らないため、
 *     `display:flex` での中央寄せをこちらで補っている（唯一の寸法の推測箇所）。
 */
import { toast } from '../ui.ts'

const BASE = '/api/v1'

/** タグ設定1件（実APIの Article.html_tags[] と同じ形） */
interface HtmlTag {
  tag: string
  document_property: 'head' | 'body'
  body: string
}

interface HtmlSettingResponse {
  html_tags: HtmlTag[]
  noindex: boolean
}

/** 採取DOM内の目印（実物の data-test / 実クラス名） */
const HOOK = {
  open: '[data-test="HtmlSettingModal-BtnOpenModal"]',
  wrapper: '[data-test="HtmlSettingModal-ModalWrapper"]',
  close: '[data-test="HtmlSettingModal-BtnCloseModal"]',
  save: '[data-test="HtmlSettingModal-BtnUpdateScriptTag"]',
  toggle: '[class*="toggleSwitchWrapper"]',
  scriptField: '[data-script-property]',
} as const

/** 実CSSの状態クラス（capture/clean/.../tool-tag-settings/cssom.css より） */
const STATE_CLASS = {
  /** `._alert_obetg_42 ._scriptModalFormTitle_obetg_29::after { content: " タグが正しく閉じられてません。" }` */
  alert: '_alert_obetg_42',
  toggleOn: '_checked_bq5w4_4',
  toggleOff: '_unchecked_bq5w4_5',
} as const

/** 個別設定の欄は head / body の2つ。実物のクラス名 `textScriptHead` / `textScriptBody` が目印 */
const SCRIPT_FIELDS = [
  { property: 'head', title: 'JavaScript head', cssHook: 'textScriptHead' },
  { property: 'body', title: 'JavaScript body', cssHook: 'textScriptBody' },
] as const

/** 個別設定で保存するタグ種別（モーダルの見出しが「JavaScript …」なので script） */
const SCRIPT_TAG = 'script'

const LINE_HEIGHT_PX = 22.4
const GUTTER_WIDTH_PX = 45

/**
 * 行番号付きコードエディタ。実物の CodeMirror のクラス名（`cm-s-ayu-dark` 等）を残して
 * 実CSSのダーク配色をそのまま使い、中身だけ textarea + 行番号ガターにしている。
 */
function scriptFieldMarkup(field: (typeof SCRIPT_FIELDS)[number]): string {
  return `<div class="sample_token_a947debf" data-script-property="${field.property}">
<div class="_scriptModalFormTitle_obetg_29">${field.title}</div>
<div class="react-codemirror2 _scriptModalTextArea_obetg_34 ${field.cssHook}">
<div class="CodeMirror cm-s-ayu-dark CodeMirror-wrap CodeMirror-simplescroll" translate="no" style="height:100%;border-radius:10px">
<div class="CodeMirror-gutters" style="width:${GUTTER_WIDTH_PX}px;height:100%;overflow:hidden">
<div class="CodeMirror-gutter CodeMirror-linenumbers" data-role="line-numbers" style="width:29px;padding-top:4px"></div>
</div>
<textarea data-role="code" spellcheck="false" autocorrect="off" autocapitalize="off" placeholder="&lt;script&gt; ... &lt;/script&gt;" style="position:absolute;top:0;bottom:0;left:${GUTTER_WIDTH_PX}px;right:0;box-sizing:border-box;padding:4px;margin:0;border:none;outline:none;resize:none;background:transparent;color:inherit;font-family:monospace;font-size:14px;line-height:${LINE_HEIGHT_PX}px;white-space:pre;overflow:auto"></textarea>
</div>
</div>
</div>`
}

/** 採取した実マークアップ（コードエディタ部だけ上の簡易実装に差し替え） */
const MARKUP = `<div class="ReactModalPortal">
<div class="ReactModal__Overlay ReactModal__Overlay--after-open _overlay_11n4w_118" style="display:flex;align-items:center;justify-content:center">
<div class="ReactModal__Content ReactModal__Content--after-open _modal_11n4w_1 _darkTheme_11n4w_23" tabindex="-1" role="dialog" aria-modal="true" style="max-width: 1000px;">
<div class="_modalWrapper_11n4w_20" data-test="HtmlSettingModal-ModalWrapper">
<div class="_modalHeader_11n4w_20">
<div class="_left_11n4w_55"><div data-test="HtmlSettingModal-BtnCloseModal" class="_btnCnacel_1bcs1_140 sample_token_44b6d400"></div></div>
<div class="_center_11n4w_56"><div class="_title_11n4w_70">タグ設定</div></div>
<div class="_right_11n4w_57"><div data-test="HtmlSettingModal-BtnUpdateScriptTag" class="_btn_1bcs1_2 _btnDarkThemePrimary_1bcs1_78 _btnSmall_1bcs1_32 _btnAlignRight_1bcs1_53 ">保存</div></div>
</div>
<div class="_contents_obetg_6">
<div class="_heading_3cs34_1">
<div class="_headingTitle_3cs34_7">一括タグ設定</div>
<div class="_headingNotes_3cs34_11">一括タグ設定のタグは一括タグ設定で管理できます</div>
</div>
<div class="_tagLists_3cs34_19">
<div><div class="_header_3cs34_72">HEAD</div><ul class="_unstyled_1ahjy_1 "></ul></div>
<div><div class="_header_3cs34_72">body</div><ul class="_unstyled_1ahjy_1 "></ul></div>
</div>
<div><div>メタタグ設定</div></div>
<div class="_settings_5e523_1">
<div class="_setting_5e523_1">
<div>
<div class="_toggleSwitchWrapper_bq5w4_1 undefined _blue_bq5w4_124 ">
<div class="_checked_bq5w4_4">
<div class="_checkedLabel_bq5w4_19"></div>
<div class="_mark_bq5w4_36"></div>
<div class="_uncheckedLabel_bq5w4_20"></div>
</div>
</div>
</div>
<div>
<div>noindexを含める</div>
<div class="_description_5e523_17">一括タグ設定のメタタグ設定で「noindexを含める」としていた場合、noindexは含まれます。</div>
</div>
</div>
</div>
<div><div>個別設定</div></div>
${SCRIPT_FIELDS.map(scriptFieldMarkup).join('\n')}
</div>
</div>
</div>
</div>
</div>`

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const json = (await res.json().catch(() => null)) as
    | (T & { error?: { code?: string; message?: string } })
    | null
  if (!res.ok) {
    const failure = new TagSettingsError(
      json?.error?.message ?? `タグ設定の通信に失敗しました (${res.status})`,
      json?.error?.code ?? 'unknown',
    )
    throw failure
  }
  if (json === null) throw new TagSettingsError('タグ設定の応答が読めませんでした。', 'unknown')
  return json
}

/** エラー封筒の code を保ったまま投げる（どちらの欄が不正かをフロントで使う） */
class TagSettingsError extends Error {
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'TagSettingsError'
    this.code = code
  }
}

/**
 * 右レールの `</>`（タグ設定）にモーダルを配線する。
 * @param root 採取DOMを描画した要素（この中に BtnOpenModal がある）
 * @param articleUid 開いている記事のuid
 */
export function mountTagSettings(root: HTMLElement, articleUid: string): void {
  const trigger = root.querySelector<HTMLElement>(HOOK.open)
  if (trigger === null) return
  trigger.style.cursor = 'pointer'
  trigger.addEventListener('click', () => {
    void openTagSettings(articleUid)
  })
}

/** 二重に開かないための現在のモーダル */
let openPortal: HTMLElement | null = null

export async function openTagSettings(articleUid: string): Promise<void> {
  if (openPortal !== null) return

  let setting: HtmlSettingResponse
  try {
    setting = await request<HtmlSettingResponse>('GET', `/articles/${articleUid}/html_tags`)
  } catch (error) {
    toast((error as Error).message, 'error')
    return
  }

  const portal = document.createElement('div')
  portal.innerHTML = MARKUP
  const node = portal.firstElementChild
  if (node === null) return
  document.body.append(node)
  openPortal = node as HTMLElement

  const wrapper = openPortal.querySelector<HTMLElement>(HOOK.wrapper)
  if (wrapper === null) return

  const close = (): void => {
    openPortal?.remove()
    openPortal = null
    document.removeEventListener('keydown', onKeydown)
  }
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKeydown)

  wrapper.querySelector<HTMLElement>(HOOK.close)?.addEventListener('click', close)

  const noindex = wireNoindexToggle(wrapper, setting.noindex)
  const editors = wireScriptEditors(wrapper, setting.html_tags)

  wrapper.querySelector<HTMLElement>(HOOK.save)?.addEventListener('click', () => {
    void save(articleUid, wrapper, noindex, editors, close)
  })
}

interface ScriptEditor {
  property: 'head' | 'body'
  field: HTMLElement
  textarea: HTMLTextAreaElement
}

/** noindexトグル。実物の状態クラス（_checked_ / _unchecked_）を差し替えて表す */
function wireNoindexToggle(wrapper: HTMLElement, initial: boolean): { isOn: () => boolean } {
  const host = wrapper.querySelector<HTMLElement>(HOOK.toggle)
  const knob = host?.firstElementChild as HTMLElement | null | undefined
  let on = initial
  const paint = (): void => {
    if (knob === null || knob === undefined) return
    knob.className = on ? STATE_CLASS.toggleOn : STATE_CLASS.toggleOff
    knob.setAttribute('aria-checked', String(on))
  }
  paint()
  knob?.addEventListener('click', () => {
    on = !on
    paint()
  })
  knob?.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    on = !on
    paint()
  })
  return { isOn: () => on }
}

/** 個別設定の2欄に保存済みの値を流し込み、行番号を配線する */
function wireScriptEditors(wrapper: HTMLElement, tags: readonly HtmlTag[]): ScriptEditor[] {
  const editors: ScriptEditor[] = []
  for (const field of wrapper.querySelectorAll<HTMLElement>(HOOK.scriptField)) {
    const property = field.dataset['scriptProperty']
    if (property !== 'head' && property !== 'body') continue
    const textarea = field.querySelector<HTMLTextAreaElement>('[data-role="code"]')
    const gutter = field.querySelector<HTMLElement>('[data-role="line-numbers"]')
    if (textarea === null || gutter === null) continue

    // 値は必ず value に入れる（innerHTML には決して入れない＝貼り付けたscriptを実行させない）
    textarea.value = tags.find((t) => t.document_property === property)?.body ?? ''

    const paint = (): void => paintLineNumbers(gutter, textarea)
    paint()
    textarea.addEventListener('input', () => {
      field.classList.remove(STATE_CLASS.alert)
      paint()
    })
    textarea.addEventListener('scroll', () => {
      gutter.style.transform = `translateY(${-textarea.scrollTop}px)`
    })

    editors.push({ property, field, textarea })
  }
  return editors
}

/** 行番号ガターを描き直す（textContent のみ・HTMLは組み立てない） */
function paintLineNumbers(container: HTMLElement, textarea: HTMLTextAreaElement): void {
  const count = textarea.value.split('\n').length
  if (container.childElementCount === count) return
  container.textContent = ''
  for (let i = 1; i <= count; i += 1) {
    const line = document.createElement('div')
    line.className = 'CodeMirror-linenumber CodeMirror-gutter-elt'
    line.textContent = String(i)
    line.style.cssText = `line-height:${LINE_HEIGHT_PX}px;position:static`
    container.append(line)
  }
}

async function save(
  articleUid: string,
  wrapper: HTMLElement,
  noindex: { isOn: () => boolean },
  editors: readonly ScriptEditor[],
  close: () => void,
): Promise<void> {
  for (const editor of editors) editor.field.classList.remove(STATE_CLASS.alert)

  const html_tags: HtmlTag[] = editors
    .filter((e) => e.textarea.value.trim() !== '')
    .map((e) => ({ tag: SCRIPT_TAG, document_property: e.property, body: e.textarea.value }))

  const button = wrapper.querySelector<HTMLElement>(HOOK.save)
  const label = button?.textContent ?? '保存'
  if (button !== undefined && button !== null) button.textContent = '保存中…'

  try {
    await request<HtmlSettingResponse>('PUT', `/articles/${articleUid}/html_tags`, {
      html_tags,
      noindex: noindex.isOn(),
    })
    toast('タグ設定を保存しました')
    close()
  } catch (error) {
    // サーバーが返した code から、どちらの欄を赤くするか決める（実CSSのアラート状態）
    const code = error instanceof TagSettingsError ? error.code : 'unknown'
    const target = editors.find((e) => code === `invalid_script_${e.property}`)
    target?.field.classList.add(STATE_CLASS.alert)
    toast((error as Error).message, 'error')
    if (button !== undefined && button !== null) button.textContent = label
  }
}
