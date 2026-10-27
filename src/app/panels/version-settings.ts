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
import { readLpVideo } from './nocode/lp-video.ts'
import { paletteField } from './palette-field.ts'
import { bgLookField } from './bg-look-field.ts'
import { isVideoBackground } from '../master-style.ts'
import { convertImageToWebP } from './webp-convert.ts'
import { ensureWhiteBase, stripDarkThemeClasses } from '../white-base.ts'
import { ensureVersionSettingsStyle, LP_SETTINGS_ATTR } from './version-settings-style.ts'

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
  /** 背景の画像の位置と大きさ（クローンが足した項目・bg-look-field.ts・2026-10-27 指示⑱） */
  outer_background_look?: string
  inner_background_look?: string
}

/**
 * 採取DOMに実在する input/select の name（＝そのままAPIのキー）。
 * iframe_height・iframe_height_unit（Iframe設定）は画面から外したので読まない・送らない（removeIframeSection・保存してある値はサーバーにそのまま残る）
 */
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
  lookField: 'inner_background_look' | 'outer_background_look'
  kind: 'inner' | 'outer'
}[] = [
  // 見出しの名前と並び（2026-10-27 本人「Version背景設定→LP内背景・全体背景設定→外枠背景」「順番も逆にしてね」）。
  // 採取した実物は「全体背景設定」「Version背景設定」の順。画面ではこの並び・この名前にする（arrangeBackgroundSections）
  {
    radioName: 'innerBackgroundRadio',
    label: 'LP内背景',
    colorField: 'inner_background_color',
    imageField: 'inner_background_image',
    lookField: 'inner_background_look',
    kind: 'inner',
  },
  {
    radioName: 'outerBackgroundRadio',
    label: '外枠背景',
    colorField: 'outer_background_color',
    imageField: 'outer_background_image',
    lookField: 'outer_background_look',
    kind: 'outer',
  },
]

/**
 * 背景の見出しを BACKGROUND_GROUPS の名前にし、その並びに置き直す（見出し＋すぐ下の選択肢をひと組で動かす）。
 * ひと組ずつ枠（.lp-bg-box）に入れ、2つの枠を横に並べる（.lp-bg-row・2026-10-27 LP設定の作り直し＝見本の画像）
 */
function arrangeBackgroundSections(wrapper: HTMLElement): void {
  const sections = BACKGROUND_GROUPS.flatMap((group) => {
    const groupWrap = wrapper
      .querySelector<HTMLInputElement>(`input[name="${group.radioName}"]`)
      ?.closest<HTMLElement>('[class*="backgroundFormWrapper"]')
    const title = groupWrap?.previousElementSibling
    if (groupWrap === null || groupWrap === undefined || title === null || title === undefined) return []
    title.textContent = group.label
    return [[title, groupWrap] as const]
  })
  const wraps = wrapper.querySelectorAll('[class*="backgroundFormWrapper"]')
  const parent = wraps[0]?.parentElement
  if (sections.length !== BACKGROUND_GROUPS.length || parent === null || parent === undefined) {
    console.warn('[version-settings] 背景の見出しが土台に見つかりませんでした')
    return
  }
  // 背景の組のすぐ後ろ（動かさない所）を目印に、決めた並びで入れ直す
  const after = wraps[wraps.length - 1]?.nextSibling ?? null
  const row = document.createElement('div')
  row.className = 'lp-bg-row'
  for (const [title, groupWrap] of sections) {
    const box = document.createElement('div')
    box.className = 'lp-bg-box'
    box.append(title, groupWrap)
    row.append(box)
  }
  parent.insertBefore(row, after)
}

/** モックAPI（localhost固定・本番ドメインは登場させない・§3-2） */
const API_BASE = '/api/v1'

interface ActiveModal {
  portal: HTMLElement
  onKeydown: (event: KeyboardEvent) => void
}

