/**
 * 編集画面で @media を「LPの幅（620px）」で判定することの機械証明（本人指定）。
 *
 * PCで編集画面を開くと @media はウィンドウ幅で判定され、スマホ用の値を変えても見た目が動かなかった。
 * 公開LPの配信幅は620pxなので、幅の条件は620pxとして決める。
 * 幅以外の条件（動きを減らす設定など）は判定せずブラウザに任せる。
 */
import { describe, expect, it } from 'vitest'
import { LP_WIDTH, mediaAtLpWidth } from '../src/app/panels/lp-width-media.ts'

describe('@media を LPの幅（620px）で判定する', () => {
  it('配信幅は620px（配信の DELIVERY_WIDTH と同じ）', () => {
    expect(LP_WIDTH).toBe(620)
  })

  it.each([
    ['(min-width: 768px)', { applies: false, rest: '' }],
    ['(max-width: 767px)', { applies: true, rest: '' }],
    ['screen and (max-width: 767px)', { applies: true, rest: '' }],
    ['only screen and (min-width: 48em)', { applies: false, rest: '' }],
    ['(min-width:600px) and (max-width:700px)', { applies: true, rest: '' }],
    ['(width >= 600px)', { applies: true, rest: '' }],
    ['(width < 600px)', { applies: false, rest: '' }],
    ['(600px < width <= 700px)', { applies: true, rest: '' }],
    ['(700px <= width)', { applies: false, rest: '' }],
    ['print', { applies: false, rest: '' }],
    ['(min-width: 768px), print', { applies: false, rest: '' }],
    ['(min-width: 1000px), (max-width: 700px)', { applies: true, rest: '' }],
  ])('%s', (media, expected) => {
    expect(mediaAtLpWidth(media)).toEqual(expected)
  })

  it('幅以外の条件は残してブラウザに任せる', () => {
    expect(mediaAtLpWidth('(prefers-reduced-motion: reduce)')).toEqual({
      applies: true,
      rest: '(prefers-reduced-motion: reduce)',
    })
    expect(mediaAtLpWidth('screen and (max-width: 767px) and (prefers-reduced-motion: reduce)')).toEqual({
      applies: true,
      rest: '(prefers-reduced-motion: reduce)',
    })
    expect(mediaAtLpWidth('(min-width: 768px) and (hover: hover)')).toEqual({ applies: false, rest: '' })
    expect(mediaAtLpWidth('(min-height: 500px)')).toEqual({ applies: true, rest: '(min-height: 500px)' })
  })

  it('not 付きは言い換えずにブラウザに任せる', () => {
    expect(mediaAtLpWidth('not screen and (min-width: 768px)')).toEqual({
      applies: true,
      rest: 'not screen and (min-width: 768px)',
    })
  })
})
