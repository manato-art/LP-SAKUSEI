/**
 * セッション内メモリストア（企画書 §10-9）。
 *
 * - 既定は空シード（§10-5）。
 * - 書き込みは必ず「新しい State を返す」イミュータブル更新（§12 コーディング規約）。
 * - reset で新規アカウント発行直後へ戻す（再起動 or `?reset=1`）。
 */
import { createEmptyState } from './seed-empty.ts'
import { createDemoState } from './seed-demo.ts'
import {
  archiveBeforeDestruction,
  loadPersistedState,
  persistenceEnabled,
  schedulePersist,
} from './persistence.ts'
import type { State } from './types.ts'
import { repairDuplicateUids } from './uid-repair.ts'
import { normalizeAllSteps } from './ratio-balance.ts'
import { externalizeStateImages } from './externalize-images.ts'
import { migrateFolderDomains } from './folder-domain.ts'
import { repairOverCountedClicks } from './click-repair.ts'
import { keepTwoUrlsForSpecialPage } from './two-url-page.ts'
import { backfillLastVisitDates } from './page-visit.ts'

/** シード（保存済みが無いときの初期状態）。SEED_DEMO=1 なら架空デモ1式、なければ空。 */
function seedState(): State {
  return process.env['SEED_DEMO'] === '1' ? createDemoState() : createEmptyState()
}

/**
 * 初期状態。DATA_DIR に保存済み state があればそれを読み戻す（ユーザーが作ったLPを保持）。
 * 無ければシード（テスト・検証の前提は変えない＝DATA_DIR未設定では常にシード）。
 */
function initialState(): State {
  const persisted = loadPersistedState()
  if (persisted !== null) {
    console.log(`[store] 永続化データから復元しました（abTests: ${persisted.abTests.length}件、folders: ${persisted.folders.length}件）`)
    return repairOnLoad(persisted)
  }
  const seed = seedState()
  console.log(`[store] シードから初期化（${persistenceEnabled() ? '永続化ファイル未検出' : 'DATA_DIR未設定'}、abTests: ${seed.abTests.length}件）`)
  return seed
}

/**
 * 保存データを読み込んだあとの後始末（2026-09-11 本人承認）。
 *   1. 同じ uid が2件以上あれば直す（uid を件数＋1で作っていた頃の不具合）
 *   2. 本文などに埋め込まれた画像・動画（data URL）を別ファイルにする（保存データが102MBあった件）
 *   3. ドメインの項目が無い古いフォルダを「このシステムのドメイン」にする（2026-09-13）
 *   4. 配信割合の合計が100%でないステップを、今の比のまま100%にそろえる（2026-09-24 本人承認「100%に直す」）。
 *      配信はもともと「割合÷合計」で配っているので、実際の出方はほぼ変わらない（画面の数字と実際を合わせるだけ）
 *   5. 計測リンクを押すたびに数えていた頃の、クリックが PV を超えた日を直す（2026-10-28 本人「過去も直して」・click-repair.ts）
 * 何か直したときは、直す前の内容を退避へ強制保存し、何をしたかをログに残してから、直した内容を保存し直す。
 */
function repairOnLoad(persisted: State): State {
  const repaired = repairDuplicateUids(persisted)
  const externalized = externalizeStateImages(repaired.state)
  // ドメインの項目が無い古いフォルダは、今まで配信URLに使ってきた「このシステムのドメイン」にする
  const folderDomains = migrateFolderDomains(externalized.state)
  const ratios = normalizeAllSteps(folderDomains.state)
  const clicks = repairOverCountedClicks(ratios.state)
  const twoUrls = keepTwoUrlsForSpecialPage(clicks.state)
  // 前からあるページの「最後に本物の人が来た日」を、残っている日ごとの数字から埋める（90日閲覧なしの印・2026-10-30）
  const visits = backfillLastVisitDates(twoUrls.state)
  if (
    repaired.changes.length === 0 &&
    externalized.converted === 0 &&
    folderDomains.changed === 0 &&
    ratios.changed.length === 0 &&
    clicks.changed.length === 0 &&
    twoUrls.changed.length === 0 &&
    visits.changed === 0
  ) {
    return persisted
  }
  archiveBeforeDestruction(persisted)
  for (const change of repaired.changes) {
    console.log(`[store] 同じ uid を付け直しました: ${change.collection} id=${change.id} ${change.from} → ${change.to}`)
  }
  if (externalized.converted > 0) {
    console.log(`[store] 本文などに埋め込まれていた画像・動画 ${externalized.converted} 個を別ファイルにしました`)
  }
  if (folderDomains.changed > 0) {
    console.log(`[store] フォルダ ${folderDomains.changed} 件のドメインを「このシステムのドメイン」にしました（項目が無い古いデータ）`)
  }
  for (const version of ratios.changed) {
    console.log(`[store] 配信割合を合計100%にそろえました: ${version.uid} → ${String(version.distribution_ratio)}%`)
  }
  for (const c of clicks.changed) {
    console.log(`[store] クリックを1回の表示につき1回までに直しました: ${c.scope} ${c.entity_uid} ${c.date}${c.device === null ? '' : ` ${c.device}`} ${String(c.from)} → ${String(c.to)}`)
  }
  for (const uid of twoUrls.changed) {
    console.log(`[store] ${uid} に c1page.com の住所を足しました（今までのURLもそのまま開ける）`)
  }
  if (visits.changed > 0) {
    console.log(`[store] ${String(visits.changed)} ページの最後に人が来た日を、日ごとの数字から埋めました`)
  }
  schedulePersist(visits.state)
  return visits.state
}

let current: State = initialState()
let revision = 0

export function getState(): State {
  return current
}

/** 現在のリビジョン（テスト・デバッグ用。書き込みごとに増える） */
export function getRevision(): number {
  return revision
}

/**
 * 更新関数から新しい State を作って差し替える。
 * updater は既存 State を破壊してはならない（常に新しいオブジェクト/配列を返す）。
 */
export function setState(updater: (state: State) => State): State {
  const next = updater(current)
  if (next === current) return current
  current = next
  revision += 1
  schedulePersist(current) // DATA_DIR があればディスクへ保存（無ければノーオペ）
  return current
}

/**
 * 新規アカウント発行直後へ戻す（§10-9 リセット）。SEED_DEMO のときはデモへ戻す。
 * **破壊の直前に現在の内容を強制アーカイブ**する（作業中の記事を消える前に必ず退避）。
 */
export function resetState(): State {
  archiveBeforeDestruction(current)
  current = seedState()
  revision += 1
  schedulePersist(current) // 保存済みもシードで上書き
  return current
}
