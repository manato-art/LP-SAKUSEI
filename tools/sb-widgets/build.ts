/**
 * SquadBeyond の Widget 一覧（1,587件・2026-10-26 本人の指示「SquadBeyondのものを戻して、1個1個確かめて再現して」）を、
 * EBIyon の Widget一覧で使う形にする道具。何度回しても同じものができる。
 *
 *   npx tsx tools/sb-widgets/build.ts
 *
 * 入力（リポジトリの外 ~/squadbeyond-capture-quarantine/sb-widgets-2026-10-26/・本人のChromeでSB本体の html_parts から取った元のまま）:
 *   sb-widgets-2026-10-26.json   … 番号・名前・分類・HTML・CSS
 *   media-map.tsv                … SBの置き場のURL → 写したファイル
 *   media/                       … 写した画像・動画・スクリプト（714個）
 *
 * 出力（gitに入れる）:
 *   mock-server/seed/sb-widgets/categories.json   … 分類（id・名前・件数）
 *   mock-server/seed/sb-widgets/parts-<分類>.json  … その分類の Widget（id・名前・HTML・CSS）
 *   mock-server/seed/sb-widget-media/<sha256>.<拡張子> … 写した画像など（起動時に /uploads へ置く・lib/sb-widget-media.ts）
 *
 * 本人の決定: 架空への置き換え（匿名化）はかけない／画像はEBIyonに写して持つ（SBの置き場のURLは /uploads/… に書き換える）。
 * SB本体（管理画面・サービスサイト）を指す見本のリンク先は、LPを見る人には開けないので「仮のリンク」（#）にする
 * （SBの見本がもともと使う仮の書き方と同じ扱い＝Widget編集で「リンク先が仮」と知らせる・link-placeholder.ts）。
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** 元のまま取ったもの（リポジトリの外の隔離場所・docs/scrub-policy.md の決まり） */
const RAW = join(homedir(), 'squadbeyond-capture-quarantine', 'sb-widgets-2026-10-26')
const OUT = 'mock-server/seed/sb-widgets'
const MEDIA_OUT = 'mock-server/seed/sb-widget-media'

/** 分類の無い Widget（SB側で分類が外れているもの）の置き場 */
export const NO_CATEGORY_ID = 0

interface RawPart {
  readonly id: number
  readonly name: string
  readonly category_id: number | null
  readonly category_name: string | null
  readonly updated_at: number
  readonly html: string | null
  readonly css: string | null
}

const raw = JSON.parse(readFileSync(join(RAW, 'sb-widgets-2026-10-26.json'), 'utf8')) as { parts: RawPart[] }

// SBの置き場のURL → /uploads/<中身のsha256>.<拡張子>
const urlToUpload = new Map<string, string>()
rmSync(MEDIA_OUT, { recursive: true, force: true })
mkdirSync(MEDIA_OUT, { recursive: true })
for (const line of readFileSync(join(RAW, 'media-map.tsv'), 'utf8').split('\n')) {
  const [code, file, , url] = line.split('\t')
  if (code !== '200' || file === undefined || url === undefined) continue
  const content = readFileSync(join(RAW, 'media', file))
  const ext = (/\.([a-z0-9]{2,5})$/.exec(file)?.[1] ?? 'bin').replace('jpeg', 'jpg')
  const name = `${createHash('sha256').update(content).digest('hex')}.${ext}`
  if (!existsSync(join(MEDIA_OUT, name))) copyFileSync(join(RAW, 'media', file), join(MEDIA_OUT, name))
  urlToUpload.set(url, `/uploads/${name}`)
}

/**
 * Widget の中に埋め込まれた画像・書体（data:…;base64,…）も、写した置き場のファイルにする。
 * LPの保存（lib/uploads.ts）は大きな画像だけを外へ出すが、見本は中身をリポジトリに持つので、長い記号の並び
 * （ゲートの「長い不透明トークン」）を残さないよう、SVG・書体も含めて全部ファイルにする（見え方は同じ）
 */
