# 状態軸の正本（state taxonomy）

企画書 §7-1 の正本。各ルートの状態は下記軸の値の組み合わせで表す。該当しない軸は書かない。
状態ID命名: `<route-slug>__<軸>-<値>`（例 `dashboard__empty` / `ab_tests-articles-editor__preview-sp`）。
ルート横断（全ルートに出うる）状態は `global__` 接頭辞で `_global.md` に置き、各ルートからは参照のみ。

## 軸一覧
| 軸 | 値 |
|---|---|
| 表示 | normal / empty / loading / error / partial-error |
| オーバーレイ | modal / drawer / confirm-dialog / dropdown / context-menu / tooltip / popover / toast(success\|error\|info) / notification-center |
| ウィザード | step1..stepN / step-validation-error |
| 入力 | form-empty / form-typing / form-invalid / submitting / submit-success / submit-error |
| 一覧端 | page-first / page-last / page-single / sort-asc / sort-desc / filter-empty |
| 権限 | admin / team-owner / member / viewer / access-denied |
| レスポンシブ | pc / tablet / sp（エディタLPプレビューは preview-pc(約620×486) / preview-sp(約430×640)） |
| リアルタイム | cv-toast / cable-connecting / cable-disconnected / cable-reconnecting |
| 選択 | tab-<name> / row-selected / bulk-selected / accordion-open\|closed |
| 非視覚 | 主要トランジション演出 / スピナー最小表示 / フォーカス順・タブ移動・キーボード操作（主要遷移とキーボード到達性のみ対象） |
| 出力面（画面外） | csv-export / pdf-print / mail-template（存在するもののみ・要否を台帳で判断） |

## 基準状態＝新規アカウント（空）（企画書 §1-4）

再現の基準は **新規アカウント発行直後の「まっさら」な空状態**。よって各ルートで最優先の状態は
**empty（0件）＋ creation flow（作成→反映）**。`normal`（データあり）・`page-last`・`sort-*`・
`filter-empty` は populated 前提なので、後日の実データ取込フェーズへ回す（capture-plan の priority=3）。

**pc / sp は「状態」ではなくビューポート**（§13-A の 1440×900 / 430×932）。各状態をこの2幅で撮る。
状態として数えると母集合が二重計上されるため、`capture-plan.json` では route 属性として持つ。

## 必須状態（§7-4：ルート完了の判定母集合）
normal / empty / loading / error / 存在する全モーダル・確認ダイアログ / 一覧系は page-last・filter-empty / 権限ゲートがあれば access-denied / pc・sp。
（任意状態＝レアなtooltip等は努力目標）

## 観測不能状態（§5-7）
単一ログイン済みアカウントから撮れない状態（他ロールビュー・権限差分・実データ有/無の反転等）は、
第2アカウント/ロール切替で採取、不能なら CSS＋データモデルから手構築し、備考に「手構築/推測」と明記。
