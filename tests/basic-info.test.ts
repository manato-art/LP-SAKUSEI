/**
 * 「基本情報」タブ（`/folders/:folder_uid/ab_tests/:ab_test_uid/edit`）の機械証明。
 *
 * 環境は node なのでDOMは触れない（共通指示 §5）。
 * 「この入力から何のリクエストを作るか」を純粋関数に切り出して検証し、
 * 併せて採取した土台（fragment）に配線の目印が全部揃っていることを確かめる。
 */
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import express from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { basicInfoRouter } from '../mock-server/routes/panel-basic-info.ts'
import { parseAbTestPatch } from '../mock-server/store/ab-test-patch.ts'
import { createAbTest, createFolder } from '../mock-server/store/actions.ts'
import { getState, resetState, setState } from '../mock-server/store/store.ts'
import {
  buildUpdatePayload,
  deliveryUrl,
  toFormValues,
  validateBasicInfo,
  type AbTestForEdit,
} from '../src/app/pages/basic-info-form.ts'
import { getJson, getStatus, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

const FRAGMENT = 'src/app/fragments/folders__UID__ab_tests__UID__edit__default.html'

let server: Server
let api: string

function createRouterApp(): express.Express {
  const app = express()
  app.use(express.json())
  app.use('/api/v1', basicInfoRouter)
  return app
}

/** フォルダ1件 + beyondページ1件を作り、uid を返す */
function seedAbTest(title = 'サンプル施策001'): { abTestUid: string; folderId: number } {
  let abTestUid = ''
  let folderId = 0
  setState((state) => {
    const folderOut = createFolder(state, { name: 'サンプルフォルダ001', parent_id: null })
    folderId = folderOut.folder.id
    const out = createAbTest(folderOut.state, {
      title,
      memo: '',
      folder_id: folderOut.folder.id,
      media_id: 3,
    })
    abTestUid = out.abTest.uid
    return out.state
  })
  return { abTestUid, folderId }
}

const BASE_RECORD: AbTestForEdit = {
  uid: 'ABTEST_0001',
  title: 'サンプル施策001',
  memo: '',
  ad_status: 'prepared',
  editor_version: 2,
  delivery_type: 'html_rewriting',
  media_id: 3,
  conversion_unit_price: 0,
  conversion_setting: { conversion_condition: 'click' },
  affiliate_service_provider: null,
  gender: null,
  age_from: null,
  age_to: null,
  media: { id: 3, name: 'サンプル媒体003' },
  folder: { uid: 'FOLDER_0001', name: 'サンプルフォルダ001' },
}

beforeAll(async () => {
  server = createServer(createRouterApp())
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('ポート取得に失敗しました')
  api = `http://127.0.0.1:${address.port}/api/v1`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
})

beforeEach(() => {
  resetState()
})

// ── 採取した土台に、配線の目印が実在するか ──────────────────
describe('採取した基本情報タブの土台', () => {
  const html = readFileSync(FRAGMENT, 'utf8')

  it('フォームと、既知の data-testid が実在する', () => {
    expect(html).toContain('data-testid="beyond-page-form"')
    expect(html).toContain('data-testid="editor-version-select"')
    expect(html).toContain('data-testid="media-select"')
  })

  it('11個のラベル（＝フォーム項目）がすべて実在する', () => {
    const labels = [...html.matchAll(/<label\b[^>]*>([^<]*)<\/label>/g)].map((m) => m[1])
    expect(labels).toEqual([
      'beyondページ名',
      '編集タイプ',
      '配信タイプ',
      'CV条件',
      '計測ツール・ASP',
      '媒体',
      'メモ',
      '性別',
      '歳以上',
      '歳以下',
      'コンバージョン単価',
    ])
  })

  it('4つのタブ（基本情報/Version/ポップアップ/レポート）が実在する', () => {
    // PC用とSP用で同じナビが2組ある（実DOM）
    expect(html.match(/id="info"/g)).toHaveLength(2)
    expect(html.match(/id="version"/g)).toHaveLength(2)
    expect(html.match(/id="popup"/g)).toHaveLength(2)
    expect(html.match(/id="report"/g)).toHaveLength(2)
  })

  it('配線に使う目印がすべて実在する（採取し直しで消えたらここが落ちる）', () => {
    for (const hook of [
      // 本体側（サイドバーはシェルが出すので、ここだけを使う）
      'ehppitp0',
      // MUI Select は「表示用div + 隠しinput」の2箇所に値を書く
      'MuiSelect-select',
      'MuiSelect-nativeInput',
      // 上部バー
      '_currentAbTest_',
      '_folderName_',
      '_back_',
      // 配信URL
      'aria-label="コピーする"',
      'href="/teams/asp_accounts"',
      // 計測ツール・ASP（Autocomplete）
      'aria-label="クリア"',
      'aria-label="開く"',
      // 「〜の詳細を確認する」の開閉先
      'MuiCollapse-root',
      // 更新する
      'type="submit"',
    ]) {
      expect(html).toContain(hook)
    }
  })

  it('クローンが押さえるボタン・リンクの文言が実在する', () => {
    for (const label of [
      'パラメータ付きURLの発行',
      'CV条件の詳細を確認する',
      '計測ツール・ASP条件の詳細を確認する',
      'フォルダ基本情報画面',
      '更新する',
    ]) {
      expect(html).toContain(label)
    }
  })

  it('削除・公開などの破壊的な操作は無い（配線しない）', () => {
    expect(html).not.toContain('削除する')
    expect(html).not.toContain('公開する')
  })

  it('マイクロコピーを verbatim で保持している', () => {
    expect(html).toContain('50文字まで入力できます')
    expect(html).toContain('後から変更できません')
    expect(html).toContain('※「ab/」以降は変更できません。')
    expect(html).toContain('コンバージョン単価を設定することで売上が表示されます')
  })

  it('MUIのドロップダウン（選択肢一覧）は採取されていない', () => {
    // ここが緑のままなら、select は「表示のみ」で正しい。
    // 採取できたらこのテストが落ちるので、そのとき選択肢を配線する。
    expect(html).not.toContain('role="listbox"')
    expect(html).not.toContain('MuiMenuItem-root')
  })
})

// ── 画面 → リクエスト（純粋関数）────────────────────────────
describe('toFormValues', () => {
  it('null は空文字にして入力欄へ流し込める形にする', () => {
    const values = toFormValues({ ...BASE_RECORD, affiliate_service_provider: null })
    expect(values).toEqual({
      title: 'サンプル施策001',
      memo: '',
      affiliate_service_provider: '',
      conversion_unit_price: '0',
    })
  })

  it('保存済みの値はそのまま文字列で返す', () => {
    const values = toFormValues({
      ...BASE_RECORD,
      memo: 'サンプルメモ',
      affiliate_service_provider: 'サンプルASP-01',
      conversion_unit_price: 3000,
    })
    expect(values.memo).toBe('サンプルメモ')
    expect(values.affiliate_service_provider).toBe('サンプルASP-01')
    expect(values.conversion_unit_price).toBe('3000')
  })
})

describe('buildUpdatePayload', () => {
  it('入力欄の値と、画面が保持している値をまとめて1本のリクエストにする', () => {
    const payload = buildUpdatePayload(BASE_RECORD, {
      title: '  サンプル施策002  ',
      memo: 'サンプルメモ',
      affiliate_service_provider: 'サンプルASP-01',
      conversion_unit_price: '1200',
    })
    expect(payload).toEqual({
      title: 'サンプル施策002',
      memo: 'サンプルメモ',
      media_id: 3,
      delivery_type: 'html_rewriting',
      conversion_condition: 'click',
      conversion_unit_price: 1200,
      affiliate_service_provider: 'サンプルASP-01',
      gender: null,
      age_from: null,
      age_to: null,
    })
  })

  it('空文字の計測ツール・ASP は null にする（「未設定」を空文字で保存しない）', () => {
    const payload = buildUpdatePayload(BASE_RECORD, {
      title: 'サンプル施策001',
      memo: '',
      affiliate_service_provider: '   ',
      conversion_unit_price: '',
    })
    expect(payload['affiliate_service_provider']).toBeNull()
    expect(payload['conversion_unit_price']).toBe(0)
  })

  it('選択系（媒体・配信タイプ・CV条件・性別・年齢）は読み込んだ値をそのまま返す', () => {
    const payload = buildUpdatePayload(
      {
        ...BASE_RECORD,
        media_id: 17,
        delivery_type: 'redirect',
        conversion_setting: { conversion_condition: 'access' },
        gender: 'female',
        age_from: 20,
        age_to: 49,
      },
      { title: 'サンプル施策001', memo: '', affiliate_service_provider: '', conversion_unit_price: '0' },
    )
    expect(payload).toMatchObject({
      media_id: 17,
      delivery_type: 'redirect',
      conversion_condition: 'access',
      gender: 'female',
      age_from: 20,
      age_to: 49,
    })
  })
})

describe('validateBasicInfo', () => {
  const ok = { title: 'サンプル施策001', memo: '', affiliate_service_provider: '', conversion_unit_price: '0' }

  it('正しい入力は通る', () => {
    expect(validateBasicInfo(ok)).toEqual({ ok: true })
  })

  it('beyondページ名が空なら止める', () => {
    const result = validateBasicInfo({ ...ok, title: '   ' })
    expect(result).toEqual({ ok: false, message: 'beyondページ名を入力してください。' })
  })

  it('beyondページ名は50文字まで（実物のヘルプ文言と同じ境界）', () => {
    expect(validateBasicInfo({ ...ok, title: 'あ'.repeat(50) })).toEqual({ ok: true })
    expect(validateBasicInfo({ ...ok, title: 'あ'.repeat(51) })).toEqual({
      ok: false,
      message: 'beyondページ名は50文字まで入力できます。',
    })
  })

  it('コンバージョン単価は0以上の数値', () => {
    expect(validateBasicInfo({ ...ok, conversion_unit_price: '-1' })).toEqual({
      ok: false,
      message: 'コンバージョン単価は0以上の数値で入力してください。',
    })
    expect(validateBasicInfo({ ...ok, conversion_unit_price: 'abc' })).toEqual({
      ok: false,
      message: 'コンバージョン単価は0以上の数値で入力してください。',
    })
  })
})

describe('deliveryUrl', () => {
  it('配信URLはローカルだけを指す（本番ドメインを作らない・§3-2）', () => {
    const url = deliveryUrl('http://localhost:5173', 'ABTEST_0001')
    expect(url).toBe('http://localhost:5173/#/ab/ABTEST_0001')
    expect(url).not.toContain('squadbeyond')
  })
})

// ── モックAPI（境界のバリデーション）────────────────────────
describe('parseAbTestPatch', () => {
  it('body に無いキーは patch に含めない（部分更新でフォルダ/媒体が消えない）', () => {
    const parsed = parseAbTestPatch({ title: 'サンプル施策002' })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value).toEqual({ title: 'サンプル施策002' })
    expect('folder_id' in parsed.value).toBe(false)
    expect('media_id' in parsed.value).toBe(false)
  })

  it('CV条件は click / access のみ', () => {
    expect(parseAbTestPatch({ conversion_condition: 'access' })).toEqual({
      ok: true,
      value: { conversion_setting: { conversion_condition: 'access' } },
    })
    const bad = parseAbTestPatch({ conversion_condition: 'form' })
    expect(bad).toEqual({ ok: false, message: 'CV条件はクリックかアクセスのいずれかを指定してください。' })
  })

  it('beyondページ名は空にできず、50文字まで', () => {
    expect(parseAbTestPatch({ title: '   ' })).toEqual({
      ok: false,
      message: 'beyondページ名を入力してください。',
    })
    expect(parseAbTestPatch({ title: 'あ'.repeat(51) })).toEqual({
      ok: false,
      message: 'beyondページ名は50文字まで入力できます。',
    })
  })

  it('コンバージョン単価は0以上', () => {
    expect(parseAbTestPatch({ conversion_unit_price: -1 })).toEqual({
      ok: false,
      message: 'コンバージョン単価は0以上の数値で入力してください。',
    })
  })

  it('空文字の任意項目は null にする', () => {
    const parsed = parseAbTestPatch({ affiliate_service_provider: '', gender: '', age_from: '' })
    expect(parsed).toEqual({
      ok: true,
      value: { affiliate_service_provider: null, gender: null, age_from: null },
    })
  })
})

