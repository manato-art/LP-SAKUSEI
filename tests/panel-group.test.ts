import { describe, it, expect } from 'vitest'
import { nextOpenPanel, PANEL_OPEN_CLASS } from '../src/app/panels/panel-group.ts'

describe('サイドパネルは同時に1枚だけ開く', () => {
  it('実物の開閉クラスをそのまま使う（採取CSSの ._open_x4j8w_84 が display:block）', () => {
    expect(PANEL_OPEN_CLASS).toBe('_open_x4j8w_84')
  })

  it('何も開いていないときに押すと、そのパネルが開く', () => {
    expect(nextOpenPanel(null, 'history')).toBe('history')
  })

  it('別のパネルを押すと、そちらに切り替わる（前のは閉じる）', () => {
    expect(nextOpenPanel('history', 'linkReplace')).toBe('linkReplace')
  })

  it('開いているパネルをもう一度押すと閉じる', () => {
    expect(nextOpenPanel('history', 'history')).toBeNull()
  })
})
