/**
 * 匿名化パイプラインの検証（企画書 §5-5）。
 *
 * 検証の主眼は2つ:
 *   1. ユーザー生成コンテンツが確実に置換されること（漏洩防止）
 *   2. マイクロコピー（ラベル・エラー文・空状態文）が verbatim で残ること（忠実度の本体を壊さない）
 *
 * テストデータはすべて架空。実データは一切使わない（§3-1）。
 */
import { describe, expect, it } from 'vitest'
import { collectFromJson, collectKnownNames, applyDictionary, type ScrubMap } from '../tools/scrub/dictionary.ts'
import { scrubJson, scrubText, type HostRewrite } from '../tools/scrub/scrub.ts'
import { fakeNumberLike, fakePersonName } from '../tools/scrub/replacers.ts'

/** テスト用の「本番ホスト」。実ドメインは使わない。 */
const HOSTS: HostRewrite = {
  productionHostPattern: /(?:https?:\/\/)?[a-z0-9-]+\.example-prod\.test/gi,
}

function buildMap(fixture: unknown, names: readonly string[] = []): ScrubMap {
  const map: ScrubMap = {}
  collectFromJson(fixture, map)
  collectKnownNames(names, map)
  return map
}

describe('置換辞書の構築（フィールド名を手がかりにする）', () => {
  it('ユーザーデータのフィールド値を辞書に採用する', () => {
    const map = buildMap({ ab_tests: [{ title: '極秘キャンペーン名', memo: '社外秘メモ' }] })
    expect(map['極秘キャンペーン名']).toBeDefined()
    expect(map['社外秘メモ']).toBeDefined()
  })

  it('構造フィールド（status/role/icon_name等）は辞書に載せない', () => {
    const map = buildMap({ versions: [{ status: '公開中', role: 'team-owner', icon_name: 'fab fa-line' }] })
    expect(map['公開中']).toBeUndefined()
    expect(map['team-owner']).toBeUndefined()
    expect(map['fab fa-line']).toBeUndefined()
  })

  it('短すぎる値は誤爆防止のため辞書に載せない', () => {
    const map = buildMap({ ab_tests: [{ title: 'あ' }] })
    expect(map['あ']).toBeUndefined()
  })

  it('日本語は2文字でも辞書に載せる（姓が2文字なのを取りこぼさない）', () => {
    // ASCII基準の3文字固定にすると「大山」「内田」のような実在姓が素通りする（実採取で踏んだバグ）
    const map = buildMap({ folders: [{ name: '架空山' }], members: [{ name: '仮田' }] })
    expect(map['仮田']).toBeDefined()
    expect(map['架空山']).toBeDefined()
  })

  it('ASCIIは2文字だと一般語すぎるので辞書に載せない', () => {
    const map = buildMap({ ab_tests: [{ title: 'ab' }] })
    expect(map['ab']).toBeUndefined()
  })
})

describe('参照整合（§5-5「同じ実値は常に同じ架空値へ写す」）', () => {
  it('同じ実値は、異なるファイル・異なる箇所でも同じ架空値になる', () => {
    const map = buildMap({ ab_tests: [{ title: '極秘キャンペーン名' }] })
    const a = applyDictionary('一覧: 極秘キャンペーン名', map)
    const b = applyDictionary('詳細画面の見出しは 極秘キャンペーン名 です', map)
    const replacement = map['極秘キャンペーン名']?.replacement ?? ''
    expect(a).toContain(replacement)
    expect(b).toContain(replacement)
    expect(a).not.toContain('極秘キャンペーン名')
  })

  it('決定論: 同じ入力からは毎回同じ架空値が出る', () => {
    expect(fakePersonName('架空 太一')).toBe(fakePersonName('架空 太一'))
    expect(fakePersonName('架空 太一')).not.toBe(fakePersonName('架空 次郎'))
  })

  it('金額は桁感を保ったまま別の数字になる', () => {
    const scrubbed = fakeNumberLike('1,234,567')
    expect(scrubbed).not.toBe('1,234,567')
    expect(scrubbed).toMatch(/^\d,\d{3},\d{3}$/) // 区切りと桁数は維持
  })
})

