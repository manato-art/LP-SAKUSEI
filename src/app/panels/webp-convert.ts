/**
 * 指示㊿③: 画像ファイルをWebP形式に変換するユーティリティ。
 *
 * Canvas API を使ってブラウザ内で変換する（サーバー不要）。
 * - JPEG/PNG → WebP に変換（ファイルサイズの大幅削減）
 * - GIF は**変換しない**（アニメーションが失われるため）
 * - 動画は対象外（WebPは静止画フォーマット）
 * - 変換品質は 0.85（高品質かつサイズ削減のバランス）
 */

const WEBP_QUALITY = 0.85

/** WebP変換すべき MIME かどうか。GIF と動画は対象外 */
export function isConvertibleToWebP(mime: string): boolean {
  return (
    (mime.startsWith('image/') && mime !== 'image/gif' && mime !== 'image/webp') ||
    false
  )
}

/**
 * 画像ファイルをWebP形式の dataURL に変換する。
 * 変換できない場合（GIF/動画/Canvas非対応）は元のdataURLを返す。
 */
export async function convertImageToWebP(file: File): Promise<string> {
  if (!isConvertibleToWebP(file.type)) {
    return readFileAsDataUrl(file)
  }
  try {
    const original = await readFileAsDataUrl(file)
    if (original === '') return ''
    const img = await loadImage(original)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (ctx === null) return original
    ctx.drawImage(img, 0, 0)
    const webpUrl = canvas.toDataURL('image/webp', WEBP_QUALITY)
    // ブラウザが WebP をサポートしていない場合、PNG が返る（data:image/png…）
    if (!webpUrl.startsWith('data:image/webp')) return original
    return webpUrl
  } catch {
    // 変換失敗時は元画像をそのまま使う
    return readFileAsDataUrl(file)
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () => resolve(''))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = src
  })
}
