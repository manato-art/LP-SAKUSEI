/**
 * Versionオプション設定（Version出し分け）＝
 * `/ab_tests/:ab_test_uid/articles/split_test_settings/:tab`
 *
 * エディタ上部右の2番目のアイコン（Versionオプション設定）から来る画面。
 * 6タブ（デバイス別 / パラメーター別 / 時間別 / 日付別 / モバイルOS別 / キャリア別）を持ち、
 * どのタブも**別ルート**として採取済み（`src/app/fragments/…split_test_settings__<tab>.html`）。
 *
 * ## 実装方針（企画書 §11 capture-and-rehydrate）
 * 見た目は採取した実DOM＋実CSSがそのまま担う。ここで足すのは挙動だけ:
 *   - 上部バーの焼き付き値（ページ名 / フォルダ名 / 配信ステータス）をモックの値へ差し替える
 *   - 上部右3アイコン（編集 / オプション設定 / 中間ページ）をクローンのルートへ張り替える
 *   - 6タブのアンカーをクローンのルートへ張り替える（＝タブの相互遷移）
 *   - 左レール4タブ（基本情報 / Version / ポップアップ / レポート）は共有の `tab-nav.ts` で配線
 *   - 「戻る」もクローンのルートへ張り替える
 *
 * ## 採取物に無く、ここでは配線しないもの（推測で埋めない・§3-5）
 * 各タブ本文の設定UI（Version出し分けのトグル・配信割合の編集など）は、
 * 押した後にどのAPIを叩くか／保存後の状態が**採取できていない**（この画面のモックAPIも無い）。
 * よって本文は採取したまま静的に表示し、設定の保存挙動は付けない（下の NOTE 参照）。
 */
import devices from '../fragments/ab_tests__UID__articles__split_test_settings__devices.html?raw'
import params from '../fragments/ab_tests__UID__articles__split_test_settings__params.html?raw'
import hours from '../fragments/ab_tests__UID__articles__split_test_settings__hours.html?raw'
import periods from '../fragments/ab_tests__UID__articles__split_test_settings__periods.html?raw'
import oses from '../fragments/ab_tests__UID__articles__split_test_settings__oses.html?raw'
import carriers from '../fragments/ab_tests__UID__articles__split_test_settings__carriers.html?raw'
import { api } from '../api.ts'
import { isStale } from '../main.ts'
import { applyBeyondTopBar, wireBeyondBack } from './beyond-topbar.ts'
import { wireBeyondNavAnchors, type SplitTestTab } from './beyond-nav.ts'
import { stripShellFromFragment } from './report-substrate.ts'
import { wireAbTestTabs } from './tab-nav.ts'
import { toast } from '../ui.ts'

interface SplitTestRule {
  key: string
  label: string
  ratio: number
  enabled: boolean
}

/** タブ → 採取した土台。ルートで受け取ったタブに対応する断片を選ぶ。 */
const SUBSTRATE_BY_TAB: Readonly<Record<SplitTestTab, string>> = {
  devices,
  params,
  hours,
  periods,
  oses,
  carriers,
}

export async function renderSplitTestSettings(
  container: HTMLElement,
  abTestUid: string,
  tab: SplitTestTab,
  generation?: number,
): Promise<void> {
  container.innerHTML = ''

  const [{ ab_test }, { folders }] = await Promise.all([api.abTest(abTestUid), api.folders()])

  // API待ちの間に新しい描画が始まっていたら降りる（二重描画の防止・main.ts の世代トークン）
  if (generation !== undefined && isStale(generation)) return

  const folder = folders.find((f) => f.id === ab_test.folder_id) ?? null
  const folderUid = folder?.uid ?? ''

  /**
   * シェルの content は全ルートで使い回される。エディタは `height:100vh;overflow:hidden` を
   * 直接書き込むので、そこから遷移してくると本文が切れる。シェル本来の値に戻してから描く。
   */
  container.style.cssText = 'flex:1;min-width:0'

  const root = document.createElement('div')
  root.innerHTML = stripShellFromFragment(SUBSTRATE_BY_TAB[tab])
  container.append(root)

  applyBeyondTopBar(root, {
    pageName: ab_test.title,
    folderName: folder?.name ?? '',
    adStatus: ab_test.ad_status,
  })
  // 上部右3アイコン ＋ 6タブのアンカーをまとめて張り替える（href で同定・位置に依存しない）
  wireBeyondNavAnchors(root, { abTestUid, folderUid })
  // 左レール4タブは共有の配線（基本情報タブ・エディタと同じ関数）
  wireAbTestTabs(root, abTestUid, folderUid)
  wireBeyondBack(root, folderUid)
  // 出し分けトグル（オン/オフ）を実際に効かせてモックへ保存する
  void wireSplitTestToggles(root, abTestUid, tab)
}

const API_BASE = '/api/v1'

/**
 * 各行の MUI スイッチ（`.MuiSwitch-root`）を、モックの split_test_setting の rules に
 * **位置で対応づけて**配線する。オフにした対象では、このVersionを配信しない設定になる
 * （実物の「オフにしたデバイスでは他Versionを表示」に相当）。トグルのたびにモックへ PUT する。
 */
async function wireSplitTestToggles(
  root: HTMLElement,
  abTestUid: string,
  tab: SplitTestTab,
): Promise<void> {
  const switches = [...root.querySelectorAll<HTMLElement>('.MuiSwitch-root')]
  if (switches.length === 0) return

  let rules: SplitTestRule[]
  try {
    const res = await fetch(`${API_BASE}/ab_tests/${abTestUid}/split_test_settings/${tab}`)
    const body = (await res.json()) as { split_test_setting?: { rules?: SplitTestRule[] } }
    rules = [...(body.split_test_setting?.rules ?? [])]
  } catch {
    return
  }

  const setVisual = (sw: HTMLElement, on: boolean): void => {
    // MUI は switchBase の `Mui-checked` で見た目（つまみ位置・トラック色）が決まる
    sw.querySelector('.MuiSwitch-switchBase')?.classList.toggle('Mui-checked', on)
    const input = sw.querySelector<HTMLInputElement>('input')
    if (input !== null) input.checked = on
  }

  switches.forEach((sw, index) => {
    const rule = rules[index]
    if (rule === undefined) return
    setVisual(sw, rule.enabled)
    sw.addEventListener('click', (event) => {
      // ネイティブの checkbox 二重トグルを止め、rules を唯一の真実にする
      event.preventDefault()
      const next = !(rules[index]?.enabled ?? true)
      rules[index] = { ...rule, enabled: next }
      setVisual(sw, next)
      void save(abTestUid, tab, rules).then(() => {
        toast(next ? `${rule.label} をオンにしました` : `${rule.label} をオフにしました（他Versionを配信）`)
      })
    })
  })
}

async function save(abTestUid: string, tab: SplitTestTab, rules: SplitTestRule[]): Promise<void> {
  await fetch(`${API_BASE}/ab_tests/${abTestUid}/split_test_settings/${tab}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: tab, rules }),
  }).catch(() => undefined)
}
