/**
 * URLの中の「実ID」と「ルートの固定語」を見分ける。
 *
 * 匿名化（tools/scrub）と検査（tools/gate）の両方が同じ判定を使う。
 * 別々に書くと必ずズレる。実際、gate だけ直して scrub を直し忘れ、
 * ルート語（exit_popups / htmls など）を uid として置換してURLを壊した。
 *
 * 見分け方: このアプリのURLでは、ルートの語は必ず小文字（＋アンダースコア）で、
 * IDは大文字を含むか UUID 形をしている。実測したIDは9文字〜21文字あり、
 * **長さでは判別できない**。
 *
 * 限界: 全部小文字のIDは取りこぼす。その保険として
 * gate 側の「32文字以上の不透明トークン」規則を併用する。
 */

/** `/ab_tests/<値>` のように、IDが入りうる位置を捉える。 */
export const URL_SEGMENT_PATTERN =
  /\/(?:ab_tests|folders|articles|exit_popups|htmls)\/([A-Za-z0-9_.-]+)/g

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/**
 * ルートの固定語の形。**英字とアンダースコアだけ**で、数字を含まない。
 * 実測: ルート語は views / rankings / daily_reports / exit_popups / editor_types のように
 * すべて数字を含まない。一方、実在のページIDは noba2_sn2 / tochirac_y24 のように
 * 小文字でも必ず数字を含むか、大文字を含むか、UUID形だった。
 * 「長さ」でも「小文字かどうか」でもなく、**数字の有無**が両者を分ける。
 */
const ROUTE_WORD_PATTERN = /^[a-z]+(?:_[a-z]+)*$/
/** すでに匿名化済みのプレースホルダ（KIND_0001 形式）。二重置換は参照整合を壊す。 */
const SCRUBBED_PLACEHOLDER_PATTERN = /^[A-Z]+_\d{4}$/

/**
 * その値を実IDとして扱ってよいか。
 *
 * @param routeWords 追加で「これは構造語」と分かっている語（docs/routes.json 由来）。
 *   数字を含むルート語が将来出てきたときの逃げ道。通常は形だけで足りる。
 */
export function looksLikeIdentifier(value: string, routeWords: readonly string[] = []): boolean {
  if (value.includes('.')) return false // main.css のようなファイル名
  if (SCRUBBED_PLACEHOLDER_PATTERN.test(value)) return false
  if (UUID_PATTERN.test(value)) return true
  if (ROUTE_WORD_PATTERN.test(value)) return false
  return !routeWords.includes(value)
}

/** テキストから実IDらしき値を重複なく取り出す。 */
export function findUrlIdentifiers(text: string, routeWords: readonly string[] = []): string[] {
  const found = new Set<string>()
  for (const match of text.matchAll(URL_SEGMENT_PATTERN)) {
    const value = match[1]
    if (value !== undefined && looksLikeIdentifier(value, routeWords)) found.add(value)
  }
  return [...found]
}

/** docs/routes.json のパスから、ルートの固定語だけを取り出す（:param とIDは除く）。 */
export function routeWordsFromPaths(paths: readonly string[]): string[] {
  const words = new Set<string>()
  for (const path of paths) {
    for (const segment of path.split('/')) {
      if (segment === '' || segment.startsWith(':')) continue
      words.add(segment)
    }
  }
  return [...words]
}

/**
 * docs/routes.json の中身からルートの固定語を読む。
 *
 * 形が変わったときに「黙って空のリスト」を返すと、
 * 許可リストが空＝全部を実IDとみなす、という誤検知の嵐になる。
 * 逆に空を無害に扱うと今度は実IDを取りこぼす。どちらも危ないので必ずエラーにする。
 */
export function loadRouteWordsFromManifest(json: string): string[] {
  const parsed = JSON.parse(json) as { routes?: { path?: string }[] }
  if (!Array.isArray(parsed.routes)) {
    throw new Error('docs/routes.json に routes 配列がありません（形が変わった可能性）')
  }
  const paths = parsed.routes
    .map((route) => route.path)
    .filter((path): path is string => typeof path === 'string')
  return routeWordsFromPaths(paths)
}
