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
import { api, type Version } from '../api.ts'
import { isStale } from '../main.ts'
import { applyBeyondTopBar, wireBeyondBack } from './beyond-topbar.ts'
import { wireBeyondNavAnchors, type SplitTestTab } from './beyond-nav.ts'
import { applyLightTheme } from './report-dom.ts'
import { stripShellFromFragment } from './report-substrate.ts'
import { wireAbTestTabs, setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'
import { toast } from '../ui.ts'


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
  setupHorizTabs(root, 'split-test', { abTestUid, folderUid })
  // 指示86: navWrapper の親に flex-column を設定し、採取CSSのレイアウト干渉を防ぐ
  const navWrapper86 = root.querySelector<HTMLElement>('[class*="_navArticleWrapper_"]')
  if (navWrapper86?.parentElement !== null && navWrapper86?.parentElement !== undefined) {
    navWrapper86.parentElement.style.display = 'flex'
    navWrapper86.parentElement.style.flexDirection = 'column'
    navWrapper86.parentElement.style.background = '#fff'
  }
  setupBreadcrumb(root, folder?.name ?? '', ab_test.title, folder?.uid)
  wireBeyondBack(root, folderUid)
  applyLightTheme(root)
  // 指示123: Emotion直書きのダーク背景を白基調に上書き
  applySplitTestWhiteTheme(root)
  // タブ名「パラメーター別」→「流入元別」に変更（わかりやすさ優先）
  renameParamTab(root)
  // 出し分けトグル（オン/オフ）を実際に効かせてモックへ保存する。
  // デバイス別は **Version単位**（FAQ: 出し分けロジック＝配信割合 × デバイス別ON/OFF の掛け算）。
  if (tab === 'devices') {
    void wireDeviceTargets(root, abTestUid)
  } else {
    void wireSplitTestToggles(root, abTestUid, tab)
  }
}

/** MUIスイッチの見た目（つまみ位置・トラック色）を on/off に合わせる。 */
function setSwitch(sw: HTMLElement, on: boolean): void {
  sw.querySelector('.MuiSwitch-switchBase')?.classList.toggle('Mui-checked', on)
  const input = sw.querySelector<HTMLInputElement>('input')
  if (input !== null) input.checked = on
}

const DEVICE_KEYS: readonly ('sp' | 'tablet' | 'pc')[] = ['sp', 'tablet', 'pc']
const DEVICE_LABELS = { sp: 'スマートフォン', tablet: 'タブレット', pc: 'デスクトップ' } as const
const VERSION_NAME_CELL = '.css-10qqjzd'
const VERSION_RATIO_CELL = '.css-1aqqee4'

/**
 * デバイス別タブの**Version一覧を全Versionぶん描く**（指示⑭: 複製した版もここに増える）。
 * 採取物には版行が1つ（Ver.3873）しか無いので、それを雛形に version の数だけ複製し、
 * 各行の3スイッチ（スマホ/タブレット/デスクトップ）をその版の device_targets に配線する。
 *
 * 版行の同定は Emotion クラスの直指定を避け、**構造**で行う:
 *   版名セル（.css-10qqjzd）→ その祖先を上り、デバイス見出し（スマートフォン等）を内包する
 *   コンテナに達したら、その直下で版名を含む子＝「1版の行」。行はコンテナ直下に兄弟として並ぶ。
 */
async function wireDeviceTargets(root: HTMLElement, abTestUid: string): Promise<void> {
  const nameCell = root.querySelector<HTMLElement>(VERSION_NAME_CELL)
  if (nameCell === null) return
  let container: HTMLElement | null = nameCell.parentElement
  while (container !== null && !/スマートフォン/.test(container.textContent ?? '')) {
    container = container.parentElement
  }
  if (container === null) return
  const templateRow = [...container.children].find((c) => c.contains(nameCell))
  if (!(templateRow instanceof HTMLElement)) return

  const { articles } = await api.articles(abTestUid)
  const articleUid = articles[0]?.uid
  if (articleUid === undefined) return
  const { versions } = await api.versions(articleUid)
  const alive = versions.filter((v) => v.archived !== true)
  if (alive.length === 0) return

  const pristine = templateRow.cloneNode(true) as HTMLElement
  templateRow.remove()
  for (let i = 0; i < alive.length; i++) {
    const version = alive[i]!
    const row = pristine.cloneNode(true) as HTMLElement
    wireDeviceRow(row, version)
    // 指示69: 版行を詰めて表示（実物のように行をコンパクトに並べる）
    // 採取CSSの .css-1q0mywx は min-height:300px を持ち、各行が巨大になる。
    // また .css-1r20ns4 の padding-bottom:20px が名前欄を間延びさせる。
    // 最終行だけ底のborder-radiusを残し、他は0にして行を連結する。
    const toggleArea = row.querySelector<HTMLElement>('.css-1q0mywx')
    if (toggleArea !== null) {
      toggleArea.style.minHeight = 'auto'
      toggleArea.style.borderRadius = i === alive.length - 1 ? '0 0 10px 10px' : '0'
    }
    const nameWrapper = row.querySelector<HTMLElement>('.css-1r20ns4')
    if (nameWrapper !== null) nameWrapper.style.paddingBottom = '0'
    container.append(row)
  }
}

