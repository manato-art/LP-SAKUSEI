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
import { basicInfoApi, type MediaOption } from './basic-info-api.ts'
import { wireAbTestTabs } from './tab-nav.ts'
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

  const root = document.createElement('div')
  root.innerHTML = substrate
  // 断片は `#root` の中身そのままなので**サイドバーを含む**。シェルが同じものを出しているため、
  // ここでは本体側（`.ehppitp0`）だけを残す（マークアップは一切書き換えていない）。
  const main = root.querySelector<HTMLElement>(HOOK.main)
  if (main !== null) root.replaceChildren(main)
  container.append(root)

  const form = root.querySelector<HTMLElement>(HOOK.form)
  if (form === null) {
    container.textContent = '基本情報タブの土台が壊れています（beyond-page-form が見つかりません）'
    return
  }

  const ctx: PageContext = { root, form, abTest: ab_test, abTestUid: target.abTestUid }

  wireAbTestTabs(root, target.abTestUid, ab_test.folder?.uid ?? target.folderUid)
  wireTopBar(ctx)
  applyAbTest(ctx, medias)
  wireReadOnlySelects(ctx)
  wireDeliveryUrl(ctx)
  wireDetailToggles(ctx)
  wireAsp(ctx)
  wireSubmit(ctx)
  neutralizeRemainingLinks(root)
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

// ── 採取物に無いUI（正直に出す）──────────────────────────

function wireReadOnlySelects(ctx: PageContext): void {
  for (const label of READ_ONLY_SELECT_LABELS) {
    const control =
      label === '媒体'
        ? ctx.root.querySelector<HTMLElement>(HOOK.mediaSelect)?.closest(HOOK.formControl) ?? null
        : formControlByLabel(ctx.root, label)
    const display = control?.querySelector<HTMLElement>(HOOK.selectDisplay)
    if (display === undefined || display === null) continue
    display.addEventListener('click', () => {
      toast(`「${label}」の選択肢一覧は採取していないため、変更できません`, 'error')
    })
  }
}

function wireDeliveryUrl(ctx: PageContext): void {
  const url = deliveryUrl(location.origin, ctx.abTestUid)
  const link = ctx.root.querySelector<HTMLAnchorElement>(HOOK.deliveryUrlLink)
  if (link !== null) {
    // 表示は実物と同じ「配信URL」だが、遷移先はクローン内のハッシュルートにする（外へ出さない）
    link.setAttribute('href', `#/ab/${ctx.abTestUid}`)
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
    button.addEventListener('click', () => {
      toast('パラメータ付きURLの発行ダイアログは採取していないため未実装です', 'error')
    })
  }
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

function collectValues(root: HTMLElement): BasicInfoValues {
  return {
    title: textFieldByLabel(root, 'beyondページ名')?.value ?? '',
    memo: textAreaByLabel(root, 'メモ')?.value ?? '',
    affiliate_service_provider: textFieldByLabel(root, '計測ツール・ASP')?.value ?? '',
    conversion_unit_price: textFieldByLabel(root, 'コンバージョン単価')?.value ?? '',
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
