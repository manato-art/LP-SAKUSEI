import { describe, it, expect } from 'vitest'
import {
  EXCLUDED_BUILD_DIR,
  EXTERNAL_HOST_ALLOWLIST,
  MONEY_SCAN_DIRS,
  PRODUCTION_HOST_PATTERN,
  PRODUCTION_TOKEN_PATTERNS,
  SCAN_DIRS,
  SUSPICIOUS_MONEY_PATTERN,
} from '../tools/gate/denylist.ts'

describe('ゲートの走査範囲', () => {
  it('docs と tests とリポジトリ直下も走査する（実名はそこにも書かれる）', () => {
    expect(SCAN_DIRS).toContain('docs')
    expect(SCAN_DIRS).toContain('tests')
    expect(SCAN_DIRS).toContain('.')
  })
})

describe('金額らしき値の検出', () => {
  const find = (text: string): string[] => text.match(new RegExp(SUSPICIOUS_MONEY_PATTERN)) ?? []

  it('カンマ1組の金額も見つける（6桁を見逃していた）', () => {
    expect(find('¥123,456')).toEqual(['¥123,456'])
  })

  it('カンマ2組以上も引き続き見つける', () => {
    expect(find('¥1,234,567')).toEqual(['¥1,234,567'])
  })

  it('全角の円記号も見つける', () => {
    expect(find('￥123,456')).toEqual(['￥123,456'])
  })

  it('カンマ無しの4桁以上も見つける', () => {
    expect(find('¥12345')).toEqual(['¥12345'])
  })

  it('少額の表示（3桁以下）は誤検知しない', () => {
    expect(find('¥0')).toEqual([])
    expect(find('¥980')).toEqual([])
  })
})

describe('改ざんチェック（integrity）の値はトークンではない', () => {
  const token = PRODUCTION_TOKEN_PATTERNS.find((p) => p.name.startsWith('長い不透明トークン'))?.pattern ?? /$^/
  const find = (t: string): string[] => t.match(new RegExp(token)) ?? []

  it('公開ライブラリの integrity（sha256/384/512- のあとの値）は拾わない（2026-09-22 見本の点検で戻した値）', () => {
    expect(find('integrity="sha512-93wYgwrIFL+b+P3RvYxi/WUFRXXUDSLCT2JQk9zhVGXuS2mHl2axj6d+R6pP+gcU5isMHRj1u0oYE/mWyt/RjA=="')).toEqual([])
    expect(find("'sha256-/xUj+3OJU5yExlq6GSYGSHk7tPXikynS7ogEvDej/m4='")).toEqual([])
  })

  it('integrity の形でない長いトークンは今までどおり拾う', () => {
    expect(find('token=n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp')).toEqual(['n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp'])
    expect(find('sha512- n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp')).toEqual(['n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp'])
  })
})

