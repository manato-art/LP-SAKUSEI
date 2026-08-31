# 実機観測 log（2026-08-31・Claude in Chrome で採取係AI自身が実施）

企画書 v2.0 の記述と**実物の乖離**を記録する。値（実施策名・実在者名・実ドメイン・実uid）は
企画書 §3-1 に従い一切書かない。記録するのは **構造・マイクロコピー・遷移** のみ。

対象UI: **旧UI**（サイドバー最下部の `新UIを利用する / OFF` トグルがOFFの状態）。新UIは対象外（D-010）。

---

## 【最重要】§16-3 が解決した ―― 2ルートは「同じエディタの別タブ」だった

エディタ画面は**左レールに4タブ**を持つ1つのシェルで、タブごとにURLが変わる。
別入口でも別モードでも旧版でもない。

| 左レールタブ | 遷移先URL |
|---|---|
| 基本情報 | `/folders/:folder_uid/ab_tests/:ab_test_uid/edit` |
| **Version** | `/ab_tests/:ab_test_uid/articles` ←LPエディタ本体 |
| ポップアップ | `/ab_tests/:ab_test_uid/articles/exit_popups` |
| レポート | `/ab_tests/:ab_test_uid/reports` |

→ 実装は**1つのエディタシェル＋4タブ**として作る。企画書 §16-3 はこれで確定。

---

## 【最重要】企画書に無かった機構: 編集ロック（権限の引き継ぎ）

LPのテキストを選択しようとした瞬間、モーダルが出て**編集がブロックされた**。

- タイトル: `⚠ 権限の引き継ぎ`
- 本文ラベル: `最新の編集` / `ユーザー名` / `最終更新`
- 表示値: 最後に編集した人の氏名 + ロール、最終更新の相対表記 + 絶対日時
- ボタン: `閉じる`(secondary) / `引き継ぎして編集する`(primary)
- CSS Modules: `modalHeader` / `modalTitle` / `modalContent` / `modalFooter` / `btn` / `btnBrackBorder` / `btnPrimary`

**これは全編集操作のゲート**。他者が最後に触ったLPは、引き継がないと編集できない。
企画書には一切記述が無い。**再現必須**（これが無いとエディタの挙動が根本的に違う）。

> 採取上の制約: 「引き継ぎして編集する」は**実在の同僚から編集権限を奪う**操作。
> 本番に対して押していない。テキスト選択ツールバー等の編集系UIはこの先にある。

---

## 技術スタックの訂正（企画書 §4-1 への追記）

| 項目 | 企画書 v2.0 | 実測 |
|---|---|---|
| UIライブラリ | Emotion のみ記載 | **MUI (Material-UI)** ＋ Emotion。`MuiButtonBase-root` `MuiIconButton-root` `MuiFormControl-root` 等 |
| エディタ | 「iframeベースWYSIWYG（内部は難読化で観測不能）」 | **Quill**（`ql-container ql-snow` / `ql-editor article-body` / `ql-video`）。Snowテーマ |
| スタイル | Emotionハッシュのみ | **CSS Modules も併用**（`_sideToolbarIcon_1hcbn_20` 形式）。→ コンポーネント名が読める |
| CSS | normalize / index-cb391eb6.css(322KB) / index-05deeb9d.css(51KB) / icons | 実測は `/app.css` `/normalize.css` `/assets/index-cb391eb6.css` ＋ Material Icons(Google) ＋ **Font Awesome 5.15.4 (cdnjs)**。`index-05deeb9d.css` は当該ページに無し |
| JSバンドル | index-<hash>.js | **`/assets/index-7a8692d8.js`**（採取ビルド固定用に記録） |
| その他 | — | **`csslint@1.0.5` を unpkg からロード**（コード編集のCSS検証用と推定） |

**Quill である意味は大きい**: OSSなので、テキスト選択ツールバー・書式・undo/redo を
自前実装せずに忠実再現できる。企画書 §9-1 の「1:1 WYSIWYGは対象外」は**緩和できる可能性が高い**。

独自Quillフォーマット（LP側DOMで確認）: `sb-bg-under-marker`（マーカー） / `sb-fs-free`（フォントサイズ）など
`sb-` 接頭辞のカスタムクラス群。→ 採取して formats として登録すれば再現可能。

---

## uid の形式が2種類ある（企画書のモデルと違う）

| エンティティ | 形式 | 例の形 |
|---|---|---|
| Folder | **UUID v4** | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| AbTest | **18文字の短縮ID**（base62系） | 英数18文字。配信URL `/ab/{この値}` に直接使われる |

→ モックの uid 生成を2系統に分ける必要がある（現状は全部 `KIND_0001` 形式）。

---

## `/folders` は「一覧」ではなく3ペインの作業画面

企画書は単純な一覧を想定していたが、実物は:

- **左ペイン**: フォルダツリー
  - 検索ボックス / 新規フォルダアイコン
  - タブ: `すべて` / `お気に入り` / `履歴` ← **企画書に無い**
  - ソート: `PV ↓`（ドロップダウン）
  - フォルダ行: 📁 + **beyondページ数バッジ** + 名前 + ホバーで `☆お気に入り` `⚙設定` `›展開`
  - 入れ子（親フォルダ → 子フォルダ）。子はバッジ無し
- **中央**: beyondページ一覧（列: ステータス / 配信金額 / PV / Click / CTR / CV / CVR / CTVR … 右端に⚙列設定）
  - 行: タイトル / 準備中バッジ / Version数 / 各種カウント / 媒体 / `CVタグ未設定`
  - ヘッダ: フォルダ名 + `並び替え` + 幅リサイズ
- **右**: 選択時に開く**詳細ドロワー**
- **上部バー**: `フォルダ内検索` / `新規ページを作成` / `集計期間：YYYY/MM/DD 〜 YYYY/MM/DD` / `配信ステータス：終了以外`

URLは `/folders?uid=<folder_uuid>` ―― **パスパラメータではなくクエリパラメータ**。

