/**
 * フォルダ操作メニュー（歯車アイコンから開くドロップダウン）。
 * FAQの機能: フォルダ名変更、フォルダ削除、レポートCSVダウンロード。
 */
import { api, type Folder } from '../api.ts'
import { T, el, toast } from '../ui.ts'

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

/** フォルダ操作メニューを表示する */
export function openFolderMenu(anchor: HTMLElement, folder: Folder): void {
  // 既に開いていたら閉じる
  closeMenu()

  const menu = el('div', {
    style: [
      'position:absolute;z-index:9999',
      `background:${T.surface};border-radius:8px`,
      'box-shadow:0 4px 16px rgba(0,0,0,.15)',
      'min-width:180px;padding:4px 0',
      `font-family:${T.font};font-size:13px`,
    ].join(';'),
  })

  const items: { label: string; action: () => void; danger?: boolean }[] = [
    {
      label: 'フォルダ名を変更',
      action: () => {
        closeMenu()
        openRenameDialog(folder)
      },
    },
    {
      label: 'フォルダを削除',
      danger: true,
      action: () => {
        closeMenu()
        confirmDeleteFolder(folder)
      },
    },
  ]

  for (const item of items) {
    const row = el('div', {
      text: item.label,
      style: [
        'padding:8px 16px;cursor:pointer;white-space:nowrap',
        `color:${item.danger === true ? '#E53E3E' : T.text}`,
      ].join(';'),
    })
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
    menu.append(row)
  }

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
    input.style.borderColor = '#0091FF'
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
    style: `padding:8px 16px;border:none;border-radius:6px;background:#0091FF;color:#FFF;cursor:pointer;font-size:13px;font-family:${T.font}`,
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
        // ページを再描画
        location.hash = location.hash
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
