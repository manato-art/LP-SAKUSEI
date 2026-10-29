/**
 * 保存の様子を返す（2026-10-29 本人「保存に失敗したらすぐ知らせる」）。
 *
 *   GET /system/save_status … 数字の保存がうまくいっているか（管理画面の赤い帯 save-status-banner.ts が1分ごとに聞く）
 *
 * 失敗の理由（ファイルの場所などが入りうる）は返さない。ログ（[store] 保存に失敗しました）で見る。
 */
import { Router } from 'express'
import { isHeavySave, measureDbStatus, persistenceEnabled, persistHealth } from '../store/persistence.ts'

export const systemStatusRouter: Router = Router()

systemStatusRouter.get('/system/save_status', (_req, res) => {
  const health = persistHealth()
  const db = measureDbStatus()
  const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString())
  res.json({
    save_status: {
      ok: health.failures === 0,
      failures: health.failures,
      last_ok_at: iso(health.lastOkAt),
      bytes: health.bytes,
      duration_ms: health.durationMs,
      heavy: health.failures === 0 && isHeavySave(health),
      // DATA_DIR が無い（手元・テスト）ときは保存していない＝失敗もしない
      persistent: persistenceEnabled(),
      // 数字の記録のデータベース（使っていなければ attached:false）。失敗の理由は返さない
      database: {
        attached: db.attached,
        source: db.source,
        unavailable: db.unavailable,
        failures: db.failures,
        last_ok_at: iso(db.lastOkAt),
      },
    },
  })
})
