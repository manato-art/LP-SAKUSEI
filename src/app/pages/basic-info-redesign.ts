/**
 * 指示133: 基本情報ページのリデザイン。
 *
 * 参照デザイン（ユーザー提供）に合わせ、2カラム構成に作り替える:
 *   左 = アイコン付きセクション（基本情報 / トラッキング項目 / その他の項目 / メディア）
 *   右 = 「設定内容の確認」ライブ要約パネル（左の入力に追従）
 *
 * 方針（ユーザー確認済み「見た目であとでAPI渡す」）:
 *   - バックエンド（モックAPI）に実在する項目は保存まで配線する。
 *   - 参照デザインにあるがモックAPIに無い項目（開始/締切/終了・コンバージョン期限・
 *     スーパーリロード回数・メディア掲載・成果測定方法）は**見た目だけ**用意し、
 *     いまは保存しない（後でAPIを渡す前提）。data-bi-ui 属性で識別できるようにしておく。
 *
 * ナビ（6タブ・パンくず）は既存の共通配線を流用する（採取DOMは本文には使わない）。
 */
import { isStale } from '../main.ts'
import { toast } from '../ui.ts'
import { openParamUrlModal } from '../panels/param-url-modal.ts'
import { basicInfoApi, type MediaOption } from './basic-info-api.ts'
import { setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'
import { recordHistory } from './folders.ts'
import {
  AD_STATUS_LABELS,
  CONVERSION_CONDITION_LABELS,
  DELIVERY_TYPE_LABELS,
  EDITOR_VERSION_LABELS,
  buildUpdatePayload,
  deliveryUrl,
  validateBasicInfo,
  type AbTestForEdit,
  type BasicInfoValues,
} from './basic-info-form.ts'

const AGE_CHOICES: readonly number[] = [15, 18, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]
const UNSET = '未設定'

/** セクションのアイコン（丸背景付きの小SVG） */
const ICONS = {
  basic: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  tracking: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/></svg>',
  other: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  media: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="m10 8 4 3-4 3V8z" fill="#fff" stroke="none"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#22a06b" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>',
} as const

const SECTION_COLOR = {
  basic: '#0091ff',
  tracking: '#7c5cff',
  other: '#22a06b',
  media: '#e5589b',
} as const

export async function renderBasicInfoRedesign(
  container: HTMLElement,
  target: { abTestUid: string; folderUid: string },
  generation?: number,
): Promise<void> {
  container.innerHTML = ''
  container.style.cssText = 'flex:1;min-width:0'

  const [{ ab_test }, { medias }] = await Promise.all([
    basicInfoApi.abTestForEdit(target.abTestUid),
    basicInfoApi.medias(),
  ])
  if (generation !== undefined && isStale(generation)) return

  recordHistory(target.abTestUid, ab_test.title, 'ab_test', '基本情報')

  const root = document.createElement('div')
  container.append(root)

  const folderUid = ab_test.folder?.uid ?? target.folderUid
  // 共通のナビ（6タブ）＋パンくずを流用（採取DOMが無くても root 先頭に挿入される）
  setupHorizTabs(root, 'info', { abTestUid: target.abTestUid, folderUid })
  setupBreadcrumb(root, ab_test.folder?.name ?? '', ab_test.title, folderUid)

  injectStyles()
  // buildPage が内部で page を root へ append し、配線まで行う
  buildPage(root, ab_test, medias, target.abTestUid)
}

// ── 画面の組み立て ───────────────────────────────────────

function buildPage(
  root: HTMLElement,
  abTest: AbTestForEdit,
  medias: readonly MediaOption[],
  abTestUid: string,
): HTMLElement {
  const url = deliveryUrl(location.origin, abTestUid)

  const page = h('div', 'bi-page')
  const grid = h('div', 'bi-grid')
  page.append(grid)

  const left = h('div', 'bi-left')
  const right = h('div', 'bi-right')
  grid.append(left, right)

  // ── 左: 基本情報 ──
  const secBasic = section('basic', '基本情報', 'キャンペーンの基本情報を設定します。')
  left.append(secBasic.el)
  const gBasic = grid2(secBasic.body)
  const fTitle = field('キャンペーン名', true)
  fTitle.append(textInput('bi-title', abTest.title, 'キャンペーン名を入力'))
  const fEditor = field('動作タイプ', true)
  fEditor.append(selectInput('bi-editor',
    Object.entries(EDITOR_VERSION_LABELS).map(([v, l]) => ({ value: v, label: l })),
    String(abTest.editor_version)))
  gBasic.append(fTitle, fEditor)

  const fUrl = field('配信URL', true)
  fUrl.append(urlRow(url, () => copy(url), () => openParamUrlModal(url)))
  secBasic.body.append(fUrl)

  const fDelivery = field('配信タイプ', true)
  fDelivery.append(selectInput('bi-delivery',
    dedupe(Object.entries(DELIVERY_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))),
    abTest.delivery_type))
  const fPageTitle = field('タブ表示名', false, '未入力の場合はキャンペーン名がタブに表示されます')
  fPageTitle.append(textInput('bi-page-title', abTest.page_title ?? '', abTest.title))
  appendHint(fPageTitle)
  grid2(secBasic.body).append(fDelivery, fPageTitle)

  // ── 左: トラッキング項目 ──
  const secTrack = section('tracking', 'トラッキング項目', 'CV判別に必要な項目を設定します。')
  left.append(secTrack.el)
  const gTrack = grid2(secTrack.body)
  const fCv = field('CV種別', false)
  fCv.append(selectInput('bi-cv',
    Object.entries(CONVERSION_CONDITION_LABELS).map(([v, l]) => ({ value: v, label: l })),
    abTest.conversion_setting.conversion_condition))
  const fAsp = field('計測ツール・ASP', false)
  fAsp.append(textInput('bi-asp', abTest.affiliate_service_provider ?? '', '計測ツール・ASP'))
  gTrack.append(fCv, fAsp)
  const gTrack2 = grid2(secTrack.body)
  const fPrice = field('コンバージョン単価', false)
  fPrice.append(numInput('bi-price', String(abTest.conversion_unit_price)))
  const fMethod = field('成果測定方法', false)
  fMethod.append(selectInput('bi-method', [
    { value: 'none', label: '無効／バリデーションなし' },
    { value: 'strict', label: '厳格モード' },
  ], 'none', true))
  gTrack2.append(fPrice, fMethod)

  // ── 左: その他の項目 ──
  const secOther = section('other', 'その他の項目', 'その他の設定項目を入力します。')
  left.append(secOther.el)
  const fMemo = field('メモ', false)
  fMemo.append(textArea('bi-memo', abTest.memo, 'メモを入力してください'))
  secOther.body.append(fMemo)
  const gOther = grid3(secOther.body)
  const fGender = field('性別', false)
  fGender.append(selectInput('bi-gender', [
    { value: '', label: '指定なし' }, { value: '男性', label: '男性' }, { value: '女性', label: '女性' },
  ], abTest.gender ?? ''))
  const fAgeFrom = field('年齢（歳以上）', false)
  fAgeFrom.append(selectInput('bi-age-from', ageOptions(), abTest.age_from === null ? '' : String(abTest.age_from)))
  const fAgeTo = field('年齢（歳以下）', false)
  fAgeTo.append(selectInput('bi-age-to', ageOptions(), abTest.age_to === null ? '' : String(abTest.age_to)))
  gOther.append(fGender, fAgeFrom, fAgeTo)
  // 参照デザインの日付・期限（あとでAPI渡す＝いまは見た目だけ）
  const gDates = grid3(secOther.body)
  gDates.append(uiField('開始', dateInput('bi-start')), uiField('締切', dateInput('bi-deadline')), uiField('終了', dateInput('bi-end')))
  const gExtra = grid2(secOther.body)
  gExtra.append(uiField('コンバージョン期限（日）', numInput('bi-cv-limit', '0', true)),
    uiField('スーパーリロード回数', numInput('bi-reload', '0', true)))

  // ── 左: メディア ──
  const secMedia = section('media', 'メディア', 'メディア掲載に関する設定です。')
  left.append(secMedia.el)
  const gMedia = grid2(secMedia.body)
  const fMedia = field('媒体', false)
  const mediaName = medias.find((m) => m.id === abTest.media_id)?.name ?? abTest.media?.name ?? ''
  fMedia.append(selectInput('bi-media',
    [{ value: '', label: '指定なし' }, ...medias.map((m) => ({ value: String(m.id), label: m.name }))],
    abTest.media_id === null ? '' : String(abTest.media_id)))
  const fMediaOn = uiField('メディア掲載', toggleInput('bi-media-on'))
  gMedia.append(fMedia, fMediaOn)
  // 未使用変数の握り（mediaName は summary 用に後で読む）
  void mediaName

  // ── 登録ボタン ──
  const submit = h('button', 'bi-submit') as HTMLButtonElement
  submit.type = 'button'
  submit.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="2" style="margin-right:6px"><path d="M20 6 9 17l-5-5"/></svg>登録する`
  left.append(submit)

  // ── 右: 設定内容の確認 ──
  right.append(buildSummary())

  // 配線の前に page を root へ入れておく（renderSummary が root 起点で query するため）
  root.append(page)

  // ── 配線（入力→要約の追従・保存） ──
  const ctx = { root, abTest, abTestUid, url, medias }
  wire(ctx, submit)

  return page
}

// ── 右パネル（要約） ─────────────────────────────────────

function buildSummary(): HTMLElement {
  const panel = h('div', 'bi-summary')
  panel.innerHTML = `
    <div class="bi-sum-head">
      <div class="bi-sum-title">設定内容の確認</div>
      <div class="bi-sum-sub">現在の内容をリアルタイムで反映します。</div>
    </div>
    <div class="bi-sum-body"></div>
    <div class="bi-sum-status"></div>`
  return panel
}

interface WireCtx {
  root: HTMLElement
  abTest: AbTestForEdit
  abTestUid: string
  url: string
  medias: readonly MediaOption[]
}

function wire(ctx: WireCtx, submit: HTMLButtonElement): void {
  const q = <T extends HTMLElement>(id: string): T | null => ctx.root.querySelector<T>(`#${id}`)

  const refresh = (): void => renderSummary(ctx)
  for (const el of ctx.root.querySelectorAll<HTMLElement>('[id^="bi-"]')) {
    el.addEventListener('input', refresh)
    el.addEventListener('change', refresh)
  }
  refresh()

  submit.addEventListener('click', () => void save(ctx, submit))
  void q // keep helper referenced
}

