/**
 * クローンのエントリ（企画書 §1-4 の基準状態＝新規アカウントの空状態から始まる）。
 * データはすべてローカルのモックAPIから供給される（§3-2・localhost固定）。
 */
import { closeComparePanel } from './panels/compare-mode.ts'
import { markActiveNav, mountShell } from './shell.ts'
import { initAccent } from './theme-color.ts'
import { initThemeMode, isThemeMode } from './theme-mode.ts'
import { renderReportExclusions } from './pages/report-exclusions.ts'
import { renderFolders } from './pages/folders.ts'
import { isMobileViewport } from './mobile/viewport.ts'
import { applyMobileEditor, teardownMobileEditor } from './mobile/editor-mobile.ts'
import { renderMobileFolders, renderMobilePages } from './mobile/pages-mobile.ts'
import { renderEditor } from './pages/editor.ts'
import { renderBasicInfo } from './pages/basic-info.ts'
import { renderExitPopup } from './pages/exit-popup.ts'
import { renderReport } from './pages/report.ts'
import { renderHeatmap } from './pages/heatmap.ts'
import { renderSplitTestSettings } from './pages/split-test-settings.ts'
import { renderRedirectPages } from './pages/redirect-pages.ts'
// 指示124: 拡張機能は撤去 — import 削除
// import { renderAddon } from './pages/addon.ts'
import { renderTasks } from './pages/tasks.ts'
import { renderSbAi } from './pages/sb-ai.ts'
import { renderExternalIntegration } from './pages/external-integration.ts'
import { renderCvTracking } from './pages/cv-tracking-page.ts'
import { renderDashboard } from './pages/dashboard-page.ts'
import {
  renderConversions,
  renderDomains,
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
import { isCreator, loadSession } from './session.ts'
import { startSaveStatusWatch } from './save-status-banner.ts'
import { isCreatorRoute } from './creator-ui.ts'
import { startPageLife } from './page-life.ts'

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
  // 前の画面の、画面全体への見張り・タイマーを外す（外さないと前の画面が丸ごとメモリに残る・2026-10-25）
  startPageLife()
  // 画面が変わったら、エディタ用に開いていたパネルの合図を消す
  teardownMobileEditor()
  // 比較モードは body 直下に出すので、ほかの画面へ移ったら閉じる（残っていた・2026-09-24 点検17）
  closeComparePanel()
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

  // LP作成者は、LPづくりの画面だけ（サーバーでも同じ範囲で断っている・creator-ui.ts）
  if (isCreator() && !isCreatorRoute(path ?? '')) {
    renderCreatorBlocked(content)
    return
  }

  try {
    const editorMatch = /^\/ab_tests\/([^/]+)\/articles$/.exec(path ?? '')
    if (editorMatch !== null) {
      await renderEditor(content, editorMatch[1] as string, generation)
      // スマホはキャンバスが潰れるので、Version一覧とプロパティをしまってボタンで出す
      if (isMobileViewport()) applyMobileEditor(content)
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
      // スマホは3ペインが入らないので、1画面ずつの作りに差し替える（2026-09-13）
      if (isMobileViewport()) {
        const folderUid = params.get('uid')
        if (folderUid === null) await renderMobileFolders(content)
        else await renderMobilePages(content, folderUid)
        return
      }
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
    // 通知の設定（実物の /settings/internal_notifications/member・CV速報の「通知設定」から来る）
    if (path === '/settings/internal_notifications/member' || path === '/settings/internal_notifications/team') {
      await renderAccountSettings(content, '通知設定')
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
     * ツール4画面（一括タグ / マジック置換 / メディア / 審査）。
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
 * 行き先の無いURL（打ち間違い・古いリンク・まだ用意していない画面）は、正直にそう表示する（できているように見せない）。
 * 文は使う人向けに書く（作っている途中の事情は出さない・2026-10-13）。
 */
function renderNotBuilt(content: HTMLElement, path: string): void {
  content.innerHTML = ''
  const goFolders = button('ページ画面へ')
  goFolders.addEventListener('click', () => {
    location.hash = '/folders'
  })
  content.append(
    el('div', { style: `padding:60px 40px;font-family:${T.font}` }, [
      el('div', { text: path, style: `font-family:monospace;font-size:12px;color:${T.sub};margin-bottom:10px` }),
      el('strong', { text: 'この画面は見つかりません', style: 'display:block;font-size:16px;margin-bottom:10px' }),
      el('div', {
        text: 'URLが変わったか、まだ用意されていない画面です。下のボタンからページ画面へ戻れます。',
        style: `font-size:13px;color:${T.sub};line-height:1.9;margin-bottom:20px`,
      }),
      goFolders,
    ]),
  )
}

/** LP作成者のアカウントで、使えない画面を開いたとき */
function renderCreatorBlocked(content: HTMLElement): void {
  content.innerHTML = ''
  const goFolders = button('ページ画面へ')
  goFolders.addEventListener('click', () => {
    location.hash = '/folders'
  })
  content.append(
    el('div', { style: `padding:60px 40px;font-family:${T.font}` }, [
      el('strong', { text: 'この画面はLP作成者のアカウントでは使えません', style: 'display:block;font-size:16px;margin-bottom:10px' }),
      el('div', {
        text: 'LP作成者のアカウントで使えるのは、ページの作成とLPづくり（Version・離脱防止ポップ・中間ページ・切り替え・基本情報）です。',
        style: `font-size:13px;color:${T.sub};line-height:1.9;margin-bottom:20px`,
      }),
      goFolders,
    ]),
  )
}

/**
 * テーマカラーは描画より先に当てる。
 * 後から当てると、既定色の画面が一瞬見えてから切り替わる。
 */
initAccent(async () => {
  try {
    const { accent } = await api.themeColor()
    return accent
  } catch {
    // 未ログイン等で取れなくても、覚えている色で動く
    return null
  }
})

/** ライト／ダークも描画より先に当てる（ライトの画面が一瞬見えてから暗くなるのを防ぐ） */
initThemeMode(async () => {
  try {
    const { mode } = await api.themeColor()
    return isThemeMode(mode) ? mode : null
  } catch {
    return null
  }
})

// 誰がログインしているか（管理者 / LP作成者）を読んでから最初の画面を描く
void loadSession().then(() => {
  addEventListener('hashchange', () => void route())
  void route()
  // 数字の保存に失敗していたら、いちばん上に赤い帯を出す（2026-10-29・LP作成者は保存の窓口を使えないので管理者だけ）
  if (!isCreator()) startSaveStatusWatch()
})
