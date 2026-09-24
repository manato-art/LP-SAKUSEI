/**
 * Widget編集の左の列（並び）の1行（2026-09-24・本人「幅広くして／複製 消す を横書きにして」）。
 *
 * 選んだ行の「複製」「消す」が縦書きになっていた: 操作ボタンを 26px 四方にする指定（.ncf-parts .ncf-item__head .ncf-icon-btn）が
 * 文字ボタンの幅を自動にする指定より強く、2文字が1文字ずつ折れていた。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string): string => readFileSync(new URL(`../src/app/${path}`, import.meta.url), 'utf8')

/** クラス・属性・疑似クラスの数（この CSS はタグ名・id を使わないので、強さはこれで比べられる） */
const specificity = (selector: string): number =>
  (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length

/** 指定したクラスを含む規則を [セレクタ, 中身] で返す */
const rulesFor = (css: string, needle: string): ReadonlyArray<readonly [string, string]> =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .flatMap(([, selectors = '', body = '']) =>
      selectors.split(',').map((s) => [s.trim(), body] as const),
    )
    .filter(([selector]) => selector.includes(needle))

describe('並びの行の「複製」「消す」は横書き', () => {
  const css = read('panels/nocode/nocode-form-css.ts')
  const squareRule = rulesFor(css, '.ncf-icon-btn').find(([s, body]) => s.startsWith('.ncf-parts ') && /width:26px/.test(body))

  it.each(['.ncf-item__copy', '.ncf-item__remove'])('%s は四角い操作ボタンの幅に負けず、折り返さない', (cls) => {
    expect(squareRule).toBeDefined()
    const own = rulesFor(css, cls).filter(([s, body]) => s.startsWith('.ncf-parts ') && /width:auto/.test(body))
    expect(own.length).toBeGreaterThan(0)
    const strongest = Math.max(...own.map(([s]) => specificity(s)))
    expect(strongest).toBeGreaterThanOrEqual(specificity(squareRule?.[0] ?? ''))
    expect(own.some(([, body]) => /white-space:nowrap/.test(body))).toBe(true)
  })
})

describe('左の列は広め', () => {
  it('部品の列は 320px（名前が「…」で切れにくい）', () => {
    const src = read('panels/widget-studio.ts')
    expect(src).toMatch(/partsPane\.style\.cssText =\s*`flex:0 0 320px;/)
  })
})
