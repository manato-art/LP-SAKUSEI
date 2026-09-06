/**
 * 「基本情報」タブ（`/folders/:folder_uid/ab_tests/:ab_test_uid/edit`）。
 *
 * **手書きでUIを似せない**（企画書 §11 / 共通指示 §2）。
 * 採取した実DOM `fragments/folders__UID__ab_tests__UID__edit__default.html` を土台に置き、
 * MUIのラベル（`<label>`）と実在する `data-testid` を目印に「挙動だけ」を後付けする。
 * クラス名は Emotion が生成した実物のまま。CSSは1行も書き足していない。
 *
 * 採取物に無くて**できないこと**は、それらしく作らずトーストで正直に出す
 * （MUI Select の選択肢一覧＝`role="listbox"` は採取物に1つも無い）。
 */
import substrate from '../fragments/folders__UID__ab_tests__UID__edit__default.html?raw'
import { isStale } from '../main.ts'
import { toast } from '../ui.ts'
import { openParamUrlModal } from '../panels/param-url-modal.ts'
import { basicInfoApi, type MediaOption } from './basic-info-api.ts'
import { wireAbTestTabs, setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'
import { recordHistory } from './folders.ts'
import {
  AD_STATUS_LABELS,
  CONVERSION_CONDITION_LABELS,
  DELIVERY_TYPE_LABELS,
  EDITOR_VERSION_LABELS,
  buildUpdatePayload,
  deliveryUrl,
  toFormValues,
  validateBasicInfo,
  type AbTestForEdit,
  type BasicInfoValues,
} from './basic-info-form.ts'

/** 採取DOM内の目印（実物の属性・クラス。書き換えていない） */
const HOOK = {
  /** サイドバーはシェルが出すので、断片からは本体側だけを使う */
  main: '.ehppitp0',
  form: '[data-testid="beyond-page-form"]',
  editorVersionSelect: '[data-testid="editor-version-select"]',
  mediaSelect: '[data-testid="media-select"]',
  formControl: '.MuiFormControl-root',
  selectDisplay: '.MuiSelect-select',
  selectNativeInput: 'input.MuiSelect-nativeInput',
  currentAbTest: '[class*="_currentAbTest_"]',
  folderName: '[class*="_folderName_"]',
  back: 'a[class*="_back_"]',
  deliveryUrlLink: 'a[href*="/ab/"]',
  copyUrl: 'button[aria-label="コピーする"]',
  aspClear: 'button[aria-label="クリア"]',
  aspOpen: 'button[aria-label="開く"]',
  collapse: '.MuiCollapse-root',
  submit: 'button[type="submit"]',
} as const

/** 選択肢一覧のマークアップが採取物に無い select（表示のみにする） */
const READ_ONLY_SELECT_LABELS: readonly string[] = [
  '配信タイプ',
  'CV条件',
  '媒体',
  '性別',
  '歳以上',
  '歳以下',
]

interface PageContext {
  root: HTMLElement
  form: HTMLElement
  abTest: AbTestForEdit
  abTestUid: string
}

export async function renderBasicInfo(
  container: HTMLElement,
  target: { abTestUid: string; folderUid: string },
  generation?: number,
): Promise<void> {
  container.innerHTML = ''
  // エディタが `height:100vh;overflow:hidden` を残していくので、シェルの既定へ戻す
  container.style.cssText = 'flex:1;min-width:0'

  const [{ ab_test }, { medias }] = await Promise.all([
    basicInfoApi.abTestForEdit(target.abTestUid),
    basicInfoApi.medias(),
  ])
  // API待ちの間に新しい描画が始まっていたら、ここで降りる（二重描画の防止・main.ts の作法）
  if (generation !== undefined && isStale(generation)) return

  // 基本情報ページを開いた操作を履歴に記録
  recordHistory(target.abTestUid, ab_test.title, 'ab_test', '基本情報')

  const root = document.createElement('div')
  root.innerHTML = substrate
  // 断片は `#root` の中身そのままなので**サイドバーを含む**。シェルが同じものを出しているため、
  // ここでは本体側（`.ehppitp0`）だけを残す（マークアップは一切書き換えていない）。
  const main = root.querySelector<HTMLElement>(HOOK.main)
  if (main !== null) {
    // 指示66: サイドバー幅（60px）の左パディングを除去（シェルが既にサイドバーを出している）
    main.style.paddingLeft = '0'
    root.replaceChildren(main)
  }
  container.append(root)

  const form = root.querySelector<HTMLElement>(HOOK.form)
  if (form === null) {
    container.textContent = '基本情報タブの土台が壊れています（beyond-page-form が見つかりません）'
    return
  }

  const ctx: PageContext = { root, form, abTest: ab_test, abTestUid: target.abTestUid }

  wireAbTestTabs(root, target.abTestUid, ab_test.folder?.uid ?? target.folderUid)
  setupHorizTabs(root, 'info', { abTestUid: target.abTestUid, folderUid: ab_test.folder?.uid ?? target.folderUid })
  wireTopBar(ctx)
  setupBreadcrumb(root, ab_test.folder?.name ?? '', ab_test.title, ab_test.folder?.uid)
  applyAbTest(ctx, medias)
  wireSelects(ctx, medias)
  wireDeliveryUrl(ctx)
  wireDetailToggles(ctx)
  wireAsp(ctx)
  wireSubmit(ctx)
  neutralizeRemainingLinks(root)

  // 指示120: 左右の余白を活用 — フォーム幅を広げてカード風にリニューアル
  improveBasicInfoLayout(root)
}

// ── 値の流し込み ─────────────────────────────────────────

/** ラベル文字列から MUI の FormControl を引く（`data-testid` が無い項目のための目印） */
function formControlByLabel(root: HTMLElement, label: string): HTMLElement | null {
  for (const control of root.querySelectorAll<HTMLElement>(HOOK.formControl)) {
    const own = control.querySelector('label')
    if (own !== null && (own.textContent ?? '').trim() === label) return control
  }
  return null
}

function textFieldByLabel(root: HTMLElement, label: string): HTMLInputElement | null {
  const control = formControlByLabel(root, label)
  return control?.querySelector<HTMLInputElement>('input:not([aria-hidden])') ?? null
}

function textAreaByLabel(root: HTMLElement, label: string): HTMLTextAreaElement | null {
  const control = formControlByLabel(root, label)
  return control?.querySelector<HTMLTextAreaElement>('textarea:not([aria-hidden])') ?? null
}

/**
 * MUI Select は `<select>` ではなく「表示用のdiv＋隠しinput」。
 * 実物と同じ2箇所に値を書き込む（未設定は採取物と同じゼロ幅スペースに戻す）。
 */
function applySelect(container: HTMLElement | null, value: string, label: string): void {
  if (container === null) return
  const display = container.querySelector<HTMLElement>(HOOK.selectDisplay)
  const native = container.querySelector<HTMLInputElement>(HOOK.selectNativeInput)
  if (native !== null) native.value = value
  if (display === null) return
  if (label === '') {
    display.innerHTML = '<span class="notranslate">​</span>'
    return
  }
  display.textContent = label
}

function applyAbTest(ctx: PageContext, medias: readonly MediaOption[]): void {
  const { root, abTest } = ctx
  const values = toFormValues(abTest)

  const title = textFieldByLabel(root, 'beyondページ名')
  if (title !== null) title.value = values.title
  const memo = textAreaByLabel(root, 'メモ')
  if (memo !== null) memo.value = values.memo
  const asp = textFieldByLabel(root, '計測ツール・ASP')
  if (asp !== null) asp.value = values.affiliate_service_provider
  const price = textFieldByLabel(root, 'コンバージョン単価')
  if (price !== null) price.value = values.conversion_unit_price

  applySelect(
    root.querySelector<HTMLElement>(HOOK.editorVersionSelect),
    String(abTest.editor_version),
    EDITOR_VERSION_LABELS[abTest.editor_version] ?? '',
  )
  const mediaName = medias.find((m) => m.id === abTest.media_id)?.name ?? abTest.media?.name ?? ''
  applySelect(
    root.querySelector<HTMLElement>(HOOK.mediaSelect),
    abTest.media_id === null ? '' : String(abTest.media_id),
    mediaName,
  )
  applySelect(
    formControlByLabel(root, '配信タイプ'),
    abTest.delivery_type,
    DELIVERY_TYPE_LABELS[abTest.delivery_type] ?? abTest.delivery_type,
  )
  const condition = abTest.conversion_setting.conversion_condition
  applySelect(
    formControlByLabel(root, 'CV条件'),
    condition,
    CONVERSION_CONDITION_LABELS[condition] ?? condition,
  )
  applySelect(formControlByLabel(root, '性別'), abTest.gender ?? '', abTest.gender ?? '')
  applySelect(
    formControlByLabel(root, '歳以上'),
    abTest.age_from === null ? '' : String(abTest.age_from),
    abTest.age_from === null ? '' : String(abTest.age_from),
  )
  applySelect(
    formControlByLabel(root, '歳以下'),
    abTest.age_to === null ? '' : String(abTest.age_to),
    abTest.age_to === null ? '' : String(abTest.age_to),
  )
}

/** 上部バー（ページ名 / 配信ステータス / フォルダ名 / 戻る） */
function wireTopBar(ctx: PageContext): void {
  const { root, abTest } = ctx
  const current = root.querySelector<HTMLElement>(HOOK.currentAbTest)
  if (current !== null) {
    const name = current.querySelector<HTMLElement>('p.MuiTypography-root')
    if (name !== null) name.textContent = abTest.title
    const status = current.querySelector<HTMLElement>('button')
    if (status !== null) status.textContent = AD_STATUS_LABELS[abTest.ad_status] ?? abTest.ad_status
  }
  const folderName = root.querySelector<HTMLElement>(HOOK.folderName)
  if (folderName !== null) folderName.textContent = abTest.folder?.name ?? ''

  const back = root.querySelector<HTMLAnchorElement>(HOOK.back)
  if (back !== null && abTest.folder !== null) {
    back.setAttribute('href', `#/folders?uid=${abTest.folder.uid}`)
  }
  // 「フォルダ基本情報画面」への導線（実物のリンク文言で特定する）
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a')) {
    if ((anchor.textContent ?? '').trim() !== 'フォルダ基本情報画面') continue
    anchor.setAttribute('href', `#/folders/${abTest.folder?.uid ?? ''}/edit`)
  }
  const aspLink = root.querySelector<HTMLAnchorElement>('a[href="/teams/asp_accounts"]')
  if (aspLink !== null) {
    aspLink.setAttribute('href', '#/teams/asp_accounts')
    aspLink.removeAttribute('target')
  }
}

