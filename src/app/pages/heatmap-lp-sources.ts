/**
 * ヒートマップに敷く自前配信のLPの材料（本文・Version の CSS・記事設定の CSS）を取ってくる。
 * レポート画面のヒートマップと比較モードのヒートマップで同じものを使う（公開LPと同じ見た目で敷くため）。
 */
import { api } from '../api.ts'
import { masterStyleIframeCss, masterStyleBackgroundHtml } from '../master-style.ts'

/** Version 1つぶんの材料。LP設定は Version ごと（2026-10-27）なので、その CSS・動画の層も Version ごとに持つ */
export interface HeatmapVersionSource {
  readonly html: string
  readonly css: string
  /** その Version の LP設定から作った CSS */
  readonly styleCss: string
  /** その Version の LP設定の背景が動画のときの動画の層（無ければ ''） */
  readonly styleHtml: string
}

export interface HeatmapLpSources {
  /** Version ごとの本文と CSS（キーは Version の uid） */
  readonly versions: ReadonlyMap<string, HeatmapVersionSource>
  /** ページ共通の LP設定から作った CSS（Version の分が無いとき用） */
  readonly styleCss: string
  /** 記事設定の背景が動画のときの動画の層（2026-10-27・無ければ ''） */
  readonly styleHtml: string
}

export async function fetchHeatmapLpSources(abTestUid: string): Promise<HeatmapLpSources> {
  const { articles } = await api.articles(abTestUid)
  const first = articles[0]
  if (first === undefined) return { versions: new Map(), styleCss: '', styleHtml: '' }
  const [{ versions }, { master_style_sheet }] = await Promise.all([
    api.versions(first.uid),
    api.masterStyleSheet(first.uid),
  ])
  const sheets = await Promise.all(versions.map((v) => api.masterStyleSheet(first.uid, v.uid)))
  return {
    versions: new Map(
      versions.map((v, i) => {
        const sheet = sheets[i]?.master_style_sheet ?? master_style_sheet
        return [v.uid, { html: v.html, css: v.css, styleCss: masterStyleIframeCss(sheet), styleHtml: masterStyleBackgroundHtml(sheet) }]
      }),
    ),
    styleCss: masterStyleIframeCss(master_style_sheet),
    styleHtml: masterStyleBackgroundHtml(master_style_sheet),
  }
}
