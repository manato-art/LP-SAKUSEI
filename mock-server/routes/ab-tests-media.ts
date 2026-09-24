/**
 * 媒体実績（配信金額 / 表示回数 / 媒体クリック / 媒体CV）の取り込み口（ab-tests.ts から分離・2026-09-24）。
 *
 * 値は出どころ（meta / csv）ごとに分けて持ち、合計をレポートに出す（store/media-sources.ts）。
 * 以前は Meta と CSV が互いに丸ごと上書きしていた（点検7）。
 */
import { Router } from 'express'
import { getState, setState } from '../store/store.ts'
import { dateRange } from '../store/metrics.ts'
import { mediaSourcesByDate, setMediaMetrics, type LegacyMediaPolicy } from '../store/media-sources.ts'
import { mediaImportsOf, recordMediaImport } from '../store/media-imports.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { dateRangeParams } from '../lib/query.ts'
import { syncMetaMedia } from '../meta-sync.ts'
import { findAbTest, notFound } from './ab-tests-shared.ts'
import type { MediaFigures } from '../store/types.ts'

export const abTestsMediaRouter: Router = Router()

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const MEDIA_FIELDS = ['ad_cost', 'imp', 'media_click', 'media_cv'] as const

/**
 * 広告費の取り込み（CSVから貼り付け・2026-09-15）。
 *
 * ⚠️ これは**実物のSquadBeyondには無い**、このシステムだけの入口（本人の依頼）。
 * 実物は広告アカウントを繋いで自動で取り込むが、Meta以外の媒体には繋げられないため、
 * 各媒体の管理画面から落とした日別の実績を入れられるようにした。
 *
 * 出どころ csv として入る。同じ日を入れ直すと csv のぶんだけ置き換わる（二重計上しない）。
 * 行に無い値（CSV に列が無い）は前の値のまま。Meta から入った値には触らない。
 * 出どころ不明の古い値は `legacy: 'replace'` のときだけ置き換え、既定は残して足す（画面で本人が選ぶ）。
 * LP側の実測（pv/click/cv）には触らない。
 */
abTestsMediaRouter.post('/ab_tests/:uid/ad_costs', (req, res) => {
  const abTest = findAbTest(getState(), req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')

  const body = req.body as { rows?: unknown; legacy?: unknown }
  const incoming = Array.isArray(body.rows) ? body.rows : []
  if (incoming.length === 0) {
    return res.status(422).json(errorEnvelope('validation_failed', '取り込む行がありません。'))
  }
  const legacy: LegacyMediaPolicy = body.legacy === 'replace' ? 'replace' : 'keep'

  const rows: { date: string; media: Partial<MediaFigures> }[] = []
  for (const raw of incoming) {
    const row = raw as Record<string, unknown>
    const date = typeof row['date'] === 'string' ? row['date'] : ''
    // 日付は YYYY-MM-DD だけ。形が違うものを黙って捨てると、入ったつもりで数字が合わなくなる。
    if (!DATE_KEY.test(date)) {
      return res
        .status(422)
        .json(errorEnvelope('validation_failed', `日付は YYYY-MM-DD で指定してください（${date}）。`))
    }
    // 送られてこなかった値は「変えない」。0 と読むと、CSV に無い列が0で上書きされる
    const media: Partial<MediaFigures> = {}
    for (const field of MEDIA_FIELDS) {
      const value = row[field]
      if (value === undefined) continue
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return res
          .status(422)
          .json(errorEnvelope('validation_failed', `${date} の ${field} は0以上の数で指定してください。`))
      }
      media[field] = value
    }
    rows.push({ date, media })
  }

  setState((s) => {
    let metrics = s.metrics
    for (const row of rows) {
      metrics = setMediaMetrics({ ...s, metrics }, abTest.uid, 'ab_test', row.date, 'csv', row.media, legacy)
    }
    return {
      ...s,
      metrics,
      mediaImports: recordMediaImport(s.mediaImports, {
        ab_test_uid: abTest.uid,
        source: 'csv',
        at: Date.now(),
        trigger: 'manual',
        ok: true,
        days: rows.length,
      }),
    }
  })
  res.json({ ok: true, days: rows.length })
})

/**
 * 期間内の日ごとの、媒体実績の出どころの内訳（読むだけ）。
 * 取り込む前に「この日には出どころ不明の古い値が残っている」と本人に見せて、置き換えるか選んでもらう。
 */
abTestsMediaRouter.get('/ab_tests/:uid/media_sources', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const { startDate, endDate } = dateRangeParams(req.query)
  res.json({ days: mediaSourcesByDate(state, abTest.uid, dateRange(startDate, endDate)) })
})

/** 最後に取り込んだ記録（レポートの「広告データ取得日時」） */
abTestsMediaRouter.get('/ab_tests/:uid/media_imports', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  res.json({ imports: mediaImportsOf(state, abTest.uid) })
})

/**
 * Meta の媒体実績の取り込み（手で押す）。見張りの自動取り込みと同じ道（meta-sync.ts）を通す。
 * Metaが返すのは日別の絶対値なので、出どころ meta のぶんだけ置き換える（再実行しても二重計上にならない）。
 */
abTestsMediaRouter.post('/ab_tests/:uid/meta_sync', (req, res) => {
  const abTest = findAbTest(getState(), req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')

  const body = req.body as Record<string, unknown>
  const since = typeof body.start_date === 'string' ? body.start_date : ''
  const until = typeof body.end_date === 'string' ? body.end_date : ''
  if (!DATE_KEY.test(since) || !DATE_KEY.test(until)) {
    res.status(422).json(errorEnvelope('validation_failed', '期間は YYYY-MM-DD で指定してください。'))
    return
  }

  void syncMetaMedia({ abTestUid: abTest.uid, since, until, trigger: 'manual' }).then((result) => {
    if (!result.ok) {
      const status = result.reason === 'not_linked' ? 422 : result.reason === 'no_token' ? 503 : 502
      res.status(status).json(errorEnvelope(result.reason, result.message))
      return
    }
    res.json({ ok: true, days: result.days, start_date: since, end_date: until })
  })
})