describe('GET /ab_tests/:uid/edit（実機が叩くエンドポイント）', () => {
  it('基本情報タブが必要とする項目を全部返す', async () => {
    const { abTestUid } = seedAbTest()
    const body = await getJson<{ ab_test: Record<string, unknown> }>(
      `${api}/ab_tests/${abTestUid}/edit`,
    )
    for (const key of [
      'title',
      'memo',
      'editor_version',
      'delivery_type',
      'media_id',
      'conversion_setting',
      'conversion_unit_price',
      'affiliate_service_provider',
      'gender',
      'age_from',
      'age_to',
      'folder',
    ]) {
      expect(Object.keys(body.ab_test)).toContain(key)
    }
  })

  it('存在しないページは404（未定義404を作らない・§13-B）', async () => {
    expect(await getStatus(`${api}/ab_tests/NOT_EXIST/edit`)).toBe(404)
  })
})

describe('GET /medias・/affiliate_service_providers（実機が叩くエンドポイント）', () => {
  it('媒体ロスターを返す', async () => {
    const body = await getJson<{ medias: { id: number; name: string }[] }>(`${api}/medias`)
    expect(body.medias.length).toBeGreaterThan(0)
    expect(body.medias[0]).toHaveProperty('name')
  })

  it('計測ツール・ASPのロスターを返す', async () => {
    const body = await getJson<{ affiliate_service_providers: string[] }>(
      `${api}/affiliate_service_providers`,
    )
    expect(Array.isArray(body.affiliate_service_providers)).toBe(true)
  })
})

