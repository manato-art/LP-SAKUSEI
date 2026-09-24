/**
 * 「どの Version も出せない端末」を見つける（2026-09-24・DOMを触らない）。
 *
 * 配信側（mock-server/routes/delivery-targeting.ts の pickDeliveryVersion）は、
 * アーカイブしていない・配信割合1%以上・その端末で出してよい Version の中から選び、
 * 1つも無ければ「配信できるVersionがありません」を出す。
 * デバイス別・OS別の設定でそうなる端末ができるなら、変更の前に知らせる。
 *
 * ここで見るのは端末（デバイス×OS）だけ。キャリアは通常判定できず（判定できないときは制限しない）、
 * 流入元・時間・日付は開いた時や来た経路で変わるので、ここでは判定しない。
 */

interface CoverageVersion {
  archived?: boolean
  distribution_ratio: number
  device_targets?: { sp: boolean; tablet: boolean; pc: boolean }
  os_targets?: { android: boolean; ios: boolean } | null
}

/** 配信側の判定と同じ区分（端末は User-Agent から sp/tablet/pc、OSは iOS/Android/それ以外） */
const VISITORS: readonly { label: string; device: 'sp' | 'tablet' | 'pc'; os: 'ios' | 'android' | null }[] = [
  { label: 'スマートフォン（iOS）', device: 'sp', os: 'ios' },
  { label: 'スマートフォン（Android）', device: 'sp', os: 'android' },
  { label: 'タブレット（iPad）', device: 'tablet', os: 'ios' },
  { label: 'タブレット（Android）', device: 'tablet', os: 'android' },
  { label: 'デスクトップ', device: 'pc', os: null },
]

function servesVisitor(version: CoverageVersion, visitor: (typeof VISITORS)[number]): boolean {
  if (version.archived === true || version.distribution_ratio < 1) return false
  if (version.device_targets?.[visitor.device] === false) return false
  const os = version.os_targets
  // OS別: どれかをオンにしていれば「そのOSのモバイル」だけ（デスクトップは対象外）
  if (os !== null && os !== undefined && (os.android || os.ios)) {
    if (visitor.os === null) return false
    if (!os[visitor.os]) return false
  }
  return true
}

/** どの Version も出せない端末の名前 */
export function uncoveredVisitors(versions: readonly CoverageVersion[]): string[] {
  return VISITORS.filter((visitor) => !versions.some((v) => servesVisitor(v, visitor))).map((v) => v.label)
}

/** 変更で新しく出せなくなる端末（前から出せない端末は含めない） */
export function newlyUncoveredVisitors(
  before: readonly CoverageVersion[],
  after: readonly CoverageVersion[],
): string[] {
  const already = new Set(uncoveredVisitors(before))
  return uncoveredVisitors(after).filter((label) => !already.has(label))
}
