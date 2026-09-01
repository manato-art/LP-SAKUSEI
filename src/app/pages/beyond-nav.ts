/**
 * beyondページのサブ画面ナビの純粋ロジック（DOMもfetchも触らない）。
 *
 * エディタ上部右の3アイコン（Version編集 / Versionオプション設定 / 中間ページ）と、
 * オプション設定画面の6タブ（デバイス別 / パラメーター別 / …）は、すべて採取物では
 * 実アプリの絶対パス（`/ab_tests/…`・`/folders/…`）を指す `<a>` になっている。
 * ここでは「採取物のどの href を、クローンのどのハッシュルートへ写すか」だけを
 * 純粋関数に閉じ込めてテストする（共通指示 §5・node環境なのでDOMは触らない）。
 *
 * ルートの正本は `docs/routes.json` / `docs/findings-live-observation.md`「ナビの3リンク」:
 *   Version編集            /ab_tests/:ab_test_uid/articles#<記事uid>
 *   Versionオプション設定  /ab_tests/:ab_test_uid/articles/split_test_settings/:tab
 *   中間ページ            /folders/:folder_uid/ab_tests/:ab_test_uid/redirect_pages
 */

/** オプション設定の6タブ（採取した href の末尾セグメント・実物の順） */
export const SPLIT_TEST_TABS = [
  'devices',
  'params',
  'hours',
  'periods',
  'oses',
  'carriers',
] as const

export type SplitTestTab = (typeof SPLIT_TEST_TABS)[number]

/**
 * タブの表示名（採取した実アンカーの文言）。
 * テストで採取物のアンカー文言と機械照合するので、ここは「見出しの正本」ではなく
 * 「採取物と一致することを保証する対象」。
 */
export const SPLIT_TEST_TAB_LABELS: Readonly<Record<SplitTestTab, string>> = {
  devices: 'デバイス別',
  params: 'パラメーター別',
  hours: '時間別',
  periods: '日付別',
  oses: 'モバイルOS別',
  carriers: 'キャリア別',
}

/** 既定タブ（オプション設定アイコンの遷移先＝採取物では devices） */
export const DEFAULT_SPLIT_TEST_TAB: SplitTestTab = 'devices'

export function isSplitTestTab(tab: string): tab is SplitTestTab {
  return (SPLIT_TEST_TABS as readonly string[]).includes(tab)
}

/**
 * 採取した href から末尾のタブ名を取り出す。
 * 例: `/ab_tests/UID_1997/articles/split_test_settings/params` → `params`
 * split_test_settings のパスでなければ、または未知のタブなら `null`。
 */
export function splitTestTabFromHref(href: string): SplitTestTab | null {
  const match = /\/split_test_settings\/([a-z_]+)/.exec(href)
  const tab = match?.[1]
  if (tab === undefined || !isSplitTestTab(tab)) return null
  return tab
}

/** オプション設定タブのクローン側ハッシュルート */
export function splitTestSettingsHash(abTestUid: string, tab: SplitTestTab): string {
  return `#/ab_tests/${abTestUid}/articles/split_test_settings/${tab}`
}

/** 中間ページのクローン側ハッシュルート（実物は folder_uid を含む） */
export function redirectPagesHash(folderUid: string, abTestUid: string): string {
  return `#/folders/${folderUid}/ab_tests/${abTestUid}/redirect_pages`
}

/** Version編集（＝LPエディタ本体）のクローン側ハッシュルート */
export function editorHash(abTestUid: string): string {
  return `#/ab_tests/${abTestUid}/articles`
}

/**
 * 採取物に残る「beyondページのサブ画面ナビ」アンカーを、クローンのハッシュルートへ張り替える。
 *
 * 対象アンカーは**位置ではなく href / data-trackid で同定**する（位置は採取のたびにズレて脆い）:
 *   - `/split_test_settings/<tab>` を指す  → その tab のオプション設定へ（6タブの相互遷移もこれ）
 *   - `/redirect_pages` を含む             → 中間ページへ
 *   - `data-trackid="editor-nav-editor"` か href に `/articles#` を含む → Version編集へ
 *
 * @param scope 採取した土台（またはその一部）。この配下のアンカーだけを対象にする。
 * @returns 書き換えた件数（配線が空振りしていないかを呼び出し側で検証できる）
 */
export function wireBeyondNavAnchors(
  scope: ParentNode,
  ids: { abTestUid: string; folderUid: string },
): number {
  let rewired = 0
  for (const anchor of scope.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = anchor.getAttribute('href') ?? ''
    const trackId = anchor.getAttribute('data-trackid') ?? ''

    const tab = splitTestTabFromHref(href)
    if (tab !== null) {
      anchor.setAttribute('href', splitTestSettingsHash(ids.abTestUid, tab))
      rewired += 1
      continue
    }
    if (href.includes('/redirect_pages')) {
      anchor.setAttribute('href', redirectPagesHash(ids.folderUid, ids.abTestUid))
      rewired += 1
      continue
    }
    if (trackId === 'editor-nav-editor' || /\/articles(#|$)/.test(href)) {
      anchor.setAttribute('href', editorHash(ids.abTestUid))
      rewired += 1
      continue
    }
  }
  return rewired
}
