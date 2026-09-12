import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_ACCENT,
  darken,
  isHexColor,
  readableInk,
  tint,
} from '../src/app/theme-color.ts'
import { getJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

/**
 * テーマカラー（設定で選べるアクセント色）。
 *
 * 色は画面のあちこちで使うので、変な値が入ると全体が壊れる。
 * 受け付ける形・読める文字色・保存の3点を機械で押さえる。
 */
describe('色として受け付ける形', () => {
  it('#RRGGBB と #RGB を受ける', () => {
    expect(isHexColor('#0091FF')).toBe(true)
    expect(isHexColor('#09f')).toBe(true)
    expect(isHexColor('  #0091ff  ')).toBe(true)
  })

  it('色でない文字列は断る（そのままCSSへ流すと値が差し込まれる）', () => {
    for (const bad of ['', 'red', '0091FF', '#12345', '#GGGGGG', 'red;position:fixed']) {
      expect(isHexColor(bad), bad).toBe(false)
    }
  })
})

describe('アクセント色から派生する色', () => {
  it('ホバー用は元より暗くなる', () => {
    expect(darken('#808080')).not.toBe('#808080')
    expect(Number.parseInt(darken('#808080').slice(1, 3), 16)).toBeLessThan(0x80)
  })

  it('薄い地は元より明るくなる', () => {
    expect(Number.parseInt(tint('#0091FF').slice(1, 3), 16)).toBeGreaterThan(0x00)
    expect(tint('#000000')).not.toBe('#000000')
  })

  it('暗い色の上は白文字、明るい色の上は濃い文字にする（読めなくしない）', () => {
    expect(readableInk('#0091FF')).toBe('#FFFFFF')
    expect(readableInk('#151515')).toBe('#FFFFFF')
    expect(readableInk('#FFEB3B')).toBe('#151515')
    expect(readableInk('#FFFFFF')).toBe('#151515')
  })
})

describe('テーマカラーの保存', () => {
  let server: TestServer
  beforeAll(async () => {
    server = await startTestServer()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    resetStore()
  })

  it('初期値は採取した実物の青', async () => {
    const res = await getJson<{ accent: string }>(`${server.api}/settings/theme`)
    expect(res.accent).toBe(DEFAULT_ACCENT)
  })

  it('保存すると次から返ってくる', async () => {
    const saved = await sendJson('PUT', `${server.api}/settings/theme`, { accent: '#7c3aed' })
    expect(saved.status).toBe(200)
    const res = await getJson<{ accent: string }>(`${server.api}/settings/theme`)
    expect(res.accent).toBe('#7C3AED')
  })

  it('色でない値は断る（CSSへ任意の文字列を流させない）', async () => {
    for (const bad of ['red', 'red;position:fixed', '#12345', '']) {
      const res = await sendJson('PUT', `${server.api}/settings/theme`, { accent: bad })
      expect(res.status, bad).toBe(422)
    }
  })
})

describe('画面は色を直書きせずCSS変数を見る', () => {
  it('共通トークンがCSS変数を通す（1か所変えれば全部に効く）', () => {
    const ui = readFileSync('src/app/ui.ts', 'utf8')
    expect(ui).toContain("primary: 'var(--sb-accent, #0091FF)'")
    expect(ui).toContain('primaryInk')
  })

  it('起動時に描画より先に色を当てる（既定色がちらつかない）', () => {
    const main = readFileSync('src/app/main.ts', 'utf8')
    const applied = main.indexOf('initAccent(')
    const routed = main.indexOf('void route()')
    expect(applied).toBeGreaterThan(0)
    expect(applied).toBeLessThan(routed)
  })

  it('主要画面にアクセント色の直書きが残っていない', () => {
    for (const file of [
      'src/app/pages/heatmap-columns.ts',
      'src/app/pages/report-v2-style.ts',
      'src/app/pages/report-exclusions.ts',
      'src/app/panels/image-resize.ts',
    ]) {
      const src = readFileSync(file, 'utf8')
      // fallback 付きの var() を取り除いたら、生のアクセント色は残らないはず
      const withoutVars = src.replace(/var\(--sb-accent[^)]*\)/g, '')
      expect(withoutVars, file).not.toMatch(/#0091ff|#2563eb/i)
      expect(src, file).toContain('var(--sb-accent')
    }
  })
})

/**
 * サイドバーから色を変えられること（2026-09-13・本人指示）。
 * これまでは「設定＞アカウント」の一番下まで行かないと変えられなかった。
 */
describe('サイドバーから色を切り替えられる', () => {
  it('サイドバーの下部にテーマカラーの項目があり、押すと色の選択が開く', () => {
    const shell = readFileSync('src/app/shell.ts', 'utf8')
    expect(shell).toContain('テーマカラー')
    expect(shell).toContain('openThemeColorMenu')
  })

  it('色の並びは1か所にまとめ、設定画面とサイドバーで同じものを使う', () => {
    const files = ['src/app/panels/theme-color-section.ts', 'src/app/panels/theme-color-menu.ts']
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      // 片方だけ色を足す・並べ替える、が起きないように共通の部品を使う
      expect(src, file).toContain('buildAccentPicker')
      expect(src, file).not.toContain('ACCENT_PRESETS')
    }
  })
})