// ── 選択肢セレクト（指示⑮ で編集可能化）──────────────────────

interface SelectOption {
  value: string
  label: string
}

/** ラベル→選択肢。値/表記は既知のenumマップ・媒体リスト・妥当な範囲から作る */
function optionsForLabel(label: string, medias: readonly MediaOption[]): SelectOption[] {
  const fromMap = (map: Record<string, string>): SelectOption[] =>
    Object.entries(map).map(([value, text]) => ({ value, label: text }))
  switch (label) {
    case '配信タイプ':
      return fromMap(DELIVERY_TYPE_LABELS)
    case 'CV条件':
      return fromMap(CONVERSION_CONDITION_LABELS)
    case '媒体':
      return [{ value: '', label: '指定なし' }, ...medias.map((m) => ({ value: String(m.id), label: m.name }))]
    case '性別':
      return [
        { value: '', label: '指定なし' },
        { value: '男性', label: '男性' },
        { value: '女性', label: '女性' },
      ]
    case '歳以上':
    case '歳以下':
      return [{ value: '', label: '指定なし' }, ...AGE_CHOICES.map((a) => ({ value: String(a), label: String(a) }))]
    default:
      return []
  }
}

const AGE_CHOICES: readonly number[] = [15, 18, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]

/** 選択肢セレクトを、クリックでドロップダウンが開き、選ぶと表示＋隠しinputへ反映するようにする */
function wireSelects(ctx: PageContext, medias: readonly MediaOption[]): void {
  for (const label of READ_ONLY_SELECT_LABELS) {
    const control =
      label === '媒体'
        ? ctx.root.querySelector<HTMLElement>(HOOK.mediaSelect)?.closest<HTMLElement>(HOOK.formControl) ?? null
        : formControlByLabel(ctx.root, label)
    const display = control?.querySelector<HTMLElement>(HOOK.selectDisplay)
    if (control === null || display === undefined || display === null) continue
    const options = optionsForLabel(label, medias)
    if (options.length === 0) continue
    display.style.cursor = 'pointer'
    display.addEventListener('click', (event) => {
      event.stopPropagation()
      openSelectDropdown(control, display, options, (option) => {
        applySelect(control, option.value, option.label)
      })
    })
  }
}

