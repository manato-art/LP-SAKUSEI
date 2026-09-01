/**
 * 下部バーの「Versionリンク」コピー popup（企画書 §11 capture-and-rehydrate）。
 *
 * **手書きでUIを似せない。** popup 本体は採取した実DOM
 * `fragments/ab_tests__UID__articles__bottom-version-link.html` に写っている
 * `sample_token_f10a0553`（`_funnelStepWrapper_rugej_1` 内）で、これは editor-target の
 * 土台にも同じ形で入っている（既定は `data-is-hide-opacity="true"` で隠れている）。
 * 開閉は採取物と同じく **`data-is-hide-opacity` 属性 + `left` 位置** だけで行う（CSSは書かない）。
 * 見た目は index.html が読み込む editor-target の実CSSが担保する。
 *
 * トリガー: 下部バーの home（ファネルステップ）ノード `_funneStepList_rugej_35`。
 *   実物の「リンクアイコン」はこのノード上にホバー時だけ現れる子要素で、静的採取物には
 *   含まれていない（`_iconParent_rugej_56` / `_listOption_rugej_99` は空で採取）。そのため
 *   採取物に確実に在るこのノードをトリガーにする（＝home の位置に在るものを押すと開く）。
 */
import { toast } from '../ui.ts'

/** 採取物の目印（実物のクラス／属性。書き換えていない） */
export const VERSION_LINK_HOOK = {
  /** popup 本体（開閉する要素） */
  popup: '._funnelStepWrapper_rugej_1 [class*="sample_token"][data-is-hide-opacity]',
  /** 隠す/出すを切り替える属性（採取物と同じ） */
  hideAttr: 'data-is-hide-opacity',
  /** popup 見出し（「Versionリンク」＋「コピーする」span） */
  title: '._title_rugej_133',
  /** URL 入力欄（採取物では readonly） */
  input: '#versionLink',
  /** トリガー（home ＝ ファネルステップの active ノード） */
  trigger: '._funneStepList_rugej_35',
} as const

/**
 * コピーする Version リンクを組み立てる（純粋関数・境界で検証）。
 * 実LPのURLは採取物では架空化済みなので**転記しない**。クローンのプレビュー系URLを作る
 * （openPreview の配信URLと同じ `#/ab/:abTestUid` 系列・§3-2 localhost固定）。
 */
export function buildVersionLinkUrl(origin: string, abTestUid: string, versionUid: string): string {
  if (abTestUid.trim() === '') throw new Error('abTestUid が空です')
  const base = `${origin}/#/ab/${abTestUid}`
  return versionUid.trim() === '' ? base : `${base}?version=${versionUid}`
}

export interface VersionLinkDeps {
  abTestUid: string
  /** いま開いている Version の uid を返す（切替に追従するため getter） */
  getCurrentUid: () => string
}

/**
 * 下部バーの home ノードに Versionリンク popup を配線する。
 * 土台に popup とトリガーが居ることが前提（居なければ何も配線しない）。
 */
export function mountVersionLinkPopup(root: HTMLElement, deps: VersionLinkDeps): void {
  const popup = root.querySelector<HTMLElement>(VERSION_LINK_HOOK.popup)
  const trigger = root.querySelector<HTMLElement>(VERSION_LINK_HOOK.trigger)
  if (popup === null || trigger === null) {
    console.warn('[version-link-popup] popup またはトリガーが土台に見つかりませんでした')
    return
  }
  if (trigger.dataset['cloneVersionLinkWired'] === 'true') return
  trigger.dataset['cloneVersionLinkWired'] = 'true'
  trigger.style.cursor = 'pointer'

  const input = popup.querySelector<HTMLInputElement>(VERSION_LINK_HOOK.input)

  const isOpen = (): boolean => popup.getAttribute(VERSION_LINK_HOOK.hideAttr) === 'false'
  const setUrl = (): void => {
    if (input === null) return
    input.value = buildVersionLinkUrl(location.origin, deps.abTestUid, deps.getCurrentUid())
  }
  const open = (): void => {
    setUrl()
    popup.setAttribute(VERSION_LINK_HOOK.hideAttr, 'false')
  }
  const close = (): void => {
    popup.setAttribute(VERSION_LINK_HOOK.hideAttr, 'true')
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation()
    if (isOpen()) close()
    else open()
  })

  // popup 内クリックは閉じない・外側クリックで閉じる
  popup.addEventListener('click', (event) => event.stopPropagation())
  document.addEventListener('click', () => {
    if (isOpen()) close()
  })

  // 「コピーする」（見出しの span）でクリップボードへ
  const copyLabel = popup.querySelector<HTMLElement>(`${VERSION_LINK_HOOK.title} span`)
  copyLabel?.addEventListener('click', (event) => {
    event.stopPropagation()
    void copyToClipboard(input?.value ?? '')
  })
  // 入力欄クリックで全選択（実物と同じ体験）
  input?.addEventListener('click', () => input.select())
}

async function copyToClipboard(text: string): Promise<void> {
  if (text === '') {
    toast('コピーするリンクがありません', 'error')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    toast('Versionリンクをコピーしました')
  } catch {
    toast('コピーできませんでした', 'error')
  }
}
