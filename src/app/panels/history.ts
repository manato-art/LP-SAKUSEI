/**
 * 変更・復元履歴パネル（右レール2番目「変更・復元履歴」→ パネル `バージョン復元`）。
 *
 * **手書きでUIを似せない。** 採取した実DOM（`_articleHistoryHeader_qvqhx_1` 以下）を土台に使い、
 * クラス名を目印に挙動だけを付ける（企画書 §11 の「島」の再実装）。
 * 採取元: capture/clean/ab_tests__UID__articles/tool-history/dom.html
 *
 * 実機観測（docs/findings-live-observation.md「右レール9ツール」）:
 *   ヘッダ `バージョン復元` + `戻る` / 行は「日時 + 現行版」/ ラジオで1件を選ぶ。
 *   日時書式は **ゼロ埋めなし**（例 `2026-8-31 19:41:39`）。文字列はモック側で組み立てる。
 *
 * このファイルは「エディタ本文の在り処」と「履歴APIクライアント」も持つ。
 * リンク置換パネル（link-replace.ts）が置換の前後でスナップショットを積むのに使う。
 * 依存の向きは link-replace.ts → history.ts の一方向だけ（循環させない）。
 */
import { toast } from '../ui.ts'

const API_BASE = '/api/v1'

/* ── 採取DOMの目印（実クラス名・CSS Modulesのハッシュ付き） ── */
const CLS = {
  open: '_open_x4j8w_84',
  bodyWrapper: '_bodyWrapper_x4j8w_8',
  dropdown: '_dropdown_x4j8w_1',
  darkTheme: '_darkTheme_x4j8w_116',
  header: '_articleHistoryHeader_qvqhx_1',
  btn: '_btn_1bcs1_2',
  btnXSmall: '_btnXSmall_1bcs1_27',
  btnCancel: '_btnCancel_qvqhx_12',
  btnRestore: '_btnRestore_qvqhx_8',
  list: '_articleHistoryList_qvqhx_22',
  listActive: '_active_qvqhx_31',
  info: '_articleHistoryInfo_qvqhx_35',
  radioControl: '_radioControl_10frc_1',
  /** 匿名化済みのユーティリティクラス（採取物の綴りをそのまま使う） */
  listHost: 'sample_token_caea644f',
  infoDate: 'sample_token_7efbabf9',
  infoLabel: 'sample_token_466796a9',
} as const

/** 実機で開いた時の位置（採取した inline style をそのまま使う） */
const OPEN_STYLE =
  'top: 54px; margin-top: -74.5px; left: auto; right: 30px; border-right: 8px solid transparent;'

/**
 * 採取した実マークアップ（tool-history/dom.html より切り出し）。
 * 土台のエディタDOMに同じものが既に入っているので、通常は使わないフォールバック。
 * 行（`_articleHistoryList_`）はモックの履歴件数ぶん描き足すので、ここでは空にしてある。
 */
const HISTORY_PANEL_MARKUP =
  `<div class="${CLS.bodyWrapper}" style="${OPEN_STYLE}"><div class="_body_x4j8w_8">` +
  `<div class="${CLS.header}">バージョン復元` +
  `<div class="${CLS.btn} ${CLS.btnXSmall} ${CLS.btnCancel}">戻る</div></div>` +
  `<div class="${CLS.listHost}"></div>` +
  `<div class="_arrow_x4j8w_25 _leftLowerHalf_x4j8w_62" style="top: 9px; left: auto; right: 0px;"></div>` +
  `</div></div>`

/** `現行版` は実機の表記そのまま（マイクロコピーは verbatim 保持） */
const CURRENT_LABEL = '現行版'
/** 復元ボタンの文言は採取できていない（CSSに `_btnRestore_` が在るだけ）。推定値。 */
const RESTORE_LABEL = '復元'

export interface ArticleHistoryRow {
  id: number
  article_uid: string
  version_uid: string
  recorded_at: number
  recorded_at_label: string
  is_current: boolean
}

/* ────────────────────────────────────────────────────────────
 * エディタ本文の在り処 / 履歴APIクライアント
 * ──────────────────────────────────────────────────────────── */

