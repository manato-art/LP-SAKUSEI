/**
 * 自動保存。
 *
 * 実物のエディタは自動保存が走る（`docs/findings-live-observation.md` の
 * 「エディタは『開くだけで自動保存』が走る」／DOM に `_saveAnimation_` が存在）。
 * クローンには保存の口はあったが、本文の変更で呼ばれておらず、
 * **打った内容がサーバーに残らない**状態だった。ここでその配線を閉じる。
 *
 * 1文字ごとに保存すると通信が飽和するので、打ち終わってからまとめて保存する。
 */

export interface AutosaveOptions {
  /** 実際に保存する処理。 */
  readonly save: () => Promise<void>
  /** 最後の変更から何ミリ秒待って保存するか。 */
  readonly delayMs: number
  /** 保存に失敗したときの通知先。握りつぶさないために必須の逃がし口。 */
  readonly onError?: (error: Error) => void
}

export interface Autosave {
  /** 変更があったことを伝える（保存は遅れて1回だけ走る）。 */
  schedule: () => void
  /**
   * 待たずに今すぐ保存する。保存できた（または保存するものが無かった）ら true、失敗したら false。
   * 失敗しても「保存しました」と出していた（2026-09-24 点検11）ので、呼び出し側が結果で出し分ける。
   */
  flush: () => Promise<boolean>
  /** まだ保存していない変更（保存中を含む）があるか。画面を閉じる前に知らせるのに使う */
  isPending: () => boolean
  /** 以降の保存を止める（画面を離れるとき）。 */
  stop: () => void
}

/** 失敗が続いたときのやり直しの間の上限 */
const MAX_RETRY_MS = 30_000

export function createAutosave({ save, delayMs, onError }: AutosaveOptions): Autosave {
  let timer: ReturnType<typeof setTimeout> | undefined
  let isDirty = false
  let isSaving = false
  let isStopped = false
  /** 続けて失敗した回数（やり直しの間を倍々にあける。通信が切れている間に叩き続けない） */
  let failures = 0

  async function run(): Promise<boolean> {
    if (isStopped || !isDirty || isSaving) return !isDirty
    isDirty = false
    isSaving = true
    let ok = true
    try {
      await save()
      failures = 0
    } catch (error) {
      // 保存できなかったことは必ず外へ出す（黙って失うのが最悪）。
      ok = false
      isDirty = true
      failures += 1
      onError?.(error as Error)
    } finally {
      isSaving = false
      // 保存中に新しい変更が来ていた・失敗したときは、もう一度予約し直す。
      if (isDirty && !isStopped) arm(Math.min(MAX_RETRY_MS, delayMs * 2 ** failures))
    }
    return ok
  }

  function arm(wait: number): void {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => void run(), wait)
  }

  function schedule(): void {
    if (isStopped) return
    isDirty = true
    arm(delayMs)
  }

  return {
    schedule,
    async flush(): Promise<boolean> {
      if (timer !== undefined) clearTimeout(timer)
      return run()
    },
    isPending: () => isDirty || isSaving,
    stop(): void {
      isStopped = true
      if (timer !== undefined) clearTimeout(timer)
    },
  }
}