### 行クリックの挙動（重要・遷移しない）

行をクリックすると:
1. **タイトルがインライン編集の input になる**（その場でリネーム）
2. 右に**詳細ドロワー**が開く
3. 行に**アクションバー**が出る: `分析` `ヒートマップ` `レポート` `バージョン` `⋯` `⚙`
4. 上部に一括操作バー: `フォルダ移動` `ページ複製` `選択解除`
5. ツールチップ: `ドラッグ：複数選択` / `Ctrl+クリック：個別複数選択`

**ページ一覧の行は `<a href>` ではない**（JSハンドラ遷移）。ページ内の実リンクは
ロゴ `/`、ランキング（外部）、公開LPのURL の3つだけ。
→ 企画書 §13-D「ナビグラフ全走行」を href 追跡で実装すると**何も辿れない**。要注意。

---

## エディタ（Versionタブ）の実構造

- **左パネル（Version一覧）**: ヘッダ `Version ⌄` + `配信割合 ?`
  - 各行: 📄アイコン + Version名 + **配信割合の数値入力（スピナー付き）**
  - 選択行のみ: 名前が input になり、💬アイコン + **`更新`ボタン**が出る
  - 最下部: `Version追加`
- **中央プレビュー**: 上部に `ヘッダー画像を追加する` の破線ドロップゾーン、その下にLP
  - **PC枠 iframe = 620×486**（`_quillEditorWrapper_...`）→ 企画書の実測値と一致
  - **SP枠 iframe = 430×640** → 一致
  - もう1つ `_previewIframe_...`（0×0・非表示）
  - iframe は同一オリジン・`src`/`srcdoc` 無しの動的書き込み → 企画書の記述と一致
  - iframe内: HTML 約24万字 / `<style>` 25 / `<link>` 40 → 企画書の実測とほぼ一致
  - 底部中央: 🌐 / 🏠 / `⋯` と `<` `>`（**ファネルのステップ送りと推定**）
- **右レール（縦アイコン列・9個）**: y=100〜500 に50px間隔。クラスは全て `_sideToolbarIcon_...`
  - 判明: `プレビュー`(title属性) / `Widget管理`(title属性) / `sideToolbarArticleHistory`(クラス名から履歴)
  - 残りはtitle無し・SVGのみ → **個別クリックで同定が必要**
- **上部バー**: `‹戻る` / 📁 / [媒体アイコン] ページ名 + `準備中`バッジ / フォルダ名 / 右端に3アイコン

---

## AbTest（beyondページ）の実フィールド ―― 企画書 §10-2 に不足あり

「基本情報」タブの実フォーム:

| 項目 | 型 | 備考（マイクロコピーは verbatim 保持対象） |
|---|---|---|
| beyondページ名 | text | ヘルプ: `50文字まで入力できます` |
| 編集タイプ | select | **disabled**・ヘルプ: `後から変更できません`。値の一例: `beyondエディター` |
| 配信URL | 表示のみ | `※「ab/」以降は変更できません。` / `※フォルダのドメインを変更したい方は[フォルダ基本情報画面]から変更してください。` / `URLコピー` / `パラメータ付きURLの発行`（ツールチップ `パラメータの生成はこちらから行えます！📣`） |
| 配信タイプ | select | 例: `同一URL配信` |
| **トラッキング項目** | 見出し | |
| CV条件 | select・必須 | `CV条件の詳細を確認する` リンク |
| 計測ツール・ASP | text | `計測ツール・ASPと連携してCV連携する` → `/teams/asp_accounts` / `計測ツール・ASP条件の詳細を確認する` |
| 媒体 | select・必須 | |
| **CVポストバック設定** | 見出し | |
| Meta(Facebook) pixel id | text | |
| Meta(Facebook) access token | text | FAQ外部リンクあり |
| **その他の項目** | 見出し | |
| メモ | textarea | |
| 性別 | select | ターゲティング |
| 歳以上 / 歳以下 | select | ターゲティング（年齢レンジ） |
| コンバージョン単価 | number | ヘルプ: `コンバージョン単価を設定することで売上が表示されます` |
| （メディア） | 見出し | |
| 更新する | button | |

→ **`コンバージョン単価` は AbTest ごとの設定**。企画書 §10-5 の `sales = cv × 平均単価` は正しいが、
単価はグローバル定数ではなく**AbTestの属性**。モックを直す必要あり。

### 配信ステータスは5値（企画書は3値）

`準備中` / `未配信` / `配信中` / `停止中` / `終了` ＋ 一覧フィルタの既定 `終了以外`。
企画書 §10-2 の `Version.status: '準備中'|'公開中'|'停止'` とは別軸。
**AbTestの配信ステータス**と**Versionの状態**を分けてモデリングし直す必要がある。

### 詳細ドロワーの項目（一覧右ペイン）

`URL情報`（配信URL / フォルダドメイン）、
`beyondページ情報`（商品ジャンル / 作成日 / 更新 / 編集タイプ / **バージョン数** / **ポップアップ数** / **中間ページ数**）、
`配信情報`（配信ステータス / 配信タイプ / 広告媒体 / コンバージョンポイント / コンバージョン単価 / 計測方法）、
ボタン `パラメータ付きURLの発行`。

→ **中間ページ数** という概念が企画書に無い（ファネル機能と関係すると推定）。

---

## 企画書に無い概念（CSS Modules のコンポーネント名から判明）

`funnelStepWrapper` / `funneStepList` / `btnNewFunnel` / `articleHistoryList` / `articleHistoryInfo` /
`articlePhotos` / `articleHeaderPhoto` / `btnNewArticle` / `btnReplace` / `btnFontColor` / `btnBgColor` /
`editorToolbarArrow` / `iconScriptSuper` / `iconScriptSub` / `alignIcon` …

- **ファネル（funnel）**: 複数ステップのページ遷移。詳細ドロワーの`中間ページ数`、
  プレビュー底部の `<` `>` `🏠` と対応すると推定。**企画書に完全に欠落**
