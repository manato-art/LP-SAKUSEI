import { describe, it, expect } from 'vitest'
import { findRealNames, loadKnownNames } from '../mock-server/guards/real-name-guard.ts'

const NAMES = ['ナイトエンペラー', '複製用']

describe('実データの持ち込みをモック側で拒む', () => {
  it('本文の文字列が実名を含んでいたら見つける', () => {
    expect(findRealNames({ name: 'ナイトエンペラー' }, NAMES)).toEqual(['ナイトエンペラー'])
  })

  it('部分一致でも見つける（前後に文字があっても素通りさせない）', () => {
    expect(findRealNames({ title: '【控え】複製用のコピー' }, NAMES)).toEqual(['複製用'])
  })

  it('入れ子のオブジェクトと配列も辿る', () => {
    const body = { folder: { items: [{ memo: 'ナイトエンペラー' }] } }
    expect(findRealNames(body, NAMES)).toEqual(['ナイトエンペラー'])
  })

  it('架空データなら何も見つからない', () => {
    expect(findRealNames({ name: 'サンプル施策042' }, NAMES)).toEqual([])
  })

  it('同じ実名が何度出ても1回だけ報告する', () => {
    const body = { a: 'ナイトエンペラー', b: 'ナイトエンペラー' }
    expect(findRealNames(body, NAMES)).toEqual(['ナイトエンペラー'])
  })

  it('実名リストが空なら常に空（誤検知で開発を止めない）', () => {
    expect(findRealNames({ name: 'ナイトエンペラー' }, [])).toEqual([])
  })

  it('数値や null が混ざっていても落ちない', () => {
    expect(findRealNames({ n: 1, z: null, b: true, u: undefined }, NAMES)).toEqual([])
  })
})

describe('実名リストの読み込み', () => {
  it('カテゴリ指定を落として名前だけ返す', () => {
    expect(loadKnownNames('# メモ\nナイトエンペラー = campaign\n金谷\n')).toEqual([
      'ナイトエンペラー',
      '金谷',
    ])
  })

  it('空文字は無視する（空文字は全文字列に一致してしまうため）', () => {
    expect(loadKnownNames('\n  \n= person\n')).toEqual([])
  })
})
