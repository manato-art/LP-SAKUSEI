/**
 * クローンのエントリ（企画書 §1-4 の基準状態＝新規アカウントの空状態から始まる）。
 * データはすべてローカルのモックAPIから供給される（§3-2・localhost固定）。
 */
import { markActiveNav, mountShell } from './shell.ts'
import { renderFolders } from './pages/folders.ts'
import { renderEditor } from './pages/editor.ts'
import { renderBasicInfo } from './pages/basic-info.ts'
import { renderExitPopup } from './pages/exit-popup.ts'
import { renderReport } from './pages/report.ts'
import { renderHeatmap } from './pages/heatmap.ts'
import { renderSplitTestSettings } from './pages/split-test-settings.ts'
import { renderRedirectPages } from './pages/redirect-pages.ts'
import { renderPreview } from './pages/preview-page.ts'
// 指示124: 拡張機能は撤去 — import 削除
// import { renderAddon } from './pages/addon.ts'
import { renderTasks } from './pages/tasks.ts'
import { renderSbAi } from './pages/sb-ai.ts'
import { renderExternalIntegration } from './pages/external-integration.ts'
import { renderCvTracking } from './pages/cv-tracking-page.ts'
import {
  renderDashboard,
  renderConversions,
  renderDomains,
  renderReportExclusions,
  renderRankings,
  renderSeminarPage,
} from './pages/sidebar-data.ts'
import { renderAccountSettings } from './pages/account-settings.ts'
import { matchSidebarPage } from './pages/sidebar-nav.ts'
import { matchToolPage } from './pages/tool-subnav.ts'
import { renderToolPage } from './pages/tool-pages.ts'
import { isSplitTestTab } from './pages/beyond-nav.ts'
import { T, button, el, emptyState } from './ui.ts'
import { api } from './api.ts'

/**
 * 描画の世代。ルートの描画はAPI待ちを含むため、
 * 連続で呼ばれると**古い描画が後から追記して二重表示**になる（実際にこのバグを踏んだ）。
 * 各描画は自分の世代が最新かを確認してからDOMに書き込む。
 */
let renderGeneration = 0

export function currentGeneration(): number {
  return renderGeneration
}

export function isStale(generation: number): boolean {
  return generation !== renderGeneration
}

