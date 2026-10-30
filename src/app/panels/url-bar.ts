/**
 * URLコピーバー（コンテンツツールバーの代替）。
 *
 * 検証用URLと本番用URLをワンクリックでコピーできるバーを
 * キャンバス上部に表示する。旧コンテンツツールバーの位置に挿入する。
 *
 * 本番URLは「本番URLを発行」を押すまで出さない（2026-10-30 本人「本番URLは発行ボタンを押さない限り表示しない」
 * 「発行するのは、LP編集するページで」）。発行できるのは管理者だけ。発行したら「本番発行済み」と出す。
 */
import { DELIVERY_DOMAIN_UNSET_NOTE } from '../pages/basic-info-form.ts'
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
      display:flex; align-items:center; gap:6px; padding:0 8px;
      background:var(--sb-c-ffffff, #FFFFFF); border-bottom:1px solid var(--sb-c-e5e5ea, #E5E5EA); flex-shrink:0;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
      font-size:13px; user-select:none; min-height:40px; height:40px;
      overflow:hidden; box-sizing:border-box;
      /* 指示172: 右のアイコンレール(68px)はキャンバス本文の高さから始まるため、
         URLバー/ヘッダーの高さ帯ではレール列の上が空白になる。その68pxぶん右へ広げて
         プロパティパネル手前まで詰める（レールとは高さが重ならない）。68px=レール幅。 */
      width:calc(100% + 68px); max-width:none; margin-right:-68px;
    }
    .sb-url-group {
      display:flex; align-items:center; gap:5px; flex:1; min-width:0;
    }
    .sb-url-label {
      font-size:10px; font-weight:600; white-space:nowrap; flex-shrink:0;
      letter-spacing:.2px;
    }
    .sb-url-label-test { color:#ff8c00; }
    .sb-url-label-prod { color:#00b341; }
    /* 指示167: URL枠を可能な限り広くしてURLを枠内にピッタリ収める。
       余白/ギャップを詰めてフィールドの実効幅を最大化する。 */
    .sb-url-field {
      flex:1; height:28px; border:1px solid var(--sb-c-e5e5ea, #E5E5EA); border-radius:4px;
      padding:0 8px; font-size:11px; color:var(--sb-c-1a1a1a, #1A1A1A);
      font-family:inherit; background:var(--sb-c-f5f6f8, #F5F6F8); min-width:0;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      display:flex; align-items:center; cursor:text;
    }
    .sb-url-copy-btn {
      width:28px; height:28px; border:1px solid var(--sb-c-e5e5ea, #E5E5EA); border-radius:4px;
      background:var(--sb-c-ffffff, #FFFFFF); cursor:pointer; display:flex; align-items:center;
      justify-content:center; color:var(--sb-c-666666, #666666); flex-shrink:0;
      transition:background .12s,border-color .12s,color .12s;
    }
    .sb-url-copy-btn:hover {
      background:rgba(0,145,255,.08); border-color:var(--sb-accent, #0091FF); color:var(--sb-accent, #0091FF);
    }
    .sb-url-issue-btn {
      height:28px; padding:0 12px; border:none; border-radius:4px; flex-shrink:0;
      background:var(--sb-accent, #0091FF); color:#fff; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;
    }
    .sb-url-issue-btn:disabled { opacity:.6; cursor:default; }
    .sb-url-issued {
      font-size:10px; font-weight:700; white-space:nowrap; flex-shrink:0; color:#0B6B36;
      background:#DDF5E8; border-radius:999px; padding:2px 8px;
    }
    html[data-theme="dark"] .sb-url-issued { color:#5BD08A; background:rgba(22,163,74,.2); }
    .sb-url-sep {
      width:1px; height:20px; background:var(--sb-c-e5e5ea, #E5E5EA); flex-shrink:0;
    }
  `
  document.head.append(s)
}

/* ── Public ── */

export interface UrlBarConfig {
  testUrl: string
  prodUrl: string
  /**
   * 本番URLの発行。issued=false なら、URLの代わりに「未発行」と「本番URLを発行」ボタン（canIssue=false なら案内だけ）。
   * onIssue は発行できたら新しい本番URL（ドメイン未設定なら ''）、やめた・できなかったら null を返す
   */
  issue?: { issued: boolean; canIssue: boolean; onIssue: () => Promise<string | null> }
}

/** 発行前の欄の文字 */
const NOT_ISSUED_TEXT_ADMIN = '未発行（右の「本番URLを発行」を押すと、本番URLが出て開けるようになります）'
const NOT_ISSUED_TEXT_CREATOR = '未発行（本番URLは管理者が発行します）'

export function mountUrlBar(config: UrlBarConfig): HTMLElement {
  injectStyles()

  const bar = document.createElement('div')
  bar.className = 'sb-url-bar'
  bar.setAttribute('data-url-bar', 'true')

  // mousedown で Quill の選択を奪わない
  bar.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault()
  })

  const prodGroup = createUrlGroup('配信', 'prod', config.prodUrl)
  bar.append(createUrlGroup('プレビュー', 'test', config.testUrl), createSep(), prodGroup)
  if (config.issue !== undefined) wireIssue(bar, prodGroup, config.issue)

  return bar
}

/** 発行済みの印を、配信のラベルの右に出す */
function markIssued(prodGroup: HTMLElement): void {
  if (prodGroup.querySelector('.sb-url-issued') !== null) return
  const mark = document.createElement('span')
  mark.className = 'sb-url-issued'
  mark.textContent = '本番発行済み'
  prodGroup.querySelector('.sb-url-label')?.after(mark)
}

function wireIssue(bar: HTMLElement, prodGroup: HTMLElement, issue: NonNullable<UrlBarConfig['issue']>): void {
  if (issue.issued) {
    markIssued(prodGroup)
    return
  }
  const field = prodGroup.querySelector<HTMLElement>('.sb-url-field')
  const copyBtn = prodGroup.querySelector<HTMLElement>('.sb-url-copy-btn')
  const text = issue.canIssue ? NOT_ISSUED_TEXT_ADMIN : NOT_ISSUED_TEXT_CREATOR
  if (field !== null) {
    field.textContent = text
    field.title = text
    field.style.color = '#999'
  }
  // 発行前はコピーさせない（コピーのボタンごと隠す）
  if (copyBtn !== null) copyBtn.style.display = 'none'
  if (!issue.canIssue) return
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'sb-url-issue-btn'
  btn.textContent = '本番URLを発行'
  btn.addEventListener('click', () => {
    btn.disabled = true
    void issue.onIssue().then((url) => {
      if (url === null) {
        btn.disabled = false
        return
      }
      btn.remove()
      if (field !== null) field.style.color = ''
      if (copyBtn !== null) copyBtn.style.display = ''
      updateUrlBar(bar, { prodUrl: url })
      markIssued(prodGroup)
    })
  })
  prodGroup.append(btn)
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
      const isEmpty = config.prodUrl === ''
      const displayText = isEmpty ? NO_DOMAIN_TEXT : config.prodUrl
      const field = group.querySelector<HTMLElement>('.sb-url-field')
      if (field !== null) {
        field.textContent = displayText
        field.title = displayText
        field.style.color = isEmpty ? '#999' : ''
      }
      const btn = group.querySelector<HTMLElement>('.sb-url-copy-btn')
      if (btn !== null) {
        btn.style.opacity = isEmpty ? '0.4' : ''
        btn.style.pointerEvents = isEmpty ? 'none' : ''
      }
      group.dataset['currentUrl'] = config.prodUrl
    }
  }
}

/* ── internal ── */

/** 配信URLが無いとき（フォルダのドメイン未設定）に出す案内。コピーはさせない */
const NO_DOMAIN_TEXT = DELIVERY_DOMAIN_UNSET_NOTE

function createUrlGroup(label: string, type: 'test' | 'prod', url: string): HTMLElement {
  const grp = document.createElement('div')
  grp.className = 'sb-url-group'
  grp.setAttribute('data-url-type', type)
  const isEmpty = url === ''
  const displayText = isEmpty ? NO_DOMAIN_TEXT : url
  // 現在のURLをデータ属性に保持（updateUrlBar で更新される）
  grp.dataset['currentUrl'] = url

  const labelEl = document.createElement('span')
  labelEl.className = `sb-url-label sb-url-label-${type}`
  labelEl.textContent = label

  const field = document.createElement('div')
  field.className = 'sb-url-field'
  field.textContent = displayText
  field.title = displayText
  if (isEmpty) {
    field.style.color = '#999'
    field.style.fontStyle = 'normal'
  }

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'sb-url-copy-btn'
  btn.title = 'コピー'
  btn.innerHTML = COPY_ICON
  if (isEmpty) {
    btn.style.opacity = '0.4'
    btn.style.pointerEvents = 'none'
  }
  btn.addEventListener('click', () => {
    // stale closure 防止: data-current-url から最新URLを読み取る
    const currentUrl = grp.dataset['currentUrl'] ?? url
    if (currentUrl === '') return
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
