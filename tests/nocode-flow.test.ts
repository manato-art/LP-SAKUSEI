/**
 * 「部品を積んで作る」で見本を選ぶ流れ（2026-09-22・本人の依頼）。
 *
 * 本人の依頼「見本から作るはいらない（Widgetの最初の画面と同じ）」「見本から作った時にも、部品を積んで作るみたいな
 * 視覚的にわかりやすい要素を」（決定: 見本を部品として積む）。
 * 「部品を積んで作る」で「見本」の部品を足すと、いつもの見本の一覧に戻る。そこで「追加」を押すと、
 * LPには入れずに、その見本を部品として受け取る（1回だけ。普段の「追加」の動きは変えない）。
 */
import { describe, expect, it } from 'vitest'
import { armSamplePick, cancelSamplePick, defaultRegisterName, takeSamplePick } from '../src/app/panels/nocode/nocode-flow.ts'

describe('見本を部品として受け取る', () => {
  it('選びに行ったときだけ、次の「追加」を1回だけ部品に回す', () => {
    expect(takeSamplePick(), '普段の「追加」はLPに入れる').toBeNull()
    const got: string[] = []
    armSamplePick((sample) => got.push(sample.title))
    const pick = takeSamplePick()
    expect(pick).not.toBeNull()
    pick?.({ title: '矢印', html: '<div>↓</div>' })
    expect(got).toEqual(['矢印'])
    expect(takeSamplePick(), '次の「追加」はまたLPに入れる').toBeNull()
  })

  it('やめたら受け取らない', () => {
    armSamplePick(() => undefined)
    cancelSamplePick()
    expect(takeSamplePick()).toBeNull()
  })
})

describe('「Widgetとして登録」の名前の初期値', () => {
  it('型の名前などが分かれば、それを使う（英字のクラス名は出さない）', () => {
    expect(defaultRegisterName('よくある質問', 'ご購入はこちら')).toBe('よくある質問')
  })

  it('分からなければ、中の文字の頭から作る（空白はまとめる・長すぎたら切る）', () => {
    expect(defaultRegisterName(undefined, '  よくある  質問\n Q. 送料は？ ')).toBe('よくある 質問 Q. 送料は？')
    expect(defaultRegisterName('', 'あいうえおかきくけこさしすせそたちつてとなにぬねの')).toBe('あいうえおかきくけこさしすせそたちつてと')
  })

  it('文字も無ければ「Widget」', () => {
    expect(defaultRegisterName(undefined, '   ')).toBe('Widget')
  })
})
