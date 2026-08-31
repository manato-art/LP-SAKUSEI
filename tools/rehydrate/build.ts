/**
 * 土台化ビルド（企画書 §5-6）。
 *
 *   npm run rehydrate
 *
 * `capture/clean/<slug>/<state>/dom.html` を、ローカルで開けるHTMLへ変換して
 * `src/pages/` に出力し、一覧できる索引ページも作る。
 * CSSは書き換えず、採取した実ファイルをそのまま読ませる（§11）。
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { rewriteSubstrate, substrateBanner } from './rewrite.ts'
import { buildFragments } from './fragments.ts'

const CLEAN_DIR = 'capture/clean'
const OUT_DIR = 'src/pages'

interface PageEntry {
  slug: string
  state: string
  file: string
  bytes: number
  removed: Record<string, number>
  hasIframe: boolean
  hasCssom: boolean
}

function listStates(): { slug: string; state: string }[] {
  if (!existsSync(CLEAN_DIR)) return []
  return readdirSync(CLEAN_DIR)
    .filter((slug) => statSync(join(CLEAN_DIR, slug)).isDirectory() && slug !== 'fixtures')
    .flatMap((slug) =>
      readdirSync(join(CLEAN_DIR, slug))
        .filter((state) => existsSync(join(CLEAN_DIR, slug, state, 'dom.html')))
        .map((state) => ({ slug, state })),
    )
}

function buildIndex(pages: readonly PageEntry[]): string {
  const bySlug = new Map<string, PageEntry[]>()
  for (const p of pages) {
    bySlug.set(p.slug, [...(bySlug.get(p.slug) ?? []), p])
  }
  const sections = [...bySlug.entries()]
    .map(([slug, list]) => {
      const items = list
        .map(
          (p) => `      <li>
        <a href="./pages/${p.file}">${p.state}</a>
        <span class="meta">${Math.round(p.bytes / 1024)}KB${p.hasIframe ? ' · iframe有' : ''}${p.hasCssom ? '' : ' · <b style="color:#D0021B">CSSOM無し(無地になる)</b>'}</span>
      </li>`,
        )
        .join('\n')
      return `  <section>
    <h2>${slug}</h2>
    <ul>
${items}
    </ul>
  </section>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SquadBeyond クローン ― 土台ビューア</title>
<style>
  :root { --primary:#0091FF; --bg:#ECECEC; --surface:#fff; --text:#151515; --sub:#808080; }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px; background:var(--bg); color:var(--text);
         font-family:"Hiragino Sans", sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; }
  .lead { color:var(--sub); font-size:13px; margin:0 0 20px; line-height:1.8; }
  .warn { background:#FFF4E5; border-left:3px solid #FF9500; padding:10px 14px;
          font-size:13px; line-height:1.8; margin:0 0 20px; }
  section { background:var(--surface); border-radius:6px; padding:16px 20px; margin-bottom:12px; }
  h2 { font-size:14px; margin:0 0 10px; font-family:monospace; color:var(--primary); }
  ul { list-style:none; margin:0; padding:0; }
  li { display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid #F0F0F0; }
  li:last-child { border-bottom:none; }
  a { color:var(--text); text-decoration:none; font-size:14px; }
  a:hover { color:var(--primary); text-decoration:underline; }
  .meta { color:var(--sub); font-size:12px; margin-left:auto; }
</style>
</head>
<body>
  <h1>SquadBeyond クローン ― 土台ビューア</h1>
  <p class="lead">
    採取した実HTML＋実CSSをローカルで表示しています（企画書 §5-6 Rehydrate）。<br />
    ${pages.length} 状態 / ${bySlug.size} ルート。
  </p>
  <p class="warn">
    <strong>これは「見た目の土台」だけです。</strong>
    本番のJSは除去してあるため、ボタンやタブはまだ動きません（企画書 §11 の設計どおり）。<br />
    動く部分はモックAPIに再配線してから足していきます。データはすべて匿名化済みの架空値です。
  </p>
${sections}
</body>
</html>
`
}

function main(): void {
  const states = listStates()
  if (states.length === 0) {
    console.error('[rehydrate] capture/clean/ に採取物がありません。先に採取と匿名化を行ってください。')
    process.exitCode = 1
    return
  }
  mkdirSync(OUT_DIR, { recursive: true })

  const pages: PageEntry[] = states.map(({ slug, state }) => {
    const source = readFileSync(join(CLEAN_DIR, slug, state, 'dom.html'), 'utf8')
    const { html, removed } = rewriteSubstrate(source)
    const file = `${slug}__${state}.html`

    /**
     * 【重要】Emotion(CSS-in-JS)のスタイルは実行時に CSSOM へ挿入されるため、
     * outerHTML にも .css ファイルにも入っていない。採取した cssom.css を明示的に読ませないと
     * 画面が無地になる（実際にこの罠を踏んだ。docs/findings-live-observation.md 参照）。
     */
    const cssomPath = join(CLEAN_DIR, slug, state, 'cssom.css')
    let withCssom = html
    if (existsSync(cssomPath)) {
      const cssFile = `${slug}__${state}.cssom.css`
      writeFileSync(join(OUT_DIR, cssFile), readFileSync(cssomPath, 'utf8'))
      withCssom = html.replace('</head>', `<link rel="stylesheet" href="./${cssFile}"></head>`)
    }

    const withBanner = withCssom.replace('</body>', `${substrateBanner(slug, state)}</body>`)
    writeFileSync(join(OUT_DIR, file), withBanner)
    return {
      slug,
      state,
      file,
      bytes: withBanner.length,
      removed,
      hasIframe: existsSync(join(CLEAN_DIR, slug, state, 'iframe0.html')),
      hasCssom: existsSync(join(CLEAN_DIR, slug, state, 'cssom.css')),
    }
  })

  // アプリ側が「土台そのもの」を読み込めるよう、#root の中身を断片として出す
  const fragments = buildFragments(states)

  writeFileSync('src/viewer.html', buildIndex(pages))
  console.log(`[rehydrate] 断片 ${fragments}件を src/app/fragments へ出力`)

  console.log(`[rehydrate] ${pages.length}状態を ${OUT_DIR} へ出力`)
  for (const p of pages) {
    console.log(`  ${p.slug}/${p.state}  ${Math.round(p.bytes / 1024)}KB`)
  }
  console.log('[rehydrate] 索引: src/index.html （npm run dev で開ける）')
}

main()
