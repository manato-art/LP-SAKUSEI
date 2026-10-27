/**
 * Version設定（MasterStyleSheet）API。
 * エディタ右レール5番目 `data-test="MasterStyleSheetModal-BtnOpenModal"` のモーダルが読み書きする。
 *
 *   GET  /articles/:uid/master_style_sheet[?version_uid=…]
 *   PUT  /articles/:uid/master_style_sheet[?version_uid=…]  （本文に apply_to_other_versions: true で、ほかの Version にも入れる）
 *
 * 2026-10-27 本人「LP設定なんだけど、各バージョンごとに分けたい」: version_uid を付けると、その Version の設定を読み書きする
 * （自分の設定が無い Version はページ共通の設定＝それまでの設定を使う）。付けなければページ共通の設定。
 *
 * 実物のAPIは記事(Article)にぶら下がる `master_style_sheet`（docs/findings-live-observation.md）。
 * このルーターは app.ts には自分ではマウントしない（配線は親が行う）。
 */
import { Router } from 'express'
import { errorEnvelope } from '../lib/envelope.ts'
import { externalizeDataUrls } from '../lib/uploads.ts'
import {
  applyMasterStyleSheetToVersions,
  getMasterStyleSheet,
  parseMasterStyleSheet,
  putMasterStyleSheet,
} from '../store/master-style-sheet.ts'
import { getState, setState } from '../store/store.ts'
import type { State } from '../store/types.ts'

export const versionSettingsRouter: Router = Router()

const NOT_FOUND = errorEnvelope('not_found', '記事が見つかりません。')

/** 背景の画像・動画の欄（どちらも「500文字以内」の決まりがある） */
const BACKGROUND_IMAGE_FIELDS = ['outer_background_image', 'inner_background_image'] as const

/**
 * 背景に選んだ画像・動画（data URL）を別ファイルにして、/uploads/… の短い住所に置き換えた送信内容（2026-10-27）。
 * 画面は選んだファイルを data URL のまま送るので、400バイトほどの小さな画像でも「500文字以内」で保存できなかった。
 * 本文と同じく別ファイルにする（保存データを重くしない）。小さくてもファイルにする（欄の長さの決まりのため）
 */
function withUploadedBackgrounds(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) return body
  const record = body as Record<string, unknown>
  const next = { ...record }
  for (const field of BACKGROUND_IMAGE_FIELDS) {
    const value = record[field]
    if (typeof value === 'string' && value.startsWith('data:')) next[field] = externalizeDataUrls(value, 0).text
  }
  return next
}

/**
 * 読み書きする先（記事と、付いていれば Version）。記事が無い・その記事の Version でなければ null（404）。
 * version_uid が無ければ undefined＝ページ共通の設定
 */
function targetOf(state: State, articleUid: string, rawVersionUid: unknown): { articleUid: string; versionUid: string | undefined } | null {
  const article = state.articles.find((a) => a.uid === articleUid)
  if (article === undefined) return null
  if (rawVersionUid === undefined || rawVersionUid === '') return { articleUid: article.uid, versionUid: undefined }
  const version = state.versions.find((v) => v.uid === rawVersionUid && v.article_id === article.id)
  return version === undefined ? null : { articleUid: article.uid, versionUid: version.uid }
}

versionSettingsRouter.get('/articles/:uid/master_style_sheet', (req, res) => {
  const state = getState()
  const target = targetOf(state, req.params.uid, req.query['version_uid'])
  if (target === null) {
    res.status(404).json(NOT_FOUND)
    return
  }
  res.json({ master_style_sheet: getMasterStyleSheet(state, target.articleUid, target.versionUid) })
})

versionSettingsRouter.put('/articles/:uid/master_style_sheet', (req, res) => {
  const state = getState()
  const target = targetOf(state, req.params.uid, req.query['version_uid'])
  if (target === null) {
    res.status(404).json(NOT_FOUND)
    return
  }
  const parsed = parseMasterStyleSheet(withUploadedBackgrounds(req.body), getMasterStyleSheet(state, target.articleUid, target.versionUid))
  if (!parsed.ok) {
    res.status(422).json(errorEnvelope('validation_failed', parsed.message))
    return
  }
  // 「他のバージョンにも適用する」（チェックを入れて保存・2026-10-27）。Version を指定したときだけ
  const toOthers = (req.body as Record<string, unknown> | null)?.['apply_to_other_versions'] === true && target.versionUid !== undefined
  let appliedVersions = 0
  setState((s) => {
    if (!toOthers || target.versionUid === undefined) return putMasterStyleSheet(s, target.articleUid, parsed.value, target.versionUid)
    const out = applyMasterStyleSheetToVersions(s, target.articleUid, parsed.value, target.versionUid)
    appliedVersions = out.appliedVersions
    return out.state
  })
  res.json({ master_style_sheet: parsed.value, applied_versions: appliedVersions })
})
