/**
 * 背景の画像を見たまま画面でつかんで動かす・角を引っぱって大きさを変えるときの計算（2026-10-24 本人の選択「画面でつかんで動かす」）。
 * 位置は背景の決まり（0＝左端・50＝真ん中・100＝右端）、大きさは枠の横幅に対する%。
 */
import { describe, expect, it } from 'vitest'
import { bgRect, movedLook, resizedLook, type Box } from '../src/app/panels/nocode/bg-move-math.ts'
import type { BgLook } from '../src/app/panels/nocode/templates/bg-image.ts'

const BOX: Box = { left: 100, top: 50, width: 400, height: 200 }
/** 横長の画像（2:1） */
const NATURAL = { width: 800, height: 400 }
const look = (over: Partial<BgLook>): BgLook => ({ image: 'x', fit: 'free', size: 50, x: 50, y: 50, ...over })

describe('画像のいる場所', () => {
  it('大きさを自分で決める: 横幅の50%・真ん中', () => {
    expect(bgRect(BOX, NATURAL, look({}))).toEqual({ left: 200, top: 100, width: 200, height: 100 })
  })

  it('左上（0%・0%）と右下（100%・100%）', () => {
    expect(bgRect(BOX, NATURAL, look({ x: 0, y: 0 }))).toMatchObject({ left: 100, top: 50 })
    expect(bgRect(BOX, NATURAL, look({ x: 100, y: 100 }))).toMatchObject({ left: 300, top: 150 })
  })

  it('枠いっぱいに覆う: 縦横どちらも枠を覆う大きさ（はみ出す方は真ん中）', () => {
    const square = { width: 100, height: 100 }
    expect(bgRect(BOX, square, look({ fit: 'cover' }))).toEqual({ left: 100, top: -50, width: 400, height: 400 })
  })
})

describe('つかんで動かす', () => {
  it('右へ50・下へ25動かすと、その分だけ位置が変わる（％は枠と画像の差に対して）', () => {
    // 枠と画像の差: 横 200・縦 100 → 50 動かすと 25%・25 動かすと 25%
    expect(movedLook(look({}), BOX, NATURAL, 50, 25)).toMatchObject({ x: 75, y: 75 })
  })

  it('はみ出すところまで動かせる（範囲は -100〜200）', () => {
    expect(movedLook(look({}), BOX, NATURAL, 2000, -2000)).toMatchObject({ x: 200, y: -100 })
  })

  it('枠と同じ幅の画像は左右には動かない（上下だけ動く）', () => {
    expect(movedLook(look({ size: 100 }), BOX, NATURAL, 80, 0)).toMatchObject({ x: 50 })
  })
})

describe('角を引っぱって大きさを変える', () => {
  it('右下の角を右へ100引っぱると、左上の角はそのままで大きくなる（自由な大きさに切り替わる）', () => {
    const next = resizedLook(look({}), BOX, NATURAL, 'se', 100, 0)
    expect(next.fit).toBe('free')
    expect(next.size).toBe(75)
    const rect = bgRect(BOX, NATURAL, next)
    expect(rect.left).toBeCloseTo(200, 0)
    expect(rect.top).toBeCloseTo(100, 0)
  })

  it('左上の角を左へ引っぱると、右下の角はそのまま', () => {
    const before = bgRect(BOX, NATURAL, look({}))
    const next = resizedLook(look({}), BOX, NATURAL, 'nw', -100, -50)
    const rect = bgRect(BOX, NATURAL, next)
    expect(rect.left + rect.width).toBeCloseTo(before.left + before.width, 0)
    expect(rect.top + rect.height).toBeCloseTo(before.top + before.height, 0)
  })

  it('小さくしすぎない・大きくしすぎない（横幅の10〜400%）', () => {
    expect(resizedLook(look({}), BOX, NATURAL, 'se', -1000, 0).size).toBe(10)
    expect(resizedLook(look({}), BOX, NATURAL, 'se', 5000, 0).size).toBe(400)
  })
})
