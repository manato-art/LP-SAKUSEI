/**
 * ライト／ダークの切り替え（2026-09-13・本人指示「ダークモードの実装。デフォルトはライト」）。
 *
 * 既定はライト＝今までと同じ見た目。ダークのときだけ `html[data-theme="dark"]` を付け、
 * 採取した実物CSSに対する上書き（`/clean/_merged/dark.css`・自動生成）をその場で読み込む。
 * ライトのままなら上書きCSSは1バイトも読まない。
 *
 * 保存はテーマカラーと同じ2段構え:
 *   localStorage … 起動直後に同期で当てて、ライトの画面が一瞬見えるのを防ぐ
 *   サーバー     … アカウントに紐づけて、別のブラウザでも同じ見た目にする
 */

import { startRuntimeDarkCss, stopRuntimeDarkCss } from './dark-runtime-css.ts'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'sb-theme-mode'
/** 自動生成した上書きCSS（npm run dark-css） */
const DARK_CSS_HREF = '/clean/_merged/dark.css'
const DARK_CSS_ID = 'sb-dark-css'

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

/** ブラウザに覚えているモード（無ければライト） */
export function storedMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return isThemeMode(saved) ? saved : 'light'
  } catch {
    // プライベートモード等で localStorage が使えなくても画面は出す
    return 'light'
  }
}

function remember(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* 覚えられなくても、その場の見た目は変わっている */
  }
}

/** ダーク用の上書きCSSを1回だけ差し込む（ライトのままなら読み込まない） */
function ensureDarkStylesheet(): void {
  if (document.getElementById(DARK_CSS_ID) !== null) return
  const link = document.createElement('link')
  link.id = DARK_CSS_ID
  link.rel = 'stylesheet'
  link.href = DARK_CSS_HREF
  document.head.append(link)
}

/** そのモードを画面に当てる */
export function applyMode(mode: ThemeMode): void {
  if (mode === 'dark') {
    ensureDarkStylesheet()
    document.documentElement.dataset['theme'] = 'dark'
    // 画面が実行時に注入する `<style>`（エディタ・パネル）も暗くする
    startRuntimeDarkCss()
  } else {
    delete document.documentElement.dataset['theme']
    stopRuntimeDarkCss()
  }
}

/**
 * 起動時に呼ぶ。覚えているモードを先に当ててから、サーバーの値に合わせ直す。
 * 先に当てるのは、ライトの画面が一瞬見えてから暗くなるのを防ぐため。
 */
export function initThemeMode(fetchFromServer: () => Promise<ThemeMode | null>): void {
  applyMode(storedMode())
  void fetchFromServer().then(
    (serverValue) => {
      if (serverValue === null) return
      applyMode(serverValue)
      remember(serverValue)
    },
    () => {
      /* 取れなければ覚えているモードのまま */
    },
  )
}

/** 画面から切り替えたとき */
export function setThemeMode(mode: ThemeMode, save: (mode: ThemeMode) => Promise<unknown>): Promise<unknown> {
  applyMode(mode)
  remember(mode)
  return save(mode)
}
