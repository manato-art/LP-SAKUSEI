/**
 * beyondページの4タブ（基本情報 / Version / ポップアップ / レポート）の配線。
 *
 * タブのマークアップは**採取した実DOMのまま**（PC用 `hidden md:flex` とSP用 `md:hidden` の2組）。
 * 各アンカーは実物の `id`（info / version / popup / report）で識別できるので、
 * `href` をクローンのハッシュルートへ張り替えるだけにする。
 * クラス名も選択中の見た目も採取物のものを一切いじらない。
 */
import { tabHashRoutes } from './basic-info-form.ts'

type TabId = 'info' | 'version' | 'popup' | 'report'

const TAB_IDS: readonly TabId[] = ['info', 'version', 'popup', 'report']

/**
 * @param root 採取した土台を差し込んだ要素
 * @param folderUid 「基本情報」タブの遷移先に必要（実物の href もフォルダ配下）
 */
export function wireAbTestTabs(root: HTMLElement, abTestUid: string, folderUid: string): void {
  const routes = tabHashRoutes(folderUid, abTestUid)
  for (const id of TAB_IDS) {
    const anchors = root.querySelectorAll<HTMLAnchorElement>(`a[id="${id}"]`)
    if (anchors.length === 0) {
      console.warn('[tab-nav] タブ', id, 'が土台に見つかりませんでした')
      continue
    }
    for (const anchor of anchors) {
      anchor.setAttribute('href', routes[id])
    }
  }
}
