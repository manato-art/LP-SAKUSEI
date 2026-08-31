/**
 * 決定論的な架空値の生成（企画書 §5-5「同じ実値は常に同じ架空値へ写す」＝参照整合を保つ）。
 * 実値そのものはここに一切保存しない（写像は scrub-map.json・非コミット）。
 */
import { hashString } from '../../mock-server/store/rng.ts'

const FAKE_SURNAMES = ['テスト', 'サンプル', 'ダミー', '架空', '仮'] as const
const FAKE_GIVEN_NAMES = ['太郎', '花子', '一郎', '二郎', '三郎', '四郎', '五郎'] as const

/** 人名 → 「テスト太郎」「サンプル花子」等（§5-5） */
export function fakePersonName(real: string): string {
  const h = hashString(real)
  const surname = FAKE_SURNAMES[h % FAKE_SURNAMES.length] ?? 'テスト'
  const given = FAKE_GIVEN_NAMES[Math.floor(h / 7) % FAKE_GIVEN_NAMES.length] ?? '太郎'
  return `${surname}${given}`
}

/** 施策名・beyondページ名・記事メモ → 「サンプル施策001」等（§5-5） */
export function fakeCampaignName(real: string, prefix = 'サンプル施策'): string {
  const n = (hashString(real) % 999) + 1
  return `${prefix}${String(n).padStart(3, '0')}`
}

/** 金額・数値 → ランダムなダミー（桁感は保つ・§5-5） */
export function fakeNumberLike(real: string): string {
  const digits = real.replace(/[^0-9]/g, '')
  if (digits.length === 0) return real
  const h = hashString(real)
  const scrambled = [...digits]
    .map((_, i) => String((Math.floor(h / (i + 1) ** 2) + i * 7) % 10))
    .join('')
  // 先頭0を避けて桁数を保つ
  const head = scrambled[0] === '0' ? '1' : scrambled[0]
  const rebuilt = `${head}${scrambled.slice(1)}`
  let cursor = 0
  return real.replace(/[0-9]/g, () => rebuilt[cursor++] ?? '0')
}

export function fakeNumber(real: number): number {
  const asString = String(Math.trunc(Math.abs(real)))
  const replaced = Number(fakeNumberLike(asString))
  return real < 0 ? -replaced : replaced
}

/** uid/トークン/APIキー → 新規生成のダミー（形は保つ・§5-5） */
export function fakeUid(real: string, kind = 'UID'): string {
  const n = (hashString(real) % 9999) + 1
  return `${kind}_${String(n).padStart(4, '0')}`
}

export function fakeToken(real: string): string {
  const h = hashString(real).toString(16).padStart(8, '0')
  return `sample_token_${h}`
}

export function fakeEmail(real: string): string {
  const n = (hashString(real) % 999) + 1
  return `user${String(n).padStart(3, '0')}@example.test`
}

export function fakePhone(real: string): string {
  const n = hashString(real) % 100000000
  return `090-${String(Math.floor(n / 10000)).padStart(4, '0')}-${String(n % 10000).padStart(4, '0')}`
}

/** 独自ドメイン → 中立ドメイン（§5-5） */
export function fakeHost(real: string): string {
  const n = (hashString(real) % 99) + 1
  return `sample${String(n).padStart(2, '0')}.example.test`
}