- **記事履歴（articleHistory）**: 右レールの履歴ツール
- `btnFontColor` / `btnBgColor` / `iconScriptSuper` / `iconScriptSub` / `alignIcon`
  → **テキスト選択時のツールバーの中身**（文字色・背景色・上付き・下付き・整列）。編集ロックの先にある

---

## サイドバー（企画書 §6-3 とほぼ一致・追記のみ）

ダッシュボード / AI / タスク(展開時`定期タ…`) / ページ / CV速報 / ツール`›` / 外部連携`›`(赤バッジ) /
ドメイン / 拡張機能 / レポート除外 / イベント・セミナー / ランキング(外部) / `新UIを利用する OFF` / ユーザー(ID表示)

- **ホバーで展開する**（アイコンのみ ⇄ ラベル付き）。global状態として再現対象
- `ツール` と `外部連携` は **`›` を持つ展開可能グループ**（企画書はフラットな対応表だった）

---

## 外部SaaS（企画書 §4-4 の確認・実測で全て確認された）

HubSpot（4本: web-interactives-embed / hs-banner / hs-analytics / feedbackweb-new / hs-scripts）、
Pendo、Channel.io、GTM。**クローンには入れない**方針は変更なし（§4-4）。
画面に見えるのは Channel.io のチャットバブル（右下）と HubSpot のフィードバックUI。

---

## ポップアップタブ ＝ 未契約のアップセル画面（企画書に無い状態）

`/ab_tests/:uid/articles/exit_popups` を開くと、**機能が契約されていない場合の画面**が出る:

- 暗い（ダーク）背景の枠の中央に `離脱防止機能の利用には申し込みが必要です`
- 青ボタン `担当者に問い合わせをする`

**「機能未契約」という状態軸が企画書に無い。** 基準状態が新規アカウントである以上、
新規アカウントでは**多くの機能がこの状態になる**可能性が高い。状態軸に追加が必要:
`feature-not-contracted`（§7-1 の表示軸に追加すべき）。

---

## レポートタブ ＝ ダークテーマ（企画書に無い）

`/ab_tests/:uid/reports` は**アプリ全体と全く違うダークテーマ**。
CSS Modules に `darkTheme` / `lightTheme` / `toggleTheme` があり、**テーマ切替を持つ**。

- サブタブ: `レポート` / `ヒートマップ`
- ヘッダ右: `広告データ取得日時` / ⚙（列選択） / 🔔（通知？）
- 注意バナー: 広告媒体のキャッシュ配信に関する注意文 + `詳しくはこちら`
- **デイリーレポート** のフィルタ: `日付`(粒度) / `開始日` / `終了日` / `Version`(既定`指定なし`) /
  `アーカイブ`(既定`アーカイブ済みを除く`) / `端末`(既定`全端末`)
- Recharts の折れ線（ダーク配色）
- **指標13列**: `配信金額(円)` `PV` `CLICK` `CTR(%)` `CV` `CVR(%)` `CTVR(%)` `CPA(円)`
  `MCPA(円)` `FVER(%)` `SVER(%)` `FSVER(%)` `OAR(%)`
  - **企画書 §10-5 の恒等式は `CTVR` `MCPA` `FVER` `SVER` `FSVER` `OAR` を全く含んでいない**。
    SquadBeyond独自指標。定義は未確認（要調査）
- 行: `合計` + 日付ごと
- **列は選択式**（`columnChoiceWrapper` / `columnChoiceIcon` / `columnChoiceBody` / `choice`）
- **クリエイティブ** セクション: 日付粒度 + 期間 + タブ(`配信金額`/`CV`/`CPA`/`CTR`/`CVR`) +
  `Parameter検索` + 広告ステータス絞り込み(`配信中`/`停止中`/`ALL`) + `平均`/`合計`
  - 追加フィルタ: `広告ステータス`(全ステータス) / `version/sb_article_uid検索` / `parameter検索`
- 注記: `※ 配信金額、クリエイティブ画像/テキストを取得しています` /
  `ポップアップを設定するとレポートが表示されます`

---

## beyondページ作成フロー（企画書 §10-9 の作成フローの実体）

`新規ページを作成` → 単一モーダル `新規ページ作成`（ヘッダ: `キャンセル` / `作成する`（初期disabled））。
**番号付き8セクション**の縦長フォーム。

| # | セクション | 内容 |
|---|---|---|
| 1 | エディターを選択 **[必須]** | ラジオ3択: `スワイプLPエディター（β）`[NEW][無料] / `beyondエディター` / `HTMLエディター`<br>ヒント: `beyondエディター、HTMLエディター、スワイプLPエディター（β）のバリエーションについてはバージョンを追加する際に選択が可能です。` |
| 2 | ページ名 | text（`入力してください`）<br>ヒント: `ページ名は未入力のままでも設定可能です。後から変更可能です。` |
| 3 | 配信URL | 固定プレフィックス `https://<フォルダドメイン>/ab/` + text<br>ヒント: 未入力ならランダム文字列。**`URLは後から変更できません。`** |
| 4 | 広告媒体 **[必須]** | 約65種の媒体リスト + `媒体名で検索` の絞り込み |
| 5 | トラッキング設定 | `CV計測条件`（既定`クリック`）+ リンク`クリック / アクセス の違いはこちら` / `計測ツール` / `計測ツール・ASP` |
| 6 | 商品ジャンル | `商品ジャンルを選択、または新規追加...`（**自由追加できるタグ的UI**） |
| 7 | 配信タイプ | 既定 `同一URL配信` |
| 8 | CV単価 | number・ヒント `コンバージョン単価を設定することで売上が表示されます` |

### 【重要】エディターは3種類（企画書の `editor_version` は実際は3値の `editor_type`）

`スワイプLPエディター（β）` / `beyondエディター` / `HTMLエディター`。
**作成時に選び、後から変更できない**（基本情報タブでも disabled）。
さらに「バリエーションについては**バージョンを追加する際に選択可能**」＝ Version単位でもエディタ種別を選べる。

