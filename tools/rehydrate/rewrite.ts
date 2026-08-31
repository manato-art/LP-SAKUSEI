/**
 * 土台化のパス書き換え（企画書 §5-6 Rehydrate）。
 *
 * 採取したDOMは本番のパス（`/app.css` `/assets/xxx.svg` …）を指しているので、
 * ローカルに配置した実アセットへ向け直す。CSSは**書き換えず verbatim** で使う（§11）。
 */

/** Viteの publicDir が `capture/` なので、`/assets/...` は `capture/assets/...` を指す */
export const CSS_MAP: Readonly<Record<string, string>> = {
  '/app.css': '/assets/css/app.css',
  '/normalize.css': '/assets/css/normalize.css',
  '/assets/index-cb391eb6.css': '/assets/css/index-cb391eb6.css',
  '/assets/index-05deeb9d.css': '/assets/css/index-05deeb9d.css',
}

/** 本番JSは使わない（§11）。読み込もうとすると404になるだけなので除去する。 */
const REMOVE_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'modulepreload', pattern: /<link\b[^>]*rel="modulepreload"[^>]*>/gi },
  { name: '本番JS', pattern: /<script\b[^>]*src="\/assets\/[^"]*\.js"[^>]*>\s*<\/script>/gi },
  { name: '残りのscript', pattern: /<script\b[\s\S]*?<\/script>/gi },
  { name: 'Google Fonts', pattern: /<link\b[^>]*\/assets\/fonts\/css2?\?[^>]*>/gi },
  { name: 'preconnect', pattern: /<link\b[^>]*rel="preconnect"[^>]*>/gi },
  { name: 'manifest', pattern: /<link\b[^>]*rel="manifest"[^>]*>/gi },
]

export interface RewriteResult {
  html: string
  removed: Record<string, number>
}

export function rewriteSubstrate(input: string): RewriteResult {
  let html = input
  const removed: Record<string, number> = {}

  for (const { name, pattern } of REMOVE_PATTERNS) {
    const before = html.length
    html = html.replace(pattern, '')
    pattern.lastIndex = 0
    if (html.length !== before) removed[name] = (removed[name] ?? 0) + 1
  }

  // CSS を採取済みのローカルパスへ
  for (const [from, to] of Object.entries(CSS_MAP)) {
    html = html.split(`"${from}"`).join(`"${to}"`)
  }
  // `/assets/<name>` はそのまま。採取したCSSが同じURLで画像を参照するので、
  // ファイル側を実物のURLの形に合わせて置いている（tools/capture-assets/paths.ts）。
  // 以前は `/assets/files/` へ寄せていたが、CSS側は寄せられないので画像が出なかった。

  // アイコンCSS（scrubで `/assets/fonts/...` に化けているものを実ファイルへ）
  html = html.replace(/\/assets\/fonts\/icon\?family=Material\+Icons/g, '/assets/css/material-icons.css')
  html = html.replace(
    /\/assets\/vendor\/ajax\/libs\/font-awesome\/5\.15\.4\/css\/all\.min\.css/g,
    '/assets/css/fontawesome-5.15.4.css',
  )
  // 画像・アイコン・フォントの実ファイル

  // integrity/crossorigin はローカル配信では邪魔になる
  html = html.replace(/\sintegrity="[^"]*"/g, '').replace(/\scrossorigin(?:="[^"]*")?/g, '')

  return { html, removed }
}

/** 土台であることを明示するバナー（本物と取り違えないため） */
export function substrateBanner(slug: string, state: string): string {
  return `<div data-substrate-banner style="position:fixed;right:8px;bottom:8px;z-index:2147483647;
background:#151515;color:#fff;font:12px/1.6 'Hiragino Sans',sans-serif;padding:6px 10px;border-radius:4px;opacity:.85">
クローン土台 · ${slug} / ${state}</div>`
}
