import { describe, it, expect } from 'vitest'
import { localPathForAsset } from '../tools/capture-assets/paths.ts'

describe('アセットの保存先はURLの形をそのまま写す', () => {
  it('/assets/x.svg は assets/x.svg に置く（CSSがそのURLで参照するため）', () => {
    expect(localPathForAsset('/assets/arrow_down_black-f0adf289.svg')).toBe(
      'assets/arrow_down_black-f0adf289.svg',
    )
  })

  it('入れ子のパスも保つ', () => {
    expect(localPathForAsset('/assets/fonts/s/materialicons/v145/font-12345678.woff2')).toBe(
      'assets/fonts/s/materialicons/v145/font-12345678.woff2',
    )
  })

  it('クエリ文字列は保存先に含めない', () => {
    expect(localPathForAsset('/assets/beyond-228439b9.woff?j0xfcq')).toBe(
      'assets/beyond-228439b9.woff',
    )
  })

  it('上位ディレクトリへ抜ける経路は拒む', () => {
    expect(() => localPathForAsset('/assets/../../etc/passwd')).toThrow(/不正/)
  })

  it('先頭スラッシュ以外のURLは拒む（相対パスは意味が変わるため）', () => {
    expect(() => localPathForAsset('assets/x.svg')).toThrow(/不正/)
  })
})
