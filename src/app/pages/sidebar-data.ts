/**
 * サイドバーのデータ画面（指示⑮・ユーザー承認の「モックで機能自作」）。
 *
 * 実本体の採取が許可経路外でできないため、これらはモックAPIのデータを土台に**機能する画面**を自作する
 * （実物とは見た目が多少ズレる旨をヘッダに明記）。対象:
 *   CV速報 / ドメイン / レポート除外 / ランキング / イベント・セミナー
 * どれもモックの実エンドポイント（/conversions, /teams/domains, /report-exclusions,
 * /ab_tests/rankings）を叩いて描く。空ならそのまま空状態を出す。
 *
 * ダッシュボードだけは「全体 / 各ページ」の切り替えを持って厚くなったので別ファイル
 * （`dashboard-page.ts`）。共通の部品は `data-ui.ts`。
 */
import { emptyState } from '../ui.ts'
import { pageShell } from './data-ui.ts'

/* ────────────── CV速報 ──────────────
 * ページ送り・CSV全件・自動更新を足して大きくなったので cv-flash-page.ts に分けた（2026-09-24）。
 * 取り込み側（main.ts・テスト）はここからのままでよいように、ここから出し直す。 */
export { conversionsCsv, cvTime, lastUpdatedLabel, renderConversions } from './cv-flash-page.ts'

/* ────────────── ドメイン ────────────── */
// ドメイン画面は domains-page.ts に分けた（入口はここのままにしておく）
export { renderDomains } from './domains-page.ts'

/* ────────────── レポート除外 ────────────── */
/* ────────────── ランキング ──────────────
 * ページ送り・読み込み失敗の表示・自動更新を足したので rankings-page.ts に分けた（2026-09-24）。 */
export { renderRankings } from './rankings-page.ts'

/* ────────────── イベント・セミナー ────────────── */
export function renderSeminarPage(container: HTMLElement): void {
  const content = pageShell(
    container,
    'イベント・セミナー',
    '※クローンが自作した画面です。',
  )
  content.append(
    emptyState('現在開催予定のイベント・セミナーはありません。'),
  )
}
