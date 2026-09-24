/** 保存時刻の見せ方（editor-layout.ts から分けた） */
import { jstHhmm } from '../jst.ts'

/** Date → 「たった今」「N分前」「N時間前」「HH:MM」形式 */
export function formatSaveTime(saved: Date): string {
  const diff = Math.floor((Date.now() - saved.getTime()) / 1000)
  if (diff < 30) return 'たった今'
  if (diff < 60) return `${diff}秒前`
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins}分前`
  const hours = Math.floor(mins / 60)
  if (hours < 12) return `${hours}時間前`
  return jstHhmm(saved)
}