/**
 * LP設定を読み書きする Version（2026-10-27 本人「LP設定なんだけど、各バージョンごとに分けたい」）。
 * 渡さなければページ（ステップ）共通の設定を読み書きする（自分の設定を持たない Version が使う物）
 */
export interface SettingsVersion {
  readonly uid: string
  readonly name: string
}

let activeModal: ActiveModal | null = null
/**
 * 設定を読み込んでいる間か。右の「LP設定」のアイコンには開く処理が2つ付いている（採取した歯車の目印と、右のアイコンの並び）ので、
 * 読み込みの間に2回目が通ると同じ画面が2枚重なり、保存しても古い値の1枚が残っていた（2026-10-27）
 */
let opening = false
/** 保存成功時に呼ぶ（編集画面へ即反映するため）。 */
let onSavedCallback: (() => void) | null = null

/**
 * 右レールの歯車に Version設定モーダルを配線する。
 * 採取した土台に起動ボタンが居ることが前提（居なければ何も配線しない）。
 * `target` は押したときの「今のステップと Version」を返す（ステップ・Version を切り替えても、その時の物を開く）。
 * `onSaved` を渡すと、保存成功のたびに呼ぶ（編集画面の本文へ即反映するのに使う）。
 */
export function mountVersionSettings(
  root: HTMLElement,
  target: () => { articleUid: string; version?: SettingsVersion },
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
    const now = target()
    void openPanel(now.articleUid, now.version)
  })
}

/** アイコンクリックから直接呼べるエントリポイント（version を渡すと、その Version の設定） */
export async function openVersionSettings(articleUid: string, version?: SettingsVersion): Promise<void> {
  return openPanel(articleUid, version)
}

async function openPanel(articleUid: string, version: SettingsVersion | undefined): Promise<void> {
  if (activeModal !== null || opening) return
  opening = true
  let sheet: MasterStyleSheet
  try {
    sheet = await fetchSheet(articleUid, version)
  } catch (error) {
    toast((error as Error).message, 'error')
    return
  } finally {
    opening = false
  }

  // ReactModal と同じく body 直下のポータルに出す（採取DOMの構造に合わせる）
  ensureWhiteBase()
  ensureVersionSettingsStyle()
  const portal = document.createElement('div')
  portal.className = 'ReactModalPortal'
  portal.setAttribute(LP_SETTINGS_ATTR, '')
  portal.innerHTML = modalHtml
  // 指示116: 採取物のダークテーマクラスを除去し白基調にする
  stripDarkThemeClasses(portal)
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

  removeIframeSection(wrapper)
  applySheet(wrapper, sheet)
  arrangeBackgroundSections(wrapper)
  mountPaletteFields(wrapper)
  mountTextAlignButtons(wrapper, sheet.text_align ?? '')
  if (version !== undefined) mountVersionScope(wrapper, version)

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
    toast('保存ボタンが見つかりません。画面を開き直してください。', 'error')
    return
  }
  saveButton.addEventListener('click', () => {
    void save(articleUid, version, wrapper, sheet)
  })
}

/**
 * 「Iframe設定」（見出し・高さ・単位）を外す（2026-10-27 本人「Iframe設定って何？わかりずらいので修正」→「項目ごと消す」）。
 * 高さ・単位は保存していたが、編集画面・プレビュー・配信のどこにも効いていなかった。保存してある値は送らないのでサーバーに残る
 */
function removeIframeSection(wrapper: HTMLElement): void {
  const groups = ['iframe_height', 'iframe_height_unit'].map((name) =>
    wrapper.querySelector(`[name="${name}"]`)?.closest<HTMLElement>('[class*="_formGroup_1n7ll_1"]'),
  )
  const title = groups[0]?.previousElementSibling
  if (title instanceof HTMLElement && (title.textContent ?? '').includes('Iframe')) title.remove()
  for (const group of groups) group?.remove()
}

