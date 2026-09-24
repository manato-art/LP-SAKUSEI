/**
 * 配信割合の合計が100%でないときの知らせ（2026-09-24 全体点検34）。
 *
 * 配信は「割合 ÷ 合計」で配る（mock-server/routes/delivery-targeting.ts）ので、50・50・50 なら実際は3等分になる。
 * サーバーは合計のずれを返していたが、画面のどこにも出ていなかった。Version一覧の上に出す。
 */
export interface RatioVersion {
  readonly name: string
  readonly distribution_ratio: number
  readonly archived?: boolean
}

export function ratioNotice(versions: readonly RatioVersion[]): string | null {
  const active = versions.filter((v) => v.archived !== true)
  const total = active.reduce((sum, v) => sum + v.distribution_ratio, 0)
  if (total === 100) return null
  if (total <= 0) return '配信割合が1以上のVersionがありません。このステップは配信されません。'
  const shares = active
    .filter((v) => v.distribution_ratio >= 1)
    .map((v) => `${v.name} ${String(Math.round((v.distribution_ratio / total) * 100))}%`)
  return `配信割合の合計が${String(total)}%です。実際は ${shares.join('・')} の割合で出ます。`
}

/** Version一覧の上の知らせを描き直す（合計が100%なら消す） */
export function paintRatioNotice(list: HTMLElement, versions: readonly RatioVersion[]): void {
  const text = ratioNotice(versions)
  let note = list.querySelector<HTMLElement>('[data-ratio-notice]')
  if (text === null) {
    note?.remove()
    return
  }
  if (note === null) {
    note = document.createElement('div')
    note.setAttribute('data-ratio-notice', 'true')
    note.setAttribute('role', 'status')
    note.style.cssText =
      'margin:6px 8px;padding:8px 10px;border-radius:6px;background:#FFF7E6;color:#8A5300;font-size:12px;line-height:1.6'
    list.prepend(note)
  }
  note.textContent = text
}
