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
import { LP_BASE_CSS } from '../lp-base-css.ts'
import { masterStyleIframeCss } from '../master-style.ts'
import { withAutoplayVideos } from '../lp-video.ts'

/** 既定の配信Version幅（実物のデフォルト） */
const DELIVERY_WIDTH = 620

export async function renderDelivery(
  root: HTMLElement,
  abTestUid: string,
  generation?: number,
): Promise<void> {
  root.innerHTML = ''
  let versions: Version[]
  let styleCss: string
  try {
    const [, { articles }] = await Promise.all([api.abTest(abTestUid), api.articles(abTestUid)])
    const articleUid = articles[0]?.uid
    if (articleUid === undefined) {
      showNotice(root, abTestUid)
      return
    }
    versions = (await api.versions(articleUid)).versions
    // 記事設定（Version設定）をLPへ反映する
    styleCss = masterStyleIframeCss((await api.masterStyleSheet(articleUid)).master_style_sheet)
  } catch {
    // 実在しないID（例: URLの <uid> をそのまま開いた等）はここに来る。案内を出す。
    showNotice(root, abTestUid)
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
      `<style>body{margin:0;font-family:"Hiragino Sans",sans-serif}${LP_BASE_CSS}${version.css}${styleCss}</style>` +
      `</head><body>${withAutoplayVideos(version.html)}</body></html>`,
  )
  doc.close()
}

/** 実在しないID等で開かれたときの案内（配信URLの正しい取得方法を示す） */
function showNotice(root: HTMLElement, abTestUid: string): void {
  const wrap = document.createElement('div')
  wrap.style.cssText =
    'min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;' +
    'font-family:"Hiragino Sans",sans-serif;background:#ECECEC'
  const card = document.createElement('div')
  card.style.cssText =
    'background:#fff;border-radius:8px;padding:28px 32px;max-width:520px;text-align:center;' +
    'box-shadow:0 1px 6px rgba(0,0,0,.12);line-height:1.9'
  const looksLikePlaceholder = /[<>]/.test(abTestUid)
  card.innerHTML =
    '<div style="font-size:16px;font-weight:600;margin-bottom:8px">このURLの配信ページは見つかりません</div>' +
    `<div style="font-size:13px;color:#555">指定されたID「${escapeText(abTestUid)}」のbeyondページが存在しません。` +
    (looksLikePlaceholder
      ? '<br><b>&lt;uid&gt; は差し込み用の記号です。</b>実際のIDに置き換えてください。'
      : '') +
    '</div>' +
    '<div style="font-size:13px;color:#555;margin-top:12px">配信URLは、基本情報タブの「配信URL」からコピーできます。</div>' +
    '<div style="margin-top:16px"><a href="#/folders" style="color:#0091FF;font-size:13px">ページ一覧へ →</a></div>'
  wrap.append(card)
  root.append(wrap)
}

function escapeText(value: string): string {
  const el = document.createElement('span')
  el.textContent = value
  return el.innerHTML
}

type DeviceKind = 'sp' | 'tablet' | 'pc'

/** 訪問者のデバイスを UA から判定する（sp / tablet / pc）。 */
function detectDevice(): DeviceKind {
  const ua = navigator.userAgent
  if (/iPad|Tablet|Nexus 7|Nexus 10|Kindle|Silk|PlayBook/i.test(ua)) return 'tablet'
  if (/Mobile|iPhone|Android.*Mobile|Windows Phone|iPod/i.test(ua)) return 'sp'
  return 'pc'
}

/** そのVersionが、指定デバイスへ配信可か（デバイス別ON/OFF）。未設定は全ON扱い。 */
function targetsDevice(version: Version, device: DeviceKind): boolean {
  return version.device_targets?.[device] !== false
}

/**
 * 配信するVersionを1つ選ぶ（FAQ「出し分けロジック＝Branch Operation × デバイス別ON/OFF の掛け算」）。
 * 訪問者のデバイスで、①非アーカイブ ②配信割合1以上 ③そのデバイスがON、の全てを満たすVersionから
 * 配信割合で重み付け抽選する。＝OFFにしたデバイスでは、そのVersionでなく別の配信可能Versionが出る。
 */
function pickDeliveryVersion(versions: readonly Version[]): Version | null {
  const device = detectDevice()
  const alive = versions.filter((v) => v.archived !== true)
  const eligible = alive.filter((v) => v.distribution_ratio >= 1 && targetsDevice(v, device))
  // このデバイス向けに配信可能なものが無ければ、割合条件だけで、それも無ければ生存Versionへフォールバック
  const pool =
    eligible.length > 0
      ? eligible
      : alive.filter((v) => targetsDevice(v, device)).length > 0
        ? alive.filter((v) => targetsDevice(v, device))
        : alive
  if (pool.length === 0) return null
  const total = pool.reduce((sum, v) => sum + Math.max(1, v.distribution_ratio), 0)
  let ticket = Math.random() * total
  for (const version of pool) {
    ticket -= Math.max(1, version.distribution_ratio)
    if (ticket <= 0) return version
  }
  return pool[0] ?? null
}