→ エディタは1種類ではなく**3種類**あり、それぞれ別UIを持つ可能性が高い。
企画書 §9-1 は beyondエディター1種類だけを想定していた。**再現範囲の再確認が必要**。

### 【重要】媒体マスタは約65種（企画書は8種）

```
AdAsia / AdAsia DSP / AdCorsa / Adwords / AkaNe / Amebaインフィード / Bypass / CO3 / Cirqua / Evory / ExAD /
Googleディスプレイ広告 / Googleデマンドジェネレーション広告 / Google検索広告 / Gunosy Ads / Hike / Instagram /
Kurashiru Ads / LINE広告 / Locari / Logicad / Lucra / Meta(旧Facebook) / Meta(旧Facebook)ページ(非広告) /
MS-SymbolLockup / Microsoft広告 / Mintegral / NOIN / Oct-pass / Pangle / Pinterest / Qufooit / RED / RETE /
ReeMo / SEO / SNS / ScaleOut / Simeji / SmartNews / TRILL / Taboola / TikTok / TopBuzzVideo / UNIQUEST / UZOU /
X(旧Twitter) / X(旧Twitter)(非広告) / Yahoo!ディスプレイ広告(新) / Yahoo!ディスプレイ広告(旧) / Yahoo!検索広告 /
YouTube / Zucks / ameba インフィード / docomo Ad Network / fam / ∞log / ly / maio / poets / popIn /
アイモバイル / アウトブレイン / フルアウト / 媒体/ポストバックなし
```

→ 企画書 §10-5「媒体ロスター（固定）: Facebook/Instagram/LINE/TikTok/Google/Yahoo/X/その他」は
実物と大きく違う。カタログなので**全件そのまま再現すべき**（`mock-server/store/catalog.ts` を差し替える）。

---

---

# LPエディタ 実測仕様（採取用ページで全操作を確認）

自分が所有する採取用ページを作ったため**編集ロックは出ず**、全機能を触れた。

## 新規作成直後のエディタ＝空状態

- Version が**1件だけ自動生成**される。名前は **`Ver.` + 4桁の数字**（例 `Ver.3872`）＝ランダム採番
  - → モックの初期Version名 `パターンA` は誤り。実物は `Ver.NNNN`
- **配信割合の初期値は `1`**（100ではない）
  - → モックの初期値 100 は誤り
- プレビューは**完全に空**。上部に `ヘッダー画像を追加する` の破線ドロップゾーンのみ
- 空のプレビュー領域を**クリックするとその場で入力できる**（Quillのeditableに直接フォーカス）

## 右レール 9ツール（上から順・全て確認済み）

| # | ツール | 開くもの |
|---|---|---|
| 1 | プレビュー | （`title="プレビュー"`。別画面プレビュー） |
| 2 | **バージョン復元** | パネル `バージョン復元` + `戻る`。履歴リスト（日時 + `現行版` ラベル）。日時書式は **`2026-8-31 17:43:39`（ゼロ埋めなし）** |
| 3 | **Widgetライブラリ** | 全画面ダークモーダル。後述 |
| 4 | **リンク置換** | ダークポップオーバー。後述 |
| 5 | **記事設定** | ダークモーダル。後述 |
| 6 | **タグ設定** | ダークモーダル。後述 |
| 7 | 元に戻す（undo） | — |
| 8 | やり直す（redo） | — |
| 9 | 画像アップロード | — |

### Widgetライブラリ（企画書の「ブロック追加」の実体）

- ヘッダ: `閉じる` / `Widgetライブラリ` / `Widget検索`(検索ボックス)
- 左カテゴリー（`管理` リンク付き）:
  `最近追加されたウィジェット` / `お気に入り` / `見出し` / `囲み枠` / `吹き出し` / `文字` /
  `画像` / `クチコミ` / `フッター` / `アクション` / `ボタン` …（以下スクロール）
- カード: サムネイル + タイトル + 説明文 + ブックマーク + `プレビュー` + `追加`
- 例の説明文: `記事幅100%推奨のWidgetです。`

→ 企画書 §9-1[4] の「ブロック追加＝採取したテンプレHTMLをライブラリ化」は方向性は合っているが、
**カテゴリ / 検索 / お気に入り / プレビュー / 管理** まである本格的なライブラリ。

### リンク置換

- タブ: `Version内リンク` / `離脱防止ポップアップリンク`
- フィルタ: `全て` / `計測あり` / `計測なし` ＋ `全て選択` / `選択解除`
- select `新しいリンク`
- **空状態文言: `置き換え対象のリンクがありません`**
- input `新規のリンクを入力` + `置換`
- checkbox `計測機能付きリンクに変更`（既定ON・info付き） / `リンクを別タブで開く`（既定OFF・info付き）

### 記事設定

