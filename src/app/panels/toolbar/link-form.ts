/**
 * リンクドロップダウンの純粋ロジック（DOMを触らない部分）。
 *
 * ラベル・初期値はすべて採取物
 * `fragments/ab_tests__UID__articles__toolbar-link-open.html` から読み取った実物の値。
 * **推測で足していない。**
 */
import type { QuillRange } from './placement.ts'

/** タブ（採取した `role="tablist"` の並び順そのまま） */
export const LINK_TAB_LABELS: readonly string[] = ['外部リンク', 'ページ内移動']

/** 計測設定の2択（採取物 verbatim） */
export const LINK_MEASURE_LABELS: readonly string[] = ['レポート計測する', 'レポート計測しない']

/** ページ遷移設定の2択（採取物 verbatim） */
export const LINK_TARGET_LABELS: readonly string[] = ['現在のウィンドウ（推奨）', '新しいタブ']

/** 成果単価の見出し（採取物 verbatim） */
export const LINK_UNIT_PRICE_LABEL = '成果単価（アフィリエイト向け）'

export interface LinkFormValues {
  readonly url: string
  readonly name: string
  readonly unitPrice: string
  /** `レポート計測する` が選ばれているか */
  readonly isReportMeasured: boolean
  /** `新しいタブ` が選ばれているか */
  readonly opensInNewTab: boolean
}

/**
 * 初期値。採取時のチェック状態をそのまま採用している:
 *   計測設定       → `レポート計測しない` が checked（`レポート計測する` は unchecked）
 *   ページ遷移設定 → `現在のウィンドウ（推奨）` が checked
 * 直感に反するが実物がそうなっているので直さない（企画書 §3-5）。
 */
export const DEFAULT_LINK_FORM: LinkFormValues = {
  url: '',
  name: '',
  unitPrice: '',
  isReportMeasured: false,
  opensInNewTab: false,
}

export interface LinkAttributes {
  readonly url: string
  readonly name: string | null
  readonly unitPrice: number | null
  readonly isReportMeasured: boolean
  readonly opensInNewTab: boolean
}

export type LinkFormResult =
  | { readonly ok: true; readonly link: LinkAttributes }
  | { readonly ok: false; readonly reason: string }

/**
 * **実物のバグをそのまま再現するための判定**（docs/findings-live-observation.md）。
 *
 * 「テキストを選択していない状態でリンクツールを押すとアプリ全体がクラッシュして
 * エラー画面になる」。これは実物の挙動なので、クローンでも同じ条件で同じ画面を出す。
 */
export function shouldCrashOnLinkOpen(range: QuillRange | null): boolean {
  return range === null || range.length === 0
}

/** 入力欄が受け付けるスキーム。`type="url"` ＋ placeholder `https://...` に合わせる。 */
const ALLOWED_PROTOCOLS: readonly string[] = ['http:', 'https:']

/**
 * 「リンクを追加」を押せる状態かどうかを判定し、正規化した値を返す。
 *
 * 実物がどこまで検証しているかは採取物からは分からない。ここで見ているのは
 * 採取物から読み取れる範囲（`type="url"` / placeholder）と、
 * クローン側の境界検証（`javascript:` を href に入れない）だけ。
 */
export function parseLinkForm(values: LinkFormValues): LinkFormResult {
  const url = values.url.trim()
  if (url === '') return { ok: false, reason: 'URLを入力してください' }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, reason: 'URLは https:// から入力してください' }
  }
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return { ok: false, reason: 'URLは https:// から入力してください' }
  }

  const unitPrice = parseUnitPrice(values.unitPrice)
  if (unitPrice === 'invalid') return { ok: false, reason: '成果単価は0以上の数値で入力してください' }

  const name = values.name.trim()
  return {
    ok: true,
    link: {
      url,
      name: name === '' ? null : name,
      unitPrice,
      isReportMeasured: values.isReportMeasured,
      opensInNewTab: values.opensInNewTab,
    },
  }
}

function parseUnitPrice(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0) return 'invalid'
  return value
}
