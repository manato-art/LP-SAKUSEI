import { describe, it, expect } from 'vitest'
import { buildCollectedMap } from '../tools/scrub/collect.ts'

/** ファイル名 → 中身。実ファイルを作らずに辞書づくりだけを確かめる。 */
function read(files: Record<string, string>): (file: string) => string {
  return (file) => files[file] ?? ''
}

describe('辞書づくり（どのファイルから何を拾うか）', () => {
  it('api-urls.json のURLから実IDを拾う', () => {
    const files = {
      'routes/lp/default/api-urls.json': JSON.stringify([
        'https://api.example.test/api/v1/ab_tests/9182736/unarchived_versions',
      ]),
    }
    const map = buildCollectedMap(Object.keys(files), read(files), [])
    expect(map['9182736']?.category).toBe('uid')
  })

  /**
   * meta.json は採取ツール自身の記録。`title` はブラウザのページタイトル＝製品の名前で、
   * ユーザーデータではない。ここを辞書に入れると製品名「Squad beyond」が
   * 施策名として全ページで置換され、画面の文言が壊れる（2026-09-15に実際に起きた）。
   */
  it('meta.json のタイトルは辞書に入れない', () => {
    const files = {
      'routes/lp/default/meta.json': JSON.stringify({
        url: 'https://app.example.test/ab_tests/abcDEF123/reports/lp',
        title: 'Squad beyond',
      }),
    }
    const map = buildCollectedMap(Object.keys(files), read(files), [])
    expect(map['Squad beyond']).toBeUndefined()
  })

  it('meta.json でもURLの実IDは拾う（リンク先が土台に残るため）', () => {
    const files = {
      'routes/lp/default/meta.json': JSON.stringify({
        url: 'https://app.example.test/ab_tests/abcDEF123/reports/lp',
        title: 'Squad beyond',
      }),
    }
    const map = buildCollectedMap(Object.keys(files), read(files), [])
    expect(map['abcDEF123']?.category).toBe('uid')
  })

  it('fixtures の施策名は今までどおり拾う', () => {
    const files = {
      'routes/fixtures/ab_tests.json': JSON.stringify([{ name: '極秘キャンペーン' }]),
    }
    const map = buildCollectedMap(Object.keys(files), read(files), [])
    expect(map['極秘キャンペーン']).toBeDefined()
  })
})