- **基本設定**: `文字サイズ`(既定17px) / `フォント`(既定 `Hiragino Sans, Arial, sans-serif`) /
  `文字色`(#000000) / `行間`(1.8) / `文字間`(px) / `画像上`(0px) / `画像下`(0px) /
  `余白上`(15px) / `余白下`(15px) / `余白右`(20px) / `余白左`(20px)
- **iframe設定** `※指定しない場合はどちらも入力なしで保存`: `高さ` / `単位`(`選択してください`)
- **配信Version幅** `※指定しない場合はどちらも入力なしで保存(指定しない場合は620pxで設定がされます)`
  → **620px がプレビューiframe幅と一致**（企画書の実測620×486の根拠）
- **Version枠線**: `太さ`(px) / `タイプ` / `色`(#)
- ヘッダに `保存`

### タグ設定

- `一括タグ設定`: `HEAD` / `body` ボタン + 注記 `一括タグ設定のタグは一括タグ設定で管理できます`
- `メタタグ設定`: トグル `noindexを含める`（既定ON）+ 注記
  `一括タグ設定のメタタグ設定で「noindexを含める」としていた場合、noindexは含まれます。`
- `個別設定`: `JavaScript head` / `JavaScript body` の行番号付きコードエディタ
  （プレースホルダ `<script> ... </script>`・ダーク配色）

### ヘッダー画像設定（画像ライブラリ）

- ヘッダ: `閉じる` / `ヘッダー画像設定` / `アップロードする`
- **スコープタブ4段階**: `全て` / `フォルダ内` / `beyondページ内` / `Version内`
- 既存画像のグリッド（横長サムネイル）

→ 企画書 §9-7 は「単発input型かライブラリ型か採取時に判定」としていた。**ライブラリ型**で確定。
しかも**スコープ4段階**を持つ。

---

## 【本命】テキスト選択時のツールバー

テキストを選択すると、**選択範囲の上に吹き出し型（下向き矢印付き）のダークなツールバー**が出る。
Quill の bubble テーマ相当だが、**親ドキュメント側**に描画される
（クラス `_editorToolbarWrapper_...` + 表示中は `_active_...`）。サイズは折りたたみ時 302×45。

### 折りたたみ時（既定・11コントロール）

| 順 | コントロール | クラス |
|---|---|---|
| 1 | **B** 太字 | `_toolbarActionWrapper_`（アイコンは `<img>`） |
| 2 | **U** 下線 | 同上 |
| 3 | **I** 斜体 | 同上 |
| 4 | **S** 打ち消し線 | 同上 |
| 5 | **x²** 上付き | `_iconScriptSuper_` |
| 6 | **x₂** 下付き | `_iconScriptSub_` |
| 7 | **リンク** | `EditorToolbarLink...` |
| 8 | **文字色**（●） | `_btnFontColor_` |
| 9 | **背景色**（▢） | `_btnBgColor_` |
| 10 | **整列**（≡） | `_dropdown_ _darkTheme_` |
| 11 | **⋮ 展開** | `_iconOptions_` |

### 展開時（⋮を押すと16コントロールに拡張）

上記10個 ＋

| 順 | コントロール | 選択肢 |
|---|---|---|
| 11 | **書式** | `Normal` / `見出し1` / `見出し2` / `見出し3`（各項目は実際の見出しサイズでプレビュー表示） |
| 12 | **フォントサイズ** | `10px` `13px` `15px` `17px` `19px` `21px` `23px` `25px` `27px` `29px` ＋ **`自由設定`**（`px` `%` `em` `rem` を選んで `適用する`） |
| 13 | **フォント** | `serif` / `sans-serif` / `cursive` / `fantasy` / `monospace` / `ヒラギノ角ゴ Pro W3` |
| 14 | **⚙ 設定** | — |
| 15 | **書式クリア**（T̶ₓ） | — |
| 16 | **« 折りたたむ** | `_iconShrinkToolbar_` |

### 動画選択時（DOM上に存在・動画を選ぶと出る）

`_iconVideoSetting_` のドロップダウン: `音声出力` / `ループ再生` / `自動再生`

### 再現方針への影響

Quill の bubble ツールバーに、**独自フォーマット**（`sb-bg-under-marker` 等の `sb-` 接頭辞クラス、
自由設定フォントサイズ、日本語フォント）を足した構成。
**OSSのQuillに独自formatを登録すれば、企画書が「対象外」としていた1操作1操作の再現が現実的に射程に入る。**

---

## 行アクション（一覧で行を選択すると出る）

`分析` / `ヒートマップ` / `レポート` / `バージョン` / `⋯` / `⚙`

- **`⋯` メニュー**: `お気に入りに追加` / `フォルダ移動` / `別フォルダへ複製` /
  `beyondページ複製` / `ステータスを終了にする`
- **`⚙`**: **行アクションバー自体のカスタマイズ**。各ショートカットに
  ドラッグハンドル(≡) + 表示トグル + `ボタン色` 編集、さらに `ボタンの位置`（`左寄せ` / `右寄せ`）
  → ユーザーごとに行アクションバーを組み替えられる。企画書に無い

### 【重要】beyondページに「削除」が存在しない

上記いずれのメニューにも、基本情報タブ最下部（`更新する` のみ）にも削除は無い。
**退避手段は `ステータスを終了にする` だけ**（一覧の既定フィルタ `終了以外` から外れて見えなくなる）。

→ 企画書 §7-4 の必須状態に含まれる「削除の確認ダイアログ」は、
**beyondページには存在しない**。フォルダ等の他エンティティで別途確認が必要。
モックの `DELETE /ab_tests/:uid` も実物には対応するUIが無い。

---

---

# エディタ2種類の実測（editor_version の対応が確定）

## editor_version の対応と実際の利用状況

全176フォルダ・**1016ページ**を API（GETのみ）で走査した結果:

| editor_version | エディタ | 実際の件数 |
|---|---|---|
| 1 | （該当なし） | **0件** |
| **2** | **beyondエディター** | **1013件（99.7%）** |
| **3** | **HTMLエディター** | **3件（0.3%）** |
| — | スワイプLPエディター（β） | 0件（作成モーダルには出るが未使用） |

- `editor_version 2 = beyondエディター` は、**自分で作った採取用ページ**で確定（作成時にbeyondエディターを選択→ev=2）
- `editor_version 3 = HTMLエディター` は、**終了ステータスのページ**の基本情報で `編集タイプ: HTMLエディター` を確認

### ad_status の実際の値（企画書の推測値と違う）

| 値 | 表示 | 件数 |
|---|---|---|
| `prepared` | 準備中 | 914 |
| `delivered` | 配信中 | **52** ←触ってはいけない |
| `finished` | 終了 | 48 |
| `stopping` | 停止中 | 2 |
| （なし） | 未配信 | 0 |

## HTMLエディターの画面（beyondエディターとは全くの別物）

**同じルート `/ab_tests/:uid/articles` だが、レンダされる画面が完全に違う。**
→ 企画書 §6-2 の「ルート≠画面」がここでも効く。1ルートに**2つの実画面**がある。

### 構成: 4ペインのコードエディタ（全面ダークテーマ）

| ペイン | 内容 |
|---|---|
| **HTML** | 行番号 + シンタックスハイライト。ヘッダに画像/ファイル/プレビューの3アイコン |
| **CSS** | プレースホルダ `.class { color: #000000; ...}` |
| **Javascript Head** | プレースホルダ `<script>...</script>, <meta/>. <link/> ...` + コピーアイコン |
| **Javascript Body** | プレースホルダ `<script>...</script>` + コピーアイコン |

- ペイン間に**リサイズハンドル**（`cssEditorResizer` / `jsEditorResizer`）
- コードエディタは **CodeMirror**（`.CodeMirror` 要素120個・行番号44個を確認）
- 右レールは **8個**（beyondエディターは9個）
- 左Versionパネルに**LPのサムネイルプレビュー**が出る（`_articleListPreview_` iframe 195×150）。beyondエディターには無い
- SPプレビュー iframe 430×640 は共通で存在

### CSS Modules から読めるコンポーネント（HTMLエディター固有）

`htmlEditorWrapper` / `htmlEditor` / `cssEditorWrapper` / `cssEditor` /
`jsHeadEditorWrapper` / `jsHeadEditor` / `jsBodyEditorWrapper` / `jsBodyEditor` /
`cssEditorResizer` / `jsEditorResizer` / **`lpDiffEditor`** / **`qrCodePreviewLink`**

- **`lpDiffEditor`** … 差分エディタ。Version間の比較機能があると推定（企画書に無い）
- **`qrCodePreviewLink`** … QRコードでのスマホ実機プレビュー（企画書に無い）

### 配信LPのHTML先頭に埋まっているトラッキング用div（構造のみ）

`js-t-id` / `js-m-id` / `js-v-id` / `js-a-id` / `js-ab-id` / `js-f-id` /
`js-asp-session` / `js-folder-form-host` / **`js-has-funnel`**

→ **`js-has-funnel`** がファネル機能のフラグ。LP側に配信時に埋め込まれる。
→ クローンでLPを再現する際、これらの `js-*` div の**構造は再現し、値は架空**にする必要がある。

また `.article-body { font-size: 15px !important; font-family: Hiragino Sans, Arial, sans-serif !important; }`
がLP側に注入されている（記事設定の値がここに出る）。

## 再現方針への影響

- **beyondエディター（Quill・9ツール・選択ツールバー16個）** と
  **HTMLエディター（CodeMirror・4ペイン・8ツール）** は**別画面として2つ作る必要がある**
- ただし HTMLエディターは実運用で3件（0.3%）しか使われていない
- 共通部分: 左レール4タブ / 上部バー / Versionパネル / SPプレビュー / 右レールの一部

---

---

# 【最重要】データモデルの根本的な誤り ―― UIの「Version」は API の Article

`GET /api/v1/ab_tests/:uid/articles` の実レスポンスで判明（2026-08-31）。

## 企画書 §2・§10-2 の誤り

企画書は `AbTest 1-* Article 1-* Version` の3階層としていたが、**実際は2階層**:

```
AbTest 1-* Article （＝UI上の「Version」）
```

- **UIのVersionパネルに並ぶ「Ver.3872」は Article の `memo` フィールド**
- **配信割合は `ab_test_article.rate`**（中間テーブル `ab_test_article` に `article_id / position / prioritized / rate`）
- `Version` というエンティティは API に存在しない

→ モックの `Version` エンティティは**まるごと Article に統合すべき**。

## Article の実フィールド（企画書に無いものが大量）

| フィールド | 内容 |
|---|---|
| `memo` | **UI上のVersion名**（例 `Ver.3872`） |
| `ab_test_article` | `{article_id, position, prioritized, rate}` ← **rate=配信割合 / position=並び順** |
| `editor_type` (number) | **Article単位のエディタ種別**（「バージョン追加時にエディタを選択可能」の実体） |
| `master_style_sheet` | **「記事設定」モーダルの全項目**: `font_size` `font_family` `color` `line_height` `letter_spacing` `padding_{top,bottom,left,right}` `img_margin_{top,bottom}` `border_{size,type,color}` `delivery_version_width(_unit)` `iframe_height(_unit)` `inner_background_{color,image}` `outer_background_{color,image}` |
| `html_tags[]` | **「タグ設定」モーダル**: `{tag, document_property, body}` |
| `exit_popup_setting` | `{exit_popup_attached, fixed_popup_attached}` |
| `funnel_step` / `funnel_steps[]` | **ファネル**（企画書に完全欠落） |
| `header_photo` | ヘッダー画像 |
| `asset_files[]` | 添付アセット |
| `delivery_url` / `devise_preview_url` / `draft_url` | **URLが3種類**（配信/プレビュー/下書き） |
| `inspection_requests[]` / `is_requesting_inspection` / `is_under_inspection` | 審査 |
| `archived` / `style_applied` / `reflected_at` / `body_updated_at` | 状態 |
| `writer` | 作成者（role/権限フラグ/参加状態を含むリッチなMember） |
| `team` | `{id, uid, name, created_at}` |

## AbTest の追加フィールド（記事APIのネスト側でのみ見えるもの）

`published`(boolean・**一覧APIには無いがここにはある**) / `conversion_condition`(フラット) /
`gender_id` / `over_age` / `under_age` / `original_ab_test_id`（複製元） /
`creation_timestamp`(string・`created_at`(number)とは別) / `redirect_pages[]` /
`folder{domain, is_import_folder, is_importing, ...}`（**フォルダはドメインを持つ**）

## media の形はエンドポイントによって違う（重要な罠）

| エンドポイント | media の形 |
|---|---|
| `GET /api/v2/folders/:uuid/ab_tests` | **フラット** `{id,name,icon_name,ad_cooperation}` |
| `GET /api/v1/ab_tests/:uid/articles` | **ネスト** `{attributes:{...}}` |

→ 「どちらかが正しい」のではなく**両方存在する**。モックもエンドポイントごとに出し分ける必要がある。

---

---

# エディタの実DOM（人間が貼ってくれた分・2026-08-31）

## 右レール9ツールの正体（tooltip / aria-label から確定）

| # | ツール名（実物の表示） | 目印 |
|---|---|---|
| 1 | **プレビュー** | `aria-label="プレビュー"` |
| 2 | **変更・復元履歴** | `sideToolbarArticleHistory` → パネル `バージョン復元` + `戻る` |
| 3 | **Widget管理** | `data-trackid="editor-side-tools-widget-management-button"` |
| 4 | **リンク置換** | `link_replace` アイコン |
| 5 | **Version設定** | `data-test="MasterStyleSheetModal-BtnOpenModal"` |
| 6 | **タグ設定** | `data-test="HtmlSettingModal-BtnOpenModal"` |
| 7 | **元に戻す** | `data-test="SideToolbar-Undo"` |
| 8 | **やり直す** | `data-test="SideToolbar-Redo"` |
| 9 | **外部サーバー画像アップロード** | `_externarImageUploadIcon_` |

→ 私が「記事設定」と呼んでいたものは、実物では **`Version設定`**（`MasterStyleSheet`）。

### Widget管理のメニュー（3番を押すと出る）

`HTML編集` / `クイック編集` / `すぐ下に複製` / `widgetコピー` / `Versionから削除する`

## Version一覧の行構造

```
<div data-id="<記事のid>" data-article-uid="<記事のuid>">
  <div data-test="ArticleList-CurrentArticle" class="_abTestArticle_ _active_">
    <img src="/assets/version-orange-*.svg">            ← 選択中はオレンジ、非選択は青
    <input data-test="ArticleList-InputMemo" name="memo" value="Ver.NNNN">
    <input data-test="ArticleList-DeriveryRateForm" type="number" min="0">
    <div data-test="ArticleList-DeriveryUpRateForm">   ← 上スピナー
    <div data-test="ArticleList-DeriveryDownRateForm"> ← 下スピナー
    <button>（オレンジの3点アイコン）</button>
    <button class="MuiLoadingButton-root">更新</button>
  </div>
</div>
```

- **行が `data-article-uid` を持つ** → Version切替の実装はこれを使うのが正しい
- `Version追加` は `data-test="Article-BtnCreateNewArticle"`（`version-blue-*.svg` + テキスト）

## Version一覧のヘッダ

- `Version` のドロップダウン → 選択肢は **`Version` / `アーカイブ`**（`_articleListTypeChoice_`）
- `配信割合` の横に **`?` ヘルプアイコン**（`data-testid="help-icon-wrapper"`）

## ファネル（中央下部）の実体

- `Versionリンク` + `コピーする` + readonly input
  → URLは **`<配信URL>?step_uid=<記事uid>`**（ファネルのステップは記事単位）
- `_btnNewFunnel_`（新しいステップ追加）
- `_funneStepList_`（`_parent_` / `_active_` の状態を持つ）
- `＜` `＞` = `_changePrevFunnelStep_` / `_changeNextFunnelStep_`

## 画像アップロードのドロップダウン

`新しい画像をアップロード` / `閉じる` / `Versionにアップロードする画像を選択` / `一覧から選択`
タブ4つ: `全て` / `フォルダ内` / `beyondページ内` / `Version内`
空状態の文言: **`画像がありません`**

## テキスト選択ツールバーの実体

アイコンは **`<img>`**（インラインSVGではない）。各ボタンの目印:

| 表示 | data-test | 画像 |
|---|---|---|
| 太字 | `EditorToolbar-BtnBold` | `bold-black-*.svg` |
| 下線 | `EditorToolbar-BtnItalic` | `underline-white-*.svg` |
| 斜体 | `EditorToolbar-BtnUnderline` | `italic-white-*.svg` |
| 打ち消し | `EditorToolbar-BtnStrike` | `strikethrough-black-*.svg` |
| 上付き/下付き | （divのみ） | `_iconScriptSuper_` / `_iconScriptSub_` |
| リンク | `LinkDropdown-BtnOpenDropdown` | `link_white-*.svg` |
| 画像 | `EditorToolbar-BtnArticlePhoto` | `image-white-*.svg` |
| 文字色 / 背景色 | `ColorPicker-BtnColor` / `ColorPicker-BtnBackGround` | （aria-label あり） |
| 整列 | `EditorToolbar-BtnAlign` | ドロップダウンで left/center/right/justify |
| ⋮ 展開 | `EditorToolbar-BtnMoreToolbarOption` | `_iconOptions_` |

> **実物の入れ違い**: `BtnItalic` に下線アイコン、`BtnUnderline` に斜体アイコンが割り当たっている。
> 本物がそうなっているので、忠実再現としては**そのまま真似る**（企画書 §3-5「勝手に改善しない」）。

## リンク置換の説明文（マイクロコピー・verbatim保持対象）

- `ページ内CTRやCVRの計測をするために、Click・CVを計測するURLリンクを挿入する際は必ず「計測機能付きリンク」をチェックした状態で追加してください。同ページ内の遷移や運営者情報など、Click・CVとして計測しないURLリンクは「計測機能付きリンク」のチェックを外してから追加してください。`
- `別タブで開く必要がない場合、別タブで開かないことを推奨します。同じタブで開いた方がCV計測精度を高くできます。`
- 置換先の選択肢: `新しいリンク` / `中間ページリンク`

---

---

# プレビュー画面（右レール1番目を押した先）

実DOMの提供により判明（2026-08-31）。**単なるモーダルではなく、専用の1画面**だった。

## 構成

```
上部ナビ（_navArticleWrapper_）
  ├ 戻る            → /folders?uid=<フォルダuid>&folder_scope=
  ├ フォルダアイコン → ドロップダウン（後述）
  ├ 現在のbeyondページ（媒体アイコン + ページ名 + ステータスチップ + フォルダ名）
  └ リンク3つ
下部 URLカード2枚
中央 <iframe id="previewIframe">   ← 実際のプレビュー
```

## フォルダアイコンのドロップダウン（beyondページ切替）

- **MUIタブ6種**: `終了以外`(既定・選択中) / `準備中` / `未配信` / `配信中` / `停止中` / `終了`
  → 一覧画面の「配信ステータス」フィルタと同じ6値。**`未配信` もタブとして存在する**
- 検索ボックス: placeholder **`beyondページ検索`**
- 下にページのリスト（MuiList）

## ナビの3リンク（遷移先が確定）

| アイコンのツールチップ | 遷移先 |
|---|---|
| **Version編集** | `/ab_tests/:ab_test_uid/articles#<記事uid>` ← **ハッシュで記事を指定** |
| **Version<br>オプション設定** | `/ab_tests/:ab_test_uid/articles/split_test_settings/devices` |
| **中間ページ** | `/folders/:folder_uid/ab_tests/:ab_test_uid/redirect_pages` |

→ 企画書のルート表と整合。**「中間ページ」＝ `redirect_pages`** であることが確定した
（ファネルとは別物。企画書§10-2 の RedirectPage がこれ）。

## URLカード2枚（それぞれ コピー / QRコード / 別タブで開く の3ボタン）

| カード | 注意文（マイクロコピー・verbatim保持） |
|---|---|
| **作成中の確認用URL** | `配信には利用できないURLです。ご注意ください。` |
| **配信URL** | `正確なレポート計測のため、[レポート除外設定](/report-exclusions)を必ず行ってください。` |

- **作成中の確認用URLは別ドメイン**（`sb-draft-preview.<製品ドメイン>`）で、
  `/articles/<記事uid>/draft?token=<トークン>` の形。**トークン付き＝実質的な鍵**なので、
  採取物からは必ず除去する（現在のスクラブは長いトークンを置換するので通過する）
- QRコードボタンは `radix-*` の dialog を開く（`qrCodePreviewLink` の実体）
- ステータスチップに `data-trackid="beyond-page-ad-status-chip-preparation"`
  → **ステータスごとに trackid が変わる**（`-preparation` の部分）

---

---

# 対象1画面の全操作フロー採取（2026-08-31・複製用のVersionタブ）

`docs/触ってよい範囲.md` の1画面に限定して、到達できる状態を採取した。

## 採取できた19状態

| 状態 | 内容 |
|---|---|
| `editor-target` | 画面そのもの（DOM + CSSOM + **レイアウト実測** + iframe） |
| `tool-history` | 変更・復元履歴 |
| `tool-widget` | Widget管理 |
| `tool-link-replace` | リンク置換 |
| `tool-version-settings` | Version設定（＝MasterStyleSheet） |
| `tool-tag-settings` | タグ設定 |
| `tool-external-image` | 外部サーバー画像アップロード |
| `toolbar-expanded` | ツールバーを⋮で展開 |
| `toolbar-align-open` | 整列ドロップダウン |
| `toolbar-color-open` | 文字色パレット（DOMが 148KB→166KB に増える＝パレットは動的生成） |
| `toolbar-bg-open` | 背景色パレット（166KB→183KB） |
| `global/app-error` | **アプリのエラー画面** |

## 【重要】エディタは「開くだけで自動保存」が走る

対象ページを開いただけで `updated_at` / `body_updated_at` が更新された（19:27→19:41）。
DOM に `_saveAnimation_` があり、自動保存の仕組みを持つ。
→ **クローンでも「開いた時点で保存済み扱い」にするのが忠実**。
→ 採取時の副作用として避けられない。本文・アセット・Version名・配信割合に変化は無かった。

## 【重要】アプリのエラー画面（`global/app-error`）

**テキストを選択していない状態でリンクツール（`LinkDropdown-BtnOpenDropdown`）を押すと、
アプリ全体がクラッシュしてエラー画面になる。**

- 文言（verbatim）: `何らかのエラーが発生しました。🙇` / `しばらく時間をおいてからもう一度アクセスして下さい。`
- リロードで復帰する。データは壊れない（本文・アセット・Version名・配信割合すべて無事だった）
- **これは実物の挙動なので、クローンでも同じ条件で同じエラー画面を出すのが忠実再現**
  （企画書 §3-5 勝手に直さない）

## レイアウト実測（`editor-target/layout.json`）

| 要素 | サイズ | 備考 |
|---|---|---|
| `editorWrapper` | 1085×626 | `display:flex` / `max-width:1100px` / `padding:20px` |
| Versionパネル | 230×626 | |
| コンテンツ枠 | 620×500 | |
| `quillIframe` | 620×486 | |
| 右レール | 50×506 | `display:flex` / `padding:20px 0` |
| 上部ナビ | 1085×80 | |

（ビューポート 1210×746 のときの値）

---

## 未確認のまま残ったもの（正直な記録）

| 項目 | 理由 |
|---|---|
| 他者が最終編集したLPの編集 | `引き継ぎして編集する` は実在の同僚から編集権を奪うため押していない |
| 公開（publish）後の画面・状態遷移 | 実LPが外部公開されうるため押していない。確認ダイアログ手前まで |
| ファネル（`<` `>` `🏠`）の中身 | 未操作 |
| 右レール「プレビュー」「画像アップロード」の実挙動 | パネル同定のみ |
| ~~HTMLエディター~~ | **確認済**（4ペインのCodeMirror。上記参照）。ただし**編集操作は未実施**（他者ロックのため閲覧のみ） |
| スワイプLPエディター（β） | 未確認。実データが0件のため、確認するには新規作成が必要 |
| `lpDiffEditor`（差分エディタ） | 存在は確認、中身は未確認 |
| `qrCodePreviewLink`（QRプレビュー） | 存在は確認、中身は未確認 |
| ヒートマップタブ | レポートタブのサブタブとして存在確認のみ |
| 分析ボタンの遷移先 | 未確認 |
| ダッシュボード以外の Tier3/4 ルート | 未確認 |
