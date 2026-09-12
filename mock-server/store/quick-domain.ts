/**
 * クイックドメイン（2026-09-13・本人承認）＝本体の「フリードメイン」にあたる仕組み。
 *
 * 本体は、購入もDNS設定も要らずに使えるドメインをその場で配る。同じことをするには
 * **土台ドメインを1本だけ**このシステムへワイルドカード（`*.土台`）で向けておけばよい。
 * そのあとは `<ランダム>.<土台>` を作るだけで、フォルダごとのドメインがすぐ使える。
 */
import { randomInt } from 'node:crypto'
import { isHostName } from './folder-domain.ts'

/** ランダム部分の文字数と使う文字（紛らわしい文字も含めて素直な英数字） */
const LABEL_LENGTH = 8
const LABEL_CHARS = 'abcdefghijklmnopqrstuvwxyz' + '0123456789'

/**
 * 土台ドメインとして受け取った値を整える（受け付けられない形なら null）。
 * Railway の画面には `*.example.com` と出るので、先頭の `*.` は付いたままでも受け付ける。
 */
export function normalizeQuickDomainBase(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let value = raw.trim().toLowerCase()
  if (value === '') return ''
  if (value.startsWith('*.')) value = value.slice(2)
  if (value.endsWith('.')) value = value.slice(0, -1)
  return isHostName(value) ? value : null
}

/** ランダムなラベルを1つ作る */
function randomLabel(): string {
  let out = ''
  for (let i = 0; i < LABEL_LENGTH; i += 1) out += LABEL_CHARS[randomInt(LABEL_CHARS.length)]
  return out
}

/**
 * 土台ドメインの下に、まだ使われていないホスト名を1つ作る。
 * 使用済みと重なったら作り直す（十分に稀だが、重なったまま返すと別フォルダのLPを奪う）。
 */
export function issueQuickDomainHost(base: string, taken: readonly string[]): string {
  const used = new Set(taken.map((h) => h.toLowerCase()))
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const host = `${randomLabel()}.${base}`
    if (!used.has(host)) return host
  }
  throw new Error('クイックドメインを作れませんでした（重複が続きました）')
}
