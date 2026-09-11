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
import { existsSync, readFileSync } from 'node:fs'
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

describe('中間ページリンクは実パス（配信と同じサーバーが応答する）', () => {
  it('コピーする中間ページリンクは /redirect_pages/:uid?sbrp=true&sbrpuid=:uid（採取物のリンクと同じ形）', () => {
    const detail = readFileSync('src/app/fragments/folders__UID__ab_tests__UID__redirect_pages__detail.html', 'utf8')
    expect(detail).toMatch(/\/redirect_pages\/([^?"]+)\?sbrp=true&amp;sbrpuid=\1"/)
    const source = readFileSync('src/app/pages/redirect-pages.ts', 'utf8')
    expect(source).toContain('`${location.origin}/redirect_pages/${page.uid}?sbrp=true&sbrpuid=${page.uid}`')
    expect(source).not.toContain('/#/redirect_pages/')
  })

  it('開発サーバー（Vite）でも中間ページリンクをモックサーバーへ渡す', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toContain("'/redirect_pages': `http://localhost:${MOCK_PORT}`")
  })
})

describe('中間ページタグ設定は、本体と同じ名前付きのタグカード（2026-09-11 に本体で採取）', () => {
  const source = readFileSync('src/app/pages/redirect-pages.ts', 'utf8')
  // 画面が読むのは src/index.html の /clean/_merged/cssom.css
  const css = readFileSync('capture/clean/_merged/cssom.css', 'utf8')

  it.each(['_tag_u9uou_1', '_tagTitleWrapper_u9uou_7', '_tagTitle_u9uou_7', '_destroy_u9uou_22', '_inputText_o4ifl_1', '_base_1yavp_1'])(
    'カードの目印 %s を使い、その見た目（CSS）は採取物にある',
    (className) => {
      expect(source).toContain(className)
      expect(css).toContain(`.${className}`)
    },
  )

  it('タグ名と JavaScript の欄は、本体と同じ名前と案内文', () => {
    expect(source).toContain("nameInput.name = 'title'")
    expect(source).toContain("nameInput.placeholder = 'タグ名を入力してください'")
    expect(source).toContain("bodyArea.name = 'body'")
    expect(source).toContain("bodyArea.placeholder = '<script></script>'")
    expect(source).toContain('bodyArea.rows = 5')
  })

  it('HEAD / BODY を押すとタグを1件足し、入力するとその場で保存し、1件ずつ消せる（モーダルは開かない）', () => {
    expect(source).toContain('api.addRedirectPageTag(')
    expect(source).toContain('api.updateRedirectPageTag(')
    expect(source).toContain('api.deleteRedirectPageTag(')
    expect(source).not.toContain('openRedirectPageTagSettings')
  })

  it('カードと「HEAD」「BODY」は画面の白基調にそろえ、削除ボタンは採取済みの赤いゴミ箱の画像を使う（実物の trash3_red は未採取）', () => {
    const whiteBase = readFileSync('src/app/white-base.ts', 'utf8')
    expect(whiteBase).toContain('[data-clone-theme="light"] ._tagWrapper_1tjuv_117 ._tag_dolrq_1 {')
    expect(whiteBase).toContain('[data-clone-theme="light"] ._tag_u9uou_1 {')
    expect(whiteBase).toContain('url("/assets/trash_red-9ce5ac55.svg")')
    expect(existsSync('capture/assets/trash_red-9ce5ac55.svg')).toBe(true)
  })
})