/** 「他のバージョンにも適用する」のチェックの印 */
const APPLY_OTHERS_ATTR = 'data-apply-other-versions'

/**
 * Version ごとの LP設定（2026-10-27）。題名の下にどの Version の設定かを出し、いちばん下に「他のバージョンにも適用する」を置く。
 * チェックは最初は外れている（本人の決定）。入れて保存すると、このページのほかの Version（アーカイブ済みを除く）にも同じ設定が入る
 */
function mountVersionScope(wrapper: HTMLElement, version: SettingsVersion): void {
  const title = wrapper.querySelector<HTMLElement>('[class*="_title_11n4w_70"]')
  if (title !== null) {
    const name = document.createElement('div')
    name.setAttribute('data-lp-settings-version', '')
    name.className = 'lp-settings-version'
    name.textContent = `${version.name} の設定`
    title.after(name)
  }
  const content = wrapper.querySelector<HTMLElement>('[class*="_modalContent_11n4w_79"]')
  if (content === null) return
  const row = document.createElement('label')
  row.setAttribute(APPLY_OTHERS_ATTR, '')
  row.className = 'lp-apply-others'
  const box = document.createElement('input')
  box.type = 'checkbox'
  box.checked = false
  const text = document.createElement('span')
  text.className = 'lp-apply-others__text'
  const main = document.createElement('span')
  main.className = 'lp-apply-others__label'
  main.textContent = '他のバージョンにも適用する'
  const note = document.createElement('span')
  note.className = 'lp-apply-others__note'
  note.textContent = 'チェックを入れて保存すると、このページのほかのVersionにも同じ設定が入ります（アーカイブ済みのVersionには入れません）'
  text.append(main, note)
  row.append(box, text)
  content.append(row)
}

