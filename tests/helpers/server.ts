/** テスト用にモックサーバーを一時ポートで起動するヘルパ */
import { createServer, request as httpRequest, type Server } from 'node:http'
import { createApp } from '../../mock-server/app.ts'
import { resetState } from '../../mock-server/store/store.ts'

export interface TestServer {
  baseUrl: string
  api: string
  close: () => Promise<void>
}

export async function startTestServer(): Promise<TestServer> {
  const server: Server = createServer(createApp())
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('ポート取得に失敗しました')
  const baseUrl = `http://127.0.0.1:${address.port}`
  return {
    baseUrl,
    api: `${baseUrl}/api/v1`,
    close: () =>
      new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  }
}

export function resetStore(): void {
  resetState()
}

export async function getJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url)
  return (await res.json()) as T
}

export async function getStatus(url: string): Promise<number> {
  const res = await fetch(url)
  return res.status
}

export async function postJson<T = unknown>(
  url: string,
  body: unknown = {},
): Promise<{ status: number; json: T }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, json: (await res.json().catch(() => null)) as T }
}

export async function sendJson<T = unknown>(
  method: 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  body: unknown = {},
): Promise<{ status: number; json: T }> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, json: (await res.json().catch(() => null)) as T }
}

/**
 * Host ヘッダーを指定してリクエストする。
 * fetch は Host を差し替えられない（禁止ヘッダー）ので node:http を直接使う。
 */
export function requestWithHost(
  method: 'GET' | 'POST',
  url: string,
  options: { host: string; body?: string; contentType?: string },
): Promise<{ status: number; text: string }> {
  const target = new URL(url)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        headers: {
          Host: options.host,
          ...(options.contentType === undefined ? {} : { 'Content-Type': options.contentType }),
          ...(options.body === undefined ? {} : { 'Content-Length': Buffer.byteLength(options.body) }),
        },
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => (text += chunk))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text }))
      },
    )
    req.on('error', reject)
    if (options.body !== undefined) req.write(options.body)
    req.end()
  })
}
