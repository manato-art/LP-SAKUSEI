/**
 * ポップアップの画面の文言が、今ある編集画面と食い違わないことの機械証明（2026-09-24 監査 39）。
 *
 * 中身は「中身を編集」（Widget編集と同じ画面）で直す。編集画面のタブは 基本・表示・位置・出し分け・コード。
 * 「デザイン」タブ・「HTML」タブは無くしたので、そこから直すように案内する文言を残さない。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PRESETS } from '../src/app/pages/exit-popup-presets.ts'
import { FOLLOW_PRESETS } from '../src/app/pages/follow-popup-presets.ts'

const src = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const GONE_TABS = /HTMLタブ|「HTML」タブ|「デザイン」タブ|デザインタブ|HTMLで設定|HTMLで指定/

describe('無くしたタブへ案内しない', () => {
  it('プリセットの名前・説明・中身・絵に「HTMLタブ」「デザインタブ」が無い', () => {
    for (const preset of [...PRESETS, ...FOLLOW_PRESETS]) {
      const text = [preset.name, preset.description, preset.defaultHtml, preset.thumbnailSvg].join('\n')
      expect(text, preset.id).not.toMatch(GONE_TABS)
    }
  })

  it('新規ポップアップの中身の案内は「中身を編集」を指す', () => {
    const page = src('src/app/pages/exit-popup.ts')
    expect(page).not.toMatch(GONE_TABS)
    expect(page).toContain('「中身を編集」')
  })
})
