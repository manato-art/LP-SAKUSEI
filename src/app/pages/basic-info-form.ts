/**
 * 「基本情報」タブの純粋ロジック（DOMもfetchも触らない）。
 *
 * 共通指示 §5: テスト環境は node なのでDOMは触れない。
 * 「この入力から何のリクエストを作るか」をここに閉じ込めてテストする。
 */

/** `GET /ab_tests/:uid/edit` が返す、基本情報タブが使う部分だけ */
export interface AbTestForEdit {
  uid: string
  title: string
  page_title: string
  memo: string
  ad_status: string
  /** 1=(該当なし) / 2=beyondエディター / 3=HTMLエディター。実機では disabled */
  editor_version: number
  delivery_type: string
  media_id: number | null
  conversion_unit_price: number
  conversion_setting: { conversion_condition: string }
  affiliate_service_provider: string | null
  gender: string | null
  age_from: number | null
  age_to: number | null
  media: { id: number; name: string } | null
  folder: { uid: string; name: string } | null
}

/**
 * 画面で**実際に打ち込める**欄だけ。
 * 選択系（配信タイプ・CV条件・媒体・性別・年齢）は MUI の Select で、
 * 選択肢一覧のマークアップが採取物に無い（`role="listbox"` が1つも無い）ため、
 * 表示のみ＝読み込んだ値をそのまま持ち回る。
 */
export interface BasicInfoValues {
  title: string
  /** 配信ページのブラウザタブ表示名（空なら title にフォールバック） */
  page_title: string
  memo: string
  affiliate_service_provider: string
  conversion_unit_price: string
  /** 以下は選択肢セレクト（指示⑮ で編集可能化）。未指定なら現状維持 */
  delivery_type?: string
  media_id?: string
  conversion_condition?: string
  gender?: string
  age_from?: string
  age_to?: string
}

export type BasicInfoValidation = { ok: true } | { ok: false; message: string }

/** 実物のヘルプ文言「50文字まで入力できます」がそのまま境界 */
const TITLE_MAX_LENGTH = 50

/** 編集タイプの表示名（実機の実測・docs/findings-live-observation.md） */
export const EDITOR_VERSION_LABELS: Readonly<Record<number, string>> = {
  1: '該当なし',
  2: 'beyondエディター',
  3: 'HTMLエディター',
}

/** 配信タイプの表示名。採取できたのは `html_rewriting` = `同一URL配信` の1件だけ。 */
export const DELIVERY_TYPE_LABELS: Readonly<Record<string, string>> = {
  html_rewriting: '同一URL配信',
  same_url: '同一URL配信',
}

/** CV条件の表示名（実DOMの value と表示テキストの対応） */
export const CONVERSION_CONDITION_LABELS: Readonly<Record<string, string>> = {
  click: 'クリック',
  access: 'アクセス',
}

/** 配信ステータスの表示名（実機の4値・docs/findings-live-observation.md） */
export const AD_STATUS_LABELS: Readonly<Record<string, string>> = {
  prepared: '準備中',
  delivered: '配信中',
  stopping: '停止中',
  finished: '終了',
}

export function toFormValues(abTest: AbTestForEdit): BasicInfoValues {
  return {
    title: abTest.title,
    page_title: abTest.page_title ?? '',
    memo: abTest.memo,
    affiliate_service_provider: abTest.affiliate_service_provider ?? '',
    conversion_unit_price: String(abTest.conversion_unit_price),
  }
}

/**
 * 更新リクエストの本体。
 * 打ち込める欄は入力値から、選択系は読み込んだレコードの値から組む
 * （選択肢UIが採取できたら、そこだけ差し替えれば同じ形が流れる）。
 */
export function buildUpdatePayload(
  abTest: AbTestForEdit,
  input: BasicInfoValues,
): Record<string, unknown> {
  const asp = input.affiliate_service_provider.trim()
  const price = Number(input.conversion_unit_price.trim())
  const numOrNull = (raw: string | undefined, fallback: number | null): number | null => {
    if (raw === undefined) return fallback
    if (raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  }
  return {
    title: input.title.trim(),
    page_title: input.page_title.trim(),
    memo: input.memo,
    media_id: numOrNull(input.media_id, abTest.media_id),
    delivery_type: input.delivery_type ?? abTest.delivery_type,
    conversion_condition: input.conversion_condition ?? abTest.conversion_setting.conversion_condition,
    conversion_unit_price: Number.isFinite(price) ? price : 0,
    affiliate_service_provider: asp === '' ? null : asp,
    gender: input.gender !== undefined ? (input.gender === '' ? null : input.gender) : abTest.gender,
    age_from: numOrNull(input.age_from, abTest.age_from),
    age_to: numOrNull(input.age_to, abTest.age_to),
  }
}

export function validateBasicInfo(input: BasicInfoValues): BasicInfoValidation {
  const title = input.title.trim()
  if (title === '') return { ok: false, message: 'beyondページ名を入力してください。' }
  if (title.length > TITLE_MAX_LENGTH) {
    return { ok: false, message: `beyondページ名は${TITLE_MAX_LENGTH}文字まで入力できます。` }
  }
  const raw = input.conversion_unit_price.trim()
  const price = raw === '' ? 0 : Number(raw)
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, message: 'コンバージョン単価は0以上の数値で入力してください。' }
  }
  return { ok: true }
}

/**
 * 配信URL。実物は `https://<フォルダのドメイン>/ab/<uid>` だが、
 * クローンは本番ドメインを一切登場させない（企画書 §3-2）ので localhost のプレビューを指す。
 *
 * 実パス `/lp/:uid`（サーバー側でSSR配信・§10-1）が配信URLの実体。
 * 旧URL（ハッシュルート `/#/ab/:uid`）は `main.ts` が `/lp/:uid` へリダイレクトするので
 * 既存のリンクも引き続き開ける。
 */
export function deliveryUrl(origin: string, abTestUid: string): string {
  return `${origin}/lp/${abTestUid}`
}

/** 4つのタブの遷移先（実DOMの href をクローンのハッシュルートへ写したもの） */
export function tabHashRoutes(
  folderUid: string,
  abTestUid: string,
): Readonly<Record<'info' | 'version' | 'popup' | 'report', string>> {
  return {
    info: `#/folders/${folderUid}/ab_tests/${abTestUid}/edit`,
    version: `#/ab_tests/${abTestUid}/articles`,
    popup: `#/ab_tests/${abTestUid}/articles/exit_popups`,
    report: `#/ab_tests/${abTestUid}/reports`,
  }
}
