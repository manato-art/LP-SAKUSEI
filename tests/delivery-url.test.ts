/**
 * 配信URLの組み立て（2026-09-13）。実物と同じく、フォルダのドメインに従う。
 * 未設定なら配信URLを出さず、案内文を出す（実物は「フォルダの設定＞ドメイン変更から設定してください」と案内する）。
 */
import { describe, expect, it } from 'vitest'
import { DELIVERY_DOMAIN_UNSET_NOTE, deliveryUrlFor, folderDomainLabel } from '../src/app/pages/basic-info-form.ts'

describe('配信URLの組み立て', () => {
  it('このシステムのドメインなら、今までどおり自分のホストで出す', () => {
    expect(deliveryUrlFor('system', 'https://lp.example.test', 'ABTEST_0001')).toBe(
      'https://lp.example.test/lp/ABTEST_0001',
    )
  })

  it('独自ドメインが設定されていれば、そのドメインで出す', () => {
    expect(deliveryUrlFor('sb.example.test', 'https://lp.example.test', 'ABTEST_0001')).toBe(
      'https://sb.example.test/lp/ABTEST_0001',
    )
  })

  it('未設定なら配信URLを出さない（実物と同じ）', () => {
    expect(deliveryUrlFor('', 'https://lp.example.test', 'ABTEST_0001')).toBeNull()
    expect(deliveryUrlFor(undefined, 'https://lp.example.test', 'ABTEST_0001')).toBeNull()
  })

  it('案内文は、フォルダの設定から直すよう促す', () => {
    expect(DELIVERY_DOMAIN_UNSET_NOTE).toContain('ドメイン')
    expect(DELIVERY_DOMAIN_UNSET_NOTE).toContain('フォルダ')
  })
})

describe('ページ詳細の「フォルダドメイン」表示', () => {
  it('このシステムのドメインなら、そのホスト名を出す', () => {
    expect(folderDomainLabel('system', 'https://lp.example.test')).toBe('lp.example.test')
    expect(folderDomainLabel('system', 'http://localhost:5175')).toBe('localhost:5175')
  })

  it('独自ドメインが設定されていれば、そのドメインを出す', () => {
    expect(folderDomainLabel('sb.example.test', 'https://lp.example.test')).toBe('sb.example.test')
  })

  it('未設定なら「未設定」と出す（フォルダ名から作った偽のドメインを出さない）', () => {
    expect(folderDomainLabel('', 'https://lp.example.test')).toBe('未設定')
    expect(folderDomainLabel(undefined, 'https://lp.example.test')).toBe('未設定')
  })
})