const DATA_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/font-woff': 'woff',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
  'application/x-font-ttf': 'ttf',
  'font/ttf': 'ttf',
}
const DATA_URL = /data:([\w.+/-]+)((?:;[\w.+-]+=[\w.+-]*)*);base64,\s*([A-Za-z0-9+/]+={0,2})/g
let embedded = 0
const externalize = (text: string): string =>
  text.replace(DATA_URL, (whole, mime: string, _params: string, payload: string) => {
    const ext = DATA_EXTENSIONS[mime.toLowerCase()]
    if (ext === undefined) return whole
    const content = Buffer.from(payload, 'base64')
    const name = `${createHash('sha256').update(content).digest('hex')}.${ext}`
    if (!existsSync(join(MEDIA_OUT, name))) writeFileSync(join(MEDIA_OUT, name), content)
    embedded += 1
    return `/uploads/${name}`
  })

// 長いURLから置き換える（短いURLが長いURLの頭と同じでも取り違えない）
const urls = [...urlToUpload.keys()].sort((a, b) => b.length - a.length)
const rewrite = (text: string): string => urls.reduce((out, url) => out.split(url).join(urlToUpload.get(url) ?? url), text)

const SB_HOST = /https?:\/\/(?:production\.static\.squadbeyond\.com|file\.mysquadbeyond\.com|d24894ewhzyuok\.cloudfront\.net)\//g
/** SB本体（管理画面・サービスサイト・SBの配信の試しのドメイン）を指すURL（置き場は上で /uploads にしてある） */
const SB_APP_URL = /(?:https?:)?\/\/[a-z0-9.-]*(?:squadbeyond\.com|discover-news\.tokyo)[^"'\s<>)]*/gi
const linkedToSb: number[] = []
const withoutSbLinks = (id: number, text: string): string => {
  const out = text.replace(SB_APP_URL, '#')
  if (out !== text && !linkedToSb.includes(id)) linkedToSb.push(id)
  return out
}

const byCategory = new Map<number, { name: string; parts: { id: number; name: string; html: string; css: string }[] }>()
let leftover = 0
for (const part of raw.parts) {
  const id = part.category_id ?? NO_CATEGORY_ID
  const group = byCategory.get(id) ?? { name: part.category_name ?? '分類なし', parts: [] }
  const html = withoutSbLinks(part.id, externalize(rewrite(part.html ?? '')))
  const css = withoutSbLinks(part.id, externalize(rewrite(part.css ?? '')))
  leftover += (html.match(SB_HOST)?.length ?? 0) + (css.match(SB_HOST)?.length ?? 0)
  group.parts.push({ id: part.id, name: part.name, html, css })
  byCategory.set(id, group)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const categories = [...byCategory.entries()]
  .sort(([a], [b]) => (a === NO_CATEGORY_ID ? 1 : b === NO_CATEGORY_ID ? -1 : a - b))
  .map(([id, group]) => {
    // SBの一覧と同じ順（新しく足されたものが上＝番号の大きい順）
    const parts = [...group.parts].sort((a, b) => b.id - a.id)
    writeFileSync(join(OUT, `parts-${id}.json`), JSON.stringify(parts))
    return { id, name: group.name, count: parts.length }
  })
writeFileSync(join(OUT, 'categories.json'), `${JSON.stringify(categories, null, 1)}\n`)

console.log(`Widget ${raw.parts.length}件・分類 ${categories.length}・写した置き場のファイル ${readdirSync(MEDIA_OUT).length}個`)
console.log(`SBの置き場を指したまま残ったURL: ${leftover}か所（スクリプトの中で組み立てているものなど）`)
console.log(`埋め込みの画像・書体をファイルにした: ${embedded}か所`)
console.log(`SB本体を指していたリンク先を仮（#）にした Widget: ${linkedToSb.length}件（${linkedToSb.join(', ')}）`)