/** 選択肢のドロップダウンを表示欄の直下に出す（採取物にリストボックスが無いため軽量に自作） */
function openSelectDropdown(
  control: HTMLElement,
  display: HTMLElement,
  options: readonly SelectOption[],
  onPick: (option: SelectOption) => void,
): void {
  control.querySelector('[data-clone-select-menu]')?.remove()
  const menu = document.createElement('div')
  menu.setAttribute('data-clone-select-menu', '')
  menu.style.cssText =
    'position:absolute;z-index:9700;background:#fff;border:1px solid #ccc;border-radius:6px;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.15);max-height:240px;overflow:auto;min-width:160px;' +
    'font-size:14px;left:0;right:0;margin-top:2px'
  for (const option of options) {
    const row = document.createElement('div')
    row.textContent = option.label
    row.style.cssText = 'padding:8px 14px;cursor:pointer'
    row.addEventListener('mouseenter', () => (row.style.background = '#F2F6FF'))
    row.addEventListener('mouseleave', () => (row.style.background = ''))
    row.addEventListener('click', (event) => {
      event.stopPropagation()
      onPick(option)
      menu.remove()
    })
    menu.append(row)
  }
  const host = display.closest<HTMLElement>('.MuiInputBase-root') ?? control
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
  host.append(menu)
  const close = (): void => {
    menu.remove()
    document.removeEventListener('click', close)
  }
  setTimeout(() => document.addEventListener('click', close), 0)
}