/** 版行1つ：Ver名・配信割合を差し込み、3スイッチをその版の device_targets に配線する */
function wireDeviceRow(row: HTMLElement, version: {
  uid: string
  name: string
  distribution_ratio: number
  device_targets?: { sp: boolean; tablet: boolean; pc: boolean }
}): void {
  const nameCell = row.querySelector<HTMLElement>(VERSION_NAME_CELL)
  const ratioCell = row.querySelector<HTMLElement>(VERSION_RATIO_CELL)
  if (nameCell !== null) {
    nameCell.textContent = version.name
    // 指示㊼: 版名セルの幅を制限（広がりすぎないように）
    nameCell.style.maxWidth = '120px'
    nameCell.style.overflow = 'hidden'
    nameCell.style.textOverflow = 'ellipsis'
    nameCell.style.whiteSpace = 'nowrap'
  }
  if (ratioCell !== null) {
    ratioCell.textContent = String(version.distribution_ratio)
    ratioCell.style.maxWidth = '60px'
  }
  // 指示㊼: 版行全体の幅を制限
  row.style.maxWidth = '100%'

  const targets = {
    sp: version.device_targets?.sp !== false,
    tablet: version.device_targets?.tablet !== false,
    pc: version.device_targets?.pc !== false,
  }
  const switches = [...row.querySelectorAll<HTMLElement>('.MuiSwitch-root')]
  switches.forEach((sw, index) => {
    const key = DEVICE_KEYS[index]
    if (key === undefined) return
    setSwitch(sw, targets[key])
    sw.addEventListener('click', (event) => {
      event.preventDefault()
      targets[key] = !targets[key]
      setSwitch(sw, targets[key])
      void api.setDeviceTargets(version.uid, targets).then(() => {
        toast(
          targets[key]
            ? `${version.name}: ${DEVICE_LABELS[key]}へ配信します`
            : `${version.name}: ${DEVICE_LABELS[key]}では配信しません（他Versionを表示）`,
        )
      })
    })
  })
}

/**
 * 各行の MUI スイッチ（`.MuiSwitch-root`）を、モックの split_test_setting の rules に
 * **位置で対応づけて**配線する。オフにした対象では、このVersionを配信しない設定になる
 * （実物の「オフにしたデバイスでは他Versionを表示」に相当）。トグルのたびにモックへ PUT する。
 *
 * 指示㊽: デバイス別と同じく、作成した全Versionを表示する。
 */
async function wireSplitTestToggles(
  root: HTMLElement,
  abTestUid: string,
  tab: SplitTestTab,
): Promise<void> {
  // ── 版行を全版ぶん描き、版ごとに設定を保存する配線を付ける ──
  await wireTabVersionRows(root, abTestUid, (row, version) => {
    if (tab === 'oses') wireToggleRow(row, version, ['android', 'ios'], 'os_targets')
    else if (tab === 'carriers') wireToggleRow(row, version, ['docomo', 'au', 'softbank'], 'carrier_targets')
    else if (tab === 'params') wireParamRow(row, version)
    else if (tab === 'hours') wirePeriodRow(row, version, 'time')
    else if (tab === 'periods') wirePeriodRow(row, version, 'date')
  })
}

/** MUIスイッチの見た目を on/off に合わせる（switchBase の Mui-checked と隠しinput）。 */
function setSwitchVisual(sw: HTMLElement, on: boolean): void {
  sw.querySelector('.MuiSwitch-switchBase')?.classList.toggle('Mui-checked', on)
  const input = sw.querySelector<HTMLInputElement>('input')
  if (input !== null) input.checked = on
}