describe('マイクロコピーの verbatim 保持（忠実度の本体・§5-5）', () => {
  it('ラベル・ボタン文言・空状態文・バリデーション文言はそのまま残る', () => {
    const map = buildMap({ ab_tests: [{ title: '極秘キャンペーン名' }] })
    const chrome = [
      '<button>beyondページを作成</button>',
      '<p class="empty">まだbeyondページがありません</p>',
      '<span class="error">配信割合は0〜100の範囲で入力してください。</span>',
      '<th>配信割合</th><th>売上</th><th>ROAS</th>',
    ].join('')
    const { text } = scrubText(chrome, map, HOSTS)
    expect(text).toContain('beyondページを作成')
    expect(text).toContain('まだbeyondページがありません')
    expect(text).toContain('配信割合は0〜100の範囲で入力してください。')
    expect(text).toContain('<th>ROAS</th>')
  })

  it('ユーザーデータだけが置換され、周りのマークアップは壊れない', () => {
    const map = buildMap({ ab_tests: [{ title: '極秘キャンペーン名' }] })
    const { text } = scrubText('<td class="title">極秘キャンペーン名</td>', map, HOSTS)
    expect(text).toMatch(/^<td class="title">.+<\/td>$/)
    expect(text).not.toContain('極秘キャンペーン名')
  })
})

describe('除去（§5-5「除去」・§13-G）', () => {
  it('本番JSバンドル参照を除去する', () => {
    const html = '<script src="/assets/index-cb391eb6.js"></script><div>本文</div>'
    const { text, stripped } = scrubText(html, {}, HOSTS)
    expect(text).not.toContain('index-cb391eb6.js')
    expect(text).toContain('<div>本文</div>')
    expect(stripped).toContain('本番JSバンドル参照')
  })

  it('外部SaaSタグを除去する', () => {
    const html = '<script src="https://www.googletagmanager.com/gtm.js?id=GTM-XXXX"></script><main>UI</main>'
    const { text, stripped } = scrubText(html, {}, HOSTS)
    expect(text).not.toContain('googletagmanager')
    expect(text).toContain('<main>UI</main>')
    expect(stripped).toContain('外部SaaSのscript')
  })
})

describe('回帰: SaaS除去が土台を巻き込まないこと（実採取で踏んだバグ）', () => {
  it('SaaS識別子を含まない script は残す（全script削除にしてはいけない）', () => {
    const html = '<script>const APP_CONFIG={locale:"ja"};</script><script src="/assets/app.js"></script>'
    const { text } = scrubText(html, {}, HOSTS)
    expect(text).toContain('APP_CONFIG')
    expect(text).toContain('/assets/app.js')
  })

  it('SaaS識別子を含む script だけを消す（混在時）', () => {
    const html =
      '<script>const KEEP=1;</script>' +
      '<script>window.pendo=window.pendo||{};</script>' +
      '<script>const ALSO_KEEP=2;</script>'
    const { text } = scrubText(html, {}, HOSTS)
    expect(text).toContain('KEEP')
    expect(text).toContain('ALSO_KEEP')
    expect(text).not.toContain('pendo')
  })

  it('SaaS識別子を含まない link / iframe は残す', () => {
    const html = '<link rel="stylesheet" href="/assets/app.css"><iframe src="/preview"></iframe>'
    const { text } = scrubText(html, {}, HOSTS)
    expect(text).toContain('/assets/app.css')
    expect(text).toContain('/preview')
  })

  it('GTMのコンテナIDのような識別子は残骸も消す（§13-Gは0件必須）', () => {
    const { text } = scrubText('<div data-gtm="GTM-ABCD1234">x</div>', {}, HOSTS)
    expect(text).not.toContain('GTM-ABCD1234')
  })
})

