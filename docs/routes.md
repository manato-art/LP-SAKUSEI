# ルート母集合と進捗の索引

- **ルート数の正本は `docs/routes.json`**（機械可読）。本ファイルは人間向けの索引。
- **完了単位は「ルート」ではなく「ルート×状態」**。進捗の正準は `traceability.md`（生成物）。
- **基準状態は新規アカウント（空）＋作成フロー**（企画書 §1-4）。各ルートの最重要状態は
  `empty` と creation flow。populated 状態は後日の実データ取込フェーズ。
- 状態記号: `[ ]`未着手 / `[~]`normalのみ / `[x]`必須状態まで再現完了（企画書 §7-4）
- ルート≠画面の是正（企画書 §6-2）を各行に注記。

## ルート数の現状（企画書§6-1「未知ルート0」証明の前）

| | 件数 |
|---|---|
| 付録Aの行数 | 81 |
| うち非UIルート（`/cable` WS） | 1 |
| **UIルート（`*` 404含む）** | **79** |

企画書本文は「82ルート」と書くが、付録Aの機械抽出は **81行**（重複0）。
差の内訳は `/cable`（WebSocket・非UIルート）と `*`（404キャッチオール）の数え方と推定される。
**企画書 §6-1 の「未知ルート0」証明（バンドル抽出＋ナビ全巡回＋sitemap突合）で確定させること。**
確定したら `docs/routes.json` を更新し、`npm run capture-plan` と `npm run traceability` を再生成する。
検証スクリプトはルート数をハードコードせず `docs/routes.json` を読むので、更新は1箇所で済む。

## 認証 / ユーザー（Tier1一部 / Tier3）
- [ ] /users/sign_up — 状態: 0/? （多段: sign_up→confirmation→code/new。各ステップ+バリデーションエラー）
- [ ] /users/confirmation
- [ ] /users/confirmation/code/new
- [ ] /users/forgot_password
- [ ] /users/password/edit
- [ ] /users/edit
- [ ] /users/public_api_key
- [ ] /users/teams  （テナント切替）

## ダッシュボード（Tier1）
- [ ] / — ログイン後ダッシュボードへ
- [ ] /dashboard — 状態: 0/? （KPI/Recharts/一覧/期間切替。normal/empty/loading/error/pc/sp）
- [ ] /dashboard/:uid

## beyondページ（ab_test）（Tier2）
- [ ] /ab_tests/:ab_test_uid/articles  ★【LPエディタ本体＝アプリ中核画面】企画書§6-2/§9-1。状態多数(左右レール/Versionパネル/PC・SPプレビュー/公開確認/undo-redo/コード編集)。states/ に展開
- [ ] /ab_tests/:ab_test_uid/articles/:article_uid/previews
- [ ] /ab_tests/:ab_test_uid/articles/exit_popups
- [ ] /ab_tests/:ab_test_uid/articles/htmls/heatmaps/comparisons  （ヒートマップ比較・§9-4）
- [ ] /ab_tests/:ab_test_uid/articles/split_test_settings/carriers
- [ ] /ab_tests/:ab_test_uid/articles/split_test_settings/devices
- [ ] /ab_tests/:ab_test_uid/articles/split_test_settings/hours
- [ ] /ab_tests/:ab_test_uid/articles/split_test_settings/oses
- [ ] /ab_tests/:ab_test_uid/articles/split_test_settings/params
- [ ] /ab_tests/:ab_test_uid/articles/split_test_settings/periods
- [ ] /ab_tests/:ab_test_uid/creative_report
- [ ] /ab_tests/:ab_test_uid/options/devide
- [ ] /ab_tests/:ab_test_uid/redirect_pages
- [ ] /ab_tests/:ab_test_uid/reports
- [ ] /ab_tests/:ab_test_uid/reports/lp
- [ ] /ab_tests/:ab_test_uid/reports/swipe
- [ ] /ab_tests/:ab_test_uid/versions/swipe

## フォルダ（Tier1 core / Tier2-3）
- [ ] /folders — 状態: 0/? （木+一覧。normal/empty/loading/error/delete-confirm/filter-empty/page-last/pc/sp）
- [ ] /folders/forms
- [ ] /folders/:uid/edit
- [ ] /folders/:folder_uid/ab_tests/:ab_test_uid/edit  ← LPエディタの別入口。/ab_tests/:uid/articles と同一コンポーネント共有（関係は§16-3で確定）
- [ ] /folders/:folder_uid/ab_tests/:ab_test_uid/redirect_pages
- [ ] /folders/:folder_uid/conversion_tags
- [ ] /folders/:folder_uid/forms/:uid
- [ ] /folders/:folder_uid/operator_articles
- [ ] /folders/:folder_uid/operator_articles/:uid/edit

## 記事一括 / コンバージョン（Tier2-3）
- [ ] /articles/bulk_replaces
- [ ] /conversions  ← CV速報（リアルタイムWS・§9-3/§10-7）
- [ ] /conversion-reports

## タスク / 審査（Tier2-3）
- [ ] /tasks
- [ ] /inspections
- [ ] /inspections/authorities
- [ ] /inspections/folders

## AI（Tier3）
- [ ] /sb_ai
- [ ] /sb_ai/chat  （SSEストリーミング・§10-7）
- [ ] /sb_ai/chat/:conversationId

## チーム / 連携（Tier3）
- [ ] /teams/ad_accounts
- [ ] /teams/asp_accounts
- [ ] /teams/domains
- [ ] /teams/plans
- [ ] /teams/product_search_forms
- [ ] /teams/tags
- [ ] /teams/:team_uid/members/:member_uid/invitations/edit

## 広告OAuthコールバック（Tier3）
- [ ] /redirections/ab_tests/google_postback_setting
- [ ] /redirections/ad_accounts/facebook
- [ ] /redirections/ad_accounts/google
- [ ] /redirections/ad_accounts/microsoft
- [ ] /redirections/ad_accounts/x
- [ ] /redirections/ad_accounts/yahoo

## 設定 / 通知（Tier3）
- [ ] /settings/internal_notifications/member
- [ ] /settings/internal_notifications/team
- [ ] /report-exclusions

## 課金 / アドオン（Tier3）
- [ ] /plans/:planUid/payment/checkout  （多段ウィザード: 各ステップ+バリデーション）
- [ ] /addon/option-list

## 管理者（Tier4）
- [ ] /admin-report
- [ ] /admin/articles/html_parts
- [ ] /admin/plans
- [ ] /admin/plans/new
- [ ] /admin/preset_access_denials
- [ ] /admin/product_search_forms
- [ ] /admin/teams
- [ ] /admin/teams/new
- [ ] /admin/teams/:team_uid/members
- [ ] /admin/teams/:team_uid/plans/payments

## その他（Tier4）
- [ ] /permissions
- [ ] /introductions
- [ ] /seminar
- [ ] /terms
- [ ] /cable   （WebSocket。UIルートではない・WSモックで再現）
- [ ] *        （404 キャッチオール）

