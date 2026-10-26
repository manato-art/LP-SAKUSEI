/**
 * Widget一覧の「SquadBeyond」（2026-10-26 本人「SquadBeyondのものを戻して」・本人の選択「自作とは別の分類」）。
 * 画面に出すまでの決まり（DOM を使わない部分）。
 *
 * - LPに入れる中身は SB と同じ「CSS＋HTML」（CSSは <style> にして頭に付ける・空なら付けない）
 * - 1つの分類に最大280件あるので、24件ずつ出す（「もっと見る」で続き）
 * - 検索はその分類の全件から（まだ出していないカードも探せる）
 */
import { describe, expect, it } from 'vitest'
import { SB_PAGE_SIZE, matchingSbParts, sbPartHtml, visibleSbParts } from '../src/app/panels/widget-library-sb.ts'

const part = (id: number, name: string, html = `<div>${name}</div>`, css = ''): { id: number; name: string; html: string; css: string } => ({ id, name, html, css })

describe('LPに入れる中身', () => {
  it('CSS は <style> にして HTML の頭に付ける（SB のWidgetと同じ中身）', () => {
    expect(sbPartHtml(part(1, 'a', '<p class="x">あ</p>', '.x{color:red}'))).toBe('<style>.x{color:red}</style><p class="x">あ</p>')
  })

  it('CSS が空なら <style> を付けない', () => {
    expect(sbPartHtml(part(1, 'a', '<p>あ</p>', '  '))).toBe('<p>あ</p>')
  })
})

describe('出す件数', () => {
  const parts = Array.from({ length: 60 }, (_, i) => part(i, `見出し${i}`))

  it('はじめは24件・「もっと見る」ごとに24件ずつ増える（まだ出していないときは0件）', () => {
    expect(SB_PAGE_SIZE).toBe(24)
    expect(visibleSbParts(parts, 0)).toHaveLength(0)
    expect(visibleSbParts(parts, 1)).toHaveLength(24)
    expect(visibleSbParts(parts, 2)).toHaveLength(48)
    expect(visibleSbParts(parts, 3)).toHaveLength(60)
  })

  it('検索はその分類の全件から（大文字小文字を区別しない・空なら全部）', () => {
    const list = [part(1, 'アンケート（単一）'), part(2, 'FAQ アコーディオン'), part(3, 'faq タブ')]
    expect(matchingSbParts(list, '').map((p) => p.id)).toEqual([1, 2, 3])
    expect(matchingSbParts(list, 'faq').map((p) => p.id)).toEqual([2, 3])
    expect(matchingSbParts(list, ' アンケート ').map((p) => p.id)).toEqual([1])
  })
})