function collect(ctx: WireCtx): BasicInfoValues {
  const val = (id: string): string =>
    ctx.root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`#${id}`)?.value ?? ''
  return {
    title: val('bi-title'),
    page_title: val('bi-page-title'),
    memo: val('bi-memo'),
    affiliate_service_provider: val('bi-asp'),
    conversion_unit_price: val('bi-price'),
    delivery_type: val('bi-delivery'),
    media_id: val('bi-media'),
    conversion_condition: val('bi-cv'),
    gender: val('bi-gender'),
    age_from: val('bi-age-from'),
    age_to: val('bi-age-to'),
  }
}

function renderSummary(ctx: WireCtx): void {
  const v = collect(ctx)
  const val = (id: string): string =>
    ctx.root.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)?.value ?? ''
  const selText = (id: string): string => {
    const s = ctx.root.querySelector<HTMLSelectElement>(`#${id}`)
    return s !== null && s.selectedIndex >= 0 ? (s.options[s.selectedIndex]?.text ?? '') : ''
  }
  const or = (s: string): string => (s.trim() === '' ? UNSET : s)

  const groups: { title: string; rows: [string, string][] }[] = [
    {
      title: '基本情報',
      rows: [
        ['キャンペーン名', or(v.title)],
        ['動作タイプ', selText('bi-editor')],
        ['配信URL', ctx.url],
        ['配信タイプ', selText('bi-delivery')],
      ],
    },
    {
      title: 'トラッキング項目',
      rows: [
        ['CV種別', selText('bi-cv')],
        ['計測ツール・ASP', or(v.affiliate_service_provider)],
        ['コンバージョン単価', or(v.conversion_unit_price)],
        ['成果測定方法', selText('bi-method')],
      ],
    },
    {
      title: 'その他の項目',
      rows: [
        ['メモ', or(v.memo)],
        ['性別', or(selText('bi-gender'))],
        ['年齢', ageRange(v.age_from, v.age_to)],
        ['開始', or(val('bi-start'))],
        ['締切', or(val('bi-deadline'))],
        ['終了', or(val('bi-end'))],
      ],
    },
    {
      title: 'メディア',
      rows: [
        ['媒体', or(selText('bi-media'))],
        ['メディア掲載', (ctx.root.querySelector<HTMLInputElement>('#bi-media-on')?.checked ?? false) ? '掲載する' : '掲載しない'],
      ],
    },
  ]

  const body = ctx.root.querySelector<HTMLElement>('.bi-sum-body')
  if (body !== null) {
    body.innerHTML = groups
      .map((g) => {
        const rows = g.rows
          .map(([k, val2]) => `<div class="bi-sum-row"><span class="bi-sum-k">${esc(k)}</span><span class="bi-sum-v">${esc(val2)}</span></div>`)
          .join('')
        return `<div class="bi-sum-group"><div class="bi-sum-gtitle">${ICONS.check}${esc(g.title)}</div>${rows}</div>`
      })
      .join('')
  }

  const status = ctx.root.querySelector<HTMLElement>('.bi-sum-status')
  if (status !== null) {
    const check = validateBasicInfo(v)
    if (check.ok) {
      status.className = 'bi-sum-status ok'
      status.innerHTML = `${ICONS.check}<div><b>設定は正常です</b><br>すべての必須項目が入力されています。</div>`
    } else {
      status.className = 'bi-sum-status ng'
      status.innerHTML = `<div><b>入力を確認してください</b><br>${esc(check.message)}</div>`
    }
  }
}