/** 「他のバージョンにも適用する」にチェックが入っているか */
const isApplyToOthers = (wrapper: HTMLElement): boolean =>
  wrapper.querySelector<HTMLInputElement>(`[${APPLY_OTHERS_ATTR}] input[type="checkbox"]`)?.checked ?? false

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
 * - 色: パレット（押すと色選びが開く欄・palette-field.ts）。選んだ色のコードを保存時にそのまま送る。
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
    if (input === null) return
    input.value = String(sheet[group.colorField] ?? '')
    paletteField(input, { withHash: false, fallback: 'ffffff' })
    return
  }
  // 画像: 実物の file 入力。選んだファイルをその場で dataURL にして控える（保存のときサーバーが別ファイルにする・2026-10-27）。
  // 動画も選べる（2026-10-27 本人「記事設定の背景も動画OKにする」・自動で再生・音なし・くり返し＝master-style.ts）
  const stored = String(sheet[group.imageField] ?? '')
  if (stored !== '') holder.dataset['imageValue'] = stored
  holder.dataset['bgLook'] = sheet[group.lookField] ?? ''
  const file = holder.querySelector<HTMLInputElement>(`input[type="file"][name="${group.imageField}"]`)
  const zone = file?.parentElement
  if (file === null || zone === null || zone === undefined) return
  file.accept = 'image/*,video/mp4,video/webm'
  const hint = zone.querySelector<HTMLElement>(':scope > div')
  // 今入っている画像・動画を枠の中に小さく見せる（2026-10-27 本人「はい」＝今どれが入っているか画面に出なかった）
  const show = (): void => {
    const value = holder.dataset['imageValue'] ?? ''
    showBackgroundPreview(zone, value)
    if (hint !== null) {
      hint.textContent =
        value === ''
          ? 'クリックして画像か動画を選択するかファイルをドラッグ&ドロップしてください（動画は自動で再生・音なし・くり返し）'
          : 'クリックかドラッグ&ドロップで、別の画像か動画に変えられます（動画は自動で再生・音なし・くり返し）'
    }
    // 画像なら、その下に「位置と大きさ」（2026-10-27 指示⑱・動画は今までどおり全体を覆う）
    holder.querySelector('[data-bg-look-field]')?.remove()
    if (value === '' || isVideoBackground(value)) return
    // 枠の入れ物は横並び（flex）なので、入れ物の下に置く
    ;(zone.parentElement ?? zone).after(
      bgLookField({
        src: value,
        look: holder.dataset['bgLook'] ?? '',
        kind: group.kind,
        onChange: (look) => {
          holder.dataset['bgLook'] = look
        },
      }),
    )
  }
  show()

  const use = (chosen: File): void => {
    if (chosen.type.startsWith('video/')) {
      void readLpVideo(chosen).then((url) => {
        if (url === null) return
        holder.dataset['imageValue'] = url
        holder.dataset['bgLook'] = ''
        show()
        toast(`${group.label}の動画を読み込みました`)
      })
      return
    }
    // 本文に入れる画像と同じく WebP にしてから（保存で別ファイルにできる形にそろえる）
    void convertImageToWebP(chosen).then((url) => {
      if (url === '') {
        toast('画像を読み込めませんでした', 'error')
        return
      }
      holder.dataset['imageValue'] = url
      // 別の画像に変えたら、位置と大きさは最初（全体を覆う・真ん中）から
      holder.dataset['bgLook'] = ''
      show()
      toast(`${group.label}の画像を読み込みました`)
    })
  }
  file.addEventListener('change', () => {
    const chosen = file.files?.[0]
    if (chosen !== undefined) use(chosen)
  })
  // 採取した枠は見た目だけ（file 入力は画面の外）で、押しても落としても何も起きなかった。押す＝ファイルを選ぶ・落とす＝そのファイル
  zone.style.cursor = 'pointer'
  zone.addEventListener('click', (event) => {
    if (event.target !== file) file.click()
  })
  zone.addEventListener('dragover', (event) => {
    event.preventDefault()
    zone.style.background = 'var(--sb-c-f5f5f5, #F5F5F5)'
  })
  zone.addEventListener('dragleave', () => {
    zone.style.background = ''
  })
  zone.addEventListener('drop', (event) => {
    event.preventDefault()
    zone.style.background = ''
    const chosen = event.dataTransfer?.files[0]
    if (chosen !== undefined) use(chosen)
  })
}

const PREVIEW_MARK = 'data-bg-preview'

/** 背景の「画像」の枠の中に、今の画像・動画を小さく見せる（無ければ外す）。押す・落とすの邪魔をしない */
function showBackgroundPreview(zone: HTMLElement, value: string): void {
  zone.querySelector(`[${PREVIEW_MARK}]`)?.remove()
  // 採取した枠は上下80pxの余白で文字を1行出す形。見本があるときは縦に並べ、余白を詰める
  for (const [name, withPreview] of [['flex-direction', 'column'], ['gap', '8px'], ['padding', '16px 0']] as const) {
    if (value === '') zone.style.removeProperty(name)
    else zone.style.setProperty(name, withPreview)
  }
  if (value === '') return
  const preview = document.createElement(isVideoBackground(value) ? 'video' : 'img')
  preview.setAttribute(PREVIEW_MARK, '')
  preview.setAttribute('src', value)
  preview.setAttribute('alt', '今の背景')
  if (preview.tagName === 'VIDEO') {
    for (const name of ['muted', 'autoplay', 'loop', 'playsinline']) preview.setAttribute(name, '')
    // 後から作った動画は、muted の属性だけでは音なしにならない（自動で再生されない）
    ;(preview as HTMLVideoElement).muted = true
  }
  preview.style.cssText =
    'display:block;max-width:240px;max-height:140px;object-fit:contain;border:1px solid var(--sb-c-dddddd, #DDDDDD);' +
    'border-radius:4px;background:var(--sb-c-ffffff, #FFFFFF);pointer-events:none'
  zone.prepend(preview)
}

