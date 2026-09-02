/**
 * Widgetライブラリの資産（各カテゴリ約1,500枚ぶんの gz・合計13MB）の配信。
 *
 * これをビルド成果（dist）としてDockerイメージへ焼くと、Railwayのデプロイが
 * INITIALIZING のまま昇格しなくなる（イメージ肥大が原因と判断）。そこで**永続Volume
 * (`DATA_DIR`)から配信**し、イメージには載せない。
 *
 * 種蒔き（seed）: 起動時に「Volumeが空」かつ「dist側に資産が在る」なら一度だけコピーする。
 *   - 資産入りイメージのデプロイは昇格しなくてもコンテナは起動するので、そこで種蒔きされる。
 *   - 以後は資産をイメージから外して（.railwayignore）軽いイメージで昇格させ、Volumeから配信する。
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import express, { type Router } from 'express'

const DATA_DIR = process.env['DATA_DIR']

/** Volume上のWidget資産ディレクトリ（DATA_DIR未設定＝ローカルはnull）。 */
function widgetVolumeDir(): string | null {
  return DATA_DIR === undefined || DATA_DIR === '' ? null : join(DATA_DIR, 'widgets')
}

/** Volumeが空で、dist側に資産が在れば一度だけコピーして種を蒔く。 */
export function seedWidgetAssets(distDir: string): void {
  const vol = widgetVolumeDir()
  if (vol === null) return
  if (existsSync(vol) && readdirSync(vol).length > 0) return // 種蒔き済み
  const src = join(distDir, 'clean', 'widget-library')
  if (!existsSync(src)) return // このイメージには資産が無い（配信専用デプロイ）
  mkdirSync(vol, { recursive: true })
  cpSync(src, vol, { recursive: true })
  console.log(`[widgets] Volumeへ種蒔き: ${src} → ${vol}`)
}

/** `/clean/widget-library/*` をVolumeから配信するルーター（Volume無し＝ローカルはnull）。 */
export function widgetAssetsRouter(): Router | null {
  const vol = widgetVolumeDir()
  if (vol === null) return null
  const router = express.Router()
  router.use(
    '/clean/widget-library',
    express.static(vol, {
      setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=86400'),
    }),
  )
  return router
}
