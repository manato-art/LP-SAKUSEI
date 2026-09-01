/**
 * 配信ページ（`/#/ab/:abTestUid`）＝**配信URLの実体**（FAQ「配信URLを取得する」）。
 *
 * beyondページを公開状態で表示する。実物の配信URLは beyondページ全体を指し、
 * 複数Versionを**配信割合に応じてABテスト配信**する（Versionリンク／ステップリンクとは別物）。
 * クローンでも同じく、非アーカイブで配信割合1以上のVersionから割合で1つ選んで表示する。
 *
 * 見た目は**アプリのシェル（サイドバー等）を出さない公開ページ**。保存済みの html/css を
 * 配信幅（既定620px）で中央に描く。外部へは一切出さない（§3-2・iframeへローカル描画）。
 */
import { api, type Version } from '../api.ts'
import { isStale } from '../main.ts'

/** 既定の配信Version幅（実物のデフォルト） */
const DELIVERY_WIDTH = 620

export async function renderDelivery(
  root: HTMLElement,
  abTestUid: string,
  generation?: number,
): Promise<void> {
  root.innerHTML = ''
  let versions: Version[]
  try {
    const [, { articles }] = await Promise.all([api.abTest(abTestUid), api.articles(abTestUid)])
    const articleUid = articles[0]?.uid
    if (articleUid === undefined) {
      root.textContent = 'ページが見つかりません'
      return
    }
    versions = (await api.versions(articleUid)).versions
  } catch {
    root.textContent = 'ページの読み込みに失敗しました'
    return
  }
  if (generation !== undefined && isStale(generation)) return

  const version = pickDeliveryVersion(versions)
  if (version === null) {
    root.textContent = '配信できるVersionがありません'
    return
  }

  const stage = document.createElement('div')
  stage.style.cssText =
    'min-height:100vh;background:#fff;display:flex;justify-content:center;align-items:flex-start'
  const frame = document.createElement('iframe')
  frame.title = 'delivery'
  frame.style.cssText = `width:${DELIVERY_WIDTH}px;max-width:100%;min-height:100vh;border:none;background:#fff`
  stage.append(frame)
  root.append(stage)

  const doc = frame.contentDocument
  if (doc === null) return
  doc.open()
  doc.write(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<style>body{margin:0;font-family:"Hiragino Sans",sans-serif}${version.css}</style>` +
      `</head><body>${version.html}</body></html>`,
  )
  doc.close()
}

/**
 * 配信するVersionを配信割合で1つ選ぶ（ABテスト配信）。
 * 非アーカイブかつ配信割合1以上のVersionを対象に、割合で重み付け抽選する。
 */
function pickDeliveryVersion(versions: readonly Version[]): Version | null {
  const active = versions.filter((v) => v.archived !== true && v.distribution_ratio >= 1)
  const pool = active.length > 0 ? active : versions.filter((v) => v.archived !== true)
  if (pool.length === 0) return null
  const total = pool.reduce((sum, v) => sum + Math.max(1, v.distribution_ratio), 0)
  let ticket = Math.random() * total
  for (const version of pool) {
    ticket -= Math.max(1, version.distribution_ratio)
    if (ticket <= 0) return version
  }
  return pool[0] ?? null
}
