/**
 * 「基本情報」タブが送ってくる更新リクエストの境界バリデーション（企画書 §12）。
 *
 * 純粋関数。ここでは State を触らず、「body から何を patch として取り出すか」だけを決める。
 *
 * 大事な性質: **body に無いキーは patch に入れない**。
 * 実物の基本情報タブはフォーム全体を送るが、部分更新でも壊れないようにする
 * （キーが無いのに `null` を patch に入れると、フォルダや媒体が黙って消える）。
 */
import type { AbTest, ConversionCondition } from './types.ts'
import type { AbTestUpdatePatch } from './actions.ts'
import type { ValidationResult } from '../lib/validate.ts'

/**
 * 更新できる項目。`editor_version` は実機で「後から変更できません」なので含めない。
 * `conversion_setting` の `id` はリクエストからは分からないので、ここでは条件だけを持つ。
 */
export type AbTestPatch = Partial<
  Pick<
    AbTest,
    | 'title'
    | 'page_title'
    | 'memo'
    | 'media_id'
    | 'folder_id'
    | 'ad_status'
    | 'delivery_type'
    | 'conversion_unit_price'
    | 'affiliate_service_provider'
    | 'gender'
    | 'age_from'
    | 'age_to'
  >
> & {
  conversion_setting?: { conversion_condition: ConversionCondition }
}

/** 実物のヘルプ文言「50文字まで入力できます」がそのまま境界になる */
const TITLE_MAX_LENGTH = 50

const CONVERSION_CONDITIONS: readonly ConversionCondition[] = ['click', 'access']

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key)
}

/** 空文字・null は「未設定」＝ null。数値にできない文字列はエラー扱いにしたいので undefined を返す。 */
function toNullableNumber(raw: unknown): number | null | undefined {
  if (raw === null || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
    return Number(raw)
  }
  return undefined
}

function toNullableString(raw: unknown): string | null | undefined {
  if (raw === null) return null
  if (typeof raw !== 'string') return undefined
  return raw.trim() === '' ? null : raw.trim()
}

export function parseAbTestPatch(input: unknown): ValidationResult<AbTestPatch> {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, message: 'リクエストの形式が不正です。' }
  }
  const body = input as Record<string, unknown>
  let patch: AbTestPatch = {}

  if (has(body, 'title')) {
    const raw = body['title']
    if (typeof raw !== 'string' || raw.trim() === '') {
      return { ok: false, message: 'beyondページ名を入力してください。' }
    }
    if (raw.trim().length > TITLE_MAX_LENGTH) {
      return { ok: false, message: `beyondページ名は${TITLE_MAX_LENGTH}文字まで入力できます。` }
    }
    patch = { ...patch, title: raw.trim() }
  }

  if (has(body, 'page_title')) {
    const raw = body['page_title']
    if (typeof raw !== 'string') {
      return { ok: false, message: 'タブ表示名は文字列で指定してください。' }
    }
    // 空文字は「未設定」＝titleへフォールバック
    patch = { ...patch, page_title: raw.trim() }
  }

  if (has(body, 'memo')) {
    const raw = body['memo']
    if (typeof raw !== 'string') return { ok: false, message: 'メモは文字列で指定してください。' }
    patch = { ...patch, memo: raw }
  }

  if (has(body, 'delivery_type')) {
    const raw = body['delivery_type']
    if (typeof raw !== 'string' || raw.trim() === '') {
      return { ok: false, message: '配信タイプを指定してください。' }
    }
    patch = { ...patch, delivery_type: raw }
  }

  if (has(body, 'conversion_condition')) {
    const raw = body['conversion_condition']
    if (!CONVERSION_CONDITIONS.includes(raw as ConversionCondition)) {
      return { ok: false, message: 'CV条件はクリックかアクセスのいずれかを指定してください。' }
    }
    patch = { ...patch, conversion_setting: { conversion_condition: raw as ConversionCondition } }
  }

  if (has(body, 'conversion_unit_price')) {
    const value = toNullableNumber(body['conversion_unit_price'])
    if (value === undefined || value === null || value < 0) {
      return { ok: false, message: 'コンバージョン単価は0以上の数値で入力してください。' }
    }
    patch = { ...patch, conversion_unit_price: value }
  }

  const numbers: readonly { key: 'media_id' | 'folder_id' | 'age_from' | 'age_to'; label: string }[] = [
    { key: 'media_id', label: '媒体' },
    { key: 'folder_id', label: 'フォルダ' },
    { key: 'age_from', label: '歳以上' },
    { key: 'age_to', label: '歳以下' },
  ]
  for (const { key, label } of numbers) {
    if (!has(body, key)) continue
    const value = toNullableNumber(body[key])
    if (value === undefined) return { ok: false, message: `${label}は数値で指定してください。` }
    if (key === 'media_id') patch = { ...patch, media_id: value }
    if (key === 'folder_id') patch = { ...patch, folder_id: value }
    if (key === 'age_from') patch = { ...patch, age_from: value }
    if (key === 'age_to') patch = { ...patch, age_to: value }
  }

  if (has(body, 'affiliate_service_provider')) {
    const value = toNullableString(body['affiliate_service_provider'])
    if (value === undefined) {
      return { ok: false, message: '計測ツール・ASPは文字列で指定してください。' }
    }
    patch = { ...patch, affiliate_service_provider: value }
  }

  if (has(body, 'gender')) {
    const value = toNullableString(body['gender'])
    if (value === undefined) return { ok: false, message: '性別は文字列で指定してください。' }
    patch = { ...patch, gender: value }
  }

  return { ok: true, value: patch }
}

/**
 * `conversion_setting` は id を持つので、既存の id を残したまま条件だけ差し替える。
 * （patch 側は id を知らないため、ここで合成する）
 */
export function mergeConversionSetting(current: AbTest, patch: AbTestPatch): AbTestUpdatePatch {
  const { conversion_setting, ...rest } = patch
  if (conversion_setting === undefined) return rest
  return {
    ...rest,
    conversion_setting: {
      id: current.conversion_setting.id,
      conversion_condition: conversion_setting.conversion_condition,
    },
  }
}
