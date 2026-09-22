import { describe, expect, it } from 'vitest'
import { decodeSrcdoc, encodeSrcdoc, mapSrcdocs } from '../tools/widget-library-fix/srcdoc-codec.ts'
import { restorePublicUrls } from '../tools/widget-library-fix/restore-urls.ts'
import { repairIntegrity } from '../tools/widget-library-fix/integrity.ts'

/**
 * 見本の直し（2026-09-22・本人の依頼「見本をすべて確認して、押して動くものに作り変えて」）。
 * 見本は、カードの iframe の srcdoc に1件ずつ入っている。
 */
describe('見本の srcdoc の読み書き', () => {
  it('読んで書き戻すと元と同じ（直していない見本は1文字も変えない）', () => {
    const raw = '&lt;html&gt;&lt;body&gt;&lt;a href=&quot;?a=1&amp;amp;b=2&quot;&gt;次へ&lt;/a&gt;&lt;/body&gt;&lt;/html&gt;'
    expect(decodeSrcdoc(raw)).toBe('<html><body><a href="?a=1&amp;b=2">次へ</a></body></html>')
    expect(encodeSrcdoc(decodeSrcdoc(raw))).toBe(raw)
  })

  it('カードの一覧の中の srcdoc だけを直す（ほかの部分は触らない）', () => {
    const grid =
      '<div class="MuiCard-root"><p>見本A</p><iframe srcdoc="&lt;p&gt;A&lt;/p&gt;" title="a"></iframe></div>' +
      '<div class="MuiCard-root"><p>見本B</p><iframe srcdoc="&lt;p&gt;B&lt;/p&gt;"></iframe></div>'
    const out = mapSrcdocs(grid, (html) => html.replace('<p>A</p>', '<p>A2</p>'))
    expect(out).toBe(
      '<div class="MuiCard-root"><p>見本A</p><iframe srcdoc="&lt;p&gt;A2&lt;/p&gt;" title="a"></iframe></div>' +
        '<div class="MuiCard-root"><p>見本B</p><iframe srcdoc="&lt;p&gt;B&lt;/p&gt;"></iframe></div>',
    )
  })
})

