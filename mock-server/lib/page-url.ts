/**
 * 貼られたURL（またはuidだけ）から、どのページを指しているかを読む（純粋関数）。
 * 審査の「beyondページURL検索」で使う。
 *
 *   /lp/<uid>                … このシステムの配信URL（フォルダのドメイン付きでも同じ）
 *   /ab/<uid>                … 実物のSquadBeyondの配信URLの形
 *   /preview/<VersionのID>   … プレビューURL
 *   /redirect_pages/<uid>    … 中間ページURL
 *   <uid>                    … uid だけ
 */
export interface PageUrlRef {
  kind: 'page' | 'preview' | 'redirect'
  uid: string
}

const UID = '[A-Za-z0-9_-]+'
const PATTERNS: readonly { kind: PageUrlRef['kind']; re: RegExp }[] = [
  { kind: 'page', re: new RegExp(`/(?:lp|ab)/(${UID})`) },
  { kind: 'preview', re: new RegExp(`/preview/(${UID})`) },
  { kind: 'redirect', re: new RegExp(`/redirect_pages/(${UID})`) },
]

export function parsePageUrl(raw: string): PageUrlRef | null {
  const value = raw.trim()
  if (value === '') return null
  for (const { kind, re } of PATTERNS) {
    const uid = re.exec(value)?.[1]
    if (uid !== undefined) return { kind, uid }
  }
  // 「/」を含まない1語なら uid とみなす（パス検索欄の入力）
  return new RegExp(`^${UID}$`).test(value) ? { kind: 'page', uid: value } : null
}
