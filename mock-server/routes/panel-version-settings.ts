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
import {
  getMasterStyleSheet,
  parseMasterStyleSheet,
  putMasterStyleSheet,
} from '../store/master-style-sheet.ts'
import { getState, setState } from '../store/store.ts'

export const versionSettingsRouter: Router = Router()

const NOT_FOUND = errorEnvelope('not_found', '記事が見つかりません。')

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
  const parsed = parseMasterStyleSheet(req.body, getMasterStyleSheet(state, article.uid))
  if (!parsed.ok) {
    res.status(422).json(errorEnvelope('validation_failed', parsed.message))
    return
  }
  setState((s) => putMasterStyleSheet(s, article.uid, parsed.value))
  res.json({ master_style_sheet: parsed.value })
})
