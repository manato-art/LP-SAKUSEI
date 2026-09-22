/**
 * Widgetライブラリの見本（カテゴリーごとの gz・合計約13MB）の配信。
 *
 * 見本はビルド成果（dist/clean/widget-library）に入っているので、デプロイした版から配る。
 *
 * 経緯（2026-09-22 に直した）: 9/2 に「イメージへ焼くとデプロイが昇格しない」と判断して、
 * 起動時に一度だけ永続Volume（DATA_DIR/widgets）へ写し、以後はVolumeから配っていた。
 * ところが「イメージから外す」次の回は行われず、見本はずっとイメージにも入ったまま（デプロイも昇格している）。
 * 一方Volumeの写しは 9/3 のまま更新されないので、見本を直して push しても本番は古い見本を配り続けていた
 * （見本の点検と作り変えで発覚）。Volume の写しは消さずに残してある（使わない）。
 *
 * 直した見本が、前にライブラリを開いた人にもすぐ届くように、毎回確かめさせる（no-cache。
 * 変わっていなければ ETag で 304 になるので軽い）。
 */
import { join } from 'node:path'
import express, { type Router } from 'express'

export function widgetLibraryRouter(distDir: string): Router {
  const router = express.Router()
  router.use(
    '/clean/widget-library',
    express.static(join(distDir, 'clean', 'widget-library'), {
      index: false,
      fallthrough: false,
      setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
    }),
  )
  return router
}
