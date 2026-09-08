import { describe, it, expect } from 'vitest'
import {
  fetchExternalPage,
  ExternalPageError,
  sanitizeHtml,
  injectBase,
} from '../mock-server/external-page.ts'

/**
 * 外部LP取得は**任意のURLをサーバーが取りに行く**処理なので、
 * 踏み台にされないことをここで担保する。
 */
describe('外部LP取得のSSRF防御', () => {
  it('http / https 以外のスキームは拒否する', async () => {
    for (const url of ['file:///etc/passwd', 'gopher://x/', 'ftp://example.test/a']) {
      await expect(fetchExternalPage(url)).rejects.toMatchObject({ code: 'bad_scheme' })
    }
  })

  it('URLの形をしていないものは拒否する', async () => {
    await expect(fetchExternalPage('not a url')).rejects.toMatchObject({ code: 'bad_url' })
  })

  it('ループバック宛は拒否する（127.0.0.1 / localhost / [::1]）', async () => {
    for (const url of ['http://127.0.0.1/', 'http://localhost:3000/', 'http://[::1]/']) {
      await expect(fetchExternalPage(url)).rejects.toMatchObject({ code: 'blocked_host' })
    }
  })

  it('私有アドレス宛は拒否する（10/8・172.16/12・192.168/16）', async () => {
    for (const url of ['http://10.0.0.5/', 'http://172.16.0.1/', 'http://192.168.1.1/']) {
      await expect(fetchExternalPage(url)).rejects.toMatchObject({ code: 'blocked_host' })
    }
  })

  it('クラウドのメタデータIP（169.254.169.254）は拒否する', async () => {
    await expect(fetchExternalPage('http://169.254.169.254/latest/meta-data/')).rejects.toMatchObject(
      { code: 'blocked_host' },
    )
  })

  it('拒否は必ず ExternalPageError で返る（呼び出し側が理由を出せる）', async () => {
    await expect(fetchExternalPage('http://127.0.0.1/')).rejects.toBeInstanceOf(ExternalPageError)
  })
})

describe('取得HTMLの無害化（多層防御の1枚目）', () => {
  it('script は中身ごと落とす', () => {
    const out = sanitizeHtml('<p>a</p><script>fetch("/steal")</script><p>b</p>')
    expect(out).not.toContain('script')
    expect(out).not.toContain('steal')
    expect(out).toContain('<p>a</p>')
    expect(out).toContain('<p>b</p>')
  })

  it('閉じタグの無い script も落とす', () => {
    expect(sanitizeHtml('<script src="https://evil.test/x.js">')).not.toContain('script')
  })

  it('インラインの on* ハンドラを落とす（引用符あり・なし両方）', () => {
    expect(sanitizeHtml('<img src="a.png" onerror="alert(1)">')).not.toContain('onerror')
    expect(sanitizeHtml("<img src='a.png' onerror='alert(1)'>")).not.toContain('onerror')
    expect(sanitizeHtml('<img src=a.png onerror=alert(1)>')).not.toContain('onerror')
  })

  it('javascript: リンクは無効化する', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:')
  })

  it('iframe / object / embed も落とす（入れ子で外部を呼ばせない）', () => {
    const out = sanitizeHtml(
      '<iframe src="https://evil.test"></iframe><object data="x"></object><embed src="y">',
    )
    expect(out).not.toContain('iframe')
    expect(out).not.toContain('object')
    expect(out).not.toContain('embed')
  })

  it('普通の見た目（画像・CSS・テキスト）は残す', () => {
    const html = '<link rel="stylesheet" href="/a.css"><img src="/hero.png"><h1>見出し</h1>'
    expect(sanitizeHtml(html)).toBe(html)
  })
})

describe('相対パス解決のための <base> 差し込み', () => {
  it('head があればその直後に入れる', () => {
    const out = injectBase('<html><head><title>t</title></head><body>b</body></html>', 'https://x.test/lp')
    expect(out).toContain('<head><base href="https://x.test/lp">')
  })

  it('head が無ければ先頭に入れる', () => {
    expect(injectBase('<div>a</div>', 'https://x.test/lp')).toBe(
      '<base href="https://x.test/lp"><div>a</div>',
    )
  })

  it('すでに base があるページは触らない（最初の1つが勝つので足しても無意味）', () => {
    const html = '<head><base href="https://orig.test/"></head>'
    expect(injectBase(html, 'https://x.test/lp')).toBe(html)
  })
})
