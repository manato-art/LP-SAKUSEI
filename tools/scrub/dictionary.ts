/**
 * 置換辞書の構築（企画書 §5-5）。
 *
 * 設計の要点: 「どの文字列がユーザーデータか」は fixtures(JSON) の **フィールド名** が教えてくれる。
 * まず fixtures から literal を集めて辞書を作り、その辞書を DOM/CSS/HAR にも適用する。
 * こうするとマイクロコピー（ラベル・エラー文）を巻き込まずに、施策名や人名だけを確実に置換できる。
 */
import {
  NUMERIC_USER_DATA_FIELDS,
  STRUCTURAL_FIELDS,
  USER_DATA_FIELDS,
} from './policy.ts'
import {
  fakeCampaignName,
  fakeEmail,
  fakeHost,
  fakeNumberLike,
  fakePersonName,
  fakePhone,
  fakeToken,
  fakeUid,
} from './replacers.ts'

export type ScrubCategory =
  | 'person'
  | 'campaign'
  | 'email'
  | 'phone'
  | 'host'
  | 'uid'
  | 'token'
  | 'number'

/** 実値 → 架空値 の写像（scrub-map.json の中身。非コミット） */
export type ScrubMap = Record<string, { category: ScrubCategory; replacement: string }>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^0\d{1,4}-?\d{1,4}-?\d{3,4}$/
const HOST_RE = /^(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+/i
const UID_RE = /^[A-Za-z0-9_-]{16,}$/
const MONEY_RE = /^[¥￥]?[\d,]+円?$/

/** 既知の実在社員名リスト（採取係が用意する非コミットファイル）。1行1名。 */
export function parseKnownNames(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
}

function categorize(field: string, value: string): ScrubCategory | null {
  if (STRUCTURAL_FIELDS.includes(field)) return null
  if (field === 'email') return 'email'
  if (field === 'tel' || field === 'phone') return 'phone'
  if (field === 'host') return 'host'
  if (field === 'uid') return 'uid'
  if (field.endsWith('token') || field.endsWith('api_key')) return 'token'
  if (NUMERIC_USER_DATA_FIELDS.includes(field)) return 'number'
  if (!USER_DATA_FIELDS.includes(field)) return null

  if (EMAIL_RE.test(value)) return 'email'
  if (PHONE_RE.test(value)) return 'phone'
  if (MONEY_RE.test(value)) return 'number'
  if (field === 'url' || field === 'thumbnail_url') return 'host'
  if (HOST_RE.test(value) && value.includes('.')) return 'host'
  if (UID_RE.test(value) && !value.includes(' ')) return 'uid'
  return 'campaign'
}

export function replacementFor(category: ScrubCategory, value: string): string {
  switch (category) {
    case 'person':
      return fakePersonName(value)
    case 'campaign':
      return fakeCampaignName(value)
    case 'email':
      return fakeEmail(value)
    case 'phone':
      return fakePhone(value)
    case 'host':
      return fakeHost(value)
    case 'uid':
      return fakeUid(value)
    case 'token':
      return fakeToken(value)
    case 'number':
      return fakeNumberLike(value)
  }
}

/**
 * 短すぎる値はHTML全体へ literal 置換すると誤爆するため辞書に載せない。
 * ただし**日本語は2文字で十分に特定的**（「大山」「内田」等の姓）。
 * ASCII基準の3文字固定にすると日本語の実名を取りこぼす（実採取でこのバグを踏んだ）。
 */
const MIN_LENGTH_ASCII = 3
const MIN_LENGTH_CJK = 2

/** ひらがな・カタカナ・漢字を含むか */
const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/

function isTooShort(value: string): boolean {
  const min = CJK_RE.test(value) ? MIN_LENGTH_CJK : MIN_LENGTH_ASCII
  return value.length < min
}

function addEntry(
  map: ScrubMap,
  value: string,
  category: ScrubCategory,
  { override = false }: { override?: boolean } = {},
): void {
  if (isTooShort(value)) return
  if (!override && Object.prototype.hasOwnProperty.call(map, value)) return
  map[value] = { category, replacement: replacementFor(category, value) }
}

/**
 * 数値は fixtures では number、DOMではカンマ区切りの整形文字列（通貨記号付きを含む）として現れる。
 * 表示側の整形バリアントも辞書に載せないと、DOM上の実金額が素通りする。
 */
function addNumericVariants(map: ScrubMap, value: number): void {
  if (!Number.isFinite(value)) return

  // 小数（ROAS/ROI/CVR等）は小数桁数を保ったまま撹拌する。§5-5 はこれらも置換対象。
  if (!Number.isInteger(value)) {
    const literal = String(Math.abs(value))
    if (literal.length < MIN_LENGTH_ASCII) return
      map[literal] = { category: 'number', replacement: replacementFor('number', literal) }
    return
  }

  const raw = String(Math.trunc(Math.abs(value)))
  if (raw.length < MIN_LENGTH_ASCII) return

  const grouped = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fakeGrouped = replacementFor('number', grouped)
  const fakeRaw = fakeGrouped.split(',').join('')

  // 記号付き → 区切りあり → 区切りなし の順に登録（適用時は長い順に置換される）
  const variants: readonly (readonly [string, string])[] = [
    [`¥${grouped}`, `¥${fakeGrouped}`],
    [grouped, fakeGrouped],
    [raw, fakeRaw],
  ]
  for (const [real, replacement] of variants) {
      map[real] = { category: 'number', replacement }
  }
}

/** JSON(fixtures) を走査して辞書へ literal を集める */
export function collectFromJson(node: unknown, map: ScrubMap, field = ''): void {
  if (Array.isArray(node)) {
    for (const item of node) collectFromJson(item, map, field)
    return
  }
  if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) collectFromJson(value, map, key)
    return
  }
  if (typeof node === 'number') {
    if (NUMERIC_USER_DATA_FIELDS.includes(field)) addNumericVariants(map, node)
    return
  }
  if (typeof node === 'string' && node.trim() !== '') {
    const category = categorize(field, node)
    // html/css は巨大な塊なので辞書には載せず、本文スキャンで処理する
    if (category !== null && field !== 'html' && field !== 'css' && field !== 'body') {
      addEntry(map, node, category)
    }
  }
}

/**
 * 既知社員名を辞書へ追加（fixturesに現れなくてもDOM本文に出うるため）。
 * fixtures 側で 'campaign' 等に分類済みでも **人名分類で上書きする**。
 * 実名は最も守るべき情報であり、分類を誤ると「サンプル施策042」のような不自然な出力にもなる。
 */
export function collectKnownNames(names: readonly string[], map: ScrubMap): void {
  for (const name of names) addEntry(map, name, 'person', { override: true })
}

/**
 * 辞書を適用する。長い literal から順に置換して部分一致の取りこぼしを防ぐ。
 */
export function applyDictionary(text: string, map: ScrubMap): string {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length)
  return keys.reduce((acc, key) => acc.split(key).join(map[key]?.replacement ?? key), text)
}

export function mergeMaps(base: ScrubMap, incoming: ScrubMap): ScrubMap {
  return { ...incoming, ...base } // 既存の写像を必ず優先（参照整合を壊さない）
}
