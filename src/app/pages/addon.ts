/**
 * 拡張機能（`/addon/option-list`）＝アドオンのカタログ画面。
 *
 * 見た目は採取した実DOM＋実CSS（`capture/clean/addon__option-list/default/`）が担保し、
 * ここは「挙動だけ」を後付けする（企画書 §11 capture-and-rehydrate）。
 *
 * ## 採取物の実態（推測で埋めない・共通指示 §1-5）
 * - 左のカタログは MUI の `role="button"` のカード。**アンカー（#mcp 等）は採取物に無い。**
 * - 右の詳細パネルは「AI対応（MCP）」の1枚だけが採取されている。他カードの詳細は未採取。
 * - よってカードを押しても切り替える詳細が無い → 未採取である旨をトーストで正直に伝える。
 * - 「トライアルで利用する」は申込＝POST相当なので実行しない（押すと未実装トースト）。
 */
import fragment from '../fragments/addon__option-list__default.html?raw'
import { stripGlobalSidebar } from './sidebar-shell.ts'
import { toast } from '../ui.ts'

export function renderAddon(container: HTMLElement): void {
  // エディタが `height:100vh;overflow:hidden` を残すので、縦に伸びるこの画面では戻す
  container.style.cssText = 'flex:1;min-width:0'
  container.innerHTML = ''

  const root = document.createElement('div')
  root.innerHTML = stripGlobalSidebar(fragment)
  container.append(root)

  wireCatalogCards(root)
  wireTrialButtons(root)
  disableStrayAnchors(root)
}

/** 左のカタログカード（role="button"）。詳細は MCP の1枚しか採取していないので切替はしない。 */
function wireCatalogCards(root: HTMLElement): void {
  for (const card of root.querySelectorAll<HTMLElement>('[role="button"]')) {
    card.addEventListener('click', () => {
      toast('この項目の詳細ページは採取していません（この画面はMCPの詳細のみ採取済み）', 'error')
    })
  }
}

/** 「トライアルで利用する」＝申込（POST相当）。押しても実行しない。 */
function wireTrialButtons(root: HTMLElement): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>('button')) {
    if ((button.textContent ?? '').includes('トライアルで利用する')) {
      button.addEventListener('click', () => {
        toast('この操作（トライアル申込）はモックでは未実装です', 'error')
      })
    }
  }
}

/** 採取物に外部リンクが残っていた場合にクローンの外へ出さない（現状は0件だが防御的に） */
function disableStrayAnchors(root: HTMLElement): void {
  for (const anchor of root.querySelectorAll('a')) {
    anchor.addEventListener('click', (e) => e.preventDefault())
  }
}
