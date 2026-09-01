/**
 * デモ用シード（任意・環境変数 `SEED_DEMO=1` のときだけ使う）。
 *
 * 既定は「まっさら（seed-empty）」のままにし、テストや検証の前提を変えない。
 * 公開デモ（Railway）でだけ、**架空の**フォルダ／ABテスト／Versionを1件ずつ用意して、
 * エディタを含む各画面を「到達できる」状態にする。
 *
 * ここで作る値はすべて完全に架空（実ユーザー・実データと無関係・§3-1）。
 * 実データを持ち込まない大前提を守るため、内容はプレースホルダのLPに限る。
 * 生成はモック本体の作成アクション（createFolder / createAbTest / addVersion）を
 * そのまま使い、手でState構造を組み立てない＝関係やIDの整合を崩さない。
 */
import { addVersion, createAbTest, createFolder, updateVersion } from './actions.ts'
import { createEmptyState } from './seed-empty.ts'
import type { State } from './types.ts'

/** A/Bが見て分かるよう、2つのVersionに別々のプレースホルダ本文を入れる（架空） */
const DEMO_HTML_A =
  '<h1>サンプルLP・パターンA</h1>' +
  '<p>これはクローンのデモ用に用意した架空のランディングページです。</p>' +
  '<p>右のツールバーやVersion設定（記事設定）を実際に操作できます。</p>' +
  '<p><a href="#">お申し込みはこちら</a></p>'

const DEMO_HTML_B =
  '<h1>サンプルLP・パターンB</h1>' +
  '<p>パターンBは見出しと訴求を変えた比較用のダミーです。</p>' +
  '<p>Versionを切り替えると本文が入れ替わります。</p>' +
  '<p><a href="#">今すぐ試す</a></p>'

export function createDemoState(): State {
  let state = createEmptyState()

  // 1) フォルダ（架空）
  const folderResult = createFolder(state, { name: 'サンプルフォルダ', parent_id: null })
  state = folderResult.state
  const folder = folderResult.folder

  // 2) ABテスト（＝記事＋初期Versionが一緒に作られる）
  const abResult = createAbTest(state, {
    title: 'サンプルLP',
    memo: '',
    folder_id: folder.id,
    media_id: null,
  })
  state = abResult.state
  const article = abResult.article
  const versionA = abResult.version

  // 3) 2本目のVersion（A/B比較が見えるように）
  const addResult = addVersion(state, article.uid)
  state = addResult.state
  const versionB = addResult.version

  // 4) それぞれに架空の本文と配信割合（50/50）を入れる
  // createAbTest が作る初期Versionが既にコントロール。ここでは本文と割合だけ入れる。
  state = updateVersion(state, versionA.uid, {
    html: DEMO_HTML_A,
    distribution_ratio: 50,
  }).state
  if (versionB !== null) {
    state = updateVersion(state, versionB.uid, {
      html: DEMO_HTML_B,
      distribution_ratio: 50,
    }).state
  }

  return state
}
