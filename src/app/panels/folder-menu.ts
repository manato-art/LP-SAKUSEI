/**
 * フォルダ操作メニュー（歯車アイコンから開くドロップダウン）。
 * 実物の構成: ヘッダー（フォルダ名 設定）/ お気に入りトグル / フォルダを作成 / 名称変更 / グループを削除。
 */
import { api, type DomainEntry, type Folder } from '../api.ts'
import { T, el, toast } from '../ui.ts'
import { openCreateFolder } from '../pages/folders-create.ts'
import { chooseCard } from '../dialog.ts'

let currentMenu: HTMLElement | null = null

/** 開いているメニューを閉じる */
function closeMenu(): void {
  currentMenu?.remove()
  currentMenu = null
  document.removeEventListener('click', onDocumentClick)
}

function onDocumentClick(): void {
  closeMenu()
}

/** ゴミ箱SVGアイコン（実物に合わせたオレンジ色） */
const TRASH_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>'

/** フォルダ操作メニューを表示する */
export function openFolderMenu(anchor: HTMLElement, folder: Folder): void {
  // 既に開いていたら閉じる
  closeMenu()

  const menu = el('div', {
    style: [
      'position:absolute;z-index:9999',
      `background:${T.surface};border-radius:8px`,
      'box-shadow:0 4px 16px rgba(0,0,0,.15)',
      'min-width:200px;padding:0',
      `font-family:${T.font};font-size:13px`,
    ].join(';'),
  })

  // ── ヘッダー: 「フォルダ名 設定」 ──
  const header = el('div', {
    text: `${folder.name} 設定`,
    style: [
      `padding:14px 16px;text-align:center;font-weight:600;color:${T.text}`,
      'border-bottom:1px solid #F0F0F0;font-size:14px',
    ].join(';'),
  })
  menu.append(header)

  // ── メニュー項目 ──
  const itemContainer = el('div', { style: 'padding:4px 0' })

  interface MenuItem { label: string; action: () => void; danger?: boolean; icon?: string }
  const items: MenuItem[] = [
    {
      label: folder.is_favorite ? 'お気に入りから除外' : 'お気に入りに追加',
      action: () => {
        closeMenu()
        void api.toggleFavorite(folder.uid, !folder.is_favorite).then(
          () => {
            toast(folder.is_favorite ? 'お気に入りから除外しました' : 'お気に入りに追加しました')
            dispatchEvent(new HashChangeEvent('hashchange'))
          },
          () => toast('お気に入りの切り替えに失敗しました', 'error'),
        )
      },
    },
    {
      label: 'フォルダを作成',
      action: () => {
        closeMenu()
        openCreateFolder()
      },
    },
    {
      label: '名称変更',
      action: () => {
        closeMenu()
        openRenameDialog(folder)
      },
    },
    {
      label: 'ドメイン変更',
      action: () => {
        closeMenu()
        void openDomainDialog(folder)
      },
    },
    {
      label: 'グループを削除',
      danger: true,
      icon: TRASH_ICON,
      action: () => {
        closeMenu()
        confirmDeleteFolder(folder)
      },
    },
  ]

  for (const item of items) {
    const row = el('div', {
      style: [
        'padding:10px 16px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;justify-content:space-between',
        `color:${item.danger === true ? '#E53E3E' : T.text}`,
      ].join(';'),
    })
    const label = el('span', { text: item.label })
    row.append(label)
    if (item.icon !== undefined) {
      const iconEl = el('span', { style: 'display:flex;align-items:center;margin-left:12px' })
      iconEl.innerHTML = item.icon
      row.append(iconEl)
    }
    row.addEventListener('mouseenter', () => {
      row.style.background = 'rgba(0,0,0,.04)'
    })
    row.addEventListener('mouseleave', () => {
      row.style.background = 'transparent'
    })
    row.addEventListener('click', (e) => {
      e.stopPropagation()
      item.action()
    })
    itemContainer.append(row)
  }

  menu.append(itemContainer)

  // 位置をアンカー要素の下に
  const rect = anchor.getBoundingClientRect()
  menu.style.top = `${rect.bottom + 4}px`
  menu.style.left = `${rect.left}px`
  menu.style.position = 'fixed'
  document.body.append(menu)
  currentMenu = menu

  // 1フレーム遅延してドキュメントクリックで閉じるリスナーを張る（今のクリックイベントが伝播して即閉じるのを防ぐ）
  requestAnimationFrame(() => {
    document.addEventListener('click', onDocumentClick)
  })
}

