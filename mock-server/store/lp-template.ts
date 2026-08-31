/**
 * 新規Versionの初期LP（合成・企画書 §3-1）。
 * 実LPは採取→匿名化後に capture/clean/ から差し替える（§9-1[3]）。
 * ここにあるのは「採取前でも作成フローが最後まで通る」ための架空の初期値。
 */

export const DEFAULT_LP_HTML = `<!-- 合成データ。実LPではありません。 -->
<div class="lp-root">
  <header class="lp-hero">
    <h1>サンプル見出しをここに入力</h1>
    <p>サンプルのリード文です。テキストブロックから編集できます。</p>
  </header>
  <section class="lp-body">
    <h2>特長</h2>
    <ul>
      <li>サンプル特長1</li>
      <li>サンプル特長2</li>
      <li>サンプル特長3</li>
    </ul>
  </section>
  <section class="lp-cta">
    <a class="lp-cta__button" href="#">サンプルCTA</a>
  </section>
</div>`

export const DEFAULT_LP_CSS = `.lp-root{font-family:"Hiragino Sans",sans-serif;color:#151515;margin:0}
.lp-hero{background:#0091FF;color:#fff;padding:32px 20px;text-align:center}
.lp-hero h1{font-size:22px;margin:0 0 8px}
.lp-hero p{font-size:13px;margin:0;opacity:.9}
.lp-body{padding:20px}
.lp-body h2{font-size:16px;margin:0 0 8px}
.lp-body ul{margin:0;padding-left:1.2em;font-size:13px;line-height:1.9}
.lp-cta{padding:0 20px 32px;text-align:center}
.lp-cta__button{display:inline-block;background:#0091FF;color:#fff;text-decoration:none;padding:12px 28px;border-radius:4px;font-size:14px}`