function ageRange(from: string | undefined, to: string | undefined): string {
  const f = from ?? ''
  const t = to ?? ''
  if (f === '' && t === '') return UNSET
  return `${f === '' ? '—' : f} 〜 ${t === '' ? '—' : t} 歳`
}

// ── 保存 ─────────────────────────────────────────────────

async function save(ctx: WireCtx, submit: HTMLButtonElement): Promise<void> {
  if (submit.dataset['busy'] === 'true') return
  const values = collect(ctx)
  const check = validateBasicInfo(values)
  if (!check.ok) {
    toast(check.message, 'error')
    return
  }
  submit.dataset['busy'] = 'true'
  submit.style.opacity = '0.6'
  try {
    const { ab_test } = await basicInfoApi.update(ctx.abTestUid, buildUpdatePayload(ctx.abTest, values))
    ctx.abTest = ab_test
    toast('更新しました')
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    submit.dataset['busy'] = 'false'
    submit.style.opacity = '1'
  }
  void AD_STATUS_LABELS // ステータス表示は将来ヘッダーで使う
}

// ── 小さなDOMヘルパー ────────────────────────────────────

function h(tag: string, cls: string): HTMLElement {
  const el = document.createElement(tag)
  el.className = cls
  return el
}

function section(kind: keyof typeof SECTION_COLOR, title: string, sub: string): { el: HTMLElement; body: HTMLElement } {
  const el = h('div', 'bi-section')
  const head = h('div', 'bi-sec-head')
  const badge = h('span', 'bi-sec-icon')
  badge.style.background = SECTION_COLOR[kind]
  badge.innerHTML = ICONS[kind]
  const titles = h('div', 'bi-sec-titles')
  titles.innerHTML = `<div class="bi-sec-title">${esc(title)}</div><div class="bi-sec-sub">${esc(sub)}</div>`
  head.append(badge, titles)
  const body = h('div', 'bi-sec-body')
  el.append(head, body)
  return { el, body }
}