function wireDeliveryUrl(ctx: PageContext): void {
  const url = deliveryUrl(location.origin, ctx.abTestUid)
  const link = ctx.root.querySelector<HTMLAnchorElement>(HOOK.deliveryUrlLink)
  if (link !== null) {
    // 表示は実物と同じ「配信URL」だが、遷移先はクローン内の実パス `/lp/:uid`（SSR配信）にする（外へ出さない）
    link.setAttribute('href', `/lp/${ctx.abTestUid}`)
    link.removeAttribute('target')
    link.textContent = url
  }
  ctx.root.querySelector<HTMLElement>(HOOK.copyUrl)?.addEventListener('click', () => {
    void navigator.clipboard
      .writeText(url)
      .then(() => toast('URLをコピーしました'))
      .catch(() => toast('URLのコピーに失敗しました', 'error'))
  })
  for (const button of ctx.root.querySelectorAll<HTMLElement>('button')) {
    if ((button.textContent ?? '').trim() !== 'パラメータ付きURLの発行') continue
    button.addEventListener('click', () => openParamUrlModal(url))
  }

  // 「タブ表示名」入力欄を配信URLセクションの直後に挿入する。
  // 採取DOMにこの欄は無いため、既存MUIのスタイルに合わせて動的に生成する。
  injectPageTitleField(ctx)
}

/**
 * 「タブ表示名」の入力欄を、配信URLセクションの直後に差し込む。
 * 採取物に存在しない独自フィールドなので、既存MUIのテキストフィールドのスタイルに
 * 視覚的に揃えつつ、独自の `data-clone-page-title` 属性で `collectValues` が拾えるようにする。
 */
