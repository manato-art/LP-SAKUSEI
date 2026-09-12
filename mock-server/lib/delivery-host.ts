/**
 * 来たドメインで配信を絞る（2026-09-13・本人承認）。
 *
 * フォルダにドメインを設定すると、そのドメインは「そのフォルダのLPを出すためのドメイン」になる。
 * 別フォルダのLPをそのドメインで開けてしまうと、ドメインを分ける意味（1本が止められても他が無事）が無くなる。
 *
 * 判定は必ず fail-closed（分からないときに通さない）。読み取り（LP表示）だけでなく
 * 書き込み（計測ビーコン）にも同じ判定を通す ＝ 過去の「ガードが読み取り限定で書込側が越境」の再発防止。
 */
import type { AbTest, Folder, State } from '../store/types.ts'

/** ホストの正準キー（小文字・ポートと末尾の . を外す）。名前の揺れで判定しない。 */
export function canonicalHost(raw: string | undefined): string {
  if (typeof raw !== 'string') return ''
  let host = raw.trim().toLowerCase()
  const bracket = host.lastIndexOf(']') // IPv6（[::1]:3000）
  const colon = host.indexOf(':', bracket === -1 ? 0 : bracket)
  if (colon !== -1) host = host.slice(0, colon)
  if (host.endsWith('.')) host = host.slice(0, -1)
  return host
}

/**
 * そのホストを配信ドメインにしているフォルダ。
 * 見つからなければ null ＝ このシステム自身のドメインとして扱う（今までどおり全部出す）。
 */
export function folderForHost(state: State, host: string): Folder | null {
  if (host === '') return null
  return (
    state.folders.find((f) => {
      const domain = f.domain ?? ''
      return domain !== '' && domain !== 'system' && domain === host
    }) ?? null
  )
}

/** そのホストで、この beyondページ を配信してよいか */
export function isServableOnHost(state: State, abTest: AbTest, host: string): boolean {
  const folder = folderForHost(state, host)
  if (folder === null) return true // このシステムのドメイン（管理・検証用）は今までどおり
  return typeof abTest.folder_id === 'number' && abTest.folder_id === folder.id
}
