/**
 * 独自ドメインが「このシステムに届くか」を確かめる（ドメイン画面の「確認する」）。
 *
 *   1. DNSを引く（読むだけ。DNSの設定は一切変えない）。見つからなければ「エラー」
 *   2. 内部のアドレス（127.0.0.1 や 10.x など）を指していたら確かめに行かない（社内の機械を叩かない）
 *   3. https://<ドメイン>/__mock/health が このシステムの応答（{"ok":true}）を返せば「アクティブ・SSL ON」
 *   4. https で届かず http だけで届けば「アクティブ・SSL OFF」（証明書がまだ）
 *   5. どちらも届かなければ「確認中」のまま（DNSは向いているが、まだこのシステムに来ていない）
 * どの段も時間を区切る（応答が返ってこないドメインで画面が止まらないように）。
 */
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export interface DomainCheckDeps {
  /** ホスト名 → IPアドレスの一覧 */
  lookup: (host: string) => Promise<string[]>
  /** URL を取りに行く（時間切れは呼び出し側の signal で止める） */
  fetchUrl: (url: string, signal: AbortSignal) => Promise<Response>
  /** 1段あたりの待ち時間（ミリ秒） */
  timeoutMs: number
}

export interface DomainCheckResult {
  status: 'active' | 'pending' | 'error'
  ssl: boolean
  /** 画面に出す短い説明 */
  message: string
}

export const DEFAULT_DOMAIN_CHECK_DEPS: DomainCheckDeps = {
  lookup: async (host) => (await dnsLookup(host, { all: true })).map((a) => a.address),
  fetchUrl: (url, signal) => fetch(url, { signal, redirect: 'manual' }),
  timeoutMs: 6000,
}

/** 内部（私設・ループバック・リンクローカル等）のアドレスか */
export function isInternalAddress(address: string): boolean {
  const v4 = address.startsWith('::ffff:') ? address.slice(7) : address
  if (isIP(v4) === 4) {
    const [a = 0, b = 0] = v4.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    )
  }
  const v6 = address.toLowerCase()
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

/** このシステムの health（{"ok":true}）が返るか。届かない・違う応答なら false */
async function reachesThisSystem(url: string, deps: DomainCheckDeps): Promise<boolean> {
  const controller = new AbortController()
  try {
    const res = await withTimeout(deps.fetchUrl(url, controller.signal), deps.timeoutMs)
    if (!res.ok) return false
    const body = (await withTimeout(res.json() as Promise<unknown>, deps.timeoutMs)) as { ok?: unknown } | null
    return body?.ok === true
  } catch {
    // 届かない・時間切れ・JSONでない＝このシステムには届いていない（理由は画面の説明で伝える）
    return false
  } finally {
    controller.abort()
  }
}

export async function checkDomainReachability(
  host: string,
  deps: DomainCheckDeps = DEFAULT_DOMAIN_CHECK_DEPS,
): Promise<DomainCheckResult> {
  let addresses: string[]
  try {
    addresses = await withTimeout(deps.lookup(host), deps.timeoutMs)
  } catch {
    return {
      status: 'error',
      ssl: false,
      message: 'DNSで見つかりませんでした。DNSの設定がまだか、ドメイン名が違います（反映まで時間がかかることもあります）。',
    }
  }
  if (addresses.length === 0 || addresses.some(isInternalAddress)) {
    return { status: 'error', ssl: false, message: 'DNSが内部のアドレスを指しているため、確かめられません。' }
  }
  if (await reachesThisSystem(`https://${host}/__mock/health`, deps)) {
    return { status: 'active', ssl: true, message: 'HTTPSでこのシステムに届いています。' }
  }
  if (await reachesThisSystem(`http://${host}/__mock/health`, deps)) {
    return {
      status: 'active',
      ssl: false,
      message: 'HTTPでは届いていますが、HTTPSでは開けません（証明書の発行待ちの可能性があります）。',
    }
  }
  return {
    status: 'pending',
    ssl: false,
    message: 'DNSは見つかりましたが、まだこのシステムに届いていません。向け先の設定を確認してください。',
  }
}
