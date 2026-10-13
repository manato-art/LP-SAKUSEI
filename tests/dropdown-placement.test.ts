/**
 * 採取したドロップダウンの面が、右にはみ出して切れないこと（2026-10-13）。
 *
 * 【起きていたこと】ヒートマップの「ソート」を押すと、一覧の丸い印だけが見えて文字が読めなかった。
 * 右上の「広告データ取得日時」の面も、右178pxが画面の外で切れていた。
 * 【原因】採取CSSは面をトリガーの左端から右へ開く。どちらのトリガーも画面の右端にある。
 * 【なぜ気づかなかったか】文字があるか（innerText）で確かめていた。切れていても文字は「ある」。
 */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { installDom } from './helpers/dom.ts'
import { keepDropdownVisible } from '../src/app/pages/dropdown-placement.ts'

let body: HTMLElement

beforeEach(() => {
  const document = installDom()
  body = document.createElement('div')
  document.body.append(body)
})

const styleOf = (): string => body.getAttribute('style') ?? ''

describe('開いた面を見える範囲に収める', () => {
  it('右にはみ出すときは、右端をそろえて左へ開く', () => {
    keepDropdownVisible(body, () => ({ bodyRight: 1424, visibleRight: 1239 }))

    expect(styleOf()).toMatch(/right:\s*0/)
    expect(styleOf()).toMatch(/left:\s*auto/)
  })

  it('収まっているときは、採取CSSの置き方のまま（何も足さない）', () => {
    keepDropdownVisible(body, () => ({ bodyRight: 361, visibleRight: 1280 }))

    expect(styleOf()).not.toMatch(/right:\s*0/)
    expect(styleOf()).not.toMatch(/left:\s*auto/)
  })

  it('前に左へ開いたあとで収まるようになったら、もとの置き方に戻す', () => {
    keepDropdownVisible(body, () => ({ bodyRight: 1424, visibleRight: 1239 }))
    keepDropdownVisible(body, () => ({ bodyRight: 900, visibleRight: 1900 }))

    expect(styleOf()).not.toMatch(/right:\s*0/)
    expect(styleOf()).not.toMatch(/left:\s*auto/)
  })

  it('測るのは、もとの置き方に戻してから（左へ開いたまま測ると、いつも「収まっている」になる）', () => {
    keepDropdownVisible(body, () => ({ bodyRight: 1424, visibleRight: 1239 }))
    let styleWhenMeasured = 'まだ測っていない'
    keepDropdownVisible(body, () => {
      styleWhenMeasured = styleOf()
      return { bodyRight: 1424, visibleRight: 1239 }
    })

    expect(styleWhenMeasured).not.toMatch(/right:\s*0/)
    expect(styleOf()).toMatch(/right:\s*0/)
  })
})

describe('レポート／ヒートマップのドロップダウンは、開いたときに収める', () => {
  it('開く処理が keepDropdownVisible を呼ぶ', () => {
    const src = readFileSync('src/app/pages/report-dom.ts', 'utf8')
    expect(src).toContain('if (willOpen) keepDropdownVisible(body)')
  })
})
