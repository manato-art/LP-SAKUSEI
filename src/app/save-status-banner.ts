/**
 * 数字の保存に失敗しているあいだ、管理画面のいちばん上に赤い帯を出す（2026-10-29 本人「保存に失敗したらすぐ知らせる」）。
 *
 * 異常のお知らせ（チャットワーク・LINEなど）が切でも、画面を開いた人には必ず分かるように。
 * 1分ごとにサーバーへ聞き（GET /system/save_status・mock-server/routes/system-status.ts）、直ったら消す。
 */
import { request } from './api.ts'
import { jstParts } from './jst.ts'

export interface SaveStatus {
  ok: boolean
  failures: number
  /** 最後に保存できた時刻（ISO）。起動してから一度も保存できていなければ null */
  last_ok_at: string | null
}

const BANNER_ATTR = 'data-save-status-banner'
const POLL_MS = 60_000

function lastOkLabel(iso: string | null): string {
  if (iso === null) return '起動してから、まだ一度も保存できていません'
  const p = jstParts(new Date(iso))
  return `最後に保存できたのは ${String(p.month)}月${String(p.day)}日 ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')} です`
}

/** 保存の様子に合わせて帯を出す・消す */
export function renderSaveStatusBanner(status: SaveStatus): void {
  const current = document.querySelector<HTMLElement>(`[${BANNER_ATTR}]`)
  if (status.ok) {
    current?.remove()
    return
  }
  const bar = current ?? document.createElement('div')
  bar.setAttribute(BANNER_ATTR, '')
  bar.setAttribute('role', 'alert')
  bar.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'z-index:2147483000',
    'padding:10px 16px',
    'background:#C62828',
    'color:#FFFFFF',
    'font-size:14px',
    'font-weight:700',
    'line-height:1.6',
    'text-align:center',
  ].join(';')
  bar.textContent =
    `数字の保存に失敗しています。${lastOkLabel(status.last_ok_at)}。` +
    'このままだと、それより後の数字が消えるおそれがあります。すぐに担当者へ連絡してください。'
  if (current === null) document.body.append(bar)
}

async function check(): Promise<void> {
  const { save_status: status } = await request<{ save_status: SaveStatus }>('GET', '/system/save_status')
  renderSaveStatusBanner(status)
}

/** 管理画面を開いたときに1回呼ぶ（main.ts）。以後1分ごとに聞く */
export function startSaveStatusWatch(): void {
  // 聞けなかった回（更新で一瞬止まっている・ネットが切れた）は、帯を出し入れせず次の回に聞き直す。
  // 聞けないこと自体は保存の失敗ではないので、ここで「失敗」と出すと間違いになる
  const tick = (): void => {
    check().catch(() => undefined)
  }
  tick()
  setInterval(tick, POLL_MS)
}
