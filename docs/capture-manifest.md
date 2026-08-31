# 採取マニフェスト（capture manifest）

企画書 §11「採取ビルドの固定（必須）」・§13-H の要求物。
**capture-and-rehydrate は単一ビルドに依存する**ため、採取物のビルドが混ざると
CSSハッシュとDOM構造がずれ、視覚検証が意味を失う。

## 記録すべきもの（採取係が採取開始時に埋める）

| 項目 | 値 | 備考 |
|---|---|---|
| 採取日時 | （未記入） | |
| メインJSバンドル hash | （未記入） | `/assets/index-<hash>.js` |
| メインCSS hash | （未記入） | `/assets/index-<hash>.css`（約322KB） |
| サブCSS hash | （未記入） | 約51KB |
| アイコンCSS hash | （未記入） | |
| 採取アカウント種別 | （未記入） | 新規アカウント / 既存アカウント（§5-7 観測フロアに影響） |
| 採取ブラウザ | （未記入） | Chrome バージョン |

## 運用ルール

- 全採取物のビルドを**一致**させる。混在したら混在した分だけ再採取。
- オリジナルが再ビルドされたら、**該当ルートのみ**再キャプチャする（全部撮り直さない）。
- 採取物は `~/squadbeyond-capture-quarantine/` へ。**リポジトリには入れない**（§3-3）。
- 匿名化（`npx tsx tools/scrub/index.ts`）→ grepゲート合格（`npm run gate`）を通ってはじめて
  `capture/clean/` へ昇格し、コミットしてよい。

## 前提: 採取アカウントは「実データ入りの既存アカウント」のみ

新規アカウントは発行できない（2026-08-31 確認済）。よって企画書 §5-7 の観測フロア問題が全面的に効く。
各状態は `capture_mode` で採取手段を分けてある:

| capture_mode | 意味 | priority1の件数 |
|---|---|---|
| `read-only` | 見るだけで撮れる。本番に一切書き込まない | 104 |
| `write-production` | **本番アカウントに採取用エンティティを作ってから撮る**（要承認・後始末必須） | 165 |
| `hand-built` | 本番からは原理的に観測できない。実CSS＋データモデルから手構築（§5-7(b)） | 33 |

### 本番書き込みの取り扱い（重要）

`write-production` は本番アカウントに**実レコードを作る**。以下を必ず守る:

- 採取用の親フォルダを1つ作り、**作ったものは全てその配下に入れる**（後で一括削除できるように）
- 名前は `【採取用】` で始める（同僚が見て誤解しないように）
- **公開(publish)は押さない。** 確認ダイアログの見た目までを撮って閉じる。
  実LPが外部公開されうるため、公開後の画面が要る場合は別途人間の判断を仰ぐ
- 採取完了後、作ったものを削除する（削除の確認ダイアログ自体も採取対象なので一石二鳥）
- 実際に作るレコードは十数件程度（フォルダ数個・beyondページ数個・Version数個）。
  `write-production` の165件は「そのレコードを使って撮る画面の数」であって、レコード数ではない

## 採取手順

### Step 0. 空かどうかの棚卸し（最初にやる・所要15分）

下記は「アカウント全体の一覧」なので原理的には空にできないが、**その機能を使っていなければ既に空**である。
各ルートを開いて空かどうかを記録する。**空だったものは hand-built から read-only に格下げでき、手構築の手間が消える。**
結果をこの表に埋めてから `docs/routes.json` と capture-plan を更新すること。

| ルート | 既に空？ | 件数 | メモ |
|---|---|---|---|
| `/` | [ ] | | |
| `/dashboard` | [ ] | | |
| `/dashboard/:uid` | [ ] | | |
| `/folders` | [ ] | | |
| `/folders/forms` | [ ] | | |
| `/articles/bulk_replaces` | [ ] | | |
| `/conversions` | [ ] | | |
| `/conversion-reports` | [ ] | | |
| `/tasks` | [ ] | | |
| `/inspections` | [ ] | | |
| `/inspections/authorities` | [ ] | | |
| `/inspections/folders` | [ ] | | |
| `/sb_ai` | [ ] | | |
| `/sb_ai/chat` | [ ] | | |
| `/sb_ai/chat/:conversationId` | [ ] | | |
| `/teams/ad_accounts` | [ ] | | |
| `/teams/asp_accounts` | [ ] | | |
| `/teams/domains` | [ ] | | |
| `/teams/plans` | [ ] | | |
| `/teams/product_search_forms` | [ ] | | |
| `/teams/tags` | [ ] | | |
| `/report-exclusions` | [ ] | | |
| `/addon/option-list` | [ ] | | |
| `/admin-report` | [ ] | | |
| `/admin/articles/html_parts` | [ ] | | |
| `/admin/plans` | [ ] | | |
| `/admin/plans/new` | [ ] | | |
| `/admin/preset_access_denials` | [ ] | | |
| `/admin/product_search_forms` | [ ] | | |
| `/admin/teams` | [ ] | | |
| `/admin/teams/new` | [ ] | | |
| `/admin/teams/:team_uid/members` | [ ] | | |
| `/admin/teams/:team_uid/plans/payments` | [ ] | | |

1. `capture/capture-plan.json` を生成する（`npm run capture-plan`）。
2. 計画の `priority: 1` の状態を上から実行する（今回の採取範囲＝空状態＋作成フロー・§1-4）。
   `capture_mode` の順に進めると安全: read-only → write-production（承認後）→ hand-built（採取ではなく実装作業）。
3. 各状態で `dom.html` / `iframe.html`（該当時）/ `computed.json` / `screenshot.png` /
   `network.har` / `fixtures/*.json` を隔離ディレクトリへ保存（§5-1[1]）。
4. 全ページ共通のCSS一式・フォント/アイコン/画像は**1回だけ**まとめて取得。
5. 匿名化 → ゲート → `capture/clean/` へ昇格。

## 未採取（このファイルが空欄の間は P2 以降に進めない）

`capture/clean/` が空である限り、企画書 §13-A/B/C/D/F は判定不能。
`npm run verify` はこれらを **PEND（保留）** として出力する（合格扱いにしない）。
