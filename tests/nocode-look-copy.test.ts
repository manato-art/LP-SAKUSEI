/**
 * 見た目のコピーと貼り付け（2026-10-25 本人「ボタンの色とかボタンの大きさとか、その中に入っている文字の色とか必要だったら
 * 画像まで選択をして、全部一括か選択して一括かを貼り付けしたい」）。
 *
 * 本人の選択: 範囲＝このWidgetの中（全部の画面）／貼る先＝一覧にチェック（全部も）／写すもの＝貼るときに毎回選ぶ／
 * 部品＝同じ種類の部品なら何でも。文字そのもの・押したとき（移る先・リンク）は写さない。
 */
import { describe, expect, it } from 'vitest'
import { copyLook, lookGroupsOf, pasteLook, sameTypeTargets } from '../src/app/panels/nocode/look-copy.ts'
import { ALL_BLOCK_TYPES } from '../src/app/panels/nocode/templates/builder.ts'
import { items, type ItemData, type TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const BUTTON = ALL_BLOCK_TYPES.find((t) => t.type === 'button')
const IMG = `data:image/png;base64,${'A'.repeat(40)}`

const source: ItemData = {
  type: 'button',
  label: '申し込む',
  look: 'cta',
  color: '#1F7AE0',
  borderColor: '#1F2A37',
  boxWidth: 80,
  place: 'left',
  height: 90,
  textColor: '#FFFFFF',
  strokeWidth: 1,
  strokeColor: '#1F2A37',
  bgImage: IMG,
  action: 'screen',
  target: 's2',
}
const target: ItemData = {
  type: 'button',
  label: 'いいえ',
  look: 'choice',
  color: '#E5573F',
  shadowColor: '#000000',
  textColor: '#E5573F',
  action: 'screen',
  target: 's3',
}
const data: TemplateData = {
  screens: [
    { id: 's1', name: 'Q1', blocks: [source, { type: 'heading', text: '見出し' }, target] },
    { id: 's2', name: 'Q2', blocks: [{ ...target, label: 'はい' }] },
  ],
}
const blockAt = (d: TemplateData, s: number, b: number): ItemData => items(items(d, 'screens')[s] ?? {}, 'blocks')[b] ?? {}

describe('写すもののまとまり', () => {
  it('ボタン: 色（地・枠・影）・大きさ（幅・置く位置・高さ）・文字の見た目・形・背景の画像', () => {
    const groups = lookGroupsOf(BUTTON?.fields ?? [])
    expect(groups.map((g) => g.label)).toEqual(['色', '大きさ・置く位置', '文字の見た目', '形・見た目', '背景の画像'])
    expect(groups.find((g) => g.id === 'color')?.keys).toEqual(['color', 'borderColor', 'shadowColor'])
    expect(groups.find((g) => g.id === 'size')?.keys).toEqual(['boxWidth', 'place', 'height'])
    expect(groups.find((g) => g.id === 'text')?.keys).toEqual(['textColor', 'strokeColor', 'strokeWidth'])
    expect(groups.find((g) => g.id === 'shape')?.keys).toEqual(['look'])
    // 文字そのもの・押したときは写さない
    const all = groups.flatMap((g) => g.keys)
    for (const key of ['label', 'action', 'target', 'url', 'track']) expect(all, key).not.toContain(key)
  })
})

describe('貼り付け', () => {
  it('選んだまとまりだけ写す（文字・押したとき・選ばなかったまとまりはそのまま）', () => {
    const look = copyLook(BUTTON?.fields ?? [], source)
    const next = pasteLook(data, look, [['screens', 0, 'blocks', 2]], new Set(['color', 'size']))
    expect(blockAt(next, 0, 2)).toEqual({
      ...target,
      color: '#1F7AE0',
      borderColor: '#1F2A37',
      // 写し元で決めていない（自動）ものは、貼った先も自動に戻す
      shadowColor: undefined,
      boxWidth: 80,
      place: 'left',
      height: 90,
    })
    expect(Object.keys(blockAt(next, 0, 2))).not.toContain('shadowColor')
    expect(blockAt(next, 0, 2)['label']).toBe('いいえ')
    expect(blockAt(next, 0, 2)['target']).toBe('s3')
    expect(blockAt(next, 0, 2)['textColor']).toBe('#E5573F')
  })

  it('全部の画面のいくつにも一度に貼れる（画像も選べば写す）', () => {
    const look = copyLook(BUTTON?.fields ?? [], source)
    const next = pasteLook(
      data,
      look,
      [
        ['screens', 0, 'blocks', 2],
        ['screens', 1, 'blocks', 0],
      ],
      new Set(['text', 'background']),
    )
    for (const [s, b] of [
      [0, 2],
      [1, 0],
    ] as const) {
      expect(blockAt(next, s, b)['textColor']).toBe('#FFFFFF')
      expect(blockAt(next, s, b)['strokeWidth']).toBe(1)
      expect(blockAt(next, s, b)['bgImage']).toBe(IMG)
    }
    // 元の中身は書き換えない
    expect(blockAt(data, 0, 2)['textColor']).toBe('#E5573F')
  })
})

describe('貼る先の一覧', () => {
  it('このWidgetの中の同じ種類の部品（全部の画面・写し元は除く）。画面の名前と部品の文字で見分ける', () => {
    expect(sameTypeTargets(data, 'button', ['screens', 0, 'blocks', 0])).toEqual([
      { path: ['screens', 0, 'blocks', 2], label: 'Q1：いいえ' },
      { path: ['screens', 1, 'blocks', 0], label: 'Q2：はい' },
    ])
  })
})
