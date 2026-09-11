/**
 * 中間ページ（中間ページリンクの実体・実パス `/redirect_pages/:uid`）。
 *
 * 採取した設定画面のリンクは `https://<配信ドメイン>/redirect_pages/<uid>?sbrp=true&sbrpuid=<uid>`。
 * 配信ページ（`/lp/:uid`）と同じくここで完結してSSR応答する（管理画面の認証は掛けない＝広告から来た人が開く）。
 * `sbrp` / `sbrpuid` はタグの発火条件に使う目印で、応答の中身は変えない。
 */
import { Router } from 'express'
import { getState } from '../store/store.ts'
import { bulkTagsForFolder } from '../store/bulk-tags.ts'
import { DEFAULT_REDIRECT_SECONDS, redirectDestination } from '../lib/redirect-page-rules.ts'
import { buildRedirectPageHtml } from './redirect-page-html.ts'
import { renderRedirectPageNotice } from './delivery-notice.ts'

export const redirectPageDeliveryRouter: Router = Router()

redirectPageDeliveryRouter.get('/redirect_pages/:uid', (req, res) => {
  const state = getState()
  const page = state.redirectPages.find((p) => p.uid === req.params.uid)
  const abTest = page === undefined ? undefined : state.abTests.find((t) => t.id === page.ab_test_id)
  if (page === undefined || abTest === undefined) {
    res.status(404).type('html').send(renderRedirectPageNotice('not_found'))
    return
  }
  const destination = redirectDestination(page.url)
  if (destination === null) {
    res.status(404).type('html').send(renderRedirectPageNotice('no_destination'))
    return
  }

  // タグ＝一括タグ設定（範囲一致・配信ページと同じ決め方）＋ この中間ページのタグ（中間ページタグ設定）
  const bulkTags = bulkTagsForFolder(state, abTest.team_id, abTest.folder_id)
  const ownTags = page.html_tags ?? []
  const tagsFor = (property: 'head' | 'body'): string =>
    bulkTags.map((b) => (property === 'head' ? b.head_js : b.body_js)).join('') +
    ownTags
      .filter((t) => t.document_property === property)
      .map((t) => t.body)
      .join('')

  const html = buildRedirectPageHtml({
    title: abTest.page_title || abTest.title,
    destination,
    redirectSeconds: page.redirect_time ?? DEFAULT_REDIRECT_SECONDS,
    // リファラー設定の初期値は Version（設定画面の初期選択）
    versionPath: (page.referrer_type ?? 'version') === 'version' ? `/lp/${encodeURIComponent(abTest.uid)}` : null,
    headTags: tagsFor('head'),
    bodyTags: tagsFor('body'),
    noindex: bulkTags.some((b) => b.noindex),
  })
  // 設定の変更はすぐ反映すべきなのでキャッシュしない（配信ページと同じ）
  res.set('Cache-Control', 'no-cache')
  res.type('html').send(html)
})
