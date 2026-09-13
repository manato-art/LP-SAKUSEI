/**
 * ライト／ダークの切り替え（2026-09-13・本人指示「ダークモードの実装。デフォルトはライト」）。
 *
 * 既定はライト＝今までと同じ見た目。ダークのときだけ上書きCSSを読み込む。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { isThemeMode } from '../src/app/theme-mode.ts'
import { getJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

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

describe('表示モードの保存', () => {
  it('はじめはライト', async () => {
    const data = await getJson<{ accent: string; mode: string }>(`${server.api}/settings/theme`)
    expect(data.mode).toBe('light')
  })

  it('ダークにできる', async () => {
    const res = await sendJson('PUT', `${server.api}/settings/theme`, { mode: 'dark' })
    expect(res.status).toBe(200)
    const data = await getJson<{ mode: string }>(`${server.api}/settings/theme`)
    expect(data.mode).toBe('dark')
  })

  it('知らない値は受け付けない', async () => {
    const res = await sendJson('PUT', `${server.api}/settings/theme`, { mode: 'sepia' })
    expect(res.status).toBe(422)
    const data = await getJson<{ mode: string }>(`${server.api}/settings/theme`)
    expect(data.mode).toBe('light')
  })

  it('色を変えても表示モードは消えない', async () => {
    await sendJson('PUT', `${server.api}/settings/theme`, { mode: 'dark' })
    await sendJson('PUT', `${server.api}/settings/theme`, { accent: '#12A150' })
    const data = await getJson<{ accent: string; mode: string }>(`${server.api}/settings/theme`)
    expect(data).toMatchObject({ accent: '#12A150', mode: 'dark' })
  })

  it('表示モードだけ変えても色は消えない', async () => {
    await sendJson('PUT', `${server.api}/settings/theme`, { accent: '#12A150' })
    await sendJson('PUT', `${server.api}/settings/theme`, { mode: 'dark' })
    const data = await getJson<{ accent: string; mode: string }>(`${server.api}/settings/theme`)
    expect(data).toMatchObject({ accent: '#12A150', mode: 'dark' })
  })
})

describe('受け付ける値', () => {
  it('light と dark だけ', () => {
    expect(isThemeMode('light')).toBe(true)
    expect(isThemeMode('dark')).toBe(true)
    for (const bad of ['', 'auto', 'system', null, undefined, 1]) {
      expect(isThemeMode(bad), String(bad)).toBe(false)
    }
  })
})

describe('ライトのままなら今までと同じ', () => {
  it('ダーク用の上書きCSSは、ダークになってはじめて読み込む', () => {
    const src = readFileSync('src/app/theme-mode.ts', 'utf8')
    // 静的に <link> を置かず、ダークのときだけ差し込む
    expect(src).toContain('ensureDarkStylesheet')
    const html = readFileSync('src/index.html', 'utf8')
    expect(html).not.toContain('dark.css')
  })

  it('ライトの色は今までの値のまま（地・面・文字）', () => {
    const html = readFileSync('src/index.html', 'utf8')
    expect(html).toContain('--sb-bg: #ECECEC')
    expect(html).toContain('--sb-surface: #FFFFFF')
    expect(html).toContain('--sb-text: #151515')
    expect(html).toContain('--sb-sub: #808080')
  })

  it('画面は色を直書きせず、ui.ts の T が CSS変数を通す', () => {
    const ui = readFileSync('src/app/ui.ts', 'utf8')
    for (const token of ['--sb-bg', '--sb-surface', '--sb-text', '--sb-sub', '--sb-neutral']) {
      expect(ui, token).toContain(token)
    }
  })
})

describe('自動生成した上書きCSS', () => {
  const dark = readFileSync('capture/clean/_merged/dark.css', 'utf8')

  it('すべてダークのときだけ効く（ライトに影響しない）', () => {
    const selectors = dark
      .split('\n')
      .filter((line) => line.includes('{') && !line.startsWith('@') && !line.startsWith('/*') && !line.startsWith(' *'))
    expect(selectors.length).toBeGreaterThan(100)
    expect(selectors.filter((line) => !line.includes('html[data-theme="dark"]'))).toEqual([])
  })

  it('ユーザーのLPそのもの（.ql-editor 配下）は暗くしない', () => {
    expect(dark).not.toContain('.ql-editor')
  })
})

describe('直書きの色を置き換えた変数', () => {
  const html = readFileSync('src/index.html', 'utf8')

  /** src/app の中で使っている --sb-c-xxxxxx を全部集める */
  function usedTokens(dir: string): Set<string> {
    const out = new Set<string>()
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        for (const t of usedTokens(path)) out.add(t)
        continue
      }
      if (!path.endsWith('.ts')) continue
      for (const m of readFileSync(path, 'utf8').matchAll(/--sb-c-[0-9a-f]{6}/g)) out.add(m[0])
    }
    return out
  }

  it('使っている変数はすべて、ライトとダークの両方で定義されている', () => {
    const used = [...usedTokens('src/app')]
    expect(used.length).toBeGreaterThan(50)
    const missing = used.filter((token) => {
      const light = html.includes(`${token}: #`)
      const dark = html.includes(`${token}: rgb(`)
      return !(light && dark)
    })
    expect(missing).toEqual([])
  })

  it('ライト側の定義は元の色のまま（見た目を変えていない）', () => {
    for (const m of html.matchAll(/--sb-c-([0-9a-f]{6}): #([0-9A-F]{6});/g)) {
      expect(m[2]?.toLowerCase()).toBe(m[1])
    }
  })
})

describe('ユーザーのLPそのものには、テーマの色を持ち込まない', () => {
  /**
   * LPに差し込まれる中身（離脱防止・追従ポップアップのプリセット、Widget）は、
   * 配信されたときにこのシステムのCSS変数が無い。変数を書き込むと色が消えるので、
   * これらのファイルでは直の色のままにしておく。
   */
  const LP_CONTENT_FILES = [
    'src/app/pages/exit-popup-presets.ts',
    'src/app/pages/follow-popup-presets.ts',
    'src/app/panels/widget-library.ts',
    'src/app/panels/widget-creator.ts',
    'src/app/panels/widget-visual-editor.ts',
  ]

  it('LPに差し込む中身のファイルに、テーマの色変数が入っていない', () => {
    for (const file of LP_CONTENT_FILES) {
      expect(readFileSync(file, 'utf8'), file).not.toContain('--sb-c-')
    }
  })

  it('LPの下地は、ダークでも白のまま（作った人が決めた見た目を変えない）', () => {
    const css = readFileSync('src/app/styles/mockup-master.ts', 'utf8')
    expect(css).toContain('var(--lp-page-bg, #ffffff)')
  })
})
