/**
 * リンク置換パネル（右レール4番目「リンク置換」）。
 *
 * **手書きでUIを似せない。** 採取した実DOM（`_replaceLinkContent_id5w4_76` 以下）を土台に使い、
 * クラス名を目印に挙動だけを付ける（企画書 §11 の「島」の再実装）。
 * 採取元: capture/clean/ab_tests__UID__articles/tool-link-replace/dom.html
 *
 * ## 採取できたもの / 採取できていないもの（重要）
 *
 * 採取できた実DOMは **アセット0件の空状態**だけ。具体的には
 * `_targetLinkLists_id5w4_134` の中身が `_noLinksDescription_id5w4_411`（`置き換え対象のリンクが
 * ありません`）1枚しか無い。
 *
 * `_targetLinkList_`（1行）/ `_linkHref_` / `_trackingLink_` / `_popupList_` /
 * `_popupLinkList_` / `_popupInfo_` / `_popupUrl_` / `_popupName_` / `_popupPreviewTrigger_` /
 * `_btnLinkSelectType_` / `_linkSelectDropDown_` / `_trakingListHeader_` は
 * **CSS（capture/clean/ab_tests__UID__articles/editor-target/cssom.css）にしか存在せず、採取したDOMには1件も出てこない**。
 * → **行のマークアップは不明**。CSSから形を推測して「それらしい行」を描くことはしない。
 *   リンクが在るときは一覧枠を空のままにし、`data-sb-*` に状態だけ出す（下の renderList）。
 *   行が採取できたらここに実マークアップを流し込む。
 *
 * 選択は、採取済みの `全て選択` / `選択解除`（`_btn_id5w4_117`）と
 * 絞り込みタブ（`_sortTab_id5w4_93`）だけで行う。ここは実物のボタンなので推測ではない。
 *
 * 「計測機能付きリンク」の意味と置換ロジックは src/shared/link-html.ts（実 Quill Link blot 準拠）。
 */
import { toast } from '../ui.ts'
import { ensureWhiteBase, stripDarkThemeClasses } from '../white-base.ts'
import { cleanupDropdownHost, findLpBody } from './history.ts'
import {
  buildLinkReplaceRequest,
  EMPTY_LINKS_MESSAGE,
  extractLinksFromHtml,
  filterLinks,
  isAllowedLinkUrl,
  selectableLinkIndexes,
  type LinkReplaceRequest,
  type LinkSortMode,
  type LinkTab,
  type LpLink,
  type ReplaceTargetType,
} from '../../shared/link-html.ts'

/**
 * 純粋ロジックは src/shared/link-html.ts へ移した（画面とモックサーバーで同じ実装を使うため）。
 * 既存の呼び出し元・テストが `panels/link-replace.ts` から取れる形は保つ。
 */
export {
  buildLinkReplaceRequest,
  buildReplacementHref,
  EMPTY_LINKS_MESSAGE,
  extractLinksFromHtml,
  filterLinks,
  isAllowedLinkUrl,
  isTelHref,
  isTrackingLink,
  LINK_PROTOCOL_WHITELIST,
  pickReplacementUrl,
  replaceableIndexes,
  replaceLinksInHtml,
  selectableLinkIndexes,
  TRACKING_ATTRIBUTE,
  TRACKING_PARAM,
  withTrackingParam,
} from '../../shared/link-html.ts'
export type {
  LinkReplaceFormInput,
  LinkReplaceRequest,
  LinkReplacement,
  LinkSortMode,
  LinkTab,
  LpLink,
  ReplaceTargetType,
} from '../../shared/link-html.ts'

const API_BASE = '/api/v1'

/* ────────────────────────────────────────────────────────────
 * APIクライアント（実物のエンドポイントは未採取。モックの契約は
 * mock-server/routes/panel-link-replace.ts の冒頭コメントを参照）
 * ──────────────────────────────────────────────────────────── */

interface LinkRow {
  index: number
  href: string
  text: string
  is_tracking: boolean
  is_new_tab: boolean
}

