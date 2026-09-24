/**
 * 比較モードの「更新履歴・復元」タブ（2026-09-24 全体点検17: 「更新履歴・復元は準備中です」と出るだけだった）。
 *
 * 左に今のVersionの変更・復元履歴（日時と何をしたか）、右にその時点の見た目（プレビューと同じ組み立て）を出し、
 * 「この時点に戻す」で戻せる。戻す仕組みは右の「履歴」パネルと同じAPI（Versionごと・点検3）。
 */
import { confirmCard } from '../dialog.ts'
import { toast } from '../ui.ts'
import { fetchArticleHistories, recordArticleHistory, restoreArticleHistory, type ArticleHistoryRow } from './history.ts'
import { editorSessionHeaders } from '../editor-session.ts'
import { showInFrame } from './compare-preview-doc.ts'

export interface CompareHistoryDeps {
  readonly articleUid: string
  readonly getVersionUid: () => string
  /** いまの本文（戻す前に履歴へ残す） */
  readonly getCurrentHtml: () => string
  /** 戻した中身をエディタへ入れる（サーバーは保存済み） */
  readonly applyRestored: (html: string, version: { uid: string; content_revision?: number }) => void
}

/** 右の見た目を作る（比較モードのスマホ枠。iframe に中身を入れる関数を渡す） */
export type PhoneBuilder = (fill: (iframe: HTMLIFrameElement) => void) => HTMLElement

async function snapshotHtml(articleUid: string, id: number, versionUid: string): Promise<string> {
  const res = await fetch(
    `/api/v1/articles/${encodeURIComponent(articleUid)}/histories/${String(id)}?version_uid=${encodeURIComponent(versionUid)}`,
    { headers: editorSessionHeaders() },
  )
  const json = (await res.json().catch(() => null)) as { history?: { html?: string }; error?: { message?: string } } | null
  if (!res.ok || typeof json?.history?.html !== 'string') throw new Error(json?.error?.message ?? '履歴を読めませんでした')
  return json.history.html
}

export function renderHistoryTab(container: HTMLElement, deps: CompareHistoryDeps, buildPhone: PhoneBuilder, phoneArea: HTMLElement): void {
  const layout = document.createElement('div')
  layout.className = 'sb-cmp-ov-layout'
  const listCol = document.createElement('div')
  listCol.className = 'sb-cmp-ov-list'
  listCol.setAttribute('data-cmp-history-list', 'true')
  const previewCol = document.createElement('div')
  previewCol.className = 'sb-cmp-ov-preview'
  const actions = document.createElement('div')
  actions.style.cssText = 'display:flex;justify-content:flex-end;padding:6px 8px'
  const restoreBtn = document.createElement('button')
  restoreBtn.type = 'button'
  restoreBtn.textContent = 'この時点に戻す'
  restoreBtn.disabled = true
  restoreBtn.style.cssText =
    'padding:6px 14px;border:none;border-radius:6px;background:var(--sb-accent, #0091FF);color:#fff;font-size:12px;font-weight:700;cursor:pointer'
  actions.append(restoreBtn)
  previewCol.append(actions, phoneArea)
  layout.append(listCol, previewCol)
  container.append(layout)

  const versionUid = deps.getVersionUid()
  let selected: ArticleHistoryRow | null = null

  const show = (row: ArticleHistoryRow): void => {
    selected = row
    restoreBtn.disabled = row.is_current
    restoreBtn.style.opacity = row.is_current ? '0.4' : ''
    restoreBtn.title = row.is_current ? 'いまの状態です' : ''
    for (const el of listCol.querySelectorAll<HTMLElement>('[data-history-id]')) {
      el.classList.toggle('active', el.dataset['historyId'] === String(row.id))
    }
    phoneArea.replaceChildren(
      buildPhone((iframe) => {
        void snapshotHtml(deps.articleUid, row.id, versionUid).then(
          (html) => showInFrame(iframe, versionUid, html),
          (error: Error) => toast(error.message, 'error'),
        )
      }),
    )
  }

  const draw = (rows: readonly ArticleHistoryRow[]): void => {
    listCol.innerHTML = ''
    if (rows.length === 0) {
      listCol.textContent = 'まだ履歴がありません'
      return
    }
    for (const row of rows) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'sb-cmp-ov-card'
      item.dataset['historyId'] = String(row.id)
      const date = document.createElement('div')
      date.className = 'sb-cmp-ov-name'
      date.textContent = row.recorded_at_label
      const label = document.createElement('div')
      label.className = 'sb-cmp-ov-ratio'
      label.textContent = row.is_current ? `現行版${row.label !== undefined && row.label !== '' ? `（${row.label}）` : ''}` : (row.label ?? '')
      item.append(date, label)
      item.addEventListener('click', () => show(row))
      listCol.append(item)
    }
    const first = rows[0]
    if (first !== undefined) show(first)
  }

  const load = (): void => {
    void fetchArticleHistories(deps.articleUid, versionUid).then(
      ({ histories }) => draw(histories),
      (error: Error) => {
        listCol.textContent = `履歴を読めませんでした: ${error.message}`
      },
    )
  }

  restoreBtn.addEventListener('click', () => {
    const row = selected
    if (row === null || row.is_current) return
    void confirmCard({
      title: 'この時点に戻しますか？',
      message: `${row.recorded_at_label} の状態に戻します。`,
      detail: '今の状態も履歴に残るので、あとから戻し直せます。',
      submitLabel: '戻す',
    }).then(async (ok) => {
      if (!ok) return
      try {
        // 戻す前に、まだ履歴に無い今の本文を残す（「あとから戻し直せます」を本当にする）
        await recordArticleHistory(deps.articleUid, deps.getCurrentHtml(), versionUid)
        const restored = await restoreArticleHistory(deps.articleUid, row.id, versionUid)
        deps.applyRestored(restored.html, restored.version)
        toast('選んだ時点に戻しました')
        load()
      } catch (error) {
        toast((error as Error).message, 'error')
      }
    })
  })

  load()
}
