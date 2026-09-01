import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  buildDuplicateRequest,
  buildDeleteRequest,
  VERSION_LIST_HOOK,
} from '../src/app/panels/version-actions.ts'
import { createAbTest, duplicateVersion } from '../mock-server/store/actions.ts'
import { getState, resetState } from '../mock-server/store/store.ts'
import {
  getJson,
  postJson,
  resetStore,
  startTestServer,
  type TestServer,
} from './helpers/server.ts'

/**
 * バージョンカード周りの操作。
 *
 * 目印は**採取した実物から取り出して**突き合わせる（手本 tests/toolbar-from-capture.test.ts）。
 * 実装側の定数リテラルをテストへ書き写すのではなく、採取HTMLを実際にパースして、
 * 使うクラス／data-test が本当に実在することを固定する。
 */
const EDITOR = 'src/app/fragments/ab_tests__UID__articles__editor-target.html'
// _open_x4j8w_84 で開く仕組みは採取した実CSSが持っている
const EDITOR_CSSOM = 'capture/clean/ab_tests__UID__articles/tool-tag-settings/cssom.css'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('Version ▼ ドロップダウンの目印は採取物に実在する（task 2）', () => {
  const html = read(EDITOR)

  it('Version一覧ドロップダウンのマークアップが採取物にある', () => {
    // トリガーに _articleListType_1xibh_329 を持つ _dropdown_x4j8w_1 が実在する
    const block = /_dropdown_x4j8w_1[\s\S]{0,600}?_articleListType_1xibh_329/.exec(html)?.[0]
    expect(block).toBeDefined()
    expect(html).toContain(VERSION_LIST_HOOK.dropdown.replace('.', '').replace('_', '_')) // sanity
    // 2つの選択肢（Version / アーカイブ）が本体に採取されている
    const body = /_bodyWrapper_x4j8w_8[\s\S]{0,400}?<\/div><\/div>/.exec(
      html.slice(html.indexOf('_articleListType_1xibh_329')),
    )?.[0]
    expect(body).toBeDefined()
    expect(body).toContain('Version')
    expect(body).toContain('アーカイブ')
  })

  it('開閉クラス _open_x4j8w_84 が採取した実CSSに実在する', () => {
    const css = read(EDITOR_CSSOM)
    expect(css).toContain('_open_x4j8w_84')
    // 既定は display:none、_open で block になる（＝手書きCSSを足さずに済む根拠）
    expect(css).toMatch(/_bodyWrapper_x4j8w_8\._open_x4j8w_84\s*\{\s*display:\s*block/)
  })

  it('HOOK が採取物のクラスと一致する', () => {
    for (const cls of [
      VERSION_LIST_HOOK.listType,
      VERSION_LIST_HOOK.trigger,
      VERSION_LIST_HOOK.bodyWrapper,
      VERSION_LIST_HOOK.activeOption,
    ]) {
      // クラスセレクタ（先頭の . を外した素のクラス名）が採取物に含まれる
      expect(html).toContain(cls.replace(/^\./, ''))
    }
    expect(VERSION_LIST_HOOK.openClass).toBe('_open_x4j8w_84')
  })
})

describe('採取物に無い部分は「無い」ことを固定する（task 1 トリガー / task 3 ツールチップ）', () => {
  const html = read(EDITOR)

  it('バージョンカードの「…」トリガー css-3tls8 は実在する', () => {
    // _articleButtons_1xibh_160 の中に MoreHoriz ボタン（css-3tls8）が居る
    const buttons = /_articleButtons_1xibh_160[\s\S]{0,1200}?Article-BtnCreateNewArticle/.exec(html)?.[0]
    expect(buttons).toBeDefined()
    expect(buttons).toContain('css-3tls8')
  })

  it('バージョンカードの操作メニュー（_actionDropdown_1ti69）は採取されていない', () => {
    // _actionDropdown_1ti69 は右レールの「Widget管理」側にしか無い（widget-manager.ts が担当）。
    // カードのボタン群の中には採取されていない＝勝手に作ってはいけない。
    const buttons = /_articleButtons_1xibh_160[\s\S]{0,1200}?Article-BtnCreateNewArticle/.exec(html)?.[0]
    expect(buttons).toBeDefined()
    expect(buttons).not.toContain('_actionDropdown_1ti69')
    expect(buttons).not.toContain('btnActionDuplicate')
  })

  it('配信割合の (?) はヘルプアイコンだけで、ツールチップ本文は採取されていない', () => {
    const at = html.indexOf('help-icon-wrapper')
    expect(at).toBeGreaterThan(0)
    const after = html.slice(at, at + 400)
    // 本文（_tooltipDescription / _bodyWrapper）が付いていない＝文言は未採取
    expect(after).not.toContain('_tooltipDescription')
    expect(after).not.toContain('_bodyWrapper_x4j8w_8')
  })
})

describe('リクエスト組み立て（純粋関数）', () => {
  it('複製リクエストは POST /versions/:uid/duplicate', () => {
    expect(buildDuplicateRequest('VERSION_0003')).toEqual({
      method: 'POST',
      path: '/versions/VERSION_0003/duplicate',
    })
  })

  it('削除リクエストは DELETE /versions/:uid', () => {
    expect(buildDeleteRequest('VERSION_0003')).toEqual({
      method: 'DELETE',
      path: '/versions/VERSION_0003',
    })
  })

  it('uid が空なら組み立てを拒否する（境界で失敗させる）', () => {
    expect(() => buildDuplicateRequest('')).toThrow()
    expect(() => buildDeleteRequest('')).toThrow()
  })
})

describe('duplicateVersion（ストアのイミュータブル更新）', () => {
  beforeEach(() => {
    resetState()
  })

  it('元Versionを複製し、直後に挿入する', () => {
    const created = createAbTest(getState(), { title: 'サンプル施策001', memo: '', folder_id: null, media_id: null })
    const source = created.version
    const out = duplicateVersion(created.state, source.uid)

    expect(out.version).not.toBeNull()
    const copy = out.version
    if (copy === null) throw new Error('複製に失敗')

    // 別物の uid / id
    expect(copy.uid).not.toBe(source.uid)
    expect(copy.id).not.toBe(source.id)
    // 中身（html/css）はコピーされる
    expect(copy.html).toBe(source.html)
    expect(copy.css).toBe(source.css)
    // 追加Versionと同じ既定（配信割合0・非コントロール・準備中）
    expect(copy.distribution_ratio).toBe(0)
    expect(copy.is_control).toBe(false)
    expect(copy.status).toBe('準備中')
    // 名前は Ver.NNNN 形式で自動採番
    expect(copy.name).toMatch(/^Ver\.\d{4}$/)

    // 元の直後に挿入されている
    const siblings = out.state.versions.filter((v) => v.article_id === source.article_id)
    expect(siblings).toHaveLength(2)
    const srcIndex = out.state.versions.findIndex((v) => v.uid === source.uid)
    expect(out.state.versions[srcIndex + 1]?.uid).toBe(copy.uid)
  })

  it('元の State を破壊しない（イミュータブル）', () => {
    const created = createAbTest(getState(), { title: 'サンプル施策001', memo: '', folder_id: null, media_id: null })
    const before = created.state
    const beforeCount = before.versions.length
    duplicateVersion(before, created.version.uid)
    expect(before.versions).toHaveLength(beforeCount)
  })

  it('存在しない uid は version:null で State を変えない', () => {
    const state = getState()
    const out = duplicateVersion(state, 'NOPE_9999')
    expect(out.version).toBeNull()
    expect(out.state).toBe(state)
  })
})

describe('POST /versions/:uid/duplicate（ルート結線）', () => {
  let server: TestServer
  beforeEach(async () => {
    resetStore()
    server = await startTestServer()
  })
  afterEach(async () => {
    await server.close()
  })

  it('複製すると一覧が1件増える（201）', async () => {
    const created = await postJson<{ article: { uid: string }; version: { uid: string } }>(
      `${server.api}/ab_tests`,
      { title: 'サンプル施策001', media_id: 1 },
    )
    const articleUid = created.json.article.uid
    const versionUid = created.json.version.uid

    const dup = await postJson<{ version: { uid: string; name: string; distribution_ratio: number } }>(
      `${server.api}/versions/${versionUid}/duplicate`,
    )
    expect(dup.status).toBe(201)
    expect(dup.json.version.uid).not.toBe(versionUid)
    expect(dup.json.version.distribution_ratio).toBe(0)

    const versions = await getJson<{ versions: unknown[] }>(
      `${server.api}/articles/${articleUid}/versions`,
    )
    expect(versions.versions).toHaveLength(2)
  })

  it('存在しない uid は 404', async () => {
    const dup = await postJson(`${server.api}/versions/NOPE_9999/duplicate`)
    expect(dup.status).toBe(404)
  })
})