/**
 * モバイルOS別/キャリア別: 行内のスイッチを keys の順（位置）で対応づけ、
 * クリックのたびに版の os_targets / carrier_targets を保存する。
 * 既定は全OFF（＝制限なし。ONにした対象だけに絞り込む）。
 */
function wireToggleRow(
  row: HTMLElement,
  version: Version,
  keys: readonly string[],
  field: 'os_targets' | 'carrier_targets',
): void {
  const switches = [...row.querySelectorAll<HTMLElement>('.MuiSwitch-root')]
  const saved = (version[field] ?? null) as Record<string, boolean> | null
  const state: Record<string, boolean> = {}
  for (const k of keys) state[k] = saved?.[k] ?? false
  switches.forEach((sw, i) => {
    const key = keys[i]
    if (key === undefined) return
    setSwitchVisual(sw, state[key] ?? false)
    sw.addEventListener('click', (event) => {
      event.preventDefault()
      state[key] = !(state[key] ?? false)
      setSwitchVisual(sw, state[key] ?? false)
      void api.setVersionTargeting(version.uid, { [field]: { ...state } }).then(() => {
        const label = TOGGLE_LABELS[key] ?? key
        toast(state[key] ? `${version.name}: ${label} をオンにしました` : `${version.name}: ${label} をオフにしました`)
      })
    })
  })
}

const TOGGLE_LABELS: Readonly<Record<string, string>> = {
  android: 'Android',
  ios: 'iOS',
  docomo: 'docomo',
  au: 'au',
  softbank: 'SoftBank',
}

/**
 * 版名セル（Ver.xxxx）を探す。Emotionクラスはタブごとに違う（時間別は css-7p2ugy 等）ので、
 * まず既知クラス `.css-10qqjzd` を試し、無ければ「Ver.」で始まる <p> を探す（クラス非依存）。
 */
function findVersionNameCell(scope: HTMLElement): HTMLElement | null {
  const byClass = scope.querySelector<HTMLElement>(VERSION_NAME_CELL)
  if (byClass !== null) return byClass
  for (const p of scope.querySelectorAll<HTMLElement>('p')) {
    if (/^Ver\./.test((p.textContent ?? '').trim())) return p
  }
  return null
}

/** 版名セルに対応する配信割合セルを返す（既知クラス→直後の<p>兄弟の順で探す） */
function findRatioCell(row: HTMLElement, nameCell: HTMLElement): HTMLElement | null {
  const byClass = row.querySelector<HTMLElement>(VERSION_RATIO_CELL)
  if (byClass !== null) return byClass
  const sib = nameCell.nextElementSibling
  return sib instanceof HTMLElement && sib.tagName === 'P' ? sib : null
}

/**
 * 指示㊽: デバイス別以外のタブにもVersion行を描く。
 * 採取物にはVer.3873の1行だけが入っているので、それを雛形に全Versionぶん複製する。
 * タブごとにEmotionクラスが違うため、版名は `findVersionNameCell`（Ver.テキスト）で探す。
 */
