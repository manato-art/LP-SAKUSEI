/**
 * リンク置換パネル（右レール4番目「リンク置換」）。
 *
 * **手書きでUIを似せない。** 採取した実DOM（`_replaceLinkContent_id5w4_76` 以下）を土台に使い、
 * クラス名を目印に挙動だけを付ける（企画書 §11 の「島」の再実装）。
 * 採取元: capture/clean/ab_tests__UID__articles/tool-link-replace/dom.html
 *
 * 「計測機能付きリンク」の意味は **採取した実 Quill Link blot のソース**から確定している
 * （capture/clean/ab_tests__UID__articles/editor-target/iframe0.html）:
 *   - tel: 以外 … href のクエリに `sb_tracking=true` を付ける
 *   - tel:     … `data-sb-tracking="true"` 属性を付ける
 *   - 別タブ   … `target="_blank"`（rel は実物が付けないので付けない＝勝手に改善しない）
 *   - 許可プロトコル … http / https / mailto / tel（実物にはもう1つ特定アプリのスキームが
 *     入っているが、第三者のブランド名なのでクローンには持ち込まない）
 */
import { toast } from '../ui.ts'
import { findLpBody, recordArticleHistory } from './history.ts'

/* ────────────────────────────────────────────────────────────
 * 純粋ロジック（DOMに依存しない。tests/panel-link-history.test.ts が直接叩く）
 * ──────────────────────────────────────────────────────────── */

/** 実物の Quill Link blot が使う計測フラグ */
export const TRACKING_PARAM = 'sb_tracking'
export const TRACKING_ATTRIBUTE = 'data-sb-tracking'

/** 実物の `Link.PROTOCOL_WHITELIST` 相当（特定アプリ専用スキームは除いてある） */
export const LINK_PROTOCOL_WHITELIST: readonly string[] = ['http', 'https', 'mailto', 'tel']

/** 空状態の文言（実機 verbatim） */
export const EMPTY_LINKS_MESSAGE = '置き換え対象のリンクがありません'

export type LinkSortMode = 'all' | 'tracking' | 'untracked'
export type ReplaceTargetType = 'free' | 'redirectPage'
export type LinkTab = 'version' | 'exitPopup'

export interface LpLink {
  /** 本文中の出現順（0始まり）。これが置換対象の識別子になる */
  index: number
  href: string
  text: string
  isTracking: boolean
  isNewTab: boolean
}

export interface LinkReplacement {
  href: string
  tracking: boolean
  newTab: boolean
}

interface HtmlAttribute {
  name: string
  value: string | null
}

interface AnchorTag {
  start: number
  end: number
  attrs: string
}

const NAME_START = /[A-Za-z:_@]/

function isTagBoundary(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '>' || ch === '/'
}

/** 引用符の中の `>` を終端と誤認しないタグ終端探索 */
function findTagEnd(html: string, from: number): number {
  let quote = ''
  for (let k = from; k < html.length; k += 1) {
    const ch = html.charAt(k)
    if (quote !== '') {
      if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '>') return k + 1
  }
  return -1
}

/**
 * `<a ...>` の開始タグを出現順に拾う。
 * 対象は Quill が書き出す普通のHTMLなので、コメントやCDATA内の `<a` は考慮しない（既知の限界）。
 */
function findAnchorOpenTags(html: string): AnchorTag[] {
  const out: AnchorTag[] = []
  const lower = html.toLowerCase()
  let i = lower.indexOf('<a')
  while (i >= 0) {
    if (isTagBoundary(lower.charAt(i + 2))) {
      const end = findTagEnd(html, i + 2)
      if (end > 0) {
        out.push({ start: i, end, attrs: html.slice(i + 2, end - 1) })
        i = lower.indexOf('<a', end)
        continue
      }
    }
    i = lower.indexOf('<a', i + 2)
  }
  return out
}

