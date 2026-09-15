/**
 * 設定のかたまり（`integrations`）に後から足したキーが、古い保存データでも既定値で埋まること（2026-09-15）。
 *
 * 【起きたこと】本番で、LINEのトークンを1度も入れていないのに
 * 「トークンが設定されています」と出て、入力欄が出せなくなった。
 *
 * 【原因】読み込み時の移行処理は**最上位のキーしか見ない**。`integrations` は
 * 既に保存されているので丸ごとそのまま残り、あとから足した `lineChannelAccessToken` だけが
 * `undefined` になる。`lineToken()` は `?? ` と `=== ''` で見ていたので、
 * `undefined` はどちらにも当たらずそのまま返り、「入っている」と誤判定した。
 *
 * 無い値を「入っている」と読むのは、次に足すキーでも必ず同じことが起きる。
 * 移行処理と読み出しの両方で塞ぐ。
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import { lineToken } from '../mock-server/line.ts'
import { chatworkToken } from '../mock-server/chatwork.ts'
import { setState } from '../mock-server/store/store.ts'

const dataDir = mkdtempSync(join(tmpdir(), 'lp-sakusei-nested-'))

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(dataDir, { recursive: true, force: true })
})

describe('古い保存データの読み戻し', () => {
  it('integrations に後から足したキーが既定値で埋まる', async () => {
    // LINE連携を足す前の形（3つしか無い）
    const old = createEmptyState() as unknown as Record<string, unknown>
    old['integrations'] = {
      slackClientId: '',
      slackClientSecret: '',
      chatworkApiToken: 'CW_SAVED',
    }
    writeFileSync(join(dataDir, 'state.json'), JSON.stringify(old))

    vi.stubEnv('DATA_DIR', dataDir)
    vi.resetModules()
    const { loadPersistedState } = await import('../mock-server/store/persistence.ts')
    const loaded = loadPersistedState()
    if (loaded === null) throw new Error('保存データを読み戻せませんでした')

    expect(loaded.integrations.lineChannelAccessToken, '足したキーは空文字で埋まる').toBe('')
    expect(loaded.integrations.chatworkApiToken, '元から入っていた値は消さない').toBe('CW_SAVED')
  })

  it('空シードにある integrations のキーが全部そろう（次に足すキーも同じように守る）', async () => {
    writeFileSync(join(dataDir, 'state.json'), JSON.stringify({ integrations: {} }))
    vi.stubEnv('DATA_DIR', dataDir)
    vi.resetModules()
    const { loadPersistedState } = await import('../mock-server/store/persistence.ts')
    const loaded = loadPersistedState()
    if (loaded === null) throw new Error('保存データを読み戻せませんでした')

    expect(Object.keys(loaded.integrations).sort()).toEqual(
      Object.keys(createEmptyState().integrations).sort(),
    )
  })
})

describe('トークンの読み出しは「無い」を「入っている」と読まない', () => {
  const keepLine = process.env['LINE_CHANNEL_ACCESS_TOKEN']
  const keepChatwork = process.env['CHATWORK_API_TOKEN']

  afterAll(() => {
    if (keepLine === undefined) delete process.env['LINE_CHANNEL_ACCESS_TOKEN']
    else process.env['LINE_CHANNEL_ACCESS_TOKEN'] = keepLine
    if (keepChatwork === undefined) delete process.env['CHATWORK_API_TOKEN']
    else process.env['CHATWORK_API_TOKEN'] = keepChatwork
  })

  it('キーごと無いときは未設定として扱う（LINE）', () => {
    delete process.env['LINE_CHANNEL_ACCESS_TOKEN']
    setState((s) => {
      const { lineChannelAccessToken: _drop, ...rest } = s.integrations
      return { ...s, integrations: rest as typeof s.integrations }
    })
    expect(lineToken()).toBeNull()
  })

  it('キーごと無いときは未設定として扱う（チャットワーク）', () => {
    delete process.env['CHATWORK_API_TOKEN']
    setState((s) => {
      const { chatworkApiToken: _drop, ...rest } = s.integrations
      return { ...s, integrations: rest as typeof s.integrations }
    })
    expect(chatworkToken()).toBeNull()
  })
})
