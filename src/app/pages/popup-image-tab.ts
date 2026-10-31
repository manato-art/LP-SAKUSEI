/**
 * ポップアップの「追加」の「画像」のタブ（指示38・2026-10-31 本人「ポップアップなんだけど、画像って項目を作成して。
 * これは画像をアップすることによって、その画像をポップアップとして設置できる」→ 本人の選択「全部」＝離脱防止・表示直後・追従型）。
 *
 * 画像を選ぶ（または枠へ落とす）→ 見え方を確かめる →「この画像で追加」で、その画像1枚を中身にしたポップアップを作る。
 * 画像は WebP に縮める（GIF は動きを残すためそのまま・webp-convert.ts）。サーバーが保存のときに /uploads へ別ファイルにする。
 * 押したときのリンクは、今までどおりポップアップの編集画面のリンクの設定で入れる。
 */
import { el, toast } from '../ui.ts'
import { convertImageToWebP } from '../panels/webp-convert.ts'

/** 画像を置く形（離脱防止・表示直後＝箱／追従型の帯／追従型の角） */
export type ImagePopupShape = 'box' | 'bar' | 'corner'

const escapeAttr = (value: string): string => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

/** 画像1枚の中身。箱と角は箱の幅に収め、帯は LP の幅（620px）まで広げて真ん中に置く */
export function imagePopupHtml(src: string, shape: ImagePopupShape): string {
  const look =
    shape === 'bar'
      ? 'display:block;width:100%;max-width:620px;height:auto;margin:0 auto'
      : 'display:block;max-width:100%;height:auto;margin:0 auto'
  return `<img src="${escapeAttr(src)}" alt="" style="${look}">`
}

/** ポップアップの名前（ファイルの名前から拡張子を外す・無ければ「画像ポップアップ」・100文字まで） */
export function imagePopupName(fileName: string): string {
  const base = fileName.replace(/\.[^.]*$/, '').trim()
  return base === '' ? '画像ポップアップ' : [...base].slice(0, 100).join('')
}

/**
 * 「画像」のタブの中身。onCreate は「この画像で追加」を押したとき（中身の HTML と名前を渡す）。作れたら true
 */
export function imageTabPanel(shape: ImagePopupShape, onCreate: (html: string, name: string) => Promise<boolean>): HTMLElement {
  const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:12px;padding:16px' })
  const drop = el('label', {
    style:
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:180px;padding:16px;' +
      'border:2px dashed #C9CFD8;border-radius:10px;background:#FAFBFC;cursor:pointer;text-align:center;color:#4B5563;font-size:13px',
  })
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.hidden = true
  const hint = el('span', { text: 'ここを押して画像を選ぶ（ここへ落としてもOK）' })
  const preview = document.createElement('img')
  preview.alt = '選んだ画像'
  preview.hidden = true
  preview.style.cssText = 'max-width:100%;max-height:320px;height:auto;border-radius:6px'
  drop.append(input, preview, hint)

  const note = el('p', {
    style: 'margin:0;font-size:12px;color:#6B7280',
    text: '選んだ画像がそのままポップアップになります。押したときのリンクは、追加したあと編集画面のリンクの設定で入れます。',
  })
  const add = el('button', { class: 'ep-preset-add', text: 'この画像で追加' })
  add.type = 'button'
  add.disabled = true
  wrap.append(drop, note, add)

  let chosen: { src: string; name: string } | null = null
  const choose = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return
    if (!file.type.startsWith('image/')) {
      toast('画像のファイルを選んでください', 'error')
      return
    }
    const src = await convertImageToWebP(file)
    if (src === '') {
      toast('画像を読み込めませんでした。別の画像を選んでください', 'error')
      return
    }
    chosen = { src, name: imagePopupName(file.name) }
    preview.src = src
    preview.hidden = false
    hint.textContent = `${file.name}（押すと選び直せます）`
    add.disabled = false
  }
  input.addEventListener('change', () => void choose(input.files?.[0]))
  drop.addEventListener('dragover', (e) => e.preventDefault())
  drop.addEventListener('drop', (e) => {
    e.preventDefault()
    void choose(e.dataTransfer?.files[0])
  })
  add.addEventListener('click', () => {
    if (chosen === null || add.disabled) return
    add.disabled = true
    add.textContent = '追加中…'
    void onCreate(imagePopupHtml(chosen.src, shape), chosen.name).then((ok) => {
      if (ok) return
      add.disabled = false
      add.textContent = 'この画像で追加'
    })
  })
  return wrap
}
