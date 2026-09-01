// 参照される全 cssom.css を「ルール単位で重複除去」して1本にまとめる。
// 目的: 同一アプリのEmotion CSSが画面ごとに重複採取され、合計14MB→本番アップロードが不安定。
// ルールのテキストは一切書き換えない（採取物の union・忠実）。順序は初出を保つ。
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const refs = [...new Set(
  execSync(`grep -oE 'clean/[^"]*cssom\\.css' src/index.html`).toString().trim().split('\n'),
)]

// トップレベルのルール（セレクタ{...} / @media{...} / @keyframes{...}）に分割する。
// 波括弧の深さを数え、深さが0に戻った位置で1ルールとする。
function splitRules(css) {
  const rules = []
  let depth = 0, start = 0
  for (let i = 0; i < css.length; i++) {
    const c = css[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) { rules.push(css.slice(start, i + 1).trim()); start = i + 1 }
    }
  }
  return rules.filter(Boolean)
}

const seen = new Set()
const out = []
let total = 0
for (const ref of refs) {
  const css = readFileSync('capture/' + ref, 'utf8')
  total += css.length
  for (const rule of splitRules(css)) {
    if (seen.has(rule)) continue
    seen.add(rule)
    out.push(rule)
  }
}
const merged = out.join('\n')
writeFileSync('capture/clean/_merged/cssom.css', merged)
console.log(`統合: ${refs.length}本 / 元${(total/1e6).toFixed(1)}MB → ユニーク${out.length}ルール / ${(merged.length/1e6).toFixed(2)}MB`)
