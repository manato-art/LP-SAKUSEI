/**
 * 「ページ」画面の作成ダイアログ（新規フォルダ作成 / 新規beyondページ作成）。
 *
 * ## なぜここだけ手書きなのか（採取物に無い）
 *
 * 実物のダイアログは radix の portal で描かれる。`/folders` の採取は
 * **ダイアログを開いていない状態**なので、採取HTMLにはダイアログの中身が1文字も無い
 * （`role="dialog"` は0件。`*.portals.html` も `/folders` には存在しない）。
 * 開いた状態を採取していない以上、土台にできるマークアップが無い。
 *
 * ここでCSSから形を推測して「それらしいダイアログ」を組み立てると、
 * 実物と違うものを実物のふりで置くことになる（企画書 §3-5・共通指示 §1-5）。
 * そこで**共有部品（`ui.ts`）のままにして、クローン側の道具だと分かる見た目で出す**。
 * 開いた状態を採取できたら、この2関数だけを土台差し替えすれば済む。
 *
 * 起点のボタンだけは実物が採取できている（ツリー左上の `generate-folder-icon`）。
 * そちらは `folders.ts` が採取物のボタンにそのまま配線している。
 */
import { EDITOR_CHOICES } from './editor-choices.ts'
import { api, fetchMedia, type Folder, type Media } from '../api.ts'
import { T, el, field, modal, textInput, toast } from '../ui.ts'

/** 媒体ロスターは作成ダイアログでしか使わないので、ここで保持する。 */
let mediaCache: Media[] | null = null

/** 新規フォルダ作成。作成後はそのフォルダを選んだ状態へ移る（実物と同じ導線）。 */
export function openCreateFolder(): void {
  const name = textInput('例: 2026年秋キャンペーン')
  const body = el('div', {}, [field('フォルダ名', name, '後から変更できます')])
  modal('新規フォルダ作成', body, async () => {
    if (name.value.trim() === '') throw new Error('フォルダ名を入力してください。')
    const { folder } = await api.createFolder(name.value.trim())
    toast(`フォルダ「${folder.name}」を作成しました`)
    location.hash = `/folders?uid=${folder.uid}`
    rerender()
  })
}

/**
 * 新規beyondページ作成。3項目は実機の基本情報タブの実測（`docs/findings-live-observation.md`）に合わせる。
 * 作成が通ったらエディタへ移る（企画書 §1-4 の作成フローの終点）。
 */
export async function openCreatePage(folder: Folder): Promise<void> {
  // 空配列をキャッシュすると二度と取り直さないので、中身があるときだけ保持する
  if (mediaCache === null || mediaCache.length === 0) {
    mediaCache = await fetchMedia()
  }
  if (mediaCache.length === 0) {
    toast('媒体リストを取得できませんでした。npm run mock が動いているか確認してください。', 'error')
    return
  }

  const editorWrap = el('div', {})
  let editorValue = 2
  for (const choice of EDITOR_CHOICES) {
    const option = el('label', {
      style: `display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #E5E5E5;
        border-radius:4px;margin-bottom:8px;cursor:pointer;font-size:13px`,
    })
    const radio = el('input')
    radio.type = 'radio'
    radio.name = 'editor'
    radio.checked = choice.value === 2
    radio.addEventListener('change', () => {
      // 値が未観測の選択肢は保存できない（推測の番号を保存すると壊れたデータになる・D-011）
      if (choice.value !== null) editorValue = choice.value
    })
    option.append(radio, el('span', { text: choice.label }))
    if (choice.note !== undefined) {
      option.append(el('span', { text: choice.note, style: `margin-left:auto;font-size:11px;color:${T.sub}` }))
      if (choice.value !== 2) radio.disabled = true
    }
    editorWrap.append(option)
  }

  const title = textInput('未入力でも作成できます')
  const mediaSelect = el('select', {
    style: `width:100%;padding:10px 12px;border:1px solid #DDD;border-radius:4px;font-size:14px;font-family:${T.font}`,
  })
  for (const media of mediaCache) {
    const option = el('option', { text: media.name })
    option.value = String(media.id)
    if (media.name === '媒体/ポストバックなし') option.selected = true
    mediaSelect.append(option)
  }

  const body = el('div', {}, [
    field('1. エディターを選択（必須）', editorWrap, '作成後は変更できません'),
    field('2. ページ名', title, 'ページ名は未入力のままでも設定可能です。後から変更可能です。'),
    field('3. 広告媒体（必須）', mediaSelect),
  ])

  modal('新規ページ作成', body, async () => {
    const created = await api.createAbTest({
      title: title.value.trim() === '' ? '無題のページ' : title.value.trim(),
      folder_id: folder.id,
      media_id: Number(mediaSelect.value),
      editor_version: editorValue,
    })
    toast(`「${created.ab_test.title}」を作成しました`)
    location.hash = `/ab_tests/${created.ab_test.uid}/articles`
  })
}

/** ハッシュが変わらない場合でも描き直す（同じフォルダを選び直したときなど） */
function rerender(): void {
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
