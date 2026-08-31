import { describe, it, expect } from 'vitest'
import { isUserDataValue } from '../tools/scrub/policy.ts'

/**
 * フィールド名の**許可リスト**方式は4回続けて実データを素通りさせた
 * （実名 → 実ID → 実ページ名 → 企業名・メールのローカル部）。
 * 列挙を続ける限り必ず5回目が来るので、「知らないフィールドは疑う」へ反転する。
 */
describe('知らないフィールドの文字列は既定でユーザーデータ扱いにする', () => {
  it('許可リストに無い company_name も対象にする', () => {
    expect(isUserDataValue('company_name', '株式会社サンプル')).toBe(true)
  })

  it('許可リストに無い unverified_email も対象にする', () => {
    expect(isUserDataValue('unverified_email', 'taro.yamada@example.co.jp')).toBe(true)
  })

  it('日本語を含む値は必ず対象にする', () => {
    expect(isUserDataValue('whatever_new_field', 'なにかの名前')).toBe(true)
  })
})

describe('構造的な値は対象にしない（過剰な置換は忠実度を殺す）', () => {
  it('APIの列挙値（小文字スネークケース）は素通しする', () => {
    expect(isUserDataValue('ad_status', 'html_rewriting')).toBe(false)
    expect(isUserDataValue('conversion_condition', 'click')).toBe(false)
    expect(isUserDataValue('unknown_field', 'owner')).toBe(false)
  })

  it('日時は素通しする', () => {
    expect(isUserDataValue('joined_at', '2026-08-31T17:40:56.000+09:00')).toBe(false)
    expect(isUserDataValue('any_date', '2026-08-31')).toBe(false)
  })

  it('構造フィールドは素通しする', () => {
    expect(isUserDataValue('id', 'anything')).toBe(false)
    expect(isUserDataValue('status', '準備中')).toBe(false)
  })

  it('短すぎる値は素通しする（誤爆すると本文が壊れる）', () => {
    expect(isUserDataValue('name', 'a')).toBe(false)
    expect(isUserDataValue('name', '')).toBe(false)
  })

  it('真偽値らしき文字列や数値だけの文字列は素通しする', () => {
    expect(isUserDataValue('flag', 'true')).toBe(false)
    expect(isUserDataValue('count', '12345')).toBe(false)
  })

  it('CSSの色や単位は素通しする', () => {
    expect(isUserDataValue('color', '#ffffff')).toBe(false)
    expect(isUserDataValue('width', '620px')).toBe(false)
  })
})

describe('パスは構造。名前として置換しない', () => {
  it('ルートのパスを施策名として置換しない（土台のリンクが壊れる）', () => {
    expect(isUserDataValue('link', '/folders')).toBe(false)
    expect(isUserDataValue('href', '/ab_tests/UID_0001/articles')).toBe(false)
  })

  it('日本語を含むパスは対象にする（名前が埋まっている可能性がある）', () => {
    expect(isUserDataValue('href', '/folders/秋キャンペーン')).toBe(true)
  })
})

describe('CSSの値を名前として置換しない（実CSSが壊れる）', () => {
  it('rgb / rgba を素通しする', () => {
    expect(isUserDataValue('color', 'rgb(0, 0, 0)')).toBe(false)
    expect(isUserDataValue('background', 'rgba(0, 0, 0, 0.87)')).toBe(false)
  })

  it('hsl も素通しする', () => {
    expect(isUserDataValue('color', 'hsl(210, 50%, 40%)')).toBe(false)
  })

  it('複合値（影・グラデーション）も素通しする', () => {
    expect(isUserDataValue('boxShadow', 'rgba(0, 0, 0, 0.3) 0px 0px 40px')).toBe(false)
    expect(isUserDataValue('font', '14px "Hiragino Sans"')).toBe(false)
  })

  it('CSSのキーワードを素通しする', () => {
    expect(isUserDataValue('display', 'inline-block')).toBe(false)
    expect(isUserDataValue('transform', 'translateY(-50%)')).toBe(false)
  })

  it('日本語を含む値は引き続き対象にする（誤って緩めていないこと）', () => {
    expect(isUserDataValue('name', '株式会社サンプル')).toBe(true)
  })
})

describe('フォント指定を名前として置換しない', () => {
  it('フォントスタックを素通しする', () => {
    expect(isUserDataValue('font', '"Hiragino Sans", sans-serif')).toBe(false)
    expect(isUserDataValue('x', 'Hiragino Sans, Arial, sans-serif')).toBe(false)
    expect(isUserDataValue('y', '"Hiragino Sans", "Helvetica Neue", Arial, sans-serif')).toBe(false)
  })

  it('総称ファミリを含まない普通の文字列は引き続き対象にする', () => {
    expect(isUserDataValue('name', 'Acme Marketing Inc')).toBe(true)
  })
})
