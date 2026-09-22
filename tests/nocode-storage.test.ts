/**
 * ノーコードで作ったWidgetの保存（2026-09-22・本人の依頼）。
 *
 * 保存先は今までどおりこのブラウザ（localStorage）。今までの「作成したWidget」と同じ一覧に入る。
 * 変えたのは2つだけ（今までの呼び出し方はそのまま動く）:
 *  - **保存できたかを返す**。画像入りで大きいと容量を超えて保存できないことがあり、
 *    今までは黙って捨てていた（作ったつもりで一覧に無い）
 *  - 型・部品から作ったものは、あとでノーコードのまま直せるよう「元の入力（source）」も持つ
 */
import { beforeEach, describe, expect, it } from 'vitest'

/** node には localStorage が無いので、最小の偽物を置く */
class FakeStorage {
  private data = new Map<string, string>()
  failNextSet = false
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    if (this.failNextSet) {
      this.failNextSet = false
      throw new DOMException('quota', 'QuotaExceededError')
    }
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
}

const storage = new FakeStorage()
;(globalThis as unknown as { localStorage: FakeStorage }).localStorage = storage

const { loadCreatedWidgets, saveCreatedWidget } = await import('../src/app/panels/widget-library-storage.ts')

beforeEach(() => {
  storage.removeItem('lp-sakusei:created-widgets')
  storage.failNextSet = false
})

describe('作ったWidgetを保存する', () => {
  it('保存できたら true を返し、一覧の先頭に入る', () => {
    expect(saveCreatedWidget('申込ボタン', '<a>申し込む</a>')).toBe(true)
    expect(loadCreatedWidgets()[0]).toMatchObject({ name: '申込ボタン', html: '<a>申し込む</a>' })
  })

  it('容量オーバーなどで保存できなければ false を返す（黙って捨てない）', () => {
    saveCreatedWidget('前からあるWidget', '<p>前</p>')
    storage.failNextSet = true
    expect(saveCreatedWidget('大きいWidget', '<img src="data:...">')).toBe(false)
    expect(loadCreatedWidgets().map((w) => w.name), '前からあるものは消えない').toEqual(['前からあるWidget'])
  })

  it('型・部品から作ったものは元の入力も持つ（あとでノーコードのまま直すため）', () => {
    const source = { kind: 'template', template: 'cta-button', values: { text: '申し込む' } }
    saveCreatedWidget('申込ボタン', '<a>申し込む</a>', source)
    expect(loadCreatedWidgets()[0]?.source).toEqual(source)
  })

  it('今までの呼び出し方（名前とHTMLだけ）もそのまま使える', () => {
    saveCreatedWidget('コードで作ったWidget', '<div>x</div>')
    expect(loadCreatedWidgets()[0]?.source).toBeUndefined()
  })
})
