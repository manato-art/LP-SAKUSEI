/**
 * 基本情報の「配信URL」で、住所の頭の名前を決める欄（2026-10-30 本人「基本情報から https:// と .c1page.com の間を
 * 自由に決めることができる」「何もしない時は c1page.com/lp/… って感じ」）。
 *
 * 出すのは 2026-10-30 からあとに作った・複製したLPだけ（ページ自身が住所を持つ）。
 * 前からあるLPはフォルダのドメインのまま＝この欄は出さない（配信中の広告のURLを変えない）。
 * 保存は基本情報の「登録する」で、ほかの項目といっしょに送る（delivery_label）。
 * 欄の横の「登録する」は住所だけをすぐ登録する（2026-10-30 本人「配信URLの横にも登録ボタンを作成して」）。
 */
import { labelOfPageDomain, pageDomainFromLabel, pageDomainLabelError } from '../../shared/page-delivery-domain.ts'

/** 入力欄の id（基本情報の `bi-` で始まる欄は、打つたびに右の「設定内容の確認」を描き直す） */
export const ADDRESS_LABEL_INPUT_ID = 'bi-addr-label'

/** 頭の名前の欄を出すときの今の名前（'' ＝なし＝c1page.com）。出さないページなら null */
export function editableAddressLabel(pageDomain: string | undefined, base: string): string | null {
  if (pageDomain === undefined || pageDomain === '') return null
  return labelOfPageDomain(pageDomain, base)
}

/** 入力中の名前で住所がどう変わるかの案内。変えていなければ null */
export function addressChangeNote(savedDomain: string, label: string, base: string, uid: string): string | null {
  const name = label.trim().toLowerCase()
  const labelError = pageDomainLabelError(name)
  if (labelError !== null) return labelError
  const next = pageDomainFromLabel(name, base)
  if (next === savedDomain) return null
  return `「登録する」を押すと、配信URLが https://${next}/lp/${uid} に変わります。今の https://${savedDomain}/lp/${uid} では開けなくなるので、広告に入れていたら差し替えてください。`
}

/** 欄の横の「登録する」を押せるか: 正しい名前で、住所が今と変わるときだけ */
export function canRegisterAddress(savedDomain: string, label: string, base: string): boolean {
  const name = label.trim().toLowerCase()
  return pageDomainLabelError(name) === null && pageDomainFromLabel(name, base) !== savedDomain
}

/**
 * 欄の見た目: https:// [名前] .c1page.com/lp/<uid> [登録する]
 * onRegister は住所だけを登録する（できたら true）。できたら呼び出し側が欄を描き直す。
 */
export function buildAddressEditor(
  label: string,
  base: string,
  uid: string,
  onRegister: (label: string) => Promise<boolean>,
): HTMLElement {
  injectAddressStyles()
  const wrap = document.createElement('div')
  wrap.className = 'bi-addr'
  const row = document.createElement('div')
  row.className = 'bi-addr-row'
  const head = document.createElement('span')
  head.className = 'bi-addr-fix'
  head.textContent = 'https://'
  const input = document.createElement('input')
  input.type = 'text'
  input.id = ADDRESS_LABEL_INPUT_ID
  input.className = 'bi-input bi-addr-input'
  input.value = label
  input.placeholder = 'なし'
  input.autocomplete = 'off'
  input.spellcheck = false
  input.setAttribute('aria-label', `住所の頭の名前（.${base} の前）`)
  const tail = document.createElement('span')
  tail.className = 'bi-addr-fix'
  tail.textContent = `.${base}/lp/${uid}`
  const register = document.createElement('button')
  register.type = 'button'
  register.className = 'bi-url-copy bi-addr-save'
  register.textContent = '登録する'
  register.disabled = true
  row.append(head, input, tail, register)

  const hint = document.createElement('div')
  hint.className = 'bi-hint'
  hint.textContent = `空のままなら https://${base}/lp/${uid} です。英字（小文字）・数字・ハイフンが使えます（例: meguri）。`

  const note = document.createElement('div')
  note.className = 'bi-addr-note'
  note.hidden = true

  const savedDomain = pageDomainFromLabel(label, base)
  input.addEventListener('input', () => {
    const text = addressChangeNote(savedDomain, input.value, base, uid)
    note.hidden = text === null
    note.textContent = text ?? ''
    register.disabled = !canRegisterAddress(savedDomain, input.value, base)
  })
  register.addEventListener('click', () => {
    if (register.disabled) return
    register.disabled = true
    void onRegister(input.value).then((ok) => {
      if (!ok) register.disabled = !canRegisterAddress(savedDomain, input.value, base)
    })
  })

  wrap.append(row, hint, note)
  return wrap
}

/**
 * 今までのURLも残しているページ（「金谷味噌汁のコピー」だけ・2026-10-30 本人「今までのURLと c1page.com の２個」）に出す行。
 * 今までのURLはこのシステムのドメイン（どのページも出す）なので、住所を足したあとも開ける。
 */
export function buildKeptUrlRow(url: string, onCopy: () => void): HTMLElement {
  injectAddressStyles()
  const wrap = document.createElement('div')
  wrap.className = 'bi-addr-kept'
  const title = document.createElement('div')
  title.className = 'bi-hint'
  title.textContent = '今までのURL（こちらでも開けます）'
  const row = document.createElement('div')
  row.className = 'bi-url-row'
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'bi-input'
  input.readOnly = true
  input.value = url
  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'bi-url-copy'
  copyBtn.textContent = 'URLをコピー'
  copyBtn.addEventListener('click', onCopy)
  row.append(input, copyBtn)
  wrap.append(title, row)
  return wrap
}

function injectAddressStyles(): void {
  if (document.getElementById('bi-addr-css') !== null) return
  const style = document.createElement('style')
  style.id = 'bi-addr-css'
  style.textContent = `
    .bi-addr { display:flex; flex-direction:column; gap:6px; margin-bottom:10px; }
    .bi-addr-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .bi-addr-fix { font-size:13.5px; color:#48526b; white-space:nowrap; font-variant-numeric:tabular-nums; }
    .bi-addr-row .bi-addr-input { width:180px; flex:none; }
    .bi-addr-row .bi-addr-save { height:38px; margin-left:4px; }
    .bi-addr-save:disabled { opacity:.45; cursor:default; }
    .bi-addr-kept { display:flex; flex-direction:column; gap:6px; margin-top:10px; }
    .bi-addr-note { font-size:12px; line-height:1.6; color:#9a5b00; background:#fff6e6; border-radius:8px; padding:8px 10px; }
  `
  document.head.append(style)
}
