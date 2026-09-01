/**
 * 中間ページ（`/folders/:folder_uid/ab_tests/:ab_test_uid/redirect_pages`）の機械証明。
 *
 * 採取物が示す状態は「中間ページが1件も無い空状態」。一覧UI・作成フォーム・追加モーダルは
 * 採取物に存在しない（`data-test` 0個・`<form>`/`<input>`無し）。ここで検証するのは
 *   1) 採取物が示す状態が本当に「空 ＋ 追加ボタンだけ」であること
 *   2) 配線に使う目印（追加ボタン・上部バー・4タブ・上部右アイコン）が実在すること
 *   3) 中間ページのハッシュルートが採取した実 href と形として一致すること
 * の3点。DOMは触らない（環境は node）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { stripShellFromFragment } from '../src/app/pages/report-substrate.ts'
import { redirectPagesHash } from '../src/app/pages/beyond-nav.ts'

const FRAGMENT_PATH = 'src/app/fragments/folders__UID__ab_tests__UID__redirect_pages__default.html'
const fragment = readFileSync(FRAGMENT_PATH, 'utf8')
const content = stripShellFromFragment(fragment)

/** uid部分を伏せて「URLの形」だけにする */
function shape(url: string): string {
  return url
    .replace(/\/folders\/[^/?#]+/, '/folders/:folder_uid')
    .replace(/\/ab_tests\/[^/?#]+/, '/ab_tests/:ab_test_uid')
}

describe('土台からシェルのサイドバーを取り除ける', () => {
  it('中間ページの断片からサイドバーだけが消えて本文が残る', () => {
    expect(fragment).toContain('data-testid="list-menu-item"')
    expect(content).not.toContain('data-testid="list-menu-item"')
    expect(content).toContain('_redirectPagesWrapper_1tjuv_1')
  })
})

describe('採取物が示す状態＝中間ページ0件の空状態', () => {
  it('本文は「追加ボタン」1つと空の詳細ペインだけ', () => {
    const wrapAt = content.indexOf('_redirectPagesWrapper_1tjuv_1')
    expect(wrapAt).toBeGreaterThan(-1)
    const body = content.slice(wrapAt)
    expect(body).toContain('_newRedirectPage_1tjuv_78')
    expect(body).toContain('中間ページを追加')
    // 詳細ペイン `_right_1tjuv_91` は空（中身のタグが無い）
    expect(body).toMatch(/_right_1tjuv_91"><\/div>/)
    // 一覧UI・作成フォームは無い（採取物に存在しない）
    expect(body).not.toContain('<form')
    expect(body).not.toContain('<input')
    expect(body).not.toContain('<table')
  })

  it('操作対象の data-test が本文に1つも無い（未契約/未採取のサイン）', () => {
    const wrapAt = content.indexOf('_redirectPagesWrapper_1tjuv_1')
    expect(content.slice(wrapAt)).not.toContain('data-test=')
  })
})

describe('配線に使う目印が土台に実在する', () => {
  const topBarMarks = ['_back_dcd38_35', '_title_dcd38_67', '_folderName_dcd38_85'] as const
  for (const mark of topBarMarks) {
    it(`${mark} が採取断片にある`, () => {
      expect(fragment).toContain(mark)
    })
  }

  it('左レール4タブ（info/version/popup/report）が居る', () => {
    const ids = [...content.matchAll(/<a[^>]*\bid="(info|version|popup|report)"/g)].map((m) => m[1])
    expect(new Set(ids)).toEqual(new Set(['info', 'version', 'popup', 'report']))
  })

  it('上部右アイコン: 編集 と 中間ページ が data-trackid で同定できる', () => {
    expect(fragment).toContain('data-trackid="editor-nav-editor"')
    expect(fragment).toContain('data-trackid="editor-nav-redirect-page"')
  })

  it('「中間ページを追加」ボタンのクラスが一意に取れる', () => {
    expect((content.match(/_newRedirectPage_1tjuv_78/g) ?? []).length).toBe(1)
  })
})

describe('中間ページのハッシュルートが採取した実 href と形として一致する', () => {
  it('採取物の中間ページ href（uidを伏せた形）＝ redirectPagesHash の形', () => {
    const captured = /href="(\/folders\/[^/"]+\/ab_tests\/[^/"]+\/redirect_pages)"/.exec(fragment)
    expect(captured).not.toBeNull()
    const shaped = shape((captured as RegExpExecArray)[1] as string)
    expect(`#${shaped}`).toBe(redirectPagesHash(':folder_uid', ':ab_test_uid'))
  })
})
