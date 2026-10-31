/**
 * ほかのサイトの画像を取ってくる（貼り付けた中身の画像を EBIyon に写して置く・2026-10-31 本人の選択「EBIyonに写して置く」）。
 *
 * 外から渡された住所をサーバーが開くので、ここで守る:
 *  - http・https だけ。つなぐ直前に住所（IP）を確かめ、内部の住所は開かない（名前の引き直しでもぐり込めないよう、
 *    確かめた住所にそのままつなぐ＝http.request の lookup）。リダイレクトは3回まで、その先も同じく確かめる
 *  - 中身の先頭が本物の画像（png・jpeg・gif・webp・avif）か動画（mp4・webm）のときだけ返す（SVG・HTML は返さない。
 *    見出しの種類は信じない）。動画は 2026-10-31 本人「動画がコピーできない」で足した
 *  - 大きさ（既定 100MB＝動画も入る）と時間（既定 60秒）に上限
 */
import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP, type LookupFunction } from 'node:net'

export type RemoteImageResult =
  | { readonly ok: true; readonly content: Buffer; readonly mime: string }
  | { readonly ok: false; readonly message: string }

export interface RemoteImageOptions {
  /** つないでよい住所か（既定は外の住所だけ。テストで手元の住所を許すときに渡す） */
  readonly isAllowedAddress?: (address: string) => boolean
  readonly maxBytes?: number
  readonly timeoutMs?: number
}

const MAX_BYTES = 100 * 1024 * 1024
const TIMEOUT_MS = 60_000
const MAX_REDIRECTS = 3
/** 名乗り（名乗らないと断る画像のサイトがある） */
const USER_AGENT = 'Mozilla/5.0 (compatible; EBIyon-image-copy/1.0)'

/** 内部の住所（自分・社内・クラウドの設定置き場・決まった用途の住所） */
const inside = new BlockList()
for (const [net, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) inside.addSubnet(net, bits, 'ipv4')
for (const [net, bits] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96]] as const) {
  inside.addSubnet(net, bits, 'ipv6')
}

/** 外の住所か（壊れた値・内部の住所は false。IPv6 の中の IPv4 も見る） */
export function isPublicAddress(address: string): boolean {
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address)?.[1]
  const ip = mapped ?? address
  const family = isIP(ip)
  if (family === 0) return false
  return !inside.check(ip, family === 4 ? 'ipv4' : 'ipv6')
}

/** 中身の先頭から画像・動画の種類を決める（分からなければ null） */
function sniffImage(head: Buffer): string | null {
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg'
  if (head.length >= 6 && /^GIF8[79]a$/.test(head.subarray(0, 6).toString('latin1'))) return 'image/gif'
  if (head.length >= 12 && head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  if (head.length >= 12 && head.subarray(4, 8).toString('latin1') === 'ftyp') {
    // ftyp の箱は AVIF（画像）と MP4・MOV（動画）で同じ。種類の名前で分ける
    return /^avi[fs]$/.test(head.subarray(8, 12).toString('latin1')) ? 'image/avif' : 'video/mp4'
  }
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'video/webm'
  return null
}

/** 名前を引いて、許した住所だけを返す（つなぐ直前に呼ばれる） */
function guardedLookup(isAllowed: (address: string) => boolean): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error !== null) {
        callback(error, '', 0)
        return
      }
      const list = (addresses as unknown as LookupAddress[]).filter((entry) => isAllowed(entry.address))
      const first = list[0]
      if (first === undefined) {
        callback(Object.assign(new Error('内部の住所には、つなぎません'), { code: 'EBLOCKED' }), '', 0)
        return
      }
      if ((options as { all?: boolean }).all === true) (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list)
      else callback(null, first.address, first.family)
    })
  }
}

function getOnce(url: URL, options: Required<RemoteImageOptions>): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest
    const req = send(url, { method: 'GET', lookup: guardedLookup(options.isAllowedAddress), timeout: options.timeoutMs, headers: { Accept: 'image/*', 'User-Agent': USER_AGENT } }, resolve)
    req.on('timeout', () => req.destroy(new Error('時間がかかりすぎました')))
    req.on('error', reject)
    req.end()
  })
}

/** 住所を確かめる（http・https だけ・名前が IP のときもここで内部を断る） */
function checkUrl(raw: string, isAllowed: (address: string) => boolean): URL | string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return '画像の住所が読めません'
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'http・https の画像だけ取り込めます'
  if (url.username !== '' || url.password !== '') return 'この住所の画像は取り込めません'
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) !== 0 && !isAllowed(host)) return '内部の住所の画像は取り込めません'
  return url
}

export async function fetchRemoteImage(raw: string, given: RemoteImageOptions = {}): Promise<RemoteImageResult> {
  const options: Required<RemoteImageOptions> = {
    isAllowedAddress: given.isAllowedAddress ?? isPublicAddress,
    maxBytes: given.maxBytes ?? MAX_BYTES,
    timeoutMs: given.timeoutMs ?? TIMEOUT_MS,
  }
  let target = raw
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = checkUrl(target, options.isAllowedAddress)
    if (typeof url === 'string') return { ok: false, message: url }
    let res: IncomingMessage
    try {
      res = await getOnce(url, options)
    } catch (error) {
      const blocked = (error as { code?: string }).code === 'EBLOCKED'
      return { ok: false, message: blocked ? '内部の住所の画像は取り込めません' : '画像のサイトにつながりませんでした' }
    }
    const status = res.statusCode ?? 0
    if (status >= 300 && status < 400 && res.headers.location !== undefined) {
      res.resume()
      target = new URL(res.headers.location, url).toString()
      continue
    }
    if (status !== 200) {
      res.resume()
      return { ok: false, message: `画像を取り込めませんでした（${String(status)}）` }
    }
    return readImage(res, options)
  }
  return { ok: false, message: 'リダイレクトが多すぎます' }
}

function readImage(res: IncomingMessage, options: Required<RemoteImageOptions>): Promise<RemoteImageResult> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let size = 0
    res.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > options.maxBytes) {
        res.destroy()
        resolve({ ok: false, message: '画像が大きすぎます' })
        return
      }
      chunks.push(chunk)
    })
    res.on('error', () => resolve({ ok: false, message: '画像を読み込めませんでした' }))
    res.on('end', () => {
      const content = Buffer.concat(chunks)
      const mime = sniffImage(content.subarray(0, 16))
      resolve(mime === null ? { ok: false, message: '画像・動画ではありませんでした' } : { ok: true, content, mime })
    })
  })
}
