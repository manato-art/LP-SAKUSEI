/**
 * SquadBeyond の Widget が使う画像・動画・スクリプト（SBの置き場から写したもの・tools/sb-widgets/build.ts が作る）を、
 * 起動時に /uploads（lib/uploads.ts の置き場）へ置く（2026-10-26 本人の決定「画像はEBIyonに写して持つ」）。
 *
 * ファイル名は中身の sha256＋拡張子（/uploads の決まりと同じ）。Widget の中の URL は build.ts が /uploads/… に書き換えてある。
 * あるファイルは書き直さない（何度起動しても同じ）。
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { uploadsDir } from './uploads.ts'

export const SB_WIDGET_MEDIA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'sb-widget-media')

/** 写したファイルを /uploads に置く。新しく置いた数を返す */
export function seedSbWidgetMedia(): number {
  if (!existsSync(SB_WIDGET_MEDIA_DIR)) return 0
  const dir = uploadsDir()
  mkdirSync(dir, { recursive: true })
  let placed = 0
  for (const name of readdirSync(SB_WIDGET_MEDIA_DIR)) {
    const to = join(dir, name)
    if (existsSync(to)) continue
    copyFileSync(join(SB_WIDGET_MEDIA_DIR, name), to)
    placed += 1
  }
  return placed
}