function injectPageTitleField(ctx: PageContext): void {
  // 配信URLのリンクが入っている FormControl を探す
  const urlLink = ctx.root.querySelector<HTMLAnchorElement>(HOOK.deliveryUrlLink)
  const urlSection = urlLink?.closest<HTMLElement>(HOOK.formControl)
  const insertTarget = urlSection?.parentElement ?? ctx.form
  const insertRef = urlSection?.nextElementSibling ?? null

  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'margin:16px 0 8px;padding:0'

  const label = document.createElement('label')
  label.textContent = 'タブ表示名'
  label.style.cssText =
    'display:block;font-size:12px;color:rgba(0,0,0,.6);margin-bottom:4px;' +
    'font-family:"Hiragino Sans",sans-serif;font-weight:400;line-height:1.4375em;letter-spacing:0.00938em'

  const input = document.createElement('input')
  input.type = 'text'
  input.setAttribute('data-clone-page-title', '')
  input.value = ctx.abTest.page_title ?? ''
  input.placeholder = ctx.abTest.title
  input.style.cssText =
    'display:block;width:100%;box-sizing:border-box;padding:8.5px 14px;' +
    'font-size:16px;font-family:"Hiragino Sans",sans-serif;' +
    'border:1px solid rgba(0,0,0,.23);border-radius:4px;outline:none;' +
    'background:transparent;color:rgba(0,0,0,.87);line-height:1.4375em'
  input.addEventListener('focus', () => {
    input.style.borderColor = '#1976d2'
    input.style.borderWidth = '2px'
    input.style.padding = '7.5px 13px'
  })
  input.addEventListener('blur', () => {
    input.style.borderColor = 'rgba(0,0,0,.23)'
    input.style.borderWidth = '1px'
    input.style.padding = '8.5px 14px'
  })

  const hint = document.createElement('p')
  hint.textContent = '未入力の場合はbeyondページ名がタブに表示されます'
  hint.style.cssText =
    'margin:4px 0 0;font-size:11px;color:rgba(0,0,0,.4);' +
    'font-family:"Hiragino Sans",sans-serif'

  wrapper.append(label, input, hint)
  insertTarget.insertBefore(wrapper, insertRef)
}

/**
 * 「〜の詳細を確認する」の開閉。実物は MUI Collapse で、
 * 閉じた状態のCSS（`height:0; visibility:hidden`）だけが採取できている。
 * 開いた状態は MUI がインラインstyleで作るので、同じことをする（CSSは書き足さない）。
 */
function wireDetailToggles(ctx: PageContext): void {
  for (const button of ctx.form.querySelectorAll<HTMLElement>('button')) {
    const text = (button.textContent ?? '').trim()
    if (!text.endsWith('の詳細を確認する')) continue
    const collapse = findCollapseAfter(button)
    if (collapse === null) {
      console.warn('[basic-info] 開閉先が見つかりません:', text)
      continue
    }
    button.addEventListener('click', (event) => {
      event.preventDefault()
      const isOpen = collapse.style.height === 'auto'
      collapse.style.height = isOpen ? '' : 'auto'
      collapse.style.overflow = isOpen ? '' : 'visible'
      collapse.style.visibility = isOpen ? '' : 'visible'
    })
  }
}

/** ボタンの後ろにある Collapse を、祖先をたどりながら探す */
function findCollapseAfter(button: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = button
  while (node !== null) {
    const next = node.nextElementSibling
    if (next !== null && next.classList.contains('MuiCollapse-root')) return next as HTMLElement
    node = node.parentElement
  }
  return null
}

function wireAsp(ctx: PageContext): void {
  const input = textFieldByLabel(ctx.root, '計測ツール・ASP')
  ctx.root.querySelector<HTMLElement>(HOOK.aspClear)?.addEventListener('click', () => {
    if (input !== null) input.value = ''
  })
  ctx.root.querySelector<HTMLElement>(HOOK.aspOpen)?.addEventListener('click', () => {
    toast('計測ツール・ASPの候補一覧は採取していないため、直接入力してください', 'error')
  })
}

// ── 保存 ────────────────────────────────────────────────

function selectValueByLabel(root: HTMLElement, label: string): string | undefined {
  const control =
    label === '媒体'
      ? root.querySelector<HTMLElement>(HOOK.mediaSelect)?.closest(HOOK.formControl) ?? null
      : formControlByLabel(root, label)
  return control?.querySelector<HTMLInputElement>(HOOK.selectNativeInput)?.value
}