async function wireTabVersionRows(
  root: HTMLElement,
  abTestUid: string,
  onRow?: (row: HTMLElement, version: Version) => void,
): Promise<void> {
  const nameCell = findVersionNameCell(root)
  if (nameCell === null) return

  // ── 版行(templateRow)の特定 ──
  // 重要: 「名前+割合」だけを複製するとトグル列(スイッチ)が1版分しか残らず、
  // モバイルOS別/キャリア別で最新版しか設定できなくなる（デバイス別は動くのに）。
  // デバイス別と同じく **コントロール(スイッチ)を含むフル行** を複製する。
  //  1) スイッチを持つタブ: 版名セルの最も近い「スイッチを内包する祖先」＝フル行。
  //  2) スイッチが無いタブ(パラメーター/時間/日付): 名前+割合の行を雛形にする。
  let templateRow: HTMLElement | null = null
  let container: HTMLElement | null = null
  // 版行の制御要素: スイッチ(デバイス/OS/キャリア) / パラメータ入力 / 追加ボタン(時間・日付)。
  const hasRowControl = (el: HTMLElement): boolean =>
    el.querySelector('.MuiSwitch-root') !== null ||
    el.querySelector('input[placeholder*="utm"], input[placeholder*="xxx"]') !== null ||
    el.querySelector('svg[data-testid="AddBoxIcon"]') !== null ||
    [...el.querySelectorAll('button')].some((b) => (b.textContent ?? '').includes('時間設定を追加'))
  for (let anc = nameCell.parentElement; anc !== null; anc = anc.parentElement) {
    if (hasRowControl(anc)) {
      templateRow = anc
      container = anc.parentElement
      break
    }
  }
  if (templateRow === null) {
    container = nameCell.parentElement
    while (container !== null) {
      const rowChild = [...container.children].find(
        (c) => c instanceof HTMLElement && c.contains(nameCell) && findVersionNameCell(c) !== null,
      )
      if (rowChild instanceof HTMLElement) {
        templateRow = rowChild
        break
      }
      container = container.parentElement
    }
  }
  if (container === null || templateRow === null) return

  const { articles } = await api.articles(abTestUid)
  const articleUid = articles[0]?.uid
  if (articleUid === undefined) return
  const { versions } = await api.versions(articleUid)
  const alive = versions.filter((v) => v.archived !== true)
  if (alive.length === 0) return

  const pristine = templateRow.cloneNode(true) as HTMLElement
  templateRow.remove()

  for (let i = 0; i < alive.length; i++) {
    const version = alive[i]!
    const row = pristine.cloneNode(true) as HTMLElement
    const nc = findVersionNameCell(row)
    const rc = nc !== null ? findRatioCell(row, nc) : null
    if (nc !== null) {
      nc.textContent = version.name
      nc.style.maxWidth = '120px'
      nc.style.overflow = 'hidden'
      nc.style.textOverflow = 'ellipsis'
      nc.style.whiteSpace = 'nowrap'
    }
    if (rc !== null) {
      rc.textContent = String(version.distribution_ratio)
      rc.style.maxWidth = '60px'
    }
    row.style.maxWidth = '100%'
    // 指示69: 版行を詰めて表示（デバイス別と同様、min-height/padding を除去して行をコンパクトに）
    const toggleArea = row.querySelector<HTMLElement>('.css-1q0mywx')
    if (toggleArea !== null) {
      toggleArea.style.minHeight = 'auto'
      toggleArea.style.borderRadius = i === alive.length - 1 ? '0 0 10px 10px' : '0'
    }
    const nameWrapper = row.querySelector<HTMLElement>('.css-1r20ns4')
    if (nameWrapper !== null) nameWrapper.style.paddingBottom = '0'
    row.dataset['cloneVersionUid'] = version.uid
    container.append(row)
    if (onRow !== undefined) onRow(row, version)
  }
}

/** 「パラメーター別」表記を「流入元別」に置き換える（サブナビのラベルと本文見出し）。 */
function renameParamTab(root: HTMLElement): void {
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    if (el.children.length === 0 && (el.textContent ?? '').trim() === 'パラメーター別') {
      el.textContent = '流入元別'
    }
  }
}

function escapeText(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c))
}

const MATCH_OPTIONS: readonly [string, string][] = [
  ['exact', '完全に一致'],
  ['prefix', '〜で始まる'],
  ['suffix', '〜で終わる'],
  ['contains', '〜を含む'],
]

/**
 * 流入元別（旧・パラメーター別）: 採取物の1入力欄を「パラメータ名 / 条件 / 値 ＋ プレビュー」の
 * 分かりやすい3項目UIに置き換え、版ごとに param_rules を保存する。
 */
