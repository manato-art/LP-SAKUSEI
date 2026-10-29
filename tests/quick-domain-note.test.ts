/**
 * クイックドメインの案内文（2026-09-13・本人指示）の機械証明。
 *
 * 「ドメインが無いと何ができないのか」「どこで取るのか」が画面に出ていないと、
 * 発行ボタンを押して 422 が返るだけで、次に何をすればいいか分からない。
 */
import { describe, expect, it } from 'vitest'
import {
  QUICK_DOMAIN_EXISTING_DOMAIN_WARNING,
  QUICK_DOMAIN_NEED_DOMAIN_NOTE,
  quickDomainSteps,
} from '../src/app/quick-domain-note.ts'

describe('土台ドメインが未設定のときの案内', () => {
  it('ドメインを別途取得する必要があること、このシステムでは取れないことを書く', () => {
    expect(QUICK_DOMAIN_NEED_DOMAIN_NOTE).toContain('取得')
    expect(QUICK_DOMAIN_NEED_DOMAIN_NOTE).toContain('このシステムからは取得できません')
  })

  it('取得するまでは今までどおりであることを書く（何も壊れていないと分かるように）', () => {
    expect(QUICK_DOMAIN_NEED_DOMAIN_NOTE).toContain('このシステムのドメインのまま')
  })

  it('手順は「まずドメインを取る」から始まる', () => {
    const steps = quickDomainSteps('')
    expect(steps[0]).toContain('取得')
    expect(steps.join('')).not.toContain('Railway')
  })

  it('既存ドメインの流用は止める（評判が混ざる・既存サイトが止まる）', () => {
    expect(QUICK_DOMAIN_EXISTING_DOMAIN_WARNING).toContain('会社サイト')
    expect(QUICK_DOMAIN_EXISTING_DOMAIN_WARNING).toContain('ネームサーバー')
  })
})

describe('土台ドメインが設定済みのときの案内', () => {
  it('登録するレコード（CNAME2本・TXT1本）を書く', () => {
    const steps = quickDomainSteps('lp-example.test').join('\n')
    expect(steps).toContain('*.lp-example.test')
    expect(steps).toContain('CNAME 2本')
    expect(steps).toContain('TXT 1本')
    expect(steps).toContain('_acme-challenge')
  })

  it('Cloudflare は「確認が済むまで DNSのみ → 済んだら * だけプロキシ・暗号はフル（厳密）」（2026-10-30 c1page.com で確かめた順番）', () => {
    const steps = quickDomainSteps('lp-example.test').join('\n')
    expect(steps).not.toContain('プロキシ機能は使わない')
    expect(steps).toContain('_acme-challenge の行はずっと「DNSのみ」')
    expect(steps).toContain('フル（厳密）')
    expect(steps).toContain('プロキシ済み')
  })
})

describe('ドメインが未設定のときの案内（配信URLの欄など）', () => {
  it('ドメイン変更の場所は「左のフォルダ一覧の歯車」と書く（「…」はページのメニューで、そこには無い・2026-10-30 本人「なくない？」）', async () => {
    const { DELIVERY_DOMAIN_UNSET_NOTE } = await import('../src/app/pages/basic-info-form.ts')
    expect(DELIVERY_DOMAIN_UNSET_NOTE).toContain('歯車')
    expect(DELIVERY_DOMAIN_UNSET_NOTE).toContain('ドメイン変更')
    expect(DELIVERY_DOMAIN_UNSET_NOTE).not.toContain('「…」')
  })
})
