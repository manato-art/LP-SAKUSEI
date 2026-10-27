/**
 * スクリプトで1問ずつ出していく見本のうち、答えて進むだけの15個を画面①②③に分ける（2026-10-27 本人選択「進むだけの物だけ分ける」）。
 * 問いの要素そのものを画面にし、問いを並べている親を画面の入れ物にする（見本の CSS の親子の関係を崩さない）。
 */
import { readdirSync, readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { splitSampleScreens } from '../src/app/panels/nocode/sample-to-screens.ts'
import { wrapHtmlAsBuilder } from '../src/app/panels/nocode/builder-data.ts'
import { BUILDER_TEMPLATE, SCREENS_SCRIPT } from '../src/app/panels/nocode/templates/builder.ts'
import { rekeyUid } from '../src/app/panels/nocode/templates/kit.ts'
import { JS_STEP_IDS, convertJsSteps } from '../tools/sb-widgets/screens/js-steps.ts'
import { JS_STEP_SPECS } from '../tools/sb-widgets/screens/js-steps-specs.ts'

const parse = (html: string): Element => {
  const { document } = parseHTML(`<!doctype html><html><body><div id="r">${html}</div></body></html>`)
  const root = document.getElementById('r')
  if (root === null) throw new Error('parse')
  return root as unknown as Element
}

const screensOf = (html: string): Element[] => {
  const holder = parse(html).querySelector('[data-nc-screens]')
  return holder === null ? [] : Array.from(holder.children).filter((c) => c.hasAttribute('data-nc-screen'))
}

/** 13015 と同じ形（親子の CSS・選ぶと下の文と次へが出る・次へで入れ替わる） */
const SWITCHING =
  '<script>var sbQuestionnaireSwitchingSimple = {};</script><script>document.addEventListener("DOMContentLoaded", sbQuestionnaireSwitchingSimple.init)</script>' +
  '<div class="widget-container js-questionnaire-switching"><div class="widget-wrapper">' +
  '<div class="widget-item"><p class="q">設問1</p><div class="widget-item-radiobox"><div class="radiobox-item"><input type="radio" id="q1-1" name="q1"><label for="q1-1">はい</label></div></div>' +
  '<div class="widget-item-footer"><p class="note">解説1</p><div class="widget-item-button"><button>次へ</button></div></div></div>' +
  '<div class="widget-item"><p class="q">設問2</p><div class="widget-item-radiobox"><div class="radiobox-item"><input type="radio" id="q2-1" name="q2"><label for="q2-1">はい</label></div></div>' +
  '<div class="widget-item-footer"><p class="note">解説2</p><div class="widget-item-button"><button>最終ボタン</button></div></div></div>' +
  '<div class="widget-item"><p>最後の内容</p></div>' +
  '</div></div><style>.widget-wrapper>*+*{margin-top:16px}</style>'

describe('答えて進むだけの見本を画面①②③に（13015 と同じ形）', () => {
  const html = convertJsSteps(13015, SWITCHING)

  it('問いの要素そのものが画面になり、問いを並べていた親が入れ物になる（親子の CSS がそのまま効く）', () => {
    const holder = parse(html).querySelector('[data-nc-screens]')
    expect(holder?.className).toMatch(/^nc nc-sample nc-[a-z0-9]{8} widget-wrapper$/)
    expect(holder?.parentElement?.className).toBe('widget-container js-questionnaire-switching')
    const screens = screensOf(html)
    expect(screens.map((s) => s.getAttribute('class'))).toEqual(['widget-item nc-screen', 'widget-item nc-screen', 'widget-item nc-screen'])
    expect(screens.map((s) => s.getAttribute('data-nc-name'))).toEqual(['設問①', '設問②', '結果'])
    expect(screens.map((s) => s.hasAttribute('hidden'))).toEqual([false, true, true])
  })

  it('見本自身のスクリプトは外し、画面の切り替えのスクリプトと、隠した画面を必ず隠す指定を入れる', () => {
    expect(html).not.toContain('sbQuestionnaireSwitchingSimple')
    expect(html).toContain(SCREENS_SCRIPT.slice(0, 60))
    const uid = /nc nc-sample (nc-[a-z0-9]{8})/.exec(html)?.[1]
    expect(html).toContain(`.${uid}>[data-nc-screen][hidden]{display:none!important}`)
  })

  it('選ぶと次の画面へ（選択肢と、押す所の label の両方）。答えると出ていた解説は次の画面の頭へ（中の「次へ」は外す）', () => {
    const [first, second, last] = screensOf(html)
    expect(first?.querySelector('input')?.getAttribute('data-nc-go')).toBe('s2')
    expect(first?.querySelector('label')?.getAttribute('data-nc-go')).toBe('s2')
    expect(first?.querySelector('.note')).toBeNull()
    expect(second?.firstElementChild?.querySelector('.note')?.textContent).toBe('解説1')
    expect(second?.querySelector('button')).toBeNull()
    expect(second?.querySelector('input')?.getAttribute('data-nc-go')).toBe('s3')
    expect(last?.firstElementChild?.querySelector('.note')?.textContent).toBe('解説2')
  })

  it('もう分けてある見本・決まりの無い見本はそのまま', () => {
    expect(convertJsSteps(13015, html)).toBe(html)
    expect(convertJsSteps(1, SWITCHING)).toBe(SWITCHING)
  })

  it('Widget編集で開くと、画面ごとの部品に分かれ、問いの要素（見本の class）はそのまま残る', () => {
    const parts = splitSampleScreens(html, parse)
    expect(parts).toHaveLength(3)
    const second = parse(parts[1] ?? '')
    expect(second.querySelector('.widget-wrapper > .widget-item')?.querySelector('.q')?.textContent).toBe('設問2')
    expect(second.querySelectorAll('.widget-item')).toHaveLength(1)
    expect(second.querySelector('[data-nc-screen], [hidden]')).toBeNull()
  })
})

describe('分けた15個（mock-server/seed/sb-widgets）', () => {
  const dir = 'mock-server/seed/sb-widgets'
  const parts = new Map<number, { html: string }>()
  for (const file of readdirSync(dir).filter((name) => name.startsWith('parts-'))) {
    for (const part of JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')) as { id: number; html: string }[]) parts.set(part.id, part)
  }

  it('決まりの数だけ分けてある', () => {
    expect(JS_STEP_IDS).toHaveLength(15)
    expect(new Set(JS_STEP_IDS).size).toBe(15)
  })

  for (const spec of JS_STEP_SPECS) {
    it(`${spec.id}: 最初の画面だけ見え、押す所はどれも同じ入れ物の中の次の画面を指す・見本自身のスクリプトは無い`, () => {
      const html = parts.get(spec.id)?.html ?? ''
      const screens = screensOf(html)
      expect(screens.length).toBeGreaterThanOrEqual(3)
      expect(screens.map((s) => s.hasAttribute('hidden'))).toEqual(screens.map((_, index) => index > 0))
      const ids = screens.map((s) => s.getAttribute('data-nc-screen'))
      for (const [index, screen] of screens.entries()) {
        for (const go of Array.from(screen.querySelectorAll('[data-nc-go]'))) {
          const to = ids.indexOf(go.getAttribute('data-nc-go'))
          expect(to, `${spec.id} ${ids[index]}`).toBeGreaterThanOrEqual(0)
          expect(Math.abs(to - index), `${spec.id} ${ids[index]}`).toBe(1)
        }
        // 最後の画面のほかは、どれも次へ進める
        if (index < screens.length - 1) expect(screen.querySelector(`[data-nc-go="${ids[index + 1]}"]`), `${spec.id} ${ids[index]}`).not.toBeNull()
      }
      for (const script of Array.from(parse(html).querySelectorAll('script'))) {
        expect(spec.script.test(script.textContent ?? '') || spec.script.test(script.getAttribute('src') ?? ''), `${spec.id}`).toBe(false)
      }
      // 入れるたびに名前を付け直せる
      expect(rekeyUid(html, 'nc-zzzzzzzz')).toContain('class="nc nc-sample nc-zzzzzzzz')
    })
  }

  it('下に積み重ねる見本は、Widget編集で開いても「積み重ね」のまま', () => {
    const html = parts.get(12490)?.html ?? ''
    expect(wrapHtmlAsBuilder(html, '12490', BUILDER_TEMPLATE.defaults(new Date(0)), parse)['transition']).toBe('stack')
  })
})
