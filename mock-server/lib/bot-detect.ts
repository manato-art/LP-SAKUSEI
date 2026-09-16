/**
 * ボットのアクセスかどうか（2026-09-16・本人の依頼）。
 *
 * 検索エンジンの巡回・リンクのプレビュー・自動操作のブラウザがPVに入ると、
 * CVRが実際より低く出る。計測タグから届いたアクセスのうち、ボットと分かるものは数えない。
 *
 * ⚠️ **いちばん怖いのは、本物のお客さんをボット扱いすること**（数字が減っても気づけない）。
 * 広告から来る人の多くは LINE・Instagram・Facebook・X・TikTok のアプリ内ブラウザなので、
 * 「bot を含むか」のような雑な判定はしない。名乗っているボットの名前だけを見る。
 * 端末名に bot が入る機種（CUBOT）もある。
 *
 * 見ているのは2つだけ:
 *  - UA が、名乗っているボット／計測ツール／スクリプトのもの
 *  - 計測タグが「自動操作中（navigator.webdriver）」と知らせてきた
 */

/**
 * 名乗っているボットの名前。
 * 語の途中で当たらないよう、前後が英数字でないことを条件にする（CUBOT を拾わないため）。
 */
const BOT_NAMES: readonly string[] = [
  // 検索エンジン・広告の審査
  'googlebot',
  'adsbot-google',
  'mediapartners-google',
  'google-inspectiontool',
  'googleother',
  'storebot-google',
  'bingbot',
  'bingpreview',
  'yandexbot',
  'baiduspider',
  'duckduckbot',
  'applebot',
  'petalbot',
  'slurp',
  // SNS・チャットのリンクプレビュー（アプリ内ブラウザとは別物）
  'facebookexternalhit',
  'facebookbot',
  'meta-externalagent',
  'meta-externalfetcher',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'slackbot-linkexpanding',
  'discordbot',
  'telegrambot',
  'whatsapp',
  'pinterestbot',
  'skypeuripreview',
  'embedly',
  // 巡回・SEO・AI
  'bytespider',
  'semrushbot',
  'ahrefsbot',
  'mj12bot',
  'dotbot',
  'ccbot',
  'gptbot',
  'chatgpt-user',
  'claudebot',
  'claude-web',
  'anthropic-ai',
  'perplexitybot',
  'amazonbot',
  'ia_archiver',
  // 自動操作・計測ツール
  'headlesschrome',
  'chrome-lighthouse',
  'lighthouse',
  'pagespeed',
  'gtmetrix',
  'pingdom',
  'uptimerobot',
  'phantomjs',
  'puppeteer',
  'playwright',
  'selenium',
  'prerender',
]

/** スクリプトの取得（ブラウザではない）。名前の直後に「/版」が付く形で名乗る。 */
const SCRIPT_CLIENTS: readonly string[] = [
  'curl',
  'wget',
  'python-requests',
  'python-urllib',
  'aiohttp',
  'go-http-client',
  'node-fetch',
  'axios',
  'undici',
  'java',
  'libwww-perl',
  'httpie',
]

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const BOT_PATTERN = new RegExp(
  `(?<![a-z0-9])(?:${BOT_NAMES.map(escape).join('|')})(?![a-z0-9])`,
  'i',
)

/** スクリプトは UA の先頭で「名前/版」と名乗る（ブラウザのUAに紛れる語ではないので先頭に限る） */
const SCRIPT_PATTERN = new RegExp(`^(?:${SCRIPT_CLIENTS.map(escape).join('|')})/`, 'i')

/** UA だけを見て、ボットかどうか */
export function isBotUserAgent(userAgent: string): boolean {
  const ua = userAgent.trim()
  // ブラウザは必ず UA を送る。空で来るのはスクリプト
  if (ua === '') return true
  return BOT_PATTERN.test(ua) || SCRIPT_PATTERN.test(ua)
}

/**
 * 計測タグから届いたアクセスがボットかどうか。
 *
 * 計測タグは自動操作中（`navigator.webdriver`）のとき `wd: 1` を付けて送る。
 * 送り口は誰でも叩けるので、**1 ちょうどのときだけ**信じる（変な値で人を消させない）。
 */
export function isBotAccess(userAgent: string, body: { wd?: unknown }): boolean {
  return isBotUserAgent(userAgent) || body.wd === 1
}
