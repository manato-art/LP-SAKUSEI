/**
 * beyondページの複製（2026-09-24・ページ一覧「…」の beyondページ複製 / 別フォルダへ複製）。
 *
 * 写すもの: ページの設定・ステップ（記事）・Version（HTML/CSS・配信割合・出し分けの設定）・
 *           ステップごとのHTML設定（noindex とタグ）。どれも新しい id / uid を振る。
 * 写さないもの: 数字（PV・クリック・CV・ヒートマップ・表示の遅さ・ボット件数）・届いたCV・
 *           Meta広告の紐付け（同じ広告の実績が2ページに入るため）・計測タグが知らせた外部LPの所在・
 *           配信の切り替え予約・ポップアップ・中間ページ（今回の依頼の範囲外）。
 * 配信ステータスは「準備中」、Versionの状態は「準備中」から始める（新しく作ったページと同じ）。
 */
import { freshUid, nowTs } from './actions-shared.ts'
import { makeAbTestUid, makeUid } from './ids.ts'
import type { AbTest, Article, ArticleHtmlSetting, State, Version } from './types.ts'

/** 基本情報のページ名の上限（ab-test-patch.ts と同じ）。複製の名前もこれに収める */
const TITLE_MAX_LENGTH = 50
const COPY_SUFFIX = 'のコピー'

export function copyTitle(title: string): string {
  const room = TITLE_MAX_LENGTH - COPY_SUFFIX.length
  return `${[...title].slice(0, room).join('')}${COPY_SUFFIX}`
}

export function duplicateAbTest(
  state: State,
  uid: string,
  folderId: number | null,
): { state: State; abTest: AbTest } | null {
  const source = state.abTests.find((t) => t.uid === uid)
  if (source === undefined) return null
  let nextId = state.nextId
  const takeId = (): number => {
    const id = nextId
    nextId += 1
    return id
  }

  const abTestId = takeId()
  // Meta広告の紐付けと外部LPの所在は写さない（残りはそのまま）
  const { meta_level: _metaLevel, meta_object_id: _metaObjectId, external_url: _externalUrl, ...settings } = source
  const abTest: AbTest = {
    ...settings,
    id: abTestId,
    uid: freshUid(state.abTests, abTestId, makeAbTestUid),
    title: copyTitle(source.title),
    folder_id: folderId,
    ad_status: 'prepared',
    conversion_setting: { ...source.conversion_setting, id: abTestId },
    created_at: nowTs(),
    updated_at: nowTs(),
  }

  const sourceArticles = state.articles.filter((a) => a.ab_test_id === source.id)
  const articles: Article[] = []
  const versions: Version[] = []
  const htmlTags: ArticleHtmlSetting[] = []
  for (const sourceArticle of sourceArticles) {
    const articleId = takeId()
    const article: Article = {
      ...sourceArticle,
      id: articleId,
      uid: freshUid([...state.articles, ...articles], articleId, (n) => makeUid('article', n)),
      ab_test_id: abTestId,
      created_at: nowTs(),
      updated_timestamp: Date.now(),
    }
    articles.push(article)
    for (const sourceVersion of state.versions.filter((v) => v.article_id === sourceArticle.id)) {
      const versionId = takeId()
      versions.push({
        ...sourceVersion,
        id: versionId,
        uid: freshUid([...state.versions, ...versions], versionId, (n) => makeUid('version', n)),
        article_id: articleId,
        status: '準備中',
        created_at: nowTs(),
        updated_at: nowTs(),
      })
    }
    const setting = state.htmlTags.find((h) => h.article_uid === sourceArticle.uid)
    if (setting !== undefined) htmlTags.push({ ...setting, article_uid: article.uid })
  }

  return {
    state: {
      ...state,
      abTests: [...state.abTests, abTest],
      articles: [...state.articles, ...articles],
      versions: [...state.versions, ...versions],
      htmlTags: [...state.htmlTags, ...htmlTags],
      folders: state.folders.map((f) =>
        f.id === folderId ? { ...f, ab_tests_count: f.ab_tests_count + 1 } : f,
      ),
      nextId,
    },
    abTest,
  }
}