describe('ホスト書き換え（§3-2・§13-F）', () => {
  it('APIホストは localhost へ、WebSocketは localhost の /cable へ', () => {
    const html = '<script>const API="https://api.example-prod.test/api/v1";const WS="wss://app.example-prod.test/cable";</script>'
    const { text } = scrubText(html, {}, HOSTS)
    expect(text).not.toContain('example-prod.test')
    expect(text).toContain('localhost')
    expect(text).toContain('ws://localhost:4010/cable')
  })

  it('メールアドレスと電話番号は架空値に置換される', () => {
    const { text } = scrubText('連絡先: someone@example-prod.test / 03-1234-5678', {}, HOSTS)
    expect(text).not.toContain('someone@')
    expect(text).not.toContain('03-1234-5678')
    expect(text).toContain('example.test')
  })
})

describe('JSON(fixtures)のスクラブ', () => {
  it('構造とキーは保ち、文字列値だけ置換する', () => {
    const fixture = {
      pagination: { total_count: 3, current_page: 1 },
      ab_tests: [{ uid: 'ABC123XYZ789', title: '極秘キャンペーン名', status: '公開中' }],
    }
    const map = buildMap(fixture)
    const scrubbed = scrubJson(fixture, map, HOSTS) as typeof fixture

    expect(scrubbed.pagination).toEqual({ total_count: 3, current_page: 1 })
    expect(scrubbed.ab_tests[0]?.status).toBe('公開中') // 構造フィールドは保持
    expect(scrubbed.ab_tests[0]?.title).not.toBe('極秘キャンペーン名')
    expect(Object.keys(scrubbed.ab_tests[0] ?? {})).toEqual(['uid', 'title', 'status'])
  })
})

describe('既知実名リスト（§5-5 人名検出）', () => {
  it('fixturesに現れない実名もDOM本文から置換される', () => {
    const map = buildMap({}, ['架空 太一', '架空 花恵'])
    const { text } = scrubText('<span class="creator">架空 太一</span>', map, HOSTS)
    expect(text).not.toContain('架空 太一')
    expect(text).toMatch(/<span class="creator">.+<\/span>/)
  })
})

describe('回帰: 通しスモークで見つかった漏れ', () => {
  it('数値フィールドの金額が、DOM上の整形表示（¥1,234,567）でも置換される', () => {
    // fixtures では数値、DOMではカンマ区切り文字列として現れる。
    // 数値のまま辞書に載せないと DOM 側の表示が素通りしてしまう（実データ漏洩）。
    const fixture = { ab_tests: [{ title: '極秘案件', sales: 12345678, ad_cost: 3456789 }] }
    const map = buildMap(fixture)
    const { text } = scrubText('<td>¥12,345,678</td><td>3,456,789</td>', map, HOSTS)
    expect(text).not.toContain('12,345,678')
    expect(text).not.toContain('3,456,789')
    expect(text).toMatch(/^<td>¥[\d,]+<\/td><td>[\d,]+<\/td>$/) // 書式は保つ
  })

  it('ROAS等の小数比率も置換される（§5-5 はROAS/ROIも置換対象）', () => {
    const fixture = { rows: [{ roas: 3.57, roi: 2.14, cvr: 0.0325 }] }
    const map = buildMap(fixture)
    const { text } = scrubText('<td>3.57</td><td>2.14</td>', map, HOSTS)
    expect(text).not.toContain('3.57')
    expect(text).not.toContain('2.14')
    expect(text).toMatch(/^<td>\d+\.\d{2}<\/td><td>\d+\.\d{2}<\/td>$/) // 小数桁数は保つ
  })

  it('既知実名は、fixturesで別カテゴリに分類されていても人名として置換される', () => {
    // creator.name は 'name' フィールドなので campaign 判定されるが、
    // 実名リストに載っている以上「人名」として扱わないと「サンプル施策042」のような不自然な出力になる。
    const fixture = { ab_tests: [{ creator: { name: '架空 太一' } }] }
    const map = buildMap(fixture, ['架空 太一'])
    expect(map['架空 太一']?.category).toBe('person')
    const { text } = scrubText('<td class="creator">架空 太一</td>', map, HOSTS)
    expect(text).not.toContain('架空 太一')
    expect(text).not.toContain('サンプル施策')
  })
})
