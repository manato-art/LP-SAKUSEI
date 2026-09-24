/**
 * レポート一覧の行末「⋮」（2026-09-24・点検19）。
 *
 * 以前はボタンだけあって何も起きなかった（title「この行の操作（未実装）」）。
 * 新しい操作は作らず、ほかの画面にすでにある操作への近道だけを並べる:
 *   このVersionだけで絞る … 上の「Version」の絞り込みと同じ
 *   ヒートマップを見る   … レポートの「ヒートマップ」タブ
 *   プレビューを開く     … エディタの「プレビュー」と同じ URL（/preview/<Version>）
 *   エディタを開く       … ページのエディタ（特定の Version を指して開く口はまだ無いので、ページを開く）
 * 見た目は列のチップの「並び替え」と同じ部品（.rv2-sortmenu）を使う。
 */

export interface RowMenuDeps {
  abTestUid: string
  versionUid: string
  /** このVersionだけで絞る（上の「Version」の絞り込みを変える） */
  onPickVersion?: (versionUid: string) => void
}

/** 開いているメニューを閉じる（1つだけ開く・外を押したら閉じる） */
function closeAll(): void {
  for (const open of document.querySelectorAll('.rv2-rowmenu-wrap.open')) open.classList.remove('open')
}

let isOutsideCloseWired = false

function wireOutsideClose(): void {
  if (isOutsideCloseWired) return
  isOutsideCloseWired = true
  document.addEventListener('click', closeAll)
  document.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Escape') closeAll()
  })
}

function linkItem(label: string, href: string, newTab = false): HTMLAnchorElement {
  const a = document.createElement('a')
  a.className = 'rv2-sortmenu-item'
  a.textContent = label
  a.href = href
  a.style.textDecoration = 'none'
  if (newTab) {
    a.target = '_blank'
    a.rel = 'noopener'
  }
  return a
}

export function buildRowMenu(deps: RowMenuDeps): HTMLElement {
  wireOutsideClose()
  const wrap = document.createElement('div')
  wrap.className = 'rv2-rowmenu-wrap'
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'rv2-rowmenu'
  button.textContent = '⋮'
  button.title = 'この行の操作'
  button.setAttribute('aria-haspopup', 'menu')

  const menu = document.createElement('div')
  menu.className = 'rv2-sortmenu'
  menu.setAttribute('role', 'menu')
  const pick = document.createElement('button')
  pick.type = 'button'
  pick.className = 'rv2-sortmenu-item'
  pick.textContent = 'このVersionだけで絞る'
  pick.addEventListener('click', () => {
    closeAll()
    deps.onPickVersion?.(deps.versionUid)
  })
  const base = `#/ab_tests/${encodeURIComponent(deps.abTestUid)}`
  menu.append(
    ...(deps.onPickVersion === undefined ? [] : [pick]),
    linkItem('ヒートマップを見る', `${base}/articles/htmls/heatmaps/comparisons`),
    linkItem('プレビューを開く（新しいタブ）', `${location.origin}/preview/${encodeURIComponent(deps.versionUid)}`, true),
    linkItem('エディタを開く', `${base}/articles`),
  )
  for (const item of menu.querySelectorAll('a')) item.addEventListener('click', closeAll)

  button.addEventListener('click', (event) => {
    event.stopPropagation()
    const willOpen = !wrap.classList.contains('open')
    closeAll()
    wrap.classList.toggle('open', willOpen)
  })
  // メニューの中を押しても、外側を閉じる処理に拾わせない
  menu.addEventListener('click', (event) => event.stopPropagation())
  wrap.append(button, menu)
  return wrap
}