describe('匿名化で架空にされた公開ライブラリの読み込み先を元に戻す', () => {
  const cases: readonly (readonly [string, string, string])[] = [
    ['jsDelivr', 'https://sample22.example.test/npm/swiper@8.4.7/swiper-bundle.min.js', 'https://cdn.jsdelivr.net/npm/swiper@8.4.7/swiper-bundle.min.js'],
    ['Google Hosted Libraries', 'https://sample57.example.test/ajax/libs/jquery/3.6.0/jquery.min.js', 'https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js'],
    ['jQuery公式', 'https://sample47.example.test/jquery-3.6.1.slim.js', 'https://code.jquery.com/jquery-3.6.1.slim.js'],
    ['cdnjs（/assets/vendor にされた）', '/assets/vendor/ajax/libs/Chart.js/3.7.1/chart.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.7.1/chart.min.js'],
    ['Google Fonts（/assets/fonts にされた）', '/assets/fonts/css2?family=Josefin+Sans&amp;display=swap', 'https://fonts.googleapis.com/css2?family=Josefin+Sans&amp;display=swap'],
    ['Xの埋め込み', 'https://sample19.example.test/widgets.js', 'https://platform.twitter.com/widgets.js'],
    ['Vimeo Player API', 'https://sample50.example.test/api/player.js', 'https://player.vimeo.com/api/player.js'],
    ['YouTube IFrame API', 'https://sample41.example.test/iframe_api', 'https://www.youtube.com/iframe_api'],
    ['はてなブックマーク', 'https://sample88.example.test/js/bookmark_button.js', 'https://b.st-hatena.com/js/bookmark_button.js'],
    ['LINEのボタン', 'https://sample39.example.test/social-plugins/js/thirdparty/loader.min.js', 'https://www.line-website.com/social-plugins/js/thirdparty/loader.min.js'],
  ]
  for (const [name, fake, real] of cases) {
    it(`${name}`, () => {
      expect(restorePublicUrls(`<script src="${fake}"></script>`)).toBe(`<script src="${real}"></script>`)
    })
  }

  it('unpkg（/assets/vendor にされた・cdnjs の ajax/libs 以外）', () => {
    expect(restorePublicUrls('<script src="/assets/vendor/js-image-zoom@0.7.0/js-image-zoom.js"></script>')).toBe(
      '<script src="https://unpkg.com/js-image-zoom@0.7.0/js-image-zoom.js"></script>',
    )
    expect(restorePublicUrls('<script src="/assets/vendor/scroll-hint@latest/js/scroll-hint.min.js"></script>')).toBe(
      '<script src="https://unpkg.com/scroll-hint@latest/js/scroll-hint.min.js"></script>',
    )
  })

  it('匿名化がホスト名と取り違えたスクリプトの中の名前（〜.link・〜.NET 等）を戻す', () => {
    // 末尾の .link・.NET などが実在のドメインの末尾に見えて架空にされ、スクリプトが止まっていた（fakeHost を計算して特定）
    expect(restorePublicUrls(`form.querySelector('[name="' + sample78.example.test + '"]')`)).toBe(`form.querySelector('[name="' + select.dataset.link + '"]')`)
    expect(restorePublicUrls("link.classList.toggle('is-active', link === sample53.example.test)")).toBe("link.classList.toggle('is-active', link === active.link)")
    expect(restorePublicUrls("const isActive = link.getAttribute('href') === sample53.example.test.getAttribute('href');")).toBe(
      "const isActive = link.getAttribute('href') === active.link.getAttribute('href');",
    )
    expect(restorePublicUrls('if (item === selectItems.children[i].sample80.example.test)')).toBe('if (item === selectItems.children[i].dataset.link)')
    expect(restorePublicUrls('document.querySelector(`.sample77.example.test-${getResultValue} a`)')).toBe('document.querySelector(`.item.link-${getResultValue} a`)')
    expect(restorePublicUrls('if (src.includes("sample02.example.test") || src.includes("youtu.be")) {')).toBe('if (src.includes("youtube.com") || src.includes("youtu.be")) {')
    expect(restorePublicUrls('name: "sample12.example.test",')).toBe('name: "VB.NET",')
  })

  it('同じ番号でも、SBの置き場など本物のホストだった所（URLの中）は戻さない', () => {
    const keep = '<img src="https://sample80.example.test/uploads/a.png"><a href="https://sample53.example.test/x">'
    expect(restorePublicUrls(keep)).toBe(keep)
  })

  it('共有ボタンの行き先（Facebook・X・LINE・はてな・Pocket）も戻す', () => {
    expect(restorePublicUrls('<a href="http://sample82.example.test/sharer.php?u=ooooo">')).toBe('<a href="https://www.facebook.com/sharer.php?u=ooooo">')
    expect(restorePublicUrls('<a href="http://sample97.example.test/share?text=a">')).toBe('<a href="https://twitter.com/share?text=a">')
    expect(restorePublicUrls('<a href="https://sample57.example.test/lineit/share?url=ooooo">')).toBe('<a href="https://social-plugins.line.me/lineit/share?url=ooooo">')
    expect(restorePublicUrls('<a href="http://sample66.example.test/entry/ooooo">')).toBe('<a href="https://b.hatena.ne.jp/entry/ooooo">')
    expect(restorePublicUrls('<a href="http://sample77.example.test/edit?url=&amp;title=">')).toBe('<a href="https://getpocket.com/edit?url=&amp;title=">')
  })

  it('JavaScript の文字列の中でも戻す（window.open(…) や読み込みの関数）', () => {
    expect(restorePublicUrls("s.src='https://sample41.example.test/iframe_api';")).toBe("s.src='https://www.youtube.com/iframe_api';")
    expect(restorePublicUrls("window.open('http://sample97.example.test/share?text='+t)")).toBe("window.open('https://twitter.com/share?text='+t)")
  })

  it('SBが持っていた画像・動画や、誰かのページ・投稿・地図の場所は戻さない（元の持ち主が分かってしまう）', () => {
    const keep = [
      '<img src="https://sample80.example.test/uploads/article_photo/photo/1/sample_token_0000aaaa.png">',
      '<a href="https://sample09.example.test/ab_tests/UID_8313/articles">',
      '<a href="https://sample97.example.test/squadbeyond/status/1499291760409088001">',
      '<iframe src="https://sample41.example.test/embed/W0z97Owl4Co"></iframe>',
      '<a href="https://sample55.example.test/jBtUoV4YCLkXt7h29">',
    ]
    for (const html of keep) expect(restorePublicUrls(html)).toBe(html)
  })

  it('2回かけても同じ（何度でも安全に回せる）', () => {
    const once = restorePublicUrls('<script src="https://sample22.example.test/npm/canvas-confetti@1.4.0/dist/confetti.browser.min.js"></script>')
    expect(restorePublicUrls(once)).toBe(once)
  })
})

describe('匿名化で壊れた「改ざんチェック（integrity）」を正しい値に戻す', () => {
  it('公開ライブラリの正しい値に戻す（壊れる前の頭の部分が合うものだけ）', () => {
    const damaged =
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/list.js/2.3.1/list.min.js" integrity="sha512-93wYgwrIFL+b+P3RvYxi/sample_token_1a2b3c4d" crossorigin="anonymous"></script>'
    expect(repairIntegrity(damaged)).toBe(
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/list.js/2.3.1/list.min.js" integrity="sha512-93wYgwrIFL+b+P3RvYxi/WUFRXXUDSLCT2JQk9zhVGXuS2mHl2axj6d+R6pP+gcU5isMHRj1u0oYE/mWyt/RjA==" crossorigin="anonymous"></script>',
    )
    expect(repairIntegrity('<script src="https://code.jquery.com/jquery-3.6.0.min.js" integrity="sha256-/xUj+sample_token_9f8e7d6c"></script>')).toBe(
      '<script src="https://code.jquery.com/jquery-3.6.0.min.js" integrity="sha256-/xUj+3OJU5yExlq6GSYGSHk7tPXikynS7ogEvDej/m4="></script>',
    )
  })

  it('正しい値が分からない壊れたものは外す（壊れた値のままだとブラウザが読み込みを止める）', () => {
    expect(repairIntegrity('<script src="https://cdn.jsdelivr.net/npm/x@1/x.js" integrity="sha384-abc/sample_token_00000000"></script>')).toBe(
      '<script src="https://cdn.jsdelivr.net/npm/x@1/x.js"></script>',
    )
  })

  it('壊れていない値は触らない', () => {
    const ok = '<script src="https://code.jquery.com/jquery-3.6.1.min.js" integrity="sha256-o88AwQnZB+VDvE9tvIXrMQaPlFFSUTR+nldQm1LuPXQ="></script>'
    expect(repairIntegrity(ok)).toBe(ok)
  })
})
