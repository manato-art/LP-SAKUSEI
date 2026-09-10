import { describe, it, expect } from 'vitest'
import { MEDIA_TEMPLATES, findMediaTemplate } from '../mock-server/store/media-templates.ts'
import { parseCsvLine, parseProductCsv } from '../mock-server/routes/media.ts'

/**
 * メディア（実SB「ツール > メディア」= /teams/product_search_forms）。
 * テンプレートは 2026-09-10 に実機で6種すべて開いて項目を読み取ったもの。
 */

describe('メディアのテンプレート', () => {
  it('実物と同じ6種が同じ並びで出る', () => {
    expect(MEDIA_TEMPLATES.map((t) => t.name)).toEqual([
      '美容系２',
      '美容系１',
      '求人（項目固定）',
      '転職（選択肢編集可）',
      'web会議用ツール',
      '都道府県',
    ])
  })

  it('どの項目も先頭が「こだわらない」（実物と同じ）', () => {
    for (const t of MEDIA_TEMPLATES) {
      for (const f of t.fields) {
        expect(f.options[0]).toBe('こだわらない')
      }
    }
  })

  it('美容系１は ジャンル 1項目・複数紐付け', () => {
    const t = findMediaTemplate('beauty1')
    expect(t?.fields).toHaveLength(1)
    expect(t?.fields[0]).toEqual({
      name: 'ジャンル',
      type: 'button',
      link: 'multiple',
      options: ['こだわらない', 'シャンプー', '育毛剤'],
    })
  })

  it('都道府県は47件そろっていて、実物にあった誤りが入っていない', () => {
    const f = findMediaTemplate('prefecture')?.fields[0]
    const names = (f?.options ?? []).slice(1)
    expect(names).toHaveLength(47)
    // 実物は「東京県」という誤字で、群馬県が抜けていた（46件）
    expect(names).toContain('東京都')
    expect(names).not.toContain('東京県')
    expect(names).toContain('群馬県')
  })

  it('実データ（個人名）を持ち込んでいない', () => {
    // 実物の「美容系２」1項目めは個人名だった。選択肢に合う名前に置き換えてある。
    expect(findMediaTemplate('beauty2')?.fields[0]?.name).toBe('お悩み')
  })
})

describe('商品CSVの取り込み', () => {
  it('引用符で囲まれたカンマで列を割らない', () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd'])
  })

  it('引用符の中の二重引用符は1つに戻す', () => {
    expect(parseCsvLine('a,"b""c"')).toEqual(['a', 'b"c'])
  })

  it('見出し行を読み飛ばして商品にする', () => {
    const csv = '名前,価格(税抜),評価(1~5),サイトURL,説明文\n商品A,1980,4,https://x.test/a,説明\n'
    expect(parseProductCsv(csv)).toEqual([
      {
        name: '商品A',
        price: 1980,
        rating: 4,
        site_url: 'https://x.test/a',
        description: '説明',
        image: '',
      },
    ])
  })

  it('名前が空の行は捨てる（空行や壊れた行で商品が増えない）', () => {
    expect(parseProductCsv('名前,価格\n,100\n商品B,200')).toHaveLength(1)
  })

  it('評価は5を超えない・価格は負にしない', () => {
    const rows = parseProductCsv('商品C,-500,99,,')
    expect(rows[0]?.price).toBe(0)
    expect(rows[0]?.rating).toBe(5)
  })
})
