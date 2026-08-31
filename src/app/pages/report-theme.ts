/**
 * レポート／ヒートマップ画面のテーマ切替（ダーク⇄ライト）。
 *
 * 実物は右上のランプ（`_toggleTheme_8ygjt_83`）で切り替わる。
 * 採取したCSSには **`_darkTheme_<hash>_<n>` と `_lightTheme_<hash>_<m>` の両方**が入っているので、
 * CSSを書き足さずに「クラス名を入れ替えるだけ」で実物と同じ見た目が出せる。
 *
 * 対応表はソースへ転記せず、読み込んだ実CSSから実行時に作る（採取物が変わっても追従する）。
 */

export interface ThemeSwap {
  toLight: Map<string, string>
  toDark: Map<string, string>
}

/** CSSテキストから `_darkTheme_x_1` / `_lightTheme_x_2` / `_dark_x_3` / `_light_x_4` を拾う */
export function extractThemeTokens(cssText: string): string[] {
  const pattern = /\.(_(?:dark|light)(?:Theme)?_[A-Za-z0-9]+_\d+)/g
  return [...new Set([...cssText.matchAll(pattern)].map((match) => match[1] as string))]
}

interface ParsedToken {
  mode: 'dark' | 'light'
  hash: string
  token: string
}

function parseToken(token: string): ParsedToken | null {
  const match = /^_(dark|light)(Theme)?_([A-Za-z0-9]+)_\d+$/.exec(token)
  if (match === null) return null
  // `_darkTheme_x_1` と `_dark_x_2` は別系統なので、Theme の有無ごとにグループを分ける
  const group = `${match[2] ?? ''}:${match[3] as string}`
  return { mode: match[1] as 'dark' | 'light', hash: group, token }
}

/** 同じCSSモジュール（ハッシュ）同士で dark↔light を対応づける */
export function buildThemeSwap(tokens: Iterable<string>): ThemeSwap {
  const byHash = new Map<string, { dark?: string; light?: string }>()
  for (const raw of tokens) {
    const parsed = parseToken(raw)
    if (parsed === null) continue
    const entry = byHash.get(parsed.hash) ?? {}
    byHash.set(parsed.hash, { ...entry, [parsed.mode]: parsed.token })
  }
  const toLight = new Map<string, string>()
  const toDark = new Map<string, string>()
  for (const { dark, light } of byHash.values()) {
    if (dark === undefined || light === undefined) continue
    toLight.set(dark, light)
    toDark.set(light, dark)
  }
  return { toLight, toDark }
}

/** class属性のうち、対応表にあるトークンだけを差し替える */
export function swapClassName(className: string, map: ReadonlyMap<string, string>): string {
  return className
    .split(/\s+/)
    .map((token) => map.get(token) ?? token)
    .join(' ')
}
