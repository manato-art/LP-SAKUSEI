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
  /** 待たずに今すぐ保存する。保存するものが無ければ何もしない。 */
  flush: () => Promise<void>
  /** 以降の保存を止める（画面を離れるとき）。 */
  stop: () => void
}

export function createAutosave({ save, delayMs, onError }: AutosaveOptions): Autosave {
  let timer: ReturnType<typeof setTimeout> | undefined
  let isDirty = false
  let isSaving = false
  let isStopped = false

  async function run(): Promise<void> {
    if (isStopped || !isDirty || isSaving) return
    isDirty = false
    isSaving = true
    try {
      await save()
    } catch (error) {
      // 保存できなかったことは必ず外へ出す（黙って失うのが最悪）。
      isDirty = true
      onError?.(error as Error)
    } finally {
      isSaving = false
      // 保存中に新しい変更が来ていたら、もう一度予約し直す。
      if (isDirty && !isStopped) schedule()
    }
  }

  function schedule(): void {
    if (isStopped) return
    isDirty = true
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => void run(), delayMs)
  }

  return {
    schedule,
    async flush(): Promise<void> {
      if (timer !== undefined) clearTimeout(timer)
      await run()
    },
    stop(): void {
      isStopped = true
      if (timer !== undefined) clearTimeout(timer)
    },
  }
}
