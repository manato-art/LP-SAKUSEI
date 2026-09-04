/**
 * 画像をモックサーバーにアップロードし、ホスト済みURLを返す。
 * data URL の代わりにこのURLを使うことで、本家SquadBeyondに貼り付けたときに
 * ペイロードサイズ制限を回避できる。
 */

/**
 * data URL をサーバーにアップロードし、ホスト済みの相対URLを返す。
 * アップロード失敗時は元の data URL をそのまま返す（フォールバック）。
 */
export async function uploadImage(filename: string, dataUrl: string): Promise<string> {
  if (dataUrl === '' || !dataUrl.startsWith('data:')) return dataUrl
  try {
    const res = await fetch('/api/v1/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, data: dataUrl }),
    })
    if (!res.ok) {
      console.warn('[upload] failed:', res.status)
      return dataUrl
    }
    const json = (await res.json()) as { url: string }
    return json.url
  } catch (err) {
    console.warn('[upload] error:', err)
    return dataUrl
  }
}
