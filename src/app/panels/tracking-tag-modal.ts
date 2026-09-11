/**
 * 外部LP計測タグの発行（クローン独自機能）。
 *
 * 別アカウントのSquadBeyond等でホストされているLPの「タグ設定」に貼ると、そのLPの
 * PV／クリックを **このシステムの同じ beyondページのレポート** へ計上できる。
 * 送信先は自前配信と同じ `POST /lp/:uid/__track`（外部オリジン用にCORS許可済み）。
 *
 * 設計メモ:
 * - version は送らない。外部LPは当システム上「1ページ」であり、Version別の内訳を持たない。
 *   （送らなければサーバーは ab_test スコープだけに計上する＝レポート全体のPV/クリックに出る）
 * - クリックの目印は自前配信の計測スクリプトと同じ `sb_tracking=true`（tel: だけは
 *   data-sb-tracking="true"）。実SquadBeyondの「計測機能付きリンク」も同じ目印を出すので、
 *   相手LPのリンクが計測機能付きになっていれば拾える。
 */
import { toast } from '../ui.ts'

const CSS_ID = 'sb-tracking-tag-css'
let isOpen = false

function injectStyles(): void {
  if (document.getElementById(CSS_ID) !== null) return
  const s = document.createElement('style')
  s.id = CSS_ID
  s.textContent = `
    .sb-tt-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:100000;
      display:flex; align-items:center; justify-content:center; padding:24px;
    }
    .sb-tt-card {
      background:#fff; border-radius:8px; width:min(640px,100%); max-height:84vh;
      overflow:auto; padding:22px 24px; box-shadow:0 8px 32px rgba(0,0,0,.22);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,
        "Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;
      color:#1a1a1a; box-sizing:border-box;
    }
    .sb-tt-title { font-size:15px; font-weight:700; margin:0 0 4px; }
    .sb-tt-lead { font-size:12px; color:#666; line-height:1.7; margin:0 0 14px; }
    .sb-tt-steps { font-size:12px; color:#333; line-height:1.9; margin:0 0 14px; padding-left:18px; }
    .sb-tt-label { font-size:11px; font-weight:600; color:#666; margin:0 0 6px; }
    .sb-tt-code {
      width:100%; height:190px; box-sizing:border-box; resize:vertical;
      border:1px solid #e5e5ea; border-radius:5px; background:#f7f8fa;
      padding:10px 12px; font:12px/1.6 "SF Mono",Menlo,monospace; color:#1a1a1a;
      white-space:pre; overflow:auto;
    }
    .sb-tt-notes { font-size:11px; color:#888; line-height:1.8; margin:12px 0 0; padding-left:16px; }
    .sb-tt-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
    .sb-tt-btn {
      font-size:13px; padding:8px 16px; border-radius:5px; cursor:pointer;
      border:1px solid #e5e5ea; background:#fff; color:#333; font-family:inherit;
    }
    .sb-tt-btn:hover { background:#f5f6f8; }
    .sb-tt-btn.primary { background:var(--sb-accent, #0091FF); border-color:var(--sb-accent, #0091FF); color:#fff; }
    .sb-tt-btn.primary:hover { background:#007ee0; }
  `
  document.head.append(s)
}

/**
 * 配信URL（`https://host/lp/UID`）から計測タグを組み立てる。
 * 戻り値はユーザーが相手のタグ設定へ貼り付ける文字列そのもの（textarea の value に入れるだけで、
 * このアプリのHTMLへインライン展開はしないため `</script>` はエスケープ不要）。
 */
export function buildExternalTrackingTag(origin: string, uid: string): string {
  // 中身は `/t/<uid>.js` から配る。貼るのはこの1行だけなので、計測ロジックを直しても
  // 相手のLPへ貼り直してもらう必要がない（GA・Metaピクセルと同じ方式）。
  // async なので表示をブロックしない。
  return `<script async src="${origin}/t/${encodeURIComponent(uid)}.js"></script>`
}

/**
 * CV計測タグ。**サンクスページ（申込完了ページ）**に貼る。
 * LPで計測機能付きリンクを押してから1日以内の成果だけを、見ていたVersionのCVとして数える（SquadBeyond本体と同じ・2026-09-11）。
 * 売上を送りたいときは、タグより前に `window.__sbCvAmount = 金額` を置く（省略時は0＝金額を発明しない）。
 */
export function buildCvTag(origin: string, uid: string): string {
  return `<script async src="${origin}/t/${encodeURIComponent(uid)}.cv.js"></script>`
}

/**
 * 受け渡しタグ。**広告主サイトの最初のページ（LPのリンク先）**に貼る。
 * LPのリンクに付いてきた訪問者の目印（squadbeyond_uid）をそのサイトに1日保存し、サンクスページのCVタグが使う。
 * サンクスページまでURLの目印を引き継げるサイトなら不要。
 */
export function buildKeepUidTag(origin: string, uid: string): string {
  return `<script async src="${origin}/t/${encodeURIComponent(uid)}.keep.js"></script>`
}

