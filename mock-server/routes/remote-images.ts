/**
 * 貼り付けた中身の画像・動画を、EBIyon に写して置く受け口（2026-10-31 本人「スクワットビヨンドで作成したLPを全選択してそのまま
 * エビヨンにはりつけたい…画像がそのままコピーできない」→ 本人の選択「EBIyonに写して置く」）。
 *
 *   POST /versions/:uid/remote_images  { url }  → 201 { url: '/uploads/…' }
 *
 * 編集画面が、貼った中身の画像の住所を1枚ずつ送る。サーバーが取ってきて（lib/remote-image.ts＝内部の住所は開かない・
 * 本物の画像・動画だけ・大きさと時間に上限）/uploads に置き、その住所を返す。動画は 2026-10-31 本人「動画がコピーできない」で足した。LP作成者は自分のVersionだけ（creator-access.ts）。
 */
import { Router } from 'express'
import { getState } from '../store/store.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { optionalString } from '../lib/validate.ts'
import { fetchRemoteImage } from '../lib/remote-image.ts'
import { saveMediaUpload } from '../lib/uploads.ts'

export const remoteImagesRouter: Router = Router()

remoteImagesRouter.post('/versions/:uid/remote_images', async (req, res) => {
  const version = getState().versions.find((v) => v.uid === req.params.uid)
  if (version === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
    return
  }
  const url = optionalString(req.body, 'url').trim()
  if (url === '') {
    res.status(422).json(errorEnvelope('validation_failed', '画像の住所がありません'))
    return
  }
  const got = await fetchRemoteImage(url)
  if (!got.ok) {
    res.status(422).json(errorEnvelope('validation_failed', got.message))
    return
  }
  try {
    res.status(201).json({ url: saveMediaUpload(got.content, got.mime) })
  } catch (error) {
    console.error('[remote-images] 取り込んだ画像を保存できませんでした:', (error as Error).message)
    res.status(500).json(errorEnvelope('save_failed', '画像を保存できませんでした。もう一度貼り付けてください'))
  }
})
