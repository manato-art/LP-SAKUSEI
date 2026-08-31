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
import { T, button, el, emptyState, toast } from './ui.ts'
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
  const { content } = mountShell()
  content.innerHTML = ''
  const raw = location.hash.replace(/^#/, '') || '/folders'
  const [path, query] = raw.split('?')
  const params = new URLSearchParams(query ?? '')
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
    renderNotBuilt(content, path ?? '')
  } catch (error) {
    content.innerHTML = ''
    content.append(
      emptyState(`読み込みに失敗しました: ${(error as Error).message}`),
    )
  }
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

/** 開発用の操作パネル（リセット等）。実機には無いのでクローン側の道具として明示する。 */
function devPanel(): void {
  const panel = el('div', {
    style: `position:fixed;right:10px;bottom:10px;z-index:8000;background:#151515;color:#fff;
      font-family:${T.font};font-size:11px;padding:8px 10px;border-radius:6px;display:flex;gap:8px;align-items:center`,
  })
  const reset = el('button', {
    text: '空の状態に戻す',
    style: 'background:#333;color:#fff;border:1px solid #555;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:11px',
  })
  reset.addEventListener('click', async () => {
    await api.reset()
    toast('新規アカウント発行直後の状態に戻しました')
    location.hash = '/folders'
    await route()
  })
  panel.append(el('span', { text: 'クローン（モックデータ）' }), reset)
  document.body.append(panel)
}

addEventListener('hashchange', () => void route())
void route().then(devPanel)
