/**
 * LPごとの住所（2026-10-30 本人「フォルダベースで決めなくていい。何もしない時は c1page.com/lp/… って感じ。
 * 基本情報から https:// と .c1page.com の間を自由に決めることができる。この先作成するLPに反映させていく」）。
 *
 * これから作る・複製するLPは、ページ自身が住所（delivery_domain）を持つ。何もしなければ土台そのもの（c1page.com）。
 * それより前のLPは持たない＝今までどおりフォルダのドメインで出す（配信中の広告のURLを変えない）。
 * 画面（基本情報・一覧）とサーバー（配信の判定）で同じ決まりを使う。
 */
import { quickDomainLabelError } from './domain-input.ts'

/** 頭の名前の決まり。空はよい（＝土台そのもの・c1page.com） */
export function pageDomainLabelError(label: string): string | null {
  return label === '' ? null : quickDomainLabelError(label)
}

/** 頭の名前から住所を作る（大文字は小文字にそろえる）。空なら土台そのもの */
export function pageDomainFromLabel(label: string, base: string): string {
  const name = label.trim().toLowerCase()
  return name === '' ? base : `${name}.${base}`
}

/** 住所から頭の名前を取り出す。土台そのものなら ''、土台の下でなければ null（土台を変えたあとの古い住所など） */
export function labelOfPageDomain(domain: string, base: string): string | null {
  if (base === '') return null
  if (domain === base) return ''
  return domain.endsWith(`.${base}`) ? domain.slice(0, -(base.length + 1)) : null
}

/** 配信URLに使うドメイン。ページ自身の住所があればそれ、無ければ今までどおりフォルダのドメイン */
export function effectiveDeliveryDomain(
  pageDomain: string | undefined,
  folderDomain: string | undefined,
): string | undefined {
  return pageDomain !== undefined && pageDomain !== '' ? pageDomain : folderDomain
}
