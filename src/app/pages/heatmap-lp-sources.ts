/**
 * ヒートマップに敷く自前配信のLPの材料（本文・Version の CSS・記事設定の CSS）を取ってくる。
 * レポート画面のヒートマップと比較モードのヒートマップで同じものを使う（公開LPと同じ見た目で敷くため）。
 */
import { api } from '../api.ts'
import { masterStyleIframeCss } from '../master-style.ts'

export interface HeatmapLpSources {
  /** Version ごとの本文と CSS（キーは Version の uid） */
  readonly versions: ReadonlyMap<string, { readonly html: string; readonly css: string }>
  /** 記事設定（Version設定）から作った CSS */
  readonly styleCss: string
}

export async function fetchHeatmapLpSources(abTestUid: string): Promise<HeatmapLpSources> {
  const { articles } = await api.articles(abTestUid)
  const first = articles[0]
  if (first === undefined) return { versions: new Map(), styleCss: '' }
  const [{ versions }, { master_style_sheet }] = await Promise.all([
    api.versions(first.uid),
    api.masterStyleSheet(first.uid),
  ])
  return {
    versions: new Map(versions.map((v) => [v.uid, { html: v.html, css: v.css }])),
    styleCss: masterStyleIframeCss(master_style_sheet),
  }
}
