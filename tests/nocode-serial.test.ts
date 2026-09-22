/**
 * 番号付きの部品を増やす・消す・並べ替えたあとの番号の付け直し（2026-09-22・ノーコードでWidgetを作る②）。
 *
 * ステップフローや番号付きリストは「01」「02」…の番号が文字で書いてある。
 * 2番を複製すると「02」が2つになり、コードを書けない人が1つずつ直すことになる。
 * もともと 1,2,3… と1つずつ増えていたときだけ、上から付け直す（値段や評価の数字は触らない）。
 */
import { describe, expect, it } from 'vitest'
import { isSerialRun, parseSerial, renumberSerials } from '../src/app/panels/nocode/serial-numbers.ts'

describe('番号の読み取り', () => {
  it('「01」「STEP 2」「3.」「第4位」のような短い番号を読む', () => {
    expect(parseSerial('01')).toEqual({ prefix: '', value: 1, width: 2, suffix: '' })
    expect(parseSerial('STEP 2')).toEqual({ prefix: 'STEP ', value: 2, width: 1, suffix: '' })
    expect(parseSerial('3.')).toEqual({ prefix: '', value: 3, width: 1, suffix: '.' })
    expect(parseSerial('第4位')).toEqual({ prefix: '第', value: 4, width: 1, suffix: '位' })
  })

  it('数字が2か所ある・長い文・値段は番号とみなさない', () => {
    expect(parseSerial('3,980円')).toBeNull()
    expect(parseSerial('ここに1つ目のテキストが入ります')).toBeNull()
    expect(parseSerial('見出し')).toBeNull()
  })
})

describe('もともと番号の並びだったか', () => {
  it('1から1つずつ増えている（0埋めも同じ）', () => {
    expect(isSerialRun(['01', '02', '03'])).toBe(true)
    expect(isSerialRun(['STEP 1', 'STEP 2'])).toBe(true)
  })

  it('1から始まらない・飛んでいる・1つだけ は並びではない（値段や評価は触らない）', () => {
    expect(isSerialRun(['980', '1280', '1980'])).toBe(false)
    expect(isSerialRun(['1', '3', '4'])).toBe(false)
    expect(isSerialRun(['3', '4', '5'])).toBe(false)
    expect(isSerialRun(['1'])).toBe(false)
    expect(isSerialRun(['01', '見出し'])).toBe(false)
  })
})

describe('付け直し', () => {
  it('複製して「02」が2つになったら、上から 01,02,03,04 に', () => {
    expect(renumberSerials(['01', '02', '02', '03'])).toEqual(['01', '02', '03', '04'])
  })

  it('並べ替えたら上から付け直す（前後の文字と0埋めの桁はそのまま）', () => {
    expect(renumberSerials(['STEP 2', 'STEP 1', 'STEP 3'])).toEqual(['STEP 1', 'STEP 2', 'STEP 3'])
    expect(renumberSerials(['09', '10', '11'].reverse())).toEqual(['01', '02', '03'])
  })

  it('10個を超えても桁は広がる（「010」にはしない）', () => {
    const texts = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, '0'))
    texts.splice(3, 0, '04')
    expect(renumberSerials(texts).slice(-2)).toEqual(['10', '11'])
  })
})
