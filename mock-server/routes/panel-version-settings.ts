/**
 * Version設定（MasterStyleSheet）API。
 * エディタ右レール5番目 `data-test="MasterStyleSheetModal-BtnOpenModal"` のモーダルが読み書きする。
 *
 *   GET  /articles/:uid/master_style_sheet
 *   PUT  /articles/:uid/master_style_sheet
 *
 * 実物のAPIは記事(Article)にぶら下がる `master_style_sheet`（docs/findings-live-observation.md）。
 * このルーターは app.ts には自分ではマウントしない（配線は親が行う）。
 */
import { Router } from 'express'
import { errorEnvelope } from '../lib/envelope.ts'
import { externalizeDataUrls } from '../lib/uploads.ts'
import {
  getMasterStyleSheet,
  parseMasterStyleSheet,
  putMasterStyleSheet,
} from '../store/master-style-sheet.ts'
import { getState, setState } from '../store/store.ts'

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

versionSettingsRouter.get('/articles/:uid/master_style_sheet', (req, res) => {
  const state = getState()
  const article = state.articles.find((a) => a.uid === req.params.uid)
  if (article === undefined) {
    res.status(404).json(NOT_FOUND)
    return
  }
  res.json({ master_style_sheet: getMasterStyleSheet(state, article.uid) })
})

versionSettingsRouter.put('/articles/:uid/master_style_sheet', (req, res) => {
  const state = getState()
  const article = state.articles.find((a) => a.uid === req.params.uid)
  if (article === undefined) {
    res.status(404).json(NOT_FOUND)
    return
  }
  const parsed = parseMasterStyleSheet(withUploadedBackgrounds(req.body), getMasterStyleSheet(state, article.uid))
  if (!parsed.ok) {
    res.status(422).json(errorEnvelope('validation_failed', parsed.message))
    return
  }
  setState((s) => putMasterStyleSheet(s, article.uid, parsed.value))
  res.json({ master_style_sheet: parsed.value })
})
