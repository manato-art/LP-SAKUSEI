/**
 * マジック置換のAPI（実SB「ツール > マジック置換」= /articles/bulk_replaces）。
 *
 * 実物の画面は3ペイン:
 *   左   … 置換対象のフォルダ／beyondページを選ぶツリー
 *   中央 … 選んだページで見つかった置換対象の一覧（画像 / テキスト / リンク）
 *   右   … 新しい値と「置換する」
 *
 * ここは中央と右に対応する2本だけを持つ。左のツリーは既存の
 * フォルダ／beyondページのAPIで足りるので足さない。
 *
 * 置換の中身は `store/bulk-replace.ts` の純粋関数（テスト済み）に任せ、
 * ここは「どのVersionを対象にするか」と「Stateへの書き戻し」だけを見る。
 */
import { Router } from 'express'
import { getState, setState } from '../store/store.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { str } from '../lib/query.ts'
import {
  findImageTargets,
  findLinkTargets,
  findTextTargets,
  replaceImage,
  replaceLink,
  replaceText,
  type TrackingMode,
} from '../store/bulk-replace.ts'
import type { State, Version } from '../store/types.ts'
import { externalizeDataUrls } from '../lib/uploads.ts'

export const bulkReplaceRouter: Router = Router()

type Kind = 'image' | 'text' | 'link'

function isKind(v: string): v is Kind {
  return v === 'image' || v === 'text' || v === 'link'
}

function isTrackingMode(v: string): v is TrackingMode {
  return v === 'on' || v === 'keep' || v === 'off'
}

/**
 * 置換の対象にするVersion。
 *
 * アーカイブ済みは配信されないので触らない（実物も一覧に出ない）。
 * 記事（ファネルステップ）は全部見る＝そのbeyondページの本文すべてが対象。
 */
function versionsOf(state: State, abTestUid: string): Version[] {
  const abTest = state.abTests.find((t) => t.uid === abTestUid)
  if (abTest === undefined) return []
  const articleIds = new Set(
    state.articles.filter((a) => a.ab_test_id === abTest.id && !a.archived).map((a) => a.id),
  )
  return state.versions.filter((v) => articleIds.has(v.article_id) && !v.archived)
}

interface Row {
  /** 置換のときにこの行を指すための値（画像/リンクはURL、テキストは検索語） */
  value: string
  /** 画面に出す文字（テキストは前後の文脈） */
  label: string
  count: number
  version_uid: string
  version_name: string
  /** リンクのみ: 計測機能が付いているか */
  tracking?: boolean
  /** テキストのみ: そのVersion内で何番目の一致か */
  text_index?: number
}

function rowsFor(version: Version, kind: Kind, query: string): Row[] {
  const base = { version_uid: version.uid, version_name: version.name }
  if (kind === 'image') {
    return findImageTargets(version.html).map((t) => ({
      ...base,
      value: t.url,
      label: t.url,
      count: t.count,
    }))
  }
  if (kind === 'link') {
    return findLinkTargets(version.html).map((t) => ({
      ...base,
      value: t.url,
      label: t.url,
      count: t.count,
      tracking: t.tracking,
    }))
  }
  return findTextTargets(version.html, query).map((t) => ({
    ...base,
    value: query,
    label: t.context,
    count: 1,
    text_index: t.index,
  }))
}

/**
 * 中央ペインの一覧。
 *
 * 実物はページを選ぶと出る。テキストだけは先に検索語が要る
 * （語が無いと本文全部が対象になってしまうため、実物もページを選べない）。
 */
bulkReplaceRouter.get('/articles/bulk_replaces/targets', (req, res) => {
  const kind = str(req.query, 'kind') ?? 'image'
  if (!isKind(kind)) {
    res.status(422).json(errorEnvelope('invalid', '種別は画像・テキスト・リンクのいずれかです。'))
    return
  }
  const query = str(req.query, 'q') ?? ''
  if (kind === 'text' && query === '') {
    res.json({ pages: [], message: '置換対象文字列を検索してください' })
    return
  }
  const uids = (str(req.query, 'ab_test_uids') ?? '').split(',').filter((u) => u !== '')
  const state = getState()
  const pages = uids.map((uid) => {
    const abTest = state.abTests.find((t) => t.uid === uid)
    return {
      ab_test_uid: uid,
      title: abTest?.title ?? '',
      rows: versionsOf(state, uid).flatMap((v) => rowsFor(v, kind, query)),
    }
  })
  res.json({ pages })
})

interface ReplaceTarget {
  version_uid: string
  value: string
  /** テキストのみ: 置換する一致の番号。省略時はそのVersionの全部 */
  indexes?: number[]
}

/** 「置換する」。対象のVersionのHTMLを書き換え、置き換えた数を返す。 */
bulkReplaceRouter.post('/articles/bulk_replaces', (req, res) => {
  const body = (req.body ?? {}) as {
    kind?: unknown
    targets?: unknown
    replacement?: unknown
    tracking?: unknown
  }
  const kind = typeof body.kind === 'string' ? body.kind : ''
  if (!isKind(kind)) {
    res.status(422).json(errorEnvelope('invalid', '種別は画像・テキスト・リンクのいずれかです。'))
    return
  }
  const rawReplacement = typeof body.replacement === 'string' ? body.replacement : ''
  // 新しい画像が埋め込み（data URL）なら、別ファイルにしてからそのURLで置き換える
  const replacement = kind === 'image' ? externalizeDataUrls(rawReplacement).text : rawReplacement
  if (replacement === '') {
    const what = kind === 'image' ? '新しい画像' : kind === 'link' ? '新しいリンク' : '新しい文字列'
    res.status(422).json(errorEnvelope('invalid', `${what}を指定してください。`))
    return
  }
  const targets = (Array.isArray(body.targets) ? body.targets : []) as ReplaceTarget[]
  if (targets.length === 0) {
    res.status(422).json(errorEnvelope('invalid', '置換対象を選択してください。'))
    return
  }
  const tracking = typeof body.tracking === 'string' && isTrackingMode(body.tracking)
    ? body.tracking
    : 'keep'

  let replaced = 0
  const touched = new Set<string>()
  setState((s) => ({
    ...s,
    versions: s.versions.map((v) => {
      const mine = targets.filter((t) => t.version_uid === v.uid)
      if (mine.length === 0) return v
      let html = v.html
      for (const t of mine) {
        const out =
          kind === 'image'
            ? replaceImage(html, t.value, replacement)
            : kind === 'link'
              ? replaceLink(html, t.value, replacement, tracking)
              : replaceText(html, t.value, replacement, t.indexes)
        html = out.html
        replaced += out.replaced
      }
      if (html === v.html) return v
      touched.add(v.uid)
      return { ...v, html }
    }),
  }))

  res.json({ replaced, versions: touched.size })
})
