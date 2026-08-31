# SquadBeyond 完全再現クローン（社内限定・非公開）

企画書 `企画書.md`（v2.0）が唯一の仕様書。本READMEは動かし方だけを書く。

> **非公開・非再配布。** 子会社プロダクトの複製物。GitHubに上げる場合も必ず private（企画書 §1-3・§12）。

## 【最重要】本番アプリで触ってよい範囲

**`ページ → 金谷 → ナイトエンペラー → 複製用 → バージョン` の1画面だけ。**
それ以外のフォルダ・ページは開かない。配信中のページには触れない。公開ボタンは押さない。
APIは GET のみ。詳細は `docs/触ってよい範囲.md`。

## 絶対ルール（企画書 §3 Step0）

1. 実データを持ち込まない（すべて架空の合成データ）
2. 本番APIに接続しない（APIは `http://localhost:4010` 固定）
3. 生キャプチャは `~/squadbeyond-capture-quarantine/` に隔離しコミットしない
4. `.env` / 認証情報 / `scrub-map.json` はコミットしない

## 起動

```bash
npm install
npm run mock    # モックAPI（http://localhost:4010）
npm run dev     # 画面（http://localhost:5173）
```

モックの既定シードは**新規アカウント発行直後の空状態**（企画書 §1-4・§10-5）。
`POST /__mock/reset` または任意のエンドポイントに `?reset=1` で空へ戻せる。

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 画面（Vite） |
| `npm run mock` | モックAPI + ActionCable モック |
| `npm run verify` | 受け入れ条件の機械判定（企画書 §13）。保留ゲートも明示 |
| `npm run typecheck` / `lint` / `test` | 品質ゲート（§13-H） |
| `npm run gate` | 実データ・本番ドメイン・外部SaaS の静的スキャン（§13-E/F/G） |
| `npm run capture-plan` | `capture/capture-plan.json` を生成（§5-4） |
| `npm run traceability` | `docs/traceability.md` を生成（§8） |

## 現在地

- **完了**: P0 雛形 / モックサーバー（空シード＋書き込み永続・§10-9）/ 匿名化パイプライン＋grepゲート /
  capture-plan / トレーサビリティ台帳の骨格
- **未着手**: 採取フェーズ（`capture/clean/` が空）。土台となる実DOM/実CSSが無いため P2 以降に進めない
- `npm run verify` は、判定できるゲートを実走し、採取待ちのゲートを **PEND** として出す

## 採取フェーズの始め方

```bash
npm run capture-plan                       # 採取計画（priority=1 が今回の範囲）
# → 採取係が capture/capture-plan.json を実行し、隔離ディレクトリへ保存
npx tsx tools/scrub/index.ts --in ~/squadbeyond-capture-quarantine --out capture/clean \
  --names ~/known-names.txt --host-pattern '(?:https?://)?[a-z0-9-]+\.本番ホスト'
npm run gate -- --names ~/known-names.txt  # 1件でもヒットしたら止める
```

詳細は `docs/capture-manifest.md` と `docs/scrub-policy.md`。

## ドキュメント

| ファイル | 内容 |
|---|---|
| `企画書.md` | 唯一の仕様書（v2.0） |
| `docs/routes.json` | 機械可読のルート台帳（ルート数の正本） |
| `docs/routes.md` | ルート進捗の索引 |
| `docs/traceability.md` | **進捗の正準台帳**（1状態=1行・生成物） |
| `docs/states/_taxonomy.md` | 状態軸の正本 |
| `docs/scrub-policy.md` | 匿名化の保持/置換の境界 |
| `docs/capture-manifest.md` | 採取ビルドの固定 |
| `docs/decisions.md` | 実装で決めた点と、その反転方法 |
