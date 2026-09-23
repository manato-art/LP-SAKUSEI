/**
 * 「ノーコードで作る」の入口（2026-09-22・本人の依頼）。
 *
 * コードが書けない人でもWidgetを作れるようにする。今までの「＋ Widgetを作成」（HTML/CSSを書く画面）は
 * そのまま残し、これは新しい入口として横に置く（本人指定「今までの機能は残して、新機能として」）。
 *
 * 作り方ごとにタブを分ける。タブはこのファイルの TABS に足していく。
 *   型から作る   … 型を選ぶ→入力欄に書く→「LPに入れる」（template-tab.ts）
 *   部品を積んで作る … 見出し・文章・画像・ボタン・見本などを上から順に積む（templates/builder.ts）
 * 以前の「見本から作る」タブは消した（本人の依頼「Widgetの最初の画面と同じだからいらない」）。
 * 見本は「部品を積んで作る」の「見本」の部品として使う。
 */
import type Quill from 'quill'
import { T, el } from '../../ui.ts'
import { cancelSamplePick } from './nocode-flow.ts'
import { removeLibraryHint } from './library-hint.ts'
import { BUILDER_TAB, TEMPLATE_TAB } from './template-tab.ts'

export interface NocodeContext {
  libraryRoot: HTMLElement
  quill: Quill
  /** ライブラリごと閉じる（LPへ入れたあと） */
  closeLibrary: () => void
  /** この入口だけ閉じる（ライブラリは開いたまま） */
  closePanel: () => void
  /** この入口を一時的に隠す／戻す（見本の一覧から見本を選ぶ間。入力中の中身は残る） */
  hidePanel: () => void
  showPanel: () => void
  /** 別の作り方のタブを開く（型を選んだら「部品を積んで作る」へ渡す） */
  openTab: (id: string) => void
}

export interface NocodeTab {
  id: string
  label: string
  /** タブの中身を描く */
  render: (host: HTMLElement, ctx: NocodeContext) => void
}

/** 作り方のタブ（左から並ぶ順） */
const TABS: readonly NocodeTab[] = [TEMPLATE_TAB, BUILDER_TAB]

export function openNocodePanel(libraryRoot: HTMLElement, quill: Quill, closeLibrary: () => void, start?: { tabId: string }): void {
  libraryRoot.querySelector('[data-nocode-panel]')?.remove()
  // 見本を選んでいる途中で開き直した（前の受け取り口と案内は下ろす。残すと次の「追加」が消えた画面に渡される）
  cancelSamplePick()
  removeLibraryHint(libraryRoot)
  const panel = el('div', {
    style:
      `position:absolute;inset:0;z-index:10;background:${T.surface};display:flex;flex-direction:column;` +
      `font-family:${T.font};overflow:hidden`,
  })
  panel.setAttribute('data-nocode-panel', 'true')

  const closePanel = (): void => panel.remove()
  // タブの中身は下で組み立てる（openTab はそこで入れ替える）
  let openTab = (_id: string): void => undefined
  const ctx: NocodeContext = {
    libraryRoot,
    quill,
    closeLibrary,
    closePanel,
    openTab: (id) => openTab(id),
    hidePanel: () => {
      panel.style.display = 'none'
    },
    showPanel: () => {
      panel.style.display = 'flex'
    },
  }

  const close = el('button', {
    text: '閉じる',
    style: `border:none;background:none;color:${T.sub};font:14px ${T.font};cursor:pointer;padding:4px 8px`,
  })
  close.addEventListener('click', closePanel)
  const header = el('div', {
    style: `display:flex;align-items:center;gap:8px;padding:14px 20px;border-bottom:1px solid ${T.line};flex-shrink:0`,
  }, [
    close,
    el('h6', { text: 'ノーコードで作る', style: `flex:1;text-align:center;margin:0;font:600 15px/1.4 ${T.font};color:${T.text}` }),
    // 左右の釣り合いを取る空き（閉じると同じ幅）
    el('span', { style: 'width:52px' }),
  ])

  const tabBar = el('div', {
    style: `display:flex;gap:4px;padding:10px 20px 0;border-bottom:1px solid ${T.line};flex-shrink:0;overflow-x:auto`,
  })
  const body = el('div', { style: 'flex:1;min-height:0;overflow-y:auto;padding:20px' })
  body.setAttribute('data-nocode-body', 'true')

  const show = (tab: NocodeTab): void => {
    for (const b of tabBar.querySelectorAll<HTMLElement>('button')) {
      const on = b.dataset['tab'] === tab.id
      b.style.color = on ? T.primary : T.sub
      b.style.borderBottomColor = on ? T.primary : 'transparent'
      b.setAttribute('aria-selected', String(on))
    }
    body.replaceChildren()
    tab.render(body, ctx)
  }
  for (const tab of TABS) {
    const b = el('button', {
      text: tab.label,
      style:
        `border:0;border-bottom:2px solid transparent;background:transparent;padding:8px 14px;` +
        `font:600 13.5px ${T.font};cursor:pointer;white-space:nowrap;flex-shrink:0`,
    })
    b.dataset['tab'] = tab.id
    b.setAttribute('role', 'tab')
    b.addEventListener('click', () => show(tab))
    tabBar.append(b)
  }

  openTab = (id): void => {
    const tab = TABS.find((t) => t.id === id)
    if (tab !== undefined) show(tab)
  }

  panel.append(header, tabBar, body)
  const paper = libraryRoot.querySelector<HTMLElement>('.MuiDialog-paper')
  if (paper !== null) paper.style.position = 'relative'
  ;(paper ?? libraryRoot).append(panel)
  const first = TABS.find((tab) => tab.id === start?.tabId) ?? TABS[0]
  if (first !== undefined) show(first)
}
