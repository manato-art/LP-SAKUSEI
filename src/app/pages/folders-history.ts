/**
 * 「最近見たページ」の履歴（folders.ts から分離）。
 *
 * 各画面（エディタ・レポート・基本情報）が開かれたときに `recordHistory` を呼び、
 * 左ツリーの履歴タブがそれを並べる。保存先はブラウザ内だけ。
 */
import { T, el } from '../ui.ts'

/** 履歴エントリ。何をいつ触ったか記録する。 */
export interface HistoryEntry {
  uid: string
  name: string
  type: 'folder' | 'ab_test'
  action: string
  timestamp: number
}
/** 最近の操作を新しい順に保持（最大30件）。 */
export const activityHistory: HistoryEntry[] = []
/** 操作を履歴に記録する（先頭に挿入・同一UIDの直近エントリは更新）。 */
export function recordHistory(uid: string, name?: string, type: 'folder' | 'ab_test' = 'folder', action = '閲覧'): void {
  // 同一UIDの直近操作が同じアクションなら更新だけ
  const existing = activityHistory.findIndex((e) => e.uid === uid && e.action === action)
  if (existing !== -1) activityHistory.splice(existing, 1)
  activityHistory.unshift({
    uid,
    name: name ?? uid,
    type,
    action,
    timestamp: Date.now(),
  })
  if (activityHistory.length > 30) activityHistory.length = 30
}
/** 後方互換: フォルダUIDだけのアクセス順リストを返す（filterFoldersByTab用） */
export function folderHistoryUids(): readonly string[] {
  return activityHistory
    .filter((e) => e.type === 'folder')
    .map((e) => e.uid)
    .filter((uid, i, arr) => arr.indexOf(uid) === i) // 重複除去
}
/** 履歴タブ: 操作ログ（何をいつ触ったか）を表示する。 */
export function renderHistoryList(container: Element): void {
  if (activityHistory.length === 0) {
    const msg = document.createElement('div')
    msg.style.cssText = 'padding:24px 16px;color:#999;font-size:13px;text-align:center'
    msg.textContent = '最近の操作はありません'
    container.append(msg)
    return
  }

  for (const entry of activityHistory) {
    const row = el('div', {
      style: [
        'display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer',
        `border-bottom:1px solid #F0F0F0;font-family:${T.font}`,
      ].join(';'),
    })

    // アイコン（フォルダ/ページ）
    const icon = el('div', {
      style: 'width:28px;height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:6px;background:#F5F5F5',
    })
    icon.innerHTML = entry.type === 'folder'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="#666"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="#666"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>'

    // 名前 + アクション
    const info = el('div', { style: 'flex:1;min-width:0' })
    const nameLine = el('div', {
      text: entry.name,
      style: `font-size:13px;color:${T.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`,
    })
    const actionLine = el('div', {
      text: `${entry.action} · ${formatTimestamp(entry.timestamp)}`,
      style: `font-size:11px;color:${T.sub};margin-top:2px`,
    })
    info.append(nameLine, actionLine)
    row.append(icon, info)

    // クリック → 該当ページへ遷移
    row.addEventListener('click', () => {
      if (entry.type === 'folder') {
        location.hash = `/folders?uid=${entry.uid}`
      } else {
        // beyondページ → エディタへ
        location.hash = `/ab_tests/${entry.uid}/articles`
      }
    })

    // ホバー
    row.addEventListener('mouseenter', () => { row.style.background = '#F8F8F8' })
    row.addEventListener('mouseleave', () => { row.style.background = '' })

    container.append(row)
  }
}
/** タイムスタンプを相対時間で表示（「3分前」「2時間前」「昨日」等） */
export function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'たった今'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}分前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}時間前`
  const day = Math.floor(hour / 24)
  if (day === 1) return '昨日'
  if (day < 7) return `${day}日前`
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