function wireParamRow(row: HTMLElement, version: Version): void {
  const input = row.querySelector<HTMLInputElement>('input[placeholder*="utm"], input[placeholder*="xxx"]')
  const host = input?.closest<HTMLElement>('.MuiFormControl-root') ?? input?.parentElement ?? null
  if (host === null) return

  const rule = version.param_rules?.[0] ?? { name: 'utm_creative', match: 'exact' as const, value: '' }

  const editor = document.createElement('div')
  editor.setAttribute('data-clone-param-editor', '')
  editor.style.cssText =
    'display:flex;flex-direction:column;gap:8px;padding:12px 14px;background:#fff;' +
    'border:1px solid #e5e5ea;border-radius:8px'

  const fields = document.createElement('div')
  fields.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end'
  const field = (labelText: string, el: HTMLElement): HTMLElement => {
    const wrap = document.createElement('label')
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;font-size:11px;color:#8a94a6'
    const lb = document.createElement('span')
    lb.textContent = labelText
    wrap.append(lb, el)
    return wrap
  }
  const inputStyle = 'padding:7px 10px;border:1px solid #d6dae1;border-radius:6px;font-size:13px'
  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.value = rule.name
  nameInput.placeholder = 'utm_creative'
  nameInput.style.cssText = inputStyle
  const matchSel = document.createElement('select')
  matchSel.style.cssText = `${inputStyle};cursor:pointer`
  for (const [v, l] of MATCH_OPTIONS) {
    const o = document.createElement('option')
    o.value = v
    o.textContent = l
    if (v === rule.match) o.selected = true
    matchSel.append(o)
  }
  const valInput = document.createElement('input')
  valInput.type = 'text'
  valInput.value = rule.value
  valInput.placeholder = 'summer'
  valInput.style.cssText = inputStyle
  fields.append(field('パラメータ名', nameInput), field('条件', matchSel), field('値', valInput))

  const preview = document.createElement('div')
  preview.style.cssText = 'font-size:12px;color:#5b6577'
  const renderPreview = (): void => {
    const n = nameInput.value.trim() || 'utm_creative'
    const v = valInput.value.trim()
    const note =
      { exact: '', prefix: '（で始まる）', suffix: '（で終わる）', contains: '（を含む）' }[matchSel.value] ?? ''
    preview.innerHTML =
      v === ''
        ? '<span style="color:#aaa">値を入れると、その広告リンクから来た人にこのVersionを表示します（未入力なら常に表示）</span>'
        : `→ <b>?${escapeText(n)}=${escapeText(v)}</b>${note} で来た人にこのVersionを表示`
  }
  const saveRule = (): void => {
    const n = nameInput.value.trim()
    const v = valInput.value.trim()
    const rules = v === '' ? [] : [{ name: n, match: matchSel.value, value: v }]
    void api.setVersionTargeting(version.uid, { param_rules: rules }).then(() => toast('流入元の条件を保存しました'))
  }
  for (const el of [nameInput, valInput]) {
    el.addEventListener('input', renderPreview)
    el.addEventListener('blur', saveRule)
  }
  matchSel.addEventListener('change', () => {
    renderPreview()
    saveRule()
  })
  renderPreview()

  editor.append(fields, preview)
  host.replaceWith(editor)
}

/**
 * 時間別/日付別: 行内の追加ボタン（時間設定を追加 / ＋AddBoxIcon）を機能させ、
 * 「開始〜終了（＋配信する/しない）」の行を足せるようにして、版ごとに time_ranges / date_periods を保存する。
 */
function wirePeriodRow(row: HTMLElement, version: Version, kind: 'time' | 'date'): void {
  const addBtn =
    kind === 'time'
      ? [...row.querySelectorAll<HTMLElement>('button')].find((b) => (b.textContent ?? '').includes('時間設定を追加')) ?? null
      : row.querySelector<SVGElement>('svg[data-testid="AddBoxIcon"]')?.closest<HTMLElement>('button, [role="button"], a') ??
        (row.querySelector<SVGElement>('svg[data-testid="AddBoxIcon"]')?.parentElement as HTMLElement | null)

  const list = document.createElement('div')
  list.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin:8px 0 4px'
  ;(addBtn?.closest<HTMLElement>('.css-1q0mywx') ?? row).append(list)

  const collectAndSave = (): void => {
    const editors = [...list.querySelectorAll<HTMLElement>('[data-period-editor]')]
    if (kind === 'time') {
      const ranges = editors
        .map((e) => ({
          from: e.querySelector<HTMLInputElement>('[data-from]')?.value ?? '',
          to: e.querySelector<HTMLInputElement>('[data-to]')?.value ?? '',
        }))
        .filter((r) => r.from !== '' || r.to !== '')
      void api.setVersionTargeting(version.uid, { time_ranges: ranges })
    } else {
      const periods = editors
        .map((e) => ({
          from: e.querySelector<HTMLInputElement>('[data-from]')?.value ?? '',
          to: e.querySelector<HTMLInputElement>('[data-to]')?.value ?? '',
          mode: (e.querySelector<HTMLSelectElement>('[data-mode]')?.value as 'on' | 'off') ?? 'on',
        }))
        .filter((p) => p.from !== '' || p.to !== '')
      void api.setVersionTargeting(version.uid, { date_periods: periods })
    }
  }

  const addEditor = (initial?: { from?: string; to?: string; mode?: string }): void => {
    list.append(buildPeriodEditor(kind, initial, collectAndSave))
  }

  const existing =
    kind === 'time' ? version.time_ranges ?? [] : version.date_periods ?? []
  for (const it of existing) addEditor(it)

  if (addBtn !== null) {
    addBtn.style.cursor = 'pointer'
    addBtn.addEventListener('click', (event) => {
      event.preventDefault()
      addEditor()
    })
  }
}

