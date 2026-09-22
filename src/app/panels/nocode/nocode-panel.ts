/**
 * 「ノーコードで作る」の入口（2026-09-22・本人の依頼）。
 *
 * コードが書けない人でもWidgetを作れるようにする。今までの「＋ Widgetを作成」（HTML/CSSを書く画面）は
 * そのまま残し、これは新しい入口として横に置く（本人指定「今までの機能は残して、新機能として」）。
 *
 * 作り方ごとにタブを分ける。タブはこのファイルの TABS に足していく。
 *   見本から作る … 見本を選ぶ→編集画面で文字・色・画像を変える→「Widgetとして登録」
 *   型から作る   … 型を選ぶ→入力欄に書く→「LPに入れる」（template-tab.ts）
 */
import type Quill from 'quill'
import { T, el } from '../../ui.ts'
import { armEditAfterInsert, disarmEditAfterInsert } from './nocode-flow.ts'
import { TEMPLATE_TAB } from './template-tab.ts'

export interface NocodeContext {
  libraryRoot: HTMLElement
  quill: Quill
  /** ライブラリごと閉じる（LPへ入れたあと） */
  closeLibrary: () => void
  /** この入口だけ閉じる（ライブラリは開いたまま） */
  closePanel: () => void
}

export interface NocodeTab {
  id: string
  label: string
  /** タブの中身を描く */
  render: (host: HTMLElement, ctx: NocodeContext) => void
}

const HINT_ATTR = 'data-nocode-hint'

/**
 * ライブラリの下の方に「見本を選んで『追加』を押すと…」を浮かせて出す（取り消せる）。
 *
 * 一覧は「左にカテゴリー｜右にカード」の横並びなので、間に差し込むと3列目になって崩れる
 * （2026-09-22 実測）。並びの外に浮かせる。カテゴリーを切り替えてもカードの中身だけが
 * 入れ替わるので、ここに置けば消えない。
 */
function showSampleHint(libraryRoot: HTMLElement): void {
  libraryRoot.querySelector(`[${HINT_ATTR}]`)?.remove()
  const paper = libraryRoot.querySelector<HTMLElement>('.MuiDialog-paper') ?? libraryRoot
  paper.style.position = 'relative'
  const hint = el('div', {
    style:
      `position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:5;` +
      `display:flex;align-items:center;gap:14px;max-width:calc(100% - 32px);box-sizing:border-box;` +
      `padding:10px 16px;border-radius:999px;background:${T.text};color:${T.surface};` +
      `box-shadow:0 6px 24px rgba(0,0,0,.18);font:13px/1.6 ${T.font}`,
  })
  hint.setAttribute(HINT_ATTR, 'true')
  hint.setAttribute('role', 'status')
  const text = el('span', {
    text: '見本を選んで「追加」を押すと、そのまま編集画面が開きます',
    style: 'min-width:0',
  })
  const cancel = el('button', {
    text: 'やめる',
    style: `flex-shrink:0;border:0;background:transparent;color:inherit;opacity:.75;font:600 12px ${T.font};cursor:pointer;padding:4px 0;text-decoration:underline`,
  })
  cancel.addEventListener('click', () => {
    disarmEditAfterInsert()
    hint.remove()
  })
  hint.append(text, cancel)
  paper.append(hint)
}

/** 並びに意味がある手順（1→2→3の順にやる）ので番号を付ける */
function stepList(steps: readonly { title: string; note: string }[]): HTMLElement {
  const list = el('ol', { style: 'list-style:none;margin:16px 0 0;padding:0;display:flex;flex-direction:column;gap:14px' })
  steps.forEach((step, i) => {
    list.append(
      el('li', { style: 'display:flex;gap:12px;align-items:flex-start' }, [
        el('span', {
          text: String(i + 1),
          style:
            `flex:0 0 26px;height:26px;border-radius:50%;background:${T.primary};color:${T.primaryInk};` +
            `display:flex;align-items:center;justify-content:center;font:700 13px ${T.font}`,
        }),
        el('span', { style: 'min-width:0' }, [
          el('span', { text: step.title, style: `display:block;font:600 14px/1.6 ${T.font};color:${T.text}` }),
          el('span', { text: step.note, style: `display:block;font:12.5px/1.8 ${T.font};color:${T.sub}` }),
        ]),
      ]),
    )
  })
  return list
}

/** ① 見本から作る */
const SAMPLE_TAB: NocodeTab = {
  id: 'sample',
  label: '見本から作る',
  render: (host, ctx) => {
    const start = el('button', {
      text: '見本を選ぶ',
      style:
        `margin-top:22px;border:0;border-radius:6px;padding:10px 22px;cursor:pointer;` +
        `background:${T.primary};color:${T.primaryInk};font:600 14px ${T.font}`,
    })
    start.addEventListener('click', () => {
      armEditAfterInsert()
      ctx.closePanel()
      showSampleHint(ctx.libraryRoot)
    })
    host.append(
      el('p', {
        text: 'いちばん近い見本を選んで、文字や色を変えるだけで作れます。コードは出てきません。',
        style: `margin:0;font:14px/1.8 ${T.font};color:${T.text}`,
      }),
      stepList([
        { title: '見本を選んで「追加」を押す', note: 'LPに入ったうえで、そのまま編集画面が開きます。' },
        {
          title: '文字・色・画像・リンクを変える',
          note: '左の画面で文字を直接書き換え、右のカードで色や大きさを変えます。よくある質問や口コミのように並んでいる所は、マウスを乗せると右上に出る「複製・上へ・下へ・消す」で数や順番を変えられます。',
        },
        {
          title: '「Widgetとして登録」を押す',
          note: '「作成したWidget」に入り、次からは一覧から選ぶだけで使い回せます。',
        },
      ]),
      start,
    )
  },
}

/** 作り方のタブ（左から並ぶ順） */
const TABS: readonly NocodeTab[] = [SAMPLE_TAB, TEMPLATE_TAB]

export function openNocodePanel(libraryRoot: HTMLElement, quill: Quill, closeLibrary: () => void): void {
  libraryRoot.querySelector('[data-nocode-panel]')?.remove()
  const panel = el('div', {
    style:
      `position:absolute;inset:0;z-index:10;background:${T.surface};display:flex;flex-direction:column;` +
      `font-family:${T.font};overflow:hidden`,
  })
  panel.setAttribute('data-nocode-panel', 'true')

  const closePanel = (): void => panel.remove()
  const ctx: NocodeContext = { libraryRoot, quill, closeLibrary, closePanel }

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

  panel.append(header, tabBar, body)
  const paper = libraryRoot.querySelector<HTMLElement>('.MuiDialog-paper')
  if (paper !== null) paper.style.position = 'relative'
  ;(paper ?? libraryRoot).append(panel)
  const first = TABS[0]
  if (first !== undefined) show(first)
}
