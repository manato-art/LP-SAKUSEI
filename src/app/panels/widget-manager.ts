/**
 * Widget管理メニュー（右レール3番目・企画書 §9-1 / §11 capture-and-rehydrate）。
 *
 * **マークアップは書かない。** 5項目のメニューは土台
 * （`fragments/ab_tests__UID__articles__editor-target.html` = 実DOM）に最初から入っている:
 *   `_actionDropdown_1ti69_1 > _actionDropdownBody_1ti69_5 > _actionButton_1ti69_31 × 5`
 * ここではその実マークアップに開閉と挙動だけを付ける。
 *
 * 実装したのは `HTML編集` / `すぐ下に複製` / `Versionから削除する` の3つ。
 * `クイック編集` と `widgetコピー` は**未実装**で、押すとそう表示する
 * （できているように見せない。企画書 §3-5）。
 *
 * 「widget」の単位: 実物のLPは Quill で編集されている（findings-live-observation.md）ので、
 * クローンでは**カーソルがある行ブロック**（Quill の block blot）を1 widget として扱う。
 */
import type Quill from 'quill'
import { modal, toast } from '../ui.ts'

/** 実DOMの目印 */
const HOOK = {
  /** 右レール3番目のボタン（実DOMは aria-label で識別できる） */
  trigger: '[aria-label="Widget管理"]',
  icon: '[class*="sideToolbarIcon"]',
  dropdownBody: '[class*="actionDropdownBody"]',
  actionButton: '[class*="actionButton"]',
  arrow: '[class*="_arrow_"]',
} as const

/** 採取したCSSモジュールのクラス名（実CSS: `._actionDropdownBody_1ti69_5._open_1ti69_52{display:block}`） */
const OPEN_CLASS = '_open_1ti69_52'

/**
 * メニューを開く位置。
 * **実物の開いた状態は採取できていない**ので、右レール（x=995..1045 / layout.json）から
 * 200px幅のメニューが画面外に出ない唯一の向き＝左側に出す。
 * 実物も他のドロップダウンでは inline style で位置を決めている（変更・復元履歴が `right: 30px`）。
 */
const OPEN_STYLE = 'top: 50%; right: 40px; transform: translateY(-50%);'
const ARROW_STYLE = 'left: auto; right: -1px; transform: rotate(135deg);'

/** メニュー項目のラベル（実DOM verbatim。並び順もこのとおり） */
export const WIDGET_MENU_LABELS: readonly string[] = [
  'HTML編集',
  'クイック編集',
  'すぐ下に複製',
  'widgetコピー',
  'Versionから削除する',
]

/** 未実装のまま残す項目（押したら「未実装」と分かる表示にする） */
const NOT_IMPLEMENTED: readonly string[] = ['クイック編集', 'widgetコピー']

/** いま編集対象になっている widget（＝Quill の行ブロック） */
export interface WidgetTarget {
  readonly html: string
  readonly index: number
  readonly length: number
}

export function mountWidgetManager(root: HTMLElement, quill: Quill): void {
  const trigger = root.querySelector<HTMLElement>(HOOK.trigger)
  const icon = trigger?.closest<HTMLElement>(HOOK.icon) ?? null
  const body = icon?.querySelector<HTMLElement>(HOOK.dropdownBody) ?? null
  if (trigger === null || icon === null || body === null) {
    console.warn('[widget-manager] 土台に Widget管理 のメニューが見つからないので配線しない')
    return
  }
  if (body.dataset['sbWidgetManager'] === 'mounted') return
  body.dataset['sbWidgetManager'] = 'mounted'

  // 右レールのボタンを押すとエディタからフォーカスが外れるので、最後の位置を覚えておく
  let lastRange: { index: number; length: number } | null = quill.getSelection()
  quill.on('selection-change', (range) => {
    if (range !== null) lastRange = { index: range.index, length: range.length }
  })

  const arrow = body.querySelector<HTMLElement>(HOOK.arrow)
  const isOpen = (): boolean => body.classList.contains(OPEN_CLASS)
  const close = (): void => {
    body.classList.remove(OPEN_CLASS)
    body.removeAttribute('style')
    arrow?.removeAttribute('style')
  }
  const open = (): void => {
    body.classList.add(OPEN_CLASS)
    body.setAttribute('style', OPEN_STYLE)
    arrow?.setAttribute('style', ARROW_STYLE)
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation()
    if (isOpen()) close()
    else open()
  })
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    if (target !== null && icon.contains(target)) return
    close()
  })

  const target = (): WidgetTarget | null => currentWidget(quill, lastRange)

  for (const button of body.querySelectorAll<HTMLElement>(HOOK.actionButton)) {
    const label = (button.textContent ?? '').trim()
    button.addEventListener('click', () => {
      close()
      if (NOT_IMPLEMENTED.includes(label)) {
        toast(`${label} は未実装です`, 'error')
        return
      }
      const widget = target()
      if (widget === null) {
        toast('対象のwidgetがありません。編集エリアにカーソルを置いてください', 'error')
        return
      }
      runAction(label, widget, quill)
    })
  }
}

/**
 * カーソル位置の行ブロックを widget として取り出す。
 * `length` は Quill の行長（末尾の改行を含む）なので、そのまま削除・置換に使える。
 */
export function currentWidget(quill: Quill, fallback: { index: number; length: number } | null): WidgetTarget | null {
  const range = quill.getSelection() ?? fallback
  if (range === null) return null
  const [line] = quill.getLine(range.index)
  if (line === null) return null
  const element = line.domNode as HTMLElement
  return { html: element.outerHTML, index: quill.getIndex(line), length: line.length() }
}

function runAction(label: string, widget: WidgetTarget, quill: Quill): void {
  if (label === 'HTML編集') {
    openHtmlEditor(widget, quill)
    return
  }
  if (label === 'すぐ下に複製') {
    quill.clipboard.dangerouslyPasteHTML(widget.index + widget.length, widget.html, 'user')
    quill.setSelection(widget.index + widget.length, 0, 'silent')
    toast('すぐ下に複製しました')
    return
  }
  if (label === 'Versionから削除する') {
    quill.deleteText(widget.index, widget.length, 'user')
    quill.setSelection(widget.index, 0, 'silent')
    toast('Versionから削除しました（元に戻すで戻せます）')
    return
  }
  toast(`${label} は未実装です`, 'error')
}

/** HTML編集: 選択中ブロックのHTMLをそのまま編集して差し替える */
function openHtmlEditor(widget: WidgetTarget, quill: Quill): void {
  const area = document.createElement('textarea')
  area.value = widget.html
  area.spellcheck = false
  area.style.cssText = `width:100%;min-height:320px;box-sizing:border-box;padding:12px;
    border:1px solid #DDD;border-radius:4px;font-family:monospace;font-size:12px;line-height:1.7;resize:vertical`

  modal(
    'HTML編集',
    area,
    () => {
      const html = area.value.trim()
      if (html === '') throw new Error('HTMLが空です')
      quill.deleteText(widget.index, widget.length, 'user')
      quill.clipboard.dangerouslyPasteHTML(widget.index, html, 'user')
      toast('HTMLを更新しました')
    },
    '適用する',
  )
}
