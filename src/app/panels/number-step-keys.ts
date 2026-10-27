/**
 * 数字の欄で、キーボードの ↑↓ を押すとその場で1ずつ変える（2026-10-27 本人「現在の大きさの数字を押したら、十字キーの上下でサイズの調整をしたい」）。
 * ブラウザのままだと欄の数字だけ変わり、欄から出るまで（change が出るまで）文字の大きさに効かなかった。
 */

/** 今の値を delta だけ動かした値。数字でない・min より小さくなるなら null */
export function nextStepValue(raw: string, delta: number, min: number): number | null {
  const value = Number.parseInt(raw, 10)
  if (Number.isNaN(value)) return null
  const next = value + delta
  return next < min ? null : next
}

/** 欄で ↑↓ を押したら、数字を変えてすぐ apply に渡す（ブラウザの「欄の数字だけ変える」動きは止める） */
export function wireStepKeys(input: HTMLInputElement, min: number, apply: (value: number) => void): void {
  input.addEventListener('keydown', (event) => {
    const delta = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0
    if (delta === 0) return
    event.preventDefault()
    const next = nextStepValue(input.value, delta, min)
    if (next === null) return
    // eslint-disable-next-line no-param-reassign -- 欄の数字を動かすのがこの関数の役目
    input.value = String(next)
    apply(next)
    // 効かせる側が本文を選び直す（Quill の setSelection）ので、欄を選び直して続けて ↑↓ を押せるようにする
    input.focus()
  })
}
