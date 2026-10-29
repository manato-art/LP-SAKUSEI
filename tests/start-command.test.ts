/**
 * 本番の起動の決まり（2026-10-29）。
 *
 * 本番（Railway）は `npm start` を1番目のプロセスとして動かし、止めるときは npm へ SIGTERM を送る。
 * npm はそれを `sh -c "<start の中身>"` へ渡すが、Linux の sh（dash）は受け取ると自分だけ終わり、その先の tsx・node へは渡さない。
 * そのため止める前の保存（mock-server/index.ts の SIGTERM）が一度も動かず、本番のログには「npm error signal SIGTERM」だけが出ていた。
 * `exec` で sh を tsx に置き換えると、npm → tsx → node と SIGTERM が届く（tsx は node へ渡す）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('本番の起動', () => {
  it('start は exec で tsx を動かす（止める合図がサーバーまで届く）', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
    expect(pkg.scripts['start']).toMatch(/\bexec tsx mock-server\/index\.ts$/)
    expect(pkg.scripts['start']).toContain('SERVE_DIST=dist')
  })
})
