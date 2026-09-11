/**
 * 保存データ全体で、本文などに埋め込まれた画像・動画（data URL）を別ファイルにする（起動時に1回・2026-09-11 本人依頼）。
 *
 * 保存の入口（Version保存・マジック置換・履歴・ポップアップ・商品）でも同じ変換をしている（lib/uploads.ts）。
 * これは、入口で変換するようになる前に保存されていた分の移し替え。
 * 古いデータで項目が欠けていても落ちないよう、文字列のときだけ変換する。
 */
import { externalizeDataUrls } from '../lib/uploads.ts'
import type { State } from './types.ts'

export function externalizeStateImages(state: State): { state: State; converted: number } {
  let converted = 0
  const convert = <T>(value: T): T => {
    if (typeof value !== 'string') return value
    const out = externalizeDataUrls(value)
    converted += out.converted
    return out.text as T
  }

  const versions = state.versions.map((v) => {
    const html = convert(v.html)
    const css = convert(v.css)
    return html === v.html && css === v.css ? v : { ...v, html, css }
  })
  const exitPopups = state.exitPopups.map((p) => {
    const html = convert(p.html)
    return html === p.html ? p : { ...p, html }
  })
  const followPopups = state.followPopups.map((p) => {
    const html = convert(p.html)
    const css = convert(p.css)
    return html === p.html && css === p.css ? p : { ...p, html, css }
  })
  const products = state.products.map((p) => {
    const image = convert(p.image)
    return image === p.image ? p : { ...p, image }
  })

  if (converted === 0) return { state, converted: 0 }
  return { state: { ...state, versions, exitPopups, followPopups, products }, converted }
}
