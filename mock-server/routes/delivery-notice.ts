/**
 * 配信ページの代わりに出す案内ページ（delivery.ts から分離）。
 *
 * 配信が止まっている・除外リンクを開いた・プレビュー表示中、といった
 * 「LPそのものではない」応答のHTMLをここにまとめている。
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
/** 実在しないID等で開かれたときの案内ページ（クライアント版 showNotice のSSR版） */
export function renderNotice(res: import('express').Response, uid: string): void {
  const looksLikePlaceholder = /[<>]/.test(uid)
  const html =
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>配信ページが見つかりません</title>` +
    `<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
    `padding:24px;font-family:"Hiragino Sans",sans-serif;background:#ECECEC}` +
    `.card{background:#fff;border-radius:8px;padding:28px 32px;max-width:520px;text-align:center;` +
    `box-shadow:0 1px 6px rgba(0,0,0,.12);line-height:1.9}` +
    `.title{font-size:16px;font-weight:600;margin-bottom:8px}` +
    `.desc{font-size:13px;color:#555}</style></head><body>` +
    `<div class="card">` +
    `<div class="title">このURLの配信ページは見つかりません</div>` +
    `<div class="desc">指定されたID「${escapeHtml(uid)}」のbeyondページが存在しません。` +
    (looksLikePlaceholder
      ? '<br><b>&lt;uid&gt; は差し込み用の記号です。</b>実際のIDに置き換えてください。'
      : '') +
    `</div></div></body></html>`
  res.status(404).type('html').send(html)
}
/** 除外リンクを開いたときに出す画面 */
export function renderExcludePage(ok: boolean, email: string): string {
  const body = ok
    ? `<h1>このブラウザを除外しました</h1>
       <p>${escapeHtml(email)} として登録された除外設定です。</p>
       <p>これ以降、<b>このブラウザ</b>からのアクセスはレポートの数値に入りません。
          ページはこれまでどおり普通に見られます。</p>
       <p class="note">別のブラウザや別の端末には効きません。それぞれで同じリンクを開いてください。
          ブラウザのデータ（Cookie）を消すと解除されます。</p>`
    : `<h1>この除外リンクは無効です</h1>
       <p>設定が削除されたか、URLが間違っている可能性があります。</p>`
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>レポート除外</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
 background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;color:#1f2937}
.card{background:#fff;border:1px solid #e6e9f0;border-radius:12px;padding:28px 32px;max-width:520px;
 box-shadow:0 1px 3px rgba(16,24,40,.06)}
h1{font-size:18px;margin:0 0 12px}p{font-size:13px;line-height:1.9;margin:0 0 10px}
.note{color:#6b7280;font-size:12px}
</style></head><body><div class="card">${body}</div></body></html>`
}
/** 中間ページとして応答できないときの案内（移動はしない） */
export function renderRedirectPageNotice(kind: 'not_found' | 'no_destination'): string {
  const message =
    kind === 'not_found'
      ? { title: 'この中間ページは見つかりません', desc: '中間ページが存在しないか、削除されています。' }
      : { title: 'リダイレクト先が設定されていません', desc: '中間ページ設定の「リダイレクト先」にURLを入力してください。' }
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${message.title}</title>` +
    `<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
    `padding:24px;font-family:"Hiragino Sans",sans-serif;background:#ECECEC}` +
    `.card{background:#fff;border-radius:8px;padding:28px 32px;max-width:520px;text-align:center;` +
    `box-shadow:0 1px 6px rgba(0,0,0,.12);line-height:1.9}` +
    `.title{font-size:16px;font-weight:600;margin-bottom:8px}` +
    `.desc{font-size:13px;color:#555}</style></head><body>` +
    `<div class="card"><div class="title">${message.title}</div><div class="desc">${message.desc}</div></div>` +
    `</body></html>`
}
/** プレビューが見つからないときの案内 */
export function renderPreviewNotice(versionUid: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>プレビューが見つかりません</title>` +
    `<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
    `padding:24px;font-family:"Hiragino Sans",sans-serif;background:#ECECEC}` +
    `.card{background:#fff;border-radius:8px;padding:28px 32px;max-width:520px;text-align:center;` +
    `box-shadow:0 1px 6px rgba(0,0,0,.12);line-height:1.9}` +
    `.title{font-size:16px;font-weight:600;margin-bottom:8px}` +
    `.desc{font-size:13px;color:#555}</style></head><body>` +
    `<div class="card">` +
    `<div class="title">このプレビューURLは見つかりません</div>` +
    `<div class="desc">Version「${escapeHtml(versionUid)}」が存在しないか、削除されています。</div>` +
    `</div></body></html>`
}
