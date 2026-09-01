/**
 * beyondページの各サブ画面（オプション設定 / 中間ページ）が共有する「上部バー」の配線。
 *
 * 上部バーのマークアップは全サブ画面で共通（`_currentAbTest_dcd38_60` 配下）で、
 * 採取した時点の値（フォルダ名 / ページ名 / 配信ステータス）が焼き付いている。
 * ここでは**採取物のクラス名だけを目印**にして、いま開いているページの値へ差し替える。
 * マークアップもCSSも一切書き換えない（企画書 §11 capture-and-rehydrate）。
 *
 * この選択子はポップアップタブ（`exit-popup.ts`）で確定済みのものと同じ。
 */

/**
 * 配信ステータスの表示名。
 * 正本は `mock-server/store/types.ts` の `AD_STATUS_LABELS`（実機観測）。
 * フロントはモックサーバーを import しない方針なので、ここに写している。
 */
export const AD_STATUS_LABELS: Readonly<Record<string, string>> = {
  prepared: '準備中',
  delivered: '配信中',
  stopping: '停止中',
  finished: '終了',
}

/** 採取DOM内の目印（実物のクラス名。改名も追加もしていない） */
export const TOP_BAR_HOOK = {
  /** 戻る（実物の href は /folders?uid=…&folder_scope=） */
  back: 'a._back_dcd38_35',
  /** 上部バー: フォルダ名（フォルダアイコンの隣の <p>） */
  folderName: '._title_dcd38_67 p',
  /** 上部バー: 配信ステータスのバッジ（disabled なボタン） */
  adStatusBadge: '._title_dcd38_67 button',
  /** 上部バー: beyondページ名（クラス名は folderName だが中身はページ名。実物のまま） */
  pageName: '._folderName_dcd38_85',
} as const

export interface TopBarValues {
  pageName: string
  folderName: string
  adStatus: string
}

/**
 * 土台の焼き付き値を、いま開いているページの値へ差し替える。
 * 見つからない目印は握りつぶさず警告する（採取物が変わったら気付けるように）。
 */
export function applyBeyondTopBar(root: HTMLElement, values: TopBarValues): void {
  setText(root, TOP_BAR_HOOK.pageName, values.pageName)
  setText(root, TOP_BAR_HOOK.folderName, values.folderName)

  const label = AD_STATUS_LABELS[values.adStatus]
  if (label === undefined) {
    console.warn('[beyond-topbar] 未知の配信ステータスです:', values.adStatus)
    return
  }
  setText(root, TOP_BAR_HOOK.adStatusBadge, label)
}

/** 「戻る」。実物は `/folders?uid=<フォルダのuid>&folder_scope=` へ戻る */
export function wireBeyondBack(root: HTMLElement, folderUid: string | null): void {
  const back = root.querySelector<HTMLAnchorElement>(TOP_BAR_HOOK.back)
  if (back === null) {
    console.warn('[beyond-topbar]', TOP_BAR_HOOK.back, 'が土台に見つかりませんでした')
    return
  }
  back.setAttribute('href', folderUid === null ? '#/folders' : `#/folders?uid=${folderUid}`)
}

function setText(root: HTMLElement, selector: string, text: string): void {
  const node = root.querySelector<HTMLElement>(selector)
  if (node === null) {
    console.warn('[beyond-topbar]', selector, 'が土台に見つかりませんでした')
    return
  }
  node.textContent = text
}