describe('PUT /ab_tests/:uid（更新する）', () => {
  it('送っていない項目は書き換えない（フォルダと媒体が消えない）', async () => {
    const { abTestUid, folderId } = seedAbTest()
    const saved = await sendJson<{ ab_test: { folder_id: number | null; media_id: number | null } }>(
      'PUT',
      `${api}/ab_tests/${abTestUid}`,
      { title: 'サンプル施策002' },
    )
    expect(saved.status).toBe(200)
    expect(saved.json.ab_test.folder_id).toBe(folderId)
    expect(saved.json.ab_test.media_id).toBe(3)
  })

  it('基本情報タブの全項目が保存され、再取得で戻ってくる', async () => {
    const { abTestUid } = seedAbTest()
    await sendJson('PUT', `${api}/ab_tests/${abTestUid}`, {
      title: 'サンプル施策002',
      memo: 'サンプルメモ',
      media_id: 17,
      delivery_type: 'redirect',
      conversion_condition: 'access',
      conversion_unit_price: 1500,
      affiliate_service_provider: 'サンプルASP-01',
      gender: 'female',
      age_from: 20,
      age_to: 49,
    })
    const body = await getJson<{ ab_test: Record<string, unknown> }>(
      `${api}/ab_tests/${abTestUid}/edit`,
    )
    expect(body.ab_test).toMatchObject({
      title: 'サンプル施策002',
      memo: 'サンプルメモ',
      media_id: 17,
      delivery_type: 'redirect',
      conversion_unit_price: 1500,
      affiliate_service_provider: 'サンプルASP-01',
      gender: 'female',
      age_from: 20,
      age_to: 49,
      conversion_setting: { conversion_condition: 'access' },
    })
  })

  it('編集タイプ（editor_version）は後から変更できない', async () => {
    const { abTestUid } = seedAbTest()
    await sendJson('PUT', `${api}/ab_tests/${abTestUid}`, { editor_version: 3 })
    const state = getState()
    expect(state.abTests.find((t) => t.uid === abTestUid)?.editor_version).toBe(2)
  })

  it('壊れた入力は422 + エラー封筒', async () => {
    const { abTestUid } = seedAbTest()
    const res = await sendJson<{ error: { code: string; message: string } }>(
      'PUT',
      `${api}/ab_tests/${abTestUid}`,
      { title: '' },
    )
    expect(res.status).toBe(422)
    expect(res.json.error.code).toBe('validation_failed')
  })

  it('存在しないページは404', async () => {
    const res = await sendJson('PUT', `${api}/ab_tests/NOT_EXIST`, { title: 'サンプル施策002' })
    expect(res.status).toBe(404)
  })
})

