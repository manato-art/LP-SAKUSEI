/**
 * ポップアップタブ（`/ab_tests/:ab_test_uid/articles/exit_popups`）の機械証明。
 *
 * この画面の採取物が示す状態は「離脱防止機能が未契約のアップセル画面」。
 * 機能UI（ポップアップ一覧・作成フォーム）は**採取物に存在しない**ので、
 * ここで検証するのは
 *   1) 採取物が示す状態が本当に「未契約のアップセル」であること
 *   2) 配線に使う目印が土台に実在すること
 *   3) 4タブの遷移先テーブル（`tabHashRoutes`）が採取した実物の href と一致すること
 * の3点。DOMを触るテストは書けない（vitest の環境は node）ので、
 * 検証対象は純粋関数と採取物そのものに絞っている。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { stripShellFromFragment } from '../src/app/pages/report-substrate.ts'
import { tabHashRoutes } from '../src/app/pages/basic-info-form.ts'

const FRAGMENT_PATH = 'src/app/fragments/ab_tests__UID__articles__exit_popups__default.html'
const fragment = readFileSync(FRAGMENT_PATH, 'utf8')
const content = stripShellFromFragment(fragment)

describe('土台からシェルのサイドバーを取り除ける（シェルが同じものを描いているため）', () => {
  it('ポップアップタブの断片からサイドバーだけが消えて本文が残る', () => {
    expect(fragment).toContain('data-testid="list-menu-item"')
    expect(content).not.toContain('data-testid="list-menu-item"')
    expect(content.startsWith('<div class="css-1n8b1pi')).toBe(true)
    expect(content).toContain('離脱防止機能の利用には申し込みが必要です')
  })
})

describe('採取物が示す状態＝離脱防止機能が未契約のアップセル画面', () => {
  it('アップセルの見出しと申し込みボタンがある', () => {
    expect(content).toContain('離脱防止機能の利用には申し込みが必要です')
    expect(content).toContain('担当者に問い合わせをする')
  })

  it('操作対象が1つも無い（実物の機能画面は data-test だらけ）', () => {
    expect(content).not.toContain('data-test=')
  })

  it('アップセルの枠の中身は見出し1つとボタン1つだけ（入力欄も表もリンクも無い）', () => {
    // 暗い枠 `css-1ruxp1v` から本文末尾までがアップセルのブロック
    const boxAt = content.indexOf('css-1ruxp1v')
    expect(boxAt).toBeGreaterThan(-1)
    const box = content.slice(boxAt)
    expect((box.match(/<h6\b/g) ?? []).length).toBe(1)
    expect((box.match(/<input\b/g) ?? []).length).toBe(0)
    expect((box.match(/<button\b/g) ?? []).length).toBe(0)
    expect((box.match(/<form\b/g) ?? []).length).toBe(0)
    expect((box.match(/<table\b/g) ?? []).length).toBe(0)
    expect((box.match(/<a\b/g) ?? []).length).toBe(0)
  })

  it('左レールの4タブはこの画面にも居る（タブは4画面共通のシェル）', () => {
    const collapsed = content.replace(/\s+/g, '')
    // 実DOMは `md:whitespace-pre-line` で `ポップ\nアップ` のように改行が入る
    for (const label of ['基本情報', 'Version', 'ポップアップ', 'レポート']) {
      expect(collapsed).toContain(label)
    }
  })
})

describe('配線に使う目印が土台に実在する', () => {
  const marks: readonly string[] = [
    '_back_dcd38_35', // 戻る
    '_title_dcd38_67', // 上部バー: フォルダ名 + 配信ステータスバッジ
    '_folderName_dcd38_85', // 上部バー: beyondページ名
    '_btnPrimary_1bcs1_74', // 「担当者に問い合わせをする」
    'css-1t5yily', // アップセルの見出し
  ]

  for (const mark of marks) {
    it(`${mark} が採取断片にある`, () => {
      expect(fragment).toContain(mark)
    })
  }

  it('上部バーの差し替え先はそれぞれ1つに定まる（セレクタが複数当たらない）', () => {
    const titleAt = content.indexOf('_title_dcd38_67')
    expect(titleAt).toBeGreaterThan(-1)
    // `_title_dcd38_67` の中に <p> と <button> が1つずつ（フォルダ名 / ステータスバッジ）
    const title = content.slice(titleAt, content.indexOf('_folderNameWrapper_dcd38_85'))
    expect((title.match(/<p\b/g) ?? []).length).toBe(1)
    expect((title.match(/<button\b/g) ?? []).length).toBe(1)
    expect((content.match(/_folderName_dcd38_85">/g) ?? []).length).toBe(1)
    expect((content.match(/_btnPrimary_1bcs1_74/g) ?? []).length).toBeGreaterThan(0)
  })

  it('4タブの nav は PC用とSP用の2本あり、リンクは合計9本（4タブ×2＋戻る）', () => {
    expect((content.match(/<nav\b[^>]*_twReset_1xrtc_1[^>]*>/g) ?? []).length).toBe(2)
    expect((content.match(/<a\b[^>]*>/g) ?? []).length).toBe(9)
  })
})

describe('4タブの遷移先テーブルが、採取した実物の href と一致している', () => {
  /** 採取物の `<a id="…" href="…">` を集める */
  function capturedTabHrefs(): Map<string, string> {
    const found = new Map<string, string>()
    for (const tag of content.match(/<a\b[^>]*>/g) ?? []) {
      const id = /\sid="([^"]+)"/.exec(tag)?.[1]
      const href = /\shref="([^"]+)"/.exec(tag)?.[1]
      if (id === undefined || href === undefined) continue
      found.set(id, href)
    }
    return found
  }

  /** uid部分を伏せて「URLの形」だけにする（採取物のuidをテストに書かないため） */
  function shape(url: string): string {
    return url
      .replace(/\/folders\/[^/?]+/, '/folders/:folder_uid')
      .replace(/\/ab_tests\/[^/?]+/, '/ab_tests/:ab_test_uid')
  }

  const routes = tabHashRoutes(':folder_uid', ':ab_test_uid')

  it('4タブ全部の href が採取できている', () => {
    expect([...capturedTabHrefs().keys()].sort()).toEqual(['info', 'popup', 'report', 'version'])
  })

  it('4タブ全部の href が遷移先テーブルと一致する', () => {
    const hrefs = capturedTabHrefs()
    for (const id of ['info', 'version', 'popup', 'report'] as const) {
      const captured = hrefs.get(id)
      expect(captured).toBeDefined()
      // tabHashRoutes は先頭に `#` を付けたハッシュルートを返す
      expect(`#${shape(captured as string)}`).toBe(routes[id])
    }
  })

  /**
   * ここが一度落ちた経緯（再発したら真っ先に疑うところ）:
   * 匿名化が `/articles/` の次の語を無条件に uid とみなしていた時期があり、
   * ルートの固定語 `exit_popups` 自体が `UID_####` へ置換されて土台のURLが壊れていた。
   * 匿名化側が「数字を含むかどうか」で実IDとルート語を見分けるようになって解消。
   */
  it('自分のルートの固定語が匿名化で潰されていない', () => {
    expect(capturedTabHrefs().get('popup')).toMatch(/\/articles\/exit_popups$/)
  })
})
