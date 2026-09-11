/**
 * LPに埋め込まれた画像・動画（data URL）を別ファイルにして、URL（/uploads/…）に置き換える（2026-09-11・本人依頼）。
 *
 * 本番では「めぐり」のLPの本文が約101MB（画像67枚を data URL で埋め込み）あり、保存データ102MBのほぼ全部だった。
 * 保存のたびにこの全体を書き直すのでサーバーが重く、配信LPもこの101MBをそのまま送っていた。
 *
 * - 保存先: UPLOADS_DIR（テストで指定）→ DATA_DIR/uploads（本番＝Volume）→ OSの一時フォルダ（開発）
 * - ファイル名: 中身の sha256 ＋拡張子。同じ画像は1ファイルにまとまる。消さない（履歴・退避・ほかのVersionが同じURLを持つため）
 * - 対象: base64 の画像（png/jpeg/gif/webp/avif）と動画（mp4/webm/ogg）で、ある程度大きいもの。
 *   SVG は中にスクリプトを書けるので対象外（管理画面と同じドメインのファイルとして開かれると危ない）
 * - URL はルート相対。配信LP・プレビュー・編集画面・ヒートマップは、すべて同じホストから出している
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** これより短い（小さい）埋め込みは、そのまま残す（小さなアイコンまでファイルにしない） */
export const MIN_EXTERNALIZE_BASE64_LENGTH = 2048

/** 公開パス（認証なし） */
export const UPLOADS_PATH = '/uploads'

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
}

/** `data:<種類>[;名前=値…];base64,<中身>`（base64 の文字だけを拾うので、引用符・括弧・カンマの手前で止まる） */
const DATA_URL_SOURCE =
  'data:(image\\/(?:png|jpe?g|gif|webp|avif)|video\\/(?:mp4|webm|ogg))((?:;[\\w.+-]+=[\\w.+-]*)*);base64,([A-Za-z0-9+/]+={0,2})'

/** 保存先のフォルダ */
export function uploadsDir(): string {
  const explicit = process.env['UPLOADS_DIR']
  if (explicit !== undefined && explicit !== '') return explicit
  const dataDir = process.env['DATA_DIR']
  if (dataDir !== undefined && dataDir !== '') return join(dataDir, 'uploads')
  return join(tmpdir(), 'lp-sakusei-uploads')
}

/** 中身をファイルに保存して公開URLを返す（同じ中身のファイルが既にあれば書かない） */
function saveUpload(content: Buffer, extension: string): string {
  const dir = uploadsDir()
  const name = `${createHash('sha256').update(content).digest('hex')}.${extension}`
  const path = join(dir, name)
  if (!existsSync(path)) {
    mkdirSync(dir, { recursive: true })
    // 書き込みの途中で止まっても壊れたファイルを残さないよう、一時ファイルに書いてから置き換える
    const temporary = `${path}.${process.pid}.tmp`
    writeFileSync(temporary, content)
    renameSync(temporary, path)
  }
  return `${UPLOADS_PATH}/${name}`
}

/**
 * 文字列（HTML・CSS・URL）の中の data URL を、別ファイルのURLに置き換える。
 * 保存できなかった画像は埋め込みのまま残す（画像を失わない）。失敗はログに残す。
 */
export function externalizeDataUrls(text: string): { text: string; converted: number } {
  if (!text.includes('data:')) return { text, converted: 0 }
  let converted = 0
  const next = text.replace(new RegExp(DATA_URL_SOURCE, 'g'), (whole, mime: string, _params: string, payload: string) => {
    const extension = EXTENSIONS[mime.toLowerCase()]
    if (extension === undefined || payload.length < MIN_EXTERNALIZE_BASE64_LENGTH) return whole
    try {
      const url = saveUpload(Buffer.from(payload, 'base64'), extension)
      converted += 1
      return url
    } catch (error) {
      console.error('[uploads] 埋め込み画像を別ファイルにできませんでした（埋め込みのまま残します）:', (error as Error).message)
      return whole
    }
  })
  return converted === 0 ? { text, converted: 0 } : { text: next, converted }
}