async function route(): Promise<void> {
  renderGeneration += 1
  const generation = renderGeneration
  const raw = location.hash.replace(/^#/, '') || '/folders'
  const [path, query] = raw.split('?')
  const params = new URLSearchParams(query ?? '')

  // 旧・配信URL（ハッシュルート `/#/ab/:uid`）。配信URLの実体は今は実パス `/lp/:uid`
  // （サーバー側でSSR配信・§10-1）に移した。既存のリンクも引き続き開けるよう、
  // ここへ来たら実パスへリダイレクトするだけにする（SPA側では何も描かない）。
  const deliveryMatch = /^\/ab\/([^/]+)$/.exec(path ?? '')
  if (deliveryMatch !== null) {
    const uid = deliveryMatch[1] as string
    location.replace(`/lp/${uid}${query !== undefined && query !== '' ? `?${query}` : ''}`)
    return
  }

  const { content } = mountShell()
  content.innerHTML = ''
  // 前のページが設定したスタイルをリセット（エディタは overflow:hidden / height:100vh を設定する）
  content.style.cssText = 'flex:1;min-width:0'
  // エディタのミニマップはページ遷移で残る可能性がある。除去する。
  for (const orphan of document.querySelectorAll('[data-clone-minimap]')) orphan.remove()
  markActiveNav(path ?? '')

  try {
    const editorMatch = /^\/ab_tests\/([^/]+)\/articles$/.exec(path ?? '')
    if (editorMatch !== null) {
      await renderEditor(content, editorMatch[1] as string, generation)
      return
    }
    /**
     * ヒートマップ比較。レポートタブのサブナビから来る。
     * `/articles/...` で始まるので、上のエディタ用パターンより先に判定する必要はないが、
     * ポップアップと同じく `articles` 配下なので並べて置く。
     */
    const heatmapMatch = /^\/ab_tests\/([^/]+)\/articles\/htmls\/heatmaps\/comparisons$/.exec(
      path ?? '',
    )
    if (heatmapMatch !== null) {
      await renderHeatmap(content, heatmapMatch[1] as string, generation)
      return
    }
    /**
     * Versionオプション設定（Version出し分け）。エディタ上部右の2番目のアイコンから。
     * 6タブ（devices/params/hours/periods/oses/carriers）を末尾セグメントで受ける。
     * `/articles/` 配下だが末尾が固定なので、エディタ用パターンとは衝突しない。
     */
    const splitTestMatch =
      /^\/ab_tests\/([^/]+)\/articles\/split_test_settings\/([^/]+)$/.exec(path ?? '')
    if (splitTestMatch !== null) {
      const tab = splitTestMatch[2] as string
      // 未知のタブは推測で埋めず「未作成」へ落とす（採取した6タブ以外は再現できない）
      if (isSplitTestTab(tab)) {
        await renderSplitTestSettings(content, splitTestMatch[1] as string, tab, generation)
        return
      }
      renderNotBuilt(content, path ?? '')
      return
    }
    /**
     * プレビュー画面。右レール「プレビュー」から**新しいタブ**で開く実ルート
     * `/ab_tests/:abTestUid/articles/:stepUid/previews`（末尾 previews で固定）。
     * エディタ用パターン（末尾 articles）とは衝突しない。
     */
    const previewMatch =
      /^\/ab_tests\/([^/]+)\/articles\/([^/]+)\/previews$/.exec(path ?? '')
    if (previewMatch !== null) {
      await renderPreview(
        content,
        previewMatch[1] as string,
        previewMatch[2] as string,
        generation,
      )
      return
    }
    /**
     * プレビュー画面（短縮URL）。エディタの「プレビュー」ボタンや比較モードのURLで
     * `/preview/:versionUid` 形式のURLが生成される。version uid → ab_test を逆引きして
     * 既存の renderPreview に委譲する。
     */
    const shortPreviewMatch = /^\/preview\/([^/]+)$/.exec(path ?? '')
    if (shortPreviewMatch !== null) {
      const versionUid = shortPreviewMatch[1] as string
      const resolved = await resolveAbTestFromVersion(versionUid)
      if (resolved !== null) {
        await renderPreview(content, resolved, versionUid, generation)
      } else {
        renderNotBuilt(content, path ?? '')
      }
      return
    }
    // 中間ページ（redirect_pages）。エディタ上部右の3番目のアイコンから。
    const redirectMatch =
      /^\/folders\/([^/]+)\/ab_tests\/([^/]+)\/redirect_pages$/.exec(path ?? '')
    if (redirectMatch !== null) {
      await renderRedirectPages(
        content,
        { folderUid: redirectMatch[1] as string, abTestUid: redirectMatch[2] as string },
        generation,
      )
      return
    }
    // レポートタブ（4タブの4つ目）。ここだけダークテーマ。
    const reportMatch = /^\/ab_tests\/([^/]+)\/reports$/.exec(path ?? '')
    if (reportMatch !== null) {
      await renderReport(content, reportMatch[1] as string, params, generation)
      return
    }
    // ポップアップタブ（4タブの3つ目）。実物は「離脱防止機能が未契約」のアップセル画面。
    const exitPopupMatch = /^\/ab_tests\/([^/]+)\/articles\/exit_popups$/.exec(path ?? '')
    if (exitPopupMatch !== null) {
      await renderExitPopup(content, exitPopupMatch[1] as string, generation)
      return
    }
    // 基本情報タブ（beyondページの4タブの1つ目）
    const basicInfoMatch = /^\/folders\/([^/]+)\/ab_tests\/([^/]+)\/edit$/.exec(path ?? '')
    if (basicInfoMatch !== null) {
      await renderBasicInfo(
        content,
        { folderUid: basicInfoMatch[1] as string, abTestUid: basicInfoMatch[2] as string },
        generation,
      )
      return
    }
    if (path === '/folders') {
      await renderFolders(content, params, generation)
      return
    }
    // サイドバー3画面（拡張機能 / タスク / AI）。固定パスなので純粋関数で解決する。
    // どれもモックAPI不要（カタログ・空状態・チャットUIの土台をそのまま描く）。
    const sidebarPage = matchSidebarPage(path ?? '')
    // 指示124: 拡張機能は撤去 — ルーティング削除
    // if (sidebarPage === 'addon') { renderAddon(content); return }
    if (sidebarPage === 'tasks') {
      renderTasks(content)
      return
    }
    if (sidebarPage === 'sb_ai') {
      renderSbAi(content)
      return
    }
    if (sidebarPage === 'external') {
      await renderExternalIntegration(content, generation)
      return
    }
    // 外部連携 > CV計測連携（/teams/asp_accounts）
    if (path === '/teams/asp_accounts') {
      renderCvTracking(content)
      return
    }
    if (sidebarPage === 'dashboard') {
      await renderDashboard(content)
      return
    }
    if (sidebarPage === 'conversions') {
      await renderConversions(content)
      return
    }
    if (sidebarPage === 'domains') {
      await renderDomains(content)
      return
    }
    if (sidebarPage === 'report_exclusions') {
      await renderReportExclusions(content)
      return
    }
    if (sidebarPage === 'rankings') {
      await renderRankings(content)
      return
    }
    if (sidebarPage === 'seminar') {
      renderSeminarPage(content)
      return
    }
    if (sidebarPage === 'account_settings') {
      await renderAccountSettings(content)
      return
    }
    // /tools → 最初のツールサブページへリダイレクト（旧リンクの互換性）
    if (path === '/tools') {
      location.hash = '/teams/tags'
      return
    }
    /**
     * ツール5画面（一括タグ / マジック置換 / メディア / 審査 / フォーム）。
     * 共通サブナビを持つアコーディオンの各サブページ。どれも固定パスで、
     * モックAPI不要（採取した実DOMの土台＋空/枠だけ描画）。純粋関数で解決する。
     */
    const toolPage = matchToolPage(path ?? '')
    if (toolPage !== null) {
      renderToolPage(toolPage, content)
      return
    }
    renderNotBuilt(content, path ?? '')
  } catch (error) {
    content.innerHTML = ''
    content.append(
      emptyState(`読み込みに失敗しました: ${(error as Error).message}`),
    )
  }
}

/**
 * version uid → abTest uid を逆引きする。
 * モック環境なのでデータ量は少ない。見つからなければ null。
 */
async function resolveAbTestFromVersion(versionUid: string): Promise<string | null> {
  const { ab_tests } = await api.abTests()
  for (const at of ab_tests) {
    const { articles } = await api.articles(at.uid)
    for (const art of articles) {
      const { versions } = await api.versions(art.uid)
      if (versions.some((v) => v.uid === versionUid)) return at.uid
    }
  }
  return null
}

/** まだ作っていない画面は、正直にそう表示する（できているように見せない） */
function renderNotBuilt(content: HTMLElement, path: string): void {
  content.innerHTML = ''
  const goFolders = button('ページ画面へ')
  goFolders.addEventListener('click', () => {
    location.hash = '/folders'
  })
  content.append(
    el('div', { style: `padding:60px 40px;font-family:${T.font}` }, [
      el('div', { text: path, style: `font-family:monospace;font-size:12px;color:${T.sub};margin-bottom:10px` }),
      el('strong', { text: 'この画面はまだ作っていません', style: 'display:block;font-size:16px;margin-bottom:10px' }),
      el('div', {
        text: '今は「フォルダ作成 → beyondページ作成 → LPエディタ」の作成フローを先に作っています。',
        style: `font-size:13px;color:${T.sub};line-height:1.9;margin-bottom:20px`,
      }),
      goFolders,
    ]),
  )
}

addEventListener('hashchange', () => void route())
void route()