function collectValues(root: HTMLElement): BasicInfoValues {
  return {
    title: textFieldByLabel(root, 'beyondページ名')?.value ?? '',
    page_title: root.querySelector<HTMLInputElement>('[data-clone-page-title]')?.value ?? '',
    memo: textAreaByLabel(root, 'メモ')?.value ?? '',
    affiliate_service_provider: textFieldByLabel(root, '計測ツール・ASP')?.value ?? '',
    conversion_unit_price: textFieldByLabel(root, 'コンバージョン単価')?.value ?? '',
    delivery_type: selectValueByLabel(root, '配信タイプ'),
    media_id: selectValueByLabel(root, '媒体'),
    conversion_condition: selectValueByLabel(root, 'CV条件'),
    gender: selectValueByLabel(root, '性別'),
    age_from: selectValueByLabel(root, '歳以上'),
    age_to: selectValueByLabel(root, '歳以下'),
  }
}

function wireSubmit(ctx: PageContext): void {
  const button = ctx.form.querySelector<HTMLButtonElement>(HOOK.submit)
  ctx.form.addEventListener('submit', (event) => event.preventDefault())
  if (button === null) {
    console.warn('[basic-info] 「更新する」が土台に見つかりませんでした')
    return
  }
  button.addEventListener('click', (event) => {
    event.preventDefault()
    void save(ctx)
  })
}

async function save(ctx: PageContext): Promise<void> {
  const submit = ctx.form.querySelector<HTMLButtonElement>(HOOK.submit)
  if (submit === null || submit.dataset['busy'] === 'true') return
  const values = collectValues(ctx.root)
  const check = validateBasicInfo(values)
  if (!check.ok) {
    toast(check.message, 'error')
    return
  }
  submit.dataset['busy'] = 'true'
  submit.style.opacity = '0.6'
  try {
    const { ab_test } = await basicInfoApi.update(
      ctx.abTestUid,
      buildUpdatePayload(ctx.abTest, values),
    )
    ctx.abTest = ab_test
    wireTopBar(ctx)
    toast('更新しました')
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    submit.dataset['busy'] = 'false'
    submit.style.opacity = '1'
  }
}

/** 採取物に残っている外向きのリンクは、クローンの外へ出ないように止める */
function neutralizeRemainingLinks(root: HTMLElement): void {
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a')) {
    if (anchor.getAttribute('href')?.startsWith('#') === true) continue
    anchor.addEventListener('click', (event) => event.preventDefault())
  }
}

/**
 * 指示120: 基本情報ページのレイアウト改善。
 * 採取CSSの `width:600px; margin:auto` で左右に大きな余白が出ていたのを、
 * フォームを広げて余白を有効活用する。
 */
function improveBasicInfoLayout(root: HTMLElement): void {
  // フォームコンテナ: 固定600px → 余白を活かして広げる
  const formBox = root.querySelector<HTMLElement>('.css-1nmwx27')
  if (formBox !== null) {
    formBox.style.width = '100%'
    formBox.style.maxWidth = '900px'
    formBox.style.padding = '24px 32px'
    formBox.style.borderRadius = '12px'
    formBox.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'
    formBox.style.border = '1px solid #e5e5ea'
  }

  // 外枠パディング（上下余白を適度に保つ）
  const outer = root.querySelector<HTMLElement>('.css-1mf4ect')
  if (outer !== null) {
    outer.style.padding = '24px 32px'
    outer.style.background = '#f8f9fa'
    outer.style.minHeight = 'calc(100vh - 160px)'
  }

  // MUI FormControl 間の余白を整える
  for (const control of root.querySelectorAll<HTMLElement>('.MuiFormControl-root')) {
    control.style.marginBottom = '8px'
  }

  // ラベル色を濃くして視認性アップ
  for (const label of root.querySelectorAll<HTMLElement>('.MuiFormLabel-root')) {
    label.style.color = 'rgba(0,0,0,.7)'
    label.style.fontWeight = '500'
  }
}