/** 配信URLから origin と ab_test uid を取り出す（取れなければ null）。 */
function parseDeliveryUrl(deliveryUrl: string): { origin: string; uid: string } | null {
  try {
    const u = new URL(deliveryUrl, location.origin)
    const m = /\/lp\/([^/?#]+)/.exec(u.pathname)
    if (m === null || m[1] === undefined || m[1] === '') return null
    return { origin: u.origin, uid: decodeURIComponent(m[1]) }
  } catch {
    return null
  }
}

export function openTrackingTagModal(deliveryUrl: string): void {
  if (isOpen) return
  const parsed = parseDeliveryUrl(deliveryUrl)
  if (parsed === null) {
    toast('配信URLからLPを特定できませんでした', 'error')
    return
  }
  injectStyles()
  isOpen = true

  const tag = buildExternalTrackingTag(parsed.origin, parsed.uid)

  const overlay = document.createElement('div')
  overlay.className = 'sb-tt-overlay'
  const card = document.createElement('div')
  card.className = 'sb-tt-card'

  const title = document.createElement('h3')
  title.className = 'sb-tt-title'
  title.textContent = '外部LP計測タグ'
  const lead = document.createElement('p')
  lead.className = 'sb-tt-lead'
  lead.textContent =
    '別アカウント（別のSquadBeyond等）で配信しているLPに貼ると、そのLPのPV・クリックを' +
    'この beyondページのレポートに計上します。'

  const steps = document.createElement('ol')
  steps.className = 'sb-tt-steps'
  for (const t of [
    '下のタグをコピーする',
    '相手のSquadBeyondで対象LPを開き、「タグ設定」を開く',
    'body（本文）側にそのまま貼り付けて保存する',
    '広告からの流入が始まると、このLPのレポートにPV・クリックが積み上がる',
  ]) {
    const li = document.createElement('li')
    li.textContent = t
    steps.append(li)
  }

  const label = document.createElement('div')
  label.className = 'sb-tt-label'
  label.textContent = `① LP本体に貼る（PV・クリック）／送信先: ${parsed.origin}/lp/${parsed.uid}/__track`

  const code = document.createElement('textarea')
  code.className = 'sb-tt-code'
  code.readOnly = true
  code.value = tag
  code.addEventListener('focus', () => code.select())

  // ② CV計測タグ（サンクスページ用）
  const cvTag = buildCvTag(parsed.origin, parsed.uid)
  const cvLabel = document.createElement('div')
  cvLabel.className = 'sb-tt-label'
  cvLabel.style.marginTop = '14px'
  cvLabel.textContent = '② サンクスページ（申込完了ページ）に貼る（CV）'
  const cvCode = document.createElement('textarea')
  cvCode.className = 'sb-tt-code'
  cvCode.style.height = '120px'
  cvCode.readOnly = true
  cvCode.value = cvTag
  cvCode.addEventListener('focus', () => cvCode.select())
  const cvCopy = document.createElement('button')
  cvCopy.type = 'button'
  cvCopy.className = 'sb-tt-btn'
  cvCopy.style.marginTop = '8px'
  cvCopy.textContent = 'CVタグをコピー'
  cvCopy.addEventListener('click', () => {
    void navigator.clipboard?.writeText(cvTag).then(
      () => toast('CV計測タグをコピーしました'),
      () => toast('コピーできませんでした', 'error'),
    )
  })

  // ③ 受け渡しタグ（サンクスページが別ドメインのとき、広告主サイトの最初のページに貼る）
  const keepTag = buildKeepUidTag(parsed.origin, parsed.uid)
  const keepLabel = document.createElement('div')
  keepLabel.className = 'sb-tt-label'
  keepLabel.style.marginTop = '14px'
  keepLabel.textContent = '③ 広告主サイトの最初のページ（LPのリンク先）に貼る（サンクスページが別ドメインのとき）'
  const keepCode = document.createElement('textarea')
  keepCode.className = 'sb-tt-code'
  keepCode.style.height = '90px'
  keepCode.readOnly = true
  keepCode.value = keepTag
  keepCode.addEventListener('focus', () => keepCode.select())
  const keepCopy = document.createElement('button')
  keepCopy.type = 'button'
  keepCopy.className = 'sb-tt-btn'
  keepCopy.style.marginTop = '8px'
  keepCopy.textContent = '受け渡しタグをコピー'
  keepCopy.addEventListener('click', () => {
    void navigator.clipboard?.writeText(keepTag).then(
      () => toast('受け渡しタグをコピーしました'),
      () => toast('コピーできませんでした', 'error'),
    )
  })

  const notes = document.createElement('ul')
  notes.className = 'sb-tt-notes'
  for (const t of [
    'クリックは「計測機能付きリンク」のみ（相手LPのリンクが計測機能付きである必要があります）',
    'CVは、LPで計測機能付きリンクを押してから1日以内に届いた成果だけを、見ていたVersionに数えます（SquadBeyond本体と同じ。同じ人の成果は1回だけ）',
    'サンクスページがLPと別のドメインのときは、③を広告主サイトの最初のページにも貼ってください（URLの squadbeyond_uid をサンクスページまで引き継げるなら不要）',
    '売上も入れたい場合は、CVタグより前に window.__sbCvAmount = 金額 を置いてください',
    'タグを貼った時点からの計測です。過去には遡れません',
    'SquadBeyond側のレポート数値とは独立したカウンタなので、完全一致はしません',
  ]) {
    const li = document.createElement('li')
    li.textContent = t
    notes.append(li)
  }

  const actions = document.createElement('div')
  actions.className = 'sb-tt-actions'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'sb-tt-btn'
  closeBtn.textContent = '閉じる'
  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'sb-tt-btn primary'
  copyBtn.textContent = 'タグをコピー'
  actions.append(closeBtn, copyBtn)

  const close = (): void => {
    isOpen = false
    overlay.remove()
  }
  closeBtn.addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard?.writeText(tag).then(
      () => toast('計測タグをコピーしました'),
      () => toast('コピーできませんでした', 'error'),
    )
  })

  card.append(title, lead, steps, label, code, cvLabel, cvCode, cvCopy, keepLabel, keepCode, keepCopy, notes, actions)
  overlay.append(card)
  document.body.append(overlay)
}