/**
 * LP本文（Quillの編集領域）。
 * editor.ts は採取DOMのプレビューiframeをQuillへ差し替えているので `.ql-editor` が本文。
 * 差し込み方が変わっても拾えるよう `[data-sb-lp-body]` を先に見る。
 */
export function findLpBody(root: HTMLElement): HTMLElement | null {
  return (
    root.querySelector<HTMLElement>('[data-sb-lp-body]') ??
    root.querySelector<HTMLElement>('.ql-editor')
  )
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

export function fetchArticleHistories(
  articleUid: string,
): Promise<{ histories: ArticleHistoryRow[] }> {
  return requestJson('GET', `/articles/${articleUid}/histories`)
}

/** いまの本文をスナップショットとして積む（直前と同じ内容なら積まれない） */
export function recordArticleHistory(
  articleUid: string,
  html: string,
): Promise<{ history: ArticleHistoryRow; recorded: boolean }> {
  return requestJson('POST', `/articles/${articleUid}/histories`, { html })
}

export function restoreArticleHistory(
  articleUid: string,
  id: number,
): Promise<{ html: string; css: string; restored_from: number }> {
  return requestJson('POST', `/articles/${articleUid}/histories/${id}/restore`)
}

/* ────────────────────────────────────────────────────────────
 * パネル本体
 * ──────────────────────────────────────────────────────────── */

/**
 * 履歴パネルを開く / 閉じる（右レールのアイコンから呼ばれる想定）。
 * 採取DOMの中に土台があればそれを使い、無いときだけ採取済みmarkupを差し込む。
 */
export function mountHistory(root: HTMLElement, articleUid: string): HTMLElement | null {
  const panel = resolvePanel(root)
  if (panel === null) {
    toast('変更・復元履歴パネルの土台が見つかりませんでした', 'error')
    return null
  }
  panel.setAttribute('data-sb-article-uid', articleUid)

  if (panel.getAttribute('data-sb-panel') !== 'history') {
    panel.setAttribute('data-sb-panel', 'history')
    wire(root, panel)
  }

  const willOpen = !panel.classList.contains(CLS.open)
  panel.classList.toggle(CLS.open, willOpen)
  if (!willOpen) return panel
  if (panel.getAttribute('style') === null) panel.setAttribute('style', OPEN_STYLE)
  void refresh(root, panel)
  return panel
}

function resolvePanel(root: HTMLElement): HTMLElement | null {
  const fromSubstrate =
    root.querySelector<HTMLElement>(`.${CLS.header}`)?.closest<HTMLElement>(`.${CLS.bodyWrapper}`) ??
    null
  if (fromSubstrate !== null) return fromSubstrate

  // 土台が無い環境（差し込み先が素のコンテナ）向けのフォールバック。
  // `_bodyWrapper_` のCSSは `_dropdown_` 配下にしか効かないので、同じ入れ物ごと作る。
  const host = document.createElement('div')
  host.className = `${CLS.dropdown} ${CLS.darkTheme}`
  host.setAttribute('style', 'position:fixed;top:120px;right:90px;z-index:9600')
  host.innerHTML = HISTORY_PANEL_MARKUP
  root.append(host)
  return host.querySelector<HTMLElement>(`.${CLS.bodyWrapper}`)
}

function wire(root: HTMLElement, panel: HTMLElement): void {
  const cancel = panel.querySelector<HTMLElement>(`.${CLS.btnCancel}`)
  cancel?.addEventListener('click', () => panel.classList.remove(CLS.open))

  const header = panel.querySelector<HTMLElement>(`.${CLS.header}`)
  if (header === null) return

  // `_btnRestore_qvqhx_8` はCSSにだけ在って採取時のDOMには無かった（履歴が現行版1件だけだったため）。
  // 現行版以外を選んだ時にだけ出す、という前提で足している。
  const restore = document.createElement('div')
  restore.className = `${CLS.btn} ${CLS.btnXSmall} ${CLS.btnRestore}`
  restore.textContent = RESTORE_LABEL
  restore.setAttribute('data-sb-role', 'restore')
  restore.setAttribute('hidden', '')
  header.insertBefore(restore, cancel)

  restore.addEventListener('click', () => {
    const articleUid = panel.getAttribute('data-sb-article-uid') ?? ''
    const id = Number(panel.getAttribute('data-sb-selected') ?? '')
    if (articleUid === '' || !Number.isInteger(id)) return
    void applyRestore(root, panel, articleUid, id)
  })
}

async function refresh(root: HTMLElement, panel: HTMLElement): Promise<void> {
  const articleUid = panel.getAttribute('data-sb-article-uid') ?? ''
  if (articleUid === '') return
  const body = findLpBody(root)
  try {
    // いま編集中の本文を `現行版` として先に積む（内容が同じなら積まれない）
    if (body !== null) await recordArticleHistory(articleUid, body.innerHTML)
    const { histories } = await fetchArticleHistories(articleUid)
    renderRows(panel, histories)
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}

function renderRows(panel: HTMLElement, histories: readonly ArticleHistoryRow[]): void {
  const host = panel.querySelector<HTMLElement>(`.${CLS.listHost}`)
  if (host === null) return
  host.innerHTML = ''
  for (const row of histories) host.append(buildRow(row))
  panel.setAttribute('data-sb-selected', String(histories.find((h) => h.is_current)?.id ?? ''))
  updateRestoreVisibility(panel)
}

/** 1行ぶん。採取した行構造（ラジオ + 日時 + 現行版）をそのまま組み立てる */
function buildRow(history: ArticleHistoryRow): HTMLElement {
  const node = document.createElement('div')
  node.className = history.is_current ? `${CLS.list} ${CLS.listActive}` : CLS.list
  node.setAttribute('data-sb-history-id', String(history.id))
  node.setAttribute('data-sb-current', String(history.is_current))
  node.innerHTML =
    `<div class="${CLS.radioControl}">` +
    `<input type="radio" readonly${history.is_current ? ' checked' : ''}>` +
    `<label><div class="${CLS.info}">` +
    `<div class="${CLS.infoDate}"></div><div class="${CLS.infoLabel}"></div>` +
    `</div></label></div>`

  const date = node.querySelector<HTMLElement>(`.${CLS.infoDate}`)
  if (date !== null) date.textContent = history.recorded_at_label
  const label = node.querySelector<HTMLElement>(`.${CLS.infoLabel}`)
  if (label !== null && history.is_current) label.textContent = CURRENT_LABEL

  node.addEventListener('click', () => select(node))
  return node
}

function select(node: HTMLElement): void {
  const host = node.parentElement
  const panel = node.closest<HTMLElement>(`.${CLS.bodyWrapper}`)
  if (host === null || panel === null) return
  for (const row of host.querySelectorAll<HTMLElement>(`.${CLS.list}`)) {
    const chosen = row === node
    row.classList.toggle(CLS.listActive, chosen)
    const radio = row.querySelector<HTMLInputElement>('input[type="radio"]')
    if (radio !== null) radio.checked = chosen
  }
  panel.setAttribute('data-sb-selected', node.getAttribute('data-sb-history-id') ?? '')
  updateRestoreVisibility(panel)
}

/** 選んでいるのが現行版なら復元ボタンは出さない（戻す先が無いので） */
function updateRestoreVisibility(panel: HTMLElement): void {
  const restore = panel.querySelector<HTMLElement>('[data-sb-role="restore"]')
  if (restore === null) return
  const selected = panel.getAttribute('data-sb-selected') ?? ''
  const row = panel.querySelector<HTMLElement>(`[data-sb-history-id="${selected}"]`)
  const isCurrent = row === null || row.getAttribute('data-sb-current') === 'true'
  restore.toggleAttribute('hidden', isCurrent)
}

async function applyRestore(
  root: HTMLElement,
  panel: HTMLElement,
  articleUid: string,
  id: number,
): Promise<void> {
  const body = findLpBody(root)
  if (body === null) {
    toast('LP本文が見つからないため復元できませんでした', 'error')
    return
  }
  try {
    const restored = await restoreArticleHistory(articleUid, id)
    body.innerHTML = restored.html
    const { histories } = await fetchArticleHistories(articleUid)
    renderRows(panel, histories)
    toast('選択したバージョンに戻しました')
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}
