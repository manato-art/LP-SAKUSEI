/**
 * サーバーのファイルを、ブラウザの「保存」に渡す。
 *
 * `<a href download>` を直に押すと、失敗したとき（ログイン切れ等）にエラーの中身が
 * そのままファイルとして保存されてしまう。先に取りに行き、取れたときだけ保存する。
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ファイルを取得できませんでした (${res.status})`)
  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = filename
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(href)
  }
}
