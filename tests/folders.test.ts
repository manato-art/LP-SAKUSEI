/**
 * 「ページ」画面（`/folders`）の土台テスト。
 *
 * この画面は **採取した実DOM**（`src/app/fragments/folders__empty-selection.html`）を
 * 土台にして描く（企画書 §11 capture-and-rehydrate）。
 * したがって検証すべきは「実装の定数が正しいか」ではなく
 * **「配線が前提にしている目印が、採取物に本当に在るか」**。
 *
 * 実装に書いた文字列をテストへ写して比べると、間違いもそのまま写るので何も保証できない。
 * ここでは採取HTMLを実際に読み、`FOLDERS_HOOK` の全セレクタを機械的に突き合わせる。
 * 環境は node（jsdom 無し）なので、DOMを使わない純粋関数だけを対象にする（共通指示 §5）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FOLDERS_HOOK,
  FOLDER_UID_ATTRIBUTE,
  countClassToken,
  extractEnclosingDiv,
  extractFolderRowTemplate,
  isSelectorInCapture,
  selectorMarkers,
} from '../src/app/pages/folders-substrate.ts'

const FOLDERS_FRAGMENT = 'src/app/fragments/folders__empty-selection.html'
const capturedHtml = readFileSync(FOLDERS_FRAGMENT, 'utf8')

describe('セレクタを採取HTMLと突き合わせるための分解', () => {
  it('クラスセレクタをクラス名に分解する', () => {
    expect(selectorMarkers('.ea00ncb3')).toEqual([{ kind: 'class', name: 'ea00ncb3', value: null }])
  })

  it('属性セレクタを名前と値に分解する', () => {
    expect(selectorMarkers('[data-testid="side-menu"]')).toEqual([
      { kind: 'attribute', name: 'data-testid', value: 'side-menu' },
    ])
  })

  it('値を持たない属性セレクタも分解する', () => {
    expect(selectorMarkers('[data-folder-uid]')).toEqual([
      { kind: 'attribute', name: 'data-folder-uid', value: null },
    ])
  })

  it('クラスと属性が混ざったセレクタは両方を条件にする', () => {
    expect(selectorMarkers('.ea00ncb5[data-testid="list-menu-item"]')).toHaveLength(2)
  })

  it('クラス名の部分一致では合格させない（ea00ncb は ea00ncb3 ではない）', () => {
    expect(isSelectorInCapture(capturedHtml, '.ea00ncb3')).toBe(true)
    expect(isSelectorInCapture(capturedHtml, '.ea00ncb')).toBe(false)
  })

  it('採取物に無いものは不合格になる', () => {
    expect(isSelectorInCapture(capturedHtml, '[data-testid="not-captured"]')).toBe(false)
    expect(isSelectorInCapture(capturedHtml, '.css-not-captured')).toBe(false)
  })

  it('分解できないセレクタは合格にしない（黙って通さない）', () => {
    expect(isSelectorInCapture(capturedHtml, 'div > span')).toBe(false)
  })
})

describe('配線が使う目印は、すべて採取物に実在する', () => {
  const hooks = Object.entries(FOLDERS_HOOK)

  it.each(hooks)('%s（%s）が採取HTMLに在る', (_name, selector) => {
    expect(isSelectorInCapture(capturedHtml, selector)).toBe(true)
  })

  it('本体（グローバルサイドバーを除いた側）は採取物中で1つだけ', () => {
    // querySelector で一意に引ける前提。2つあると別物を掴む。
    expect(countClassToken(capturedHtml, 'ehppitp0')).toBe(1)
  })

  it('フォルダツリーのリスト容器も1つだけ', () => {
    expect(countClassToken(capturedHtml, 'efy50tl13')).toBe(1)
  })

  it('中央ペインの一覧容器も1つだけ', () => {
    expect(countClassToken(capturedHtml, 'efy50tl20')).toBe(1)
  })
})

/**
 * 配線は「検索アイコンはツリー側」「フォルダ内検索は中央ペイン側」のように
 * **どちらのペインに在るか**を前提に絞り込んでいる（同じ `data-testid` が両側に在る）。
 * その前提を採取物で裏取りする。
 */
