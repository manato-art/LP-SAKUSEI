/**
 * 「見本から作る」の流れ（2026-09-22・本人の依頼）。
 *
 * ノーコードの入口から「見本を選ぶ」を押した人だけ、見本を「追加」したあとに
 * そのまま編集画面を開く（今までの「追加」を押した人の動きは変えない）。
 */
import { describe, expect, it } from 'vitest'
import { armEditAfterInsert, consumeEditAfterInsert, defaultRegisterName, newestNode, rememberSampleTitle, sampleTitleOf } from '../src/app/panels/nocode/nocode-flow.ts'

describe('追加したら編集画面を開くかどうか', () => {
  it('入口で見本を選びに行ったときだけ、1回だけ開く', () => {
    expect(consumeEditAfterInsert(), '普段の「追加」では開かない').toBe(false)
    armEditAfterInsert()
    expect(consumeEditAfterInsert()).toBe(true)
    expect(consumeEditAfterInsert(), '次の「追加」ではもう開かない').toBe(false)
  })
})

describe('いま足したWidgetを見つける', () => {
  it('足す前に無かったものを返す', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    const c = { id: 'c' }
    expect(newestNode([a, b], [a, c, b])).toBe(c)
  })

  it('増えていなければ null（足せなかった）', () => {
    const a = { id: 'a' }
    expect(newestNode([a], [a])).toBeNull()
  })
})

describe('「Widgetとして登録」の名前の初期値', () => {
  it('見本から作ったときは、見本の名前をそのまま使う（英字のクラス名は出さない）', () => {
    expect(defaultRegisterName('結果内容とフッター', 'ご購入はこちら')).toBe('結果内容とフッター')
  })

  it('見本の名前が分からなければ、中の文字の頭から作る（空白はまとめる・長すぎたら切る）', () => {
    expect(defaultRegisterName(undefined, '  よくある  質問\n Q. 送料は？ ')).toBe('よくある 質問 Q. 送料は？')
    expect(defaultRegisterName('', 'あいうえおかきくけこさしすせそたちつてとなにぬねの')).toBe('あいうえおかきくけこさしすせそたちつてと')
  })

  it('文字も無ければ「Widget」', () => {
    expect(defaultRegisterName(undefined, '   ')).toBe('Widget')
  })
})

describe('見本の名前の控え', () => {
  it('足したWidgetごとに覚える（要素の属性には書かない＝LPのHTMLに保存されない）', () => {
    const a = {}
    const b = {}
    rememberSampleTitle(a, '結果内容とフッター')
    expect(sampleTitleOf(a)).toBe('結果内容とフッター')
    expect(sampleTitleOf(b)).toBeUndefined()
  })
})