function grid2(parent: HTMLElement): HTMLElement {
  const g = h('div', 'bi-row2')
  parent.append(g)
  return g
}
function grid3(parent: HTMLElement): HTMLElement {
  const g = h('div', 'bi-row3')
  parent.append(g)
  return g
}

function field(label: string, required: boolean, hint?: string): HTMLElement {
  const f = h('div', 'bi-field')
  const l = h('label', 'bi-label')
  l.innerHTML = `${esc(label)}${required ? '<span class="bi-req">*</span>' : ''}`
  f.append(l)
  // hint は入力要素の後に置きたいので、呼び出し側が input を append し終えたあとに
  // appendHint(f) を呼ぶ運用にする。ここではテキストだけ覚えておく。
  if (hint !== undefined) f.dataset['hint'] = hint
  return f
}

/** field() で覚えた hint テキストを、入力要素の後ろに追加する */
function appendHint(f: HTMLElement): HTMLElement {
  const hint = f.dataset['hint']
  if (hint !== undefined) {
    const hintEl = h('div', 'bi-hint')
    hintEl.textContent = hint
    f.append(hintEl)
  }
  return f
}

/** 参照デザインにあるがモックAPIに無い項目（保存しない・あとでAPI渡す） */
function uiField(label: string, input: HTMLElement): HTMLElement {
  const f = h('div', 'bi-field')
  const l = h('label', 'bi-label')
  l.textContent = label
  f.append(l, input)
  f.dataset['biUi'] = 'true'
  return f
}