describe('目印がどちらのペインに在るかまで、採取物で裏を取る', () => {
  const tree = extractEnclosingDiv(capturedHtml, 'data-testid="side-menu"')

  it('フォルダツリーを切り出せる', () => {
    expect(tree).not.toBeNull()
  })

  it('検索アイコンは採取物全体に2つ在るが、ツリー内は1つだけ', () => {
    // 絞り込まずに拾うと、中央ペインの「フォルダ内検索」を掴んでしまう。
    expect((capturedHtml.match(/data-testid="search-icon"/g) ?? []).length).toBe(2)
    expect(((tree ?? '').match(/data-testid="search-icon"/g) ?? []).length).toBe(1)
  })

  it('新規フォルダ作成のボタンはツリーの中に1つだけ在る', () => {
    expect(((tree ?? '').match(/data-testid="generate-folder-icon"/g) ?? []).length).toBe(1)
  })

  it('中央ペインの操作（フォルダ内検索 / 集計期間 / 配信ステータス）はツリーの外に在る', () => {
    for (const selector of [
      FOLDERS_HOOK.folderSearchButton,
      FOLDERS_HOOK.periodSelect,
      FOLDERS_HOOK.adStatusSelect,
    ]) {
      expect(isSelectorInCapture(capturedHtml, selector)).toBe(true)
      expect(isSelectorInCapture(tree ?? '', selector)).toBe(false)
    }
  })

  it('フォルダツリーのタブは「すべて / お気に入り / 履歴」の3つ', () => {
    expect(countClassToken(tree ?? '', 'eyrb9320')).toBe(3)
    expect(tree).toContain('すべて')
    expect(tree).toContain('お気に入り')
    expect(tree).toContain('履歴')
  })
})

describe('フォルダ行のテンプレートを採取物から取り出す', () => {
  const template = extractFolderRowTemplate(capturedHtml)

  it('取り出せる', () => {
    expect(template).not.toBeNull()
  })

  it('フォルダの uid を持つ要素そのものから始まる', () => {
    expect(template).toMatch(new RegExp(`^<div [^>]*${FOLDER_UID_ATTRIBUTE}="`))
  })

  it('タグの対応が取れている（途中で切れていない）', () => {
    const open = (template ?? '').match(/<div\b/g)?.length ?? 0
    const close = (template ?? '').match(/<\/div>/g)?.length ?? 0
    expect(open).toBe(close)
    expect(open).toBeGreaterThan(1)
  })

  it('行1件ぶんだけを取り出す（次の行を巻き込まない）', () => {
    const uids = (template ?? '').match(new RegExp(`${FOLDER_UID_ATTRIBUTE}="`, 'g')) ?? []
    expect(uids).toHaveLength(1)
  })

  it('フォルダ行（フォルダグループ行ではない）である', () => {
    expect(template).toContain('data-testid="folder-icon"')
    expect(template).not.toContain('data-testid="folder-group-icon"')
  })

  it('名前の差し込み先とホバー時の操作列を持つ', () => {
    expect(isSelectorInCapture(template ?? '', FOLDERS_HOOK.folderRowName)).toBe(true)
    expect(isSelectorInCapture(template ?? '', FOLDERS_HOOK.folderRowActions)).toBe(true)
  })

  it('フォルダアイコンはSVG（絵文字ではない）', () => {
    expect(template).toContain('<svg')
  })

  it('採取物のフォルダ行には beyondページ数のバッジが無い', () => {
    // バッジを持つのはフォルダ「グループ」行だけ。
    // クローンが行に件数を出さないのは、実物がそうだから（作り足していない）。
    expect(capturedHtml).toContain('css-1kcsw0t eth7yzt0')
    expect(template).not.toContain('eth7yzt0')
  })
})

describe('採取できていない範囲を、テストで固定して忘れないようにする', () => {
  it('フォルダ選択後の状態は採取されていない（beyondページ一覧の行が無い）', () => {
    // 採取したのは `/folders`（フォルダ未選択）だけ。中央ペインの一覧容器は空。
    // ここが将来の再採取で埋まったら、このテストが落ちて手書きを剥がす合図になる。
    expect(capturedHtml).toContain('css-1ln2r2k efy50tl20')
    expect(capturedHtml).toMatch(/class="css-1ln2r2k efy50tl20"[^>]*>\s*<\/div>/)
  })

  it('「新規ページを作成」の実マークアップは採取物に無い', () => {
    expect(capturedHtml).not.toContain('新規ページ')
  })

  it('新規フォルダ作成のボタンだけは採取できている（作成フローの起点）', () => {
    expect(capturedHtml).toContain('data-testid="generate-folder-icon"')
  })

  it('作成ダイアログの中身は採取物に無い（モーダルだけ手書きが残る根拠）', () => {
    // 実物は radix のダイアログ。開いた状態を採取していないので中身が1文字も無い。
    expect(capturedHtml).not.toContain('role="dialog"')
  })
})

describe('UIに絵文字を使わない（共通指示 §4）', () => {
  const files = [
    'src/app/pages/folders.ts',
    'src/app/pages/folders-substrate.ts',
    'src/app/pages/folders-create.ts',
  ]

  it.each(files)('%s に絵文字が無い', (file) => {
    const source = readFileSync(file, 'utf8')
    const found = source.match(/\p{Extended_Pictographic}/gu) ?? []
    expect(found).toEqual([])
  })
})