/** フォルダ名変更ダイアログ */
/**
 * フォルダのドメインを選ぶ（実物の「フォルダの設定＞ドメイン変更」にあたる・2026-09-13）。
 * 配信URLはここで選んだドメインで出る。未設定にすると、実物と同じく配信URLを出さない。
 */
const ISSUE_QUICK_DOMAIN = '\u0000issue-quick-domain'

async function openDomainDialog(folder: Folder): Promise<void> {
  const [registered, quick] = await Promise.all([
    api.domains().catch(() => ({ domains: [] as DomainEntry[] })),
    api.quickDomain().catch(() => ({ quick_domain: { base: '' } })),
  ])
  const current = folder.domain ?? ''
  const base = quick.quick_domain.base
  // 自動発行したドメインは、下の「クイックドメインを発行」から作るので選択肢には並べない
  const selectable = registered.domains.filter((entry) => entry.kind !== 'quick' || entry.host === current)
  const picked = await chooseCard({
    title: 'ドメイン変更',
    message: '配信URLに使うドメインを選びます。',
    value: current,
    options: [
      {
        value: ISSUE_QUICK_DOMAIN,
        label: 'クイックドメインを発行',
        hint:
          base === ''
            ? 'まだ使えません。先に配信用のドメインを取得し、ドメイン画面で土台ドメインを設定してください'
            : `<ランダム>.${base} をこのフォルダ専用に作ります`,
      },
      {
        value: 'system',
        label: 'このシステムのドメイン',
        hint: `${location.host}／設定してすぐ配信できます`,
      },
      ...selectable.map((entry) => ({
        value: entry.host,
        label: entry.host,
        hint: entry.kind === 'quick' ? 'クイックドメイン' : 'このドメインをこのシステムへ向けるまでは開けません',
      })),
      { value: '', label: '未設定にする', hint: '配信URLを出しません（実物と同じ）' },
    ],
  })
  if (picked === null) return
  if (picked === ISSUE_QUICK_DOMAIN) {
    await issueQuickDomain(folder)
    return
  }
  if (picked === current) return
  try {
    await api.setFolderDomain(folder.uid, picked)
    toast(picked === '' ? 'ドメインを未設定にしました' : 'ドメインを変更しました')
    // 一覧と詳細を描き直す（配信URLの表示がドメインで変わる）
    dispatchEvent(new HashChangeEvent('hashchange'))
  } catch (error) {
    toast(`変更に失敗しました: ${(error as Error).message}`, 'error')
  }
}

/** クイックドメインを1本作って、このフォルダの配信ドメインにする */
async function issueQuickDomain(folder: Folder): Promise<void> {
  try {
    const issued = await api.issueQuickDomain(folder.uid)
    toast(`クイックドメイン ${issued.folder.domain ?? ''} を発行しました`)
    dispatchEvent(new HashChangeEvent('hashchange'))
  } catch (error) {
    toast(`発行できませんでした: ${(error as Error).message}`, 'error')
  }
}

