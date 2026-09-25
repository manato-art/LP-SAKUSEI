/**
 * ダークの自動変換が「選んだとき」の色を消さない（2026-09-25・本人「修正して」）。
 *
 * 自動変換（src/app/dark-runtime-css.ts）は、色を暗く写す必要のあるルールだけに `html[data-theme="dark"] …` の
 * 写しを作って最後に足していた。「ふつう」のルール（白い地）には写しができ、「選んだとき」のルール（青い地・白い文字）は
 * 変える色が無いので写しができない。写しは元より1段強いので、ダークでは「ふつう」の写しが「選んだとき」に勝ち、
 * 選んだボタンの青やオレンジが消えていた（ヒートマップの一覧・列の SP/PC で実際に見えた）。
 * 色を持つルールには、変えない色も含めて写しを作る。写し同士の強さの順番がライトと同じになる。
 */
import { describe, expect, it } from 'vitest'
import { darkRule, parseDeclarations } from '../src/shared/dark-css.ts'

const rule = (selector: string, block: string, keepCascade = true): string =>
  darkRule(selector, parseDeclarations(block), { keepCascade })

describe('実行時の自動変換は、色を持つルール全部に写しを作る', () => {
  it('「選んだとき」の青・白い文字も写す（ふつうの写しに負けないように）', () => {
    const base = rule('.hm-dev button', 'background:#FFFFFF;color:#555555;border:1px solid #D5D5DB')
    const on = rule('.hm-dev button.on', 'background:#f0960a;border-color:#f0960a;color:#FFFFFF')
    expect(base).toContain('html[data-theme="dark"] .hm-dev button{')
    expect(on).toBe('html[data-theme="dark"] .hm-dev button.on{background:#f0960a;border-color:#f0960a;color:#FFFFFF}')
  })

  it('アクセント色の変数も写す', () => {
    expect(rule('.chip:has(input:checked)', 'background:var(--sb-accent, #0091FF);color:#FFFFFF')).toContain(
      'background:var(--sb-accent, #0091FF)',
    )
  })

  it('色を持たないルールには写しを作らない（大きさだけ等）', () => {
    expect(rule('.x', 'width:10px;height:20px')).toBe('')
  })

  it('採取したCSSから作る上書き（ビルド時）は今までどおり、変える宣言だけ', () => {
    expect(rule('.hm-dev button.on', 'background:#f0960a;border-color:#f0960a;color:#FFFFFF', false)).toBe('')
  })
})