function textInput(id: string, value: string, placeholder: string): HTMLInputElement {
  const i = document.createElement('input')
  i.id = id
  i.type = 'text'
  i.className = 'bi-input'
  i.value = value
  i.placeholder = placeholder
  return i
}

function numInput(id: string, value: string, ui = false): HTMLInputElement {
  const i = document.createElement('input')
  i.id = id
  i.type = 'number'
  i.className = 'bi-input'
  i.value = value
  i.min = '0'
  if (ui) i.dataset['biUi'] = 'true'
  return i
}

function dateInput(id: string): HTMLInputElement {
  const i = document.createElement('input')
  i.id = id
  i.type = 'date'
  i.className = 'bi-input'
  i.dataset['biUi'] = 'true'
  return i
}

function textArea(id: string, value: string, placeholder: string): HTMLTextAreaElement {
  const t = document.createElement('textarea')
  t.id = id
  t.className = 'bi-input bi-textarea'
  t.value = value
  t.placeholder = placeholder
  t.rows = 3
  return t
}

interface Opt { value: string; label: string }
function selectInput(id: string, options: readonly Opt[], selected: string, ui = false): HTMLSelectElement {
  const s = document.createElement('select')
  s.id = id
  s.className = 'bi-input bi-select'
  for (const o of options) {
    const opt = document.createElement('option')
    opt.value = o.value
    opt.textContent = o.label
    if (o.value === selected) opt.selected = true
    s.append(opt)
  }
  if (ui) s.dataset['biUi'] = 'true'
  return s
}

function toggleInput(id: string): HTMLElement {
  const wrap = h('label', 'bi-toggle')
  const input = document.createElement('input')
  input.id = id
  input.type = 'checkbox'
  input.dataset['biUi'] = 'true'
  const track = h('span', 'bi-toggle-track')
  wrap.append(input, track)
  return wrap
}

function ageOptions(): Opt[] {
  return [{ value: '', label: '指定なし' }, ...AGE_CHOICES.map((a) => ({ value: String(a), label: String(a) }))]
}

function urlRow(url: string, onCopy: () => void, onParam: () => void): HTMLElement {
  const wrap = h('div', 'bi-url')
  const row = h('div', 'bi-url-row')
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'bi-input'
  input.readOnly = true
  input.value = url
  const copyBtn = h('button', 'bi-url-copy') as HTMLButtonElement
  copyBtn.type = 'button'
  copyBtn.textContent = 'URLをコピー'
  copyBtn.addEventListener('click', onCopy)
  row.append(input, copyBtn)
  const paramBtn = h('button', 'bi-url-param') as HTMLButtonElement
  paramBtn.type = 'button'
  paramBtn.innerHTML = 'パラメータ付きURLの発行'
  paramBtn.addEventListener('click', onParam)
  wrap.append(row, paramBtn)
  return wrap
}

function copy(text: string): void {
  void navigator.clipboard
    .writeText(text)
    .then(() => toast('URLをコピーしました'))
    .catch(() => toast('URLのコピーに失敗しました', 'error'))
}

function dedupe(opts: Opt[]): Opt[] {
  const seen = new Set<string>()
  return opts.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)))
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c))
}