function openRenameDialog(folder: Folder): void {
  const overlay = el('div', {
    style: 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:10000;display:flex;align-items:center;justify-content:center',
  })

  const dialog = el('div', {
    style: `background:${T.surface};border-radius:12px;padding:24px;min-width:360px;max-width:90vw;font-family:${T.font}`,
  })

  const title = el('div', {
    text: 'フォルダ名を変更',
    style: `font-size:16px;font-weight:700;color:${T.text};margin-bottom:16px`,
  })

  const input = document.createElement('input')
  input.type = 'text'
  input.value = folder.name
  input.style.cssText = `width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #DDD;border-radius:6px;font-size:14px;font-family:${T.font};outline:none`
  input.addEventListener('focus', () => {
    input.style.borderColor = 'var(--sb-accent, #0091FF)'
  })
  input.addEventListener('blur', () => {
    input.style.borderColor = '#DDD'
  })

  const buttons = el('div', {
    style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px',
  })

  const cancelBtn = el('button', {
    text: 'キャンセル',
    style: `padding:8px 16px;border:1px solid #DDD;border-radius:6px;background:${T.surface};cursor:pointer;font-size:13px;font-family:${T.font}`,
  })
  cancelBtn.addEventListener('click', () => overlay.remove())

  const saveBtn = el('button', {
    text: '保存',
    style: `padding:8px 16px;border:none;border-radius:6px;background:var(--sb-accent, #0091FF);color:#FFF;cursor:pointer;font-size:13px;font-family:${T.font}`,
  })
  saveBtn.addEventListener('click', () => {
    const newName = input.value.trim()
    if (newName === '') {
      toast('フォルダ名を入力してください', 'error')
      return
    }
    if (newName === folder.name) {
      overlay.remove()
      return
    }
    saveBtn.textContent = '保存中...'
    saveBtn.setAttribute('disabled', '')
    void api.renameFolder(folder.uid, newName).then(
      () => {
        overlay.remove()
        toast('フォルダ名を変更しました')
        // ページを再描画（hashchangeを強制発火させる）
        dispatchEvent(new HashChangeEvent('hashchange'))
      },
      (err: Error) => {
        saveBtn.textContent = '保存'
        saveBtn.removeAttribute('disabled')
        toast(`変更に失敗しました: ${err.message}`, 'error')
      },
    )
  })

  // Enter で保存
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault()
      saveBtn.click()
    }
  })

  buttons.append(cancelBtn, saveBtn)
  dialog.append(title, input, buttons)
  overlay.append(dialog)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
  document.body.append(overlay)

  // フォーカスして全選択
  requestAnimationFrame(() => {
    input.focus()
    input.select()
  })
}

/** フォルダ削除確認 */
function confirmDeleteFolder(folder: Folder): void {
  const overlay = el('div', {
    style: 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:10000;display:flex;align-items:center;justify-content:center',
  })

  const dialog = el('div', {
    style: `background:${T.surface};border-radius:12px;padding:24px;min-width:360px;max-width:90vw;font-family:${T.font}`,
  })

  const title = el('div', {
    text: 'フォルダを削除',
    style: `font-size:16px;font-weight:700;color:${T.text};margin-bottom:8px`,
  })

  const desc = el('div', {
    text: `「${folder.name}」を削除しますか？フォルダ内のbeyondページも削除されます。この操作は取り消せません。`,
    style: `font-size:13px;color:${T.sub};line-height:1.7;margin-bottom:16px`,
  })

  const buttons = el('div', {
    style: 'display:flex;gap:8px;justify-content:flex-end',
  })

  const cancelBtn = el('button', {
    text: 'キャンセル',
    style: `padding:8px 16px;border:1px solid #DDD;border-radius:6px;background:${T.surface};cursor:pointer;font-size:13px;font-family:${T.font}`,
  })
  cancelBtn.addEventListener('click', () => overlay.remove())

  const deleteBtn = el('button', {
    text: '削除する',
    style: 'padding:8px 16px;border:none;border-radius:6px;background:#E53E3E;color:#FFF;cursor:pointer;font-size:13px',
  })
  deleteBtn.addEventListener('click', () => {
    deleteBtn.textContent = '削除中...'
    deleteBtn.setAttribute('disabled', '')
    void api.deleteFolder(folder.uid).then(
      () => {
        overlay.remove()
        toast('フォルダを削除しました')
        location.hash = '/folders'
      },
      (err: Error) => {
        deleteBtn.textContent = '削除する'
        deleteBtn.removeAttribute('disabled')
        toast(`削除に失敗しました: ${err.message}`, 'error')
      },
    )
  })

  buttons.append(cancelBtn, deleteBtn)
  dialog.append(title, desc, buttons)
  overlay.append(dialog)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
  document.body.append(overlay)
}
