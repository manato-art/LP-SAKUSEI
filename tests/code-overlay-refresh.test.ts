/**
 * 色付きコード欄で、値をコードから書き換えたら表示も必ず更新していることを、ソースを読んで確かめる。
 *
 * 色付きコード欄は「文字が透明な textarea」の上に「色付きの <pre>」を重ねた作りで、見えているのは <pre> の方。
 * textarea に value を入れるだけだと <pre> は古いまま残る。Widget編集で実際に、カードで文言を変えたあと
 * 「デフォルト時のコードを表示」を押すと変更前のHTMLが見えていた（本人に報告した落とし穴の1つ目）。
 *
 * 書き換えたら次のどちらかをしていること:
 *   - 直後に sync() を呼ぶ／input イベントを投げる（色付き表示と行番号が同じ道で更新される）
 *   - 作った直後で、同じ内容から色付き表示を先に作っている
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** 色付きコード欄を持つファイル（pre を重ねる作りのもの全部） */
const CODE_EDITORS = [
  'src/app/panels/widget-code-panel.ts',
  'src/app/panels/widget-creator.ts',
  'src/app/panels/widget-editor.ts',
  'src/app/pages/exit-popup-editor.ts',
  'src/app/pages/exit-popup-follow.ts',
]

/** textarea に値を入れているのに、色付き表示を更新していない行を返す */
function unrefreshedCodeWrites(source: string): string[] {
  const lines = source.split('\n')
  const found: string[] = []
  lines.forEach((line, i) => {
    if (!/\b(?:textarea|cssArea|htmlArea)\.value = /.test(line)) return
    const after = lines.slice(i + 1, i + 5).join('\n')
    const before = lines.slice(Math.max(0, i - 8), i).join('\n')
    const refreshedAfter = /\bsync\(\)|dispatchEvent\(new Event\('input'/.test(after)
    const builtBefore = /innerHTML = (?:highlight|\(lang === )/.test(before)
    if (!refreshedAfter && !builtBefore) found.push(`${i + 1}: ${line.trim()}`)
  })
  return found
}

describe('色付きコード欄の値を書き換えたら、表示も更新している', () => {
  it('値を入れるだけの書き方を見つけられる（直す前の Widget編集の書き方）', () => {
    const before = [
      '  const syncFn = (): void => {',
      '    if (htmlArea !== null && contentDiv !== null) {',
      '      htmlArea.value = contentDiv.innerHTML',
      '    }',
      '  }',
    ].join('\n')
    expect(unrefreshedCodeWrites(before)).toEqual(['3: htmlArea.value = contentDiv.innerHTML'])
  })

  it.each(CODE_EDITORS)('%s', (file) => {
    expect(unrefreshedCodeWrites(readFileSync(file, 'utf8'))).toEqual([])
  })
})
