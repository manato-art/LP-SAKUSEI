# 採取マニフェスト（capture manifest）

企画書 §11「採取ビルドの固定（必須）」・§13-H の要求物。
**capture-and-rehydrate は単一ビルドに依存する**ため、採取物のビルドが混ざると
CSSハッシュとDOM構造がずれ、視覚検証が意味を失う。

## 採取済み（第1回: 2026-08-31）

| 項目 | 値 |
|---|---|
| 採取日 | **2026-08-31** |
| 対象UI | **旧UI**（`新UIを利用する` トグル OFF・D-010） |
| メインJSバンドル | **`/assets/index-7a8692d8.js`**（約5.8MB・クローンでは使わない） |
| 採取アカウント種別 | **既存アカウント**（新規発行は不可・D-009） |
| 採取方法 | Claude in Chrome（DOM観測）＋ curl（静的アセット・認証不要） |

### CSS（土台。verbatimで使用）

| ファイル | サイズ | sha256(先頭16) |
|---|---|---|
| `index-cb391eb6.css` | 323,201 bytes | `59b7f2d987181742` |
| `index-05deeb9d.css` | 49,178 bytes | `fc9b38c227fca128` |
| `app.css` | 344 bytes | `6aecdb49b713eaee` |
| `normalize.css` | 7,823 bytes | `aac4be49ef844de2` |

外部由来（自己ホスト化のため取得）: `material-icons.css` / `fontawesome-5.15.4.css`

### アセット

同一オリジンの参照アセット **68ファイル**（SVGアイコン61 / 独自アイコンフォント beyond(woff,ttf,svg) /
ロゴPNG / Material Icons ttf / Font Awesome woff2 ×3）。

**取得できなかったもの**: `beyond-457b90c5.eot`（IE専用形式。サーバーが200でSPAのHTMLを返すため実体なし。
現代ブラウザでは不要なので除外）

### 採取時の落とし穴（次回のために記録）

- **SPAは存在しないパスにも 200 で index.html を返す。** HTTPステータスだけでは成否を判定できない。
  → バイナリ想定の拡張子なのに中身がHTMLでないかを検査すること（`npm run gate` に組み込み済み）
- CSSには**本番CDN（CloudFront）・外部フォント・計測タグ**の参照が埋まっている。
  製品ドメインだけを置換しても消えない → `EXTRA_PRODUCTION_HOST_PATTERNS` で中和する
- SVG内の `http://www.w3.org` 名前空間宣言は**置換してはいけない**（消すとSVGが壊れる）

## まだ採取していないもの

各ルートのレンダ済みDOM / スクリーンショット / APIレスポンスのfixture / LPプレビューのiframe文書。

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