// ── スタイル ─────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById('bi-redesign-css') !== null) return
  const style = document.createElement('style')
  style.id = 'bi-redesign-css'
  style.textContent = `
    .bi-page { background:#f5f7fa; padding:24px; min-height:calc(100vh - 140px); box-sizing:border-box; font-family:"Hiragino Sans","Noto Sans JP",sans-serif; }
    .bi-grid { display:grid; grid-template-columns:1fr 340px; gap:20px; align-items:start; max-width:1400px; margin:0 auto; }
    @media (max-width:1100px){ .bi-grid { grid-template-columns:1fr; } }
    .bi-left { display:flex; flex-direction:column; gap:16px; }
    .bi-section { background:#fff; border:1px solid #e6e8ec; border-radius:12px; padding:20px 22px; box-shadow:0 1px 3px rgba(0,0,0,.04); }
    .bi-sec-head { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
    .bi-sec-icon { width:30px; height:30px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
    .bi-sec-title { font-size:15px; font-weight:700; color:#1a2233; }
    .bi-sec-sub { font-size:12px; color:#8a94a6; margin-top:1px; }
    .bi-sec-body { display:flex; flex-direction:column; gap:14px; }
    .bi-row2 { display:grid; grid-template-columns:1fr 1fr; gap:14px 18px; }
    .bi-row3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px 18px; }
    @media (max-width:680px){ .bi-row2,.bi-row3 { grid-template-columns:1fr; } }
    .bi-field { display:flex; flex-direction:column; gap:5px; min-width:0; }
    .bi-label { font-size:12.5px; font-weight:600; color:#48526b; }
    .bi-req { color:#e5484d; margin-left:3px; }
    .bi-hint { font-size:11px; color:#9aa3b2; }
    .bi-input { width:100%; box-sizing:border-box; padding:9px 12px; font-size:13.5px; color:#1a2233;
      border:1px solid #d6dae1; border-radius:8px; background:#fff; outline:none; transition:border-color .12s,box-shadow .12s; font-family:inherit; }
    .bi-input:focus { border-color:#0091ff; box-shadow:0 0 0 3px rgba(0,145,255,.12); }
    .bi-input:read-only { background:#f5f7fa; color:#5b6577; }
    .bi-textarea { resize:vertical; min-height:64px; }
    .bi-select { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a94a6' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; padding-right:32px; cursor:pointer; }
    .bi-url { display:flex; flex-direction:column; gap:8px; }
    .bi-url-row { display:flex; gap:8px; }
    .bi-url-row .bi-input { flex:1; }
    .bi-url-copy { flex-shrink:0; padding:0 14px; font-size:12.5px; font-weight:600; color:#0091ff; background:#eaf5ff; border:1px solid #cde6ff; border-radius:8px; cursor:pointer; white-space:nowrap; }
    .bi-url-copy:hover { background:#dcefff; }
    .bi-url-param { align-self:flex-start; padding:7px 14px; font-size:12.5px; font-weight:600; color:#48526b; background:#fff; border:1px solid #d6dae1; border-radius:8px; cursor:pointer; }
    .bi-url-param:hover { background:#f5f7fa; }
    .bi-toggle { position:relative; display:inline-flex; align-items:center; width:44px; height:24px; cursor:pointer; }
    .bi-toggle input { position:absolute; opacity:0; width:0; height:0; }
    .bi-toggle-track { width:44px; height:24px; border-radius:12px; background:#cfd5de; transition:background .15s; position:relative; }
    .bi-toggle-track::after { content:""; position:absolute; top:2px; left:2px; width:20px; height:20px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.2); transition:transform .15s; }
    .bi-toggle input:checked + .bi-toggle-track { background:#0091ff; }
    .bi-toggle input:checked + .bi-toggle-track::after { transform:translateX(20px); }
    .bi-submit { align-self:flex-start; display:inline-flex; align-items:center; margin-top:2px; padding:11px 26px; font-size:14px; font-weight:700; color:#fff; background:#0091ff; border:none; border-radius:10px; cursor:pointer; box-shadow:0 2px 6px rgba(0,145,255,.3); font-family:inherit; }
    .bi-submit:hover { background:#007ee0; }
    /* 右: 要約パネル */
    .bi-right { position:sticky; top:16px; }
    .bi-summary { background:#fff; border:1px solid #e6e8ec; border-radius:12px; padding:18px 18px 16px; box-shadow:0 1px 3px rgba(0,0,0,.04); }
    .bi-sum-title { font-size:14px; font-weight:700; color:#1a2233; }
    .bi-sum-sub { font-size:11.5px; color:#8a94a6; margin-top:2px; }
    .bi-sum-head { margin-bottom:14px; }
    .bi-sum-group { padding:12px 0; border-top:1px solid #eef0f3; }
    .bi-sum-group:first-child { border-top:none; padding-top:0; }
    .bi-sum-gtitle { display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:#2f3a4d; margin-bottom:8px; }
    .bi-sum-row { display:flex; justify-content:space-between; gap:12px; padding:3px 0; font-size:12px; }
    .bi-sum-k { color:#8a94a6; flex-shrink:0; }
    .bi-sum-v { color:#1a2233; text-align:right; word-break:break-all; font-weight:500; }
    .bi-sum-status { display:flex; align-items:flex-start; gap:8px; margin-top:12px; padding:12px 14px; border-radius:10px; font-size:12px; line-height:1.5; }
    .bi-sum-status.ok { background:#eafaf1; color:#1a7a4f; }
    .bi-sum-status.ng { background:#fdecec; color:#c0392b; }
  `
  document.head.append(style)
}
