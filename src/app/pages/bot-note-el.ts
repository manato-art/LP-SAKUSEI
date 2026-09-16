/**
 * 「ボットのアクセスは含めていません（◯件）」の表示（2026-09-16・本人の依頼）。
 *
 * レポート画面とダッシュボードで同じものを出す。文言は src/shared/bot-note.ts に1か所。
 * 何をボットとしているかは、押すと開く（スマホではマウスを乗せられないので title には頼らない）。
 */
import { T, el } from '../ui.ts'
import { BOT_NOTE_DETAIL, botNoteText } from '../../shared/bot-note.ts'

export function buildBotNote(count: number): HTMLElement {
  const details = document.createElement('details')
  details.className = 'sb-bot-note'
  details.style.cssText = `font-size:12px;color:${T.sub};line-height:1.7;margin:4px 0 12px`
  const summary = document.createElement('summary')
  summary.textContent = botNoteText(count)
  summary.style.cursor = 'pointer'
  details.append(
    summary,
    el('div', { text: BOT_NOTE_DETAIL, style: 'padding:4px 0 0 14px' }),
  )
  return details
}
