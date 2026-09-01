/**
 * バージョンカード周りの操作（エディタ左 Version パネル・企画書 §9-1 / §11 capture-and-rehydrate）。
 *
 * **手書きでUIを似せない。** ここは採取済みの実マークアップに「挙動だけ」を付ける。
 *
 * 採取状況（src/app/fragments/ab_tests__UID__articles__editor-target.html を実測）:
 *  - task 2 の「Version ▼」一覧ドロップダウンは**採取済み**。
 *    `_dropdown_x4j8w_1 > _trigger_x4j8w_5(_articleListType_1xibh_329) > _bodyWrapper_x4j8w_8`
 *    本体に「Version」（`_active_1xibh_202`）と「アーカイブ」の2択が入っている。
 *    開閉は採取した実CSS `._bodyWrapper_x4j8w_8._open_x4j8w_84 { display:block }` だけで行う
 *    （手書きCSSを足さない）。
 *  - task 1 の「バージョンカードの複製／削除メニュー」は**未採取**。カードの「…」トリガー
 *    （`_articleButtons_1xibh_160` 内の MoreHoriz ボタン `css-3tls8`）は実在するが、そこから開く
 *    ドロップダウン本体はどの採取物にも入っていない。`_actionDropdown_1ti69`/`btnActionDuplicate`
 *    は右レール「Widget管理」側のメニュー（widget-manager.ts が担当）であって、カードのものではない。
 *    → メニューを勝手に作らず、複製/削除は**バックエンド（モックAPI）だけ**用意しておき、
 *      採取できたら本物のマークアップに結線する。ここではその純粋なリクエスト組み立てだけを提供する。
 *  - task 3 の「配信割合 (?)」ツールチップ本文も**未採取**（`data-testid="help-icon-wrapper"` は
 *    アイコンSVGのみで、`_tooltipDescription` 本体が付いていない）。文言が無いので作らない。
 */
import { toast } from '../ui.ts'

/** 採取物のクラス（実物・書き換えていない）。テストが採取HTMLと突き合わせる。 */
export const VERSION_LIST_HOOK = {
  /** Version▼ 全体 */
  dropdown: '._dropdown_x4j8w_1',
  /** トリガー内の「Version」ラベル（このドロップダウンを他の x4j8w と見分ける目印） */
  listType: '._articleListType_1xibh_329',
  /** クリックで開閉するトリガー */
  trigger: '._trigger_x4j8w_5',
  /** display を切り替える本体 */
  bodyWrapper: '._bodyWrapper_x4j8w_8',
  /** いま選ばれている選択肢に付くクラス */
  activeOption: '._active_1xibh_202',
  /** 開いたときに本体へ足すクラス（採取した実CSSが display:block にする） */
  openClass: '_open_x4j8w_84',
} as const

/** アーカイブ一覧はモックにデータが無い（採取物にも一覧マークアップが無い）ので選んだら正直に伝える */
const ARCHIVE_LABEL = 'アーカイブ'

export interface HttpRequest {
  readonly method: string
  readonly path: string
}

/** POST /versions/:uid/duplicate のリクエストを組み立てる（純粋関数・境界で検証） */
export function buildDuplicateRequest(versionUid: string): HttpRequest {
  if (versionUid.trim() === '') throw new Error('versionUid が空です')
  return { method: 'POST', path: `/versions/${versionUid}/duplicate` }
}

/** DELETE /versions/:uid のリクエストを組み立てる（純粋関数・境界で検証） */
export function buildDeleteRequest(versionUid: string): HttpRequest {
  if (versionUid.trim() === '') throw new Error('versionUid が空です')
  return { method: 'DELETE', path: `/versions/${versionUid}` }
}

/**
 * 「Version ▼」一覧ドロップダウンの開閉を配線する（task 2）。
 * 採取した土台にドロップダウンが居ることが前提（居なければ何も配線しない）。
 */
export function mountVersionListDropdown(root: HTMLElement): void {
  const listType = root.querySelector<HTMLElement>('[class*="articleListType"]')
  const dropdown = listType?.closest<HTMLElement>('[class*="dropdown_x4j8w"]') ?? null
  if (dropdown === null) {
    console.warn('[version-actions] Version一覧ドロップダウンが土台に見つからないので配線しない')
    return
  }
  if (dropdown.dataset['cloneVersionListWired'] === 'true') return
  dropdown.dataset['cloneVersionListWired'] = 'true'

  const trigger = dropdown.querySelector<HTMLElement>('[class*="trigger_x4j8w"]')
  const body = dropdown.querySelector<HTMLElement>('[class*="bodyWrapper_x4j8w"]')
  if (trigger === null || body === null) {
    console.warn('[version-actions] Version一覧ドロップダウンの trigger/body が見つからない')
    return
  }

  const isOpen = (): boolean => body.classList.contains(VERSION_LIST_HOOK.openClass)
  const open = (): void => body.classList.add(VERSION_LIST_HOOK.openClass)
  const close = (): void => body.classList.remove(VERSION_LIST_HOOK.openClass)

  trigger.style.cursor = 'pointer'
  trigger.addEventListener('click', (event) => {
    event.stopPropagation()
    if (isOpen()) close()
    else open()
  })
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    if (target !== null && dropdown.contains(target)) return
    close()
  })

  // 選択肢（本体直下の div から矢印を除いたもの）。ラベルは採取した実文言。
  const options = [...body.querySelectorAll<HTMLElement>('[class*="body_x4j8w"] > div')].filter(
    (node) => !node.className.includes('arrow_x4j8w'),
  )
  for (const option of options) {
    const label = (option.textContent ?? '').trim()
    option.style.cursor = 'pointer'
    option.addEventListener('click', () => {
      close()
      // アーカイブは一覧データが未採取・未モデル化。切り替えたふりをせず正直に伝える。
      if (label === ARCHIVE_LABEL) toast('アーカイブ一覧は未実装です', 'error')
    })
  }
}
