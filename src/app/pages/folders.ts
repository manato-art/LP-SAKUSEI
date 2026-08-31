/**
 * ページ（beyondページ）画面。企画書 §1-4 の基準状態＝**新規アカウントの空状態**から始まり、
 * フォルダ作成 → beyondページ作成 → エディタへ、という作成フローが実際に通る。
 */
import { api, fetchMedia, type AbTest, type Folder, type Media } from '../api.ts'
import { T, button, el, emptyState, field, modal, textInput, toast } from '../ui.ts'

const EDITOR_CHOICES: readonly { value: number; label: string; note?: string }[] = [
  { value: 3, label: 'スワイプLPエディター（β）', note: '今回のクローンでは対象外' },
  { value: 2, label: 'beyondエディター' },
  { value: 1, label: 'HTMLエディター', note: '今回のクローンでは未実装' },
]

let mediaCache: Media[] | null = null

export async function renderFolders(container: HTMLElement, params: URLSearchParams): Promise<void> {
  container.innerHTML = ''
  const selectedUid = params.get('uid')

  const { folders } = await api.folders()
  const layout = el('div', { style: 'display:flex;height:100vh;font-family:' + T.font })

  // ── 左: フォルダツリー ──
  const tree = el('div', {
    style: `width:260px;flex-shrink:0;background:${T.surface};border-right:1px solid #E5E5E5;
      display:flex;flex-direction:column`,
  })
  const treeHead = el('div', {
    style: 'padding:12px;border-bottom:1px solid #EEE;display:flex;gap:8px;align-items:center',
  })
  const newFolderBtn = button('＋ フォルダ', 'ghost')
  treeHead.append(el('strong', { text: 'フォルダ', style: 'font-size:13px;flex:1' }), newFolderBtn)
  tree.append(treeHead)

  const treeBody = el('div', { style: 'flex:1;overflow:auto;padding:6px' })
  if (folders.length === 0) {
    treeBody.append(
      el('div', {
        text: 'フォルダがありません',
        style: `padding:24px 12px;color:${T.sub};font-size:12px;text-align:center`,
      }),
    )
  }
  for (const folder of folders) {
    treeBody.append(folderRow(folder, folder.uid === selectedUid))
  }
  tree.append(treeBody)

  // ── 右: beyondページ一覧 ──
  const main = el('div', { style: 'flex:1;min-width:0;display:flex;flex-direction:column' })
  const bar = el('div', {
    style: `padding:12px 16px;background:${T.surface};border-bottom:1px solid #E5E5E5;
      display:flex;gap:10px;align-items:center`,
  })
  const newPageBtn = button('＋ 新規ページを作成')
  newPageBtn.disabled = selectedUid === null
  if (selectedUid === null) newPageBtn.style.opacity = '.45'
  bar.append(
    el('strong', {
      text: selectedUid === null ? 'フォルダを選択してください' : (folders.find((f) => f.uid === selectedUid)?.name ?? ''),
      style: 'font-size:14px;flex:1',
    }),
    newPageBtn,
  )
  main.append(bar)

  const list = el('div', { style: 'flex:1;overflow:auto;padding:16px' })
  if (selectedUid === null) {
    list.append(emptyState('左からフォルダを選ぶと、そのフォルダのbeyondページが表示されます。'))
  } else {
    const detail = await api.folderDetail(selectedUid)
    if (detail.ab_tests.length === 0) {
      const create = button('＋ 新規ページを作成')
      create.addEventListener('click', () => openCreatePage(detail.folder))
      list.append(emptyState('このフォルダにはまだbeyondページがありません。', create))
    } else {
      for (const abTest of detail.ab_tests) list.append(pageRow(abTest))
    }
  }
  main.append(list)

  layout.append(tree, main)
  container.append(layout)

  newFolderBtn.addEventListener('click', openCreateFolder)
  newPageBtn.addEventListener('click', () => {
    const folder = folders.find((f) => f.uid === selectedUid)
    if (folder !== undefined) openCreatePage(folder)
  })
}