// ── app.ts に本当に載っているか（ルーター単体では分からない）──────
describe('モックサーバー本体への配線', () => {
  let app: TestServer

  beforeAll(async () => {
    app = await startTestServer()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /ab_tests/:uid/edit がアプリ経由で引ける', async () => {
    const { abTestUid } = seedAbTest()
    expect(await getStatus(`${app.api}/ab_tests/${abTestUid}/edit`)).toBe(200)
  })

  it('PUT /ab_tests/:uid は基本情報タブの実装が受ける（フォルダ/媒体が消えない）', async () => {
    const { abTestUid, folderId } = seedAbTest()
    const saved = await sendJson<{ ab_test: { folder_id: number | null; media_id: number | null } }>(
      'PUT',
      `${app.api}/ab_tests/${abTestUid}`,
      { memo: 'サンプルメモ' },
    )
    expect(saved.status).toBe(200)
    expect(saved.json.ab_test.folder_id).toBe(folderId)
    expect(saved.json.ab_test.media_id).toBe(3)
  })

  it('GET /medias・/affiliate_service_providers がアプリ経由で引ける', async () => {
    expect(await getStatus(`${app.api}/medias`)).toBe(200)
    expect(await getStatus(`${app.api}/affiliate_service_providers`)).toBe(200)
  })

  it('既存の GET /ab_tests/:uid もターゲティング項目を返すようになった', async () => {
    const { abTestUid } = seedAbTest()
    const body = await getJson<{ ab_test: Record<string, unknown> }>(
      `${app.api}/ab_tests/${abTestUid}`,
    )
    expect(Object.keys(body.ab_test)).toEqual(
      expect.arrayContaining(['gender', 'age_from', 'age_to']),
    )
  })
})