/** 配信期間の編集行を1つ作る（time=開始〜終了 / date=開始〜終了＋配信する/しない＋削除）。 */
function buildPeriodEditor(
  kind: 'time' | 'date',
  initial: { from?: string; to?: string; mode?: string } | undefined,
  onChange: () => void,
): HTMLElement {
  const editor = document.createElement('div')
  editor.setAttribute('data-period-editor', kind)
  editor.style.cssText =
    'display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;background:#fff;' +
    'border:1px solid #e5e5ea;border-radius:8px;font-size:13px;color:#333'

  const mk = (attr: string, value: string): HTMLInputElement => {
    const i = document.createElement('input')
    i.type = kind === 'time' ? 'time' : 'date'
    i.setAttribute(attr, '')
    i.value = value
    i.style.cssText = 'padding:6px 8px;border:1px solid #d6dae1;border-radius:6px;font-size:13px'
    i.addEventListener('change', onChange)
    return i
  }
  const from = mk('data-from', initial?.from ?? '')
  const to = mk('data-to', initial?.to ?? '')
  const tilde = document.createElement('span')
  tilde.textContent = '〜'
  editor.append(from, tilde, to)

  if (kind === 'date') {
    const mode = document.createElement('select')
    mode.setAttribute('data-mode', '')
    mode.style.cssText = 'padding:6px 8px;border:1px solid #d6dae1;border-radius:6px;font-size:13px;cursor:pointer'
    for (const [v, l] of [['on', '配信する'], ['off', '配信しない']]) {
      const o = document.createElement('option')
      o.value = v!
      o.textContent = l!
      if (v === (initial?.mode ?? 'on')) o.selected = true
      mode.append(o)
    }
    mode.addEventListener('change', onChange)
    editor.append(mode)
  }

  const del = document.createElement('button')
  del.type = 'button'
  del.textContent = '削除'
  del.style.cssText =
    'margin-left:auto;padding:6px 12px;border:1px solid #f0b4b4;border-radius:6px;background:#fff;' +
    'color:#d64545;font-size:12px;cursor:pointer'
  del.addEventListener('click', () => {
    editor.remove()
    onChange()
  })
  editor.append(del)
  return editor
}

/**
 * 指示123: Versionオプション設定ページの Emotion 直書きダーク背景を白基調に上書き。
 * `.css-gofv8i` = バナー領域、`.css-160345m` = アクティブタブ（rgb(69,70,71)）。
 */
/**
 * 指示136: アクティブタブ `.css-160345m` の `::before` / `::after` を消す。
 * これは元のダークタブ設計で角丸をつなぐための box-shadow 装飾（`rgb(69,70,71)`）で、
 * 白基調化すると暗い曲線マークが2個だけ浮いて残る（指示132で取りこぼした本体）。
 * 疑似要素はインラインstyleで消せないので、1回だけ<style>で display:none にする。
 */
