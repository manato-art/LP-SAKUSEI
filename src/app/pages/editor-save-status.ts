/**
 * 見出しの保存状態（「✓ 保存済み たった今」の所・2026-09-24 全体点検11）。
 *
 * 以前は最初に「✓保存済み」と書いたきり変わらず、未保存・保存中・失敗を出す処理は
 * 実在しない「更新」ボタンを探して何もしていなかった。保存に失敗しても「保存済み」のままだった。
 * ここで、見出しの1か所に今の状態を出す。
 */
import { formatSaveTime } from './save-time.ts'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'empty' | 'conflict'

export interface SaveStatusView {
  readonly mark: string
  readonly label: string
  /** 印と文字の色 */
  readonly color: string
  /** 保存した時刻を添えるか */
  readonly showTime: boolean
  /** 押すと保存をやり直せるか */
  readonly canRetry: boolean
}

export function saveStatusView(state: SaveState): SaveStatusView {
  switch (state) {
    case 'dirty':
      return { mark: '●', label: '未保存', color: '#D97706', showTime: false, canRetry: false }
    case 'saving':
      return { mark: '…', label: '保存中', color: '#6B7280', showTime: false, canRetry: false }
    case 'error':
      return { mark: '!', label: '保存できませんでした（押すともう一度）', color: '#DC2626', showTime: false, canRetry: true }
    case 'empty':
      return { mark: '!', label: '本文が空のため保存していません', color: '#D97706', showTime: false, canRetry: false }
    case 'conflict':
      return { mark: '!', label: 'ほかの人が先に保存しました', color: '#DC2626', showTime: false, canRetry: true }
    case 'saved':
      return { mark: '✓', label: '保存済み', color: '#00B341', showTime: true, canRetry: false }
  }
}

export interface SaveStatus {
  readonly el: HTMLElement
  readonly set: (state: SaveState) => void
  readonly state: () => SaveState
}

/** 見出しに置く保存状態。onRetry は「保存できませんでした」を押したとき */
export function createSaveStatus(onRetry: () => void): SaveStatus {
  const el = document.createElement('span')
  el.className = 'sb-header-save-status save-status'
  el.setAttribute('data-header-save-status', 'true')
  el.setAttribute('role', 'status')
  const mark = document.createElement('span')
  const label = document.createElement('span')
  const time = document.createElement('span')
  time.style.cssText = 'font-size:10px;color:#B0B0B0'
  time.setAttribute('data-save-time', 'true')
  el.append(mark, label, time)

  let current: SaveState = 'saved'
  let savedAt = Date.now()
  const paint = (): void => {
    const view = saveStatusView(current)
    mark.textContent = view.mark
    mark.style.color = view.color
    label.textContent = view.label
    label.style.color = view.canRetry || current !== 'saved' ? view.color : ''
    time.textContent = view.showTime ? formatSaveTime(new Date(savedAt)) : ''
    el.style.cursor = view.canRetry ? 'pointer' : ''
    el.title = view.canRetry ? 'もう一度保存する' : ''
  }
  el.addEventListener('click', () => {
    if (saveStatusView(current).canRetry) onRetry()
  })
  // 「N分前」を進める
  setInterval(() => {
    if (current === 'saved' && el.isConnected) paint()
  }, 60_000)
  paint()
  return {
    el,
    set: (state) => {
      current = state
      if (state === 'saved') savedAt = Date.now()
      paint()
    },
    state: () => current,
  }
}
