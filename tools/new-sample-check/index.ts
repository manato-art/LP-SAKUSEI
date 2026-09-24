/**
 * 自作の見本（src/app/panels/nocode/samples/）の作りの決まりを、1本ずつ確かめる道具（2026-09-23）。
 *
 * `npm run sample-check`            … samples/ の全部を確かめる
 * `npm run sample-check -- a.ts b.ts` … 指定したファイルだけ
 *
 * ここで見るのは「入れたときに壊れない・ほかのWidgetを壊さない」ための決まり。
 * 見た目の良し悪しは見ない（それは人が見る）。テスト（tests/nocode-new-samples.test.ts）と同じ決まりで、
 * 作っている途中でも1本だけ早く確かめられるようにしたもの。
 */
import { readdirSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { SAMPLE_CATEGORIES, type NewSample } from '../../src/app/panels/nocode/samples/kit.ts'

const DIR = 'src/app/panels/nocode/samples'
/** 中身ではなく道具・一覧のファイル */
const NOT_SAMPLES = new Set(['kit.ts', 'index.ts'])

const ROOT_RE = /<div class="nc nc-sample (nc-[a-z0-9]{8})" data-nocode="sample"/
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

/** `<style>` の中の、1つ1つの決まり（セレクター単位）。@media・@keyframes の外枠は外す */
function selectorsOf(css: string): string[] {
  const body = css.replace(/@(?:media|supports)[^{]*\{/g, '').replace(/@keyframes[^{]*\{[\s\S]*?\}\s*\}/g, '')
  return body
    .split('}')
    .map((chunk) => chunk.split('{')[0]?.trim() ?? '')
    .filter((selector) => selector !== '' && !selector.startsWith('@'))
}

function checkOne(sample: NewSample, file: string, uids: Map<string, string>): string[] {
  const bad: string[] = []
  const say = (text: string): number => bad.push(`${basename(file)}: ${text}`)

  if (!/^[a-z][a-z0-9-]*$/.test(sample.id)) say(`id「${sample.id}」は英小文字とハイフンだけにする`)
  if (!(SAMPLE_CATEGORIES as readonly string[]).includes(sample.category)) say(`category「${sample.category}」は一覧に無い`)
  if (sample.name.trim() === '') say('name が空')
  if (sample.summary.trim() === '') say('summary が空')
  if (sample.summary.length > 60) say(`summary が長い（${sample.summary.length}字。60字まで）`)

  const html = sample.html
  const uid = ROOT_RE.exec(html)?.[1]
  if (uid === undefined) {
    say('いちばん外が <div class="nc nc-sample nc-xxxxxxxx" data-nocode="sample"> になっていない')
    return bad
  }
  const owner = uids.get(uid)
  if (owner !== undefined && owner !== file) say(`uid「${uid}」が ${basename(owner)} と重なっている`)
  uids.set(uid, file)

  const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? '').join('')
  if (css.trim() === '') say('<style> が無い')
  for (const selector of selectorsOf(css)) {
    if (!selector.split(',').every((one) => one.trim().startsWith(`.${uid}`))) {
      say(`CSSがこのWidgetの外に効く: 「${selector.slice(0, 60)}」は .${uid} から始める`)
    }
  }

  if (/https?:\/\//.test(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, ''))) say('外から読み込む URL がある（data: 以外は入れない）')
  if (/\son[a-z]+=/i.test(html)) say('on〇〇= の属性がある（スクリプトは固定の形だけ）')
  if (/javascript:/i.test(html)) say('javascript: がある')
  if (/@import|url\((?!['"]?data:)/i.test(html)) say('@import か url(…) で外を読んでいる')
  if (EMOJI_RE.test(html)) say('絵文字がある（印は固定のSVGにする）')
  if (/\sid="/.test(html)) say('id 属性がある（同じLPに2つ入れると重なる。クラスにする）')
  // font:800 17px/1.5 inherit は字体の所に inherit を書けず、宣言まるごと捨てられる（太さ・大きさが効かない・2026-09-25）
  if (/font:\s*[^;}]*\S\s+inherit\b/.test(html)) {
    say('font: の中に inherit がある（宣言ごと捨てられる）。font-weight・font-size・line-height・font-family:inherit に分けて書く')
  }

  const screens = [...html.matchAll(/<div class="nc-screen" data-nc-screen="(s\d{1,4})"[^>]*>/g)]
  if (html.includes('data-nc-screens')) {
    if (screens.length < 2) say('画面が2つ未満なのに data-nc-screens がある')
    const shown = screens.filter((m) => !m[0].includes('hidden'))
    if (shown.length !== 1) say(`最初の画面だけ見えている形にする（いま ${shown.length} 枚見えている）`)
    if (!html.includes('<script>')) say('画面を切り替えるスクリプト（SCREENS_SCRIPT）が入っていない')
    const ids = new Set(screens.map((m) => m[1]))
    for (const go of html.matchAll(/data-nc-go="(s\d{1,4})"/g)) {
      if (!ids.has(go[1] ?? '')) say(`移る先「${go[1]}」の画面が無い`)
    }
  } else if (html.includes('data-nc-go')) {
    say('画面が無いのに data-nc-go がある')
  }
  return bad
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const files = (args.length > 0 ? args : readdirSync(DIR).filter((f) => f.endsWith('.ts') && !NOT_SAMPLES.has(f)).map((f) => join(DIR, f))).sort()
  const uids = new Map<string, string>()
  const problems: string[] = []
  let count = 0
  for (const file of files) {
    const module = (await import(pathToFileURL(resolve(file)).href)) as Record<string, unknown>
    const samples = Object.values(module).filter(
      (value): value is NewSample => typeof value === 'object' && value !== null && 'html' in value && 'category' in value,
    )
    if (samples.length === 0) {
      problems.push(`${basename(file)}: 見本（NewSample）が書き出されていない`)
      continue
    }
    for (const sample of samples) {
      count += 1
      problems.push(...checkOne(sample, file, uids))
    }
  }
  console.log(`[sample-check] ${count}本を確かめた（${files.length}ファイル）`)
  if (problems.length === 0) {
    console.log('[sample-check] 合格')
    return
  }
  for (const problem of problems) console.error(`  × ${problem}`)
  console.error(`[sample-check] ${problems.length}件なおしてください`)
  process.exitCode = 1
}

void main()
