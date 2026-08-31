/**
 * 「タグ設定」モーダル（右レール6番・`HtmlSettingModal`）のAPI。
 *
 * 実APIでは Article の `html_tags: [{tag, document_property, body}]` が対応する
 * （docs/findings-live-observation.md「Article の実フィールド」）。
 * 実物のエンドポイントURLは未採取のため、Version系ルーターと同じ流儀で
 * `/articles/:uid/html_tags` に置いている（配線担当が実URL判明後に差し替え可能）。
 */
import { Router } from 'express'
import { getState, setState } from '../store/store.ts'
import {
  DEFAULT_NOINDEX,
  findUnclosedTag,
  getHtmlSetting,
  setHtmlSetting,
  HTML_TAG_DOCUMENT_PROPERTIES,
  type ArticleHtmlSetting,
  type HtmlTag,
  type HtmlTagDocumentProperty,
} from '../store/html-tags.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { optionalBoolean } from '../lib/validate.ts'
import type { State } from '../store/types.ts'

export const tagSettingsRouter: Router = Router()

/** 個別設定のコードは丸ごと貼り付けられるので上限は大きめに取る */
const MAX_TAG_BODY_LENGTH = 20000
const MAX_TAGS = 50

type ParseResult =
  | { ok: true; value: readonly HtmlTag[] }
  | { ok: false; code: string; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(code: string, message: string): ParseResult {
  return { ok: false, code, message }
}

/**
 * リクエストの `html_tags` を検証する（§12「外部データを信用しない・境界で検証・fail fast」）。
 * 既知のキーだけを取り出して組み直す（未知のキーは落とす＝マスアサインメント防止）。
 */
function parseHtmlTags(body: unknown): ParseResult {
  const raw = isRecord(body) ? body['html_tags'] : undefined
  if (raw === undefined) return { ok: true, value: [] }
  if (!Array.isArray(raw)) return fail('validation_failed', 'html_tagsは配列で指定してください。')
  if (raw.length > MAX_TAGS) {
    return fail('validation_failed', `タグは${MAX_TAGS}件以内で指定してください。`)
  }

  const parsed: HtmlTag[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) return fail('validation_failed', 'タグの形式が正しくありません。')

    const property = entry['document_property']
    if (!HTML_TAG_DOCUMENT_PROPERTIES.includes(property as HtmlTagDocumentProperty)) {
      return fail('validation_failed', 'document_propertyは head または body を指定してください。')
    }
    const documentProperty = property as HtmlTagDocumentProperty

    const tag = entry['tag']
    if (typeof tag !== 'string' || tag.trim() === '') {
      return fail('validation_failed', 'tagを指定してください。')
    }

    const tagBody = entry['body']
    if (typeof tagBody !== 'string') {
      return fail('validation_failed', 'bodyは文字列で指定してください。')
    }
    if (tagBody.length > MAX_TAG_BODY_LENGTH) {
      return fail('validation_failed', `タグは${MAX_TAG_BODY_LENGTH}文字以内で入力してください。`)
    }

    // 実CSSに「タグが正しく閉じられてません。」というアラート状態が焼き込まれている（＝実物にも検査がある）。
    // code に head / body を含めて返し、フロントがどちらの欄を赤くすべきか判別できるようにする。
    if (findUnclosedTag(tagBody) !== null) {
      return fail(`invalid_script_${documentProperty}`, 'タグが正しく閉じられてません。')
    }

    parsed.push({ tag, document_property: documentProperty, body: tagBody })
  }
  return { ok: true, value: parsed }
}

function hasArticle(state: State, uid: string): boolean {
  return state.articles.some((a) => a.uid === uid)
}

function serializeSetting(setting: ArticleHtmlSetting): {
  html_tags: readonly HtmlTag[]
  noindex: boolean
} {
  return { html_tags: setting.html_tags, noindex: setting.noindex }
}

/** タグ設定の取得（モーダルを開いたときに引く） */
tagSettingsRouter.get('/articles/:uid/html_tags', (req, res) => {
  const state = getState()
  if (!hasArticle(state, req.params.uid)) {
    res.status(404).json(errorEnvelope('not_found', '記事が見つかりません。'))
    return
  }
  const setting = getHtmlSetting(state, req.params.uid)
  res.json({
    html_tags: applyEmptyState(req, setting.html_tags),
    noindex: setting.noindex,
  })
})

/** タグ設定の保存（モーダルヘッダの「保存」） */
tagSettingsRouter.put('/articles/:uid/html_tags', (req, res) => {
  if (!hasArticle(getState(), req.params.uid)) {
    res.status(404).json(errorEnvelope('not_found', '記事が見つかりません。'))
    return
  }

  const tags = parseHtmlTags(req.body)
  if (!tags.ok) {
    res.status(422).json(errorEnvelope(tags.code, tags.message))
    return
  }
  const noindex = optionalBoolean(req.body, 'noindex') ?? DEFAULT_NOINDEX
  const uid = req.params.uid

  const next = setState((state) =>
    setHtmlSetting(state, uid, { html_tags: tags.value, noindex }),
  )
  res.json(serializeSetting(getHtmlSetting(next, uid)))
})
