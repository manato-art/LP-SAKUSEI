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
import { DELIVERY_DOMAIN_UNSET_NOTE, deliveryUrlFor } from '../pages/basic-info-form.ts'

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
 * コピーする Versionリンクを組み立てる（純粋関数・境界で検証）。
 *
 * 実物の「Versionリンク」は配信URLにステップを添えた `…?step_uid=<ステップ>` の形。
 * LPの中のボタンにこのリンクを置くと、そのステップへ進む（どのVersionを出すかは配信割合で決まる）。
 * 以前は `?version=` を付けていて、配信はそれを読まずに1つ目のステップを出していた（2026-09-24 点検25）。
 * 配信URL（フォルダのドメイン）は呼び出し側が basic-info-form.ts の deliveryUrlFor で作る。
 */
export function buildVersionLinkUrl(deliveryUrl: string, stepUid: string): string {
  if (deliveryUrl.trim() === '') throw new Error('配信URLがありません（フォルダのドメインが未設定）')
  return stepUid.trim() === '' ? deliveryUrl : `${deliveryUrl}?step_uid=${encodeURIComponent(stepUid)}`
}

export interface VersionLinkDeps {
  /** 配信URL（フォルダのドメイン未設定なら null） */
  getDeliveryUrl: () => string | null
  /** いま開いているステップの uid（切替に追従するため getter） */
  getStepUid: () => string
}

/** エディタから渡すもの: 配信URLはフォルダのドメインで決まり、ステップは今開いているもの（点検25） */
export function editorVersionLinkDeps(ctx: {
  readonly folderDomain?: string
  readonly abTestUid: string
  readonly articleUid: string
}): VersionLinkDeps {
  return {
    getDeliveryUrl: () => deliveryUrlFor(ctx.folderDomain, location.origin, ctx.abTestUid),
    getStepUid: () => ctx.articleUid,
  }
}

/** 吹き出しの入力欄に入れる文字（ドメイン未設定なら、URLの代わりに案内を出してコピーさせない） */
function linkText(deps: VersionLinkDeps): { value: string; canCopy: boolean } {
  const base = deps.getDeliveryUrl()
  if (base === null) return { value: DELIVERY_DOMAIN_UNSET_NOTE, canCopy: false }
  return { value: buildVersionLinkUrl(base, deps.getStepUid()), canCopy: true }
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
  let canCopy = false
  const setUrl = (): void => {
    if (input === null) return
    const text = linkText(deps)
    input.value = text.value
    canCopy = text.canCopy
  }
  const open = (): void => {
    setUrl()
    popup.setAttribute(VERSION_LINK_HOOK.hideAttr, 'false')
  }
  const close = (): void => {
    popup.setAttribute(VERSION_LINK_HOOK.hideAttr, 'true')
  }

  // 2026-09-15: ステップ一覧を描き直すとこのトリガー（ステップの節）は入れ替わるので、
  // 開け閉ては `toggleVersionLinkPopup` から呼べるようにしてある。
  // ここでの配線は、一覧を描く前に押したときのための保険。
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
    if (!canCopy) {
      toast(DELIVERY_DOMAIN_UNSET_NOTE, 'error')
      return
    }
    void copyToClipboard(input?.value ?? '')
  })
  // 入力欄クリックで全選択（実物と同じ体験）
  input?.addEventListener('click', () => input.select())
}

/**
 * Versionリンクの吹き出しを開け閉てする。
 *
 * 下部バーのステップ一覧を描き直すと、採取物のトリガー（ステップの節）ごと入れ替わる。
 * いま開いているステップをもう一度押したときに、ここから開ける。
 */
export function toggleVersionLinkPopup(root: HTMLElement, deps: VersionLinkDeps): void {
  const popup = root.querySelector<HTMLElement>(VERSION_LINK_HOOK.popup)
  if (popup === null) return
  const open = popup.getAttribute(VERSION_LINK_HOOK.hideAttr) === 'false'
  if (open) {
    popup.setAttribute(VERSION_LINK_HOOK.hideAttr, 'true')
    return
  }
  const input = popup.querySelector<HTMLInputElement>(VERSION_LINK_HOOK.input)
  if (input !== null) input.value = linkText(deps).value
  popup.setAttribute(VERSION_LINK_HOOK.hideAttr, 'false')
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
