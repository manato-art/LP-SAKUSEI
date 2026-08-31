/**
 * 到達性の被覆率を測る。
 *
 * 「採取した実物のDOMに存在する操作可能な要素」を分母、
 * 「クローンのコードが実際に配線している要素」を分子にする。
 * 目視ではなく機械的な差分で「どこまで再現できたか」を出すための道具。
 *
 * この指標の限界（数字を過信しないこと）:
 * - 分子は「コードが data-test / data-testid を名指ししているか」でしか測れない。
 *   構造セレクタ（`h1, h2, h3` など）で配線している要素は**未配線として数えられる**。
 *   つまり実際の到達性はこの数字より高いことがある。
 * - 逆に、名指ししていても「取得しただけで何もしていない」なら配線済みと数えてしまう。
 *   つまり実際の到達性はこの数字より低いこともある。
 * 本当に押して動くかは、ブラウザでの巡回（tools/reachability/crawl.js）で確かめること。
 */

/** 採取した実DOMの断片から見つかった操作可能な要素。 */
export interface InteractiveElements {
  /** data-test 属性の値（重複なし・出現順）。アプリ側の配線フックはこれが正準。 */
  readonly testIds: readonly string[]
  /** data-testid 属性の値。デザインシステム側の部品（サイドバー項目など）が使う別系統。 */
  readonly componentTestIds: readonly string[]
  readonly buttonCount: number
  readonly anchorCount: number
  readonly tabCount: number
  /** ハッシュルータの遷移先（重複なし・出現順）。 */
  readonly hashTargets: readonly string[]
}

const TEST_ATTR_RE = /data-test=(["'])(.*?)\1/g
const COMPONENT_TEST_ATTR_RE = /data-testid=(["'])(.*?)\1/g
const BUTTON_RE = /<button[\s>]/g
const ANCHOR_RE = /<a[\s>]/g
const TAB_RE = /role=(["'])tab\1/g
const HASH_HREF_RE = /href=(["'])(#\/[^"']*)\1/g

function collectUnique(source: string, pattern: RegExp, group: number): string[] {
  const seen = new Set<string>()
  const found: string[] = []
  for (const match of source.matchAll(pattern)) {
    const value = match[group]
    if (value === undefined || seen.has(value)) continue
    seen.add(value)
    found.push(value)
  }
  return found
}

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length
}

/** 採取したHTML断片から、操作可能な要素を抜き出す。 */
export function extractInteractive(html: string): InteractiveElements {
  return {
    testIds: collectUnique(html, TEST_ATTR_RE, 2),
    componentTestIds: collectUnique(html, COMPONENT_TEST_ATTR_RE, 2),
    buttonCount: countMatches(html, BUTTON_RE),
    anchorCount: countMatches(html, ANCHOR_RE),
    tabCount: countMatches(html, TAB_RE),
    hashTargets: collectUnique(html, HASH_HREF_RE, 2),
  }
}

const WIRED_SELECTOR_RE = /\[data-test(?:id)?=(?:\\?["'])(.*?)(?:\\?["'])\]/g

/** クローンのソースコードが参照している data-test を抜き出す。 */
export function extractWiredSelectors(source: string): readonly string[] {
  return collectUnique(source, WIRED_SELECTOR_RE, 1)
}

/** 実物にあるのにクローンが配線していない要素。 */
export interface UnwiredElement {
  readonly state: string
  readonly testId: string
}

export interface CoverageReport {
  /** 実物側の要素の総数（重複なし・状態をまたいで名前が同じなら1つ）。 */
  readonly total: number
  readonly wired: number
  readonly unwired: readonly UnwiredElement[]
  /** クローンが参照しているのに採取物に存在しない要素＝推測で書かれた疑いがある。 */
  readonly notInCapture: readonly string[]
  /** 被覆率。採取物が空のときは 0 ではなく null（判定不能）を返す。 */
  readonly ratio: number | null
}

/**
 * 被覆率を集計する。
 *
 * @param capturedByState 状態名 → その状態のDOMに存在する data-test の一覧
 * @param wiredTestIds    クローンのコードが参照している data-test / data-testid の一覧
 * @param alsoCaptured    別系統(data-testid)で採取されている名前。
 *   これを渡さないと、data-testid でしか存在しない名前を「実物に無い＝推測」と誤報告する。
 */
export function buildCoverage(
  capturedByState: Readonly<Record<string, readonly string[]>>,
  wiredTestIds: readonly string[],
  alsoCaptured: readonly string[] = [],
): CoverageReport {
  const wiredSet = new Set(wiredTestIds)
  const capturedSet = new Set<string>()
  const unwired: UnwiredElement[] = []

  for (const [state, testIds] of Object.entries(capturedByState)) {
    for (const testId of testIds) {
      capturedSet.add(testId)
      if (!wiredSet.has(testId)) unwired.push({ state, testId })
    }
  }

  const total = capturedSet.size
  const wired = [...capturedSet].filter((testId) => wiredSet.has(testId)).length
  const alsoCapturedSet = new Set(alsoCaptured)
  const notInCapture = wiredTestIds.filter(
    (testId) => !capturedSet.has(testId) && !alsoCapturedSet.has(testId),
  )

  return {
    total,
    wired,
    unwired,
    notInCapture,
    ratio: total === 0 ? null : wired / total,
  }
}
