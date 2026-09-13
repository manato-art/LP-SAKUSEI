/**
 * ダークモード用の上書きCSSを、採取した実物CSSから機械的に作る（2026-09-13・本人指示）。
 *
 * 採取物（`capture/clean/_merged/cssom.css` ほか）は**一切書き換えない**。
 * 同じセレクタに `html[data-theme="dark"]` を足した上書きだけを別ファイルに出す。
 * 色の写し方は `src/shared/dark-color.ts`（テストで固定）。
 *
 *   npm run dark-css
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { darkRule, parseDeclarations } from '../../src/shared/dark-css.ts'

/** 元にするCSS（index.html が読み込んでいる、色を持つもの） */
const SOURCES = [
  'capture/clean/_merged/cssom.css',
  'capture/assets/css/index-cb391eb6.css',
]
const OUT = 'capture/clean/_merged/dark.css'

/** 中身を写さない at-rule（キーフレームはセレクタが % なので前置できない） */
const SKIP_AT_RULE = /^@(keyframes|-webkit-keyframes|font-face|import|charset|property)/

/**
 * コメントを落とす。セレクタの直前にコメントがあると前置の位置がずれるし、
 * コメントの中の波括弧で分割位置もずれる。
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** 波括弧の深さで、その階層のルールへ分割する */
function splitRules(css: string): string[] {
  const rules: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < css.length; i += 1) {
    const c = css[i]
    if (c === '{') depth += 1
    else if (c === '}') {
      depth -= 1
      if (depth === 0) {
        rules.push(css.slice(start, i + 1).trim())
        start = i + 1
      }
    }
  }
  return rules.filter(Boolean)
}

/** ルール1つ（入れ子も）をダーク用に写す。何も変わらなければ空文字 */
function convertRule(rule: string): string {
  const open = rule.indexOf('{')
  if (open === -1) return ''
  const head = rule.slice(0, open).trim()
  const body = rule.slice(open + 1, rule.lastIndexOf('}'))

  if (head.startsWith('@')) {
    if (SKIP_AT_RULE.test(head)) return ''
    // @media / @supports など: 中のルールをそのまま写して、同じ条件で包み直す
    const inner = splitRules(body).map(convertRule).filter(Boolean).join('\n')
    return inner === '' ? '' : `${head}{\n${inner}\n}`
  }

  return darkRule(head, parseDeclarations(body))
}

const pieces: string[] = []
let sourceBytes = 0
for (const path of SOURCES) {
  let css: string
  try {
    css = readFileSync(path, 'utf8')
  } catch {
    console.log(`[dark-css] 見つからないので飛ばします: ${path}`)
    continue
  }
  sourceBytes += css.length
  for (const rule of splitRules(stripComments(css))) {
    const converted = convertRule(rule)
    if (converted !== '') pieces.push(converted)
  }
}

const header = [
  '/* 自動生成（npm run dark-css）。手で編集しない。',
  ' * 元: ' + SOURCES.join(', '),
  ' * 変換ルール: src/shared/dark-color.ts（tests/dark-color.test.ts で固定）',
  ' * ダーク（html[data-theme="dark"]）のときだけ読み込む。ライトは今までと同じ。',
  ' */',
].join('\n')
writeFileSync(OUT, `${header}\n${pieces.join('\n')}\n`, 'utf8')
console.log(
  `[dark-css] ${OUT} を作りました（元 ${(sourceBytes / 1024).toFixed(0)}KB → ` +
    `${(Buffer.byteLength(pieces.join('\n')) / 1024).toFixed(0)}KB / ${pieces.length}ルール）`,
)
