/**
 * 保存データを読み戻したとき、Version設定（記事ごとの文字サイズ・色・背景など）が消えないことの機械証明（2026-09-11）。
 *
 * 読み込み時の移行処理（store/persistence.ts の migrateState）は「空シードにあるキー」だけを残す。
 * Version設定（masterStyleSheets）は State へ後から足したキーで、空シードに無かったため、
 * サーバーが再起動するたび（＝main に push するたび）に保存したVersion設定が全部消えていた。
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import {
  DEFAULT_MASTER_STYLE_SHEET,
  getMasterStyleSheet,
  putMasterStyleSheet,
} from '../mock-server/store/master-style-sheet.ts'

const dataDir = mkdtempSync(join(tmpdir(), 'lp-sakusei-persist-'))

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(dataDir, { recursive: true, force: true })
})

/** `declare module './types.ts'` で State に足しているキー */
function collectAugmentedStateKeys(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return collectAugmentedStateKeys(path)
    if (!path.endsWith('.ts')) return []
    const src = readFileSync(path, 'utf8')
    return [...src.matchAll(/declare module '\.\/types\.ts' \{\s*interface State \{([\s\S]*?)\n\s*\}\s*\n\}/g)].flatMap(
      (block) => [...(block[1] ?? '').matchAll(/^\s*(?:readonly\s+)?(\w+)\??:/gm)].map((m) => m[1] ?? ''),
    )
  })
}

describe('保存データの読み戻し', () => {
  it('保存したVersion設定が、再起動のあとも残る', async () => {
    const saved = putMasterStyleSheet(createEmptyState(), 'ARTICLE_0101', {
      ...DEFAULT_MASTER_STYLE_SHEET,
      font_size: 21,
      color: 'ff0000',
    })
    writeFileSync(join(dataDir, 'state.json'), JSON.stringify(saved))
    // persistence.ts は読み込んだ時点の DATA_DIR を使うので、設定してから読み込む
    vi.stubEnv('DATA_DIR', dataDir)
    vi.resetModules()
    const { loadPersistedState } = await import('../mock-server/store/persistence.ts')
    const loaded = loadPersistedState()
    if (loaded === null) throw new Error('保存データを読み戻せませんでした')
    const sheet = getMasterStyleSheet(loaded, 'ARTICLE_0101')
    expect(sheet.font_size).toBe(21)
    expect(sheet.color).toBe('ff0000')
  })

  it('新しい項目が無い古い保存データでも、空シードの値で補われる（undefined のまま使わない）', async () => {
    const old = createEmptyState() as unknown as Record<string, unknown>
    delete old['quickDomainBase']
    writeFileSync(join(dataDir, 'state.json'), JSON.stringify(old))
    vi.stubEnv('DATA_DIR', dataDir)
    vi.resetModules()
    const { loadPersistedState } = await import('../mock-server/store/persistence.ts')
    const loaded = loadPersistedState()
    if (loaded === null) throw new Error('保存データを読み戻せませんでした')
    expect(loaded.quickDomainBase).toBe('')
  })
})

describe('State に後から足したキーは、空シードにも入れる（入れないと再起動で消える）', () => {
  it('`declare module ./types.ts` で足したキーが、すべて空シードにある', () => {
    const seedKeys = new Set(Object.keys(createEmptyState()))
    const added = collectAugmentedStateKeys('mock-server')
    expect(added.length).toBeGreaterThan(0)
    expect(added.filter((key) => !seedKeys.has(key))).toEqual([])
  })
})