const ATTRIBUTE_PATTERN = /([^\s"'=<>/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g

function decodeAttributeValue(raw: string): string {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
}

function encodeAttributeValue(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseAttributes(source: string): HtmlAttribute[] {
  const out: HtmlAttribute[] = []
  ATTRIBUTE_PATTERN.lastIndex = 0
  let match = ATTRIBUTE_PATTERN.exec(source)
  while (match !== null) {
    const name = match[1]
    if (name !== undefined && NAME_START.test(name.charAt(0))) {
      const raw = match[2]
      const unquoted =
        raw === undefined
          ? null
          : raw.startsWith('"') || raw.startsWith("'")
            ? raw.slice(1, -1)
            : raw
      out.push({ name, value: unquoted === null ? null : decodeAttributeValue(unquoted) })
    }
    match = ATTRIBUTE_PATTERN.exec(source)
  }
  return out
}

function serializeAttributes(attrs: readonly HtmlAttribute[]): string {
  if (attrs.length === 0) return ''
  const body = attrs
    .map((a) => (a.value === null ? a.name : `${a.name}="${encodeAttributeValue(a.value)}"`))
    .join(' ')
  return ` ${body}`
}

function attributeValue(attrs: readonly HtmlAttribute[], name: string): string | null {
  const lower = name.toLowerCase()
  return attrs.find((a) => a.name.toLowerCase() === lower)?.value ?? null
}

/** イミュータブルに属性を差し替える（元の並び順は保つ） */
function setAttribute(
  attrs: readonly HtmlAttribute[],
  name: string,
  value: string,
): HtmlAttribute[] {
  const lower = name.toLowerCase()
  const exists = attrs.some((a) => a.name.toLowerCase() === lower)
  if (!exists) return [...attrs, { name, value }]
  return attrs.map((a) => (a.name.toLowerCase() === lower ? { name: a.name, value } : a))
}

function removeAttribute(attrs: readonly HtmlAttribute[], name: string): HtmlAttribute[] {
  const lower = name.toLowerCase()
  return attrs.filter((a) => a.name.toLowerCase() !== lower)
}

export function isTelHref(href: string): boolean {
  return /^tel:/i.test(href.trim())
}

function splitHref(href: string): { base: string; query: string; hash: string } {
  const hashAt = href.indexOf('#')
  const hash = hashAt < 0 ? '' : href.slice(hashAt)
  const withoutHash = hashAt < 0 ? href : href.slice(0, hashAt)
  const queryAt = withoutHash.indexOf('?')
  return {
    base: queryAt < 0 ? withoutHash : withoutHash.slice(0, queryAt),
    query: queryAt < 0 ? '' : withoutHash.slice(queryAt + 1),
    hash,
  }
}

/** `sb_tracking` を付けた / 外した href を返す（元の href は変更しない） */
export function withTrackingParam(href: string, tracking: boolean): string {
  const { base, query, hash } = splitHref(href)
  const params = new URLSearchParams(query)
  if (tracking) params.set(TRACKING_PARAM, 'true')
  else params.delete(TRACKING_PARAM)
  const next = params.toString()
  return `${base}${next === '' ? '' : `?${next}`}${hash}`
}

/** 計測機能付きリンクか（tel: だけ属性で、それ以外はクエリで表す＝実物の挙動） */
export function isTrackingLink(href: string, trackingAttribute: string | null): boolean {
  if (isTelHref(href)) return trackingAttribute === 'true'
  return new URLSearchParams(splitHref(href).query).has(TRACKING_PARAM)
}

/** 実物の `linkSanitize` 相当。スキーム無し（相対URL）はページのhttp(s)で解決されるので許可 */
export function isAllowedLinkUrl(url: string): boolean {
  const trimmed = url.trim()
  if (trimmed === '') return false
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(trimmed)
  if (scheme === null) return true
  const protocol = scheme[1]
  return protocol !== undefined && LINK_PROTOCOL_WHITELIST.includes(protocol.toLowerCase())
}

export function buildReplacementHref(url: string, tracking: boolean): string {
  const trimmed = url.trim()
  return isTelHref(trimmed) ? trimmed : withTrackingParam(trimmed, tracking)
}

function innerTextAfter(html: string, from: number): string {
  const closeAt = html.toLowerCase().indexOf('</a', from)
  const inner = closeAt < 0 ? html.slice(from) : html.slice(from, closeAt)
  return decodeAttributeValue(inner.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
}

/** 本文HTMLからリンクを出現順に抽出する */
export function extractLinksFromHtml(html: string): LpLink[] {
  return findAnchorOpenTags(html).map((tag, index) => {
    const attrs = parseAttributes(tag.attrs)
    const href = attributeValue(attrs, 'href') ?? ''
    return {
      index,
      href,
      text: innerTextAfter(html, tag.end),
      isTracking: isTrackingLink(href, attributeValue(attrs, TRACKING_ATTRIBUTE)),
      isNewTab: (attributeValue(attrs, 'target') ?? '').toLowerCase() === '_blank',
    }
  })
}

export function filterLinks(links: readonly LpLink[], mode: LinkSortMode): LpLink[] {
  if (mode === 'tracking') return links.filter((l) => l.isTracking)
  if (mode === 'untracked') return links.filter((l) => !l.isTracking)
  return [...links]
}

/**
 * 指定した出現順のリンクだけを置き換えた新しいHTMLを返す（元のHTMLは変更しない）。
 * href 以外の属性（`data-sb-link-name` 等）は落とさずに残す。
 */
export function replaceLinksInHtml(
  html: string,
  indexes: readonly number[],
  replacement: LinkReplacement,
): string {
  const wanted = new Set(indexes)
  const tags = findAnchorOpenTags(html)
  const href = buildReplacementHref(replacement.href, replacement.tracking)
  let out = html
  for (let i = tags.length - 1; i >= 0; i -= 1) {
    const tag = tags[i]
    if (tag === undefined || !wanted.has(i)) continue
    let attrs = setAttribute(parseAttributes(tag.attrs), 'href', href)
    attrs =
      isTelHref(href) && replacement.tracking
        ? setAttribute(attrs, TRACKING_ATTRIBUTE, 'true')
        : removeAttribute(attrs, TRACKING_ATTRIBUTE)
    attrs = replacement.newTab
      ? setAttribute(attrs, 'target', '_blank')
      : removeAttribute(attrs, 'target')
    out = `${out.slice(0, tag.start)}<a${serializeAttributes(attrs)}>${out.slice(tag.end)}`
  }
  return out
}

/* ────────────────────────────────────────────────────────────
 * パネル本体（採取DOMへの配線）
 * ──────────────────────────────────────────────────────────── */

/** 採取DOMの目印（実クラス名・CSS Modulesのハッシュ付き） */
const CLS = {
  open: '_open_x4j8w_84',
  bodyWrapper: '_bodyWrapper_x4j8w_8',
  dropdown: '_dropdown_x4j8w_1',
  darkTheme: '_darkTheme_x4j8w_116',
  content: '_replaceLinkContent_id5w4_76',
  tab: '_tab_id5w4_28',
  sortTab: '_sortTab_id5w4_93',
  active: '_active_id5w4_48',
  selectTypeBtn: '_btn_id5w4_117',
  lists: '_targetLinkLists_id5w4_134',
  row: '_targetLinkList_id5w4_134',
  rowTracking: '_trackingLink_id5w4_195',
  linkHref: '_linkHref_id5w4_156',
  noLinks: '_noLinksDescription_id5w4_411',
  inputWrapper: '_replaceLinkInput_id5w4_246',
  invalid: '_invalid_id5w4_254',
  btnReplace: '_btnReplace_id5w4_297',
  disabled: '_disable_1bcs1_22',
} as const

/** 実機で開いた時の位置（採取した inline style をそのまま使う） */
const OPEN_STYLE =
  'top: 184px; margin-top: -204.5px; left: auto; right: 30px; border-right: 8px solid transparent;'

/** 採取した実マークアップ（土台に同じものがある想定。無い環境向けのフォールバック） */
const LINK_REPLACE_MARKUP = `<div class="_bodyWrapper_x4j8w_8 _open_x4j8w_84" style="top: 184px; margin-top: -204.5px; left: auto; right: 30px; border-right: 8px solid transparent;"><div class="_body_x4j8w_8"><div class="sample_token_ce149280"><div class="sample_token_2431ba36"><div class="_headerTitle_id5w4_24">リンク置換</div><div class="_tabWrapper_id5w4_28"><div class="_tab_id5w4_28 _active_id5w4_48">Version内リンク</div><div class="_tab_id5w4_28 ">離脱防止ポップアップリンク</div></div></div><div class="_replaceLinkContent_id5w4_76"><div class="_contentHeader_id5w4_87"><div class="_sortTabWrapper_id5w4_93"><div class="_sortTab_id5w4_93 _active_id5w4_48">全て</div><div class="_sortTab_id5w4_93 ">計測あり</div><div class="_sortTab_id5w4_93 ">計測なし</div></div><div class="_selectTypeBtnWrapper_id5w4_112"><div class="_btn_id5w4_117">全て選択</div><div class="_btn_id5w4_117">選択解除</div></div></div><div class="sample_token_04cc4929"><select class="_formControl_1n7ll_17"><option value="free">新しいリンク</option><option value="redirectPage">中間ページリンク</option></select></div><div class="_targetLinkLists_id5w4_134"><div class="_noLinksDescription_id5w4_411">置き換え対象のリンクがありません</div></div><div class="_popupPreviewWrapper_id5w4_188"><iframe title="sample_token_4085a19a" class="_previewIframe_id5w4_223"></iframe></div><div class="_formWrapper_id5w4_228"><div class="_linkInputWrapper_id5w4_237"><div class="_replaceLinkInput_id5w4_246"><input type="text" class="_formControl_1n7ll_17" placeholder="新規のリンクを入力"></div><div class="_btnReplace_id5w4_297 _disable_1bcs1_22 ">置換</div></div><div class="sample_token_93c0b7f0"><div class="_trackingCheckBox_id5w4_257"><label class="_checkBoxControl_1dpzf_1"><input type="checkbox" id="trackingCheckBox" checked=""><div class="_checkbox_1dpzf_16 _medium_1dpzf_44 _darkTheme_1dpzf_37"></div></label><div class="_dropdown_x4j8w_1 _lightTheme_x4j8w_88"><div class="_trigger_x4j8w_5"><div class="_container_1uihv_1"><div class="_item_1uihv_6"><label class="_checkboxLabel_id5w4_268 " for="trackingCheckBox">計測機能付きリンクに変更</label></div><div class="_item_1uihv_6 _iconCenter_1uihv_9"><svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" class="_light_v5c05_1"><path d="M12 2C6.48583 2 2 6.48583 2 12C2 17.5142 6.48583 22 12 22C17.5142 22 22 17.5142 22 12C22 6.48583 17.5142 2 12 2ZM14.215 17.2367C13.6642 17.4533 11.755 18.365 10.655 17.3958C10.3267 17.1075 10.1633 16.7417 10.1633 16.2975C10.1633 15.4658 10.4367 14.7408 10.9292 13C11.0158 12.6708 11.1217 12.2442 11.1217 11.9058C11.1217 11.3217 10.9 11.1667 10.2992 11.1667C10.0058 11.1667 9.68083 11.2708 9.38667 11.3808L9.54917 10.715C10.205 10.4483 11.0283 10.1233 11.7333 10.1233C12.7908 10.1233 13.5692 10.6508 13.5692 11.6542C13.5692 11.9433 13.5192 12.45 13.4142 12.8L12.8058 14.9517C12.68 15.3867 12.4525 16.3458 12.805 16.63C13.1517 16.9108 13.9725 16.7617 14.3775 16.5708L14.215 17.2367ZM13.21 8.66667C12.52 8.66667 11.96 8.10667 11.96 7.41667C11.96 6.72667 12.52 6.16667 13.21 6.16667C13.9 6.16667 14.46 6.72667 14.46 7.41667C14.46 8.10667 13.9 8.66667 13.21 8.66667Z"></path></svg></div></div></div><div class="_bodyWrapper_x4j8w_8"><div class="_body_x4j8w_8"><div class="_description_1uihv_17" style="width: 360px;"><div class="sample_token_25a092c0"><div>ページ内CTRやCVRの計測をするために、Click・CVを計測するURLリンクを挿入する際は必ず「計測機能付きリンク」をチェックした状態で追加してください。同ページ内の遷移や運営者情報など、Click・CVとして計測しないURLリンクは「計測機能付きリンク」のチェックを外してから追加してください。</div></div></div><div class="_arrow_x4j8w_25"></div></div></div></div></div><div class="_targetCheckBox_id5w4_9"><label class="_checkBoxControl_1dpzf_1"><input type="checkbox" id="targetCheckBox"><div class="_checkbox_1dpzf_16 _medium_1dpzf_44 _darkTheme_1dpzf_37"></div></label><div class="_dropdown_x4j8w_1 _lightTheme_x4j8w_88"><div class="_trigger_x4j8w_5"><div class="_container_1uihv_1"><div class="_item_1uihv_6"><label class="_checkboxLabel_id5w4_268" for="targetCheckBox">リンクを別タブで開く</label></div><div class="_item_1uihv_6 _iconCenter_1uihv_9"><svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" class="_light_v5c05_1"><path d="M12 2C6.48583 2 2 6.48583 2 12C2 17.5142 6.48583 22 12 22C17.5142 22 22 17.5142 22 12C22 6.48583 17.5142 2 12 2ZM14.215 17.2367C13.6642 17.4533 11.755 18.365 10.655 17.3958C10.3267 17.1075 10.1633 16.7417 10.1633 16.2975C10.1633 15.4658 10.4367 14.7408 10.9292 13C11.0158 12.6708 11.1217 12.2442 11.1217 11.9058C11.1217 11.3217 10.9 11.1667 10.2992 11.1667C10.0058 11.1667 9.68083 11.2708 9.38667 11.3808L9.54917 10.715C10.205 10.4483 11.0283 10.1233 11.7333 10.1233C12.7908 10.1233 13.5692 10.6508 13.5692 11.6542C13.5692 11.9433 13.5192 12.45 13.4142 12.8L12.8058 14.9517C12.68 15.3867 12.4525 16.3458 12.805 16.63C13.1517 16.9108 13.9725 16.7617 14.3775 16.5708L14.215 17.2367ZM13.21 8.66667C12.52 8.66667 11.96 8.10667 11.96 7.41667C11.96 6.72667 12.52 6.16667 13.21 6.16667C13.9 6.16667 14.46 6.72667 14.46 7.41667C14.46 8.10667 13.9 8.66667 13.21 8.66667Z"></path></svg></div></div></div><div class="_bodyWrapper_x4j8w_8"><div class="_body_x4j8w_8"><div class="_description_1uihv_17" style="width: 360px;"><div class="sample_token_25a092c0"><div>別タブで開く必要がない場合、別タブで開かないことを推奨します。同じタブで開いた方がCV計測精度を高くできます。</div></div></div><div class="_arrow_x4j8w_25"></div></div></div></div></div></div></div></div></div><div class="_arrow_x4j8w_25 _leftLowerHalf_x4j8w_62" style="top: 9.75px; left: auto; right: 0px;"></div></div></div>`

const SELECT_ALL_LABEL = '全て選択'
const SORT_MODES: readonly LinkSortMode[] = ['all', 'tracking', 'untracked']
const TABS: readonly LinkTab[] = ['version', 'exitPopup']

interface PanelState {
  readonly tab: LinkTab
  readonly sort: LinkSortMode
  readonly targetType: ReplaceTargetType
  readonly selected: ReadonlySet<number>
  readonly links: readonly LpLink[]
}

const INITIAL_STATE: PanelState = {
  tab: 'version',
  sort: 'all',
  targetType: 'free',
  selected: new Set(),
  links: [],
}

const PANEL_STATE = new WeakMap<HTMLElement, PanelState>()

function stateOf(panel: HTMLElement): PanelState {
  return PANEL_STATE.get(panel) ?? INITIAL_STATE
}

/** 状態は必ず新しいオブジェクトに差し替える（§12 イミュータブル） */
function patchState(panel: HTMLElement, patch: Partial<PanelState>): PanelState {
  const next: PanelState = { ...stateOf(panel), ...patch }
  PANEL_STATE.set(panel, next)
  return next
}

/**
 * リンク置換パネルを開く / 閉じる（右レールのアイコンから呼ばれる想定）。
 * 採取DOMの中に土台があればそれを使い、無いときだけ採取済みmarkupを差し込む。
 */
export function mountLinkReplace(root: HTMLElement, articleUid: string): void {
  const panel = resolvePanel(root)
  if (panel === null) {
    toast('リンク置換パネルの土台が見つかりませんでした', 'error')
    return
  }
  panel.setAttribute('data-sb-article-uid', articleUid)

  if (panel.getAttribute('data-sb-panel') !== 'link-replace') {
    panel.setAttribute('data-sb-panel', 'link-replace')
    PANEL_STATE.set(panel, INITIAL_STATE)
    wire(root, panel)
  }

  const willOpen = !panel.classList.contains(CLS.open)
  panel.classList.toggle(CLS.open, willOpen)
  if (!willOpen) return
  if (panel.getAttribute('style') === null) panel.setAttribute('style', OPEN_STYLE)
  reload(root, panel)
}

function resolvePanel(root: HTMLElement): HTMLElement | null {
  const fromSubstrate =
    root.querySelector<HTMLElement>(`.${CLS.content}`)?.closest<HTMLElement>(`.${CLS.bodyWrapper}`) ??
    null
  if (fromSubstrate !== null) return fromSubstrate

  const host = document.createElement('div')
  host.className = `${CLS.dropdown} ${CLS.darkTheme}`
  host.setAttribute('style', 'position:fixed;top:120px;right:90px;z-index:9600')
  host.innerHTML = LINK_REPLACE_MARKUP
  root.append(host)
  const injected = host.querySelector<HTMLElement>(`.${CLS.bodyWrapper}`)
  injected?.classList.remove(CLS.open)
  return injected
}

function textInputOf(panel: HTMLElement): HTMLInputElement | null {
  return panel.querySelector<HTMLInputElement>(`.${CLS.inputWrapper} input`)
}

function checkboxOf(panel: HTMLElement, id: string): HTMLInputElement | null {
  return panel.querySelector<HTMLInputElement>(`input[id="${id}"]`)
}

function wire(root: HTMLElement, panel: HTMLElement): void {
  const tabs = [...panel.querySelectorAll<HTMLElement>(`.${CLS.tab}`)]
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => {
      patchState(panel, { tab: TABS[index] ?? 'version', selected: new Set() })
      for (const other of tabs) other.classList.toggle(CLS.active, other === tab)
      reload(root, panel)
    })
  }

  const sortTabs = [...panel.querySelectorAll<HTMLElement>(`.${CLS.sortTab}`)]
  for (const [index, sortTab] of sortTabs.entries()) {
    sortTab.addEventListener('click', () => {
      patchState(panel, { sort: SORT_MODES[index] ?? 'all' })
      for (const other of sortTabs) other.classList.toggle(CLS.active, other === sortTab)
      renderList(panel)
    })
  }

  for (const button of panel.querySelectorAll<HTMLElement>(`.${CLS.selectTypeBtn}`)) {
    const selectAll = (button.textContent ?? '').trim() === SELECT_ALL_LABEL
    button.addEventListener('click', () => {
      const current = stateOf(panel)
      const visible = filterLinks(current.links, current.sort)
      patchState(panel, {
        selected: selectAll ? new Set(visible.map((l) => l.index)) : new Set(),
      })
      renderList(panel)
    })
  }

  const typeSelect = panel.querySelector<HTMLSelectElement>('select')
  typeSelect?.addEventListener('change', () => {
    const value = typeSelect.value === 'redirectPage' ? 'redirectPage' : 'free'
    patchState(panel, { targetType: value })
    updateReplaceButton(panel)
  })

  const input = textInputOf(panel)
  input?.addEventListener('input', () => {
    const value = input.value
    input.classList.toggle(CLS.invalid, value.trim() !== '' && !isAllowedLinkUrl(value))
    updateReplaceButton(panel)
  })

  for (const id of ['trackingCheckBox', 'targetCheckBox']) {
    checkboxOf(panel, id)?.addEventListener('change', () => updateReplaceButton(panel))
  }

  panel.querySelector<HTMLElement>(`.${CLS.btnReplace}`)?.addEventListener('click', () => {
    void applyReplacement(root, panel)
  })
}

/** 本文からリンクを読み直して一覧を作り直す */
function reload(root: HTMLElement, panel: HTMLElement): void {
  const state = stateOf(panel)
  // 離脱防止ポップアップのリンクはクローンに実体が無い（採取もしていない）ので空状態のまま
  const body = state.tab === 'version' ? findLpBody(root) : null
  const links = body === null ? [] : extractLinksFromHtml(body.innerHTML)
  patchState(panel, { links, selected: new Set() })
  renderList(panel)
}

function renderList(panel: HTMLElement): void {
  const lists = panel.querySelector<HTMLElement>(`.${CLS.lists}`)
  if (lists === null) return
  const state = stateOf(panel)
  const visible = filterLinks(state.links, state.sort)

  lists.innerHTML = ''
  if (visible.length === 0) {
    const empty = document.createElement('div')
    empty.className = CLS.noLinks
    empty.textContent = EMPTY_LINKS_MESSAGE
    lists.append(empty)
  } else {
    for (const link of visible) lists.append(buildRow(panel, link, state.selected.has(link.index)))
  }
  updateReplaceButton(panel)
}

/**
 * 1行ぶん。採取CSSが示す構造（チェックボックス + `_linkHref_`、計測リンクは行に
 * `_trackingLink_` が付いてアイコンが出る）をそのまま組み立てる。
 * 実CSSで行内の input は `pointer-events:none` なので、行クリックで選択を切り替える。
 */
function buildRow(panel: HTMLElement, link: LpLink, checked: boolean): HTMLElement {
  const node = document.createElement('div')
  node.className = link.isTracking ? `${CLS.row} ${CLS.rowTracking}` : CLS.row
  node.setAttribute('data-sb-link-index', String(link.index))
  node.setAttribute('title', link.text === '' ? link.href : `${link.text} — ${link.href}`)
  node.innerHTML = `<input type="checkbox"${checked ? ' checked' : ''}><div class="${CLS.linkHref}"></div>`
  const href = node.querySelector<HTMLElement>(`.${CLS.linkHref}`)
  if (href !== null) href.textContent = link.href

  node.addEventListener('click', () => {
    const selected = new Set(stateOf(panel).selected)
    if (selected.has(link.index)) selected.delete(link.index)
    else selected.add(link.index)
    patchState(panel, { selected })
    renderList(panel)
  })
  return node
}

function updateReplaceButton(panel: HTMLElement): void {
  const button = panel.querySelector<HTMLElement>(`.${CLS.btnReplace}`)
  if (button === null) return
  const state = stateOf(panel)
  const url = textInputOf(panel)?.value ?? ''
  const ready = state.selected.size > 0 && isAllowedLinkUrl(url)
  button.classList.toggle(CLS.disabled, !ready)
}

async function applyReplacement(root: HTMLElement, panel: HTMLElement): Promise<void> {
  const state = stateOf(panel)
  const input = textInputOf(panel)
  const url = input?.value ?? ''

  if (state.targetType === 'redirectPage') {
    toast('中間ページリンクへの置換は未実装です（この状態は未採取）', 'error')
    return
  }
  if (state.selected.size === 0) {
    toast('置き換えるリンクを選択してください', 'error')
    return
  }
  if (!isAllowedLinkUrl(url)) {
    input?.classList.add(CLS.invalid)
    toast('置き換え先のURLを正しく入力してください', 'error')
    return
  }

  const body = findLpBody(root)
  if (body === null) {
    toast('LP本文が見つからないため置換できませんでした', 'error')
    return
  }

  const before = body.innerHTML
  const after = replaceLinksInHtml(before, [...state.selected], {
    href: url,
    tracking: checkboxOf(panel, 'trackingCheckBox')?.checked ?? true,
    newTab: checkboxOf(panel, 'targetCheckBox')?.checked ?? false,
  })

  const articleUid = panel.getAttribute('data-sb-article-uid') ?? ''
  try {
    // 置換前後を履歴に積む → 変更・復元履歴パネルから戻せるようにする
    if (articleUid !== '') await recordArticleHistory(articleUid, before)
    body.innerHTML = after
    if (articleUid !== '') await recordArticleHistory(articleUid, after)
    toast(`${state.selected.size}件のリンクを置き換えました`)
  } catch (error) {
    toast((error as Error).message, 'error')
  }
  reload(root, panel)
}