export interface RedirectPageRow {
  uid: string
  name: string
  url: string
  enabled: boolean
}

export interface ExitPopupRow {
  uid: string
  name: string
  enabled: boolean
}

interface LinkReplaceSnapshot {
  version_uid: string
  links: LinkRow[]
  redirect_pages: RedirectPageRow[]
  exit_popups: ExitPopupRow[]
}

/** POSTの本体。`html` は編集中の本文（保存前の編集を落とさないための土台） */
type LinkReplacePayload = LinkReplaceRequest & { html?: string }

interface LinkReplaceResult {
  html: string
  replaced_count: number
  links: LinkRow[]
}

async function requestJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(detail?.error?.message ?? `${method} ${path} が失敗しました (${res.status})`)
  }
  return (await res.json()) as T
}

function toLpLink(row: LinkRow): LpLink {
  return {
    index: row.index,
    href: row.href,
    text: row.text,
    isTracking: row.is_tracking,
    isNewTab: row.is_new_tab,
  }
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
const LINK_REPLACE_MARKUP = `<div class="_bodyWrapper_x4j8w_8 _open_x4j8w_84" style="top: 184px; margin-top: -204.5px; left: auto; right: 30px; border-right: 8px solid transparent;"><div class="_body_x4j8w_8"><div class="sample_token_ce149280"><div class="sample_token_2431ba36"><div class="_headerTitle_id5w4_24">リンク置換</div><div class="_tabWrapper_id5w4_28"><div class="_tab_id5w4_28 _active_id5w4_48">Version内リンク</div><div class="_tab_id5w4_28 ">離脱防止ポップアップリンク</div></div></div><div class="_replaceLinkContent_id5w4_76"><div class="_contentHeader_id5w4_87"><div class="_sortTabWrapper_id5w4_93"><div class="_sortTab_id5w4_93 _active_id5w4_48">全て</div><div class="_sortTab_id5w4_93 ">計測あり</div><div class="_sortTab_id5w4_93 ">計測なし</div></div><div class="_selectTypeBtnWrapper_id5w4_112"><div class="_btn_id5w4_117">全て選択</div><div class="_btn_id5w4_117">選択解除</div></div></div><div class="sample_token_04cc4929"><select class="_formControl_1n7ll_17"><option value="free">新しいリンク</option><option value="redirectPage">中間ページリンク</option></select></div><div class="_targetLinkLists_id5w4_134"><div class="_noLinksDescription_id5w4_411">置き換え対象のリンクがありません</div></div><div class="_popupPreviewWrapper_id5w4_188"><iframe title="sample_token_4085a19a" class="_previewIframe_id5w4_223"></iframe></div><div class="_formWrapper_id5w4_228"><div class="_linkInputWrapper_id5w4_237"><div class="_replaceLinkInput_id5w4_246"><input type="text" class="_formControl_1n7ll_17" placeholder="新規のリンクを入力"></div><div class="_btnReplace_id5w4_297 _disable_1bcs1_22 ">置換</div></div><div class="sample_token_93c0b7f0"><div class="_trackingCheckBox_id5w4_257"><label class="_checkBoxControl_1dpzf_1"><input type="checkbox" id="trackingCheckBox" checked=""><div class="_checkbox_1dpzf_16 _medium_1dpzf_44"></div></label><div class="_dropdown_x4j8w_1 _lightTheme_x4j8w_88"><div class="_trigger_x4j8w_5"><div class="_container_1uihv_1"><div class="_item_1uihv_6"><label class="_checkboxLabel_id5w4_268 " for="trackingCheckBox">計測機能付きリンクに変更</label></div><div class="_item_1uihv_6 _iconCenter_1uihv_9"><svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" class="_light_v5c05_1"><path d="M12 2C6.48583 2 2 6.48583 2 12C2 17.5142 6.48583 22 12 22C17.5142 22 22 17.5142 22 12C22 6.48583 17.5142 2 12 2ZM14.215 17.2367C13.6642 17.4533 11.755 18.365 10.655 17.3958C10.3267 17.1075 10.1633 16.7417 10.1633 16.2975C10.1633 15.4658 10.4367 14.7408 10.9292 13C11.0158 12.6708 11.1217 12.2442 11.1217 11.9058C11.1217 11.3217 10.9 11.1667 10.2992 11.1667C10.0058 11.1667 9.68083 11.2708 9.38667 11.3808L9.54917 10.715C10.205 10.4483 11.0283 10.1233 11.7333 10.1233C12.7908 10.1233 13.5692 10.6508 13.5692 11.6542C13.5692 11.9433 13.5192 12.45 13.4142 12.8L12.8058 14.9517C12.68 15.3867 12.4525 16.3458 12.805 16.63C13.1517 16.9108 13.9725 16.7617 14.3775 16.5708L14.215 17.2367ZM13.21 8.66667C12.52 8.66667 11.96 8.10667 11.96 7.41667C11.96 6.72667 12.52 6.16667 13.21 6.16667C13.9 6.16667 14.46 6.72667 14.46 7.41667C14.46 8.10667 13.9 8.66667 13.21 8.66667Z"></path></svg></div></div></div><div class="_bodyWrapper_x4j8w_8"><div class="_body_x4j8w_8"><div class="_description_1uihv_17" style="width: 360px;"><div class="sample_token_25a092c0"><div>ページ内CTRやCVRの計測をするために、Click・CVを計測するURLリンクを挿入する際は必ず「計測機能付きリンク」をチェックした状態で追加してください。同ページ内の遷移や運営者情報など、Click・CVとして計測しないURLリンクは「計測機能付きリンク」のチェックを外してから追加してください。</div></div></div><div class="_arrow_x4j8w_25"></div></div></div></div></div><div class="_targetCheckBox_id5w4_9"><label class="_checkBoxControl_1dpzf_1"><input type="checkbox" id="targetCheckBox"><div class="_checkbox_1dpzf_16 _medium_1dpzf_44"></div></label><div class="_dropdown_x4j8w_1 _lightTheme_x4j8w_88"><div class="_trigger_x4j8w_5"><div class="_container_1uihv_1"><div class="_item_1uihv_6"><label class="_checkboxLabel_id5w4_268" for="targetCheckBox">リンクを別タブで開く</label></div><div class="_item_1uihv_6 _iconCenter_1uihv_9"><svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" class="_light_v5c05_1"><path d="M12 2C6.48583 2 2 6.48583 2 12C2 17.5142 6.48583 22 12 22C17.5142 22 22 17.5142 22 12C22 6.48583 17.5142 2 12 2ZM14.215 17.2367C13.6642 17.4533 11.755 18.365 10.655 17.3958C10.3267 17.1075 10.1633 16.7417 10.1633 16.2975C10.1633 15.4658 10.4367 14.7408 10.9292 13C11.0158 12.6708 11.1217 12.2442 11.1217 11.9058C11.1217 11.3217 10.9 11.1667 10.2992 11.1667C10.0058 11.1667 9.68083 11.2708 9.38667 11.3808L9.54917 10.715C10.205 10.4483 11.0283 10.1233 11.7333 10.1233C12.7908 10.1233 13.5692 10.6508 13.5692 11.6542C13.5692 11.9433 13.5192 12.45 13.4142 12.8L12.8058 14.9517C12.68 15.3867 12.4525 16.3458 12.805 16.63C13.1517 16.9108 13.9725 16.7617 14.3775 16.5708L14.215 17.2367ZM13.21 8.66667C12.52 8.66667 11.96 8.10667 11.96 7.41667C11.96 6.72667 12.52 6.16667 13.21 6.16667C13.9 6.16667 14.46 6.72667 14.46 7.41667C14.46 8.10667 13.9 8.66667 13.21 8.66667Z"></path></svg></div></div></div><div class="_bodyWrapper_x4j8w_8"><div class="_body_x4j8w_8"><div class="_description_1uihv_17" style="width: 360px;"><div class="sample_token_25a092c0"><div>別タブで開く必要がない場合、別タブで開かないことを推奨します。同じタブで開いた方がCV計測精度を高くできます。</div></div></div><div class="_arrow_x4j8w_25"></div></div></div></div></div></div></div></div></div><div class="_arrow_x4j8w_25 _leftLowerHalf_x4j8w_62" style="top: 9.75px; left: auto; right: 0px;"></div></div></div>`

const SELECT_ALL_LABEL = '全て選択'
const SORT_MODES: readonly LinkSortMode[] = ['all', 'tracking', 'untracked']
const TABS: readonly LinkTab[] = ['version', 'exitPopup']

interface PanelState {
  readonly tab: LinkTab
  readonly sort: LinkSortMode
  readonly targetType: ReplaceTargetType
  readonly selected: ReadonlySet<number>
  readonly links: readonly LpLink[]
  readonly versionUid: string
  readonly redirectPages: readonly RedirectPageRow[]
  readonly exitPopups: readonly ExitPopupRow[]
}

const INITIAL_STATE: PanelState = {
  tab: 'version',
  sort: 'all',
  targetType: 'free',
  selected: new Set(),
  links: [],
  versionUid: '',
  redirectPages: [],
  exitPopups: [],
}

const PANEL_STATE = new WeakMap<HTMLElement, PanelState>()
/** どのVersionを対象にするか（editor.ts の現在Versionを都度読む） */
const PANEL_VERSION_SOURCE = new WeakMap<HTMLElement, () => string>()

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
export function mountLinkReplace(
  root: HTMLElement,
  articleUid: string,
  currentVersionUid?: () => string,
  onClose?: () => void,
): HTMLElement | null {
  ensureWhiteBase()
  const panel = resolvePanel(root)
  if (panel === null) {
    toast('リンク置換パネルの土台が見つかりませんでした', 'error')
    return null
  }
  // 指示116: パネルホスト（とパネル自身）のダークテーマクラスを除去して白基調にする
  const host = panel.closest<HTMLElement>('[data-clone-panel-host="link-replace"]')
  if (host !== null) stripDarkThemeClasses(host)
  stripDarkThemeClasses(panel)

  panel.setAttribute('data-clone-article-uid', articleUid)
  if (currentVersionUid !== undefined) PANEL_VERSION_SOURCE.set(panel, currentVersionUid)

  if (panel.getAttribute('data-clone-panel') !== 'link-replace') {
    panel.setAttribute('data-clone-panel', 'link-replace')
    PANEL_STATE.set(panel, INITIAL_STATE)
    wire(root, panel)
    // 指示116: 戻るボタンを追加
    wireBackButton(panel, onClose)
  }

  if (panel.getAttribute('style') === null) panel.setAttribute('style', OPEN_STYLE)
  return panel
}

/** パネルが開いた後にリンクデータを読み込む（editor.ts の toggle 後に呼ぶ） */
export function reloadLinkReplace(root: HTMLElement, panel: HTMLElement): void {
  void reload(root, panel)
}

function resolvePanel(root: HTMLElement): HTMLElement | null {
  const fromSubstrate =
    root.querySelector<HTMLElement>(`.${CLS.content}`)?.closest<HTMLElement>(`.${CLS.bodyWrapper}`) ??
    null
  if (fromSubstrate !== null) {
    // sideToolbarWrapper 内だと overflow:hidden でクリップされるため root 直下に移動
    const dropdownHost = fromSubstrate.closest<HTMLElement>(`.${CLS.dropdown}`)
    if (dropdownHost !== null && !dropdownHost.hasAttribute('data-clone-panel-host')) {
      dropdownHost.setAttribute('data-clone-panel-host', 'link-replace')
      dropdownHost.style.cssText = 'position:fixed;top:120px;right:90px;z-index:9600'
      root.append(dropdownHost)
      cleanupDropdownHost(dropdownHost)
    }
    return fromSubstrate
  }

  const host = document.createElement('div')
  host.className = `${CLS.dropdown} _lightTheme_x4j8w_88`
  host.setAttribute('data-clone-panel-host', 'link-replace')
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
      void reload(root, panel)
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
    const isSelectAll = (button.textContent ?? '').trim() === SELECT_ALL_LABEL
    button.addEventListener('click', () => {
      const current = stateOf(panel)
      patchState(panel, {
        selected: isSelectAll ? new Set(selectableLinkIndexes(current.links, current.sort)) : new Set(),
      })
      renderList(panel)
    })
  }

  const typeSelect = panel.querySelector<HTMLSelectElement>('select')
  typeSelect?.addEventListener('change', () => {
    const value: ReplaceTargetType = typeSelect.value === 'redirectPage' ? 'redirectPage' : 'free'
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

/**
 * 指示116: リンク設定パネルに戻るボタンを追加する。
 * ヘッダータイトル（「リンク置換」）の左に配置し、クリックでパネルを閉じる。
 */
function wireBackButton(panel: HTMLElement, onClose?: () => void): void {
  const header = panel.querySelector<HTMLElement>('._headerTitle_id5w4_24')
  if (header === null) return
  // ヘッダーの親ラッパーを flex にして戻るボタンを左に配置
  const wrapper = header.parentElement
  if (wrapper !== null) {
    wrapper.style.display = 'flex'
    wrapper.style.alignItems = 'center'
    wrapper.style.gap = '8px'
  }
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'sb-clone-back-btn'
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>`
  btn.addEventListener('click', () => {
    if (onClose !== undefined) {
      // パネルマネージャー経由で閉じる（内部状態を同期させる）
      onClose()
    } else {
      // fallback: パネルマネージャーが無い場合は直接クラスを操作
      panel.classList.remove(CLS.open)
    }
  })
  header.insertAdjacentElement('beforebegin', btn)
}

/**
 * 置換対象を読み直して一覧を作り直す。
 *
 * リンクは **いま編集中の本文**（Quill）から数える。保存前の編集が本文に載っている以上、
 * サーバーが持つ最後の保存内容から数えると出現順がずれて、別のリンクを置換してしまう。
 * 編集領域が無い場合（Quillを立てていない画面）だけ、サーバーが返した保存済みの一覧を使う。
 * 中間ページ / 離脱防止ポップアップの件数はサーバーだけが知っているので常にGETする。
 */
async function reload(root: HTMLElement, panel: HTMLElement): Promise<void> {
  const articleUid = panel.getAttribute('data-clone-article-uid') ?? ''
  if (articleUid === '') return
  const wanted = PANEL_VERSION_SOURCE.get(panel)?.() ?? ''
  const query = wanted === '' ? '' : `?version_uid=${encodeURIComponent(wanted)}`
  try {
    const snapshot = await requestJson<LinkReplaceSnapshot>(
      'GET',
      `/articles/${articleUid}/link_replace${query}`,
    )
    const body = findLpBody(root)
    const saved = snapshot.links.map(toLpLink)
    patchState(panel, {
      // 「離脱防止ポップアップリンク」タブの中身は未採取（実機は機能未契約でDOMを一度も出せていない）。
      // ポップアップが0件なら結果は同じ空状態、在っても行のマークアップが無いので描けない。
      links:
        stateOf(panel).tab !== 'version'
          ? []
          : body === null
            ? saved
            : extractLinksFromHtml(body.innerHTML),
      selected: new Set(),
      versionUid: snapshot.version_uid,
      redirectPages: snapshot.redirect_pages,
      exitPopups: snapshot.exit_popups,
    })
    renderList(panel)
  } catch (error) {
    // 取得できないときに古い一覧を残すと嘘になるので、空状態へ落とす
    patchState(panel, { links: [], selected: new Set() })
    renderList(panel)
    toast((error as Error).message, 'error')
  }
}

/**
 * 一覧枠の描画。
 *
 * **1行ぶんのマークアップは採取できていない**（このファイル冒頭の説明を参照）ので、
 * 行が必要なケースでは何も描かず、状態だけ `data-sb-*` に出す。
 * CSSから形を推測した「それらしい行」は作らない。
 */
function renderList(panel: HTMLElement): void {
  const lists = panel.querySelector<HTMLElement>(`.${CLS.lists}`)
  if (lists === null) return
  const state = stateOf(panel)
  const visible = filterLinks(state.links, state.sort)

  lists.innerHTML = ''
  lists.setAttribute('data-clone-tab', state.tab)
  lists.setAttribute('data-clone-link-count', String(visible.length))
  lists.setAttribute('data-clone-selected-count', String(state.selected.size))
  // 出せていないものを黙って隠さない: 件数だけは属性に出す（描く形が未採取なので描かない）
  lists.setAttribute('data-clone-exit-popup-count', String(state.exitPopups.length))
  lists.setAttribute('data-clone-redirect-page-count', String(state.redirectPages.length))

  if (visible.length === 0) {
    // 採取した空状態（`_noLinksDescription_` + 文言）だけは実物どおりに出す
    lists.removeAttribute('data-clone-row-markup')
    const empty = document.createElement('div')
    empty.className = CLS.noLinks
    empty.textContent = EMPTY_LINKS_MESSAGE
    lists.append(empty)
  } else {
    lists.setAttribute('data-clone-row-markup', 'uncaptured')
  }
  updateReplaceButton(panel)
}

/**
 * `置換` ボタンの活性。採取済みの `_disable_1bcs1_22` を付け外しするだけ。
 * `中間ページリンク` は選択肢のマークアップが未採取なので、常に不活性のまま。
 */
function updateReplaceButton(panel: HTMLElement): void {
  const button = panel.querySelector<HTMLElement>(`.${CLS.btnReplace}`)
  if (button === null) return
  button.classList.toggle(CLS.disabled, !buildRequest(panel).ok)
}

/** いまの画面状態からリクエストを組み立てる（純粋関数へ渡すだけ） */
function buildRequest(panel: HTMLElement): ReturnType<typeof buildLinkReplaceRequest> {
  const state = stateOf(panel)
  return buildLinkReplaceRequest({
    targetType: state.targetType,
    selected: [...state.selected],
    url: textInputOf(panel)?.value ?? '',
    // 中間ページの選択UIが未採取なので、いまは何も選べない（＝常に空）
    redirectPageUid: '',
    isTracking: checkboxOf(panel, 'trackingCheckBox')?.checked ?? true,
    isNewTab: checkboxOf(panel, 'targetCheckBox')?.checked ?? false,
    versionUid: state.versionUid,
  })
}

async function applyReplacement(root: HTMLElement, panel: HTMLElement): Promise<void> {
  const state = stateOf(panel)
  const articleUid = panel.getAttribute('data-clone-article-uid') ?? ''
  if (articleUid === '') return

  if (state.tab === 'exitPopup') {
    toast('離脱防止ポップアップリンクの置換は未採取のため出せません', 'error')
    return
  }
  if (state.targetType === 'redirectPage') {
    // 中間ページの一覧は取れているが、選ばせるUIのマークアップが採取できていない
    toast(
      `中間ページリンクの選択UIは未採取です（中間ページ ${String(state.redirectPages.length)}件）`,
      'error',
    )
    return
  }

  const built = buildRequest(panel)
  if (!built.ok) {
    if (built.message.includes('URL')) textInputOf(panel)?.classList.add(CLS.invalid)
    toast(built.message, 'error')
    return
  }

  const body = findLpBody(root)
  try {
    // 編集中の本文をそのまま渡す。サーバーはこれを土台に置換して Version へ保存するので、
    // 「画面だけ変わってリロードで戻る」も「保存前の編集が消える」も起きない。
    const result = await send(articleUid, {
      ...built.value,
      ...(body === null ? {} : { html: body.innerHTML }),
    })
    if (body !== null) body.innerHTML = result.html
    toast(`${String(result.replaced_count)}件のリンクを置き換えました`)
  } catch (error) {
    toast((error as Error).message, 'error')
  }
  await reload(root, panel)
}

function send(articleUid: string, request: LinkReplacePayload): Promise<LinkReplaceResult> {
  return requestJson<LinkReplaceResult>('POST', `/articles/${articleUid}/link_replace`, request)
}
