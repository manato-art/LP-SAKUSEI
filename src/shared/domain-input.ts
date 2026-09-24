/**
 * ドメイン名の入力の決まり（画面とサーバーで同じものを使う）。
 *
 * 独自ドメインとして受け付けるのはホスト名だけ（例 lp.example.com）。
 * `https://` やパス（/…）・空白・ポート（:8080）が付いたまま登録すると、
 * 配信URLが `https://https://…/lp/…` のように壊れるので、ここで断って理由を返す。
 */

/** ホスト名の形（英数とハイフンのラベルを . で2つ以上つないだもの） */
const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/

/** ホスト名として使える形か */
export function isHostName(value: string): boolean {
  return value.length <= 253 && HOST.test(value)
}

export type DomainInputResult = { ok: true; host: string } | { ok: false; message: string }

export function validateDomainInput(raw: string): DomainInputResult {
  const value = raw.trim().toLowerCase()
  if (value === '') return { ok: false, message: 'ドメイン名を入力してください（例: lp.example.com）。' }
  if (/^[a-z]+:\/\//.test(value)) {
    return { ok: false, message: 'https:// などは付けず、ドメイン名だけを入れてください（例: lp.example.com）。' }
  }
  if (value.includes('/')) return { ok: false, message: '「/」から後ろ（パス）は付けず、ドメイン名だけを入れてください。' }
  if (/\s/.test(value)) return { ok: false, message: 'ドメイン名に空白は入れられません。' }
  if (value.includes(':')) return { ok: false, message: 'ポート番号（:8080 など）は付けられません。' }
  if (!isHostName(value)) {
    return { ok: false, message: 'ドメイン名の形になっていません。英数字とハイフンを「.」でつないだ形で入れてください（例: lp.example.com）。' }
  }
  return { ok: true, host: value }
}
