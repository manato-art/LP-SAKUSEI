import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { routeWordsFromPaths, loadRouteWordsFromManifest } from '../tools/shared/url-identifier.ts'

describe('ルート表からルートの固定語を取り出す', () => {
  it('パスを分解して語だけ取る', () => {
    expect(routeWordsFromPaths(['/ab_tests/:uid/articles'])).toEqual(['ab_tests', 'articles'])
  })

  it(':param は語として扱わない', () => {
    expect(routeWordsFromPaths(['/folders/:folder_uid'])).toEqual(['folders'])
  })

  it('重複を畳む', () => {
    expect(routeWordsFromPaths(['/a/b', '/a/c'])).toEqual(['a', 'b', 'c'])
  })

  it('実際の routes.json を読める（形が変わったら気づけるようにする）', () => {
    const words = loadRouteWordsFromManifest(readFileSync('docs/routes.json', 'utf8'))
    expect(words).toContain('ab_tests')
    expect(words).toContain('articles')
    expect(words).toContain('exit_popups')
    expect(words.length).toBeGreaterThan(20)
  })

  it('routes 配列が無ければ黙って空を返さずエラーにする', () => {
    expect(() => loadRouteWordsFromManifest('{"total_lines":81}')).toThrow(/routes/)
  })
})
