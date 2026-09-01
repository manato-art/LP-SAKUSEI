/**
 * 中間ページ（redirect_pages）＝
 * `/folders/:folder_uid/ab_tests/:ab_test_uid/redirect_pages`
 *
 * エディタ上部右の3番目のアイコン（中間ページ）から来る画面。
 * 「中間ページ」＝ `redirect_pages`（ファネルとは別物）は
 * `docs/findings-live-observation.md`「ナビの3リンク」で確定済み。
 *
 * ## 採取物が示す状態（`folders__UID__ab_tests__UID__redirect_pages__default.html`）
 * 本文は次の3要素だけ:
 *   <div class="_redirectPagesWrapper_1tjuv_1">
 *     <div class="_left_1tjuv_8"><div class="_newRedirectPage_1tjuv_78">中間ページを追加</div></div>
 *     <div class="_right_1tjuv_91"></div>   ← 詳細ペイン（空）
 *   </div>
 * ＝**中間ページが1件も無い空状態**。一覧UI・作成フォーム・モーダルは採取物に無い
 * （`data-test` 0個・`<form>`/`<input>`/モーダルのマークアップ無し）。
 *
 * ## 実装方針（企画書 §11 capture-and-rehydrate）
 * 見た目は採取した実DOM＋実CSSがそのまま担う。ここで足すのは挙動だけ:
 *   - 上部バーの焼き付き値（ページ名 / フォルダ名 / 配信ステータス）をモックの値へ差し替える
 *   - 上部右3アイコン ＋ 左レール4タブ ＋「戻る」をクローンのルートへ張り替える
 *   - 「中間ページを追加」は**押した後が採取できていない**（追加モーダルが採取物に無い）ので、
 *     それらしいフォームを作らず、未採取であることを表示する（§3-2・§3-5）
 */
import substrate from '../fragments/folders__UID__ab_tests__UID__redirect_pages__default.html?raw'
import { api } from '../api.ts'
import { isStale } from '../main.ts'
import { toast } from '../ui.ts'
import { applyBeyondTopBar, wireBeyondBack } from './beyond-topbar.ts'
import { wireBeyondNavAnchors } from './beyond-nav.ts'
import { stripShellFromFragment } from './report-substrate.ts'
import { wireAbTestTabs } from './tab-nav.ts'

/** 「中間ページを追加」ボタン（採取した実物のクラス名） */
const ADD_BUTTON = '._newRedirectPage_1tjuv_78'

export async function renderRedirectPages(
  container: HTMLElement,
  ids: { folderUid: string; abTestUid: string },
  generation?: number,
): Promise<void> {
  container.innerHTML = ''

  const [{ ab_test }, { folders }] = await Promise.all([
    api.abTest(ids.abTestUid),
    api.folders(),
  ])

  // API待ちの間に新しい描画が始まっていたら降りる（二重描画の防止・main.ts の世代トークン）
  if (generation !== undefined && isStale(generation)) return

  const folder = folders.find((f) => f.id === ab_test.folder_id) ?? null
  // ルートの folder_uid を第一に使い、モックのフォルダが引ければそちらで補う
  const folderUid = folder?.uid ?? ids.folderUid

  /**
   * シェルの content は全ルートで使い回される。エディタは `height:100vh;overflow:hidden` を
   * 直接書き込むので、そこから遷移してくると本文が切れる。シェル本来の値に戻してから描く。
   */
  container.style.cssText = 'flex:1;min-width:0'

  const root = document.createElement('div')
  root.innerHTML = stripShellFromFragment(substrate)
  container.append(root)

  applyBeyondTopBar(root, {
    pageName: ab_test.title,
    folderName: folder?.name ?? '',
    adStatus: ab_test.ad_status,
  })
  // 上部右3アイコンをクローンのルートへ張り替える（href で同定・位置に依存しない）
  wireBeyondNavAnchors(root, { abTestUid: ids.abTestUid, folderUid })
  // 左レール4タブは共有の配線（基本情報タブ・エディタと同じ関数）
  wireAbTestTabs(root, ids.abTestUid, folderUid)
  wireBeyondBack(root, folderUid)
  wireAddButton(root)
}

/**
 * 「中間ページを追加」。
 * **押した後に何が起きるかは採取できていない**（追加モーダル・作成フォームの採取物が無い）。
 * それらしいフォームを作らず、分かっていないことをそのまま画面に出す。
 */
function wireAddButton(root: HTMLElement): void {
  const button = root.querySelector<HTMLElement>(ADD_BUTTON)
  if (button === null) {
    console.warn('[redirect-pages]', ADD_BUTTON, 'が土台に見つかりませんでした')
    return
  }
  button.style.cursor = 'pointer'
  button.addEventListener('click', () => {
    toast('中間ページの追加は未採取です（追加後の画面・モーダルが採取できていないため未実装）', 'error')
  })
}
