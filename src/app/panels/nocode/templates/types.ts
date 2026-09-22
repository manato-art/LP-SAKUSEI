/**
 * 「型から作る」の型の形（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * 1つの型＝入力欄の並び（fields）＋見本の中身（defaults）＋確かめ（validate）＋書き出し（render）。
 * 入力欄の画面（template-form.ts）はこの形だけを見て組み立てるので、型を足すときは型のファイルを1つ足すだけでよい。
 */

/** 並べられる入力（よくある質問の1問など）の中身 */
export type ItemData = Readonly<Record<string, string | boolean | number>>
export type FieldValue = string | boolean | number | readonly ItemData[]
export type TemplateData = Readonly<Record<string, FieldValue>>

interface FieldBase {
  readonly key: string
  readonly label: string
  /** 名前をほかの入力から作るとき（比較表の各欄を「A社」のように呼ぶ） */
  readonly labelOf?: (data: TemplateData) => string
  /** 入力欄の下の小さな説明 */
  readonly note?: string
  /** この入力を出すかどうか（ほかの入力の値しだいで出し分ける） */
  readonly showIf?: (data: TemplateData) => boolean
}

export type Field =
  | (FieldBase & { readonly kind: 'text'; readonly placeholder?: string; readonly maxLength?: number })
  | (FieldBase & { readonly kind: 'textarea'; readonly rows?: number; readonly maxLength?: number })
  | (FieldBase & { readonly kind: 'url'; readonly placeholder?: string })
  | (FieldBase & { readonly kind: 'color'; readonly presets: readonly string[] })
  | (FieldBase & { readonly kind: 'image' })
  | (FieldBase & { readonly kind: 'select'; readonly options: readonly { value: string; label: string }[] })
  | (FieldBase & { readonly kind: 'number'; readonly min: number; readonly max: number; readonly unit?: string })
  | (FieldBase & { readonly kind: 'datetime' })
  | (FieldBase & { readonly kind: 'toggle' })
  /** 文字＋よく使う記号のボタン（比較表の ◎○△×） */
  | (FieldBase & { readonly kind: 'symbols'; readonly symbols: readonly string[]; readonly placeholder?: string })
  | (FieldBase & {
      readonly kind: 'list'
      /** 1件の呼び名（「質問」「口コミ」） */
      readonly itemLabel: string
      readonly min: number
      readonly max: number
      readonly fields: readonly Field[]
      readonly newItem: () => ItemData
    })

export interface NocodeTemplate {
  readonly id: string
  /** 一覧に出す名前（「よくある質問」） */
  readonly name: string
  /** 一覧に出す一言 */
  readonly summary: string
  /** 一覧のアイコン（固定のSVG） */
  readonly icon: string
  readonly fields: readonly Field[]
  /** 見本の中身（そのまま使える例文。日時は now から作る） */
  readonly defaults: (now: Date) => TemplateData
  /** LPに入れる前の確かめ。問題があれば直し方の分かる文 */
  readonly validate: (data: TemplateData, now: Date) => string | null
  /** LPに入れるHTML（<style>＋中身＋必要なら固定の<script>） */
  readonly render: (data: TemplateData, uid: string) => string
}

/* ── 値の読み出し（入力は信用しない。型が違えば既定の値） ── */

export function str(data: TemplateData | ItemData, key: string): string {
  const value = data[key]
  return typeof value === 'string' ? value : ''
}

export function bool(data: TemplateData | ItemData, key: string): boolean {
  return data[key] === true
}

export function int(data: TemplateData | ItemData, key: string, min: number, max: number, fallback: number): number {
  const value = data[key]
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

export function items(data: TemplateData, key: string): readonly ItemData[] {
  const value = data[key]
  return Array.isArray(value) ? (value as readonly ItemData[]) : []
}

/** 選ぶ入力の値（決まった中にない値は既定） */
export function pick<T extends string>(data: TemplateData | ItemData, key: string, allowed: readonly T[], fallback: T): T {
  const value = data[key]
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/** 色の候補（LPでよく使う色。朱・ローズ・山吹・LINEの緑・青・墨） */
export const ACCENT_PRESETS: readonly string[] = ['#E5573F', '#D6336C', '#F2A516', '#06C755', '#1F7AE0', '#1F2A37']

/** 色の候補の呼び名（読み上げ・マウスを乗せたときの名前） */
export const COLOR_NAMES: Readonly<Record<string, string>> = {
  '#E5573F': '朱色',
  '#D6336C': 'ローズ',
  '#F2A516': '山吹色',
  '#06C755': 'LINEの緑',
  '#1F7AE0': '青',
  '#1F2A37': '墨色',
}