// ── 色（文字色・枠線の色）──
// カラーコードの欄を、押すとパレットが開く欄にする（2026-10-27 本人「カラーコードではなくパレットで」・palette-field.ts）
const COLOR_FIELDS: readonly (keyof MasterStyleSheet)[] = ['color', 'border_color']

function mountPaletteFields(wrapper: HTMLElement): void {
  for (const name of COLOR_FIELDS) {
    const input = findControl(wrapper, name)
    if (input instanceof HTMLInputElement) paletteField(input, { withHash: false, fallback: '000000' })
  }
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

  // 見た目は version-settings-style.ts（2026-10-27 LP設定の作り直し＝選んだ物だけ青い枠）
  const row = document.createElement('div')
  row.setAttribute('data-clone-text-align-row', 'true')
  row.className = 'lp-align-row'
  const label = document.createElement('span')
  label.className = 'lp-align-label'
  label.textContent = 'テキスト揃え'
  row.append(label)

  const group = document.createElement('div')
  group.className = 'lp-align-group'

  const active = currentValue || 'left'
  for (const opt of ALIGN_OPTIONS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.title = opt.label
    btn.className = 'lp-align-btn'
    btn.setAttribute('aria-pressed', String(opt.value === active))
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('width', '18')
    svg.setAttribute('height', '18')
    svg.setAttribute('fill', 'currentColor')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', opt.icon)
    svg.append(path)
    btn.append(svg)

    btn.addEventListener('click', () => {
      row.dataset[ALIGN_DATA_KEY] = opt.value
      for (const sibling of group.children) sibling.setAttribute('aria-pressed', String(sibling === btn))
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
    payload[group.lookField] = mode === 'image' ? (holder?.dataset['bgLook'] ?? String(sheet[group.lookField] ?? '')) : ''
  }
  return payload
}

/** LP設定の住所（Version を渡すと、その Version の設定） */
const sheetPath = (articleUid: string, version: SettingsVersion | undefined): string =>
  `/articles/${articleUid}/master_style_sheet${version === undefined ? '' : `?version_uid=${encodeURIComponent(version.uid)}`}`

/** 保存できたことの知らせ（ほかの Version にも入れたときは、その数も） */
function savedMessage(toOthers: boolean, appliedVersions: number): string {
  if (!toOthers) return 'LP設定を保存しました'
  return appliedVersions > 0
    ? `LP設定を保存しました（ほかのVersion ${appliedVersions}つにも入れました）`
    : 'LP設定を保存しました（ほかに入れるVersionはありませんでした）'
}

async function save(
  articleUid: string,
  version: SettingsVersion | undefined,
  wrapper: HTMLElement,
  sheet: MasterStyleSheet,
): Promise<void> {
  const saveButton = wrapper.querySelector<HTMLElement>(HOOK.save)
  if (saveButton === null) return
  if (saveButton.dataset['busy'] === 'true') return
  saveButton.dataset['busy'] = 'true'
  saveButton.style.opacity = '0.6'
  const toOthers = version !== undefined && isApplyToOthers(wrapper)
  try {
    const body = await requestJson<{ master_style_sheet: MasterStyleSheet; applied_versions?: number }>(
      'PUT',
      sheetPath(articleUid, version),
      version === undefined ? collectPayload(wrapper, sheet) : { ...collectPayload(wrapper, sheet), apply_to_other_versions: toOthers },
    )
    toast(savedMessage(toOthers, body.applied_versions ?? 0))
    onSavedCallback?.() // 編集画面の本文へ即反映
    close()
  } catch (error) {
    toast((error as Error).message, 'error')
    saveButton.dataset['busy'] = 'false'
    saveButton.style.opacity = '1'
  }
}

async function fetchSheet(articleUid: string, version: SettingsVersion | undefined): Promise<MasterStyleSheet> {
  const body = await requestJson<{ master_style_sheet: MasterStyleSheet }>('GET', sheetPath(articleUid, version))
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
