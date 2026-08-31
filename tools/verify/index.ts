/**
 * 検証ランナー（企画書 §13）。`npm run verify` 一撃で回す。
 *
 * 今のフェーズ（P0/P1・採取前）で実際に判定できるゲートは実走させ、
 * 採取物が要るゲートは「保留」として理由付きで明示する。
 * 保留を黙って省略しない＝合格に見せかけないための設計（§12「機械チェックで証明してから言う」）。
 */
import { execFileSync } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { existsSync, readdirSync } from 'node:fs'
import { createApp } from '../../mock-server/app.ts'
import { ENDPOINT_CATALOG, REPORT_CATALOG, type EndpointCheck } from './endpoints.ts'

type Status = 'pass' | 'fail' | 'pending'

interface GateResult {
  id: string
  title: string
  status: Status
  detail: string
}

function runCommand(id: string, title: string, command: string, args: string[]): GateResult {
  try {
    execFileSync(command, args, { stdio: 'pipe', encoding: 'utf8' })
    return { id, title, status: 'pass', detail: `${command} ${args.join(' ')}` }
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string }
    const output = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim().split('\n').slice(-8).join('\n')
    return { id, title, status: 'fail', detail: output || `${command} が失敗しました` }
  }
}

/** §13-B: エンドポイントカタログ（§10-3）が全て意図したステータスを返すか */
async function verifyEndpoints(): Promise<GateResult> {
  const server: Server = createServer(createApp())
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') {
    return { id: '13-B', title: 'エンドポイント網羅', status: 'fail', detail: 'ポート取得失敗' }
  }
  const base = `http://127.0.0.1:${address.port}`
  const failures: string[] = []

  try {
    // 作成系の前提を作る（作成フローが通らないとパラメータ付きが検査できない）
    const post = async (path: string, body: unknown): Promise<Record<string, never>> => {
      const res = await fetch(`${base}/api/v1${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return (await res.json()) as Record<string, never>
    }
    const folder = (await post('/folders', { name: 'サンプルフォルダ001' })) as unknown as {
      folder: { uid: string; id: number }
    }
    const created = (await post('/ab_tests', {
      title: 'サンプル施策001',
      folder_id: folder.folder.id,
      media_id: 1,
    })) as unknown as {
      ab_test: { uid: string }
      article: { uid: string }
      version: { uid: string }
    }

    const tokens: Record<string, string> = {
      '{folder}': folder.folder.uid,
      '{abTest}': created.ab_test.uid,
      '{article}': created.article.uid,
      '{version}': created.version.uid,
      '{plan}': 'PLAN_0001',
      '{team}': 'TEAM_0001',
      '{member}': 'MEMBER_0001',
    }
    const resolve = (path: string): string =>
      Object.entries(tokens).reduce((acc, [k, v]) => acc.split(k).join(v), path)

    const check = async (prefix: string, entry: EndpointCheck): Promise<void> => {
      const url = `${base}${prefix}${resolve(entry.path)}`
      const res = await fetch(url, {
        method: entry.method,
        headers: { 'Content-Type': 'application/json' },
        ...(entry.method === 'GET' || entry.method === 'DELETE'
          ? {}
          : { body: JSON.stringify(entry.body ?? {}) }),
      })
      const expected = entry.expect ?? 200
      if (res.status !== expected) {
        failures.push(`${entry.method} ${entry.path} → ${res.status}（期待 ${expected}）`)
      }
    }

    const ordered = [...ENDPOINT_CATALOG].sort(
      (a, b) => Number(a.destructive ?? false) - Number(b.destructive ?? false),
    )
    for (const entry of ordered) await check('/api/v1', entry)
    for (const entry of REPORT_CATALOG) await check('/report', entry)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  const total = ENDPOINT_CATALOG.length + REPORT_CATALOG.length
  return failures.length === 0
    ? { id: '13-B', title: 'エンドポイント網羅（§10-3）', status: 'pass', detail: `${total}件すべて期待どおり` }
    : {
        id: '13-B',
        title: 'エンドポイント網羅（§10-3）',
        status: 'fail',
        detail: `${failures.length}/${total}件が不一致:\n  ${failures.slice(0, 15).join('\n  ')}`,
      }
}

/** 採取物が入っているか（保留ゲートの判定材料） */
function captureReady(): boolean {
  const dir = 'capture/clean'
  return existsSync(dir) && readdirSync(dir).length > 0
}

function pendingGate(id: string, title: string, reason: string): GateResult {
  return { id, title, status: 'pending', detail: reason }
}

async function main(): Promise<void> {
  const hasCaptures = captureReady()

  const results: GateResult[] = [
    runCommand('13-H', '型チェック（tsc）', 'npx', ['tsc', '--noEmit']),
    runCommand('13-H', 'lint（eslint）', 'npx', ['eslint', '.']),
    runCommand('13-H', 'テスト（vitest）', 'npx', ['vitest', 'run']),
    runCommand('13-E/F/G', '実データ・本番ドメイン・外部SaaS 静的スキャン', 'npx', [
      'tsx',
      'tools/gate/grep-gate.ts',
    ]),
    await verifyEndpoints(),
  ]

  /**
   * 実行時ゲート（§13-A/B/C/D/F）は **Playwrightハーネスと土台化されたクローンの両方**が要る。
   * どちらも未完成なので、採取物の有無に関わらず必ず「保留」として出す。
   * 採取が進んだだけで保留が消えると「合格に見える」ため、そうしない。
   */
  const captureNote = hasCaptures
    ? '採取物あり。ただし土台化（rehydrate）が未着手。'
    : 'capture/clean/ が空（採取フェーズ未完了）。'
  const reason = `${captureNote} Playwright検証ハーネスも未実装のため判定不能。`
  results.push(
    pendingGate('13-A', '視覚一致率（SSIM≥0.98 / 差分≤1.0%）', reason),
    pendingGate('13-B', '全ルート到達クローラ（#root非空・console error 0）', reason),
    pendingGate('13-C', '全状態表示（状態インベントリ準拠）', reason),
    pendingGate('13-D', 'インタラクション & ナビグラフ全走行', `${reason} 一覧応答契約の部分は vitest で検証済み。`),
    pendingGate('13-F', '巡回中の外部ホストへのリクエスト0件（Playwright記録）', reason),
  )

  const icon = { pass: 'PASS', fail: 'FAIL', pending: 'PEND' } as const
  console.log('\n===== npm run verify（企画書 §13）=====\n')
  for (const r of results) {
    console.log(`[${icon[r.status]}] §${r.id} ${r.title}`)
    if (r.status !== 'pass') {
      for (const line of r.detail.split('\n')) console.log(`       ${line}`)
    }
  }

  const failed = results.filter((r) => r.status === 'fail')
  const pending = results.filter((r) => r.status === 'pending')
  console.log(
    `\n合格 ${results.filter((r) => r.status === 'pass').length} / 不合格 ${failed.length} / 保留 ${pending.length}`,
  )
  if (pending.length > 0) {
    console.log('保留は「未判定」であって合格ではない。採取フェーズ完了後に再実行すること。')
  }
  if (failed.length > 0) process.exitCode = 1
}

void main()
