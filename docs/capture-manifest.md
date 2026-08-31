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

## 採取手順

1. `capture/capture-plan.json` を生成する（`npm run capture-plan`）。
2. 計画の `priority: 1` の状態を上から実行する（今回の採取範囲＝空状態＋作成フロー・§1-4）。
3. 各状態で `dom.html` / `iframe.html`（該当時）/ `computed.json` / `screenshot.png` /
   `network.har` / `fixtures/*.json` を隔離ディレクトリへ保存（§5-1[1]）。
4. 全ページ共通のCSS一式・フォント/アイコン/画像は**1回だけ**まとめて取得。
5. 匿名化 → ゲート → `capture/clean/` へ昇格。

## 未採取（このファイルが空欄の間は P2 以降に進めない）

`capture/clean/` が空である限り、企画書 §13-A/B/C/D/F は判定不能。
`npm run verify` はこれらを **PEND（保留）** として出力する（合格扱いにしない）。
