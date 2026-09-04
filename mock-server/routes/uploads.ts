/**
 * 画像アップロードエンドポイント。
 * エディタで挿入した画像をファイルとして保存し、HTTPでアクセスできるURLを返す。
 * data URL ではなくホスト済みURLにすることで、本家SquadBeyondへの貼り付け時に
 * ペイロードサイズ制限を回避できる。
 */
import { Router, type Request, type Response } from 'express'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const UPLOAD_DIR = join(import.meta.dirname, '..', 'uploads')

/** 起動時にディレクトリを作る */
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })

export const uploadsRouter = Router()

/**
 * POST /api/v1/uploads
 * Body: { filename: string, data: string }
 *   data は data URL 形式 ("data:image/png;base64,iVBOR...")
 * Returns: { url: "/uploads/<uuid>.<ext>" }
 */
uploadsRouter.post('/uploads', (req: Request, res: Response) => {
  const { filename, data } = req.body as { filename?: string; data?: string }
  if (typeof data !== 'string' || !data.startsWith('data:')) {
    res.status(400).json({ error: 'data must be a data URL' })
    return
  }

  // data URL をパース: "data:image/png;base64,iVBOR..."
  const match = data.match(/^data:([^;]+);base64,(.+)$/)
  if (match === null) {
    res.status(400).json({ error: 'invalid data URL format' })
    return
  }

  const mime = match[1]!
  const base64 = match[2]!
  const ext = extFromMime(mime, filename)
  const id = randomUUID()
  const savedName = `${id}.${ext}`
  const filePath = join(UPLOAD_DIR, savedName)

  writeFileSync(filePath, Buffer.from(base64, 'base64'))

  const url = `/uploads/${savedName}`
  console.log(`[uploads] saved ${savedName} (${mime}, ${Math.round(base64.length * 0.75 / 1024)}KB)`)
  res.json({ url })
})

function extFromMime(mime: string, filename?: string): string {
  // ファイル名から拡張子を取る
  if (typeof filename === 'string') {
    const dot = filename.lastIndexOf('.')
    if (dot !== -1) return filename.slice(dot + 1).toLowerCase()
  }
  // MIME から推定
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  }
  return map[mime] ?? 'bin'
}
