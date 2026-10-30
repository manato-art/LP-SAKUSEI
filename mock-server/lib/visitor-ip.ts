/**
 * 見に来た人の住所（IP）。計測の記録・レポート除外（配信）とログインの回数制限が使う。
 *
 * Railway の受付は X-Forwarded-For の先頭を「直前の相手」にする。c1page.com は Cloudflare を通るので（2026-10-30〜）、
 * 直前の相手は Cloudflare の住所になり、Cloudflare を通った訪問は全員が Cloudflare の住所に見えていた
 * （本番の記録で 4件中4件・141.101.x / 172.70.x）。IP でのレポート除外が c1page.com のLPでは効かなかった。
 *
 * 直前の相手が Cloudflare の公開範囲のときだけ、Cloudflare が付ける CF-Connecting-IP（本当の訪問者）を使う。
 * それ以外では CF-Connecting-IP を見ない（Cloudflare を通らずに来た人が、住所を名乗って偽れないように）。
 */
import { BlockList, isIP } from 'node:net'

/**
 * Cloudflare の公開範囲（Cloudflare 公式の「IP Ranges」ページ ips-v4・ips-v6 を 2026-10-30 に取得）。
 * Cloudflare が範囲を増やしたら、ここを足す（足すまでは、その範囲から来た人は Cloudflare の住所で記録される）。
 */
const CLOUDFLARE_V4 = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
] as const
const CLOUDFLARE_V6 = [
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
  '2a06:98c0::/29', '2c0f:f248::/32',
] as const

const cloudflare = new BlockList()
for (const range of CLOUDFLARE_V4) {
  const [net, bits] = range.split('/')
  cloudflare.addSubnet(net ?? '', Number(bits), 'ipv4')
}
for (const range of CLOUDFLARE_V6) {
  const [net, bits] = range.split('/')
  cloudflare.addSubnet(net ?? '', Number(bits), 'ipv6')
}

/** Cloudflare の住所か（壊れた値は false） */
export function isCloudflareIp(ip: string): boolean {
  const family = isIP(ip)
  if (family === 0) return false
  return cloudflare.check(ip, family === 4 ? 'ipv4' : 'ipv6')
}

/**
 * 見に来た人の住所。header はリクエストの見出しを名前で引くもの（Express の req.get）、
 * fallback は X-Forwarded-For が無いときに使う、つながっている相手の住所（req.ip）。
 */
export function visitorIp(header: (name: string) => string | undefined, fallback: string): string {
  const peer = header('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  if (peer === '') return fallback
  if (!isCloudflareIp(peer)) return peer
  const real = header('cf-connecting-ip')?.trim() ?? ''
  return isIP(real) === 0 ? peer : real
}
