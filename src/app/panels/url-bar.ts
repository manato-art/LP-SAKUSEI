/**
 * URLコピーバー（コンテンツツールバーの代替）。
 *
 * 検証用URLと本番用URLをワンクリックでコピーできるバーを
 * キャンバス上部に表示する。旧コンテンツツールバーの位置に挿入する。
 */
import { toast } from '../ui.ts'

/* ── SVG ── */

const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`

/* ── CSS ── */

function injectStyles(): void {
  if (document.getElementById('sb-url-bar-css') !== null) return
  const s = document.createElement('style')
  s.id = 'sb-url-bar-css'
  s.textContent = `
    .sb-url-bar {
      display:flex; align-items:center; gap:8px; padding:0 12px;
      background:#fff; border-bottom:1px solid #e5e5ea; flex-shrink:0;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
      font-size:13px; user-select:none; min-height:40px; height:40px;
      overflow:hidden; max-width:100%; box-sizing:border-box;
    }
    .sb-url-group {
      display:flex; align-items:center; gap:6px; flex:1; min-width:0;
    }
    .sb-url-label {
      font-size:10px; font-weight:600; white-space:nowrap; flex-shrink:0;
      letter-spacing:.2px;
    }
    .sb-url-label-test { color:#ff8c00; }
    .sb-url-label-prod { color:#00b341; }
    .sb-url-field {
      flex:1; height:28px; border:1px solid #e5e5ea; border-radius:4px;
      padding:0 8px; font-size:11px; color:#1a1a1a;
      font-family:inherit; background:#f5f6f8; min-width:0;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      display:flex; align-items:center; cursor:text;
    }
    .sb-url-copy-btn {
      width:28px; height:28px; border:1px solid #e5e5ea; border-radius:4px;
      background:#fff; cursor:pointer; display:flex; align-items:center;
      justify-content:center; color:#666; flex-shrink:0;
      transition:background .12s,border-color .12s,color .12s;
    }
    .sb-url-copy-btn:hover {
      background:rgba(0,145,255,.08); border-color:#0091ff; color:#0091ff;
    }
    .sb-url-sep {
      width:1px; height:20px; background:#e5e5ea; flex-shrink:0;
    }
  `
  document.head.append(s)
}

/* ── Public ── */

export interface UrlBarConfig {
  testUrl: string
  prodUrl: string
}

export function mountUrlBar(config: UrlBarConfig): HTMLElement {
  injectStyles()

  const bar = document.createElement('div')
  bar.className = 'sb-url-bar'
  bar.setAttribute('data-url-bar', 'true')

  // mousedown で Quill の選択を奪わない
  bar.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault()
  })

  bar.append(
    createUrlGroup('検証用', 'test', config.testUrl),
    createSep(),
    createUrlGroup('本番用', 'prod', config.prodUrl),
  )

  return bar
}

/** URL を外から更新する（Version 切替時に呼ぶ） */
export function updateUrlBar(
  bar: HTMLElement,
  config: Partial<UrlBarConfig>,
): void {
  if (config.testUrl !== undefined) {
    const group = bar.querySelector<HTMLElement>('[data-url-type="test"]')
    if (group !== null) {
      const field = group.querySelector<HTMLElement>('.sb-url-field')
      if (field !== null) {
        field.textContent = config.testUrl
        field.title = config.testUrl
      }
      // コピーボタンのURLも更新（stale closure 防止）
      group.dataset['currentUrl'] = config.testUrl
    }
  }
  if (config.prodUrl !== undefined) {
    const group = bar.querySelector<HTMLElement>('[data-url-type="prod"]')
    if (group !== null) {
      const field = group.querySelector<HTMLElement>('.sb-url-field')
      if (field !== null) {
        field.textContent = config.prodUrl
        field.title = config.prodUrl
      }
      group.dataset['currentUrl'] = config.prodUrl
    }
  }
}

/* ── internal ── */

function createUrlGroup(label: string, type: 'test' | 'prod', url: string): HTMLElement {
  const grp = document.createElement('div')
  grp.className = 'sb-url-group'
  grp.setAttribute('data-url-type', type)
  // 現在のURLをデータ属性に保持（updateUrlBar で更新される）
  grp.dataset['currentUrl'] = url

  const labelEl = document.createElement('span')
  labelEl.className = `sb-url-label sb-url-label-${type}`
  labelEl.textContent = label

  const field = document.createElement('div')
  field.className = 'sb-url-field'
  field.textContent = url
  field.title = url

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'sb-url-copy-btn'
  btn.title = 'コピー'
  btn.innerHTML = COPY_ICON
  btn.addEventListener('click', () => {
    // stale closure 防止: data-current-url から最新URLを読み取る
    const currentUrl = grp.dataset['currentUrl'] ?? url
    void navigator.clipboard.writeText(currentUrl).then(
      () => toast(`${label}URLをコピーしました`),
      () => toast('コピーに失敗しました', 'error'),
    )
  })

  grp.append(labelEl, field, btn)
  return grp
}

function createSep(): HTMLElement {
  const s = document.createElement('span')
  s.className = 'sb-url-sep'
  return s
}
