/**
 * レポート／ヒートマップ画面で共通に使うDOM配線。
 *
 * 見た目は採取した実マークアップ＋実CSSがそのまま担保する（企画書 §11）。
 * ここは「土台を差し込む」「リンクをクローンのルートに向ける」「テーマを切り替える」だけ。
 * CSSは書き足さない（採取済みの `capture/clean/<slug>/<state>/cssom.css` を読み込むだけ）。
 */
import { T, el } from '../ui.ts'
import { overrideDarkBackgrounds } from '../white-base.ts'
import { extractCapturedAbTestUid, stripShellFromFragment, toHashHref } from './report-substrate.ts'
import { buildThemeSwap, extractThemeTokens, swapClassName, type ThemeSwap } from './report-theme.ts'

/**
 * 採取したページ断片を差し込む。断片はページ全体（サイドバー込み）なので、
 * `shell.ts` が描いているサイドバーは落として本体だけを使う。
 */
export function mountCapturedPage(container: HTMLElement, fragmentHtml: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = stripShellFromFragment(fragmentHtml)
  container.append(root)
  return root
}

/**
 * 採取物に残っている実アプリのリンクを、クローンのハッシュルートへ向け直す。
 * クローンの外へ出るリンク（外部URL）は無効化する（§3-2 本番へ出さない）。
 */
export function wireCapturedLinks(
  root: HTMLElement,
  fragmentHtml: string,
  currentAbTestUid: string,
): void {
  const capturedUid = extractCapturedAbTestUid(fragmentHtml)
  for (const anchor of root.querySelectorAll('a')) {
    const target = toHashHref(anchor.getAttribute('href') ?? '', capturedUid, currentAbTestUid)
    if (target === null) {
      anchor.removeAttribute('href')
      anchor.addEventListener('click', (event) => event.preventDefault())
      continue
    }
    anchor.setAttribute('href', target)
  }
}

/**
 * 上部バーの「戻る」。実物は `/folders?uid=<フォルダのuid>&folder_scope=` へ戻る。
 * 採取物には**採取元のフォルダuid**が焼き付いているので、必ず上書きする
 * （`wireCapturedLinks` はab_test uidしか置換しないため、こちらで直す）。
 */
export function wireBackLink(root: HTMLElement, folderUid: string | null): void {
  const back = root.querySelector<HTMLAnchorElement>('a[class*="_back_"]')
  if (back === null) {
    console.warn('[report] 戻るリンクが土台に見つかりませんでした')
    return
  }
  back.setAttribute('href', folderUid === null ? '#/folders' : `#/folders?uid=${folderUid}`)
}

/** 上部バーのページ名／フォルダ名に、いま開いているbeyondページの値を入れる */
export function setTopBarNames(root: HTMLElement, title: string, folderName: string): void {
  const titleNode = root.querySelector<HTMLElement>('[class*="_title_dcd38"] p')
  if (titleNode !== null) titleNode.textContent = title
  for (const node of root.querySelectorAll<HTMLElement>('[class*="_folderName_"]')) {
    node.textContent = folderName
  }
}

/**
 * 採取したテキストに焼き付いている匿名化済みのページ名を、いまのページ名に差し替える。
 * （注意バナーの本文など、要素で特定できない箇所のため）
 */
const ANONYMIZED_NAME = /サンプル施策\d+/g

export function replaceBakedPageName(node: HTMLElement, title: string): void {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current !== null) {
    const text = current.textContent ?? ''
    // `g` フラグ付き正規表現の test() は lastIndex を持ち回るので、replace の結果で判定する
    const replaced = text.replace(ANONYMIZED_NAME, title)
    if (replaced !== text) current.textContent = replaced
    current = walker.nextNode()
  }
}

/** スタイルシート全走査は重いので1度だけ作って使い回す */
let themeSwapCache: ThemeSwap | null = null

/** 読み込み済みのスタイルシートから dark⇄light の対応表を作る（無ければ空） */
function readThemeSwap(): ThemeSwap {
  if (themeSwapCache !== null) return themeSwapCache
  const tokens: string[] = []
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      // 別オリジンのスタイルシートは読めない。テーマ切替を諦めるだけで、握りつぶさず次へ。
      continue
    }
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) tokens.push(...extractThemeTokens(rule.selectorText))
    }
  }
  const swap = buildThemeSwap(tokens)
  // 対応表が空なら（CSSがまだ読めていない等）キャッシュせず、次回もう一度試す
  if (swap.toLight.size > 0) themeSwapCache = swap
  return swap
}

/**
 * 指示116: マウント直後にライトテーマを即適用する（白基調化）。
 * wireThemeToggle と同じクラス名入替を、トグルクリックを待たずに行う。
 * wireThemeToggle **より先に** 呼ぶこと（トグルの初期状態を正しく設定するため）。
 */
export function applyLightTheme(root: HTMLElement): void {
  const swap = readThemeSwap()
  // CSS Modules の _darkTheme_ → _lightTheme_ クラス入替
  if (swap.toLight.size > 0) {
    for (const node of root.querySelectorAll('[class]')) {
      const current = node.getAttribute('class') ?? ''
      const next = swapClassName(current, swap.toLight)
      if (next !== current) node.setAttribute('class', next)
    }
  }
  root.dataset['cloneTheme'] = 'light'
  // Emotion/MUI の css-* クラスに焼きついたダーク背景をインライン上書き
  overrideDarkBackgrounds(root)
}

/**
 * 右上のランプ（`_toggleTheme_`）でダーク⇄ライトを切り替える。
 * 採取CSSに両方のクラスがあるので、クラス名を入れ替えるだけで実物と同じ見た目になる。
 * 対応表が作れなかった場合は何もしない（それらしい見た目を自作しない）。
 */
export function wireThemeToggle(root: HTMLElement): void {
  const toggle = root.querySelector<HTMLElement>('[class*="_toggleTheme_"]')
  if (toggle === null) return
  const swap = readThemeSwap()
  if (swap.toLight.size === 0) {
    console.warn('[report] 採取CSSからテーマの対応表を作れませんでした。切替は無効です')
    return
  }
  // 指示116: applyLightTheme() で先にライトが適用されている場合がある
  let isDark = root.dataset['cloneTheme'] !== 'light'
  toggle.addEventListener('click', () => {
    const map = isDark ? swap.toLight : swap.toDark
    // class は SVG 要素だと SVGAnimatedString になるので、必ず属性で読み書きする
    for (const node of root.querySelectorAll('[class]')) {
      const current = node.getAttribute('class') ?? ''
      const next = swapClassName(current, map)
      if (next !== current) node.setAttribute('class', next)
    }
    isDark = !isDark
  })
}

/**
 * クローン側の注記（実物には無い）。
 * 「まだ配線していない」ことを黙って隠さないための表示（main.ts の renderNotBuilt と同じ方針）。
 */
export function cloneNote(message: string): HTMLElement {
  return el('div', {
    text: `クローン注記: ${message}`,
    style: `font-family:${T.font};font-size:11px;line-height:1.8;color:${T.sub};
      padding:6px 12px;border-left:2px solid ${T.sub};margin:0`,
  })
}
