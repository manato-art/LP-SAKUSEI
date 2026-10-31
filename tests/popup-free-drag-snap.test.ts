/**
 * つまんで動かすとき、Ctrl（Mac は ⌘）を押しながらだと真ん中の補助線を出し、真ん中にカチッと止める
 * （指示43・2026-10-31 本人「WindowsはCtrlキー、Macはcommandキーを押しながら位置を調整すると補助線を出して。
 * カチッと真ん中にハマるようにしてほしい。補助の説明も表示して」）。
 * 「LPの上で決める」と「中身を編集」の「LPの上に重ねて見る」の両方（同じ手＝popup-free-drag.ts）。
 */
import { describe, expect, it } from 'vitest'
import { SNAP_PX, snapToCenter } from '../src/app/panels/popup-free-drag.ts'

const stage = { x: 0, w: 400, h: 800 }
const box = { w: 100, h: 50 }

describe('真ん中にカチッと止める', () => {
  it('真ん中の近く（左右・上下それぞれ）に来たら、ぴったり真ん中にする', () => {
    // 箱の真ん中 = 150+50 = 200（画面の真ん中 200）から少しずれた所
    const near = snapToCenter(stage, box, { left: 150 + SNAP_PX - 1, top: 375 - SNAP_PX + 1 })
    expect(near).toEqual({ left: 150, top: 375, snappedX: true, snappedY: true })
  })

  it('遠いときは動かした所のまま', () => {
    expect(snapToCenter(stage, box, { left: 20, top: 30 })).toEqual({ left: 20, top: 30, snappedX: false, snappedY: false })
  })

  it('左右だけ近ければ左右だけ止める', () => {
    expect(snapToCenter(stage, box, { left: 152, top: 30 })).toEqual({ left: 150, top: 30, snappedX: true, snappedY: false })
  })

  it('画面が LP の幅（スマホ 375px のまん中）にずれていても、その画面の真ん中に止める', () => {
    const phone = { x: 100, w: 375, h: 667 }
    expect(snapToCenter(phone, box, { left: 240, top: 300 }).left).toBe(100 + 375 / 2 - 50)
  })
})
