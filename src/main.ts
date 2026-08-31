/**
 * P0 のプレースホルダ。
 * 土台（capture/clean/ の匿名化済み実DOM）が入るまでの、`npm run dev` 確認用の最小シェル。
 * 企画書 §11 のとおり、ここは採取した実HTMLで置き換えられる（手書きでUIを近似しない）。
 */

const root = document.querySelector<HTMLDivElement>('#root')
if (root !== null) {
  root.innerHTML = `
    <main style="font-family:var(--sb-font-base);background:var(--sb-bg-page);min-height:100vh;margin:0;padding:24px">
      <p style="color:var(--sb-text-sub);font-size:13px;margin:0 0 4px">P0 プレースホルダ</p>
      <h1 style="font-size:18px;color:var(--sb-text-strong);margin:0 0 12px">採取待ち（capture/clean/ が空）</h1>
      <p style="font-size:13px;color:var(--sb-text-strong);line-height:1.9;margin:0">
        企画書 §11 のとおり、各ルートの画面は採取した実HTML/実CSSで土台化します。<br />
        モックAPIは <code>npm run mock</code> で起動し、<code>/api/v1/*</code> で応答します。
      </p>
    </main>
  `
}
