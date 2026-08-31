/**
 * テキスト選択ツールバー / Widget管理 の純粋ロジック。
 *
 * `vitest.config.ts` の environment は node のまま（DOM無し）。
 * そのため対象モジュールは Quill を `import type` でしか読まない設計にしてあり、
 * ここでは DOM を触らない関数だけを検証する。
 */
import { describe, expect, test } from 'vitest'
import {
  FREE_FONT_SIZE_UNITS,
  TOOLBAR_FONT_FAMILIES,
  TOOLBAR_FONT_SIZES,
  TOOLBAR_SWATCHES,
  computeToolbarPosition,
  cssFontFamilyValue,
  fontFamilyLabel,
  fontSizeLabel,
  headerLabel,
  hexToHsv,
  hexToRgbCss,
  hsvToHex,
  normalizeHex,
  parseFreeFontSize,
  swatchMarkup,
} from '../src/app/panels/editor-toolbar.ts'
import { WIDGET_MENU_LABELS } from '../src/app/panels/widget-manager.ts'

describe('採取した選択肢をそのまま持っている', () => {
  test('文字サイズは 10px から 29px の10段', () => {
    expect(TOOLBAR_FONT_SIZES).toEqual([
      '10px',
      '13px',
      '15px',
      '17px',
      '19px',
      '21px',
      '23px',
      '25px',
      '27px',
      '29px',
    ])
  })

  test('自由設定の単位は px / % / em / rem の4つ', () => {
    expect(FREE_FONT_SIZE_UNITS).toEqual(['px', '%', 'em', 'rem'])
  })

  test('フォントは実物と同じ6件・順番も同じ', () => {
    expect(TOOLBAR_FONT_FAMILIES).toEqual([
      'serif',
      'sans-serif',
      'cursive',
      'fantasy',
      'monospace',
      'ヒラギノ角ゴ Pro W3',
    ])
  })

  test('色パレットは40色', () => {
    expect(TOOLBAR_SWATCHES).toHaveLength(40)
  })

  test('実物の不正な色 #fffff66 を直さずに持っている（§3-5 勝手に改善しない）', () => {
    expect(TOOLBAR_SWATCHES).toContain('#fffff66')
    expect(normalizeHex('#fffff66')).toBeNull()
  })

  test('Widget管理のメニューは実物と同じ5項目・順番も同じ', () => {
    expect(WIDGET_MENU_LABELS).toEqual([
      'HTML編集',
      'クイック編集',
      'すぐ下に複製',
      'widgetコピー',
      'Versionから削除する',
    ])
  })
})

describe('自由設定の入力チェック', () => {
  test('数値と単位が揃っていれば CSS の長さになる', () => {
    expect(parseFreeFontSize('24', 'px')).toEqual({ ok: true, value: '24px' })
    expect(parseFreeFontSize(' 1.5 ', 'em')).toEqual({ ok: true, value: '1.5em' })
    expect(parseFreeFontSize('120', '%')).toEqual({ ok: true, value: '120%' })
  })

  test('空・数値でない・0以下は通さない', () => {
    expect(parseFreeFontSize('', 'px').ok).toBe(false)
    expect(parseFreeFontSize('   ', 'px').ok).toBe(false)
    expect(parseFreeFontSize('おおきく', 'px').ok).toBe(false)
    expect(parseFreeFontSize('0', 'px').ok).toBe(false)
    expect(parseFreeFontSize('-3', 'px').ok).toBe(false)
  })

  test('採取した4単位以外は通さない', () => {
    expect(parseFreeFontSize('24', 'pt').ok).toBe(false)
    expect(parseFreeFontSize('24', '').ok).toBe(false)
  })

  test('失敗したときは理由が読める文字列で返る', () => {
    const result = parseFreeFontSize('24', 'pt')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0)
  })
})

describe('ツールバーの位置計算', () => {
  const toolbar = { width: 300, height: 45 }
  const host = { width: 1000, height: 600 }

  test('選択範囲の中央に揃い、既定では選択範囲の上に出る', () => {
    const placed = computeToolbarPosition({ left: 400, top: 200, width: 100, height: 20 }, toolbar, host)
    expect(placed.left).toBe(300) // 中心450 - 幅の半分150
    expect(placed.top).toBe(145) // 200 - 45 - gap10
    expect(placed.placement).toBe('above')
  })

  test('上に余白が無いときだけ下に回る', () => {
    const placed = computeToolbarPosition({ left: 400, top: 10, width: 100, height: 20 }, toolbar, host)
    expect(placed.placement).toBe('below')
    expect(placed.top).toBe(40) // 10 + 20 + gap10
  })

  test('上も下も入らないときは上に寄せて画面内に収める', () => {
    const placed = computeToolbarPosition({ left: 400, top: 10, width: 100, height: 20 }, toolbar, { width: 1000, height: 60 })
    expect(placed.placement).toBe('above')
    expect(placed.top).toBe(0)
  })

  test('左端・右端でははみ出さないように寄せる', () => {
    const left = computeToolbarPosition({ left: 0, top: 300, width: 10, height: 20 }, toolbar, host)
    expect(left.left).toBe(0)
    const right = computeToolbarPosition({ left: 990, top: 300, width: 10, height: 20 }, toolbar, host)
    expect(right.left).toBe(700) // host.width - toolbar.width
  })

  test('矢印は選択範囲の中央を指し、ツールバーの角には寄りすぎない', () => {
    const centered = computeToolbarPosition({ left: 400, top: 300, width: 100, height: 20 }, toolbar, host)
    expect(centered.arrowLeft).toBe(150)

    const atLeftEdge = computeToolbarPosition({ left: 0, top: 300, width: 10, height: 20 }, toolbar, host)
    expect(atLeftEdge.arrowLeft).toBe(12)

    const atRightEdge = computeToolbarPosition({ left: 995, top: 300, width: 5, height: 20 }, toolbar, host)
    expect(atRightEdge.arrowLeft).toBe(288) // 300 - 12
  })

  test('ツールバーがホストより広くても左は負にならない', () => {
    const placed = computeToolbarPosition({ left: 10, top: 300, width: 10, height: 20 }, { width: 1200, height: 45 }, host)
    expect(placed.left).toBe(0)
  })
})

