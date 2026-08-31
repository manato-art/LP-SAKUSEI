/**
 * 決定論的疑似乱数（企画書 §10-5「固定seedで再起動しても同一データを再生」）。
 * 外部依存を持たずに再現性を保証するため mulberry32 を自前実装する。
 */

export const DEFAULT_SEED = 42

/** 文字列を32bit整数へ（同じ文字列は常に同じ値・FNV-1a） */
export function hashString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

export interface Rng {
  /** [0,1) */
  next(): number
  /** [min,max] の整数 */
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  bool(probability?: number): boolean
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('pick: 空配列からは選べません')
      return items[Math.floor(next() * items.length)] as T
    },
    bool: (probability = 0.5) => next() < probability,
  }
}

/** キー（例 "ab_test_uid|2026-08-31"）から決定論的なRngを作る。再起動後も同値。 */
export function rngForKey(key: string, seed: number = DEFAULT_SEED): Rng {
  return createRng(hashString(`${seed}|${key}`))
}
