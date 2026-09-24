/**
 * 媒体実績を最後に取り込んだ記録（2026-09-24）。
 *
 * レポートの「広告データ取得日時」は採取物の「データなし」が焼き付いたままで、
 * 取り込んでも変わらなかった。ページ×出どころ（meta / csv）で最後の1件だけ持つ。
 * 自動の取り込み（task-runner）が失敗したときは、その理由もここに残して画面に出す。
 */
import type { MediaImportRecord, State } from './types.ts'

export function recordMediaImport(
  records: State['mediaImports'],
  input: {
    ab_test_uid: string
    source: MediaImportRecord['source']
    at: number
    trigger: MediaImportRecord['trigger']
  } & ({ ok: true; days: number } | { ok: false; error: string }),
): State['mediaImports'] {
  const previous = records.find(
    (r) => r.ab_test_uid === input.ab_test_uid && r.source === input.source,
  )
  const next: MediaImportRecord = {
    ab_test_uid: input.ab_test_uid,
    source: input.source,
    last_attempt_at: input.at,
    last_success_at: input.ok ? input.at : (previous?.last_success_at ?? null),
    last_error: input.ok ? null : input.error,
    last_days: input.ok ? input.days : (previous?.last_days ?? 0),
    trigger: input.trigger,
  }
  return [
    ...records.filter((r) => !(r.ab_test_uid === input.ab_test_uid && r.source === input.source)),
    next,
  ]
}

export function mediaImportsOf(state: State, abTestUid: string): MediaImportRecord[] {
  return state.mediaImports
    .filter((r) => r.ab_test_uid === abTestUid)
    .sort((a, b) => a.source.localeCompare(b.source))
}
