/**
 * 外部連携 > CV計測連携 の「連携を申請する / 連携要望を出す」。
 *
 * 以前は押すと「受け付けました（モック）」と出るだけで、どこにも届いていなかった。
 * このシステムには外部サービスとサーバー同士でつなぐ連携も、申請の受け付け先も無い。
 * 偽の成功をやめ、このシステムで実際にCVを数える手順（CV計測タグ）を案内する。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cvTrackingGuide } from '../src/app/pages/cv-tracking-guide.ts'

describe('CV計測連携の案内', () => {
  it('偽の受付表示をしない', () => {
    const src = readFileSync('src/app/pages/cv-tracking-page.ts', 'utf8')
    expect(src).not.toContain('受け付けました')
    expect(src).not.toContain('（モック）')
  })

  it('自動でつながらないことを最初に言う', () => {
    const guide = cvTrackingGuide('A8.net')
    expect(guide.lead).toContain('A8.net')
    expect(guide.lead).toContain('自動')
  })

  it('CV計測タグを完了ページに貼る手順を出す', () => {
    const guide = cvTrackingGuide('ecforce')
    expect(guide.steps.join('\n')).toContain('外部LP計測タグを発行')
    expect(guide.steps.join('\n')).toContain('CV計測タグ')
  })

  it('AFFILICODE だけは一括タグで選ぶとリンクに連携用パラメーターが付くと案内する（実装どおりの3つだけ）', () => {
    const text = cvTrackingGuide('AFFILICODE').steps.join('\n')
    expect(text).toContain('squadbeyond_uid')
    expect(text).toContain('sb_tracking')
    expect(text).toContain('sb_article_uid')
    expect(cvTrackingGuide('A8.net').steps.join('\n')).not.toContain('squadbeyond_uid')
  })
})