function folderRow(folder: Folder, active: boolean): HTMLElement {
  const row = el('div', {
    style: `display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:4px;cursor:pointer;
      font-size:13px;${active ? `background:#FDF3E3` : ''}`,
  })
  row.append(
    el('span', { text: '📁', style: 'font-size:14px' }),
    el('span', { text: folder.name, style: 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }),
    el('span', {
      text: String(folder.ab_tests_count),
      style: `background:#999;color:#fff;font-size:10px;border-radius:9px;padding:1px 7px`,
    }),
  )
  row.addEventListener('mouseenter', () => {
    if (!active) row.style.background = '#F7F7F7'
  })
  row.addEventListener('mouseleave', () => {
    if (!active) row.style.background = ''
  })
  row.addEventListener('click', () => {
    location.hash = `/folders?uid=${folder.uid}`
  })
  return row
}

const STATUS_LABEL: Readonly<Record<string, string>> = {
  prepared: '準備中',
  delivered: '配信中',
  stopping: '停止中',
  finished: '終了',
}

function pageRow(abTest: AbTest): HTMLElement {
  const row = el('div', {
    style: `background:${T.surface};border-radius:6px;padding:14px 16px;margin-bottom:10px;
      display:flex;align-items:center;gap:14px`,
  })
  const info = el('div', { style: 'flex:1;min-width:0' }, [
    el('div', { text: abTest.title, style: 'font-size:14px;font-weight:600;margin-bottom:5px' }),
    el('div', {
      text: `${STATUS_LABEL[abTest.ad_status] ?? abTest.ad_status} · ${abTest.media?.name ?? '媒体なし'} · ${abTest.editor_version === 2 ? 'beyondエディター' : 'HTMLエディター'}`,
      style: `font-size:11px;color:${T.sub}`,
    }),
  ])
  const open = button('エディタを開く')
  open.addEventListener('click', () => {
    location.hash = `/ab_tests/${abTest.uid}/articles`
  })
  row.append(info, open)
  return row
}

function openCreateFolder(): void {
  const name = textInput('例: 2026年秋キャンペーン')
  const body = el('div', {}, [field('フォルダ名', name, '後から変更できます')])
  modal('新規フォルダ作成', body, async () => {
    if (name.value.trim() === '') throw new Error('フォルダ名を入力してください。')
    const { folder } = await api.createFolder(name.value.trim())
    toast(`フォルダ「${folder.name}」を作成しました`)
    location.hash = `/folders?uid=${folder.uid}`
    await rerender()
  })
}

async function openCreatePage(folder: Folder): Promise<void> {
  // 空配列をキャッシュすると二度と取り直さないので、中身があるときだけ保持する
  if (mediaCache === null || mediaCache.length === 0) {
    mediaCache = await fetchMedia()
  }

  // 1. エディターを選択（実機どおり必須・作成後は変更不可）
  const editorWrap = el('div', {})
  let editorValue = 2
  for (const choice of EDITOR_CHOICES) {
    const opt = el('label', {
      style: `display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #E5E5E5;
        border-radius:4px;margin-bottom:8px;cursor:pointer;font-size:13px`,
    })
    const radio = el('input')
    radio.type = 'radio'
    radio.name = 'editor'
    radio.checked = choice.value === 2
    radio.addEventListener('change', () => {
      editorValue = choice.value
    })
    opt.append(radio, el('span', { text: choice.label }))
    if (choice.note !== undefined) {
      opt.append(el('span', { text: choice.note, style: `margin-left:auto;font-size:11px;color:${T.sub}` }))
      if (choice.value !== 2) radio.disabled = true
    }
    editorWrap.append(opt)
  }

  const title = textInput('未入力でも作成できます')
  const mediaSelect = el('select', {
    style: `width:100%;padding:10px 12px;border:1px solid #DDD;border-radius:4px;font-size:14px;font-family:${T.font}`,
  })
  if (mediaCache.length === 0) {
    throw new Error('媒体リストを取得できませんでした。npm run mock が動いているか確認してください。')
  }
  for (const m of mediaCache) {
    const o = el('option', { text: m.name })
    o.value = String(m.id)
    if (m.name === '媒体/ポストバックなし') o.selected = true
    mediaSelect.append(o)
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

async function rerender(): Promise<void> {
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
