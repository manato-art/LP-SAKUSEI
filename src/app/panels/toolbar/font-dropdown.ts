/**
 * 共通のカスタム・フォント選択ドロップダウン。
 *
 * なぜカスタムか: ネイティブ <select> は macOS で option ごとの font-family を描画しないため、
 * 「日本語のフォント名を、そのフォントで表示（＝名前とプレビューを兼ねる）」ができない。
 * そこで <button>（トリガー）＋ body 直下に position:fixed のメニューを出す方式にする。
 *
 * 各サーフェス（プロパティ/スタイル・コンテンツツールバー・サイドバーツールバー）で共通利用する。
 * onSelect には実フォント名（例 'Noto Sans JP'）を渡す。表示は日本語ラベル（fontLabelJa）。
 */
import { TOOLBAR_FONT_FAMILIES, cssFontFamilyValue, fontLabelJa } from './text-format.ts'

export type FontDropdown = {
  /** DOM に挿入するトリガーボタン */
  readonly el: HTMLButtonElement
  /** 現在のフォントを反映（トリガー表示を更新）。空文字/'serif' でプレースホルダ表示。 */
  readonly setValue: (font: string) => void
}

export type FontDropdownOptions = {
  /** 選択時に実フォント名を受け取るコールバック */
  readonly onSelect: (font: string) => void
  /** トリガーに付与するクラス（各サーフェスの既存 select スタイルに合わせる） */
  readonly triggerClassName?: string
  /** 未選択時のプレースホルダ表示（既定: 'フォント'） */
  readonly placeholder?: string
}

const MENU_ATTR = 'data-sb-font-menu'

function closeMenu(): void {
  document.querySelector(`[${MENU_ATTR}]`)?.remove()
}

export function makeFontDropdown(opts: FontDropdownOptions): FontDropdown {
  const { onSelect, triggerClassName, placeholder = 'フォント' } = opts

  const trigger = document.createElement('button')
  trigger.type = 'button'
  if (triggerClassName !== undefined && triggerClassName !== '') trigger.className = triggerClassName
  // 既存 select クラスに無い最低限の見た目だけを補う（クラス側の指定は上書きしない）
  trigger.style.display = 'flex'
  trigger.style.alignItems = 'center'
  trigger.style.justifyContent = 'space-between'
  trigger.style.gap = '6px'
  trigger.style.textAlign = 'left'
  trigger.style.cursor = 'pointer'

  const labelSpan = document.createElement('span')
  labelSpan.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0'
  const caret = document.createElement('span')
  caret.textContent = '▾'
  caret.style.cssText = 'flex-shrink:0;color:#999999;font-size:9px;line-height:1'
  trigger.append(labelSpan, caret)

  let current = ''
  const setValue = (font: string): void => {
    const key = font.replace(/^["']|["']$/g, '')
    current = key
    if (key === '' || key === 'serif') {
      labelSpan.textContent = placeholder
      labelSpan.style.fontFamily = 'inherit'
    } else {
      labelSpan.textContent = fontLabelJa(key)
      labelSpan.style.fontFamily = cssFontFamilyValue(key)
    }
  }
  setValue('')

  // 選択（Quill のレンジ等）を失わないよう、トリガーのフォーカス移動を抑止する
  trigger.addEventListener('mousedown', (e) => e.preventDefault())
  trigger.addEventListener('click', () => {
    if (document.querySelector(`[${MENU_ATTR}]`) !== null) {
      closeMenu()
      return
    }
    const menu = document.createElement('div')
    menu.setAttribute(MENU_ATTR, 'true')
    menu.style.cssText =
      'position:fixed;z-index:9600;background:var(--sb-c-ffffff, #FFFFFF);border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:8px;' +
      'box-shadow:0 6px 22px rgba(0,0,0,.18);padding:4px;max-height:60vh;overflow:auto;min-width:180px'
    for (const font of TOOLBAR_FONT_FAMILIES) {
      const item = document.createElement('div')
      item.textContent = fontLabelJa(font)
      const active = font === current
      item.style.cssText =
        `padding:8px 12px;border-radius:6px;cursor:pointer;white-space:nowrap;color:var(--sb-c-222222, #222222);` +
        `font-family:${cssFontFamilyValue(font)};font-size:16px;line-height:1.3;` +
        `background:${active ? '#eaf4ff' : 'transparent'}`
      item.addEventListener('mouseenter', () => {
        item.style.background = '#f0f4ff'
      })
      item.addEventListener('mouseleave', () => {
        item.style.background = active ? '#eaf4ff' : 'transparent'
      })
      item.addEventListener('mousedown', (e) => e.preventDefault()) // 選択保持
      item.addEventListener('click', () => {
        setValue(font)
        onSelect(font)
        closeMenu()
      })
      menu.append(item)
    }
    document.body.append(menu)

    // トリガー直下に配置。画面下に収まらなければ上に出す。
    const r = trigger.getBoundingClientRect()
    menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8))}px`
    const below = r.bottom + 4
    menu.style.top =
      below + menu.offsetHeight > window.innerHeight - 8
        ? `${Math.max(8, r.top - menu.offsetHeight - 4)}px`
        : `${below}px`

    const onOutside = (ev: MouseEvent): void => {
      if (!menu.contains(ev.target as Node) && ev.target !== trigger) {
        closeMenu()
        document.removeEventListener('mousedown', onOutside, true)
      }
    }
    setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0)
  })

  return { el: trigger, setValue }
}
