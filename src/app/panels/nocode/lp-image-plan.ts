/**
 * 「型から作る」で選んだ画像を縮めるかどうか（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * LPの幅（620px）の2倍＝1240pxより大きい画像は縮める。幅は小さくても1MBを超える画像は同じ大きさで軽く書き直す。
 * 動くGIF（書き直すと止まる）とSVG（元から軽い）はそのまま。テストは tests/nocode-lp-image.test.ts。
 */

/** LPの幅（配信の body の最大幅）の2倍。高精細な画面でもぼやけない大きさ */
export const LP_IMAGE_MAX_WIDTH = 1240
/** これより重ければ書き直す */
const HEAVY_BYTES = 1_000_000

export type LpImagePlan = { action: 'keep' } | { action: 'resize'; width: number; height: number }

export function planLpImage(image: { type: string; bytes: number; width: number; height: number }): LpImagePlan {
  if (image.type === 'image/gif' || image.type === 'image/svg+xml') return { action: 'keep' }
  if (image.width > LP_IMAGE_MAX_WIDTH) {
    return {
      action: 'resize',
      width: LP_IMAGE_MAX_WIDTH,
      height: Math.round((image.height * LP_IMAGE_MAX_WIDTH) / image.width),
    }
  }
  if (image.bytes > HEAVY_BYTES) return { action: 'resize', width: image.width, height: image.height }
  return { action: 'keep' }
}
