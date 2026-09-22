/**
 * 「型から作る」で選んだ画像の大きさ（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * スマホで撮った写真（数MB）をそのまま入れると、LPが重くなり表示が遅れる
 * （レポートの「読み込みに3秒以上かかった人の割合」が増える）。
 * LPの幅（620px）の2倍＝1240pxより大きい画像だけ縮める。小さい画像・動くGIF・SVGはそのまま。
 */
import { describe, expect, it } from 'vitest'
import { planLpImage } from '../src/app/panels/nocode/lp-image-plan.ts'

describe('画像を縮めるかどうか', () => {
  it('幅1240pxより大きい写真は、縦横の比を保って1240pxに縮める', () => {
    expect(planLpImage({ type: 'image/jpeg', bytes: 4_000_000, width: 4032, height: 3024 })).toEqual({
      action: 'resize',
      width: 1240,
      height: 930,
    })
  })

  it('幅は小さくても重すぎる画像（1MB超）は、同じ大きさで軽く書き直す', () => {
    expect(planLpImage({ type: 'image/png', bytes: 1_500_000, width: 1000, height: 800 })).toEqual({
      action: 'resize',
      width: 1000,
      height: 800,
    })
  })

  it('小さく軽い画像・動くGIF・SVGはそのまま', () => {
    expect(planLpImage({ type: 'image/png', bytes: 200_000, width: 800, height: 600 })).toEqual({ action: 'keep' })
    expect(planLpImage({ type: 'image/gif', bytes: 3_000_000, width: 2000, height: 2000 })).toEqual({ action: 'keep' })
    expect(planLpImage({ type: 'image/svg+xml', bytes: 5_000, width: 3000, height: 3000 })).toEqual({ action: 'keep' })
  })
})
