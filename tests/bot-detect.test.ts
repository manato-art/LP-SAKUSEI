/**
 * ボットのアクセスを数えない（2026-09-16・本人の依頼）。
 *
 * 検索エンジンの巡回やリンクのプレビュー、自動操作のブラウザがPVに入ると、
 * CVRが実際より低く出る。計測タグから届いたアクセスのうち、ボットと分かるものは数えない。
 *
 * **いちばん怖いのは、本物のお客さんをボット扱いすること**（数字が減って気づけない）。
 * 広告から来る人は LINE・Instagram・Facebook などのアプリ内ブラウザが多いので、
 * それらを必ず「人」と判定することを先に押さえる。
 */
import { describe, expect, it } from 'vitest'
import { isBotAccess, isBotUserAgent } from '../mock-server/lib/bot-detect.ts'

/** 本物のお客さん（広告から来る人の実際のUA） */
const HUMANS: readonly [string, string][] = [
  [
    'iPhoneのSafari',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  ],
  [
    'AndroidのChrome',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  ],
  [
    'LINEのアプリ内ブラウザ',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.10.0',
  ],
  [
    'Instagramのアプリ内ブラウザ',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.91 (iPhone15,2; iOS 18_5; ja_JP; ja; scale=3.00; 1179x2556)',
  ],
  [
    'Facebookのアプリ内ブラウザ',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.97;FBBV/650000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.5;FBSS/3;FBID/phone;FBLC/ja_JP;FBOP/5]',
  ],
  [
    'Xのアプリ内ブラウザ',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.50',
  ],
  [
    'TikTokのアプリ内ブラウザ',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.134 Mobile Safari/537.36 trill_360004 BytedanceWebview/d8a21c6',
  ],
  [
    'Yahoo! JAPANアプリ',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 YJApp-IOS jp.co.yahoo.ipn.appli/4.85.0',
  ],
  [
    'Pinterestのアプリ内ブラウザ（Pinterestbotではない）',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [Pinterest/iOS]',
  ],
  [
    '名前に bot が入る端末（CUBOT）',
    'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  ],
  [
    'パソコンのChrome',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  ],
]

/** ボット */
const BOTS: readonly [string, string][] = [
  ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://google.example.test/bot.html)'],
  [
    'GooglebotのスマホUA（JSを実行する）',
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://google.example.test/bot.html)',
  ],
  ['Google広告の審査', 'AdsBot-Google (+http://google.example.test/adsbot.html)'],
  ['Bing', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://bing.example.test/bingbot.htm)'],
  ['Facebookのリンクプレビュー', 'facebookexternalhit/1.1 (+http://facebook.example.test/externalhit_uatext.php)'],
  ['Metaの取得', 'meta-externalagent/1.1 (+http://facebook.example.test/docs/sharing/webmasters/crawler)'],
  ['X（Twitter）のプレビュー', 'Twitterbot/1.0'],
  ['Slackのプレビュー', 'Slackbot-LinkExpanding 1.0 (+http://slack.example.test/robots)'],
  [
    'ヘッドレスChrome（自動操作・計測ツール）',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36',
  ],
  [
    'PageSpeed Insights / Lighthouse',
    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
  ],
  ['Baidu', 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://baidu.example.test/search/spider.html)'],
  ['ByteDanceの巡回', 'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)'],
  ['AIの巡回（GPTBot）', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +http://openai.example.test/gptbot)'],
  ['curl', 'curl/8.7.1'],
  ['Pythonのスクリプト', 'python-requests/2.32.3'],
  ['UAが空', ''],
]

describe('本物のお客さんをボット扱いしない', () => {
  for (const [label, ua] of HUMANS) {
    it(label, () => {
      expect(isBotUserAgent(ua)).toBe(false)
    })
  }
})

describe('ボットを見分ける', () => {
  for (const [label, ua] of BOTS) {
    it(label, () => {
      expect(isBotUserAgent(ua)).toBe(true)
    })
  }
})

describe('自動操作のブラウザ', () => {
  const chrome = HUMANS[1]?.[1] ?? ''

  it('計測タグが「自動操作中」と知らせてきたらボット（UAは普通でも）', () => {
    // Selenium・Puppeteer・Playwright は navigator.webdriver を true にする
    expect(isBotAccess(chrome, { wd: 1 })).toBe(true)
  })

  it('知らせが無ければUAだけで判断する', () => {
    expect(isBotAccess(chrome, {})).toBe(false)
    expect(isBotAccess('curl/8.7.1', {})).toBe(true)
  })

  it('知らせの値が変なら無視する（送り口は誰でも叩けるので、人を消させない）', () => {
    expect(isBotAccess(chrome, { wd: 'yes' })).toBe(false)
    expect(isBotAccess(chrome, { wd: 0 })).toBe(false)
  })
})
