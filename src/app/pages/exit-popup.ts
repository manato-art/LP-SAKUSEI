/**
 * ポップアップタブ（離脱防止ポップアップ）= `/ab_tests/:ab_test_uid/articles/exit_popups`
 *
 * ## この画面が「何であるか」（採取物を読んで判定した結果）
 *
 * 採取した実DOM（`src/app/fragments/ab_tests__UID__articles__exit_popups__default.html`）の
 * 本文には、機能UI（ポップアップの一覧・作成フォーム・保存ボタン）が**1つも無い**。
 * `data-test` 属性は本文に0個。あるのは次の2要素だけ:
 *
 *   <h6 class="… css-1t5yily">離脱防止機能の利用には申し込みが必要です</h6>
 *   <div class="_btn_1bcs1_2 _btnPrimary_1bcs1_74 …">担当者に問い合わせをする</div>
 *
 * つまり**機能未契約のアップセル画面**（`docs/findings-live-observation.md`「ポップアップタブ
 * ＝未契約のアップセル画面」と一致）。企画書に無い状態軸だが、実物がこうなっている以上
 * そのまま再現する（企画書 §3-5）。「本来こうあるべき」で機能画面を作り足さない。
 * 契約済みのときの画面は**採取されていない**ので、存在しないものとして扱う。
 *
 * ## 実装方針
 *
 * 見た目は採取した実DOM＋実CSSがそのまま担う（企画書 §11 capture-and-rehydrate）。
 * ここで足すのは挙動だけ:
 *   - 上部バーの焼き付き値（ページ名 / フォルダ名 / 配信ステータス）をモックの値へ差し替える
 *   - 左レール4タブは共有の `tab-nav.ts` で張り替える（基本情報タブ・エディタと同じ配線）
 *   - 「戻る」もクローンのルートへ張り替える
 *   - 「担当者に問い合わせをする」は**押した後の挙動が採取できていない**ので、
 *     それらしい遷移を作らず、未実装であることを表示する（外部へは一切出さない・§3-2）
 */
import substrate from '../fragments/ab_tests__UID__articles__exit_popups__default.html?raw'
import { api } from '../api.ts'
import { isStale } from '../main.ts'
import { toast } from '../ui.ts'
import { stripShellFromFragment } from './report-substrate.ts'
import { wireAbTestTabs } from './tab-nav.ts'

/** 採取DOM内の目印（実物のクラス名。改名も追加もしていない） */
const HOOK = {
  /** 戻る（実物の href は /folders?uid=…&folder_scope=） */
  back: 'a._back_dcd38_35',
  /** 上部バー: フォルダ名（フォルダアイコンの隣） */
  folderName: '._title_dcd38_67 p',
  /** 上部バー: 配信ステータスのバッジ（disabled なボタン） */
  adStatusBadge: '._title_dcd38_67 button',
  /** 上部バー: beyondページ名（クラス名は folderName だが中身はページ名。実物のまま） */
  pageName: '._folderName_dcd38_85',
  /** 「担当者に問い合わせをする」 */
  contact: '._btnPrimary_1bcs1_74',
} as const

/**
 * 配信ステータスの表示名。
 * 正本は `mock-server/store/types.ts` の `AD_STATUS_LABELS`（2026-08-31 実機観測）。
 * フロントはモックサーバーを import しない方針なので、ここに写している。
 */
const AD_STATUS_LABELS: Readonly<Record<string, string>> = {
  prepared: '準備中',
  delivered: '配信中',
  stopping: '停止中',
  finished: '終了',
}

export async function renderExitPopup(
  container: HTMLElement,
  abTestUid: string,
  generation?: number,
): Promise<void> {
  container.innerHTML = ''

  const [{ ab_test }, { folders }] = await Promise.all([api.abTest(abTestUid), api.folders()])

  // API待ちの間に新しい描画が始まっていたら、ここで降りる（二重描画の防止・main.ts の世代トークン）
  if (generation !== undefined && isStale(generation)) return

  const folder = folders.find((f) => f.id === ab_test.folder_id) ?? null

  /**
   * シェルの content は全ルートで使い回される。エディタは `height:100vh;overflow:hidden` を
   * 直接書き込むので、そこから遷移してくると本文が切れる。シェル本来の値に戻してから描く。
   */
  container.style.cssText = 'flex:1;min-width:0'

  const root = document.createElement('div')
  root.innerHTML = stripShellFromFragment(substrate)
  container.append(root)

  applyBakedValues(root, {
    pageName: ab_test.title,
    folderName: folder?.name ?? '',
    adStatus: ab_test.ad_status,
  })
  // 4タブの配線は共有（基本情報タブ・エディタと同じ関数）。
  // 採取物の href は採取時点の uid を指しているので、ここで必ず上書きされる。
  wireAbTestTabs(root, abTestUid, folder?.uid ?? '')
  wireBack(root, folder?.uid ?? null)
  wireContact(root)
}

interface BakedValues {
  pageName: string
  folderName: string
  adStatus: string
}

/**
 * 土台には採取した時点の値が焼き付いている。いま開いているページの値へ差し替える。
 * 見つからない目印は握りつぶさず警告する（採取物が変わったら気付けるように）。
 */
function applyBakedValues(root: HTMLElement, values: BakedValues): void {
  setText(root, HOOK.pageName, values.pageName)
  setText(root, HOOK.folderName, values.folderName)

  const label = AD_STATUS_LABELS[values.adStatus]
  if (label === undefined) {
    console.warn('[exit-popup] 未知の配信ステータスです:', values.adStatus)
    return
  }
  setText(root, HOOK.adStatusBadge, label)
}

function setText(root: HTMLElement, selector: string, text: string): void {
  const node = root.querySelector<HTMLElement>(selector)
  if (node === null) {
    console.warn('[exit-popup]', selector, 'が土台に見つかりませんでした')
    return
  }
  node.textContent = text
}

/** 「戻る」。実物は `/folders?uid=<フォルダのuid>&folder_scope=` へ戻る */
function wireBack(root: HTMLElement, folderUid: string | null): void {
  const back = root.querySelector<HTMLAnchorElement>(HOOK.back)
  if (back === null) {
    console.warn('[exit-popup]', HOOK.back, 'が土台に見つかりませんでした')
    return
  }
  back.setAttribute('href', folderUid === null ? '#/folders' : `#/folders?uid=${folderUid}`)
}

/**
 * 「担当者に問い合わせをする」。
 * **押した後に何が起きるかは採取できていない**（採取物には href も data 属性も無く、
 * 本番JSは土台化の時点で除去済み）。実物は営業への問い合わせ導線なので、
 * 押せるようにして外部へ出すことも、それらしいモーダルを作ることもしない。
 * 分かっていないことを、そのまま画面に出す。
 */
function wireContact(root: HTMLElement): void {
  const contact = root.querySelector<HTMLElement>(HOOK.contact)
  if (contact === null) {
    console.warn('[exit-popup]', HOOK.contact, 'が土台に見つかりませんでした')
    return
  }
  contact.addEventListener('click', () => {
    toast('この操作は未採取です（押した後の遷移先が分かっていないため未実装）', 'error')
  })
}
