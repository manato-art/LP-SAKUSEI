import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { SLACK_SCOPES, SLACK_USER_SCOPES, authorizeUrl, newState, slackCredentials } from '../mock-server/slack.ts'
import { getJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

/**
 * Slack連携。
 *
 * 秘密情報（Client ID / Secret）は環境変数からのみ読み、
 * アクセストークンはレスポンスに出さない。ここを機械で押さえる。
 */
describe('資格情報は環境変数からのみ読む', () => {
  it('両方揃っていないと未設定として扱う', () => {
    const keep = { id: process.env['SLACK_CLIENT_ID'], secret: process.env['SLACK_CLIENT_SECRET'] }
    try {
      delete process.env['SLACK_CLIENT_ID']
      delete process.env['SLACK_CLIENT_SECRET']
      expect(slackCredentials()).toBeNull()

      process.env['SLACK_CLIENT_ID'] = 'abc'
      expect(slackCredentials(), '片方だけでは未設定').toBeNull()

      process.env['SLACK_CLIENT_SECRET'] = 'xyz'
      expect(slackCredentials()).toEqual({ clientId: 'abc', clientSecret: 'xyz' })
    } finally {
      if (keep.id === undefined) delete process.env['SLACK_CLIENT_ID']
      else process.env['SLACK_CLIENT_ID'] = keep.id
      if (keep.secret === undefined) delete process.env['SLACK_CLIENT_SECRET']
      else process.env['SLACK_CLIENT_SECRET'] = keep.secret
    }
  })

  it('コードに資格情報を書かない', () => {
    const src = readFileSync('mock-server/slack.ts', 'utf8')
    expect(src).toContain("process.env['SLACK_CLIENT_ID']")
    expect(src).toContain("process.env['SLACK_CLIENT_SECRET']")
    // 値そのものが埋まっていないこと（Slackのトークン形は xoxb- / xoxp-）
    expect(src).not.toMatch(/xox[bp]-/)
  })
})

describe('認可URL', () => {
  const creds = { clientId: 'cid', clientSecret: 'secret' }

  it('実物と同じ権限を要求する', () => {
    const url = new URL(authorizeUrl(creds, 'https://example.test/cb', 'st'))
    expect(url.origin + url.pathname).toBe('https://slack.com/oauth/v2/authorize')
    expect((url.searchParams.get('scope') ?? '').split(',')).toEqual([...SLACK_SCOPES])
    expect((url.searchParams.get('user_scope') ?? '').split(',')).toEqual([...SLACK_USER_SCOPES])
  })

  it('state を必ず付ける（実物には無いが、無いと差し込みを見分けられない）', () => {
    const url = new URL(authorizeUrl(creds, 'https://example.test/cb', 'st'))
    expect(url.searchParams.get('state')).toBe('st')
  })

  it('URLに Client Secret を出さない', () => {
    expect(authorizeUrl(creds, 'https://example.test/cb', 'st')).not.toContain('secret')
  })

  it('state は毎回変わる', () => {
    expect(newState()).not.toBe(newState())
  })
})

describe('Slack連携のAPI', () => {
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

  it('未設定のときは configured=false と戻り先URLを返す（画面に手順を出すため）', async () => {
    const keep = process.env['SLACK_CLIENT_ID']
    delete process.env['SLACK_CLIENT_ID']
    try {
      const res = await getJson<{ configured: boolean; connected: boolean; redirect_uri: string }>(
        `${server.api}/slack/status`,
      )
      expect(res.configured).toBe(false)
      expect(res.connected).toBe(false)
      expect(res.redirect_uri).toContain('/oauth/slack/callback')
    } finally {
      if (keep !== undefined) process.env['SLACK_CLIENT_ID'] = keep
    }
  })

  it('アクセストークンはレスポンスに出さない', async () => {
    const res = await fetch(`${server.api}/slack/status`)
    const body = await res.text()
    expect(body).not.toContain('access_token')
    expect(body).not.toMatch(/xox[bp]-/)
  })

  it('未連携でチャンネルを取りに行くと断る', async () => {
    const res = await fetch(`${server.api}/slack/channels`)
    expect(res.status).toBe(409)
  })

  it('state が無い戻りは受け付けない', async () => {
    const res = await fetch(`${server.baseUrl}/oauth/slack/callback?code=dummy`, {
      redirect: 'manual',
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

describe('画面は状態ごとに出し分ける', () => {
  const src = readFileSync('src/app/panels/notify-target.ts', 'utf8')

  it('未設定のときは取得手順を出す', () => {
    expect(src).toContain('api.slack.com/apps')
    expect(src).toContain('SLACK_CLIENT_ID')
    expect(src).toContain('SLACK_CLIENT_SECRET')
  })

  it('手順に必要な権限をすべて書く', () => {
    for (const scope of SLACK_SCOPES) {
      expect(src, scope).toContain(scope)
    }
    expect(src).toContain('groups:write.invites')
  })

  it('戻り先URLはコピーできる（アプリ登録にそのまま貼るため）', () => {
    expect(src).toContain('戻り先URL')
    expect(src).toContain('writeText(redirectUri)')
  })

  it('環境変数が入れば連携ボタン、連携済みならチャンネル選択に変わる', () => {
    expect(src).toContain('if (!status.configured)')
    expect(src).toContain('if (!status.connected)')
    expect(src).toContain('api.slackChannels()')
  })
})

describe('通知先はSlackとチャットワークから選べる', () => {
  const src = readFileSync('src/app/panels/notify-target.ts', 'utf8')

  it('3つの選択肢を出す', () => {
    expect(src).toContain("['none', '通知しない']")
    expect(src).toContain("['slack', 'Slack']")
    expect(src).toContain("['chatwork', 'チャットワーク']")
  })

  it('チャットワークはトークンの取得手順を出す（OAuthではない）', () => {
    expect(src).toContain('CHATWORK_API_TOKEN')
    expect(src).toContain('API Token')
    expect(src).toContain('サービス連携')
  })

  it('設定済みなら送り先を選べる', () => {
    expect(src).toContain('api.chatworkRooms()')
    expect(src).toContain('送り先の部屋を選ぶ')
  })

  it('選べる送り先が無いときは欄ごと隠す（空のプルダウンを出さない）', () => {
    expect(src).toContain("destination.style.display = items.length === 0 ? 'none' : ''")
  })

  it('手順の最後は「下の欄に入れて保存」（環境変数は代替として案内する）', () => {
    expect(src).toContain('下の欄に入れて保存する')
    expect(src).toContain('そちらが優先されます')
  })

  it('送り先が未選択なら通知先として扱わない', () => {
    expect(src).toContain("destination.value === ''")
  })
})

describe('チャットワーク連携', () => {
  it('トークンは環境変数からのみ読む', async () => {
    const { chatworkToken } = await import('../mock-server/chatwork.ts')
    const keep = process.env['CHATWORK_API_TOKEN']
    try {
      delete process.env['CHATWORK_API_TOKEN']
      expect(chatworkToken()).toBeNull()
      process.env['CHATWORK_API_TOKEN'] = 'tok'
      expect(chatworkToken()).toBe('tok')
    } finally {
      if (keep === undefined) delete process.env['CHATWORK_API_TOKEN']
      else process.env['CHATWORK_API_TOKEN'] = keep
    }
  })

  it('コードにトークンを書かない', () => {
    const src = readFileSync('mock-server/chatwork.ts', 'utf8')
    expect(src).toContain("process.env['CHATWORK_API_TOKEN']")
  })

  it('ドキュメントどおりの呼び方をする（ヘッダ名・エンドポイント・形式）', () => {
    const src = readFileSync('mock-server/chatwork.ts', 'utf8')
    expect(src).toContain('https://api.chatwork.com/v2')
    expect(src).toContain("'x-chatworktoken'")
    expect(src).toContain('/rooms/${roomId}/messages')
    expect(src).toContain('application/x-www-form-urlencoded')
  })
})

describe('画面だけで設定を完結させる', () => {
  const src = readFileSync('src/app/panels/notify-target.ts', 'utf8')

  it('資格情報を画面から入れられる（環境変数を触りに行かなくていい）', () => {
    expect(src).toContain('api.saveIntegration')
    expect(src).toContain("secretInput('Client ID')")
    expect(src).toContain("secretInput('APIトークン')")
  })

  it('入力欄は伏せ字にする（肩越しに読まれないように）', () => {
    expect(src).toContain("input.type = 'password'")
  })

  it('入れたら次の状態へ進む（保存後に読み直す）', () => {
    expect(src).toContain('sb-credential-saved')
  })

  it('テスト送信で実際に届くか確かめられる', () => {
    expect(src).toContain('api.testNotify')
    expect(src).toContain('テスト送信')
  })

  it('入れたトークンは消せる', () => {
    expect(src).toContain("api.clearIntegration('chatwork')")
  })
})

describe('資格情報は環境変数が優先される', () => {
  it('Slackは環境変数→画面の値の順に読む', () => {
    const src = readFileSync('mock-server/slack.ts', 'utf8')
    expect(src).toContain("process.env['SLACK_CLIENT_ID'] ?? saved.slackClientId")
    expect(src).toContain("process.env['SLACK_CLIENT_SECRET'] ?? saved.slackClientSecret")
  })

  it('チャットワークも同じ順', () => {
    const src = readFileSync('mock-server/chatwork.ts', 'utf8')
    expect(src).toContain("process.env['CHATWORK_API_TOKEN'] ?? getState().integrations.chatworkApiToken")
  })

  it('入れた値はAPIのレスポンスに返さない', () => {
    const src = readFileSync('mock-server/routes/slack.ts', 'utf8')
    const handler = src.slice(src.indexOf("slackRouter.get('/integrations'"), src.indexOf("slackRouter.put('/integrations'"))
    expect(handler).not.toContain('slackClientSecret,')
    expect(handler).not.toContain('chatworkApiToken,')
    expect(handler).toContain('has_saved')
  })
})

describe('タスクの通知本文', () => {
  it('数字が無いときは0件と書かず、無いことを書く（数字を発明しない）', () => {
    const src = readFileSync('mock-server/task-report.ts', 'utf8')
    expect(src).toContain('この期間に計測されたアクセスはありませんでした')
  })

  it('装飾を付けない（チャットワークはMarkdownを解釈しないため）', async () => {
    const { buildTaskReport } = await import('../mock-server/task-report.ts')
    const text = buildTaskReport('テスト', 'today')
    // 見出し・太字・箇条書き記号を使わない
    expect(text).not.toMatch(/^#|\*\*|^[*-] /m)
    expect(text).toContain('[テスト]')
  })
})