describe('ドロップダウンのトリガー表示', () => {
  test('書式は未設定なら Normal', () => {
    expect(headerLabel(undefined)).toBe('Normal')
    expect(headerLabel(false)).toBe('Normal')
    expect(headerLabel(1)).toBe('見出し1')
    expect(headerLabel(2)).toBe('見出し2')
    expect(headerLabel('3')).toBe('見出し3')
  })

  test('文字サイズは未設定なら 17px（実物の既定表示）', () => {
    expect(fontSizeLabel(undefined)).toBe('17px')
    expect(fontSizeLabel('')).toBe('17px')
    expect(fontSizeLabel('29px')).toBe('29px')
  })

  test('フォントは未設定なら serif（実物の既定表示）', () => {
    expect(fontFamilyLabel(undefined)).toBe('serif')
    expect(fontFamilyLabel('monospace')).toBe('monospace')
  })
})

describe('CSS の値づくり', () => {
  test('空白を含むフォント名だけ引用符を付ける（実物の option と同じ形）', () => {
    expect(cssFontFamilyValue('serif')).toBe('serif')
    expect(cssFontFamilyValue('ヒラギノ角ゴ Pro W3')).toBe('"ヒラギノ角ゴ Pro W3"')
  })

  test('3桁・6桁・#なしの16進を6桁に揃える', () => {
    expect(normalizeHex('#abc')).toBe('#aabbcc')
    expect(normalizeHex('AABBCC')).toBe('#aabbcc')
    expect(normalizeHex('#66B966')).toBe('#66b966')
    expect(normalizeHex('  #000000 ')).toBe('#000000')
  })

  test('不正な16進は null', () => {
    expect(normalizeHex('')).toBeNull()
    expect(normalizeHex('#12345')).toBeNull()
    expect(normalizeHex('#gggggg')).toBeNull()
  })

  test('採取したスウォッチと同じ rgb() 表記になる', () => {
    expect(hexToRgbCss('#66B966')).toBe('rgb(102, 185, 102)')
    expect(hexToRgbCss('#000000')).toBe('rgb(0, 0, 0)')
    expect(hexToRgbCss('#fffff66')).toBeNull()
  })

  test('スウォッチのマークアップは title を持ち、不正な色には background を付けない', () => {
    expect(swatchMarkup('#66B966')).toContain('title="#66B966"')
    expect(swatchMarkup('#66B966')).toContain('background: rgb(102, 185, 102);')
    expect(swatchMarkup('#fffff66')).toContain('title="#fffff66"')
    expect(swatchMarkup('#fffff66')).not.toContain('background:')
  })
})

describe('カラーピッカーの色変換', () => {
  test('代表的な色が既知の値になる', () => {
    expect(hsvToHex(0, 0, 0)).toBe('#000000')
    expect(hsvToHex(0, 0, 1)).toBe('#ffffff')
    expect(hsvToHex(0, 1, 1)).toBe('#ff0000')
    expect(hsvToHex(120, 1, 1)).toBe('#00ff00')
    expect(hsvToHex(240, 1, 1)).toBe('#0000ff')
    expect(hsvToHex(60, 1, 1)).toBe('#ffff00')
    expect(hsvToHex(300, 1, 1)).toBe('#ff00ff')
    expect(hsvToHex(180, 1, 1)).toBe('#00ffff')
  })

  test('360度をまたいでも範囲外でも赤に戻る', () => {
    expect(hsvToHex(360, 1, 1)).toBe('#ff0000')
    expect(hsvToHex(-360, 1, 1)).toBe('#ff0000')
    expect(hsvToHex(0, 2, 2)).toBe('#ff0000')
  })

  test('パレットの全色が hex → HSV → hex で元に戻る', () => {
    for (const swatch of TOOLBAR_SWATCHES) {
      const normalized = normalizeHex(swatch)
      if (normalized === null) continue // #fffff66 は実物どおり不正なので対象外
      const hsv = hexToHsv(normalized)
      expect(hsv).not.toBeNull()
      if (hsv === null) continue
      expect(hsvToHex(hsv.h, hsv.s, hsv.v)).toBe(normalized)
    }
  })

  test('不正な16進からは HSV を作らない', () => {
    expect(hexToHsv('#fffff66')).toBeNull()
    expect(hexToHsv('nope')).toBeNull()
  })
})
