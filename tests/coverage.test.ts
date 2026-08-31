import { describe, it, expect } from 'vitest'
import {
  extractInteractive,
  extractWiredSelectors,
  buildCoverage,
} from '../tools/coverage/extract.ts'

describe('採取した実DOMから操作可能な要素を抜き出す', () => {
  it('data-test 属性を重複なく拾う', () => {
    const html = '<button data-test="A-BtnOne">x</button><div data-test="A-BtnOne"></div>'
    expect(extractInteractive(html).testIds).toEqual(['A-BtnOne'])
  })

  it('button / a / role=tab をそれぞれ数える', () => {
    const html = '<button>1</button><button>2</button><a href="#/x">l</a><div role="tab"></div>'
    const found = extractInteractive(html)
    expect(found.buttonCount).toBe(2)
    expect(found.anchorCount).toBe(1)
    expect(found.tabCount).toBe(1)
  })

  it('シングルクォートの属性も拾う', () => {
    expect(extractInteractive("<button data-test='B-Btn'>x</button>").testIds).toEqual(['B-Btn'])
  })

  it('ハッシュ遷移先を拾う', () => {
    const html = '<a href="#/folders">f</a><a href="#/ab_tests/UID/articles">e</a><a href="https://x">o</a>'
    expect(extractInteractive(html).hashTargets).toEqual(['#/folders', '#/ab_tests/UID/articles'])
  })
})

describe('クローン側のコードが参照している data-test を抜き出す', () => {
  it('セレクタ文字列の中の data-test を拾う', () => {
    const source = `root.querySelector('[data-test="EditorToolbar-BtnBold"]')`
    expect(extractWiredSelectors(source)).toEqual(['EditorToolbar-BtnBold'])
  })

  it('テンプレートリテラルでも拾う', () => {
    const source = 'q(`[data-test="Article-BtnCreateNewArticle"]`)'
    expect(extractWiredSelectors(source)).toEqual(['Article-BtnCreateNewArticle'])
  })

  it('同じものを2回参照しても1つに畳む', () => {
    const source = `a('[data-test="X-Btn"]'); b('[data-test="X-Btn"]')`
    expect(extractWiredSelectors(source)).toEqual(['X-Btn'])
  })
})

describe('被覆率の集計', () => {
  it('実物にあってクローンが配線していないものを未配線として並べる', () => {
    const coverage = buildCoverage(
      { 'editor': ['A-Btn', 'B-Btn', 'C-Btn'] },
      ['A-Btn'],
    )
    expect(coverage.total).toBe(3)
    expect(coverage.wired).toBe(1)
    expect(coverage.unwired).toEqual([{ state: 'editor', testId: 'B-Btn' }, { state: 'editor', testId: 'C-Btn' }])
  })

  it('実物に無い要素をクローンが参照していたら「実物に無い」として報告する', () => {
    const coverage = buildCoverage({ 'editor': ['A-Btn'] }, ['A-Btn', 'Ghost-Btn'])
    expect(coverage.notInCapture).toEqual(['Ghost-Btn'])
  })

  it('採取物が空なら被覆率は0ではなく「判定不能」にする', () => {
    expect(buildCoverage({}, ['A-Btn']).total).toBe(0)
    expect(buildCoverage({}, ['A-Btn']).ratio).toBeNull()
  })
})
