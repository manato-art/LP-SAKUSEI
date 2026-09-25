/**
 * 流入元（utm_source）の、サービスの色の付いたロゴの形（2026-09-25・本人「各サービスの色がついたロゴの形にしてほしい」）。
 *
 * utm_source は広告を出す人が自由に書く。よく使う書き方（fb・facebook・fb_story…）を、最初の語で見分ける。
 * 知らない名前には付けない（文字だけ）。形は画面の小さな目印として描いた簡略版（公式ロゴの画像ではない）。
 */
import { withUniqueSvgIds } from '../svg-unique-ids.ts'

export type SourceKind = 'facebook' | 'instagram' | 'google' | 'youtube' | 'yahoo' | 'line' | 'tiktok' | 'x'

/** 最初の語（英数字のかたまり・小文字）がこれなら、そのサービス */
const ALIASES: Readonly<Record<SourceKind, readonly string[]>> = {
  facebook: ['fb', 'facebook', 'meta', 'fbads', 'facebookads', 'metaads'],
  instagram: ['ig', 'instagram', 'insta'],
  google: ['google', 'gdn', 'googleads', 'adwords', 'gads'],
  youtube: ['youtube', 'yt'],
  yahoo: ['yahoo', 'yda', 'yss', 'yahooads'],
  line: ['line', 'lineads', 'lap'],
  tiktok: ['tiktok', 'tiktokads'],
  x: ['x', 'twitter', 'tw', 'twitterads'],
}

/** 画面に出すサービス名（title・読み上げ用） */
export const SOURCE_NAMES: Readonly<Record<SourceKind, string>> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  google: 'Google',
  youtube: 'YouTube',
  yahoo: 'Yahoo!',
  line: 'LINE',
  tiktok: 'TikTok',
  x: 'X（旧Twitter）',
}

/** `fb` / `fb_story` / `Facebook` → facebook。知らなければ null */
export function sourceKindOf(value: string): SourceKind | null {
  const token = value.toLowerCase().split(/[^a-z0-9]+/).find((t) => t !== '') ?? ''
  if (token === '') return null
  for (const kind of Object.keys(ALIASES) as SourceKind[]) {
    if (ALIASES[kind].includes(token)) return kind
  }
  return null
}

/** 24×24 の中身（中身は固定の文字列だけ。利用者の入力は入れない） */
const SVG_BODY: Readonly<Record<SourceKind, string>> = {
  facebook:
    '<circle cx="12" cy="12" r="12" fill="#0866FF"/>' +
    '<path fill="#fff" d="M13.4 20.5v-6.9h2.3l.36-2.7H13.4V9.2c0-.78.22-1.31 1.34-1.31h1.43V5.47A19 19 0 0 0 14.1 5.36c-2.05 0-3.46 1.25-3.46 3.55v1.99H8.33v2.7h2.31v6.9z"/>',
  instagram:
    '<defs><radialGradient id="hm-src-ig" cx="28%" cy="108%" r="140%">' +
    '<stop offset="0" stop-color="#FFDD55"/><stop offset=".12" stop-color="#FFDD55"/>' +
    '<stop offset=".48" stop-color="#FF543E"/><stop offset=".72" stop-color="#C837AB"/><stop offset="1" stop-color="#3771C8"/>' +
    '</radialGradient></defs>' +
    '<rect width="24" height="24" rx="6.5" fill="url(#hm-src-ig)"/>' +
    '<rect x="5.6" y="5.6" width="12.8" height="12.8" rx="3.8" fill="none" stroke="#fff" stroke-width="1.7"/>' +
    '<circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" stroke-width="1.7"/>' +
    '<circle cx="15.9" cy="8.1" r="1" fill="#fff"/>',
  google:
    '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>' +
    '<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>' +
    '<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>' +
    '<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>',
  youtube:
    '<path fill="#FF0000" d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 3.9 12 3.9 12 3.9s-7.5 0-9.4.5A3 3 0 0 0 .5 6.5 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.5 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.5z"/>' +
    '<path fill="#fff" d="M9.6 15.5 15.8 12 9.6 8.5z"/>',
  yahoo:
    '<rect width="24" height="24" rx="6" fill="#6001D2"/>' +
    '<text x="12" y="16.4" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11.5" font-weight="700" fill="#fff">Y!</text>',
  line:
    '<rect width="24" height="24" rx="6" fill="#06C755"/>' +
    '<path fill="#fff" d="M12 5.3c-4.2 0-7.6 2.75-7.6 6.15 0 3.05 2.7 5.6 6.35 6.08.25.05.58.16.67.37.08.19.05.49.03.68l-.1.65c-.03.19-.15.76.67.41.82-.35 4.47-2.63 6.1-4.51 1.13-1.24 1.67-2.49 1.67-3.88 0-3.4-3.4-6.15-7.6-6.15z"/>' +
    '<text x="12" y="13.1" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="4.6" font-weight="700" fill="#06C755">LINE</text>',
  tiktok:
    '<rect width="24" height="24" rx="6" fill="#010101"/>' +
    '<g transform="translate(5.4 5.1) scale(0.56)">' +
    '<path fill="#25F4EE" transform="translate(-0.9 -0.6)" d="M12.5 0h3.9c.1 1.5.6 3.1 1.8 4.2 1.1 1.1 2.7 1.6 4.2 1.8v4c-1.4-.05-2.9-.35-4.2-.97-.57-.26-1.1-.59-1.6-.93v8.75c-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36L12.5 0z"/>' +
    '<path fill="#FE2C55" transform="translate(0.9 0.6)" d="M12.5 0h3.9c.1 1.5.6 3.1 1.8 4.2 1.1 1.1 2.7 1.6 4.2 1.8v4c-1.4-.05-2.9-.35-4.2-.97-.57-.26-1.1-.59-1.6-.93v8.75c-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36L12.5 0z"/>' +
    '<path fill="#fff" d="M12.5 0h3.9c.1 1.5.6 3.1 1.8 4.2 1.1 1.1 2.7 1.6 4.2 1.8v4c-1.4-.05-2.9-.35-4.2-.97-.57-.26-1.1-.59-1.6-.93v8.75c-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36L12.5 0z"/>' +
    '</g>',
  x:
    '<rect width="24" height="24" rx="6" fill="#000"/>' +
    '<path fill="#fff" transform="translate(5.2 5.2) scale(0.567)" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',
}


/** アイコン（16px）。知らない流入元なら null */
export function sourceIconFor(value: string, size = 16): HTMLElement | null {
  const kind = sourceKindOf(value)
  if (kind === null) return null
  const wrap = document.createElement('span')
  wrap.className = 'hm-vl-src-icon'
  wrap.dataset['source'] = kind
  wrap.title = SOURCE_NAMES[kind]
  // 固定の文字列だけを入れる（利用者の入力は入らない）
  // グラデーションの名前（id）は、アイコンごとに別にする。同じ名前を使い回すと、最初の1つが隠れたとき
  // （別の行が非表示など）に、ほかの全部の色も消える（2026-09-25 実測・svg-unique-ids.ts）
  wrap.innerHTML = withUniqueSvgIds(
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" role="img" aria-label="${SOURCE_NAMES[kind]}">` +
      `${SVG_BODY[kind]}</svg>`,
  )
  return wrap
}