function hideActiveTabPseudo(): void {
  if (document.getElementById('sb-split-hide-pseudo') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-split-hide-pseudo'
  style.textContent = '.css-160345m::before, .css-160345m::after { display: none !important; }'
  document.head.append(style)
}

function applySplitTestWhiteTheme(root: HTMLElement): void {
  // 指示136: アクティブタブの暗い角丸マーク2個(::before/::after)を消す
  hideActiveTabPseudo()
  // バナー領域（デバイスアイコン等の説明帯）
  for (const banner of root.querySelectorAll<HTMLElement>('.css-gofv8i')) {
    banner.style.setProperty('background-color', '#f5f6f8', 'important')
    banner.style.setProperty('color', '#333', 'important')
    banner.style.setProperty('border', '1px solid #e5e5ea', 'important')
    banner.style.setProperty('border-radius', '10px', 'important')
  }
  // 指示130: デバイスアイコンSVG の fill="#fff"（白）→ 黒に変更
  for (const banner of root.querySelectorAll<HTMLElement>('.css-gofv8i')) {
    for (const g of banner.querySelectorAll<SVGElement>('g[fill="#fff"], g[fill="#FFF"], g[fill="white"]')) {
      g.setAttribute('fill', '#333')
    }
    // path 直指定の fill="#fff" も対応
    for (const p of banner.querySelectorAll<SVGElement>('path[fill="#fff"], path[fill="#FFF"], path[fill="white"]')) {
      p.setAttribute('fill', '#333')
    }
  }
  // アクティブタブ＝選択中を明確にする（薄オレンジ背景＋左オレンジ帯＋オレンジ太字）。
  // 角丸下線はカーブして選択が分かりにくいので使わない（要望「選択しているものはわかるように」）。
  for (const tab of root.querySelectorAll<HTMLElement>('.css-160345m')) {
    tab.style.setProperty('background-color', '#fff7ed', 'important')
    tab.style.setProperty('color', '#e07b00', 'important')
    tab.style.setProperty('font-weight', '700', 'important')
    tab.style.setProperty('border-bottom', 'none', 'important')
    tab.style.setProperty('border-left', '4px solid #f0960a', 'important')
    tab.style.setProperty('border-radius', '0', 'important')
    // アクティブタブ内SVGアイコンの色をオレンジに（選択中を色でも示す）
    for (const g of tab.querySelectorAll<SVGElement>('g[fill="#fff"], g[fill="#FFF"], g[fill="white"], g[fill="#333"]')) {
      g.setAttribute('fill', '#e07b00')
    }
    for (const p of tab.querySelectorAll<SVGElement>('path[fill="#fff"], path[fill="#FFF"], path[fill="white"], path[fill="#333"]')) {
      p.setAttribute('fill', '#e07b00')
    }
    // アクティブタブ内のテキストspan（.css-ip5sxk）もオレンジ太字に
    for (const span of tab.querySelectorAll<HTMLElement>('.css-ip5sxk')) {
      span.style.setProperty('color', '#e07b00', 'important')
      span.style.setProperty('font-weight', '700', 'important')
    }
  }
  // 指示131: 非アクティブタブのテキスト色を視認しやすく（選択中との差を明確に）
  for (const tab of root.querySelectorAll<HTMLElement>('.css-14jx66')) {
    tab.style.setProperty('color', '#666', 'important')
    tab.style.setProperty('font-weight', '400', 'important')
  }
  // バナー内の白文字 → 黒文字
  for (const text of root.querySelectorAll<HTMLElement>('.css-9ofnmi')) {
    text.style.setProperty('color', '#333', 'important')
  }
  // バナー内のすべての子要素の文字色を黒に
  for (const banner of root.querySelectorAll<HTMLElement>('.css-gofv8i')) {
    for (const child of banner.querySelectorAll<HTMLElement>('*')) {
      const color = getComputedStyle(child).color
      const [r, g, b] = color.match(/\d+/g)?.map(Number) ?? []
      if (r !== undefined && g !== undefined && b !== undefined && (r + g + b) > 500) {
        child.style.setProperty('color', '#333', 'important')
      }
    }
  }
  // 指示132: ツールチップ矢印（_arrow_x4j8w_25）を非表示にする
  for (const arrow of root.querySelectorAll<HTMLElement>('[class*="_arrow_x4j8w_25"]')) {
    arrow.style.setProperty('display', 'none', 'important')
  }
  // 指示132: ツールチップ本体の漏れ表示を防止
  for (const body of root.querySelectorAll<HTMLElement>('[class*="_bodyWrapper_x4j8w_8"]')) {
    body.style.setProperty('display', 'none', 'important')
  }
  // 「Version出し分け」見出しの白文字 → 黒
  for (const heading of root.querySelectorAll<HTMLElement>('.css-5u8lc9')) {
    heading.style.setProperty('color', '#333', 'important')
  }
  // タブ内テキスト（.css-ip5sxk）の色を確実に黒に。
  // ただしアクティブタブ（.css-160345m）内はオレンジ選択色を保つため除外する。
  for (const label of root.querySelectorAll<HTMLElement>('.css-ip5sxk')) {
    if (label.closest('.css-160345m') !== null) continue
    label.style.setProperty('color', '#333', 'important')
  }
}