describe('長い不透明トークンの検出', () => {
  const PATTERN = /\b(?![A-Z]+_\d{4}\b)(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{32,}\b/g
  const find = (t: string): string[] => t.match(new RegExp(PATTERN)) ?? []

  it('英単語をつなげただけの識別子を誤検知しない', () => {
    expect(find('forceConsistentCasingInFileNames')).toEqual([])
  })

  it('数字を含む長いトークンは検知する', () => {
    expect(find('n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp')).toEqual([
      'n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp',
    ])
  })
})

/**
 * 許可リストを広げたので、「本物の漏洩を今も捕まえるか」を明示的に固定する。
 * 緑にするために目を潰していないことの証拠。
 */
describe('外部ホスト許可リスト', () => {
  const allowed = (url: string): boolean => EXTERNAL_HOST_ALLOWLIST.some((re) => re.test(url))

  it('規格上到達しない宛先は通す（RFC 6761 .test / RFC 2606 example / プライベートIP）', () => {
    expect(allowed('https://evil.test')).toBe(true)
    expect(allowed('https://sb-abc.example.test')).toBe(true)
    expect(allowed('https://example.com')).toBe(true)
    expect(allowed('https://tracking.example.com')).toBe(true)
    expect(allowed('http://10.1.2.3')).toBe(true)
    expect(allowed('http://192.168.1.1')).toBe(true)
    expect(allowed('http://172.16.0.1')).toBe(true)
    expect(allowed('http://169.254.169.254')).toBe(true)
  })

  it('見本が読む公開ライブラリ・埋め込み・共有の入口は通す（2026-09-22 見本の点検で、匿名化で架空にされたのを戻した）', () => {
    for (const host of [
      'https://cdnjs.cloudflare.com', 'https://ajax.googleapis.com', 'https://unpkg.com',
      'https://platform.twitter.com', 'https://player.vimeo.com', 'https://www.youtube.com',
      'https://b.st-hatena.com', 'https://www.line-website.com',
      'https://www.facebook.com', 'https://twitter.com', 'https://social-plugins.line.me', 'https://b.hatena.ne.jp', 'https://getpocket.com',
    ]) expect(allowed(host)).toBe(true)
    // 似せた別のホストは通さない
    expect(allowed('https://cdnjs.cloudflare.com.attacker.net')).toBe(false)
    expect(allowed('https://evil-unpkg.com')).toBe(false)
    expect(allowed('https://api.twitter.com')).toBe(false)
  })

  it('見た目だけ似せた実在ホストは通さない（許可リストは末尾まで固定）', () => {
    // 予約ドメインを前に付けただけの実在ホスト
    expect(allowed('https://example.com.attacker.net')).toBe(false)
    expect(allowed('https://evil.test.attacker.net')).toBe(false)
    // `.test` で終わらない普通のドメイン
    expect(allowed('https://mytest.com')).toBe(false)
    // プライベートIPを前に付けただけの実在ホスト
    expect(allowed('http://10.1.2.3.attacker.net')).toBe(false)
    // プライベート範囲の外側（100.64.0.0/10 の外）
    expect(allowed('http://100.128.0.1')).toBe(false)
    expect(allowed('http://8.8.8.8')).toBe(false)
  })

  it('意図して足した連携先以外の外部ホストは通さない', () => {
    expect(allowed('https://slack.com')).toBe(true)
    expect(allowed('https://api.chatwork.com')).toBe(true)
    expect(allowed('https://fonts.googleapis.com')).toBe(true)
    // 許可していないもの
    expect(allowed('https://api.openai.com')).toBe(false)
    expect(allowed('https://hooks.zapier.com')).toBe(false)
    expect(allowed('https://slack.com.evil.net')).toBe(false)
  })
})

describe('本番ドメインは今も捕まえる', () => {
  // 実ドメインのliteralをこのファイルに残さないため、断片から組み立てる（denylist.ts と同じ作法）
  const domain = ['squad', 'beyond', '.', 'com'].join('')

  it('コード中に本番ドメインが出たら検知する', () => {
    const re = new RegExp(PRODUCTION_HOST_PATTERN)
    expect(re.test(`fetch('https://app.${domain}/api')`)).toBe(true)
  })
})

describe('ビルド出力と金額ゲートの範囲', () => {
  it('dist は走査しない（src と capture の写しで、同じ違反が二重に出るだけ）', () => {
    expect(SCAN_DIRS).not.toContain('dist')
    expect(EXCLUDED_BUILD_DIR).toBe('dist')
  })

  it('金額ゲートは採取物側だけを見る（自作UIの見本価格で永久に赤くしない）', () => {
    expect(MONEY_SCAN_DIRS).toContain('capture')
    expect(MONEY_SCAN_DIRS).not.toContain('src')
  })

  it('採取物に金額が残っていれば今も捕まえる', () => {
    const re = new RegExp(SUSPICIOUS_MONEY_PATTERN)
    expect(re.test('<td>¥123,456</td>')).toBe(true)
  })
})
