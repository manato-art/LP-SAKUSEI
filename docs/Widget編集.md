# Widget編集（1つの画面）の決まり

2026-09-23 に「ノーコードで作る」（ライブラリの中の入力画面）と「Widget編集」（全画面）を1つにした（本人の決定 D1〜D3）。
この文書は、その画面の作り・保存の形・触るときの決まりの正本。詳しい理由は各ファイル先頭のコメントに書いてある。

## 画面の作り（widget-studio.ts）

全画面。**左＝見え方（620pxの見たまま画面）／右＝直すところ**。この左右は崩さない（本人指定）。

右は3段:

1. **画面のタブ**（`[data-widget-tabs]`）… 画面①②…（部品で作ったもの）／見本の設問①②…（HTMLのもの）
2. **直すところ** … 部品で作ったWidget＝「部品」の入力欄（template-form.ts）／それ以外＝「要素ごとに編集」のカード（widget-design-panel.ts）
3. **デフォルト時のコードを表示** … HTML/CSS（widget-code-panel.ts）。部品で作ったWidgetは見るだけ＋「部品を解除してコードを直す」

ヘッダー: 閉じる／作成したWidgetに登録／**LPに入れる**（新しく作るとき）または **更新する**（LPの中のWidget）。

## 2つのモード

| | 部品（builder） | HTML（dom） |
|---|---|---|
| 正本 | 設定データ `TemplateData`（widget-studio-builder.ts） | コード欄の textarea（HTML・CSS） |
| 左でできること | 部品を押して選ぶ・文字を打ち直す（設定データへ読み戻す＝canvas-sync.ts） | 書式ツールバー・画像の差し替え/幅・並んだ部品の複製/上下/消す・リンクの吹き出し |
| 右でできること | 画面を足す/名前/複製/消す・部品を足す/並べ替え/消す・部品の入力欄・押したとき・型・見本の中身・Widget全体の設定 | 色/大きさ/余白/動きのカード・コードの直接編集 |
| 書式（太字・色）| 付けられない → 「部品を解除」でHTMLにしてから | 付けられる |
| 保存するHTML | `render(data)` に設定データを埋めたもの（builder-data.ts） | textarea の中身 |

どちらで開くかは、LPの中のWidgetの外側に `data-nc-data`（設定データ）があるかで決まる（`extractBuilderData`）。
2026-09-23 より前に入れた「部品を積んで作る」のWidgetには無いので、HTMLとして開く（壊れはしない）。

## 保存の形（builder-data.ts）

```html
<style>…</style>
<div class="nc nc-builder nc-xxxxxxxx" data-nocode="builder" data-nc-data="{…JSON…}" data-nc-screens="true" …>…</div>
<script>…</script>
```

- `data-nc-data` は `TemplateData` を JSON にして属性にしたもの（`& " < >` はエスケープ）。読むときは戻す
- 画像・動画は data URL のまま JSON に入る。保存のとき本文と同じ規則で別ファイル（`/uploads/<ハッシュ>.<拡張子>`）に置き換わるので、
  開き直したときは `/uploads/…` の形になる。`kit.ts` の `safeImage` / `safeVideo` はこの形も受け付ける
- 見本の部品の中身（html）もそのまま JSON に入る
- 「部品を解除」は `stripBuilderData` で属性を外し、同じ中身をHTMLとして開き直す（元には戻せない）

## 入口（全部この画面）

| 押すもの | 開き方 |
|---|---|
| ライブラリ「+ ノーコードで作る」 | ライブラリを閉じて、既定の中身で部品モード |
| 見本カード「画面を作って使う」 | ライブラリを閉じて、その見本を部品にして部品モード（設問①②③は画面①②③に分ける） |
| LPの中のWidgetをクリック／設置済みWidgetのカード | 設定データがあれば部品モード、無ければHTMLモード |
| 部品モードの「見本」を足す・「見本を選ぶ」 | この画面を隠してライブラリを開き、「追加」を押した見本を受け取って戻る（`openWidgetLibraryForPick`） |

## 触るときの決まり

- 左の見たまま画面の中身（contentDiv）に編集専用の目印を付けてよいのは**部品モードだけ**（保存は設定データからの書き出しなので配信に出ない）。
  HTMLモードでは付けない（`quill.root.innerHTML` の保存で配信に漏れる。KB 2026-09-22-001）
- 選択枠・操作ボタンは contentDiv の**外の層**に置く（selection-layer.ts・item-toolbar.ts）
- 部品モードで左の文字を打ち直したときは、その部品だけ読み戻す（`syncCanvasBlock`）。部品をまたぐ入力・打てない部品への入力は `beforeinput` で止める
- 部品の数え方は「画面をまたいで上から順の通し番号」（`nc-b-12`）。書き出し（builder.ts）と読み戻し（`blockPathAt`）で同じ数え方にする
- テストは純粋ロジックに切り出して vitest で固定する（builder-data・canvas-sync は linkedom）。画面そのものはブラウザで確かめる
- スマホは `mobile-css.ts` の `[data-widget-*]`（左右→上下）と `[data-nc-tab]`（入力欄の大きさ）がそのまま効く

## 予定（第2弾）

Canva 風の直接操作: 選択枠のハンドルで幅・高さ・文字の大きさ・余白をドラッグ／数字は左右ドラッグで増減＋スライダー／部品の並び替えをドラッグ。
